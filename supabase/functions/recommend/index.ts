// recommend - sistema de score 100 pts (docs/SCORE_SYSTEM.md)
// Ciudad: solo filtra, no puntúa. Eventos +10 sobre cine. Música +10, Festival +8.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
const corsHeaders = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type" };
function daysDiff(a: string, b: string): number { return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000; }
function parsePrice(v: unknown): number | null {
  if (typeof v === "number") return v > 0 ? v : null;
  if (typeof v !== "string") return null;
  const m = v.replace(/\s/g, "").match(/RD\$?([\d,]+)/i) || v.match(/([\d,]+)/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return isNaN(n) || n <= 0 ? null : n;
}
function isWeekend(dateStr: string): boolean { const d = new Date(dateStr + "T12:00:00").getDay(); return d === 0 || d === 5 || d === 6; }
const CATEGORY_PREMIUM: Record<string, number> = { "Música": 10, "Festival": 8 };

type Breakdown = { category: number; type: number; budget: number; recency: number; quality: number };
type Scored = Record<string, unknown> & { score: number; scoreBreakdown: Breakdown; kind: string };

function scoreCategory(itemCat: string | null, filterCat: string | null): number {
  let s = 0;
  if (filterCat && itemCat === filterCat) s += 25;
  if (itemCat && CATEGORY_PREMIUM[itemCat]) s += CATEGORY_PREMIUM[itemCat];
  return Math.min(s, 35);
}
function scoreType(kind: string, typeFilter: string): number {
  if (typeFilter !== "todos") return 0;
  return kind === "evento" ? 10 : 0;
}
function scoreBudget(priceTag: string | null, price: unknown, filterBudget: string | null): number {
  if (filterBudget === "Gratis") return priceTag === "Gratis" ? 15 : 0;
  if (filterBudget === "De pago") {
    if (priceTag !== "De pago") return 0;
    const n = parsePrice(price);
    const cheapBonus = n == null ? 0 : Math.max(0, 5 - n / 2000);
    return Math.min(15, 10 + cheapBonus);
  }
  return priceTag === "Gratis" ? 5 : 0;
}
function scoreRecency(startDate: string | null, today: string): number {
  if (!startDate) return 0;
  const d = daysDiff(startDate, today);
  if (d < 0) return 0;
  let s = d <= 7 ? 25 * (1 - d / 7) : Math.max(0, 25 - (d - 7) * 0.5);
  if (isWeekend(startDate)) s += 5;
  if (d > 60) s -= 5;
  return Math.max(0, Math.min(25, s));
}
function scoreQualityEvent(e: Record<string, unknown>): number {
  let s = 0;
  const img = e.img_url as string;
  if (img && img !== "N/A") s += 5;
  if (((e.description as string) ?? "").length > 50) s += 4;
  if (e.hour_start) s += 2;
  if (e.more_info_url ?? e.source_url) s += 1;
  return Math.min(s, 15);
}
function scoreQualityMovie(m: Record<string, unknown>): number {
  let s = 0;
  const img = (m.image ?? m.img_url) as string;
  if (img && img !== "N/A") s += 5;
  if (((m.synopsis as string) ?? "").length > 50) s += 4;
  if (m.rating && (m.rating as number) > 7.5) s += 3;
  if (m.tmdb_id) s += 1;
  return Math.min(s, 15);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const city = url.searchParams.get("city"); const budget = url.searchParams.get("budget");
  const type = url.searchParams.get("type") ?? "todos"; const category = url.searchParams.get("category");
  const date = url.searchParams.get("date"); const sort = url.searchParams.get("sort") ?? "score";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 50);
  const page = Math.max(parseInt(url.searchParams.get("page") ?? "1"), 1); const offset = (page - 1) * limit;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!; const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: req.headers.get("Authorization") ?? `Bearer ${anonKey}` } } });
  try {
    const today = new Date().toISOString().slice(0, 10);
    const results: Scored[] = [];
    let eventsTotal = 0, moviesTotal = 0;
    const scoreEvent = (e: Record<string, unknown>): Scored => {
      const cat = (e.category as string) ?? null;
      const b: Breakdown = {
        category: scoreCategory(cat, category),
        type: scoreType("evento", type),
        budget: scoreBudget(e.price_tag as string, (e as Record<string, unknown>).price ?? null, budget),
        recency: scoreRecency(e.start_date as string, date ?? today),
        quality: scoreQualityEvent(e),
      };
      const total = Math.min(100, b.category + b.type + b.budget + b.recency + b.quality);
      return { kind: "evento", ...e, score: Math.round(total * 10) / 10, scoreBreakdown: b };
    };
    const scoreMovie = (m: Record<string, unknown>): Scored => {
      const genres = (m.genres as string[]) ?? [];
      const cat = category && genres.includes(category) ? category : (genres[0] ?? null);
      const b: Breakdown = {
        category: scoreCategory(cat, category),
        type: scoreType("cine", type),
        budget: 0,
        recency: scoreRecency(m.start_date as string, date ?? today),
        quality: scoreQualityMovie(m),
      };
      const total = Math.min(100, b.category + b.type + b.budget + b.recency + b.quality);
      return { kind: "cine", ...m, score: Math.round(total * 10) / 10, scoreBreakdown: b };
    };

    if (type === "todos") {
      const fetchLimit = page * limit;
      let qE = supabase.from("events").select("*", { count: "exact" }).order("start_date", { ascending: true }).limit(fetchLimit * 2);
      if (date) qE = qE.gte("start_date", date); else qE = qE.gte("start_date", today);
      if (city) qE = qE.eq("province", city); if (budget === "Gratis" || budget === "De pago") qE = qE.eq("price_tag", budget); if (category) qE = qE.eq("category", category);
      const { data: eData, error: eErr, count: eCount } = await qE; if (eErr) throw eErr; eventsTotal = eCount ?? eData?.length ?? 0;
      for (const e of eData ?? []) results.push(scoreEvent(e as Record<string, unknown>));
      let qM = supabase.from("movies").select("*", { count: "exact" }).order("start_date", { ascending: true }).limit(fetchLimit);
      if (category) qM = qM.contains("genres", [category]); if (date) qM = qM.gte("start_date", date); else qM = qM.gte("start_date", today);
      const { data: mData, error: mErr, count: mCount } = await qM; if (mErr) throw mErr; moviesTotal = mCount ?? mData?.length ?? 0;
      for (const m of mData ?? []) results.push(scoreMovie(m as Record<string, unknown>));
      const seen = new Set<string>();
      const deduped = results.filter(r => { const k = `${(r as Record<string, unknown>).slug ?? (r as Record<string, unknown>).title}|${(r as Record<string, unknown>).start_date}`; if (seen.has(k)) return false; seen.add(k); return true; });
      const total = deduped.length > 0 ? eventsTotal + moviesTotal - (results.length - deduped.length) : eventsTotal + moviesTotal;
      sortResults(deduped, sort);
      const paginated = deduped.slice(offset, offset + limit);
      const hasMore = offset + limit < total;
      return new Response(JSON.stringify({ ok: true, total, count: paginated.length, page, limit, hasMore, data: paginated }), { headers: { ...corsHeaders, "content-type": "application/json" } });
    }
    if (type === "eventos") {
      let q = supabase.from("events").select("*", { count: "exact" }).order("start_date", { ascending: true }).range(offset, offset + limit - 1);
      if (date) q = q.gte("start_date", date); else q = q.gte("start_date", today);
      if (city) q = q.eq("province", city); if (budget === "Gratis" || budget === "De pago") q = q.eq("price_tag", budget); if (category) q = q.eq("category", category);
      const { data, error, count } = await q; if (error) throw new Error(JSON.stringify(error));
      eventsTotal = count ?? 0;
      for (const e of data ?? []) results.push(scoreEvent(e as Record<string, unknown>));
      const seenE = new Set<string>();
      const dedupedE = results.filter(r => { const k = `${(r as Record<string, unknown>).slug}|${(r as Record<string, unknown>).start_date}`; if (seenE.has(k)) return false; seenE.add(k); return true; });
      const dedupedTotal = eventsTotal - (results.length - dedupedE.length);
      sortResults(dedupedE, sort);
      const hasMore = offset + limit < dedupedTotal;
      return new Response(JSON.stringify({ ok: true, total: dedupedTotal, count: dedupedE.length, page, limit, hasMore, data: dedupedE }), { headers: { ...corsHeaders, "content-type": "application/json" } });
    }
    if (type === "cine") {
      let q = supabase.from("movies").select("*", { count: "exact" }).order("start_date", { ascending: true }).range(offset, offset + limit - 1);
      if (category) q = q.contains("genres", [category]); if (date) q = q.gte("start_date", date); else q = q.gte("start_date", today);
      const { data, error, count } = await q; if (error) throw new Error(JSON.stringify(error));
      moviesTotal = count ?? 0;
      for (const m of data ?? []) results.push(scoreMovie(m as Record<string, unknown>));
      const seenM = new Set<string>();
      const dedupedM = results.filter(r => { const k = String((r as Record<string, unknown>).external_id ?? (r as Record<string, unknown>).slug); if (seenM.has(k)) return false; seenM.add(k); return true; });
      const dedupedTotalM = moviesTotal - (results.length - dedupedM.length);
      sortResults(dedupedM, sort);
      const hasMore = offset + limit < dedupedTotalM;
      return new Response(JSON.stringify({ ok: true, total: dedupedTotalM, count: dedupedM.length, page, limit, hasMore, data: dedupedM }), { headers: { ...corsHeaders, "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true, total: 0, count: 0, page, limit, hasMore: false, data: [] }), { headers: { ...corsHeaders, "content-type": "application/json" } });
  } catch (error) { return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } }); }
});

function sortResults(rows: Scored[], sort: string) {
  if (sort === "fecha") rows.sort((a, b) => String(a.start_date ?? "").localeCompare(String(b.start_date ?? "")));
  else if (sort === "precio") rows.sort((a, b) => {
    const pa = a.kind === "evento" ? ((a.price_tag === "Gratis") ? 0 : (parsePrice(a.price) ?? 999999)) : 999999;
    const pb = b.kind === "evento" ? ((b.price_tag === "Gratis") ? 0 : (parsePrice(b.price) ?? 999999)) : 999999;
    if (pa !== pb) return pa - pb;
    return b.score - a.score;
  });
  else rows.sort((a, b) => b.score - a.score || String(a.start_date ?? "").localeCompare(String(b.start_date ?? "")));
}

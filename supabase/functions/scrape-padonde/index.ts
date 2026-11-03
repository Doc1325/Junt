// scrape-padonde - cron diario JuntApp - fuentes padonde.do verificadas 2026-09-02
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { isRelevantEventSlug } from "./catalog.ts";
import { getEventQualityIssue } from "./event-quality.ts";
import { isFreePriceText, isPaidPriceText, mapPrice, resolveEventPrice } from "./price.ts";
const PADONDE_BASE = "https://padonde.do";
const LIST_URLS = [`${PADONDE_BASE}/`, `${PADONDE_BASE}/eventos/santo-domingo`, `${PADONDE_BASE}/eventos/santiago`];
function extractSlugs(html: string): string[] {
  const s = new Set<string>();
  // 1) href="/evento/slug" normal
  let re = /href="\/evento\/([^"]+)"/g; let m: RegExpExecArray | null;
  while ((m = re.exec(html))) s.add(m[1].replace(/\\.*$/, ""));
  // 2) RSC escapado href="\/evento\/slug" o \/evento\/slug
  re = /\\\/evento\\\/([^"\\]+)/g;
  while ((m = re.exec(html))) s.add(m[1]);
  // 3) fallback genérico /evento/slug sin href (next_f, sitemap)
  re = /\/evento\/([a-z0-9-]+)/gi;
  while ((m = re.exec(html))) s.add(m[1]);
  return [...s].filter(Boolean);
}
function extractEventFromHtml(html: string): Record<string, unknown> | null {
  let base: Record<string, unknown> | null = null;
  const ldMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const match of ldMatches) {
    try {
      const parsed = JSON.parse(match[1]); const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const obj of arr) if (obj["@type"] === "Event") {
        base = {
          title: obj.name, event_description: obj.description ?? "", province: obj.location?.address?.addressLocality ?? "",
          venue: obj.location?.name ?? "", start_date: obj.startDate ?? null, end_date: obj.endDate ?? null,
          img_url: obj.image ?? null, more_info_url: obj.offers?.url ?? null,
          events_details: { price: obj.offers?.price ?? "De pago", source: "padonde.do" },
          slug: obj.url ? new URL(obj.url).pathname.replace("/evento/", "") : "",
        };
        break;
      }
      if (base) break;
    } catch { /* ignore */ }
  }
  // RSC (__next_f) - intentar extracción directa
  let extra: Record<string, unknown> = {};
  const nextMatch = html.match(/"event":\s*\{[\s\S]*?"slug":"[^"]+"[\s\S]*?\}/);
  if (nextMatch) {
    try {
      const chunk = nextMatch[0];
      const get = (k: string) => chunk.match(new RegExp(`"${k}"\\s*:\\s*"([^"]*)"`))?.[1] ?? null;
      extra = { id: get("id"), category: get("category"), province: get("province"), venue: get("venue"), start_date: get("start_date"), hour_start: get("hour_start"), slug: get("slug"), img_url: get("img_url"), more_info_url: get("more_info_url") };
    } catch { /* ignore */ }
  }
  // Solo usar el precio RSC del objeto principal ya aislado. Buscar globalmente podía tomar
  // el precio de un evento similar mostrado al final de la página.
  const rscPriceMatch = nextMatch?.[0].match(/"events_details":\s*\{[^}]*?"price":"([^"]*)"/);
  const rscPrice = rscPriceMatch?.[1] ?? null;
  // Fallback DOM solo para categoría: buscar primer badge de categoría conocida (no usar precio global)
  const badgeMatches = [...html.matchAll(/<span class="badge[^"]*">\s*([^<]+?)\s*<\/span>/g)].map(m => m[1].trim()).filter(Boolean);
  if (!extra.category && badgeMatches.length > 0) {
    const knownCats = ["Bienestar","Comedia","Cultura","Deporte","Educativo","Festival","Música","Musica","Otros","Teatro"];
    const dateBadges = ["Hoy","Mañana","En "];
    const filtered = badgeMatches.filter(v => !dateBadges.some(d => v.includes(d)) && !/RD\$|US\$|DOP|\$/.test(v) && !/gratis|entrada libre|free/i.test(v));
    const cat = filtered.find(v => knownCats.some(k => v.toLowerCase().includes(k.toLowerCase()))) ?? filtered[0];
    if (cat && cat.length < 30) extra.category = cat;
  }
  // Precio: combinar fuentes con precedencia conservadora. Señales explícitas de pago en el
  // badge o descripción (consumo mínimo, cover, boletas) anulan un "Gratis" incorrecto del LD/RSC.
  const ldPriceRaw = (base?.events_details as unknown as { price: unknown } | undefined)?.price;
  const mainBadges = badgeMatches.slice(0, 4).filter(v => isFreePriceText(v) || isPaidPriceText(v));
  const resolvedPrice = resolveEventPrice({
    ldPrice: ldPriceRaw,
    rscPrice,
    mainBadges,
    description: String(base?.event_description ?? extra.event_description ?? ""),
  });
  if (base) {
    const merged = { ...base, ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v != null)) } as Record<string, unknown>;
    (merged.events_details as { price: unknown }).price = resolvedPrice;
    return merged;
  }
  if (extra.slug) {
    (extra as unknown as { events_details: { price: unknown } }).events_details = { price: resolvedPrice };
    return extra;
  }
  return null;
}
async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": "junte-scraper/1.0", accept: "text/html" } });
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`); return await res.text();
}

async function discoverEventSlugs(): Promise<Set<string>> {
  const allSlugs = new Set<string>();
  const paginatedUrls: string[] = [];
  for (const base of LIST_URLS) {
    paginatedUrls.push(base);
    for (let page = 2; page <= 8; page++) paginatedUrls.push(`${base}?page=${page}`);
    paginatedUrls.push(`${base}?_rsc=1`);
  }
  for (const url of paginatedUrls) {
    try {
      const html = await fetchHtml(url);
      for (const slug of extractSlugs(html)) allSlugs.add(slug);
      if (url.includes("?_rsc=")) {
        try {
          const rscRes = await fetch(url, { headers: { "RSC": "1", "Next-Router-State-Tree": "%5B%22%22%2C%7B%22children%22%3A%5B%22eventos%22%2C%7B%22children%22%3A%5B%5B%22slug%22%2C%22santo-domingo%22%2C%22oc%22%5D%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%5D%7D%5D%7D%5D%7D%2Cnull%2Cnull%2Ctrue%5D", "Next-Url": "/eventos/santo-domingo" } });
          if (rscRes.ok) for (const slug of extractSlugs(await rscRes.text())) allSlugs.add(slug);
        } catch { /* ignore optional RSC prefetch */ }
      }
    } catch (error) { console.error("discover", url, error); }
  }
  if (allSlugs.size < 50) {
    try {
      const sitemap = await fetch(`${PADONDE_BASE}/sitemap.xml`, { headers: { accept: "application/xml" } });
      if (sitemap.ok) {
        for (const slug of extractSlugs(await sitemap.text())) {
          if (isRelevantEventSlug(slug)) allSlugs.add(slug);
        }
      }
    } catch { /* keep the slugs already discovered */ }
  }
  return allSlugs;
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!; const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const providedSecret = req.headers.get("x-scrape-secret") ?? "";
  const configuredSecret = Deno.env.get("SCRAPE_SECRET") ?? "";
  let authorized = Boolean(providedSecret && configuredSecret && providedSecret === configuredSecret);
  if (!authorized && providedSecret) {
    const { data } = await supabase.rpc("verify_scrape_cron_secret", { candidate: providedSecret });
    authorized = data === true;
  }
  if (!authorized) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });

  const reqUrl = new URL(req.url);
  const mode = reqUrl.searchParams.get("mode") ?? "full";
  const requestedOffset = Math.max(parseInt(reqUrl.searchParams.get("offset") ?? "0"), 0);
  const requestedLimit = Math.min(Math.max(parseInt(reqUrl.searchParams.get("limit") ?? "40"), 1), 50);
  const { data: run } = await supabase.from("scrape_runs").insert({ mode, batch_offset: requestedOffset, batch_limit: requestedLimit, status: "running" }).select("id").maybeSingle();
  const runId = (run as { id?: string } | null)?.id;
  const finish = async (payload: Record<string, unknown>, status = 200) => {
    if (runId) await supabase.from("scrape_runs").update({ status: status < 400 ? "completed" : "failed", finished_at: new Date().toISOString(), stats: payload, error: status < 400 ? null : String(payload.error ?? "Unknown error") }).eq("id", runId);
    return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
  };
  try {
    // Modo prices: re-revisar precios de filas ya guardadas por lotes (?mode=prices&limit=30&offset=0&only=gratis).
    // Existe porque el run full supera el timeout con ~300 slugs; por lotes cabe en el límite.
    if (mode === "prices") {
      const limit = requestedLimit;
      const offset = requestedOffset;
      const only = reqUrl.searchParams.get("only") ?? "gratis";
      let q = supabase.from("events").select("id, slug, price_tag, price, category", { count: "exact" }).order("created_at", { ascending: true }).range(offset, offset + limit - 1);
      if (only === "gratis") q = q.eq("price_tag", "Gratis");
      const { data: rows, error: qErr, count } = await q;
      if (qErr) throw new Error(JSON.stringify(qErr));
      let checked = 0, corrected = 0, stillGratis = 0, failed = 0, rejected = 0;
      const fixed: string[] = [];
      for (const row of rows ?? []) {
        const slug = (row as Record<string, string>).slug;
        if (!slug) { failed++; continue; }
        try {
          const html = await fetchHtml(`${PADONDE_BASE}/evento/${slug}`);
          const ev = extractEventFromHtml(html) as Record<string, unknown> | null;
          if (!ev || !ev.slug) { failed++; continue; }
          if (getEventQualityIssue(ev)) { checked++; rejected++; continue; }
          const rawPrice = (ev.events_details as unknown as { price: unknown })?.price;
          const { priceTag, priceText } = mapPrice(rawPrice);
          const patch: Record<string, unknown> = {};
          if ((row as Record<string, unknown>).price_tag !== priceTag || (row as Record<string, unknown>).price !== priceText) {
            patch.price_tag = priceTag;
            patch.price = priceText;
          }
          const newCat = ev.category as string;
          if (newCat && newCat !== "Otros" && (row as Record<string, unknown>).category === "Otros") patch.category = newCat;
          if (Object.keys(patch).length > 0) {
            const { error: uErr } = await supabase.from("events").update(patch).eq("id", (row as Record<string, string>).id);
            if (!uErr) { corrected++; if (fixed.length < 20) fixed.push(slug); }
            else failed++;
          } else if ((row as Record<string, unknown>).price_tag === "Gratis") {
            stillGratis++;
          }
          checked++;
          await new Promise(r => setTimeout(r, 120));
        } catch (e) { console.error(slug, e); failed++; }
      }
      return await finish({ ok: true, mode: "prices", total: count ?? 0, offset, limit, checked, corrected, stillGratis, failed, rejected, fixed });
    }
    const moviesUpserted: number[] = [];
    if (mode !== "catalog") {
      for (const path of ["/api/moviesWeek", "/api/moviesSoon"]) {
        try {
          const res = await fetch(`${PADONDE_BASE}${path}`, { headers: { accept: "application/json" } }); if (!res.ok) continue;
          const data = await res.json();
          for (const m of data) {
            const { error } = await supabase.from("movies").upsert({ external_id: m.id, title: m.title, genres: m.genres ?? [], rating: m.rating ?? null, start_date: m.start_date ?? null, synopsis: m.synopsis ?? null, slug: m.slug ?? null, image: m.img_url ?? null, tmdb_id: m.tmdb_id ?? null }, { onConflict: "external_id" });
            if (!error) moviesUpserted.push(1);
          }
        } catch (e) { console.error(e); }
      }
    }
    let targetSlugs: string[] = [];
    let eventsFound = 0;
    if (mode === "catalog") {
      const { data: queued, error: queueError, count } = await supabase.from("scrape_event_queue")
        .select("slug", { count: "exact" })
        .order("slug", { ascending: true })
        .range(requestedOffset, requestedOffset + requestedLimit - 1);
      if (queueError) throw new Error(JSON.stringify(queueError));
      targetSlugs = (queued ?? []).map((row: { slug: string }) => row.slug);
      eventsFound = count ?? 0;
    } else {
      const discoveredAt = new Date().toISOString();
      const discovered = await discoverEventSlugs();
      targetSlugs = [...discovered].sort();
      eventsFound = targetSlugs.length;
      if (mode === "discover") {
        if (targetSlugs.length < 50) throw new Error(`Discovery returned only ${targetSlugs.length} slugs; previous queue preserved`);
        const { error: queueError } = await supabase.from("scrape_event_queue").upsert(targetSlugs.map(slug => ({ slug, discovered_at: discoveredAt })), { onConflict: "slug" });
        if (queueError) throw new Error(JSON.stringify(queueError));
        await supabase.from("scrape_event_queue").delete().lt("discovered_at", discoveredAt);
        return await finish({ ok: true, mode: "discover", moviesUpserted: moviesUpserted.length, eventsFound });
      }
    }
    let eventsUpserted = 0, eventsUpdated = 0, eventsSkipped = 0, eventsFailed = 0, eventsRejected = 0;
    for (const slug of targetSlugs) {
      try {
        const html = await fetchHtml(`${PADONDE_BASE}/evento/${slug}`);
        const ev = extractEventFromHtml(html) as Record<string, string> | null;
        if (!ev || !ev.slug) { eventsFailed++; continue; }
        if (getEventQualityIssue(ev)) { eventsRejected++; continue; }
        const title = (ev.title as string) ?? slug;
        let province = (ev.province as string)?.trim() || "";
        // Si no hay province en LD/RSC, intentar extraer de venue o dejar vacío para no inflar Santo Domingo
        if (!province) {
          const venueRaw = (ev.venue as string) || "";
          if (venueRaw.toLowerCase().includes("santiago")) province = "Santiago";
          else if (venueRaw.toLowerCase().includes("santo domingo")) province = "Santo Domingo";
          else province = ""; // no asumir
        }
        if (!province) { eventsFailed++; continue; }
        const venue = (ev.venue as string) || "Por confirmar"; const category = (ev.category as string) || "Otros";
        const rawPrice = (ev.events_details as unknown as { price: unknown })?.price;
        const { priceTag, priceText } = mapPrice(rawPrice);
        const startDate = (ev.start_date as string) ?? new Date().toISOString().slice(0, 10);
        // Evitar duplicados exactos por título+provincia+fecha (padonde tiene eventos duplicados),
        // pero propagar correcciones (precio/categoría) a la fila existente en vez de ignorarlas.
        try {
          const { data: dup } = await supabase.from("events").select("id, slug, price_tag, price, category").eq("title", title).eq("province", province).eq("start_date", startDate).limit(1);
          if (dup && dup.length > 0) {
            const existing = dup[0] as Record<string, unknown>;
            const patch: Record<string, unknown> = {};
            if (existing.price_tag === "Gratis" && priceTag === "De pago") { patch.price_tag = priceTag; patch.price = priceText; }
            if (!existing.price && priceText) patch.price = priceText;
            if (existing.category === "Otros" && category !== "Otros") patch.category = category;
            if (Object.keys(patch).length > 0) {
              const { error: updateError } = await supabase.from("events").update(patch).eq("id", existing.id as string);
              if (updateError) eventsFailed++; else eventsUpdated++;
            } else {
              eventsSkipped++;
            }
            continue;
          }
        } catch { /* ignore */ }
        const { error } = await supabase.from("events").upsert({ external_id: (ev.id as string) ?? slug, slug: (ev.slug as string) ?? slug, title, description: (ev.event_description as string) ?? "", category, province, venue, start_date: startDate, end_date: (ev.end_date as string) ?? null, hour_start: (ev.hour_start as string) ?? null, hour_end: (ev.hour_end as string) ?? null, price_tag: priceTag, price: priceText, image: (ev.img_url as string) ?? null, source_url: (ev.more_info_url as string) ?? null, source: "padonde.do" }, { onConflict: "slug" });
        if (!error) eventsUpserted++; else eventsFailed++; await new Promise(r => setTimeout(r, 150));
      } catch (e) { console.error(e); eventsFailed++; }
    }
    return await finish({ ok: true, mode, offset: requestedOffset, limit: requestedLimit, moviesUpserted: moviesUpserted.length, eventsFound, batchSize: targetSlugs.length, eventsUpserted, eventsUpdated, eventsSkipped, eventsFailed, eventsRejected });
  } catch (error) { return await finish({ ok: false, mode, error: String(error) }, 500); }
});

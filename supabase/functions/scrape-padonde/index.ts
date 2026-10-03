// scrape-padonde - cron diario JuntApp - fuentes padonde.do verificadas 2026-09-02
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
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
  // RSC también trae events_details.price (ej. {"price":"Gratis"} o {"price":"RD$2,000"}) fuera del chunk recortado
  const rscPriceMatch = html.match(/"events_details":\s*\{[^}]*?"price":"([^"]*)"/);
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
  // Precio: LD offers.price === 0 es placeholder de padonde (ej. Don Miguelo con badge "Hasta RD$3,000"),
  // tratarlo como desconocido y preferir el badge del evento principal.
  const isPaidText = (v: string) => /RD\$|US\$|DOP|\$/.test(v);
  const isFreeText = (v: string) => /gratis|entrada libre|free/i.test(v);
  const ldPriceRaw = (base?.events_details as unknown as { price: unknown } | undefined)?.price;
  const ldUnknown = ldPriceRaw == null || ldPriceRaw === "De pago" || ldPriceRaw === 0 || ldPriceRaw === "0";
  let priceFromBadge: string | null = null;
  if (!base || ldUnknown) {
    // Buscar badge de precio solo en el bloque principal del evento (fecha+categoría+precio van primero,
    // el resto son "Eventos Similares" y no valen)
    const mainBadges = badgeMatches.slice(0, 4);
    const priceBadge = mainBadges.find(v => isFreeText(v) || isPaidText(v));
    if (priceBadge) {
      if (isPaidText(priceBadge)) priceFromBadge = priceBadge; // ej "RD$2,000", "Hasta RD$3,000", "US$50"
      else priceFromBadge = "Gratis";
    } else if (rscPrice) {
      priceFromBadge = rscPrice;
    }
  }
  if (base) {
    const merged = { ...base, ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v != null)) } as Record<string, unknown>;
    const ldPrice = (merged.events_details as { price: unknown })?.price;
    // Badge del evento principal manda sobre LD desconocido (null, "De pago" por defecto, o 0 placeholder).
    // Un badge "Hasta RD$3,000" / "RD$2,000" siempre gana a un LD 0. Un badge "Gratis" solo vale si viene
    // del bloque principal (primeros 3 badges), nunca de "Eventos Similares".
    if (priceFromBadge) (merged.events_details as { price: string }).price = priceFromBadge;
    else if (typeof ldPrice === "number" && ldPrice > 0) (merged.events_details as { price: string }).price = String(ldPrice);
    else if (ldPrice === 0 || ldPrice === "0") (merged.events_details as { price: string }).price = "De pago";
    return merged;
  }
  if (extra.slug) {
    if (priceFromBadge) (extra as unknown as { events_details: { price: string } }).events_details = { price: priceFromBadge };
    return extra;
  }
  return null;
}
async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": "junte-scraper/1.0", accept: "text/html" } });
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`); return await res.text();
}

// Mapeo único de precio extraído -> {priceTag, priceText}. Misma regla en modo full y modo prices.
function mapPrice(rawPrice: unknown): { priceTag: string; priceText: string | null } {
  const paidRe = /RD\$|US\$|DOP|\$/;
  const freeRe = /gratis|entrada libre|free/i;
  if (typeof rawPrice === "string" && paidRe.test(rawPrice)) return { priceTag: "De pago", priceText: rawPrice.trim() };
  if (typeof rawPrice === "string" && freeRe.test(rawPrice)) return { priceTag: "Gratis", priceText: "Gratis" };
  if (typeof rawPrice === "number" && rawPrice > 0) return { priceTag: "De pago", priceText: `RD$${Number(rawPrice).toLocaleString('es-DO')}` };
  if (typeof rawPrice === "string" && !isNaN(Number(rawPrice)) && Number(rawPrice) > 0) return { priceTag: "De pago", priceText: `RD$${Number(rawPrice).toLocaleString('es-DO')}` };
  return { priceTag: "De pago", priceText: null };
}
Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  const scrapeSecret = Deno.env.get("SCRAPE_SECRET");
  if (!scrapeSecret) return new Response(JSON.stringify({ error: "SCRAPE_SECRET is not configured" }), { status: 503, headers: { "content-type": "application/json" } });
  if (req.headers.get("x-scrape-secret") !== scrapeSecret) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!; const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  try {
    const reqUrl = new URL(req.url);
    // Modo prices: re-revisar precios de filas ya guardadas por lotes (?mode=prices&limit=30&offset=0&only=gratis).
    // Existe porque el run full supera el timeout con ~300 slugs; por lotes cabe en el límite.
    if (reqUrl.searchParams.get("mode") === "prices") {
      const limit = Math.min(parseInt(reqUrl.searchParams.get("limit") ?? "30"), 50);
      const offset = Math.max(parseInt(reqUrl.searchParams.get("offset") ?? "0"), 0);
      const only = reqUrl.searchParams.get("only") ?? "gratis";
      let q = supabase.from("events").select("id, slug, price_tag, price, category", { count: "exact" }).order("created_at", { ascending: true }).range(offset, offset + limit - 1);
      if (only === "gratis") q = q.eq("price_tag", "Gratis");
      const { data: rows, error: qErr, count } = await q;
      if (qErr) throw new Error(JSON.stringify(qErr));
      let checked = 0, corrected = 0, stillGratis = 0, failed = 0;
      const fixed: string[] = [];
      for (const row of rows ?? []) {
        const slug = (row as Record<string, string>).slug;
        if (!slug) { failed++; continue; }
        try {
          const html = await fetchHtml(`${PADONDE_BASE}/evento/${slug}`);
          const ev = extractEventFromHtml(html) as Record<string, unknown> | null;
          if (!ev || !ev.slug) { failed++; continue; }
          const rawPrice = (ev.events_details as unknown as { price: unknown })?.price;
          const { priceTag, priceText } = mapPrice(rawPrice);
          const patch: Record<string, unknown> = {};
          if (priceTag === "De pago" && (row as Record<string, unknown>).price_tag === "Gratis") {
            patch.price_tag = "De pago"; patch.price = priceText;
          } else if (!(row as Record<string, unknown>).price && priceText && priceText !== "Gratis") {
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
      return new Response(JSON.stringify({ ok: true, mode: "prices", total: count ?? 0, offset, limit, checked, corrected, stillGratis, failed, fixed }), { headers: { "content-type": "application/json" } });
    }
    const moviesUpserted: number[] = [];
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
    const allSlugs = new Set<string>();
    // Paginación: padonde muestra 168 en SD pero solo 5 por sección en HTML estático, iteramos ?page=1..8 y RSC
    const paginatedUrls: string[] = [];
    for (const base of LIST_URLS) {
      paginatedUrls.push(base);
      for (let p = 2; p <= 8; p++) paginatedUrls.push(`${base}?page=${p}`);
      // RSC prefetch variant que suele contener más slugs (Flight data)
      paginatedUrls.push(`${base}?_rsc=1`);
    }
    for (const url of paginatedUrls) {
      try {
        const html = await fetchHtml(url);
        const slugs = extractSlugs(html);
        for (const s of slugs) allSlugs.add(s);
        // Si es RSC, también probar con header RSC:1
        if (url.includes("?_rsc=")) {
          try {
            const rscRes = await fetch(url, { headers: { "RSC": "1", "Next-Router-State-Tree": "%5B%22%22%2C%7B%22children%22%3A%5B%22eventos%22%2C%7B%22children%22%3A%5B%5B%22slug%22%2C%22santo-domingo%22%2C%22oc%22%5D%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%5D%7D%5D%7D%5D%7D%2Cnull%2Cnull%2Ctrue%5D", "Next-Url": "/eventos/santo-domingo" } });
            if (rscRes.ok) {
              const rscText = await rscRes.text();
              for (const s of extractSlugs(rscText)) allSlugs.add(s);
            }
          } catch { /* ignore */ }
        }
      } catch (e) { console.error(e); }
    }
    // Fallback sitemap: intenta enumerar todos los eventos si el HTML paginado falló (<50 encontrados)
    if (allSlugs.size < 50) {
      try {
        const sm = await fetch(`${PADONDE_BASE}/sitemap.xml`, { headers: { accept: "application/xml" } });
        if (sm.ok) {
          const smText = await sm.text();
          for (const s of extractSlugs(smText)) allSlugs.add(s);
        }
      } catch { /* ignore */ }
    }
    let eventsUpserted = 0, eventsFailed = 0;
    for (const slug of allSlugs) {
      try {
        const html = await fetchHtml(`${PADONDE_BASE}/evento/${slug}`);
        const ev = extractEventFromHtml(html) as Record<string, string> | null;
        if (!ev || !ev.slug) { eventsFailed++; continue; }
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
            if (Object.keys(patch).length > 0) await supabase.from("events").update(patch).eq("id", existing.id as string);
            eventsFailed++; continue;
          }
        } catch { /* ignore */ }
        const { error } = await supabase.from("events").upsert({ external_id: (ev.id as string) ?? slug, slug: (ev.slug as string) ?? slug, title, description: (ev.event_description as string) ?? "", category, province, venue, start_date: startDate, end_date: (ev.end_date as string) ?? null, hour_start: (ev.hour_start as string) ?? null, hour_end: (ev.hour_end as string) ?? null, price_tag: priceTag, price: priceText, image: (ev.img_url as string) ?? null, source_url: (ev.more_info_url as string) ?? null, source: "padonde.do" }, { onConflict: "slug" });
        if (!error) eventsUpserted++; else eventsFailed++; await new Promise(r => setTimeout(r, 150));
      } catch (e) { console.error(e); eventsFailed++; }
    }
    return new Response(JSON.stringify({ ok: true, moviesUpserted: moviesUpserted.length, eventsFound: allSlugs.size, eventsUpserted, eventsFailed }), { headers: { "content-type": "application/json" } });
  } catch (error) { return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500 }); }
});

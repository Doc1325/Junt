# JuntApp — Plan de Implementación: Recomendaciones padonde.do

## 1. Objetivo

Feature "¿Pa dónde vamos?" que recomienda salidas basadas en padonde.do con filtros **ciudad (Santo Domingo/Santiago), presupuesto (Gratis), tipo (cine/eventos)**.

## 2. Investigación previa (ver PADONDE_SCRAPING.md)

- HAR home: solo `api/moviesWeek|Soon` son JSON públicos; eventos son SSR, sin API.
- HAR evento: 0 APIs, solo RSC prefetch.
- HTML home: filtros `Todos/Santo Domingo/Santiago`, secciones Hoy/Pronto, cards `a[href^="/evento/"]`, 136+ SD / 32+ Santiago.
- HTML detalle: `LD+JSON Event` + RSC `$L18 {event:{category,province,hour_start...}}` + DOM `span.badge`.

## 3. Diseño inicial barajado

- Opción A (descartada): scraping en cliente Android → CORS, batería, SSR.
- Opción B (elegida): backend Supabase con cron + API `recommend`, web consume vía `VITE_SUPABASE_URL` (ya tenías proyecto `juntapp` en `https://qyvawuzuumlammtqxljd.supabase.co`).

## 4. Fases

### Fase 1 — Backend Supabase (1-2 días)

- Migración `20260201000000_junte_events_and_movies.sql`: `events` (province, price_tag, category, start_date, city generated) + `movies` (genres[], rating), índices, RLS select anon, trigger `updated_at`.
- Edge Function `scrape-padonde` (Deno, `service_role`, verify_jwt false): fetch `api/movies*` → upsert movies; fetch `/, /eventos/santo-domingo, /eventos/santiago` → slugs → por cada slug fetch `/evento/<slug>` → `extractEventFromHtml` (LD+JSON base + RSC extra + badge fallback) → upsert events.
- Edge Function `recommend` (verify_jwt false, CORS *): `GET ?city=&budget=&type=&category=&limit=` con scoring `category*3 + city*2 + Gratis*1 + proximidad fecha`, sort.

### Fase 2 — Frontend Web (2-3 días)

- `src/lib/recommendations.ts` (constantes ciudades/presupuestos/tipos/categorías, `buildRecommendUrl`, `fetchRecommendations` con `VITE_SUPABASE_*`)
- `src/components/Recommendations.tsx` + `Recommendations.css` (custom, sin Tailwind inline, paleta `--ink/olive/lime/paper/line`):
  - Inicial: chips `Comedia, Teatro...` → iteración: filtros en 1 línea con `select` desplegables (Ciudad, Presupuesto, Tipo, Categoría) en `bg--paper`.
  - Cards: iteraciones `200×200` → responsive `w-full aspect-square` → `90×90` final, `a>div` (no `button`), `h-[380px]` fijo uniforme, `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`, título `inline-block max-w-[100px] break-words [overflow-wrap:anywhere]`, solo `título + categoría + costo` en card.
  - Título centrado `text-center` tras feedback.
- `src/pages/Discover.tsx` (`/groups/:groupId/discover`) + `src/pages/EventDetail.tsx` (`/detalle/:kind/:slug`) con detalle completo (venue, fecha, descripción, `Ver fuente` tix.do) + `Usar para plan` (sessionStorage prefill).
- Integración `src/pages/NewPlan.tsx`: `useEffect` lee `junte_prefill` para pre-llenar título/fecha, `Recommendations` embebido abajo + link a Discover; `src/pages/Group.tsx`: botón `✨ Descubrir`; `src/App.tsx`: rutas `/groups/:groupId/discover` y `/detalle/:kind/:slug`; `src/App.css`: `.app-shell 620→1040px, .form-page 460→720px`.

### Fase 3 — Estilo / UX (iterativo)

- Filtros: `grid` chips → 1 línea `select` con paleta
- Cards: `200×200` → `90×90` (feedback "too big") → `inline-block` títulos → grid responsive `auto-rows-fr` → `a>div` → resumir a 3 campos + detalle separado → centrar títulos → 2 columnas max → wrap títulos → `100px max` → replantear grid responsive (`repeat(auto-fill)`) → volver a `90×90`

### Fase 4 — Migración proyecto

- Inicialmente implementado en `Charadas` (Mímica) + `Desktop/junte test` (beta HTML Tailwind CDN). Luego deshecho quirúrgicamente (`git clean` solo `junte`, preservado `Mega Pack`/`StoreEntryButton`) y movido a `JuntApp` real (`Documents/JuntApp`) con `VITE_SUPABASE_*` (no `EXPO_PUBLIC_`).

## 5. Validación

- `supabase db push` (ya `20260201` remoto ok), `functions deploy` ambas, `invoke scrape-padonde` → `moviesUpserted:39, eventsFound:26, Counter({'Música':9,...})` (antes `Otros:26` por bug de `category` → fix badge).
- `curl /functions/v1/recommend?city=Santo%20Domingo&category=Música` → `count:6` (antes 0).
- `npm run build` ok (1,037kB), `vite` sin errores.

## 6. Deploy pendiente

```bash
supabase link --project-ref qyvawuzuumlammtqxljd
supabase functions deploy recommend --no-verify-jwt  # ya hecho
supabase functions deploy scrape-padonde --no-verify-jwt # ya hecho
# cron 0 6 * * * en Dashboard
```

## 7. Limpieza

- `Charadas` quedó solo con Mega Pack; `Desktop/junte test` es redundante y puede borrarse; docs borrados inicialmente (`docs/IMPLEMENTATION_PLAN.md` etc.) → recreados ahora aquí.

# JuntApp — Arquitectura de Recomendaciones (padonde.do)

## Objetivo

Recomendar salidas basadas en padonde.do con filtros: **ciudad** (Santo Domingo/Santiago), **presupuesto** (Gratis/Cualquiera), **tipo** (cine/eventos/todos), **categoría** (Comedia, Teatro, Música...), con score y detalle.

## Stack

- DB Supabase Postgres: `events` + `movies` (RLS `select` anon)
- Edge Functions Deno: `scrape-padonde` (cron) + `recommend` (API)
- Web: React + Vite + Tailwind, `@tanstack/react-query`, `Recommendations.tsx` + `EventDetail.tsx` + `Recommendations.css`

## Tablas (supabase/migrations/20260201000000_junte...)

```sql
events(id uuid, external_id text unique, slug text unique, title text, description text, category text, province text, venue text, start_date date, hour_start time, price_tag text, image text, source_url text, city text generated as province)
movies(id uuid, external_id text unique, title text, genres text[], rating float, start_date date, synopsis text, image text, tmdb_id bigint)
-- índices: province, price_tag, start_date, category, genres GIN
-- RLS: events_select_all / movies_select_all for select using (true)
```

## Edge Functions

### scrape-padonde (cron diario 06:00)

`supabase/functions/scrape-padonde/index.ts` — usa `service_role`:

1. `GET /api/moviesWeek` + `/api/moviesSoon` → `upsert movies` onConflict `external_id`
2. `GET /, /eventos/santo-domingo, /eventos/santiago` → `extractSlugs` via `href="/evento/([^"]+)"` → set de slugs
3. Por cada slug: `GET /evento/<slug>` → `extractEventFromHtml`:
   - Base desde `LD+JSON Event` (`name, description, location, startDate, image, offers.price/url`)
   - Enriquecimiento RSC (`"event":{...}`) para `category/province/hour_start`
   - Fallback DOM `span.badge` para `category` y `Gratis` (si falla JSON fragmentado)
   - `upsert events` onConflict `slug`, throttle 150ms
- Retorna `{ok, moviesUpserted, eventsFound, eventsUpserted, eventsFailed}`

Verificado 2026-09-05: `moviesUpserted:39, eventsFound:26, Counter({'Música':9,'Teatro':6,'Otros':5,...})`. Antes del fix `Counter({'Otros':26})`.

### recommend (API pública)

`supabase/functions/recommend/index.ts` — `verify_jwt=false`, CORS `*`, usa `anonKey`:

`GET /functions/v1/recommend?city=Santo%20Domingo&budget=Gratis&type=eventos&category=Música&date=YYYY-MM-DD&limit=20`

```ts
today = now().slice(0,10)
if (type eventos|todos) q = from('events').gte(start_date, date||today).eq(province).eq(price_tag).eq(category).order(start_date).limit(limit*2)
  score = (category match 3) + (city match 2) + (Gratis 1) + max(0, 2 - daysDiff(start_date, today)*0.3)
if (type cine|todos) q = from('movies').contains(genres, category).gte(start_date).order(start_date)
  score = (genre match 3) + (rating>7.5 1) + 0.5
sort desc score, slice limit → {ok, count, data: [{kind:'evento'|'cine', ...row, score}]}
```

Auth: `apikey: sb_publishable_...` + `Authorization: Bearer sb_publishable_...` (verify_jwt false permite `sb_publishable_` sin `service_role`).

Test 2026-09-05:
- `?city=Santo%20Domingo&category=Música` → `count:6` (antes 0), eventos `Ivy Negro` etc.
- `?city=Santo%20Domingo` → `count:20` eventos SD
- Sin filtros → mix eventos + cine

## Frontend

- `src/lib/recommendations.ts`: `JUNTE_CITIES/BUDGETS/TYPES/CATEGORIES`, `buildRecommendUrl`, `fetchRecommendations` (fetch con `VITE_SUPABASE_URL/ANON_KEY`)
- `src/components/Recommendations.tsx` + `Recommendations.css` (custom, sin Tailwind inline):
  - Header `¿Pa dónde vamos?` + badge `EN VIVO` lime
  - Filtros: 1 línea `flex` con 4 `select` desplegables (Ciudad, Presupuesto, Tipo, Categoría) en `bg-[var(--paper)]` 
  - Grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` `gap-3`, cards `h-[380px]` fijo uniforme, imagen `90×90` `aspect-square`, título `inline-block` `line-clamp-2` `break-words [overflow-wrap:anywhere]`, `max-w-[100px]` para no expandir
  - Card = `<a><div>` (no `<button>`) → `href=/detalle/:kind/:slug`, `div` interno; solo `título + categoría + costo` en card, resto en detalle
  - Estados: loading skeleton, error, empty dashed
- `src/pages/Discover.tsx`: ruta `/groups/:groupId/discover`, usa `Recommendations` con `onSelect` que guarda `sessionStorage junte_prefill` y navega a `/groups/:groupId/plans/new`
- `src/pages/EventDetail.tsx`: ruta `/detalle/:kind/:slug`, query `events|movies` por `slug|external_id` (usa `location.state.item` si viene de lista), muestra imagen 400×400, categoría/costo badges, `📍 province·venue`, `📅 date·hour`, `✨ category`, `💸 price`, descripción, botones `Usar para plan` (prefill) + `Ver fuente` (tix.do)
- `src/pages/NewPlan.tsx`: `useEffect` lee `junte_prefill` para pre-llenar `title/description/scheduledAt`, sección `Recommendations` embebida abajo + link a `/discover`

## Deploy

```bash
supabase link --project-ref qyvawuzuumlammtqxljd
supabase db push # ya pushado 20260201 (events/movies)
supabase functions deploy scrape-padonde --no-verify-jwt
supabase functions deploy recommend --no-verify-jwt
supabase functions invoke scrape-padonde --no-verify-jwt # poblar
# cron: Dashboard > Edge Functions > Cron 0 6 * * * -> scrape-padonde
npm run build # vite ok
```

## Paleta

`:root {--ink:#18261f; --olive:#28533a; --lime:#d8ff62; --paper:#f6f5f0; --line:#d9ddd4; --muted:#69746d}` en `src/App.css` (.app-shell max-width 1040px, .form-page 720px).


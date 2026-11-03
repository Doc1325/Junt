# padonde.do — Análisis de Scraping (HAR + HTML)

Fecha: 2026-09-02 / 2026-09-05  
Stack padonde.do: Next.js App Router (RSC `text/x-component`), Google Frontend / Cloud Run (`padonde-site-191929502175.us-central1.run.app`), imágenes en `padonde-images.padonde.do` + `pub-8fe523...r2.dev` (R2), Firebase `projectId 191929502175` (key expuesta `AIzaSyDSYSa53...` con 404 en webConfig).

## 1. HAR Home (`https://padonde.do/`)

**APIs JSON públicas (únicas con `application/json`):**

| Método | Endpoint | Cache | Payload |
|--------|----------|-------|---------|
| GET | `https://padonde.do/api/moviesWeek` | `no-store` | 4 películas semana (ej. The Dog Stars 2026-08-27, Harry Potter rating 7.9) schema `{id,title,img_url,start_date,genres[],rating,synopsis,slug}` |
| GET | `https://padonde.do/api/moviesSoon` | `no-store` | 32+ próximos estrenos 2026-09-02 → 2026-11-26, mismo schema + `tmdb_id` |

Sin `?city` ni `province`. Son cartelera nacional Caribbean Cinemas.

**RSC Prefetch (Next.js):** `GET /eventos?_rsc=1wtp7`, `/cine?_rsc=...`, `/en?_rsc=...`, `/evento/<slug>?_rsc=...` → `text/x-component` gzipped, mayoría `ERR_ABORTED` por prefetch cancelado. Solo 1 con body: `/evento/comedy-showcase...` con `{"b":"oPnUK...","f":...}` routing.

**Firebase:** `GET firebase.googleapis.com/v1alpha/.../webConfig` → 404 App not found, `www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig` → 200 con `authorizedDomains: ["padonde.do", "192.168.0.233", ...]`.

## 2. HAR Evento (`/evento/ivy-negro-a-los-ojos-...`)

0 APIs JSON. Solo RSC prefetches `/?_rsc=e45iy`, `/eventos?_rsc=`, `/cine?_rsc=`, `/en?_rsc=` todos `ERR_ABORTED`. El detalle es **SSR**: el HTML ya trae los datos, no hay `fetch` cliente.

## 3. HTML Home (`padonde.do — Eventos y cine...html`)

- Chips filtros: `Todos | Santo Domingo | Santiago`
- Secciones: `Hoy (5 eventos)`, `Pronto (8+ eventos)` en `div.grid > a[href^="/evento/"]` con `p.card-title`, `p.meta-text` (`Santo Domingo · Sala Carlos Piantini`), `badge Gratis`, `chips Teatro/Comedia`. `Cine` con `Esta Semana / Proximamente` → `a[href^="/pelicula/"]`.
- RSC `self.__next_f.push` con JSON Flight Data incluye `event` objeto completo.
- Footer links `/eventos/santo-domingo` (136+), `/eventos/santiago` (32+), `/eventos/puerto-plata`, `/eventos/la-altagracia`.

## 4. HTML Detalle (`COMEDY SHOWCASE - THE GREEN ROOM...html`)

Dos fuentes parseables sin JS:

**A) LD+JSON (`script[type="application/ld+json"]`):**
```json
{"@type":"Event","name":"COMEDY SHOWCASE - THE GREEN ROOM","description":"CONSUMO MINIMO...","startDate":"2026-09-02","endDate":"2026-09-02","location":{"name":"The Green Room","address":{"addressLocality":"Santo Domingo"}},"offers":{"price":"Gratis","priceCurrency":"DOP","url":"https://tix.do/event/COMEDYSHOWCASETHEGREENROOM-9"},"image":"https://padonde-images.padonde.do/tximg/...","url":"https://padonde.do/evento/..."}
```

**B) RSC `$L18` (`self.__next_f`):**
```json
{"event":{"id":"eec10efe-a0d0-4347-8ec1-902b3be590ec","title":"COMEDY SHOWCASE - THE GREEN ROOM","event_description":"...","category":"Comedia","province":"Santo Domingo","venue":"The Green Room","start_date":"2026-09-02","hour_start":"21:30:00","img_url":"...","more_info_url":"https://tix.do/event/...","events_details":{"price":"Gratis","source":"Tix"},"slug":"comedy-showcase-..."}}
```

**DOM fallback:** `<span class="badge">Comedia</span>` + `<span class="badge badge-solid-success">Gratis</span>`, `<p class="meta-text">Santo Domingo · The Green Room</p>`, mapa `maps.googleapis.com/maps/api/staticmap?center=The+Green+Room...&key=AIzaSyASrmei...`.

## 5. Conclusión para scraping

- **Eventos no tienen API REST.** Hay que scrapear HTML: `fetch /evento/<slug>` → parsear `LD+JSON` (base) + enriquecer con `badge/category` del DOM y `RSC` si existe.
- **Películas sí tienen API** (`/api/moviesWeek|Soon`) — usar directo.
- **Listado ciudades:** `fetch /, /eventos/santo-domingo, /eventos/santiago` → `extractSlugs` vía `href="/evento/([^"]+)"`.
- Filtros reales padonde.do: `province` (Santo Domingo, Santiago, Puerto Plata...), `category` (Comedia, Teatro, Música, Cultura, Otros, Deporte, Familia), `price_tag` (Gratis vs De pago, badge).

## 6. Precedencia de precio

Pa' Dónde puede publicar `offers.price = "Gratis"` y un badge `Gratis` aunque la descripción exija consumo mínimo. Junt no debe considerar esos eventos gratuitos. La clasificación usa esta precedencia:

1. Badge explícito con moneda o precio.
2. Descripción con `consumo mínimo`, `cover`, `boletas`, `tickets`, `preventa` o `admisión` pagada.
3. Precio pagado del objeto RSC principal o del JSON-LD.
4. Badge gratuito del evento principal.
5. Precio gratuito RSC/JSON-LD.

El precio RSC nunca se busca en toda la página, porque podría pertenecer a la sección de eventos similares.

## 7. Control de calidad de fuentes externas

Los enlaces específicos de Zona Colonial bajo `/actividad/<slug>` son eventos válidos.
La página genérica `zonacolonial.do/actividades/`, en cambio, contiene tarjetas de
patrocinadores que Pa' Dónde puede presentar como si fueran eventos. El scraper rechaza
únicamente esa página genérica y registra el caso en `eventsRejected`; no bloquea el
dominio completo ni elimina eventos legítimos de Zona Colonial.


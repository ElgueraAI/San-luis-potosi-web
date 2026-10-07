# Smart map + routing · working plan

Branch `feature/smart-map-routing`. Base checkpoint `122d6bb` (checkpoint-B) untouched. **No commits** until the user reviews (checkpoint-C).

## 1 · Initial state (inspected 2026-10-06)

- [x] Astro 7 static (`output: 'static'`), GitHub Pages base path via `BASE_PATH`/`SITE_URL`. No server runtime.
- [x] Map library: **MapLibre GL JS 6.12** + OpenFreeMap positron, worker vendored by `scripts/vendor-maplibre.mjs`; `src/scripts/map.ts` loaded lazily by `site.ts` (IntersectionObserver) only where `[data-map]` exists.
- [x] `MapView.astro` modes: `full` (region + interest chips, panel, list), `region`, `mini`, `route`.
- [x] POI: `/data/places.json` (built from `src/data/research.ts` + `src/data/portal.ts`): 57 destinations (28 verified · 21 approximate · 8 without point) + 966 entity points (58 municipal seats, archaeology, museums/venues, protected areas, lodging) — entities are hidden on the discovery map.
- [x] Coordinates: `status: 'ready'` = official verified point; `'provisional'` = approximate (OSM / SIC / DENUE); `'none'` = not plotted. Legend and list already distinguish them.
- [x] Mi Ruta: `route-store.ts`, localStorage key `slp:mi-ruta:v1` = ordered array of place ids; up/down/remove/clear; cross-tab sync; header counter; every «Añadir a Mi Ruta» button is `[data-route-add]`.
- [x] Route map (`mode="route"`): **dashed straight line** between saved places, numbered DOM markers. Caption already says it is not a road route.
- [x] `/rutas/` itineraries: SVG straight-line sketches + brochure distances (official tables). Out of scope; left as is.
- [x] Checks available: `astro check`, `astro build`, Playwright scripts in `scripts/verify/` (Chrome/Edge executable).

## 2 · Architecture decisions

- [x] Map provider: keep MapLibre + OpenFreeMap (no migration; see `docs/map-api-decision.md`).
- [x] Routing provider: openrouteservice at `api.heigit.org` through a proxy (primary) · FOSSGIS OSRM keyless fallback · mock for tests.
- [x] Key strategy: `ORS_API_KEY` server-only (Vite dev/preview proxy) · production via `PUBLIC_ROUTE_PROXY_URL` to `serverless/route-proxy/` Worker. Nothing secret in `PUBLIC_*`.
- [x] Geolocation: explicit button only, `getCurrentPosition` → optional `watchPosition` («Seguir mi posición») with `clearWatch`; position kept in memory only.
- [x] Optimization: one road matrix + nearest-neighbour + 2-opt, never applied without the visitor's choice.

## 3 · Implementation

- [x] `src/scripts/geo/types.ts` — Coordinate, RouteWaypoint, RouteLeg, RouteResult, RouteError, LocationState, RouteProfile
- [x] `geo/format.ts` — km / m / h / min (es-MX)
- [x] `geo/location-service.ts` — states: idle, requesting, ok, approximate, denied, unavailable, timeout, stale, unsupported
- [x] `geo/route-provider.ts` + `geo/providers/{ors,osrm}.ts` — normalized result + errors (mock = Playwright fixtures in `scripts/verify/routing.mjs` and stubbed `fetch` in unit tests, so no mock code ships)
- [x] `geo/route-cache.ts` — memory + sessionStorage, TTL
- [x] `geo/route-optimizer.ts` — NN + 2-opt (pure)
- [x] `geo/route-session.ts` — origin, profile, debounce, cache, subscriptions shared by the planner and the maps
- [x] `geo/map-layers.ts` — user dot + accuracy circle, route line + alternatives, start / stop / end markers
- [x] `geo/recommend.ts` — transparent rule-based suggestions
- [x] `src/scripts/route-planner.ts` + Mi Ruta UI — origin, mode, summary, legs, optimize compare, retry
- [x] `map.ts` — locate control, user layer, Mi Ruta overlay on the discovery map, clustered extra layers
- [x] `/data/route-context.json` — compact events per municipality for recommendations
- [x] `astro.config.mjs` dev/preview proxy · `.env.example` · `serverless/route-proxy/`
- [x] Docs: `map-api-decision.md`, `smart-tourism-next-phase.md`

## 4 · Tests

- [x] Unit (node:test, `npm run test:geo`): optimizer, providers parsing, error mapping, cache key, format
- [x] Browser (Playwright, `scripts/verify/routing.mjs`): geolocation granted / denied / unsupported / timeout / altitude null, one & several stops, reorder, optimize, remove, refresh persistence, 429, offline, provider error, approximate stop, mobile & desktop, overflow, console errors
- [x] `astro check`, `astro build`, existing interaction checks
- [x] Secret scan of `dist/` and git

## 5 · Validation (2026-10-06, after session recovery)

- `npm run test:geo` → 22/22 pass.
- `astro check` → 0 errors, 0 warnings (9 pre-existing unused-import hints in untouched pages).
- `npm run build` → 305 pages.
- `scripts/verify/routing.mjs` (mocked provider) → 93/93 pass, including mobile / tablet / desktop overflow.
- `scripts/verify/interactions.mjs` (existing regression) → 48/48 pass.
- Secret scan: no key, `ORS_API_KEY` or `Authorization` value in `dist/`; `.env` is git-ignored and absent; diff has no secrets.
- Checkpoint `122d6bb` intact; nothing committed.

## 6 · Pending / out of scope (noted, not done)

- Production proxy is a template only (`serverless/route-proxy/`), not deployed; without it production uses the keyless FOSSGIS fallback.
- `--live` run of `routing.mjs` (one real request) not executed in this pass.
- `/rutas/` itineraries keep the SVG sketch; English pages not built.
- Next steps: `docs/smart-tourism-next-phase.md`.

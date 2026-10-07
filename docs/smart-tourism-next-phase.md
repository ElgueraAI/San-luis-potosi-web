# Smart tourism · what exists and what comes next

Branch `feature/smart-map-routing` (2026-10-06). Companion to `docs/map-api-decision.md` (providers, quotas,
keys) and `docs/smart-map-routing-plan.md` (task checklist).

## What the visitor gets now

| Capability | Where | Source of truth |
|---|---|---|
| «Usar mi ubicación» (explicit button, never on load), accuracy circle, altitude when the device reports it, «Seguir mi posición» with `clearWatch` | `/mapa/`, `/mi-ruta/` | `geo/location-service.ts` (position kept in memory only) |
| Road route through every saved stop, per-leg distance/time, totals, start / stop / end markers | `/mi-ruta/`, Mi Ruta overlay on `/mapa/` | `geo/route-session.ts` + provider |
| Starting point: my location, first saved place, any municipal seat | `/mi-ruta/` | `places.json` (58 seats) |
| Mode: car / bike / foot | `/mi-ruta/` | provider profiles |
| Alternatives (origin → single destination only) | `/mi-ruta/` | provider `alternatives` |
| «Optimizar recorrido»: compares current vs optimized order, applied only if the visitor accepts | `/mi-ruta/` | one road matrix + `geo/route-optimizer.ts` (exact Held–Karp up to 12 points, NN + 2-opt above) |
| Suggestions with an explicit reason | `/mi-ruta/` | `geo/recommend.ts` + `/data/route-context.json` |
| Honest failure: no straight line ever replaces a road route; stops stay on the map; «Reintentar ruta» | everywhere | normalized `RouteError` codes |

### Recommendation rules (transparent, rule-based)

Every card states why it appears. No rule claims crowding, availability, prices or live traffic, because the
portal has no source for any of them.

- **near-route**: destinations / nature / archaeology within a corridor of the road line (car 6 km, bike 2.5 km,
  foot 1 km). Distance shown is straight-line to the line and labelled as such. Approximate points are flagged.
- **interest**: places that share an interest tag with saved stops rank higher.
- **event**: verified events in a stop's municipality (or region-wide) in the trip month or the next, always with
  their date status (confirmed / pattern / to be confirmed).
- **lodging**: registered lodging points from `places.json` within 10 km of the last stop.
- **dishes**: regional dishes from the official brochures for the regions the route crosses.

## Known limits (stated on the site where relevant)

- **Approximate coordinates**: 21 destinations use OSM / SIC / DENUE points. They are routed but marked as
  approximate; 8 destinations without a point cannot be routed and say so.
- **Keyless fallback**: FOSSGIS OSRM is a community service for low-volume, non-commercial use, throttled to
  ≤ 1 request/s in the client. A commercial or high-traffic launch must switch to `ors` (proxy) or `none`.
- **No live traffic, closures or road condition.** Times are the provider's free-flow estimate (the UI says "sin tráfico en tiempo real" beside the totals). Sierra Gorda /
  Huasteca roads may be slower in the rainy season; the UI does not warn about that yet (see next phase, item 6).
- **Altitude** depends on the device; when it is `null` the card says «Tu dispositivo no reporta altitud».
- **`/rutas/` itineraries** still show the SVG sketch with official brochure distances, not road geometry
  (out of scope for this phase).
- **Spanish only**: `/en/my-route/` is declared in `src/i18n/routes.ts` but no English pages are built yet,
  so every routing string is Spanish.

## Next phase (proposed, not started)

1. **Deploy the proxy** (`serverless/route-proxy/`) and set `PUBLIC_ROUTE_PROXY_URL` in the Pages workflow, so
   production routes through openrouteservice within its documented quota instead of the community fallback.
2. **Verify the 21 approximate points** against official sources (research layer first, then `places.json`),
   and add points for the 8 destinations that have none.
3. **Road geometry for `/rutas/`**: precompute each official itinerary once at build time (cached JSON in the
   repo, provider attribution kept) instead of calling the API per visit.
4. **Shareable route**: encode stop ids + mode in the URL hash (no coordinates of the visitor).
5. **Offline-friendly Mi Ruta**: keep the last computed route (without the visitor's position) for the session
   so a lost signal in the Huasteca still shows the line already received.
6. **Seasonal context** in recommendations: reuse the season data (`temporadas`) to warn about rainy-season
   roads and peak dates, with the same "why" sentence pattern.
7. **Accessibility pass** on the planner with a screen reader (keyboard order is covered by
   `scripts/verify/routing.mjs`; announcements of route changes via `aria-live` should be checked by a person).
8. **English Mi Ruta** once the content team approves the translated strings.

Anything that would need real-time data (crowding, ticket availability, traffic) stays out until there is an
official, attributable source for it.

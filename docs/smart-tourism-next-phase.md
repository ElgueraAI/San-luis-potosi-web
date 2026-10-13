# Smart tourism · what exists and what comes next

Branches `feature/smart-map-routing` and `feature/live-routing-engine` (2026-10-06). Companion to `docs/map-api-decision.md` (providers, quotas,
keys) and `docs/smart-map-routing-plan.md` (task checklist).

> Checkpoints F–K (branch `feature/smart-tourism-engine`) built the intelligence layer on top of what this
> document describes: recommender, route-aware suggestions, redistribution, segments and the dashboard. See
> `docs/smart-tourism-architecture.md`. Item 6 below (seasonal context in recommendations) is done there.

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
| Live trip: next destination, remaining distance and time, ETA (no live traffic), trip progress, travelled part muted on the map, camera follow + «Recentrar» | `/mi-ruta/` only | `geo/navigation.ts` + `geo/route-geometry.ts` |
| Off-route detection and bounded automatic rerouting (max(60 m, 1.5 × accuracy); 3 readings or 15 s; 45 s cooldown; 6 per trip), manual «Recalcular ruta» | `/mi-ruta/` | `geo/navigation.ts` (rules in `map-api-decision.md` § Live navigation) |
| Arrival («Has llegado a …»), «Marcar como visitado», «Continuar al siguiente lugar», trip summary, «Restablecer recorrido»; visited stops survive a refresh | `/mi-ruta/` | `geo/trip-store.ts` (place ids only) |
| Offline mid-trip keeps the last route and progress; pause on hidden tab, safe resume; optional «Mantener pantalla encendida» | `/mi-ruta/` | `geo/nav-controller.ts`, `nav-ui.ts` |

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

- **Live navigation is not a driving navigator**: no turn-by-turn, no voice, no traffic, no background
  tracking (browsers suspend geolocation when the page is hidden; the trip pauses and says so).
- **No mid-trip provider failover**: if openrouteservice fails during a trip the previous route is kept; the
  OSRM demo is not used as an automatic backup for production traffic.
- **ETA** scales the provider's leg time by the share of the leg still ahead; it does not learn from the
  visitor's actual speed.
- **Thresholds are untested on real roads**: all navigation checks use simulated GPS.

## Next phase (proposed, not started)

0. **Field test + turn-by-turn**: drive a real route in the Huasteca with a phone to tune the off-route and
   arrival thresholds, then add turn-by-turn on the extension point described in `map-api-decision.md`.
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

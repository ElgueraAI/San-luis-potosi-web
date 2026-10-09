# Map and routing API decision

Consulted: **2026-10-06**. Every quota below comes from the provider's own page on that date;
nothing was estimated. If a provider changes its terms, update this file before changing code.

## Constraint that drives the decision

The portal is a **static Astro build deployed to GitHub Pages** (`astro.config.mjs`, `output: 'static'`).
GitHub Pages has no server code, so **any key placed in browser JavaScript is public**. openrouteservice
states explicitly that keys "must not be used client-side in an application"
([FAQ](https://giscience.github.io/openrouteservice/frequently-asked-questions.html)).

## Map rendering — keep what exists

| | |
|---|---|
| Library | **MapLibre GL JS 6.12** (already installed, BSD-3-Clause). Already loaded lazily only on pages with a map (`src/scripts/site.ts`). It draws GeoJSON lines, circles, clusters and DOM markers, which is everything routing needs. **No migration.** |
| Basemap | **OpenFreeMap** `https://tiles.openfreemap.org/styles/positron` (already used). |
| Terms | "No registration, no user database, no API keys, no cookies", "no limits on the number of map views or requests", commercial use allowed. Attribution required: *OpenFreeMap © OpenMapTiles Data from OpenStreetMap* (MapLibre shows it from the style). Source: <https://openfreemap.org/> |

## Routing — candidates

| Provider | Key | Free limits (official) | Fit |
|---|---|---|---|
| **openrouteservice (HeiGIT)** | yes | Standard plan: Directions **2,000/day · 40/min**, Matrix **500/day · 40/min**, Optimization **500/day · 40/min**. Directions: ≤ **50 waypoints**, ≤ 6,000 km, ≤ 3 alternative routes. Matrix: ≤ 3,500 cells (50 × 50). Daily quota is a rolling 24 h window; minute quota is a sliding 60 s window; over-quota answers **403** (daily) and **429** (minute); headers `x-ratelimit-remaining`, `x-ratelimit-reset`. | **Primary** provider. Generous, documented, open source, academic origin (Heidelberg). Needs a server-side key. |
| OSRM via **FOSSGIS** `routing.openstreetmap.de` | no | "One request per second max", "no scraping, no heavy usage", valid user agent / referrer, show OSM attribution and a "fix the map" link. OSRM project page: "restricted to reasonable, non-commercial use-cases … no guarantees wrt. uptime". | **Keyless academic fallback.** Open source, no key, CORS `*` (verified with a request), car / bike / foot, `route` and `table` services. Not a production SLA. |
| GraphHopper | yes | Free plan: **500 credits/day**, "non-commercial use only", **5 locations per request**. | Rejected: 5 locations is too few for Mi Ruta; key would also need a proxy. |
| Valhalla (FOSSGIS instance) | no | Same FOSSGIS service family and policy as above. | Not added: OSRM already covers the keyless case; a second keyless provider adds code without adding capability here. |
| Google Directions | — | — | Not used (brief forbids it, directly or indirectly). |

### openrouteservice endpoint (verified)

`api.openrouteservice.org` was **deprecated on 2026-04-28** in favour of `api.heigit.org`; requests to the
old host get 10 % of the quota since late August 2026 and it is being shut down
([announcement](https://ask.openrouteservice.org/t/deprecating-api-openrouteservice-org-in-favour-of-api-heigit-org/7912),
[quota notice](https://ask.openrouteservice.org/t/reducing-the-quota-of-deprecated-api-api-openrouteservice-org/8013)).
The code only uses the new host:

| Service | URL used |
|---|---|
| Directions | `POST https://api.heigit.org/openrouteservice/v2/directions/{profile}/geojson` |
| Matrix | `POST https://api.heigit.org/openrouteservice/v2/matrix/{profile}` |
| (Optimization, not called) | `https://api.heigit.org/vroom/v0` |

Auth: `Authorization: <key>` header. A request without a key returned **401** on 2026-10-06 (endpoint alive).
Keys: <https://account.heigit.org/> (plans page: <https://account.heigit.org/info/plans>, linked from the old
`openrouteservice.org/plans/`). Restrictions: <https://openrouteservice.org/restrictions/>.

### FOSSGIS OSRM endpoint (verified)

`GET https://routing.openstreetmap.de/routed-{car|bike|foot}/route/v1/{driving|bike|foot}/{lon,lat;…}` and
`/table/v1/…` — both answered 200 with `Access-Control-Allow-Origin: *` on 2026-10-06.
Policy: <https://routing.openstreetmap.de/about.html>, <https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server>.

## Decision

```
RouteProvider (src/scripts/geo/route-provider.ts)
├── ors          openrouteservice through a key-holding proxy   ← primary
│     dev:  Vite proxy in astro.config.mjs  (/api/ors → api.heigit.org, key from ORS_API_KEY, Node only)
│     prod: PUBLIC_ROUTE_PROXY_URL → serverless/route-proxy (Cloudflare Worker template, key as a Worker secret)
├── osrm-fossgis keyless, non-commercial academic fallback, throttled to ≤ 1 req/s in the client
├── mock     deterministic fixture for tests (never selected in production unless set explicitly)
└── none     routing switched off: stops are shown, no line is drawn
```

`PUBLIC_ROUTING_PROVIDER=auto` (default): **ors** when a proxy is available, otherwise **osrm-fossgis**.
Why this is the conservative choice:

* The ORS key never reaches the browser or `dist/` (dev proxy runs in Node; production proxy is a separate
  serverless function). Only booleans/URLs are exposed through `PUBLIC_*`.
* With no key at all, the site still routes on real roads through an open, keyless service whose published
  policy covers low-volume non-commercial use, and it is throttled below that policy's 1 request/second.
  If the portal ever becomes commercial or high-traffic, set `PUBLIC_ROUTING_PROVIDER=ors` (or `none`).
* No provider is ever replaced by a straight line. Failure = points without a line + an honest message.

### Multi-stop optimization

Instead of the Optimization (VROOM) endpoint, the client asks for **one Matrix** (ORS) or **one `table`**
(OSRM) of road durations/distances and orders stops locally with **nearest-neighbour + 2-opt** on road
duration (`src/scripts/geo/route-optimizer.ts`). One matrix call per optimization, any number of re-runs
for free, works with both providers, and ≤ 25 stops stay far below the 3,500-cell limit.

### Quota protection

* Route results cached by `provider|profile|ordered coordinates (5 decimals)|alternatives` — memory + sessionStorage, 30 min.
* Recalculation debounced (450 ms) and only triggered by a change in stops, order, origin or profile (never map repaint).
* Matrix cached the same way; the optimizer reuses it.
* Client throttle: OSRM ≥ 1.1 s between requests; ORS 429/403 → normalized `rate-limit` / `quota` errors, no automatic retry loop.
* Headers `x-ratelimit-remaining` / `x-ratelimit-reset` are copied into `RouteResult.quota` (debug only, no secrets). The proxy forwards them.
* While planning, watch-position updates do not re-route; the origin only moves when the user presses «Actualizar».
  During a live trip (below), rerouting is automatic but bounded by the rules in § Live navigation.
* A failed request anchors the GPS origin too, so new GPS readings never turn a failure into a retry loop.

## Live navigation (feature/live-routing-engine, 2026-10-06)

Only `/mi-ruta/` runs live navigation; `/mapa/` stays exploration and planning (no navigation card, no
camera follow). It is a tourism route aid, **not** a certified driving navigator: no turn-by-turn, no
voice, no live traffic. Times are the provider's free-flow estimates and the UI says «sin tráfico en tiempo real».

### Modules

| Module | Role |
|---|---|
| `src/scripts/geo/route-geometry.ts` | Pure: projection onto the polyline, distance from route, along / total / travelled / remaining, progress 0..1, leg boundaries, split for drawing. Bounded search (300 m behind … 3 km ahead of the previous snap); full search only when that window has nothing close. |
| `src/scripts/geo/navigation.ts` | Pure state machine (`NavigationEngine`). Time, connectivity and side effects come in through `NavPorts`, so every rule is unit-tested. |
| `src/scripts/geo/nav-controller.ts` | Wires the engine to the location service, `route-session` (the only routing layer), the visited-stops store, `online`/`offline` and `visibilitychange`. Holds camera-follow view state. |
| `src/scripts/geo/trip-store.ts` | Visited stops in `localStorage` (`slp:mi-ruta:trip:v1`). |
| `src/scripts/nav-ui.ts` | The card on `/mi-ruta/`; optional Screen Wake Lock. |

### State machine

```
idle ──Iniciar──▶ starting ──first route──▶ navigating ◀────────── route ok ──────────┐
                    │ no position / no route   │  ▲                                    │
                    ▼                          │  └── back on the road ──┐             │
                  error                        ├── off-route confirmed ──▶ off-route ──▶ rerouting
                                               │                (cooldown / limit / offline: waits here)
                                               └── within arrival radius ──▶ arrived-stop
                                                   «Marcar como visitado» / «Continuar» ──▶ navigating | finished
any active state ──«Pausar» or page hidden──▶ paused ──«Reanudar» or page visible──▶ previous state
«Terminar recorrido» ──▶ idle (visited stops stay stored until «Restablecer recorrido»)
```

### Rules (constants in `navigation.ts`)

| Rule | Value |
|---|---|
| Off-route threshold | distance to route > **max(60 m, 1.5 × accuracy)** |
| Confirmation | **3 consecutive** valid off-route readings, or **≥ 15 s** off route with at least 2 readings. A reading back on the road resets the evidence. |
| Readings used for decisions | accuracy ≤ **150 m** (worse readings neither confirm nor reset); progress uses readings ≤ 500 m |
| Automatic reroute cooldown | **45 s** between launches |
| Automatic reroutes per trip | **6**; then only «Recalcular ruta» (manual, offered whenever online and nothing is in flight; not counted) |
| In flight | never two reroutes at once; superseded requests are aborted by `route-session` |
| Offline | no reroute (automatic or manual); last route, stops and progress stay |
| Back online | no immediate request; the next confirmed off-route reading decides |
| Failed reroute | previous route kept and drawn; message «No se pudo recalcular… Seguimos con tu ruta anterior»; cooldown applies |
| Arrival radius | car 80 m · bike 50 m · foot 35 m, **plus** the reading's accuracy up to the same amount again; either the direct distance to the stop or reaching the end of its leg on the route |
| Arrival | never removes a stop; «Marcar como visitado» stores it, «Continuar al siguiente lugar» goes on (skipping it for this trip if not marked) |
| GPS lost | no reading for 30 s while navigating → «Sin señal GPS reciente» (last position kept) |
| Page hidden / visible | hidden → `paused` (decisions stop). Visible → resume, discard old off-route evidence, restart the watch, request a fresh fix if the last one is older than 30 s. A pause chosen by the visitor is not lifted by visibility. |

Requests per trip: one route at start, at most one per stop when continuing (recomputed from the current
position without the visited stop), at most 6 automatic reroutes, plus explicit «Recalcular ruta» presses.
Positions by themselves never trigger requests.

### Location filter

`location-service.ts` keeps the raw position (no smoothing, so the dot never lags). It drops a reading only when
it implies more than 70 m/s from the previous fix **and** reports a clearly worse accuracy (> 2× previous and
> 50 m), at most 3 times in a row; out-of-order readings are dropped. Heading and speed are kept when the device
reports them and are `null` otherwise (never computed or invented); the card shows them only in «Detalles».

### Privacy

* Permission is requested only by «Iniciar recorrido» / «Reanudar recorrido» (or «Usar mi ubicación»).
* Position, heading and speed live in memory for the page view. No trace or history is kept; the engine holds
  only the last fix and the last snapped point (for the summary distance).
* `localStorage` gets `{ id, startedAt, stops: { placeId: { visited: true, visitedAt } } }` only (`sanitize()` drops
  anything else). Routes that start at the visitor are cached in memory only, never in `sessionStorage`.
* Verified by `tests/geo/navigation.test.ts` (test 16) and `scripts/verify/navigation.mjs` (every position fed to
  the browser is searched for in storage).

### Provider behaviour during a trip

The provider chosen by `PUBLIC_ROUTING_PROVIDER` is used as is. There is **no automatic switch** from
openrouteservice to the OSRM demo when ORS fails mid-trip: the previous route is kept and the visitor is told.
That is deliberate: a public demo server must not silently absorb production traffic. A controlled failover
(ORS → OSRM only for `provider-down`, once per trip) is a possible later addition.

### Browser limits (stated in the UI)

* No background tracking: with the screen off or the page hidden, browsers (especially on phones) suspend
  geolocation. The trip pauses and resumes; nothing claims otherwise.
* Screen Wake Lock is optional («Mantener pantalla encendida»), requested only from that button, re-acquired on
  return to the page, released when the trip ends. Hidden when unsupported; the trip works without it.
* Geolocation needs HTTPS (GitHub Pages is) or localhost.

### Turn-by-turn extension point

Not implemented. A later phase would ask the provider for steps (`steps=true` on OSRM, `instructions` on ORS;
same endpoints, so the proxy allow-list does not change), normalize them into `RouteResult` (for example
`legs[i].steps`) and add a `nextManeuver` field computed in `NavigationEngine.update()` from the same snap
(`along` against step boundaries). The state machine, rules and UI slots do not need to change.

## Public demo on GitHub Pages (checkpoint-E, 2026-10-09)

The first public deployment (`docs/deployment-github-pages.md`) builds with `PUBLIC_ROUTING_PROVIDER=auto`
and **no** `PUBLIC_ROUTE_PROXY_URL`, so `auto` resolves to **osrm-fossgis** in production: keyless, throttled
to ≥ 1.1 s between requests, cached and debounced as above. openrouteservice stays available for local
development (Vite proxy) and becomes the primary provider again only if `serverless/route-proxy` is deployed and
its URL is set in the workflow. No key is part of the workflow or the build.

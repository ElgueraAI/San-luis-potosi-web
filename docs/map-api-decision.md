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
* Watch-position updates do not re-route; the origin only moves when the user presses «Actualizar».

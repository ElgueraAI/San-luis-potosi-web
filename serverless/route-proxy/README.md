# route-proxy (optional, production)

A small serverless proxy that keeps the openrouteservice key away from the browser. You only need it if
the public site should route through openrouteservice. Without it, the site uses the keyless FOSSGIS OSRM
fallback (see `docs/map-api-decision.md`).

It is **not** deployed by this repository and has no build step. `worker.js` is a plain Cloudflare Worker
(free plan is enough for an academic site). Any runtime with `fetch()` (Netlify/Vercel functions, Deno Deploy)
can host the same ~60 lines.

## Deploy (Cloudflare, once)

1. Create a free openrouteservice key at <https://account.heigit.org/> (Standard plan: Directions 2,000/day · 40/min,
   Matrix 500/day · 40/min).
2. In Cloudflare → Workers → *Create* → paste `worker.js`.
3. Settings → Variables:
   * `ORS_API_KEY` → **Secret** (encrypt), the key from step 1.
   * `ALLOWED_ORIGINS` → plain text, e.g. `https://<user>.github.io,http://localhost:4321`.
4. Copy the Worker URL and set it as `PUBLIC_ROUTE_PROXY_URL` for the site build (GitHub Actions variable, or `.env`
   locally). It is a URL, not a secret.

## What it forwards

Only `POST /v2/directions/{driving-car|foot-walking|cycling-regular}/geojson` and `POST /v2/matrix/{…}` to
`https://api.heigit.org/openrouteservice` (the deprecated `api.openrouteservice.org` is not used). Bodies over 32 KB,
other paths, other methods and unknown origins are rejected. `x-ratelimit-*` and `retry-after` are passed back.

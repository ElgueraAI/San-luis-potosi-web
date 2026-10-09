# Deployment — GitHub Pages public demo

Written 2026-10-09 (checkpoint-E). Workflow: `.github/workflows/deploy.yml`.

## Architecture

The portal is a fully static Astro build (`output: 'static'`, 305 pages). Nothing runs on a server:

| Part | Where it runs | Needs |
|---|---|---|
| Pages, images, CSS, JS, `data/*.json` | GitHub Pages (static files) | nothing |
| MapLibre GL + worker | browser, self-hosted in `public/vendor/maplibre/` | nothing |
| Basemap | browser → `tiles.openfreemap.org` | no key |
| Weather | browser → `api.open-meteo.com` | no key |
| Geolocation | browser (`navigator.geolocation`, needs HTTPS — Pages provides it) | user permission |
| Road routing, matrix, rerouting | browser → `routing.openstreetmap.de` (FOSSGIS OSRM) | no key |
| openrouteservice (optional) | only through a key-holding proxy: Vite dev proxy locally, or `serverless/route-proxy` if deployed | `ORS_API_KEY` (secret, never in the build) |

**Decision: GitHub Pages is sufficient.** No feature of the demo needs a backend. openrouteservice is the only
keyed service and is optional: with `PUBLIC_ROUTING_PROVIDER=auto` and no `PUBLIC_ROUTE_PROXY_URL`, the build
routes through FOSSGIS OSRM (see `docs/map-api-decision.md`). A Cloudflare Worker for ORS can be added later
without touching Pages.

## URL, `site` and `base`

`astro.config.mjs` reads `SITE_URL` and `BASE_PATH` (defaults: `http://localhost:4321` and `/`). The workflow
derives them from the repository it runs in — nothing is hard-coded:

| Repository | URL | `site` | `base` |
|---|---|---|---|
| `<owner>/<owner>.github.io` | `https://<owner>.github.io/` | `https://<owner>.github.io` | `/` |
| `<owner>/<repo>` (project page) | `https://<owner>.github.io/<repo>/` | `https://<owner>.github.io` | `/<repo>/` |

Every internal link and asset already goes through `src/i18n/routes.ts` (`href()`, `asset()`), which reads
`import.meta.env.BASE_URL`; the MapLibre worker URL (`src/scripts/map.ts`) and the lazy loaders
(`src/scripts/site.ts`) do the same. Images processed by Astro get the base automatically.

## Branch and workflow

```
feature/turn-by-turn-routing  (development)
        ↓
deploy/github-pages-mvp       (what the public demo serves)  ── push ──▶ Actions ──▶ Pages
```

The workflow follows <https://docs.astro.build/en/guides/deploy/github/>: `actions/checkout@v7`,
`withastro/action@v6` (Node 24, detects npm from `package-lock.json`, runs `npm run build`, uploads `dist/`),
`actions/deploy-pages@v5` into the `github-pages` environment. Permissions: `contents: read`, `pages: write`,
`id-token: write`. It runs on every push to `deploy/github-pages-mvp` and manually (`workflow_dispatch`).
It uses no secrets.

## One-time GitHub setup

1. Create the repository on github.com. **On a free personal account GitHub Pages only works for public
   repositories** (private repositories need a paid plan). Before making it public, re-run the secret scan
   below.
2. Add it as `origin` and push the branch: `git push -u origin deploy/github-pages-mvp`.
3. Repository → **Settings** → **Pages** → *Build and deployment* → **Source: GitHub Actions**.
4. Repository → **Settings** → **Environments** → **github-pages** → *Deployment branches and tags*: add
   `deploy/github-pages-mvp`. GitHub creates this environment allowing only the default branch, so without this
   rule the deploy job fails with "Branch … is not allowed to deploy to github-pages". (Alternative: make
   `deploy/github-pages-mvp` the default branch.)
5. **Actions** → *Deploy to GitHub Pages* → **Run workflow** (or push again). The deploy job prints the URL.

## Keys

| Name | Public? | Where |
|---|---|---|
| `PUBLIC_ROUTING_PROVIDER` | yes (a word) | workflow env (`auto`) |
| `PUBLIC_ROUTE_PROXY_URL` | yes (a URL) | unset in the demo |
| `ORS_API_KEY` | **no** | local `.env` only (git-ignored), or as a secret of the serverless proxy. Never in the workflow, never with a `PUBLIC_` prefix: anything in the build reaches the browser. |

No `.env` file is tracked; `.env.example` holds empty values only.

## Geolocation

Requested only when the visitor presses a location button (never on load); states are shown in the UI
(`src/scripts/geo/location-ui.ts`). The position stays in memory: it is not written to localStorage or
sessionStorage (the route cache skips requests containing it, prefs keep only place ids), not sent to analytics
(there is none), not logged. `watchPosition` is cleared on stop / dispose. `/mi-ruta/` already shows the
privacy note. Browsers require HTTPS, which `*.github.io` provides.

## Limits of the demo

* Routing uses the FOSSGIS OSRM demo service: non-commercial, ≤ 1 request/second (the client throttles to
  ≥ 1.1 s), no uptime guarantee. When it fails the UI says so and draws no line. Fine for a class demo;
  not for heavy traffic.
* No live traffic, no turn-by-turn voice (see `docs/map-api-decision.md` § Live navigation).
* Weather and basemap depend on Open-Meteo and OpenFreeMap being up.

## Test locally like Pages

PowerShell (Git Bash rewrites `/repo/` into a Windows path — use PowerShell or `MSYS_NO_PATHCONV=1`):

```powershell
$env:BASE_PATH='/san-luis-potosi-web/'; $env:SITE_URL='https://example.github.io'
npm ci
npm run check
npm run build
node scripts/verify/links.mjs --base /san-luis-potosi-web/
npx astro preview --host 127.0.0.1 --port 4322        # keep it running, same env vars
node scripts/verify/pages.mjs      --url http://127.0.0.1:4322/san-luis-potosi-web --sizes "desk:1440:900,phone:390:844,tablet:768:1024" --viewport-only
node scripts/verify/routing.mjs    --url http://127.0.0.1:4322/san-luis-potosi-web
node scripts/verify/navigation.mjs --url http://127.0.0.1:4322/san-luis-potosi-web
```

Before publishing, the build must not reference the developer machine:
`Get-ChildItem dist -Recurse -File | Select-String -Pattern 'localhost|127\.0\.0\.1' -List` (expect nothing).

## Re-deploy and rollback

* Re-deploy: push to `deploy/github-pages-mvp`, or Actions → *Deploy to GitHub Pages* → **Run workflow**.
* Roll back without rewriting history: `git revert <bad-commit>` on `deploy/github-pages-mvp` and push; the
  workflow publishes the previous state. Or re-run an older successful run of the workflow from the Actions tab.
* Stop publishing: Settings → Pages → *Unpublish site*, or disable the workflow.

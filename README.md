# San Luis Potosí · Cuatro mundos

Academic MVP of a cinematic tourism website for the state of San Luis Potosí,
Mexico. Four worlds (Altiplano, Centro, Zona Media, Huasteca) along one
continuous terrain line.

## Run it

```bash
npm install
npm run dev        # http://localhost:4321/
npm run build      # static output in dist/
npm run preview    # serves dist/
```

Requires Node 20 or newer.

## Stack

Astro (static output) · TypeScript strict · HTML/CSS · native browser APIs ·
Scroll Craft engine (vendored, unmodified) · MapLibre GL JS · PMTiles · Zod
content schemas. No UI framework, no CMS, no backend.

## Where things live

| Path | What |
|---|---|
| `src/pages/` | Routes. Spanish at the root, English under `/en/` (not generated yet) |
| `src/components/` | `chrome/` (header, the Line, menu), `home/`, `region/`, `primitives/` |
| `src/motion/` | Site-specific scroll choreography (hero depth, the Line, the Descent) |
| `src/content/` | Data: regions, media slots, sources. Validated by `src/content.config.ts` |
| `src/data/geo/` | Elevation profile (schematic until INEGI data is verified) |
| `src/lib/fact.ts` | The Fact system: pending vs verified facts |
| `src/vendor/scrollcraft/`, `public/vendor/scrollcraft/` | Scroll Craft engine, never edited |
| `scrollcraft/builds/slp-turismo/BRIEF.md` | The approved creative brief |

## Data status

Every factual value (altitudes, region assignments, dates, designations, prices,
schedules, certifications, protected-area status) is a `Fact` with status
`pending` or `verified`. Pending facts show a "pendiente" badge in development
and are never rendered as information in production builds.

## Media

Real photography and video replace placeholders by filling the slot's `src` in
`src/content/media.yaml`. Original high-resolution files never go into Git
(`media-source/` is ignored).

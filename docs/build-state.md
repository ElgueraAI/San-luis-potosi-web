# Build state · Portal pass (2026-10-06)

Persistent checklist for the full-portal pass. Updated as work progresses. No commits.

## Phase A — Audit
- [x] Repository: Astro 7 static, 65 pages, research adapter `src/data/research.ts`, routes in `src/i18n/routes.ts`.
- [x] Research layer: 63 researched places (A/C/M/H ids), 59 municipalities mapped to 4 regions (PDU-SLP), seasonal calendar + events, media registry (89 production images), PDF registry, source registry.
- [x] Workbook: 11 sheets (00_INICIO … 10_CHECKLIST); planning data, not facts. Original stays untouched.
- [x] Current navigation: header (Explorar / Mapa / Mi Ruta / Menú) + right-side dialog menu with one level.
- [x] Japan Travel IA studied: Destinos (regiones → prefecturas, ciudades, temáticas, estilos), Actividades (Naturaleza, Tradición, Gastronomía, Arte y cultura, Ciudades, Relajación, Destacados), Planifica (Viajar a / Moverse / Sobre / Información importante), seasonal highlights, quick-reference boxes.

## Phase B — Research expansion
- [x] INAH open data: archaeological zones (SLP): Tamtoc, Tamohí (Abierta). Lugares INAH hours/cost read 2026-10-06.
- [x] INAH journal: Tanute (documented, access unknown). Gap: INAH public register is not open data.
- [x] SIC open data (24_*): 44 museos, 22 teatros, 54 centros culturales, 19 galerías, 76 auditorios, 12 casas de artesanía, 21 festivales, 2 zonas, 4 catedrales, 18 declaratorias (ANP, sitios sagrados, patrimonio), 8 PCI.
- [x] DENUE bulk (INEGI, local): 674 lodging, 2,002 restaurants, 369 cafés, 1,033 bars/nightlife, 12 drink producers, 34 museums, 26 balnearios, 260 travel services, 5 terminals/airports.
- [x] Estadía (Secretaría de Turismo, WP REST): 34 hotels, 27 restaurants/bars; towns from location term or official description.
- [x] 2022 statistics PDF: historical context only (12,630 hotel rooms, DataTur 2022).
- [x] Municipalities: 59 records; ITER 2020 seat + population (Villa de Pozos: no ITER seat, created 2024).
- [x] Events: 14 research events + Navidad Verde + 18 SIC festivals + 5 SIC intangible-heritage celebrations; date status per record.

## Phase C — Normalization
- [x] research/entities/{municipalities,attractions,archaeology,museums,cultural-venues,events,lodging,food-drink,services,mobility,recreation,routes} (scripts: research/scripts/entities/build-entities.mjs)
- [x] research/source-registry/sources-pass5.json (19 sources, additive)
- [x] Enriched workbook: `C:/Users/jerry/slp-library/Biblioteca_Visual_San_Luis_Potosi_Web_ENRIQUECIDA.xlsx` (17 catalogue sheets + 11 original sheets copied unchanged; original untouched)

## Phase D — Information architecture
- [x] Portal menu: dialog with progressive disclosure (Destinos › Municipios › región › municipio; Qué hacer › categoría › subtema; Planifica; Guías; Eventos › por mes; Acerca), Atrás/Cerrar, Esc back-one-level, focus to level title, trail, search box, quick links. Files: src/components/chrome/MenuSheet.astro, src/scripts/menu.ts
- [x] Header: Destinos (regions panel), Qué hacer, Eventos, Planea, Mapa, Buscar, Mi Ruta, Menú
- [x] Routes in src/i18n/routes.ts; map in docs/information-architecture.md

## Phase E — Core content pages
- [x] /municipios/ (index, region filter, A–Z) and 59 /municipios/<slug>/ (sections only when data exists; short format when thin)
- [x] /destinos/ index (destination pages kept)
- [x] /que-hacer/ hub (keeps «¿Qué te mueve?») + 10 category pages with subcategory anchors (src/data/thingsToDo.ts)
- [x] /experiencias/ (12) + 12 experience pages
- [x] /eventos/ calendar (month, region, municipality, category, date status) + 36 event pages
- [x] /arqueologia/ + 3 site pages (INAH access status)
- [x] /museos/ (SIC catalogue: 44 museums + 183 venues, directory)
- [x] /hospedaje/ (709), /gastronomia/ (regional cooking + 1,122 shown of 3,433)
- [x] /planea/ hub (llegar, moverse, clima, dormir/comer, práctico, guías, folletos, FAQ, Mi Ruta)
- [x] /guias/ (folletos, mapas, arqueología, cultura, guías acreditados, directorios, datos, práctico, movilidad; date + region per item)
- [x] /buscar/ (static index), /acerca/

## Phase F — Internal discovery
- [x] Static search index /data/search.json (municipalities, regions, destinations, experiences, events, archaeology, museums, venues, protected areas, lodging, themes, resources, sections)
- [x] Directories /data/{lodging,food,culture}.json with text/region/municipality/type filters (src/scripts/directory.ts)
- [x] Mi Ruta: entity layer in /data/places.json (municipal seats, archaeology, museums/venues, protected areas, lodging); kept off the discovery map
- [x] Relations: destination↔municipality↔region, experience→events/lodging/nearby, event→nearby, archaeology→nearby, region→municipalities, home «Todo el estado» band

## Phase G — Visual refinement
- [x] Content-family tones: heritage, night, utility (+ sand, stone, mist, jungle, region, region-deep)
- [x] Uniform card ratios: destination 4:5, municipality 4:3, tiles 4:5, entity cards without borrowed photos
- [x] Contextual placeholders (state silhouette + seat) instead of unrelated photos
- [x] Lighter silhouettes for repeated cards (index page 752 KB → 357 KB)

## Phase H — QA
- [x] astro check: 0 errors
- [x] build: 196 pages
- [x] links: see final report
- [x] interactions: 46/46 (menu drill-down, Esc, Atrás, search, directory, calendar, municipality filter, Mi Ruta from archaeology)
- [x] screenshots: scrollcraft/lab/full-portal-review/
- [x] docs: data-sources, data-coverage, media-coverage, information-architecture, content-model, research-gaps

## Unresolved
See docs/research-gaps.md. Visual items to review: municipality pages with thin data, event pages without photo, museum directory density.

## VISUAL REPAIR PASS (2026-10-06)
- [x] season overflow diagnosed — sticky photo lived inside a `display: contents` panel, so its sticky containing block was `.season__body`, which also held fiestas, clima and mesa; the photo kept sticking while those rows scrolled under it. Reproduced with scripts/verify/season-overflow.mjs (5 viewports).
- [x] repaired — each month panel is a real box with its own `.season__stage` (photo | head + info); sticky is bounded by the stage; geography and «Fiestas · clima · mesa» are separate blocks below. 0 px overlap / 0 px escape for Oct, Nov, Dec, Jan, May at 1440, 1536, 1920, 390, 430.
- [x] palettes checked — per-month `data-mtone` (Nov xantolo, Dec navidad, Jan emerald …), screenshots 04, 05, 16
- [x] Planea imagery — editorial hub: hero, alternating image/text rows, 4:5 region cards, 3:2 season band, lodging/food cards, guides, Mi Ruta closing image
- [x] Map hero — 52svh photographic hero (Hacia Matehuala) before the unchanged MapLibre map
- [x] weather typography — text sans, tabular numbers, 0.5em degree; 3×2 grid for 6 points; label-over-value facts
- [x] January, February and May researched — CEFIM 58 municipal infographics + Secretaría de Turismo + Cultura + INPODE
- [x] remaining months audited — 152 records; dated by month: Jan 5 · Feb 4 · Mar 17 · Apr 11 · May 11 · Jun 11 · Jul 10 · Aug 9 · Sep 10 · Oct 34 · Nov 36 · Dec 15
- [x] all-year model — ALL_YEAR 3, SEASONAL_WINDOW 3 (seasonal-experience records), «Todo el año» calendar panel, «También disponible este mes»
- [x] screenshots — scrollcraft/lab/refinement-pass/ (01–20)
- [x] tests — check 0 errors, links clean, interactions 48/48, overflow pass
- [x] final visual QA

# Research pass 1: official sources, guides, registry

Date: 2026-10-04 · Scope: the 29 Priority A places of the visual library workbook · Website untouched.

Status vocabulary: `verified` (read in an official source this pass, source id + date recorded), `pending` (a value exists but is not yet cross-checked, or official sources conflict), `unavailable` (no source found, or the field does not apply).

## Destinations researched

- **63** destination records created (`research/destinations/index.json`); **29** Priority A researched, each with its own file (`research/destinations/<id>.json`). The 34 Priority B/C places are listed as `pending`, not researched.
- **1 fully verified** destination: **H16 Zona Arqueológica de Tamtoc** (region, municipality, description and coordinates all verified).
- The other 28 are `pending`, almost entirely because their coordinates are not cross-checked yet:

| Core field (29 places) | verified | pending | unavailable |
|---|---|---|---|
| Description | 26 | 2 (C02, A15) | 1 (A03) |
| Municipality | 25 | 2 (A03, H02) | 2 (A15, C12 n/a as point) * |
| Region | 25 | 4 (H10, H11, H13, H14: conflict) | 0 |
| Coordinates | **1** | **24** | **4** |

\* A15 is a landscape theme across municipalities; C12's municipality is verified, its coordinates are not applicable.

## Coordinates

- **Verified: 1.** Tamtoc: INAH's official point (21.924445, −98.812866) and the OSM archaeological-site feature agree within **146 m**.
- **Pending: 24.** OSM Nominatim candidates, each tagged with its OSM feature (town, waterfall, spring, museum, square…). No official coordinates exist yet to cross-check them.
- **Unavailable: 4.** A03 Pueblo Fantasma (no OSM result), A15 semidesert landscape (not a point), C12 rebozo workshops (scattered), H02 Río Tampaón (a river is a line; the visitor access point needs a source).
- Nominatim used politely: sequential, ≥1.1 s apart, identifying User-Agent, every response cached in `research/raw/geocode/`. 2 rounds (the first returned municipal-boundary centroids for towns; Matehuala's was ~13 km off the city; fixed by ranking boundaries last).

## Official destination pages found

- **9 places** have a destination-specific official page: A01 Real de Catorce, C03 Plaza del Carmen, C08 Museo Leonora Carrington SLP (+ CEART page), C11 Santa María del Río, M03 Centro Histórico de Ciudad Fernández, M09 Ciudad del Maíz, H06 Aquismón, H07 Xilitla (+ SECTUR article), H16 Tamtoc (INAH).
- 3 municipal pages read for context: Ciudad Valles, El Naranjo, Tamuín.
- The state portals list **65** `/lugares/` pages in total; only these were read this pass.
- The workbook's `Fuente oficial` was destination-specific for 15 of 63 places; 48 point to regional or listing pages.

## Official descriptions found

- **26 of 29** have a short Spanish description paraphrased from an official source, with the source id on the record.
- Sources: the 4 regional brochures (most Huasteca, Media and Altiplano places), state destination pages, INAH (Tamtoc).
- Missing: A03 (no official text; workbook source is non-official), C02 Plaza de Armas + Catedral (named on the official map, no text), A15 (theme, not a place).

## Brochures, PDFs and maps

- **Brochures cataloged: 5.** Altiplano, Centro, Huasteca, Media (4 pages each: texts, tips, activities table, tourist map with distance table) and Capital (city + Centro Histórico maps, bilingual legend).
- **PDFs downloaded: 5**, to `research/raw/pdfs/` (git-ignored), SHA-256 recorded in `pdf-registry/resources.json`. 1.5–2.4 MB each. The 4 regional brochures are image-only (no text layer) and were read visually.
- **Maps cataloged: 5** official WebP maps (general 2026, Altiplano, Centro, Huasteca, Media). Not downloaded.
- **Other resources cataloged: 9.** INAH Tamtoc page + Mediateca guide, INEGI CEM dataset, 4 SIMEC books, NOM-08-TUR-2002, RNT form. None downloaded.
- **Total: 19 resources.** Policy: link-only as external official resources; nothing mirrored. Redistribution rights for the brochures are `unknown`.

## Facts verified this pass (highlights)

- **Pueblos Mágicos (6).** Real de Catorce, Xilitla, Aquismón, Santa María del Río, Ciudad del Maíz, Tierra Nueva, per SECTUR Comunicado 244/2023 (7 Nov 2023). Years: Real de Catorce 2001, Xilitla 2011 (SECTUR articles).
- **Tamul:** 105 m drop; best season November–March; visited by panga (brochure-huasteca).
- **El Meco:** 35 m. **El Naranjo sites:** good season November–March. **Micos:** official name "Cascadas de Pago Pago (Micos)", seven falls of 2–20 m.
- **Las Pozas:** 30 ha, 36 structures, 37 m waterfall.
- **Media Luna:** swimming and diving all year (brochure-media).
- **Tamtoc (INAH):** hours 09:00–18:00, last entry 17:00; free admission. Flagged *volatile, re-check before publishing*.

## Conflicts found (13, recorded on each record)

- **Region of El Naranjo and Tamasopo** (H10, H11, H13, H14): in the Huasteca brochure, but also marked on the Región Media brochure map. Needs the official state regionalisation.
- **Túnel de Ogarrio length:** 2.3 km (state page) vs 2.5 km (brochure).
- **"Ruta del Mezcal – Charcas"** (A12): the brochures tie the mezcal route to Villa de Guadalupe and Mexquitic/Ahualulco, not Charcas.
- **Edward James:** "escocés" (brochure) vs "inglés" (state page).
- **Ciudad del Maíz murals:** Diego Rivera (text) vs "Jorge Pasquel" (activities table).
- **Puente de Dios:** listed under both Tamasopo and Aquismón; a Pexels "Puente de Dios" photo is in Querétaro.
- **Santa María del Río:** "20 minutos" from the capital (page) vs the brochure distance table.
- **Two Museo Leonora Carrington:** SLP capital and Xilitla.

## Media candidates (metadata only, nothing downloaded)

| Source | Records | APPROVED_CANDIDATE | NEEDS_REVIEW | REFERENCE_ONLY |
|---|---|---|---|---|
| Wikimedia Commons | 197 | 122 | 65 | 10 |
| Pexels | 4 | 0 | 3 | 1 |
| **Total** | **201** | **122** | **68** | **11** |

- **Commons:** 25 of 29 places have ≥1 approved candidate. None for A02 Túnel de Ogarrio, A03, H10 Tamasopo, A15 (no results).
- **APPROVED_CANDIDATE** means: explicit free licence (CC0 / PD / CC BY / CC BY-SA), subject named in title or description, ≥1600 px, not a map/logo, not an extreme crop, no sensitive subject. **None has been visually reviewed yet.**
- **Licences:** CC BY-SA 4.0 (88), CC BY-SA 2.0 (38), CC BY-SA 3.0 (28), PD (12), CC BY 2.0/3.0/4.0/2.5 (23), CC0 (4).
- **Most are CC BY-SA:** attribution plus share-alike, which affects how derived images are licensed.
- **Intended use:** 23 hero-size, 45 card-shaped, 119 gallery, 10 reference.
- **Pexels:**
  - robots.txt disallows search URLs (`*q=*`), so candidates came only from web-search results pointing at individual photo pages. That gave just 4.
  - Location tags are user-entered: the Tamul photo is tagged "Tamasopo".
  - A free Pexels API key is the proper route.
- **Not candidates:**
  - **INAH photos** (CC BY-NC-ND 4.0, no derivatives): cropping or re-encoding may not be allowed.
  - **Official tourism-site photos:** no reuse rights; reference only.

## Guide and operator sources

- **Official registry found:**
  - SECTUR **Directorio de Guías de Turistas** (`guiadeturistas.sectur.gob.mx:444`). Reachable, no captcha.
  - Filters: state (San Luis Potosí = 24), municipality, guide type (NOM-08 general / cultural; NOM-09 nature-adventure), language.
  - **Not queried:** results are personal data.
- **SECTUR accreditation program page** (11 Sep 2023) and NOM-08-TUR-2002 cataloged.
- **State RNT page** (`turismo.slp.gob.mx/rnt/`): registration procedures only, no public list. Updated 17/02/2026.
- **Blocked:** `visitasanluispotosi.com/guias-de-turistas/` (no archive copy).
- **Rejected:** `rntsecturgob.com.mx`, a non-gob.mx domain presenting itself as an RNT consultation.
- **Operators:** no official public list found; the official RNT public consultation URL was not confirmed.
- **Brochures:** all recommend hiring a *guía certificado* and note limited carrying capacity at natural sites.
- **Recommendation:** link to the SECTUR directory and explain how to check a credential. Name no guides without consent.

## Weather (design only)

`research/generated/weather-model.json`:
- **Current weather:** fetched client-side and lazily from `api.open-meteo.com` (no key, CORS), cached 30 min. Covers temperature, apparent temperature, humidity, precipitation, WMO weather code (Spanish labels included), wind speed and direction.
- **Monthly climate:** computed at build time from the archive API (2016–2025 daily) into 12 rows per region. Labelled as *modelled reanalysis*, not an official climate normal. SMN/CONAGUA normals are noted as the official alternative.
- **Attribution:** "Datos meteorológicos: Open-Meteo.com (CC BY 4.0)" next to the data.
- **Tested:** both endpoints, with real responses.

## Missing data

- **Coordinates:** 24 pending, 4 unavailable. No official coordinate source for most places (state pages link to Google Maps text searches).
- **Official state regionalisation** (which municipality belongs to which region): still not read.
- **Descriptions** for A03, C02, A15.
- **Brochure tables:** the distance/time tables and the activities icon tables were not transcribed. They are image-only, so they need a careful second read.
- **Season/month data:** exists for 9 places only (Tamul, El Naranjo sites, Media Luna, Plaza del Carmen, Ciudad del Maíz, Sótano, Altiplano climate note).
- **Protected-area status:** Media Luna is stated only by the tourism brochure; nothing for Sótano de las Golondrinas.
- **Priority B/C:** 34 places not researched.
- **Media:** no visual review of any candidate yet; no Pexels API key; no Unsplash access.

## Problematic sources

- **`visitasanluispotosi.com` and `turismoslp.com.mx`:** bot check, also against a headless browser. Read through Internet Archive snapshots. Not circumvented.
- **`gob.mx`:** JS challenge for plain HTTP clients; WebFetch can read SECTUR pages. `gob.mx/conanp` failed (connection reset).
- **Unsplash:** bot check; API key required.
- **Pexels:** search disallowed by robots.txt. In the earlier read-only access test, one Pexels search URL was requested before robots.txt had been checked. Not repeated.
- **Workbook sources that are not official:** `realde14.com.mx` (A03) and `seguridadalimentaria.uaslp.mx` (M14, unrelated page).
- **Official state photos:** no credits or licence, so not reusable.

## Recommended next research pass (pass 2)

1. **Official regionalisation.** Read the state's official municipality → region list (Plan Estatal / state government) to settle El Naranjo and Tamasopo and verify every `region`.
2. **Coordinates.** Cross-check the 24 pending points against official sources where they exist (municipal pages, INAH, state ANP decrees). Otherwise set a clear rule for when an OSM point is acceptable (e.g. a named waterfall/spring feature within the official municipality).
3. **Brochure tables.** Transcribe the distance/time and activity tables from the four brochures, with a second independent read, to feed itineraries and "how to get there".
4. **Media.** Visual review of the 23 hero-size and 45 card-shaped Commons candidates; decide on CC BY-SA handling; optionally add a free Pexels API key.
5. **Priority B/C.** The 34 remaining places, starting with Huasteca (for the regional page).
6. **INEGI CEM.** Download the San Luis Potosí elevation data, when authorised, to replace the schematic profile.

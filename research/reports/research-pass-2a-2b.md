# Research pass 2A + 2B: geography, seasons, elevation, visual assets

Date: 2026-10-05 · Website untouched (`src/`, `public/`, `scrollcraft/`, `astro.config.mjs` unchanged; verified by `research/scripts/qa.py`).

## 2A: data

### Regions (`generated/municipality-region-map.json`)
- **58 of 58 INEGI municipalities verified** against the *Plan Estatal de Desarrollo Urbano* (PDU-SLP), which lists region and microregion for every municipality. Spellings follow INEGI.
- **0 conflicts left.**
  - **El Naranjo and Tamasopo** were the open border case. PDU-SLP places them in *Huasteca Norte*. The Huasteca brochure describes them in its texts, activities table and distance table. The Media brochure only draws them on its map as context.
  - Resolved by authority: **Huasteca**. The reasoning is documented on each record.
- **1 pending:** *Villa de Pozos*, the 59th municipality, created on 23 Jul 2024 from San Luis Potosí. No official tourism-region assignment exists yet; geographically it is inside the Centro.
- **Region sizes:** Altiplano 15 · Centro 11 · Zona Media 12 · Huasteca 20.

### Coordinates (`generated/coordinates.json`)
- **Official sources, in priority order:**
  1. INAH ficha (Tamtoc)
  2. **INEGI DENUE 2026** establishment points (cathedral, theatre, temple, museums)
  3. **INEGI ITER 2020** locality points (towns and villages)
- **28 verified** (official point, cross-checked against OSM; median distance under 200 m).
- **29 pending:**
  - 21 are OSM features that passed plausibility checks (distance to the official access locality, municipality). They are mapped as **provisional**.
  - 8 have no acceptable OSM feature.
- **6 unavailable:** not a point (landscape, river, intangible heritage, scattered workshops, mountain range, agricultural basin).
- **Rejected OSM matches:** they were discarded instead of stored. Examples: "Pueblo Fantasma" matched a place 173 km away; "Convento" matched one 350 km away.

### MapLibre (`maplibre-places.geojson` / `.json` / `maplibre-pending.json`)
- **49 features:**
  - **28 `ready`** (official coordinates)
  - **21 `provisional`** (OSM, labelled as such)
  - 35 of the 49 have a media thumbnail id.
- **14 pending** places are listed separately with the reason.
- **Attribution in the metadata:** INEGI, INAH, © OpenStreetMap contributors.

### Brochures (`generated/brochure-tables.json`)
- **145 facts** transcribed from the four image-only brochures, rendered at 300–400 % in Edge's PDF viewer:
  - **4 distance/time tables** (75 rows, from Ciudad Valles, Matehuala, the capital and Rioverde)
  - **4 attraction tables** (36 municipality rows)
  - seasons, physical facts, culture, gastronomy, recommendations, packing list, practical contacts
- **Not transcribed:** the activity icons. Matching them to the legend was error-prone, so activities come from the prose instead.
- **5 inconsistencies recorded:**
  - Matehuala → Salinas printed as 359 km / 3 h, which is implausible for the stated time.
  - Capital ↔ Valles differs by 1 km and 6 min between brochures.
  - The Altiplano brochure repeats the Huasteca gastronomy box.

### Seasons and events
- **`seasonal-calendar.json`:**
  - **18 records**, all from official sources, plus a 12-month view.
  - Each month carries Open-Meteo 2016–2025 climate for the 4 region points, labelled *modelled, not an official normal*.
  - **No recommendation is derived from climate alone.**
- **`events.json`: 14 official events.**
  - **3 with official 2026 dates:**
    - Procesión del Silencio: 3 Apr 2026
    - FENAPO: 7–30 Aug 2026
    - Festival Lila López: 24 Jul–2 Aug 2026
  - **Xantolo 2026 is NOT confirmed.** The official 2025 period (29 Oct–2 Nov) is recorded as 2025 only.

### Weather (`weather-model.json`, `climate-monthly.json`)
- **4 region points**, all verified INEGI localities: Matehuala, San Luis Potosí, Rioverde, Ciudad Valles.
- **2 destination points:** Real de Catorce, Xilitla.
- **Monthly climate is built:**
  - Ciudad Valles: 1,424 mm/yr.
  - Xilitla: 1,884 mm/yr.
  - Real de Catorce: January mean minimum 3.6 °C.
- **The forecast model** adds daily high/low, precipitation probability and weather code. CC BY 4.0 attribution text is included.

### Elevation: The Descent (`elevation-profile.json`, `reports/elevation-methodology.md`)
- **Real profile: YES.** Official INEGI CEM 3.0, 90 m, San Luis Potosí. 10.6 MB, SHA-256 recorded, git-ignored.
- **Transect:** Real de Catorce → San Luis Potosí → Rioverde → Ciudad Valles, 376 km, 377 samples.
- **Validated:** CEM agrees with INEGI's locality altitudes within 4.4 m at all four anchors.
- **Range:** 3,011 m (Sierra de Catorce) to 57 m (near Ciudad Valles).
- **Region segments:** Altiplano 0–113 km · Centro 114–220 · Zona Media 222–335 · Huasteca 336–376.

### Conflicts
| Case | Result |
|---|---|
| Region of El Naranjo / Tamasopo | **Resolved:** Huasteca (PDU-SLP + the brochure that describes them) |
| Ruta del Mezcal / Charcas | **Resolved:** the state portal says "la ruta del Mezcal en el municipio de Charcas"; other mezcal routes also exist (Villa de Guadalupe, Mexquitic/Ahualulco) |
| Puente de Dios (two places) | **Resolved:** INEGI has a separate locality "Puente de Dios (Paso Alto)" in Aquismón; H11 is the Tamasopo site |
| Hoya vs Sótano de las Huahuas | **Resolved:** official name "Hoya de las Huahuas" (brochure, SEGAM) |
| M14 municipality | **Resolved:** Rioverde (Media brochure), not "Región Media" |
| Protected areas | **Verified (SEGAM):** Media Luna Parque Estatal (7 Jun 2003); Golondrinas and Huahuas state ANP (multi-site decree); Sierra de San Miguelito (2018); Real de Guadalcázar (1997); Wirikuta Sitio Sagrado Natural (2008). The exact Golondrinas category (Monumento Natural) was not read on SEGAM's page. |
| Pueblos Mágicos | **Verified:** 6, per SECTUR Comunicado 244/2023 |
| Túnel de Ogarrio 2.3 vs 2.5 km | **Unresolved.** SECTUR gives no length. Use wording without a number. |
| Edward James nationality | **Unresolved:** "escocés" (brochure; Las Pozas operator: "nació en Escocia") vs "inglés" (state page). Recommended wording: "poeta y mecenas del surrealismo". |
| El Tepeyac murals | **Unresolved:** Diego Rivera design (state page) vs "Murales de Jorge Pasquel" (brochure table) |

### Destinations (all 63 researched)
- **26 fully verified** (region, municipality, description and coordinates). Pass 1 had 1.
- **54 descriptions verified** from official text: state pages, brochures, INAH.
- Every record carries `seasonal_tags`, `map_status`, `media_status`, `media_selected`, `official_source` and its conflicts.

## 2B: visual assets

### Review
- **263 candidates visually reviewed:** 260 Wikimedia Commons + 3 Pexels, on 109 contact sheets in `research/raw/media-review` (git-ignored).
- **146 candidates remain `NEEDS_REVIEW`:** they were gathered but not reviewed, mostly low-priority searches.
- **Titles proved unreliable:**
  - The **Salinas de Hidalgo** search returned only Canary Islands / Peru salt flats.
  - **Tierra Nueva** returned the Philippines.
  - **Venado** returned Argentina and deer.
  - **Xantolo** returned Veracruz/Hidalgo events.
  - **"Zacahuil"** returned Oaxaca/Yucatán tamales.
  - The Pexels **Tamul** photos were tagged "Tamasopo".
  - A cactus titled "peyote" is a barrel cactus.
- **Results:** 85 SELECTED · 70 BACKUP · 91 REJECTED · 18 REFERENCE_ONLY.
- **Wixárika and sacred subjects** (pilgrimage, peyote) are REFERENCE_ONLY by policy.
- **Scoring:** 0–100 on the requested weights. Every selected asset has a rationale in `media-reviewed.json`.

### Region signature assets
| Region | Hero desktop | Hero mobile | Card | Landscape | Culture | Detail |
|---|---|---|---|---|---|---|
| Altiplano | ✅ Real de Catorce panorama | ❌ manual | ✅ | ✅ yucca desert | ❌ manual | ✅ barrel cactus |
| Centro | ✅ Catedral | ✅ Templo del Carmen | ✅ | ✅ Cerro de San Pedro | ✅ rebozo | ✅ baroque frieze |
| Zona Media | ❌ **Media Luna missing** | ❌ | ✅ Rioverde blue hour | ✅ Media Luna channels | ✅ embroideries | ✅ Ciudad del Maíz arcades |
| Huasteca | ✅ Tamul | ✅ Tamul vertical (Pexels) | ✅ Las Pozas | ✅ Tampaón | ✅ Huehue mask | ✅ aerial over Tamul |

### Coverage
- **Home:** Tier-1 **91 %** (21/23 slots); all slots 92 %.
  - Missing: the **layered dawn hero** (a commissioned plate set is needed; fallback still selected), the guides portrait, and the map thumbnails for destinations without images.
- **Huasteca page:** Tier-1 **87 %** (13/15); all slots 79 %.
  - Missing: Tamasopo hero (only 1280 px exists), El Salto, Teenek, Xantolo in SLP, gastronomy.
- **Destination pages:** 4 READY · 37 PARTIAL · 22 without any usable image (listed in `manual-assets-needed.md`).
- **Videos:** 8 slots defined; **7 need manual assets.** The Pexels SLP aerial is a licence-check candidate for the Centro transition. The 11 YouTube/Vimeo/AirVuz references stay reference-only.

### Originals downloaded (`media-registry/downloads.json`)
- **21 of the 24 Tier-1 originals** are in `research/raw/media-originals/` (134 MB, git-ignored, SHA-256 recorded).
- **Download stopped on request.** Wikimedia rate-limiting made it a bottleneck. These three were not downloaded:
  - `wc-89848894` (Puente de Dios vertical)
  - `wc-128308393` (Huehue mask)
  - `wc-21525423` (Catedral hero)
- They stay SELECTED and keep their source URLs; fetch them at implementation time.

### Licences
- **85 attribution records.** Most selected assets are **CC BY-SA**: attribution plus share-alike for edited versions.
- **No NC/ND asset selected.**
- **Third-party rights flagged:**
  - Las Pozas sculptures and filming permit
  - Leonora Carrington sculptures
  - INAH authorisation for commercial use of archaeological-site images

## Problematic sources
- **Bot checks:** `cefimslp.gob.mx` (municipal monographs) and `visitasanluispotosi.com` block automated access; the Internet Archive also returned 429.
- **Wikimedia Commons API rate limits** (429): handled with backoff.
- **No Pexels search:** robots.txt disallows it, so only individual photo pages were used.
- **INAFED encyclopaedia:** DNS failure.
- **Not downloaded:** INEGI CEM 4.0 (15 m, 223 MB). Unnecessary.

## Recommended immediate implementation plan
1. **Data layer in Astro:**
   - Load `destinations/`, `maplibre-places.geojson`, `seasonal-calendar.json`, `events.json`, `climate-monthly.json` and `elevation-profile.json` into content collections, using the existing `fact()` schema (verified/pending).
   - Pending facts stay hidden in production.
2. **Replace the schematic Line** with the measured profile:
   - Douglas–Peucker to about 150 points.
   - Region boundaries from `region_segments`.
   - Label the source and the transect caveat.
3. **Media pipeline:** for the Tier-1 originals in `research/raw/media-originals`:
   - Grade, crop and encode them to AVIF/WebP into `src/assets/media`.
   - Wire them through `media.yaml` with attribution.
   - Add a credits page that lists every CC BY-SA asset with its licence.
4. **MapLibre:** two layers.
   - `ready` points get solid markers.
   - `provisional` points get hollow markers labelled "ubicación aproximada".
   - The list view mirrors the map.
5. **"Qué hacer ahora":** filter `seasonal-calendar.json` by the current month and show 2026 dates only where they are confirmed.
6. **Huasteca page** on the reusable template, from `huasteca-asset-manifest.json`.
7. **In parallel, Tier-1 manual assets:**
   - layered Altiplano dawn hero
   - Tamul drop video
   - Media Luna aerial
   - Tamasopo hero

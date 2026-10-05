# Elevation profile: methodology ("The Descent")

Date: 2026-10-05 · Output: `research/generated/elevation-profile.json` · Script: `research/scripts/elevation-profile.py`

This profile replaces the schematic line used in the Checkpoint A prototype. **None of the prototype's shapes or altitude numbers are reused.**

## Source

| | |
|---|---|
| Dataset | INEGI, *Continuo de Elevaciones Mexicano* (CEM) 3.0, San Luis Potosí, 90 m |
| File | `CEM_V3_20170619_R90_E24.zip` (`SanLuisPotosi15_r90m.bil` + `.hdr`), 10,604,901 bytes |
| SHA-256 | `c0330c5447bccbf97ad2b00cc537bd5a3e8611890fccab33554abde9aa40877b` |
| URL | `https://www.inegi.org.mx/app/geo2/elevacionesmex/DownloadFile.do?file=CEM_V3_20170619_R90_E24.zip&res=90&entidad=San%20Luis%20Potos%C3%AD` (the official app's own download pattern; file list from its public `api/archivo` endpoint) |
| Retrieved | 2026-10-05 |
| Grid | 4,764 × 3,998 cells, 3 arc-seconds (0.000833333°, ≈90 m), 16-bit signed, NODATA −32768 |
| Datum | ITRF92 geographic (GRS80), treated as WGS84 for web use (sub-metre difference) |
| Extent | −102.296° to −98.326° E, 21.160° to 24.492° N |
| Value range in file | −8 m to 3,183 m (`.stx`) |
| Storage | `research/raw/inegi/` (git-ignored) |

**Why this file.** CEM 4.0 is offered only at 15 m (223 MB). That's far more than a state-scale web profile needs, and the brief asks for the minimum necessary download. CEM 3.0 at 90 m is the smallest official product that still resolves the escarpments.

**Format.** The BIL format is a plain raster, so it can be read with the Python standard library; no GIS libraries were installed.

## Transect (editorial choice, documented)

The Descent tells the story Altiplano → Centro → Zona Media → Huasteca. The transect therefore links one emblematic official locality per region, in that order:

| # | Anchor | Municipality | Lat | Lon | INEGI altitude | CEM at anchor |
|---|---|---|---|---|---|---|
| 1 | Real de Catorce | Catorce | 23.690449 | −100.886253 | 2,699 m | 2,703.4 m |
| 2 | San Luis Potosí | San Luis Potosí | 22.151655 | −100.976958 | 1,864 m | 1,865.0 m |
| 3 | Rioverde | Rioverde | 21.932378 | −99.992923 | 991 m | 991.8 m |
| 4 | Ciudad Valles | Ciudad Valles | 21.986537 | −99.018721 | 83 m | 81.4 m |

- **Anchor coordinates:** INEGI ITER 2020 locality points (official).
- **Path:** great-circle segments between consecutive anchors. This is **not a road route** and not a travel distance.
- **Sampling:** every ≈1 km along the path, giving 377 samples over 376.3 km.
- **Elevation:** bilinear interpolation of the 4 surrounding CEM cells. ULXMAP/ULYMAP are taken as the centre of the upper-left cell (ESRI BIL convention). NODATA cells are skipped; none occurred on this transect.

**Validation.** At the four anchors, the CEM value is within 4.4 m of INEGI's independently published locality altitude (ITER 2020). The worst case is Real de Catorce: +4.4 m on a steep mountain site.

## Region segments

Each sample is labelled with the municipality of its **nearest INEGI locality**. The municipality is then mapped to a region through `municipality-region-map.json` (PDU-SLP). This approximates municipal boundaries; no boundary polygons were downloaded. The result is four clean, contiguous segments:

| Region | km | Samples | Min | Median | Max |
|---|---|---|---|---|---|
| Altiplano | 0 – 113.2 | 0–113 | 1,622 m | 2,067 m | 3,011 m |
| Centro | 114.2 – 220.5 | 114–220 | 1,363 m | 1,847 m | 2,444 m |
| Zona Media | 221.5 – 335.5 | 221–335 | 519 m | 1,179 m | 1,513 m |
| Huasteca | 336.5 – 376.3 | 336–376 | 57 m | 298 m | 654 m |

- **Highest point:** 3,010.6 m at km 3.0, in the Sierra de Catorce just south of Real de Catorce. The nearest locality is San Juan de Matanzas, Catorce.
- **Lowest point:** 57.3 m at km 375.3, near Ciudad Valles (nearest locality El Corregidor).

## Use on the site

- The **shape** may replace the schematic profile directly.
- **Numbers** may be shown, because they are measured and sourced. Each figure must carry its label ("CEM 3.0 INEGI, 90 m") and the transect caveat ("perfil a lo largo de la línea Real de Catorce – San Luis Potosí – Rioverde – Ciudad Valles; no es una ruta carretera").
- **Simplify** the line for display (e.g. Douglas–Peucker to about 150 points) and keep the raw 377 samples in the data file.
- **Region boundaries** in the UI should use the `region_segments` distances above.

## Known limitations

1. **The transect is an editorial line.** A different line, such as Matehuala → Tamazunchale, would give a different profile.
2. **Region labels are approximate.** Nearest-locality labelling can misplace a sample by up to a few km near municipal borders; the boundary positions are approximate to that extent.
3. **Surface type.** CEM is a terrain model with vegetation and buildings removed. Values on the profile are ground elevations.
4. **The Huasteca segment is short** (40 km) because Ciudad Valles sits close to the Media–Huasteca escarpment. Extending the last leg towards Tamuín would lengthen it, but the descent itself happens before Ciudad Valles.

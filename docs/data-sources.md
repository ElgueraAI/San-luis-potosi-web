# Data sources

Source hierarchy for this project:

- **Tier 1:** official sources. These are authoritative.
- **Tier 2:** academic and institutional sources. These provide context.
- **Tier 3:** discovery sources (OSM, Commons). These give candidates only, never overriding Tier 1.

Every record in `research/entities` carries `source_ids`. The registries are:

- `research/source-registry/sources.json`: passes 1–2, untouched.
- `research/generated/seasonal-additions-pass4.json`: pass 4.
- `research/source-registry/sources-pass5.json`: this pass.

## Tier 1 — used in this pass

| Source | Institution | What it provided | How | Retrieved |
|---|---|---|---|---|
| SIC open data, state 24 (`sic.cultura.gob.mx/opendata/d/24_<table>_directorio.csv`) | Secretaría de Cultura | Museums (44), theatres, cultural centres, galleries, auditoriums, craft houses (183), festivals (21), archaeological zones, cathedrals, protected areas and heritage declarations (18), intangible heritage (8). Coordinates, address, phone, website | CSV download (ISO-8859-1). Licence: free reuse with attribution | 2026-10-06 |
| INAH open data: zonas arqueológicas | INAH | Zones open to the public (SLP: Tamohí, Tamtoc), condition, site museum, address | CSV download (quarterly) | 2026-10-06 |
| Lugares INAH (nodes 4460, 4527) | INAH | Description, period, hours, cost, services for Tamtoc and Tamohí | Read page | 2026-10-06 |
| DENUE, bulk file for San Luis Potosí | INEGI | Lodging (SCIAN 7211–7213), restaurants (722511–12), cafés (722515 named café), bars and nightlife (7224), drink producers (3121), museums (7121), balnearios (7131), travel services (5615), airports and bus stations (4881, 4884) | Local CSV (`research/raw/inegi/denue_24_csv.zip`) | file dated to 2025 registrations; read 2026-10-06 |
| ITER 2020, Censo de Población y Vivienda | INEGI | Municipal population, seat name, coordinates and altitude | CSV download | 2026-10-06 |
| Estadía (estadia.visitasanluispotosi.com) | Secretaría de Turismo de SLP | 34 hotels, 27 restaurants and bars, with official descriptions | WordPress REST API (`/wp-json/wp/v2/at_biz_dir`) | 2026-10-06 |
| Agenda navideña / Navidad Verde | Secretaría de Cultura SLP; Secretaría de Turismo SLP | December event | Read pages | 2026-10-06 |
| Regional brochures, map, events, seasonal calendar | Secretaría de Turismo SLP, Gobierno del Estado | Destinations, distances, gastronomy, recommendations | Research passes 1–2 (authoritative, unchanged) | 2026-10-04/05 |
| PDU-SLP | Gobierno del Estado | Region and microregion of each municipality | Research pass 1 | 2026-10-05 |

## Tier 1 — historical context only

| Source | Use | Restriction |
|---|---|---|
| «El Sector Turismo en el Estado de San Luis Potosí», August 2022 (turismoslp.com.mx) | 12,630 hotel rooms in the state, from DataTur 2022 | Shown labelled as 2022 context; never as proof that a business operates today |

## Tier 2

| Source | Use |
|---|---|
| Revista *Arqueología* (INAH), «Oxitipa y el sitio arqueológico de Tanute» | The documented site Tanute, with access unknown |

## Events pass 6 (sources-pass6.json, consulted 2026-10-06)

| Source | Use |
|---|---|
| CEFIM, Infografías municipales 2022 (58 PDFs, cefimslp.gob.mx) | Patron-saint festivals and fairs per municipality → RECURRENT_OFFICIAL_PATTERN |
| Secretaría de Turismo, /dia-de-muertos/ | Xantolo cycle (29 Sep–30 Nov) and the 2025 municipal programme table |
| Secretaría de Turismo, /campeonato-nacional-charro/, /conexion-aerea/, Villa Hidalgo | Campeonato Charro (historical), San José 19 Mar, airlines |
| slp.gob.mx news (Saucito, FENAHUAP, Semana Santa, FENAE, estudiantinas) | CONFIRMED_CURRENT_YEAR 2026 dates |
| cultura.slp.gob.mx (Festival de la Luna, Rondallas) | 2026 editions |
| INPODE (Serial Trail Rioverde, Soledad) | 2026 dates |
| matehuala.gob.mx | Matehuala festivities |

## Tier 3 — discovery only

| Source | Use |
|---|---|
| Wikimedia Commons | Licensed photographs, each with author, licence and URL (media registry) |
| OpenStreetMap | Approximate points already in the research layer, labelled «ubicación aproximada» |

## Consulted and not used for facts

- **japan.travel:** studied for information architecture only.
- **visitasanluispotosi.com photographs:** REFERENCE_ONLY, because no reuse licence is stated.
- **Tourism blogs:** never used.

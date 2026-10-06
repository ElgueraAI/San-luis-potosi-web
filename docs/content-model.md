# Content model

## Layers

1. **`research/`:** the authoritative research layer (passes 1–4). Read, never rewritten.
2. **`research/entities/<class>/index.json`:** the normalized knowledge base, built by `research/scripts/entities/build-entities.mjs` from the downloaded sources (`research/raw/`, git-ignored) and from layer 1.
3. **Site adapters:**
   - `src/data/research.ts`: destinations, seasons and sources, with verification rules.
   - `src/data/portal.ts`: entity views, relations and date/access labels.
   - `src/data/thingsToDo.ts`: the theme tree.
   - `src/data/seasons.ts`: the month stories.
   - `src/data/experiences.ts` and `src/data/eventsText.ts`: Spanish text for events.
4. **Workbook:** `C:/Users/jerry/slp-library/Biblioteca_Visual_San_Luis_Potosi_Web_ENRIQUECIDA.xlsx`, the human-readable catalogue, built by `research/scripts/entities/build-workbook.mjs`. The JSON wins on any difference.

## Entity schema

Every record has these fields; an unknown value is `null` or empty, never invented:

```
id, canonical_name, alternate_names[], entity_type, subcategory,
municipality, municipality_id (INEGI cve), locality, region,
latitude, longitude, coordinate_status (verified | approximate | registry | unavailable),
short_description, long_description, historical_context, why_visit,
activities[], recommended_duration, seasonality, accessibility,
opening_hours, price, official_contact {address, phone}, official_url, booking_url,
source_ids[], verification_status, last_verified, image_ids[], related_entities[], tags[], travel_notes
```

Class-specific fields:

| Class (`entity_type`) | Extra fields |
|---|---|
| municipality | `slug`, `seat {name, latitude, longitude, altitude_m, source}`, `population_2020`, `counts {destinations, museums, venues, archaeology, events, lodging, food, protected_areas}` |
| destination | `pueblo_magico`, `research_file` |
| protected-area / heritage-declaration / religious-landmark | `sic_link`, `sic_modified` |
| archaeological-site | `access_status` (OPEN_TO_PUBLIC · REGISTERED_OR_DOCUMENTED · NOT_PUBLICLY_ACCESSIBLE · UNKNOWN_ACCESS), `site_museum`, `intro_room`, `services[]` |
| museum / cultural-venue | `operator`, `founded`, `capacity`, `sic_link`, `sic_modified` |
| event | `date_status` (CONFIRMED_CURRENT_YEAR · RECURRING_WITH_OFFICIAL_PATTERN · HISTORICAL_LAST_CONFIRMED_DATE · DATE_UNKNOWN), `date_pattern`, `months[]`, `confirmed_dates`, `notes` |
| lodging / food / cafe / drink / nightlife / service / mobility / recreation | `denue {id, clee, scian, activity, staff, registered}` or `official_directory: true`; food only: `exposed` |

## Exposure rules

- **Food & drink:** the site shows official listings, cafés, drink producers, and DENUE restaurants and bars with 6 or more staff. Staff size is a capacity cue, not a ranking. All 3,433 records stay in research and in the workbook.
- **Lodging:** all records are shown, official first, then alphabetical. No stars, prices or availability.
- **Events:** SIC lists some festivals once per edition; they are de-duplicated in `portal.ts`, so the site shows 36 events from 37 records.
- **Archaeology:** only `OPEN_TO_PUBLIC` sites carry hours and cost, and both are dated.
- **Images:** photographs only from the licensed media set (`research/media-registry`, plus the additive `additions-pass4.json`). Without one, a contextual placeholder is shown: the state silhouette with the seat marked, or the type and region card.

## Interfaces for the routing pass

The later map-engineering pass can use these as they are:

- `places.json` rows: `{ id, coords [lon, lat], status, region, layer }`;
- municipality seats from ITER;
- the brochure distance tables (`distances` in `research.ts`).

Straight-line distances (`km()` in `portal.ts`) are labelled as such wherever they are shown.

# Research layer

Structured research for the San Luis Potosí tourism portal. Not used by the website yet.

| Folder | Contents |
|---|---|
| `source-registry/sources.json` | Every source consulted: institution, domain, URL, type, access and verification status. |
| `pdf-registry/resources.json` | Official brochures, maps, guides and documents (link-only; SHA-256 for downloaded files). |
| `destinations/` | One file per researched place (`<place_id>.json`) plus `index.json` for all 63. |
| `media-registry/media-candidates.json` | Image candidates (metadata only) with licence, author and status. |
| `generated/` | Machine-made inputs: workbook export, geocode and Commons candidates, guide research, weather model. |
| `reports/` | Pass reports. |
| `scripts/` | The scripts that produce all of the above. |
| `raw/` | **Git-ignored.** Downloaded brochures, cached pages and API responses. |

## Rebuild

Scripts that call external APIs read a contact for their User-Agent from
`SLP_RESEARCH_CONTACT` (set it before any uncached request; Nominatim requires a contact).

```bash
python research/scripts/export-workbook.py        # read-only export of the master workbook
python research/scripts/extract-official-pages.py # needs research/raw/pages/
python research/scripts/geocode-nominatim.py      # uses research/raw/geocode/ cache
python research/scripts/commons-candidates.py     # uses research/raw/commons/ cache
python research/scripts/build-registry.py         # writes the registries
```

## Rules

- A fact is `verified` only when it was read in an official source; the record carries the source id and date.
- `pending` = a value exists but is not cross-checked, or official sources disagree (see `conflicts`).
- `unavailable` = no source, or the field does not apply.
- OSM coordinates are candidates until cross-checked against an official source.
- No media is downloaded. `APPROVED_CANDIDATE` still needs a human visual review.
- Official PDFs are linked, never mirrored, unless reuse rights are explicit.

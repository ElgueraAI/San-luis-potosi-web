# Information architecture

The structure follows the principles of japan.travel without copying it:

- hierarchical navigation;
- progressive disclosure;
- discovery kept apart from planning;
- deep destination and theme pages;
- planning as a utility hub.

The «Cuatro mundos» identity, the home storytelling (hero, Descent, regions), the map and Mi Ruta stay as they were.

## Top level

**Header, desktop:** Destinos (regions panel), Qué hacer, Eventos, Planea, Mapa, Buscar, Mi Ruta, Menú. Planea and Eventos are hidden below 1180 px.

**Header, phone:** brand, Mi Ruta and Menú.

## Portal menu

Full-height dialog: `src/components/chrome/MenuSheet.astro`, driven by `src/scripts/menu.ts`.

```
Menú
├─ Inicio
├─ Destinos ›
│   ├─ Altiplano · Centro · Zona Media · Huasteca (region pages)
│   ├─ Municipios › ─ por región › ─ 59 municipality pages
│   ├─ Pueblos Mágicos › ─ destination pages
│   ├─ Destinos naturales → /que-hacer/naturaleza/
│   ├─ Patrimonio → /que-hacer/historia/
│   ├─ Arqueología › ─ Tamtoc, Tamohí, Tanute
│   └─ Ciudades y pueblos → /que-hacer/pueblos-ciudades/      [Todos los destinos]
├─ Qué hacer ›
│   ├─ 10 categories › ─ their subcategories (anchors on /que-hacer/<cat>/)
│   └─ Experiencias
├─ Planifica tu viaje › ─ llegar, moverse, clima, hospedaje, gastronomía, rutas, mapa, práctico, Mi Ruta
├─ Guías y recursos › ─ folletos, mapas, guías acreditados, movilidad, práctico, museos
├─ Eventos › ─ calendario, por mes › (12), destacados
└─ Acerca del proyecto › ─ acerca, créditos, buscar
```

**Behaviour:**
- A «›» opens the next level in place; nothing navigates until a link is chosen.
- Atrás returns to the parent and puts focus back on the item that opened the level.
- Focus moves to each level's title, so the location is announced; a visible trail («Menú / Qué hacer») shows where you are.
- Escape goes back one level and closes the menu from the root.
- The native `<dialog>` traps focus.
- The search box is at the top, and the quick links (Mapa, Temporadas, Experiencias, Rutas, Mi Ruta) at the bottom.
- Without JavaScript, every level is a list of plain links.

## URL map (Spanish; EN prefixes reserved in `src/i18n/routes.ts`)

| Path | Page | Family / tone |
|---|---|---|
| `/` | Home (Cuatro mundos) | editorial, full regional palette |
| `/regiones/<r>/` | 4 regions (+ municipality list) | region tones |
| `/municipios/`, `/municipios/<slug>/` | Index + 59 municipalities | region tones; short format when data is thin |
| `/destinos/`, `/destinos/<slug>/` | All destinations + destination pages | region |
| `/que-hacer/`, `/que-hacer/<cat>/` | Hub (keeps «¿Qué te mueve?») + 10 categories | per category tone |
| `/experiencias/`, `/experiencias/<slug>/` | 12 experiences | dark cinematic (jungle) |
| `/eventos/`, `/eventos/<slug>/` | Calendar + 36 event pages | heritage (dark) + light list |
| `/arqueologia/`, `/arqueologia/<slug>/` | INAH-led archaeology | heritage |
| `/museos/` | Museums and cultural venues (SIC) | heritage + utility directory |
| `/hospedaje/` | Lodging directory | utility |
| `/gastronomia/` | Regional cooking + food and drink directory | sand + utility |
| `/temporadas/` | Month explorer (pass 4) | per-month regional atmosphere |
| `/mapa/`, `/mi-ruta/`, `/rutas/` | Unchanged logic | cartographic neutral |
| `/guias/` | Resources by type | documentary (stone) |
| `/planea/` | Planning hub | utility |
| `/buscar/` | Global search | utility |
| `/acerca/`, `/creditos/` | Project and credits | stone |
| `/data/search.json`, `/data/{lodging,food,culture}.json`, `/data/places.json` | Static data for the client | — |

## Internal linking

Every page links into the relationship graph:

- destination ↔ municipality ↔ region;
- experience → destination, municipality, events, nearby lodging, other experiences;
- event → municipality, nearby destinations, lodging and food, same-month events;
- archaeology → municipality, related destination, nearby destinations and lodging;
- municipality → destinations, experiences, events, museums, venues, protected areas, food, lodging, map, neighbouring municipalities;
- region → its municipalities.

Mi Ruta accepts destinations, municipalities (seat), archaeological sites, museums and venues with a point, protected areas and lodging. These entity points are added to `places.json` under `layer: 'entity'` and are kept off the discovery map.

# Manual assets needed

What the open-licence search could **not** supply at premium quality, after visually reviewing every candidate. Each item is ready to brief a photographer or to search a stock library with.

**Rules for every item**
- **Licence:** must allow web use and editing (crop and re-encode). Record author, licence, source URL and download date in `media-registry/attributions.json`.
- **People:** identifiable people need a signed release. Indigenous communities and ceremonies (Teenek, Nahua, Xi'iuy, Wixárika) need community permission. No staged rituals.
- **Las Pozas:** the site requires a filming permit ("Permiso para toma de imagen y video", laspozasxilitla.org.mx).
- **Archaeological sites (Tamtoc):** commercial use of images may need INAH authorisation.
- **Originals:** never commit masters to Git. They go in `media-source/` (git-ignored); only optimised AVIF/WebP derivatives are committed.

Tiers: **T1** required for the MVP · **T2** required for the full experience · **T3** nice to have.

---

## TIER 1: required for the MVP

### HOME · 01 HERO · layered still plates (Altiplano dawn)  `home-01-hero`
- **Required:** dawn over the Altiplano, with the Sierra de Catorce ridge on the horizon, a flat plain, a mining-hacienda ruin as the focal element, and agave or yucca in the foreground. Deliver **separate plates** so the existing layered hero can move them independently:
  1. sky + far sierra (clean plate)
  2. mid plain
  3. focal ruin, with an alpha cut-out
  4. foreground plants, with an alpha cut-out
  5. optional haze/atmosphere pass
- **Desktop:** 21:9 safe inside 16:9 · **Mobile:** 9:16, a separate composition with the ruin centred low (not a crop)
- **Minimum:** 6000 px wide for the far plate; 4000 px for the others · RAW or 16-bit TIFF
- **Lighting:** blue hour into first sun, low raking light from the east, no harsh midday
- **Status:** NEEDS_MANUAL_ASSET. Fallback until then: `wc-69780780` (Real de Catorce panorama, CC BY 2.0) as a single plane.

### HUASTECA · DESCENT DROP VIDEO  `vid-transition-huasteca`
- **Required:** drone descending through the Tamul canyon toward the waterfall.
- **Desktop:** 16:9 · **Mobile:** 9:16 (separate flight or a vertical crop from a 4K master)
- **Minimum:** 4K preferred / 1080p minimum, 25–30 fps, Log or flat profile
- **Length:** 8–15 s
- **Movement:** a single continuous forward and downward motion, with no cuts and no yaw
- **Lighting:** late afternoon, soft haze, turquoise water (the official best season is November–March)
- **Reference:** youtube.com/watch?v=zqu3cbgbmzI 01:56–04:00 (reference only)
- **Status:** NEEDS MANUAL ASSET

### HUASTECA · PAGE HERO VIDEO  `vid-huasteca-hero`
- **Required:** Las Pozas in mist, with a slow push through the jungle toward a concrete stair or arch and the waterfall pool in frame.
- **Desktop:** 16:9 (21:9 safe) · **Mobile:** 9:16
- **Minimum:** 4K / 1080p · **Length:** 8–12 s, loopable · **Movement:** slow forward gimbal push
- **Lighting:** overcast morning with mist
- **Permit:** required from Las Pozas
- **Status:** NEEDS MANUAL ASSET. Still fallback: `wc-48806929` (Tamul).

### HOME · 14 CINEMATIC CLOSE VIDEO  `vid-close`
- **Required:** wide, nearly still shot of a turquoise Huasteca river at dusk between canyon walls ("the end of the line").
- **Desktop:** 21:9 · **Mobile:** 9:16 · **Length:** 8–10 s loop · **Movement:** locked-off or an imperceptible push
- **Lighting:** dusk
- **Status:** NEEDS MANUAL ASSET. Still fallback: `wc-48806880` (aerial over the lip of Tamul).

### ZONA MEDIA · REGION HERO (Media Luna)  `region zona-media hero_desktop / hero_mobile`
- **Required:** the Media Luna spring as people imagine it: crystal turquoise water seen from above, the crescent shape, swimmers or divers small in frame. Plus one **underwater** frame (divers, aquatic plants, clarity).
- **Desktop:** 16:9 (aerial) · **Mobile:** 9:16 (underwater or top-down)
- **Minimum:** 5000 px stills
- **Lighting:** late morning, high sun for water colour
- **Note:** this is a state ANP (Parque Estatal, decree of 7 June 2003), so drone use may need permission.
- **Status:** NEEDS MANUAL ASSET. Commons only has the outflow channels (`wc-76389273`).

### ALTIPLANO · REGION HERO MOBILE  `region altiplano hero_mobile`
- **Required:** vertical image of Real de Catorce: a cobbled street with the parish tower, or the town from above with the sierra.
- **Mobile:** 9:16 · **Minimum:** 3000 px tall · **Lighting:** golden hour
- **Status:** NEEDS MANUAL ASSET

### HUASTECA · TAMASOPO HERO  `hua-tamasopo-hero`
- **Required:** wide view of the Cascadas de Tamasopo with pools and people small in frame.
- **Desktop:** 16:9 · **Mobile:** 4:5 · **Minimum:** 4000 px
- **Lighting:** morning
- **Status:** NEEDS MANUAL ASSET. Only 1280 px images exist (`wc-6172324` for cards).

### MAP THUMBNAILS (missing destinations)
Destinations with **no usable image at all**, so their map thumbnails are empty. A 1:1 square of at least 1200 px each:

| Place | What to shoot |
|---|---|
| A03 Pueblo Fantasma | Stone ruins above Real de Catorce |
| A05 Estación Catorce | Station and desert |
| A09 Gruta de las Candelas | Cave interior with a person for scale |
| A13 Salinas de Hidalgo | **The real salt flats of Salinas, SLP** (all Commons results were other countries) |
| C13 Tierra Nueva | Plaza, palm hats (all results were other places) |
| C14 Sierra de San Miguelito | Rock formations, trail |
| M04 Ojito de Agua | Spring |
| M05 La Taza | Spring (locally kept site: low-key) |
| M06 Museo La Mezclita | Pieces (with museum permission) |
| M07 Santuario del Niño de la Salud | Façade |
| M13 Santa María Acapulco | Church/landscape (community permission) |
| M14 Grutas de la Catedral | Interior |
| H03 Cueva del Agua | Blue cenote mouth |
| H09 Convento de San Agustín | Façade |
| H15 Cascada El Salto | In season (70 m drop) |
| H17 Ciudad Valles | Plaza/river |

---

## TIER 2: required for the full experience

### TRANSITION CLIPS: The Descent (one per region)

| Slot | Shot | Ratio | Length | Light |
|---|---|---|---|---|
| `vid-transition-altiplano` | Aerial pull-back from Real de Catorce rooftops to the sierra | 16:9 + 9:16 | 6–8 s | Golden hour |
| `vid-transition-centro` | Blue-hour glide over the Centro Histórico as lights switch on | 16:9 + 9:16 | 6–8 s | Blue hour |
| `vid-transition-media` | Top-down slow descent over Media Luna | 16:9 + 9:16 | 6–8 s | Late morning |

The Pexels clip "Vista Aérea de San Luis Potosí" (vertical, 50 s) may cover the Centro mobile version once its location and licence are checked on the clip page.

### HUASTECA · CULTURE
- **Teenek:** craft (embroidery, *dhayemlaab*), market or community portrait. 4:5, with community permission. **Status:** NEEDS MANUAL ASSET.
- **Xantolo in San Luis Potosí:** altar with arch of marigold or *cempasúchil*, comparsa with masks; Aquismón, Tancanhuitz, Xilitla or Ciudad Valles. Every Commons result was Veracruz/Hidalgo. 16:9 + 4:5, with permission. **Status:** NEEDS MANUAL ASSET.
- **Gastronomy:** zacahuil, bocoles, enchiladas huastecas, huevos enhojados (named by the official brochure). Overhead plus a 45° hero, 1:1 and 4:5, natural light. **Status:** NEEDS MANUAL ASSET.

### CENTRO
- **Blue-hour cathedral and Plaza de Armas:** a stronger hero than the daylight `wc-21525423`. 16:9 at 5000 px or more.
- **Santa María del Río:** rebozo workshop with an artisan's hands at the backstrap loom (with consent). 4:5 and 16:9.

### ALTIPLANO
- **Mezcal:** maguey fields at dawn, *horno*, *tahona*, a master mezcalero (with consent). The official state page places "la ruta del Mezcal en el municipio de Charcas".
- **Culture/people:** no Altiplano people image is usable. Commission it with consent and avoid Wixárika ritual subjects.

### ZONA MEDIA
- **Ciudad Fernández:** Parroquia del Dulce Nombre de Jesús and its tower (the official page calls it one of the most beautiful in the state). 16:9 at 4000 px or more.
- **Ciudad del Maíz:** murals of El Tepeyac (attribution conflict between sources; photograph them and record the plaque).

---

## TIER 3: nice to have

- A guide portrait for "Guías y recursos": a certified guide at work, with a release.
- El Salto in season; Sótano de las Golondrinas at dawn with the bird spiral (iconic; access rules apply).
- Stories: archival images from the state archives (rights to be confirmed per item).
- Aerial of Tamtoc in early light (INAH authorisation).

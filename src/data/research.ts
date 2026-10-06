/**
 * Research adapter.
 *
 * The research layer (research/destinations, research/generated,
 * research/media-registry, research/pdf-registry) is the source of truth. This
 * module is the only place the website reads it, and it applies the
 * publication rules once, so no component re-decides them:
 *
 *  - A field renders only when its status is `verified` (editorial fields such
 *    as category and interest tags are navigation, not claims).
 *  - Pending and unavailable fields are dropped, never shown as information.
 *  - Disputed claims are overridden with safe wording (DISPUTED below), and a
 *    build-time guard refuses to render any of the disputed tokens.
 *  - Coordinates keep their map status: `ready` (official), `provisional`
 *    (OSM, plausibility-checked) or absent (not plotted).
 *  - research/raw is never read here.
 */
import placesGeo from '../../research/generated/maplibre-places.geojson?raw';
import pendingJson from '../../research/generated/maplibre-pending.json';
import seasonal from '../../research/generated/seasonal-calendar.json';
import eventsJson from '../../research/generated/events.json';
import seasonalAdd from '../../research/generated/seasonal-additions-pass4.json';
import sourcesPass5 from '../../research/source-registry/sources-pass5.json';
import sourcesPass6 from '../../research/source-registry/sources-pass6.json';
import climateJson from '../../research/generated/climate-monthly.json';
import elevation from '../../research/generated/elevation-profile.json';
import weatherModel from '../../research/generated/weather-model.json';
import brochure from '../../research/generated/brochure-tables.json';
import muniMap from '../../research/generated/municipality-region-map.json';
import resourcesJson from '../../research/pdf-registry/resources.json';
import sourcesJson from '../../research/source-registry/sources.json';
import destManifest from '../../research/media-registry/destination-asset-manifest.json';
import mediaLib from './generated/media.json';

// ---------------------------------------------------------------- types ----
export type RegionId = 'altiplano' | 'centro' | 'zona-media' | 'huasteca';
export const REGION_IDS: RegionId[] = ['altiplano', 'centro', 'zona-media', 'huasteca'];

type RawFact<T> = { value: T | null; status: string; source?: string; verifiedAt?: string; note?: string } | null | undefined;

type RawDestination = {
  place_id: string;
  name: string;
  type: string;
  region: RawFact<string>;
  municipality: RawFact<string>;
  description: RawFact<string>;
  coordinates?: { latitude: number; longitude: number; verification_status: string } | null;
  pueblo_magico?: RawFact<boolean>;
  category?: { value: string };
  interest_tags?: { value: string[] };
  season?: RawFact<string>;
  access?: { value: string; status: string; source?: string }[];
  facts?: Record<string, RawFact<unknown>>;
  official_resources?: string[];
  official_source?: string[];
  conflicts?: string[];
  ethics?: string | null;
  map_status: string;
  priority: string;
  seasonal_tags?: string[];
  media_selected?: string[];
};

export type VerifiedFact = { key: string; label: string; value: string; source: string };
export type MapStatus = 'ready' | 'provisional' | 'none';

export type Destination = {
  id: string;
  slug: string;
  name: string;
  region: RegionId;
  municipality: string | null;
  kind: string;
  category: 'natural' | 'cultural' | 'mixed';
  description: string;
  descriptionSource: string;
  tags: string[];
  interests: InterestId[];
  puebloMagico: boolean;
  season: { value: string; source: string } | null;
  access: { value: string; source: string }[];
  facts: VerifiedFact[];
  gastronomy: string[];
  coords: [number, number] | null;
  mapStatus: MapStatus;
  priority: 'A' | 'B' | 'C';
  resources: string[];
  officialSources: string[];
  disputed: string[];
  ethics: string | null;
  lowKey: boolean;
  media: {
    hero: string | null;
    heroMobile: string | null;
    card: string | null;
    detail: string | null;
    experience: string | null;
    gallery: string[];
  };
  nearby: { id: string; km: number }[];
  seasonalRecords: string[];
};

// --------------------------------------------------- publication rules ----
const isVerified = <T,>(f: RawFact<T>): f is { value: T; status: 'verified'; source: string } =>
  !!f && f.status === 'verified' && f.value !== null && f.value !== undefined;

/** Em dashes never render (house style); they become commas. */
export function clean(s: string): string {
  return s
    .replace(/\s*—\s*([^—]+?)\s*—\s*/g, ', $1, ')
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s+,/g, ',')
    .trim();
}

/**
 * Unresolved conflicts between official sources (research-pass-2a-2b.md).
 * The site never picks a side: these records render with neutral wording.
 */
const DISPUTED: Record<string, { description?: string; note: string }> = {
  A02: { note: 'La longitud del túnel difiere entre fuentes oficiales; no se publica una cifra.' },
  A01: { note: 'La longitud del Túnel de Ogarrio difiere entre fuentes oficiales; no se publica una cifra.' },
  H07: { note: 'Las fuentes oficiales describen de forma distinta el origen de Edward James; aquí se le presenta como poeta y mecenas del surrealismo.' },
  H08: { note: 'Las fuentes oficiales describen de forma distinta el origen de Edward James; aquí se le presenta como poeta y mecenas del surrealismo.' },
  M12: {
    description: "En la comunidad de El Tepeyac, en Ciudad del Maíz, dos murales: 'Ritual de una alegoría' y 'Transformación del Tepeyac'.",
    note: 'La autoría de los murales se registra de forma distinta en las fuentes oficiales; no se atribuye aquí.',
  },
};
/** Tokens that must never reach a page (the disputed claims themselves). */
const FORBIDDEN = [/escoc[eé]s/i, /\bingl[eé]s\b/i, /Diego Rivera/i, /Jorge Pasquel/i, /\b2[.,][35]\s?km\b/i];

export function assertSafe(text: string, where: string): string {
  for (const re of FORBIDDEN) {
    if (re.test(text)) throw new Error(`Disputed claim ${re} would render in ${where}. Use neutral wording.`);
  }
  return text;
}

/** Places that the official source asks to promote gently, if at all. */
const LOW_KEY = new Set(['M05']);

// ------------------------------------------------------------- display ----
const DISPLAY: Record<string, { slug: string; name?: string }> = {
  A01: { slug: 'real-de-catorce' },
  A02: { slug: 'tunel-de-ogarrio' },
  A04: { slug: 'sierra-de-catorce', name: 'Sierra de Catorce y Cerro del Quemado' },
  A06: { slug: 'matehuala', name: 'Matehuala' },
  A07: { slug: 'catedral-de-matehuala' },
  A08: { slug: 'guadalcazar', name: 'Guadalcázar' },
  A09: { slug: 'gruta-de-las-candelas' },
  A10: { slug: 'escalada-en-guadalcazar' },
  A11: { slug: 'charcas', name: 'Charcas' },
  A12: { slug: 'ruta-del-mezcal-charcas', name: 'Ruta del Mezcal en Charcas' },
  A13: { slug: 'salinas-de-hidalgo' },
  A14: { slug: 'venado', name: 'Venado' },
  C01: { slug: 'centro-historico-san-luis-potosi' },
  C03: { slug: 'plaza-del-carmen' },
  C05: { slug: 'teatro-de-la-paz' },
  C07: { slug: 'centro-de-las-artes' },
  C08: { slug: 'museo-leonora-carrington' },
  C09: { slug: 'barrio-de-tlaxcala' },
  C10: { slug: 'cerro-de-san-pedro' },
  C11: { slug: 'santa-maria-del-rio' },
  C12: { slug: 'talleres-de-rebozo', name: 'Talleres de rebozo' },
  C13: { slug: 'tierra-nueva' },
  C15: { slug: 'haciendas-de-villa-de-reyes' },
  H01: { slug: 'cascada-de-tamul' },
  H02: { slug: 'rio-tampaon' },
  H04: { slug: 'sotano-de-las-golondrinas' },
  H05: { slug: 'hoya-de-las-huahuas', name: 'Hoya de las Huahuas' },
  H06: { slug: 'aquismon', name: 'Aquismón' },
  H07: { slug: 'xilitla', name: 'Xilitla' },
  H08: { slug: 'las-pozas' },
  H09: { slug: 'convento-de-san-agustin' },
  H10: { slug: 'cascadas-de-tamasopo' },
  H11: { slug: 'puente-de-dios' },
  H12: { slug: 'cascadas-de-micos' },
  H13: { slug: 'cascada-de-minas-viejas' },
  H14: { slug: 'cascada-el-meco' },
  H15: { slug: 'cascada-el-salto' },
  H16: { slug: 'tamtoc', name: 'Zona Arqueológica de Tamtoc' },
  H17: { slug: 'ciudad-valles' },
  H18: { slug: 'xantolo', name: 'Xantolo y tradiciones huastecas' },
  M01: { slug: 'media-luna' },
  M02: { slug: 'rioverde', name: 'Rioverde' },
  M03: { slug: 'ciudad-fernandez', name: 'Ciudad Fernández' },
  M04: { slug: 'ojito-de-agua' },
  M06: { slug: 'museo-la-mezclita' },
  M07: { slug: 'santuario-nino-de-la-salud', name: 'Santuario del Niño de la Salud' },
  M08: { slug: 'el-balandran' },
  M09: { slug: 'ciudad-del-maiz' },
  M10: { slug: 'casa-barraganena' },
  M11: { slug: 'parroquia-purisima-concepcion' },
  M12: { slug: 'murales-de-el-tepeyac' },
  M13: { slug: 'santa-maria-acapulco' },
  M14: { slug: 'grutas-de-la-catedral', name: 'Grutas de la Catedral' },
};

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Short kind label for captions ("Cascada", "Pueblo Mágico"…). */
function kindLabel(type: string, pm: boolean): string {
  if (pm) return 'Pueblo Mágico';
  return type.split('/')[0].trim();
}

const FACT_LABEL: Record<string, string> = {
  height_m: 'Caída',
  pueblo_magico_since: 'Pueblo Mágico desde',
  protected_area: 'Protección',
  protected_area_context: 'Contexto natural protegido',
  official_name: 'Nombre oficial',
  hours: 'Horario',
  admission: 'Acceso',
  address: 'Dirección',
  mezcal_route: 'Ruta',
};
function factValue(key: string, v: unknown): string {
  if (key === 'height_m') return `${v} m`;
  return String(v);
}

// -------------------------------------------------------------- interests ---
export type InterestId =
  | 'naturaleza' | 'cascadas' | 'aventura' | 'pueblos-magicos' | 'gastronomia' | 'cultura'
  | 'historia' | 'arte' | 'arquitectura' | 'arqueologia' | 'artesania' | 'senderismo' | 'fotografia';

// Each interest card's photograph is of a place that carries that interest
// (gastronomía excepted: no dish is tied to a tagged place, so the Huasteca
// zacahuil stands for the category). No two interests share a photograph, and
// none repeats a Temporadas stage or an Experiencias card.
export const INTERESTS: { id: InterestId; label: string; tags: string[]; image: string; focal?: string }[] = [
  { id: 'cascadas', label: 'Cascadas y agua', tags: ['cascadas', 'agua', 'natacion', 'buceo'], image: 'px-14842050' },
  { id: 'naturaleza', label: 'Naturaleza', tags: ['naturaleza', 'paisaje', 'desierto', 'aves'], image: 'wc-45072628' },
  { id: 'aventura', label: 'Aventura', tags: ['aventura', 'kayak', 'rafting', 'espeleologia', 'escalada', 'ciclismo', 'cabalgata', 'paddle', 'campismo'], image: 'wc-2008166' },
  { id: 'pueblos-magicos', label: 'Pueblos Mágicos', tags: [], image: 'wc-58118619' },
  { id: 'cultura', label: 'Cultura viva', tags: ['cultura-viva', 'tradiciones', 'xantolo', 'cultura-teenek', 'xi-iuy', 'fe', 'peregrinacion'], image: 'wc-21612508' },
  { id: 'historia', label: 'Historia y minería', tags: ['patrimonio', 'historia', 'mineria', 'haciendas', 'ferrocarril'], image: 'wc-12418759' },
  { id: 'arquitectura', label: 'Arquitectura y barroco', tags: ['arquitectura', 'barroco'], image: 'wc-75414140' },
  { id: 'arte', label: 'Arte y surrealismo', tags: ['arte', 'surrealismo', 'museos', 'muralismo', 'artes-escenicas'], image: 'wc-79606411' },
  { id: 'arqueologia', label: 'Arqueología', tags: ['arqueologia'], image: 'wc-30478447' },
  { id: 'artesania', label: 'Artesanía y rebozo', tags: ['artesania', 'textiles'], image: 'wc-58139971' },
  { id: 'gastronomia', label: 'Gastronomía', tags: ['gastronomia', 'cafe'], image: 'wc-105308560' },
  { id: 'senderismo', label: 'Senderismo', tags: ['senderismo'], image: 'wc-50604767' },
  { id: 'fotografia', label: 'Fotografía', tags: ['fotografia'], image: 'wc-145400200' },
];

function interestsFor(tags: string[], pm: boolean): InterestId[] {
  return INTERESTS.filter((i) => (i.id === 'pueblos-magicos' ? pm : i.tags.some((t) => tags.includes(t)))).map((i) => i.id);
}

// ------------------------------------------------------------- map data ----
type GeoFeature = {
  id: string;
  geometry: { coordinates: [number, number] };
  properties: { place_id: string; map_status: string; description_short?: string };
};
const geo = JSON.parse(placesGeo) as { metadata: { attribution: string }; features: GeoFeature[] };
const geoById = new Map(geo.features.map((f) => [f.properties.place_id, f]));
export const mapAttribution: string = geo.metadata.attribution;

// --------------------------------------------------------- media lookup ----
type MediaRec = (typeof mediaLib.assets)[keyof typeof mediaLib.assets];
const mediaAssets = mediaLib.assets as Record<string, MediaRec>;
/** Only assets that made it into the production set (attributed, selected). */
export const hasMedia = (id: string | null | undefined): id is string => !!id && !!mediaAssets[id];
const firstMedia = (...ids: (string | null | undefined)[]) => ids.find(hasMedia) ?? null;

type ManifestSlots = {
  hero_desktop: string | null;
  hero_mobile: string | null;
  gallery_landscape: string[];
  gallery_vertical: string[];
  detail: string | null;
  card: string | null;
  experience: string | null;
  nearby_destination: { place_id: string; straight_line_km: number }[] | null;
};
const manifest = destManifest.destinations as unknown as Record<string, { slots: ManifestSlots }>;

// ---------------------------------------------------------- destinations ---
const rawDest = import.meta.glob<RawDestination>('/research/destinations/[ACHM][0-9][0-9].json', { eager: true, import: 'default' });

function build(d: RawDestination): Destination | null {
  if (LOW_KEY.has(d.place_id)) return null;
  const override = DISPUTED[d.place_id];
  const descr = override?.description ?? (isVerified(d.description) ? d.description.value : null);
  if (!descr) return null; // no verified description, no page
  const region = (isVerified(d.region) ? d.region.value : null) as RegionId | null;
  if (!region) return null;

  const pm = isVerified(d.pueblo_magico) ? !!d.pueblo_magico.value : false;
  const tags = d.interest_tags?.value ?? [];
  const facts: VerifiedFact[] = [];
  const gastronomy: string[] = [];
  for (const [key, f] of Object.entries(d.facts ?? {})) {
    if (!isVerified(f)) continue;
    if (key === 'gastronomy') { gastronomy.push(...(f.value as string[])); continue; }
    if (!FACT_LABEL[key]) continue;
    facts.push({ key, label: FACT_LABEL[key], value: factValue(key, f.value), source: f.source });
  }

  const feature = geoById.get(d.place_id);
  const mapStatus: MapStatus = feature ? (feature.properties.map_status === 'ready' ? 'ready' : 'provisional') : 'none';
  const coords = feature ? (feature.geometry.coordinates as [number, number]) : null;

  const s = manifest[d.place_id]?.slots;
  const selected = (d.media_selected ?? []).filter(hasMedia);
  const gallery = [...(s?.gallery_landscape ?? []), ...(s?.gallery_vertical ?? []), ...selected].filter(hasMedia);
  const card = firstMedia(s?.card, s?.hero_desktop, ...selected);
  const hero = firstMedia(s?.hero_desktop, card);

  const disp = DISPLAY[d.place_id];
  const name = clean(disp?.name ?? d.name);
  const description = assertSafe(clean(descr), d.place_id);

  return {
    id: d.place_id,
    slug: disp?.slug ?? slugify(d.name),
    name,
    region,
    municipality: isVerified(d.municipality) ? d.municipality.value : null,
    kind: kindLabel(d.type, pm),
    category: (d.category?.value as Destination['category']) ?? 'cultural',
    description,
    descriptionSource: override?.description ? 'neutral' : (d.description as { source: string }).source,
    tags,
    interests: interestsFor(tags, pm),
    puebloMagico: pm,
    season: isVerified(d.season) ? { value: assertSafe(clean(d.season.value), d.place_id), source: d.season.source } : null,
    access: (d.access ?? []).filter((a) => a.status === 'verified').map((a) => ({ value: clean(a.value), source: a.source ?? '' })),
    facts,
    gastronomy,
    coords,
    mapStatus,
    priority: (d.priority as Destination['priority']) ?? 'B',
    resources: d.official_resources ?? [],
    officialSources: d.official_source ?? [],
    disputed: override ? [override.note] : [],
    ethics: d.ethics ?? null,
    lowKey: false,
    media: {
      hero,
      heroMobile: firstMedia(s?.hero_mobile),
      card,
      detail: firstMedia(s?.detail),
      experience: firstMedia(s?.experience),
      gallery: [...new Set(gallery)].filter((g) => g !== hero),
    },
    nearby: (s?.nearby_destination ?? []).map((n) => ({ id: n.place_id, km: n.straight_line_km })),
    seasonalRecords: [],
  };
}

const ORDER = (id: string) => REGION_IDS.indexOf(({ A: 'altiplano', C: 'centro', M: 'zona-media', H: 'huasteca' } as const)[id[0] as 'A'] ) * 100 + +id.slice(1);

export const destinations: Destination[] = Object.values(rawDest)
  .map(build)
  .filter((d): d is Destination => !!d)
  .sort((a, b) => ORDER(a.id) - ORDER(b.id));

const byId = new Map(destinations.map((d) => [d.id, d]));
export const getDestination = (id: string) => byId.get(id) ?? null;
export const destinationsIn = (r: RegionId) => destinations.filter((d) => d.region === r);

/** Destinations without a page still need a name for map popups/lists. */
const allNames = new Map(Object.values(rawDest).map((d) => [d.place_id, clean(DISPLAY[d.place_id]?.name ?? d.name)]));
export const placeName = (id: string) => allNames.get(id) ?? id;

// --------------------------------------------------------- map features ----
export type MapPlace = {
  id: string;
  name: string;
  region: RegionId;
  status: 'ready' | 'provisional';
  coords: [number, number];
  municipality: string | null;
  kind: string;
  description: string | null;
  interests: InterestId[];
  slug: string | null;
  image: string | null;
};

export const mapPlaces: MapPlace[] = geo.features
  .filter((f) => !LOW_KEY.has(f.properties.place_id))
  .map((f) => {
    const id = f.properties.place_id;
    const d = byId.get(id);
    const raw = Object.values(rawDest).find((r) => r.place_id === id)!;
    return {
      id,
      name: placeName(id),
      region: raw.region?.value as RegionId,
      status: f.properties.map_status === 'ready' ? 'ready' : 'provisional',
      coords: f.geometry.coordinates,
      municipality: d?.municipality ?? null,
      kind: d?.kind ?? kindLabel(raw.type, false),
      description: d?.description ?? null,
      interests: d?.interests ?? interestsFor(raw.interest_tags?.value ?? [], false),
      slug: d?.slug ?? null,
      image: d?.media.card ?? null,
    } satisfies MapPlace;
  });

/**
 * Municipal seats named by seasonal records that are not destinations
 * (Cerritos, Tancanhuitz, San Nicolás Tolentino). Points are the INEGI ITER
 * 2020 locality coordinates, the same method as other locality points, so
 * they are verified points. Used by the Temporadas mini map only.
 */
export const seasonLocalities: MapPlace[] = seasonalAdd.localities.map((l) => ({
  id: l.id, name: l.name, region: l.region as RegionId, status: 'ready', coords: [l.longitude, l.latitude],
  municipality: l.name, kind: 'Cabecera municipal', description: null, interests: [], slug: null, image: null,
}));

/** Places researched but deliberately not plotted (no acceptable point). */
export const unplottedPlaces = pendingJson.places
  .filter((p) => !LOW_KEY.has(p.place_id))
  .map((p) => ({ id: p.place_id, name: placeName(p.place_id), region: p.region as RegionId, reason: p.reason, slug: byId.get(p.place_id)?.slug ?? null }));

// --------------------------------------------------------- regions data ----
export const municipalities = muniMap.municipalities;
export function municipalityCount(r: RegionId): number {
  return muniMap.municipalities.filter((m) => m.region === r && m.verification_status === 'verified').length;
}
export const verifiedMunicipalityTotal = muniMap.summary.verified;

// ------------------------------------------------------- elevation profile ---
export type ProfileSample = { km: number; m: number; region: RegionId; near: string; lat: number; lon: number };
export const profile = {
  verified: elevation.status === 'measured' && elevation.verification_status === 'verified',
  source: `${elevation.source.name}, ${elevation.source.resolution}`,
  sourceShort: 'INEGI · CEM 3.0, 90 m',
  url: elevation.source.url,
  lengthKm: elevation.transect.length_km,
  anchors: elevation.transect.anchors.map((a) => ({ name: a.name, m: a.inegi_altitude_m, lat: a.lat, lon: a.lon })),
  summary: elevation.summary,
  segments: elevation.region_segments.map((s) => ({ region: s.region as RegionId, from: s.from_km, to: s.to_km })),
  samples: elevation.samples.map((s): ProfileSample => ({ km: s.distance_km, m: s.elevation_m, region: s.region as RegionId, near: s.nearest_locality, lat: s.latitude, lon: s.longitude })),
  caveat: 'Perfil a lo largo de la línea Real de Catorce, San Luis Potosí, Rioverde y Ciudad Valles. No es una ruta carretera.',
};

/** Min / max elevation inside one region's stretch of the transect. */
export function regionElevation(r: RegionId): { min: number; max: number } {
  const ms = profile.samples.filter((s) => s.region === r).map((s) => s.m);
  return { min: Math.min(...ms), max: Math.max(...ms) };
}

/**
 * Douglas-Peucker. x (km) is scaled to metres-equivalent so a full transect
 * spans about as much as its relief; `tolerance` is in metres.
 */
export function simplifiedProfile(tolerance = 12): ProfileSample[] {
  const pts = profile.samples;
  const sx = 3000 / profile.lengthKm;
  const X = (i: number) => pts[i].km * sx;
  const Y = (i: number) => pts[i].m;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let max = 0, idx = -1;
    const dx = X(b) - X(a), dy = Y(b) - Y(a), len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * (X(i) - X(a)) - dx * (Y(i) - Y(a))) / len;
      if (d > max) { max = d; idx = i; }
    }
    if (max > tolerance && idx > -1) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// ------------------------------------------------------------- seasons -----
// Pass-4 additions (research/generated/seasonal-additions-pass4.json) are merged
// here: records, their events and the month index. The base files stay untouched.
export type SeasonRecord = (typeof seasonal.records)[number];
const addRecords = seasonalAdd.records as unknown as SeasonRecord[];
export const seasonRecords: SeasonRecord[] = [...seasonal.records, ...addRecords];
export const seasonRule = seasonal.rule;
export const months = seasonal.by_month.map((m) => ({
  ...m,
  records: [...m.records, ...addRecords.filter((r) => (r.months as number[]).includes(m.month)).map((r) => r.record_id)],
  events: [...m.events, ...addRecords.filter((r) => (r.months as number[]).includes(m.month)).flatMap((r) => r.festivals ?? [])],
}));
export const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const SEASONS = [
  { id: 'primavera', label: 'Primavera', months: [3, 4, 5] },
  { id: 'verano', label: 'Verano', months: [6, 7, 8] },
  { id: 'otoño', label: 'Otoño', months: [9, 10, 11] },
  { id: 'invierno', label: 'Invierno', months: [12, 1, 2] },
] as const;

export const events = [...eventsJson.events, ...(seasonalAdd.events as unknown as typeof eventsJson.events)].filter((e) => e.verification_status === 'verified');
export const climate = climateJson;
export const climateLabel = climateJson.label_es;

// attach seasonal records to destinations
for (const r of seasonRecords) {
  for (const id of String(r.destination).split('|')) byId.get(id)?.seasonalRecords.push(r.record_id);
}

// ------------------------------------------------------------- weather -----
export type WeatherPoint = { key: string; name: string; placeId: string; lat: number; lon: number; region: RegionId };
const W = weatherModel.points.locations as Record<string, { location_name: string; place_id: string; latitude: number; longitude: number; region: string }>;
const WEATHER_NAMES: Record<string, string> = {
  altiplano: 'Matehuala', centro: 'San Luis Potosí', 'zona-media': 'Rioverde', huasteca: 'Ciudad Valles',
  'real-de-catorce': 'Real de Catorce', xilitla: 'Xilitla',
};
export const weatherPoints: WeatherPoint[] = Object.entries(W).map(([key, p]) => ({
  key, name: WEATHER_NAMES[key] ?? p.location_name, placeId: p.place_id, lat: p.latitude, lon: p.longitude, region: p.region as RegionId,
}));
export const weatherConfig = {
  endpoint: weatherModel.current.endpoint,
  params: weatherModel.current.params,
  codes: weatherModel.wmo_codes_es as Record<string, string>,
  attribution: weatherModel.provider.attribution.es,
  links: weatherModel.provider.attribution.links,
};
/** The weather point that best represents a destination. */
export function weatherPointFor(d: Pick<Destination, 'id' | 'region' | 'municipality'>): WeatherPoint {
  if (d.municipality === 'Catorce') return weatherPoints.find((p) => p.key === 'real-de-catorce')!;
  if (d.municipality === 'Xilitla') return weatherPoints.find((p) => p.key === 'xilitla')!;
  return weatherPoints.find((p) => p.key === d.region)!;
}

// ------------------------------------------------------------ brochures ----
type BFact = (typeof brochure.facts)[number];
export const brochureFacts = brochure.facts as BFact[];
export const brochureFact = (id: string) => brochureFacts.find((f) => f.fact_id === id) ?? null;
export type DistanceRow = { id: string; from: string; to: string; km: number; time: string; highway: string | null; unpaved: number | null; brochure: string };
export const distances: DistanceRow[] = brochureFacts
  .filter((f) => f.field === 'distance' && !/Salinas/.test(String((f.value as { to?: string }).to))) // Matehuala-Salinas flagged implausible
  .map((f) => {
    const v = f.value as { from: string; to: string; distance_km: number; time_approx: string; highway: string | null; unpaved_km: number | null };
    return { id: f.fact_id, from: v.from, to: v.to, km: v.distance_km, time: v.time_approx, highway: v.highway, unpaved: v.unpaved_km, brochure: f.brochure };
  });
export const gastronomyFor = (region: RegionId): { place: string | null; dishes: string[] }[] =>
  brochureFacts
    .filter((f) => f.field === 'gastronomy' && f.region === region)
    // the Altiplano brochure repeats the Huasteca box; only its place-specific rows are kept
    .filter((f) => !(region === 'altiplano' && !(f.value as { place?: string }).place))
    .map((f) => ({ place: (f.value as { place?: string }).place ?? null, dishes: (f.value as { dishes: string[] }).dishes }));
export const recommendationsFor = (region: RegionId): string[] =>
  [...new Set(brochureFacts.filter((f) => f.field === 'recommendation' && f.region === region).map((f) => (f.value as { text: string }).text))];

// ------------------------------------------------------------ resources ----
export type Resource = (typeof resourcesJson.resources)[number];
export const resources = resourcesJson.resources;
export const resourcePolicy = resourcesJson.policy;
export const getResource = (id: string) => resources.find((r) => r.resource_id === id) ?? null;
export const sources = [...sourcesJson.sources, ...(seasonalAdd.sources as unknown as typeof sourcesJson.sources), ...(sourcesPass5.sources as unknown as typeof sourcesJson.sources), ...(sourcesPass6.sources as unknown as typeof sourcesJson.sources)];
export const getSource = (id: string) => sources.find((s) => s.source_id === id) ?? null;

/** A human label for a fact source id, for small "Fuente:" lines. */
export function sourceLabel(id: string): string {
  if (!id) return '';
  if (id.startsWith('brochure-')) return 'Folleto oficial, Secretaría de Turismo de SLP';
  if (id === 'pdu-slp') return 'Plan Estatal de Desarrollo Urbano de SLP';
  const s = getSource(id);
  return s ? s.institution : id;
}
export function sourceUrl(id: string): string | null {
  if (id.startsWith('brochure-')) {
    const r = getResource(`pdf-${id}`);
    return r?.url ?? null;
  }
  return getSource(id)?.url ?? null;
}

// --------------------------------------------------------- distribution ----
/** "Si te interesa esto, descubre también…": same region, shared interests,
 *  lesser-known first. No popularity claim is made or implied. */
export function alternativesFor(d: Destination, n = 4): Destination[] {
  const score = (o: Destination) => {
    const shared = o.interests.filter((i) => d.interests.includes(i)).length;
    const near = d.nearby.some((x) => x.id === o.id) ? 2 : 0;
    const lesser = o.priority === 'A' ? 0 : 1.5;
    return shared * 2 + near + lesser + (o.media.card ? 1 : 0);
  };
  return destinations
    .filter((o) => o.id !== d.id && o.region === d.region)
    .sort((a, b) => score(b) - score(a))
    .slice(0, n);
}
/** Lesser-known places (priority B/C) with an image and a verified description. */
export const beyondTheKnown = (region?: RegionId) =>
  destinations.filter((d) => d.priority !== 'A' && d.media.card && (!region || d.region === region));

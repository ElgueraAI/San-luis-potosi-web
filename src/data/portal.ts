/**
 * Portal data layer: the normalized knowledge base in research/entities/
 * (built by research/scripts/entities/build-entities.mjs) as typed views for
 * pages. Read at build time only; nothing here reaches the client except
 * through the JSON endpoints under src/pages/data/.
 *
 * Rules carried from the research layer:
 *  - destinations keep using src/data/research.ts (verified fields, DISPUTED
 *    overrides); entities add municipalities, culture, events, lodging, food.
 *  - DENUE rows are registry evidence, shown as "registro INEGI", never as a
 *    recommendation; no ratings, prices or hours are shown that a source did
 *    not publish.
 *  - Event dates carry their status; a past edition is never shown as 2026.
 */
import { destinations, getDestination, hasMedia, type Destination, type RegionId } from './research';
import { municipalDestinations, sameMunicipality, validMunicipalityKey } from '../lib/municipality';

export type Contact = { address?: string | null; phone?: string | null; responsible?: string | null } | null;
export type Entity = {
  id: string; canonical_name: string; alternate_names: string[]; entity_type: string; subcategory: string | null;
  municipality: string | null; municipality_id: string | null; locality: string | null; region: RegionId | null;
  latitude: number | null; longitude: number | null; coordinate_status: string;
  short_description: string | null; historical_context: string | null; opening_hours: string | null; price: string | null;
  official_contact: Contact; official_url: string | null; source_ids: string[]; verification_status: string; last_verified: string | null;
  image_ids: string[]; related_entities: string[]; tags: string[]; travel_notes: string | null;
  // class-specific
  slug?: string; seat?: { name: string; latitude: number; longitude: number; altitude_m: number | null; source: string } | null;
  population_2020?: number | null; counts?: Record<string, number | null>;
  access_status?: string; site_museum?: boolean; services?: string[];
  date_status?: string; date_pattern?: string | null; months?: number[]; confirmed_dates?: string | null; notes?: string | null;
  start_date?: string | null; end_date?: string | null; recurrence_rule?: string | null; seasonal_window?: { from: number | null; to: number | null; label: string } | null; all_year?: boolean; venue?: string | null; cultural_context?: string | null;
  official_directory?: boolean; exposed?: boolean; denue?: { id: string; scian: string; activity: string; staff: string; registered: string };
  operator?: string | null; founded?: string | null; capacity?: number | null; sic_link?: string | null; pueblo_magico?: boolean | null;
};

// bundled at build time (eager glob keeps the large JSON untyped and server-side)
const files = import.meta.glob<Record<string, unknown>>('/research/entities/*/index.json', { eager: true, import: 'default' });
const file = (c: string) => files[`/research/entities/${c}/index.json`];
const load = (c: string): Entity[] => file(c).records as Entity[];
const loadExtra = <T>(c: string, key: string): T => file(c)[key] as T;
const ctxFiles = import.meta.glob<Record<string, unknown>>('/research/entities/context-2022.json', { eager: true, import: 'default' });

export const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const REGION_LABEL: Record<RegionId, string> = { altiplano: 'Altiplano', centro: 'Centro', 'zona-media': 'Zona Media', huasteca: 'Huasteca' };

// ------------------------------------------------------------ collections ---
export const municipalities = load('municipalities').sort((a, b) => a.canonical_name.localeCompare(b.canonical_name, 'es'));
export const attractionsAll = load('attractions');
export const archaeology = load('archaeology');
export const museums = load('museums');
export const museumsDenue = loadExtra<Entity[]>('museums', 'denue');
export const venues = load('cultural-venues');
export const eventsAll = load('events');
export const lodging = load('lodging');
const foodAll = load('food-drink');
export const food = foodAll.filter((f) => f.exposed);
export const services = load('services');
export const mobility = load('mobility');
export const recreation = load('recreation');
export const protectedAreas = attractionsAll.filter((a) => a.entity_type === 'protected-area');
export const heritageDeclarations = attractionsAll.filter((a) => a.entity_type === 'heritage-declaration');
export const cathedrals = attractionsAll.filter((a) => a.entity_type === 'religious-landmark');
export const context2022 = ctxFiles['/research/entities/context-2022.json'] as unknown as { figures: { key: string; value: number; label: string; basis: string }[]; year: number };
export const counts = {
  municipalities: municipalities.length, attractions: attractionsAll.length, archaeology: archaeology.length, museums: museums.length,
  venues: venues.length, events: eventsAll.length, lodging: lodging.length, foodAll: foodAll.length, foodShown: food.length,
  services: services.length, mobility: mobility.length, recreation: recreation.length,
};

// ------------------------------------------------------------ municipalities -
export const muniById = new Map(municipalities.filter((m) => validMunicipalityKey(m.id)).map((m) => [m.id, m]));
export const muniBySlug = new Map(municipalities.map((m) => [m.slug!, m]));
export const muniByName = new Map(municipalities.map((m) => [slugify(m.canonical_name), m]));
export const municipalityOf = (name: string | null | undefined) => (name ? muniByName.get(slugify(name)) ?? null : null);
const inMuni = (list: Entity[], id: string | null) => list.filter((e) => sameMunicipality(e.municipality_id, id));

export type MuniView = {
  m: Entity; destinations: Destination[]; museums: Entity[]; venues: Entity[]; archaeology: Entity[]; events: Entity[];
  protected: Entity[]; heritage: Entity[]; cathedrals: Entity[]; lodging: Entity[]; food: Entity[]; recreation: Entity[]; mobility: Entity[];
  image: string | null; puebloMagico: boolean;
};
export function muniView(m: Entity): MuniView {
  const ds = municipalDestinations(destinations, attractionsAll, m.id);
  const image = ds.map((d) => d.media.hero ?? d.media.card).find(hasMedia) ?? null;
  // official listings first, then registry rows; alphabetical inside each group (no ranking)
  const byOfficial = (a: Entity, b: Entity) => Number(!!b.official_directory) - Number(!!a.official_directory) || a.canonical_name.localeCompare(b.canonical_name, 'es');
  return {
    m, destinations: ds, museums: inMuni(museums, m.id), venues: inMuni(venues, m.id), archaeology: inMuni(archaeology, m.id),
    events: inMuni(events, m.id),
    protected: inMuni(protectedAreas, m.id), heritage: inMuni(heritageDeclarations, m.id), cathedrals: inMuni(cathedrals, m.id),
    lodging: inMuni(lodging, m.id).sort(byOfficial), food: inMuni(food, m.id).sort(byOfficial),
    recreation: inMuni(recreation, m.id), mobility: inMuni(mobility, m.id),
    image, puebloMagico: ds.some((d) => d.puebloMagico),
  };
}
/** How much a municipality page has to say: decides between a full and a short page. */
export const richness = (v: MuniView) => v.destinations.length * 4 + v.museums.length + v.venues.length / 2 + v.events.length * 2 + v.archaeology.length * 3 + v.protected.length * 2 + Math.min(v.lodging.length, 6) / 2;

export function nearbyMunicipalities(m: Entity, n = 4): Entity[] {
  if (m.latitude == null) return municipalities.filter((x) => x.region === m.region && x.id !== m.id).slice(0, n);
  return municipalities
    .filter((x) => x.id !== m.id && x.latitude != null)
    .map((x) => ({ x, d: km(m.latitude!, m.longitude!, x.latitude!, x.longitude!) }))
    .sort((a, b) => a.d - b.d).slice(0, n).map((o) => o.x);
}
export function km(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = (x: number) => (x * Math.PI) / 180, R = 6371;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ------------------------------------------------------------------ events --
/** Date statuses of the single events dataset (research/entities/events). */
export const DATE_STATUS: Record<string, { label: string; short: string; tone: 'ok' | 'pattern' | 'past' | 'unknown' | 'season' }> = {
  CONFIRMED_CURRENT_YEAR: { label: 'Fecha 2026 confirmada', short: 'Confirmada 2026', tone: 'ok' },
  RECURRENT_OFFICIAL_PATTERN: { label: 'Fecha recurrente (patrón oficial)', short: 'Patrón oficial', tone: 'pattern' },
  HISTORICAL_LAST_CONFIRMED: { label: 'Última fecha confirmada: edición anterior', short: 'Edición anterior', tone: 'past' },
  DATE_PENDING: { label: 'Fecha pendiente de publicar', short: 'Fecha pendiente', tone: 'unknown' },
  ALL_YEAR: { label: 'Todo el año', short: 'Todo el año', tone: 'season' },
  SEASONAL_WINDOW: { label: 'Temporada recomendada', short: 'Temporada', tone: 'season' },
};
// SIC lists some festivals once per edition ("Festival de San Luis", "XIX Festival de San Luis"): keep one
const edition = (n: string) => slugify(n.replace(/^(?:[IVXLC]+|\d+[°º]?)\s+/i, ''));
const seenEd = new Set<string>();
const datedAll = eventsAll
  .filter((e) => e.entity_type === 'event')
  .filter((e) => { if (!e.id.startsWith('sic-festival-')) return true; const k = edition(e.canonical_name); if (seenEd.has(k)) return false; seenEd.add(k); return true; });
const baseSlug = (e: Entity) => slugify(e.canonical_name.replace(/\(.*?\)/g, '')).slice(0, 60) || e.id;
const slugCount = datedAll.reduce((m, e) => m.set(baseSlug(e), (m.get(baseSlug(e)) ?? 0) + 1), new Map<string, number>());
/** Same-named festivities in different municipalities get the municipality in their slug. */
export const eventSlug = (e: Entity) => ((slugCount.get(baseSlug(e)) ?? 0) > 1 && e.municipality ? `${baseSlug(e)}-${slugify(e.municipality)}` : baseSlug(e));
/** Dated events (CONFIRMED, PATTERN, HISTORICAL, PENDING). */
export const events = datedAll.map((e) => ({ ...e, slug: eventSlug(e) }));
/** ALL_YEAR and SEASONAL_WINDOW experiences: shown apart from events, never as festivals. */
export const seasonalExperiences = eventsAll.filter((e) => e.entity_type === 'seasonal-experience');
export const eventById = new Map(events.map((e) => [e.id, e]));
counts.events = events.length;
/** Status order for lists: confirmed first, then official patterns, then history, then pending. */
export const STATUS_RANK: Record<string, number> = { CONFIRMED_CURRENT_YEAR: 0, RECURRENT_OFFICIAL_PATTERN: 1, HISTORICAL_LAST_CONFIRMED: 2, DATE_PENDING: 3 };
/** Day of month a pattern or date starts on, for chronological ordering inside a month (null if unknown). */
export function startDay(e: Entity, month: number): number {
  if (e.start_date && +e.start_date.slice(5, 7) === month) return +e.start_date.slice(8, 10);
  const M = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const m = new RegExp(`(\\d{1,2})(?:[^\\d]{1,12}\\d{1,2})?\\s+de\\s+${M[month - 1]}`, 'i').exec(e.date_pattern ?? '');
  return m ? +m[1] : 40;
}
export function fmtConfirmed(s: string | null | undefined): string | null {
  if (!s) return null;
  const M = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const f = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return `${d} de ${M[m - 1]} de ${y}`; };
  const [a, b] = s.split('/');
  return b ? `${f(a)} al ${f(b)}` : f(a);
}

// --------------------------------------------------------- archaeology ------
export const ACCESS: Record<string, string> = {
  OPEN_TO_PUBLIC: 'Abierta al público (INAH)',
  REGISTERED_OR_DOCUMENTED: 'Registrada o documentada',
  NOT_PUBLICLY_ACCESSIBLE: 'Sin acceso al público',
  UNKNOWN_ACCESS: 'Acceso no confirmado',
};
export const archSlug = (a: Entity) => slugify(a.canonical_name);

// -------------------------------------------------------------- relations --
/** Places of any kind within `radius` km of a point, nearest first. */
export function near<T extends Entity>(list: T[], lat: number | null, lon: number | null, radius = 25, n = 6): (T & { km: number })[] {
  if (lat == null || lon == null) return [];
  return list.filter((e) => e.latitude != null)
    .map((e) => ({ ...e, km: km(lat, lon, e.latitude!, e.longitude!) }))
    .filter((e) => e.km <= radius).sort((a, b) => a.km - b.km).slice(0, n);
}
export const destPoint = (d: Destination): [number, number] | null => (d.coords ? [d.coords[1], d.coords[0]] : null);
export { destinations, getDestination };

/** First production photo among a destination list. */
export const firstImage = (ds: Destination[]) => ds.map((d) => d.media.hero ?? d.media.card).find(hasMedia) ?? null;

/** Short label for a DENUE/official business row. */
export function bizNote(e: Entity): string {
  if (e.official_directory) return 'Directorio oficial Estadía (Secretaría de Turismo)';
  return 'Registro DENUE (INEGI): no es una recomendación; confirma antes de viajar';
}

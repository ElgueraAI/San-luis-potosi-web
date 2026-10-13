/**
 * Site adapter of the intelligence layer: runs the pure pipeline
 * (src/lib/intel) over the portal's collections and adds what only the site
 * knows: published text, internal URLs, thumbnails and Mi Ruta ids.
 *
 * Publication rules stay where they are (src/data/research.ts): a destination
 * enters the recommender only if it has a published page, and its text is the
 * published one (DISPUTED overrides included), never the raw research value.
 * Build time only; the client receives /data/intel.json.
 */
import { buildDataset } from '@/lib/intel/dataset';
import type { IntelDataset, IntelPlace } from '@/lib/intel/types';
import type { RawEntity, RawSeasonRecord } from '@/lib/intel/normalize';
import type { RawMunicipality } from '@/lib/intel/features';
import { attractionsAll, archaeology, museums, venues, recreation, eventsAll, municipalities, events, muniById, slugify } from './portal';
import { getDestination, seasonRecords, climate, sources as sourceRegistry } from './research';
import { thumbUrl } from '@/lib/media';
import { href, destHref, archHref, muniHref, eventHref } from '@/i18n/routes';
import destIndex from '../../research/destinations/index.json';

const base = buildDataset({
  attractions: attractionsAll as unknown as RawEntity[],
  archaeology: archaeology as unknown as RawEntity[],
  museums: museums as unknown as RawEntity[],
  venues: venues as unknown as RawEntity[],
  recreation: recreation as unknown as RawEntity[],
  events: eventsAll as unknown as RawEntity[],
  municipalities: municipalities as unknown as RawMunicipality[],
  seasonRecords: seasonRecords as unknown as RawSeasonRecord[],
  priorities: destIndex.destinations,
});

const dirUrl = (name: string) => `${href('museums')}?q=${encodeURIComponent(name)}`;
/** Kinds that /data/places.json carries, so «Añadir a Mi Ruta» works for them. */
const IN_PLACES = new Set(['archaeology', 'museum', 'gallery', 'craft', 'protected-area']);

function enrich(p: IntelPlace): IntelPlace | null {
  if (p.kind === 'destination') {
    const d = getDestination(p.id);
    if (!d) return null; // no published page (no verified description, or low-key by request of the source)
    return { ...p, name: d.name, description: d.description, url: destHref(d.slug), image: d.media.card, route_id: d.id };
  }
  const muni = p.municipality_id ? muniById.get(p.municipality_id) : null;
  const url = p.kind === 'archaeology' ? archHref(slugify(p.name))
    : p.kind === 'museum' || p.kind === 'gallery' || p.kind === 'craft' ? dirUrl(p.name)
    : muni ? muniHref(muni.slug!) : null;
  return { ...p, description: p.description ? p.description.slice(0, 240) : null, url, route_id: IN_PLACES.has(p.kind) && p.coord && p.region ? p.id : null };
}

export const intelPlaces: IntelPlace[] = base.places.map(enrich).filter((p): p is IntelPlace => !!p);
export const intelMunicipalities = base.municipalities;
const eventSlugById = new Map(events.map((e) => [e.id, e.slug]));
/** Only events that have a page (SIC lists some festivals once per edition; portal.ts keeps one). */
export const intelEvents = base.events.filter((e) => eventSlugById.has(e.id)).map((e) => ({ ...e, url: eventHref(eventSlugById.get(e.id)!) }));

type ClimatePoint = { months: { rain_days: number; tmax_mean_c: number; tmin_mean_c: number }[] };
const climatePoints = climate.points as unknown as Record<string, ClimatePoint>;
export const intelClimate: IntelDataset['climate'] = Object.fromEntries(
  ['altiplano', 'centro', 'zona-media', 'huasteca'].map((r) => [r, climatePoints[r].months.map((m) => ({ rain_days: m.rain_days, tmax: m.tmax_mean_c, tmin: m.tmin_mean_c }))]),
);

/** The dataset the client loads (thumbnails resolved, so it is async). */
export async function intelDataset(): Promise<IntelDataset> {
  const places = await Promise.all(intelPlaces.map(async (p) => ({ ...p, image: p.image ? await thumbUrl(p.image, 640) : null })));
  return { generated: new Date().toISOString().slice(0, 10), places, municipalities: intelMunicipalities, events: intelEvents, climate: intelClimate };
}

/** Source registry by id, for "Fuentes" lines. */
export const sourceById = new Map(sourceRegistry.map((s) => [s.source_id, s]));

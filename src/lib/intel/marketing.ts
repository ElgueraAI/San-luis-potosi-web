/**
 * Smart marketing: how the segments could be used for campaigns.
 *
 * Two kinds of content, never mixed:
 *  - EVIDENCE, computed from the dataset: where the offer for a segment is
 *    (matching places per region), which little-exposed municipalities have
 *    that offer, and in which months an official source recommends it or an
 *    event takes place.
 *  - PROPOSAL, written by this project: message, channel and call to action.
 *    Every proposal is labelled "Propuesta estratégica". No campaign has run,
 *    so no reach, conversion or result figure appears anywhere.
 * Method: docs/smart-marketing-methodology.md.
 */
import { SEGMENTS, type Segment, type SegmentId } from './segments';
import type { IntelEvent, IntelPlace, MuniFeatures, ProfileInterest, RegionId } from './types';

export const PROPOSAL_LABEL = 'Propuesta estratégica';

export interface CampaignProposal {
  segment: SegmentId;
  /** Lead interest of the campaign. */
  interest: ProfileInterest;
  /** Region the proposal is written for (checked against the evidence). */
  region: RegionId;
  /** Season wording; `months` are the months it refers to. */
  season: string;
  months: number[];
  message: string;
  channel: string;
  /** Call to action and the site route key it points to. */
  cta: string;
  ctaRoute: 'discover' | 'myRoute' | 'events' | 'map' | 'seasons' | 'food' | 'museums' | 'routes';
}

/** Proposals only: wording, channel and CTA are this project's suggestions, not results. */
export const CAMPAIGNS: CampaignProposal[] = [
  { segment: 'explorador-natural', interest: 'agua', region: 'huasteca', season: 'Noviembre a marzo', months: [11, 12, 1, 2, 3],
    message: 'El agua turquesa tiene temporada: de noviembre a marzo.', channel: 'Video corto vertical y fotografía en redes visuales', cta: 'Arma tu ruta de cascadas', ctaRoute: 'discover' },
  { segment: 'explorador-natural', interest: 'naturaleza', region: 'zona-media', season: 'Todo el año', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    message: 'Manantiales y grutas a medio camino entre la capital y la Huasteca.', channel: 'Búsqueda: guías «qué hacer en Rioverde»', cta: 'Ver lugares cerca de tu recorrido', ctaRoute: 'myRoute' },
  { segment: 'aventurero', interest: 'aventura', region: 'huasteca', season: 'Noviembre a marzo', months: [11, 12, 1, 2, 3],
    message: 'Rema el Tampaón, baja a un sótano, salta una cascada. Con guía acreditado.', channel: 'Colaboración con operadores y guías acreditados; video de acción', cta: 'Descubre aventura a tu medida', ctaRoute: 'discover' },
  { segment: 'aventurero', interest: 'aventura', region: 'altiplano', season: 'Otoño y primavera', months: [3, 4, 5, 9, 10, 11],
    message: 'Roca, desierto y senderos del Altiplano, lejos del calor y del frío extremos.', channel: 'Comunidades de escalada y ciclismo de montaña', cta: 'Explora el mapa del Altiplano', ctaRoute: 'map' },
  { segment: 'viajero-cultural', interest: 'cultura', region: 'centro', season: 'Semana Santa y verano de festivales', months: [3, 4, 7, 8],
    message: 'Una capital que se camina: museos, teatro, procesión y festival.', channel: 'Agenda cultural por correo y medios de la ciudad', cta: 'Consulta el calendario de eventos', ctaRoute: 'events' },
  { segment: 'viajero-cultural', interest: 'cultura', region: 'huasteca', season: 'Octubre y noviembre', months: [10, 11],
    message: 'Xantolo: la fiesta de los muertos que se vive en comunidad.', channel: 'Relatos largos y fotografía documental, con las comunidades', cta: 'Conoce las fechas y su estado', ctaRoute: 'events' },
  { segment: 'explorador-patrimonial', interest: 'historia', region: 'altiplano', season: 'Otoño', months: [9, 10, 11],
    message: 'Además de Real de Catorce: otros pueblos mineros del Altiplano.', channel: 'Búsqueda y contenido de viaje en carretera', cta: 'Ver alternativas para descubrir', ctaRoute: 'myRoute' },
  { segment: 'explorador-patrimonial', interest: 'arqueologia', region: 'huasteca', season: 'Noviembre a marzo', months: [11, 12, 1, 2, 3],
    message: 'Tamtoc y Tamohí: la Huasteca antes de las cascadas.', channel: 'Alianza con el INAH y divulgación educativa', cta: 'Añade una zona arqueológica a tu ruta', ctaRoute: 'discover' },
  { segment: 'viajero-gastronomico', interest: 'gastronomia', region: 'centro', season: 'Todo el año', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    message: 'Enchiladas potosinas, cantera y sobremesa: cocina tradicional declarada patrimonio.', channel: 'Colaboración con cocineras tradicionales y medios gastronómicos', cta: 'Dónde comer, por municipio', ctaRoute: 'food' },
  { segment: 'viajero-gastronomico', interest: 'gastronomia', region: 'altiplano', season: 'Otoño e invierno', months: [10, 11, 12, 1],
    message: 'La ruta del mezcal potosino pasa por Charcas.', channel: 'Experiencias con productores; ferias gastronómicas', cta: 'Planea la ruta del mezcal', ctaRoute: 'routes' },
  { segment: 'explorador-de-pueblos', interest: 'pueblos-magicos', region: 'centro', season: 'Fines de semana, todo el año', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    message: 'Dos Pueblos Mágicos cerca de la capital, y un rebozo por ver nacer.', channel: 'Publicidad segmentada por ciudad emisora (capital, Querétaro, León)', cta: 'Optimiza tu ruta de pueblos', ctaRoute: 'myRoute' },
  { segment: 'explorador-de-pueblos', interest: 'pueblos-magicos', region: 'zona-media', season: 'Semana Santa', months: [3, 4],
    message: 'Ciudad del Maíz: un Pueblo Mágico de la Zona Media por descubrir.', channel: 'Contenido de creadores locales; prensa de viajes', cta: 'Descubre otros municipios', ctaRoute: 'discover' },
  { segment: 'viajero-familiar', interest: 'familia', region: 'zona-media', season: 'Vacaciones escolares', months: [4, 7, 8, 12],
    message: 'Agua clara y tranquila todo el año: la Media Luna en familia.', channel: 'Grupos y medios de familias; búsqueda «balnearios San Luis Potosí»', cta: 'Planea un viaje en familia', ctaRoute: 'discover' },
  { segment: 'viajero-familiar', interest: 'familia', region: 'centro', season: 'Todo el año', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    message: 'Museos interactivos y parques para una tarde sin prisa.', channel: 'Escuelas y agenda de fin de semana de la ciudad', cta: 'Museos y recintos culturales', ctaRoute: 'museums' },
  { segment: 'escapada-fin-de-semana', interest: 'relajacion', region: 'centro', season: 'Fines de semana, todo el año', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    message: 'Dos días, tres paradas, cero prisas: una ruta ya ordenada desde tu ciudad.', channel: 'Publicidad por ciudad emisora y por día de la semana (jueves y viernes)', cta: 'Optimiza mi viaje', ctaRoute: 'myRoute' },
  { segment: 'escapada-fin-de-semana', interest: 'relajacion', region: 'zona-media', season: 'Primavera y otoño', months: [3, 4, 5, 9, 10, 11],
    message: 'Sal el sábado, vuelve el domingo: manantiales y balnearios a mitad del estado.', channel: 'Boletín de escapadas y recordatorio de temporada', cta: 'Qué hacer esta temporada', ctaRoute: 'seasons' },
];

export interface SegmentEvidence {
  segment: Segment;
  /** Candidate places whose interests include the segment's defining interests, per region (observed). */
  placesByRegion: Record<RegionId, number>;
  total: number;
  topRegion: RegionId | null;
  /** Little-exposed municipalities that have matching places (derived indicator). */
  toPromote: { id: string; name: string; region: RegionId | null; places: number; exposure: number; potential: number }[];
  /** Months with an official season statement for matching places. */
  seasonMonths: number[];
  /** Events per month in municipalities that have matching places. */
  eventsByMonth: number[];
}

const REGION_IDS: RegionId[] = ['altiplano', 'centro', 'zona-media', 'huasteca'];

/**
 * A place belongs to the offer of a segment when it carries the defining interest or two of the
 * supporting ones. A segment defined by trip length has no defining interest: one supporting interest is enough.
 */
export function matchesSegment(p: IntelPlace, s: Segment): boolean {
  const entries = Object.entries(s.weights) as [ProfileInterest, number][];
  if (s.durations) return entries.some(([i]) => p.interests.includes(i));
  const lead = entries.filter(([, w]) => w >= 0.8).map(([i]) => i);
  if (lead.some((i) => p.interests.includes(i))) return true;
  return entries.filter(([i]) => p.interests.includes(i)).length >= 2;
}

export function segmentEvidence(places: IntelPlace[], municipalities: MuniFeatures[], events: IntelEvent[]): SegmentEvidence[] {
  const muniById = new Map(municipalities.map((m) => [m.id, m]));
  return SEGMENTS.map((segment) => {
    const match = places.filter((p) => matchesSegment(p, segment));
    const placesByRegion = Object.fromEntries(REGION_IDS.map((r) => [r, match.filter((p) => p.region === r).length])) as Record<RegionId, number>;
    const perMuni = new Map<string, number>();
    for (const p of match) if (p.municipality_id) perMuni.set(p.municipality_id, (perMuni.get(p.municipality_id) ?? 0) + 1);
    const toPromote = [...perMuni.entries()]
      .map(([id, n]) => ({ m: muniById.get(id), n }))
      .filter((x): x is { m: MuniFeatures; n: number } => !!x.m && x.m.exposure_proxy < 0.4 && x.m.infrastructure_index >= 0.15)
      .sort((a, b) => b.n * b.m.diversification_potential - a.n * a.m.diversification_potential)
      .slice(0, 4)
      .map(({ m, n }) => ({ id: m.id, name: m.name, region: m.region, places: n, exposure: m.exposure_proxy, potential: m.diversification_potential }));
    const seasonMonths = [...new Set(match.flatMap((p) => (p.recommended_months && p.recommended_months.length < 12 ? p.recommended_months : [])))].sort((a, b) => a - b);
    const eventsByMonth = Array.from({ length: 12 }, (_, i) => events.filter((e) => e.municipality_id && perMuni.has(e.municipality_id) && e.months.includes(i + 1) && e.date_confidence !== 'unknown').length);
    const top = REGION_IDS.filter((r) => placesByRegion[r] > 0).sort((a, b) => placesByRegion[b] - placesByRegion[a])[0] ?? null;
    return { segment, placesByRegion, total: match.length, topRegion: top, toPromote, seasonMonths, eventsByMonth };
  });
}

/** A proposal is consistent when the dataset has matching offer in its region. Used by tests and by the page. */
export function campaignSupport(c: CampaignProposal, evidence: SegmentEvidence[]): number {
  return evidence.find((e) => e.segment.id === c.segment)?.placesByRegion[c.region] ?? 0;
}

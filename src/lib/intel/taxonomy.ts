/**
 * Taxonomy: the visitor's twelve interests and how the research layer's own
 * vocabulary maps onto them.
 *
 * Two kinds of mapping, kept apart on purpose:
 *  - TAG_MAP: editorial interest tags written by the research layer for the
 *    63 destinations. An interest that comes from here is "stated".
 *  - KIND_RULES: interests implied by an official type or subcategory (SIC,
 *    INAH, DENUE) for records that carry no tags. These are "derived" and the
 *    UI says so.
 */
import type { Budget, Duration, IntelKind, ProfileInterest, TravelMode } from './types';

export const INTEREST_LABEL: Record<ProfileInterest, string> = {
  naturaleza: 'Naturaleza',
  agua: 'Cascadas y agua',
  aventura: 'Aventura',
  cultura: 'Cultura',
  historia: 'Historia',
  arqueologia: 'Arqueología',
  gastronomia: 'Gastronomía',
  'pueblos-magicos': 'Pueblos Mágicos',
  arte: 'Arte',
  fotografia: 'Fotografía',
  relajacion: 'Relajación',
  familia: 'Familia',
};
export const INTERESTS = Object.keys(INTEREST_LABEL) as ProfileInterest[];

/** Research-layer tag → profile interests. A tag missing here maps to nothing. */
export const TAG_MAP: Record<string, ProfileInterest[]> = {
  naturaleza: ['naturaleza'], paisaje: ['naturaleza', 'fotografia'], desierto: ['naturaleza'], aves: ['naturaleza'], cuevas: ['naturaleza', 'aventura'],
  agua: ['agua'], cascadas: ['agua'], natacion: ['agua', 'relajacion'], buceo: ['agua', 'aventura'], 'aguas-termales': ['agua', 'relajacion'],
  aventura: ['aventura'], kayak: ['aventura', 'agua'], rafting: ['aventura', 'agua'], espeleologia: ['aventura'], escalada: ['aventura'],
  ciclismo: ['aventura'], cabalgata: ['aventura'], paddle: ['aventura', 'agua'], campismo: ['aventura', 'naturaleza'], senderismo: ['aventura', 'naturaleza'],
  'cultura-viva': ['cultura'], tradiciones: ['cultura'], xantolo: ['cultura'], 'cultura-teenek': ['cultura'], 'xi-iuy': ['cultura'],
  fe: ['cultura'], peregrinacion: ['cultura'], 'sitio-sagrado': ['cultura'], artesania: ['cultura', 'arte'], textiles: ['cultura', 'arte'],
  patrimonio: ['historia'], historia: ['historia'], mineria: ['historia'], haciendas: ['historia'], ferrocarril: ['historia'],
  arquitectura: ['historia', 'arte'], barroco: ['historia', 'arte'],
  arqueologia: ['arqueologia', 'historia'],
  gastronomia: ['gastronomia'], cafe: ['gastronomia'], agroturismo: ['gastronomia'],
  'pueblos-magicos': ['pueblos-magicos'],
  arte: ['arte'], surrealismo: ['arte'], museos: ['arte', 'cultura'], muralismo: ['arte'], 'artes-escenicas': ['arte', 'cultura'],
  fotografia: ['fotografia'],
  familia: ['familia'], paseo: ['relajacion', 'familia'],
};

/** Interests implied by the record's official type; every one of them is reported as derived. */
export function kindInterests(kind: IntelKind, subcategory: string | null): ProfileInterest[] {
  const s = (subcategory ?? '').toLowerCase();
  switch (kind) {
    case 'archaeology': return ['arqueologia', 'historia', 'cultura'];
    case 'museum':
      if (/arte/.test(s)) return ['arte', 'cultura'];
      if (/arqueolog|antropolog/.test(s)) return ['arqueologia', 'historia', 'cultura'];
      if (/historia/.test(s)) return ['historia', 'cultura'];
      if (/ciencia/.test(s)) return ['cultura', 'familia'];
      return ['cultura'];
    case 'protected-area': return /sagrado/.test(s) ? ['naturaleza', 'cultura'] : ['naturaleza'];
    case 'religious-landmark': return ['historia', 'cultura'];
    case 'heritage': return ['cultura', 'historia'];
    case 'gallery': return ['arte'];
    case 'craft': return ['cultura', 'arte'];
    case 'recreation': return /balneario|acu[aá]tico/.test(s) ? ['agua', 'relajacion', 'familia'] : ['naturaleza'];
    default: return [];
  }
}

/** Mostly outdoors? Only decides whether rain is relevant. null = cannot tell. */
export function isOutdoor(kind: IntelKind, interests: ProfileInterest[]): boolean | null {
  if (kind === 'museum' || kind === 'gallery' || kind === 'craft') return false;
  if (kind === 'protected-area' || kind === 'archaeology' || kind === 'recreation') return true;
  if (interests.some((i) => i === 'naturaleza' || i === 'agua' || i === 'aventura')) return true;
  if (kind === 'destination') return null;
  return false;
}

export const KIND_LABEL: Record<IntelKind, string> = {
  destination: 'Destino', archaeology: 'Zona arqueológica', museum: 'Museo', 'protected-area': 'Área natural protegida',
  'religious-landmark': 'Catedral', heritage: 'Patrimonio declarado', gallery: 'Galería', craft: 'Casa de artesanía', recreation: 'Balneario',
};

export const DURATIONS: { id: Duration; label: string; hours: number }[] = [
  { id: 'half-day', label: 'Medio día', hours: 5 },
  { id: 'day', label: '1 día', hours: 10 },
  { id: 'two-days', label: '2 días', hours: 20 },
  { id: 'weekend', label: 'Fin de semana', hours: 22 },
  { id: 'long', label: '3 a 5 días', hours: 40 },
];
export const BUDGETS: { id: Budget; label: string }[] = [
  { id: 'economico', label: 'Económico' }, { id: 'medio', label: 'Medio' }, { id: 'flexible', label: 'Flexible' },
];
export const MODES: { id: TravelMode; label: string }[] = [
  { id: 'car', label: 'Auto' }, { id: 'foot', label: 'A pie' }, { id: 'bike', label: 'Bicicleta' },
];

/**
 * Comfortable reach (km, straight line from the origin) for a trip length and
 * travel mode. An assumption of this project, stated in the UI and in
 * docs/recommendation-engine.md: about a third of the available hours on the
 * road at a mean speed of 60 km/h by car, 14 km/h by bicycle, 4.5 km/h on foot.
 */
export function reachKm(duration: Duration, mode: TravelMode): number {
  const hours = DURATIONS.find((d) => d.id === duration)?.hours ?? 10;
  const speed = mode === 'car' ? 60 : mode === 'bike' ? 14 : 4.5;
  return Math.round((hours / 3) * speed);
}

export const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const REGION_LABEL: Record<string, string> = { altiplano: 'Altiplano', centro: 'Centro', 'zona-media': 'Zona Media', huasteca: 'Huasteca' };
export const SEASON_OF = (month: number): 'primavera' | 'verano' | 'otoño' | 'invierno' =>
  month >= 3 && month <= 5 ? 'primavera' : month >= 6 && month <= 8 ? 'verano' : month >= 9 && month <= 11 ? 'otoño' : 'invierno';

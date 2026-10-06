/**
 * Suggested routes. Editorial sequences of verified destinations; every
 * distance and time is a row of an official brochure table (brochure-tables.json,
 * referenced by fact id) and is shown as approximate. Where two brochures
 * disagree on a time, only the distance both agree on is shown.
 */
import type { RegionId } from './research';

export type Leg = { fact: string; kmOnly?: boolean };
export type Day = { title: string; stops: string[]; legs?: Leg[]; note?: string };
export type Itinerary = {
  id: string;
  label: string;
  title: string;
  duration: string;
  regions: RegionId[];
  summary: string;
  image: string;
  stops: string[];
  days: Day[];
};

export const ITINERARIES: Itinerary[] = [
  {
    id: 'fin-de-semana',
    label: 'Fin de semana',
    title: 'La capital, a pie y en cantera',
    duration: '2 días · 1 noche',
    regions: ['centro'],
    summary: 'Plazas, templos y teatro en el Centro Histórico; al día siguiente, el real de minas que dio origen a la ciudad.',
    image: 'wc-63495269',
    stops: ['C01', 'C03', 'C05', 'C08', 'C10'],
    days: [
      { title: 'Centro Histórico', stops: ['C01', 'C03', 'C05', 'C08'], note: 'Se recorre a pie; el Museo Leonora Carrington está dentro del Centro de las Artes.' },
      { title: 'Cerro de San Pedro', stops: ['C10'], legs: [{ fact: 'bt-047' }] },
    ],
  },
  {
    id: 'dos-dias',
    label: '2 días',
    title: 'Real de Catorce y el desierto',
    duration: '2 días · Altiplano',
    regions: ['altiplano'],
    summary: 'Desde Matehuala, el camino sube a la sierra y entra al pueblo por el Túnel de Ogarrio. Al día siguiente, la sierra a caballo y la estación en el llano.',
    image: 'wc-119874435',
    stops: ['A06', 'A02', 'A01', 'A04'],
    days: [
      { title: 'Matehuala a Real de Catorce', stops: ['A06', 'A02', 'A01'], legs: [{ fact: 'bt-033' }] },
      { title: 'La sierra', stops: ['A04'], note: 'Recorridos a caballo o en vehículos Willys por los alrededores, según la información oficial del destino.' },
    ],
  },
  {
    id: 'tres-dias',
    label: '3 días',
    title: 'Huasteca de agua',
    duration: '3 días · Huasteca',
    regions: ['huasteca'],
    summary: 'Tres días con base en Ciudad Valles: las siete cascadas de Micos, la panga hacia Tamul y las pozas de Tamasopo.',
    image: 'wc-45072553',
    stops: ['H17', 'H12', 'H01', 'H02', 'H10', 'H11'],
    days: [
      { title: 'Ciudad Valles y Micos', stops: ['H17', 'H12'], legs: [{ fact: 'bt-004' }] },
      { title: 'Tamul por el Tampaón', stops: ['H01', 'H02'], legs: [{ fact: 'bt-012' }], note: 'La mejor temporada para apreciar la cascada es de noviembre a marzo (folleto oficial).' },
      { title: 'Tamasopo', stops: ['H10', 'H11'], legs: [{ fact: 'bt-009' }, { fact: 'bt-010' }] },
    ],
  },
  {
    id: 'cinco-dias',
    label: '5 días',
    title: 'La Huasteca completa',
    duration: '5 días · Huasteca',
    regions: ['huasteca'],
    summary: 'Agua, sótanos, surrealismo y arqueología: de las cascadas a Xilitla y a la antigua ciudad de Tamtoc.',
    image: 'wc-98005525',
    stops: ['H17', 'H12', 'H01', 'H06', 'H04', 'H07', 'H08', 'H16'],
    days: [
      { title: 'Ciudad Valles y Micos', stops: ['H17', 'H12'], legs: [{ fact: 'bt-004' }] },
      { title: 'Cascada de Tamul', stops: ['H01'], legs: [{ fact: 'bt-012' }] },
      { title: 'Aquismón y el Sótano de las Golondrinas', stops: ['H06', 'H04'], legs: [{ fact: 'bt-011' }, { fact: 'bt-016' }], note: 'Las aves se observan al amanecer y al caer la tarde.' },
      { title: 'Xilitla y Las Pozas', stops: ['H07', 'H08'], legs: [{ fact: 'bt-019' }] },
      { title: 'Tamtoc', stops: ['H16'], legs: [{ fact: 'bt-023' }] },
    ],
  },
  {
    id: 'road-trip',
    label: 'Road trip',
    title: 'El descenso: las cuatro regiones',
    duration: '6 días o más · 4 regiones',
    regions: ['altiplano', 'centro', 'zona-media', 'huasteca'],
    summary: 'La línea del terreno convertida en viaje: del desierto alto a la capital, al manantial y a la selva.',
    image: 'wc-45072511',
    stops: ['A01', 'C01', 'M01', 'H17', 'H01', 'H07'],
    days: [
      { title: 'Real de Catorce', stops: ['A01'], legs: [{ fact: 'bt-033' }] },
      { title: 'A la capital', stops: ['C01'], legs: [{ fact: 'bt-030', kmOnly: true }], note: 'Los folletos oficiales coinciden en la distancia y difieren en el tiempo estimado.' },
      { title: 'Rioverde y la Media Luna', stops: ['M01'], legs: [{ fact: 'bt-044' }, { fact: 'bt-064' }] },
      { title: 'A la Huasteca', stops: ['H17', 'H01'], legs: [{ fact: 'bt-060' }, { fact: 'bt-012' }] },
      { title: 'Xilitla', stops: ['H07'], legs: [{ fact: 'bt-018' }] },
    ],
  },
];

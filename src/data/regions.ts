/**
 * Regional editorial layer. Words here are authored (identity, intro) and make
 * no factual claim beyond what the research records verify; every number and
 * place comes from src/data/research.ts.
 */
import type { RegionId } from './research';

export type ManualSlot = {
  slot: string;
  label: string;
  ratio: string;
  subject: string;
  kind: 'photo' | 'video';
};

export type RegionMeta = {
  id: RegionId;
  slug: string;
  name: string;
  /** Inside a sentence: "Explora el Altiplano". */
  nameIn: string;
  officialName: string;
  identity: string;
  intro: string[];
  light: string;
  hub: string;
  weatherKey: string;
  brochure: string;
  map: string;
  hero: { id: string | null; mobile: string | null; manual?: ManualSlot; manualMobile?: ManualSlot; video?: ManualSlot };
  card: string;
  landscape: string | null;
  detail: string | null;
  culture: string | null;
  highlights: string[];
  keywords: string[];
};

export const REGIONS: RegionMeta[] = [
  {
    id: 'altiplano',
    slug: 'altiplano',
    name: 'Altiplano',
    nameIn: 'el Altiplano',
    officialName: 'Región Altiplano',
    identity: 'El desierto alto: reales de minas, sierra y un horizonte que no termina.',
    intro: [
      'El norte del estado es semidesierto y sierra. Aquí la línea del terreno empieza alta: Real de Catorce se alcanza cruzando un túnel abierto en la roca, y alrededor quedan pueblos que crecieron con la plata.',
      'Matehuala es la ciudad base; Charcas, Guadalcázar, Venado y Salinas guardan cantera, minas y ferrocarril.',
    ],
    light: 'Amanecer',
    hub: 'Matehuala',
    weatherKey: 'altiplano',
    brochure: 'pdf-brochure-altiplano',
    map: 'map-altiplano',
    hero: {
      id: 'wc-69780780',
      mobile: null,
      manualMobile: { slot: 'altiplano-hero-mobile', label: 'Altiplano · Hero móvil', ratio: '9:16', subject: 'Calle empedrada de Real de Catorce con la torre de la parroquia, a la hora dorada.', kind: 'photo' },
      video: { slot: 'vid-transition-altiplano', label: 'Altiplano · Video', ratio: '16:9', subject: 'Vista aérea alejándose de los techos de Real de Catorce hacia la sierra.', kind: 'video' },
    },
    card: 'wc-119874435',
    landscape: 'wc-42373253',
    detail: 'wc-145400200',
    culture: null,
    highlights: ['A01', 'A06', 'A08', 'A12'],
    keywords: ['desierto', 'minería', 'sierra', 'silencio'],
  },
  {
    id: 'centro',
    slug: 'centro',
    name: 'Centro',
    nameIn: 'el Centro',
    officialName: 'Región Centro',
    identity: 'Cantera rosa, barroco y una capital que se recorre a pie.',
    intro: [
      'La capital potosina y sus alrededores: plazas, templos y teatros en el Centro Histórico, el arte de Leonora Carrington en el Centro de las Artes y, a pocos kilómetros, el antiguo real de minas de Cerro de San Pedro.',
      'Al sur, Santa María del Río teje rebozos con ikat y telar de cintura.',
    ],
    light: 'Mañana',
    hub: 'Capital (San Luis Potosí)',
    weatherKey: 'centro',
    brochure: 'pdf-brochure-centro',
    map: 'map-centro',
    hero: {
      id: 'wc-21525423',
      mobile: 'wc-81112902',
      video: { slot: 'vid-transition-centro', label: 'Centro · Video', ratio: '16:9', subject: 'Recorrido aéreo a la hora azul sobre el Centro Histórico mientras se encienden las luces.', kind: 'video' },
    },
    card: 'wc-77789645',
    landscape: 'wc-50604767',
    detail: 'wc-75414140',
    culture: 'wc-58139975',
    highlights: ['C01', 'C08', 'C10', 'C11'],
    keywords: ['barroco', 'arte', 'rebozo', 'cantera'],
  },
  {
    id: 'zona-media',
    slug: 'zona-media',
    name: 'Zona Media',
    nameIn: 'la Zona Media',
    officialName: 'Región Media',
    identity: 'Manantiales, huertas y pueblos de agua clara.',
    intro: [
      'Entre el altiplano y la sierra, la Región Media es agua: el manantial de la Media Luna, parque estatal donde se nada y se bucea todo el año, y una cuenca agrícola alrededor de Rioverde.',
      'Ciudad Fernández, Ciudad del Maíz y las comunidades xi’iuy guardan una historia larga y tradiciones vivas.',
    ],
    light: 'Mediodía',
    hub: 'Rioverde',
    weatherKey: 'zona-media',
    brochure: 'pdf-brochure-media',
    map: 'map-media',
    hero: {
      id: 'wc-76389273',
      mobile: null,
      manual: { slot: 'zona-media-hero', label: 'Media Luna · Hero escritorio', ratio: '16:9', subject: 'Vista aérea o elevada del manantial de la Media Luna con su agua turquesa y la vegetación.', kind: 'photo' },
      manualMobile: { slot: 'zona-media-hero-mobile', label: 'Media Luna · Hero móvil', ratio: '9:16', subject: 'Toma subacuática o cenital del manantial.', kind: 'photo' },
      video: { slot: 'vid-transition-media', label: 'Zona Media · Video', ratio: '16:9', subject: 'Descenso cenital lento sobre la Media Luna.', kind: 'video' },
    },
    card: 'wc-43657425',
    landscape: 'wc-76389273',
    detail: 'wc-43619684',
    culture: 'wc-145121025',
    highlights: ['M01', 'M02', 'M09', 'M14'],
    keywords: ['manantiales', 'huertas', 'historia', "xi'iuy"],
  },
  {
    id: 'huasteca',
    slug: 'huasteca',
    name: 'Huasteca',
    nameIn: 'la Huasteca',
    officialName: 'Región Huasteca',
    identity: 'Selva, ríos turquesa y cascadas. Fuerza, aventura y culturas vivas.',
    intro: [
      'Al final del descenso la tierra se vuelve selva y el agua manda. Cascadas que caen sobre ríos turquesa, sótanos donde las aves salen al amanecer y pueblos donde todavía se habla tének y náhuatl.',
      'Ciudad Valles es la puerta; Aquismón, Xilitla, Tamasopo y El Naranjo, los caminos.',
    ],
    light: 'Tarde',
    hub: 'Ciudad Valles',
    weatherKey: 'huasteca',
    brochure: 'pdf-brochure-huasteca',
    map: 'map-huasteca',
    hero: {
      id: 'wc-48806929',
      mobile: 'px-14842050',
      video: { slot: 'vid-huasteca-hero', label: 'Huasteca · Video de portada', ratio: '16:9', subject: 'Las Pozas en la niebla: avance lento entre la selva hacia una escalera o arco de concreto.', kind: 'video' },
    },
    card: 'wc-29767255',
    landscape: 'wc-45072511',
    detail: 'wc-48806880',
    culture: 'wc-128308393',
    highlights: ['H01', 'H08', 'H10', 'H16'],
    keywords: ['selva', 'agua', 'aventura', 'cultura tének'],
  },
];

export const regionMeta = (id: RegionId) => REGIONS.find((r) => r.id === id)!;
export const REGION_NAME: Record<RegionId, string> = {
  altiplano: 'Altiplano', centro: 'Centro', 'zona-media': 'Zona Media', huasteca: 'Huasteca',
};

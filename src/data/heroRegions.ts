import type { RegionId } from './research';

/** Regional clips require reviewed rights and verified geographic chapters.
 * Those regional slots remain null. The owned travel reel below is separate.
 * Paths are relative to public/ and resolved through BASE_URL. */
export interface HeroVideo {
  rightsReviewed: true;
  author: string;
  title: string;
  sourceUrl: string;
  licence: string;
  licenceUrl: string;
  sources: { path: string; type: 'video/webm' | 'video/mp4' }[];
}

export interface HeroRegion {
  id: RegionId;
  name: string;
  place: string;
  description: string;
  photo: string;
  focal: string;
  mobileFocal: string;
  video: HeroVideo | null;
}

/** The owner supplied the original and confirmed ownership in this chat.
 * This is one travel reel, not four verified geographic video chapters. */
export const HERO_REEL = {
  rightsReviewed: true,
  title: 'San Luis Potosí, CHINGON',
  author: 'Material del propietario',
  licence: 'Uso autorizado por su titular',
  poster: 'media/hero-original-1080p-poster.png',
  sources: [
    { path: 'media/hero-original-1080p.mp4', type: 'video/mp4', media: 'all' },
  ],
};

export const HERO_REGIONS: HeroRegion[] = [
  {
    id: 'altiplano', name: 'Altiplano', place: 'Real de Catorce',
    description: 'La sierra, los antiguos reales de minas y el horizonte del desierto.',
    photo: 'wc-69780780', focal: '50% 62%', mobileFocal: '43% 62%', video: null,
  },
  {
    id: 'centro', name: 'Centro', place: 'Templo de Loreto · Plaza Fundadores',
    description: 'Plazas y patrimonio de cantera para descubrir a otra velocidad.',
    photo: 'wc-63495269', focal: '50% 42%', mobileFocal: '42% 42%', video: null,
  },
  {
    id: 'zona-media', name: 'Zona Media', place: 'Manantial de la Media Luna',
    description: 'El agua y sus reflejos abren otra forma de explorar el estado.',
    photo: 'wc-76389273', focal: '50% 54%', mobileFocal: '48% 54%', video: null,
  },
  {
    id: 'huasteca', name: 'Huasteca', place: 'Cascada de Tamul',
    description: 'Agua turquesa y paredes de roca en el cañón del río Tampaón.',
    photo: 'wc-48806929', focal: '50% 48%', mobileFocal: '45% 48%', video: null,
  },
];

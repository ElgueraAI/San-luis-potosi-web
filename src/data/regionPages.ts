/**
 * Region-page editorial extras. Huasteca is the first complete regional
 * experience (research/media-registry/huasteca-asset-manifest.json). Every
 * fact line points to a verified record or a brochure fact id; the prose
 * around it is authored and makes no new claim.
 */
import type { RegionId } from './research';
import type { ManualSlot } from './regions';

export type Feature = {
  id: string;
  label: string;
  title: string;
  lede: string;
  places: string[];
  images: { id?: string; ratio: string; manual?: ManualSlot }[];
  /** brochure fact ids for distances from the regional hub */
  legs?: string[];
  /** extra brochure facts rendered as figures */
  figures?: { label: string; value: string; source: string }[];
  note?: string;
};

export type Reason = { title: string; text: string; image: string };
export type Story = { title: string; text: string; image: string; place: string };

export type RegionExtras = {
  reasons?: Reason[];
  features?: Feature[];
  more?: string[];
  culture?: {
    lede: string;
    items: { title: string; text: string; image?: string; manual?: ManualSlot; source: string }[];
  };
  gastronomy?: { image?: string; manual?: ManualSlot };
  stories?: Story[];
  close?: { image: string; title: string; body: string; video?: string };
};

export const REGION_EXTRAS: Partial<Record<RegionId, RegionExtras>> = {
  huasteca: {
    reasons: [
      { title: 'Ríos turquesa', text: 'El Tampaón se recorre en panga y en kayak hasta la caída de Tamul.', image: 'wc-45072553' },
      { title: 'Surrealismo en la selva', text: 'Las Pozas: treinta hectáreas de vegetación con treinta y seis estructuras.', image: 'wc-29767259' },
      { title: 'Cascadas para nadar', text: 'Minas Viejas, El Meco, Micos y Tamasopo: pozas, saltos y miradores.', image: 'wc-98007105' },
      { title: 'Culturas vivas', text: 'Pueblos donde se hablan tének y náhuatl, con máscaras, danzas y Xantolo.', image: 'wc-128308393' },
    ],
    features: [
      {
        id: 'tamul',
        label: 'Aquismón',
        title: 'Cascada de Tamul',
        lede: 'El ícono de la Huasteca: una caída de 105 metros al fondo de un cañón. Se llega remontando el río Tampaón en panga, entre paredes de roca y agua turquesa.',
        places: ['H01', 'H02'],
        images: [{ id: 'wc-48806880', ratio: '16/9' }, { id: 'px-11775031', ratio: '4/5' }],
        legs: ['bt-012', 'bt-013'],
        note: 'La mejor temporada para apreciarla es de noviembre a marzo, según el folleto oficial. Usa siempre chaleco salvavidas.',
      },
      {
        id: 'xilitla',
        label: 'Xilitla',
        title: 'Xilitla y Las Pozas',
        lede: 'Un Pueblo Mágico de niebla, selva y café. Aquí Edward James, poeta y mecenas del surrealismo, levantó Las Pozas: estructuras de concreto que la selva fue envolviendo.',
        places: ['H08', 'H07', 'H09'],
        images: [{ id: 'wc-29767255', ratio: '16/10' }, { id: 'wc-2003803', ratio: '4/5' }, { id: 'wc-112989200', ratio: '4/3' }],
        legs: ['bt-019', 'bt-018'],
        figures: [
          { label: 'hectáreas de jardín', value: '30', source: 'bt-119' },
          { label: 'estructuras surrealistas', value: '36', source: 'bt-119' },
          { label: 'de cascada', value: '37 m', source: 'bt-119' },
        ],
      },
      {
        id: 'tamasopo',
        label: 'Tamasopo',
        title: 'Tamasopo y Puente de Dios',
        lede: 'Cascadas de aguas cristalinas y pozas tranquilas, y muy cerca, Puente de Dios: pozas de azul profundo con una caverna y un puente natural de roca.',
        places: ['H10', 'H11'],
        images: [
          { id: 'wc-6172324', ratio: '16/10' },
          { id: 'wc-45072628', ratio: '4/3' },
          { ratio: '4/3', manual: { slot: 'hua-tamasopo-hero', label: 'Tamasopo · Hero 16:9', ratio: '4:3', subject: 'Vista amplia de las Cascadas de Tamasopo con sus pozas y personas pequeñas en el encuadre, por la mañana.', kind: 'photo' } },
        ],
        legs: ['bt-009', 'bt-010'],
      },
    ],
    more: ['H12', 'H13', 'H14', 'H15', 'H04', 'H05', 'H16', 'H06', 'H17'],
    culture: {
      lede: 'La Huasteca potosina es tének y nahua. Sus fiestas, sus máscaras y su manera de recordar a los muertos son parte del viaje: obsérvalas con respeto y pide permiso antes de fotografiar.',
      items: [
        { title: 'Máscaras', text: 'Semana Santa y Xantolo son de las temporadas más importantes de la Huasteca, con fiestas, máscaras y altares tradicionales. En la imagen, una máscara de huehue de Xilitla.', image: 'wc-128308393', source: 'brochure-huasteca' },
        { title: 'Xantolo', text: 'El Día de Muertos de la Huasteca: altares tradicionales, comparsas y danzas. Las fechas oficiales de 2025 fueron del 29 de octubre al 2 de noviembre; las de 2026 aún no se confirman.', manual: { slot: 'hua-xantolo', label: 'Xantolo · Cultura', ratio: '16:9', subject: 'Altar con arco de cempasúchil o comparsa con máscaras en la Huasteca potosina, con permiso de la comunidad.', kind: 'photo' }, source: 'slp-gob-xantolo-2025' },
        { title: 'Pueblo tének', text: 'En Aquismón aún se hablan tének, náhuatl y xi’iui. En Tancanhuitz, los Voladores de Tamaletom ejecutan la Danza del Gavilán, reconocida por la UNESCO como Patrimonio Intangible.', manual: { slot: 'hua-teenek', label: 'Tének · Comunidad', ratio: '4:5', subject: 'Bordado tének, mercado o retrato comunitario, con consentimiento informado.', kind: 'photo' }, source: 'brochure-huasteca' },
      ],
    },
    gastronomy: { image: 'wc-105308560', manual: { slot: 'hua-gastronomy', label: 'Gastronomía huasteca', ratio: '1:1', subject: 'Zacahuil, bocoles, enchiladas huastecas o huevos enhojados: vista cenital y a 45°, luz natural.', kind: 'photo' } },
    stories: [
      { title: 'El lugar de las nubes de agua', text: 'Eso significa Tamtoc en tének. La antigua ciudad tuvo comercio fluvial, pirámides, monolitos, estelas y pintura mural; hoy se visita sin costo.', image: 'wc-30478452', place: 'H16' },
      { title: 'Las aves salen al amanecer', text: 'En el Sótano de las Golondrinas, loros y vencejos entran y salen de la sima al amanecer y al caer la tarde.', image: 'wc-2005486', place: 'H04' },
      { title: 'Siete cascadas, un río', text: 'Las Cascadas de Pago Pago, en el río Micos, encadenan siete caídas de dos a veinte metros: rafting, kayak y saltos.', image: 'wc-98005522', place: 'H12' },
    ],
    close: { image: 'wc-45072553', title: 'El río sigue.', body: 'La Huasteca se recorre despacio: por agua, por la sierra y por sus pueblos. Guarda tus lugares y arma la ruta.', video: 'vid-tamul-descent' },
  },
};

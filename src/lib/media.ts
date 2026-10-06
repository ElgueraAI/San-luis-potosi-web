import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import lib from '@/data/generated/media.json';
import { REGION_NAME } from '@/data/regions';

export type MediaRecord = (typeof lib.assets)[keyof typeof lib.assets];
const records = lib.assets as Record<string, MediaRecord>;

/** Every production derivative (scripts/media/build-media.mjs output). */
const files = import.meta.glob<{ default: ImageMetadata }>('/src/assets/media/*.webp', { eager: true });

export function mediaRecord(id: string | null | undefined): MediaRecord | null {
  return (id && records[id]) || null;
}

export function mediaImage(id: string | null | undefined): ImageMetadata | null {
  const rec = mediaRecord(id);
  if (!rec) return null;
  return files[`/src/assets/media/${rec.file}`]?.default ?? null;
}

/**
 * Alt text written from what the photograph shows (checked on the contact
 * sheets), not from file titles. Anything else falls back to place + region.
 */
const ALT: Record<string, string> = {
  'wc-69780780': 'Real de Catorce extendido en su valle entre las montañas de la Sierra de Catorce',
  'wc-119874435': 'Real de Catorce visto desde el Pueblo Fantasma, con la sierra al fondo',
  'wc-119874344': 'Techos y parroquia de Real de Catorce entre muros de piedra',
  'wc-12418759': 'Entrada de piedra al Túnel de Ogarrio',
  'wc-32558730': 'Laderas áridas de la Sierra de Catorce',
  'wc-52774850': 'Camino recto entre yucas y matorral rumbo a Estación Catorce',
  'wc-145400197': 'Vías del tren en el llano de Estación Catorce',
  'wc-42373253': 'Yucas y matorral del semidesierto potosino bajo un cielo claro',
  'wc-145400200': 'Detalle de una biznaga entre piedras del desierto',
  'wc-43679590': 'Fachada de la Catedral de la Inmaculada Concepción de Matehuala',
  'wc-182004799': 'Vista aérea de Matehuala con su catedral',
  'wc-72428429': 'Fachada barroca del templo de la Purísima Concepción en Guadalcázar',
  'wc-43653605': 'Edificio rojo de la Presidencia Municipal de Guadalcázar',
  'wc-66038963': 'Antigua estación de tren de piedra en Charcas',
  'wc-48544817': 'Escultura de un venado frente a la torre de la parroquia de Venado',
  'wc-21525423': 'Catedral y Plaza de Armas de San Luis Potosí',
  'wc-81112902': 'Torre y fachada labrada del Templo del Carmen',
  'wc-77789645': 'Templo del Carmen de San Luis Potosí con su cúpula de azulejo',
  'wc-21525467': 'Plaza del Carmen con su fuente y el Templo del Carmen',
  'wc-75414140': 'Retablo barroco policromado del Templo del Carmen',
  'wc-63495269': 'Templo de Loreto y Plaza Fundadores en el Centro Histórico',
  'wc-50604762': 'Catedral de San Luis Potosí iluminada de noche',
  'wc-30504652': 'Teatro de la Paz con su cúpula y columnas',
  'wc-28794550': 'Frontón y cúpula del Teatro de la Paz contra el cielo azul',
  'wc-41833060': 'Sala principal del Teatro de la Paz vista desde los palcos',
  'wc-108267867': 'Columnata del Teatro de la Paz reflejada en el agua',
  'wc-147096098': 'Patio rojo del Centro de las Artes de San Luis Potosí',
  'wc-147096090': 'Columna pintada en el Centro de las Artes',
  'wc-147096089': 'Pasillo entre altos muros de piedra de la antigua penitenciaría',
  'wc-79606411': 'Escultura de grullas de Leonora Carrington en el patio del museo',
  'wc-81089617': 'Escultura de una barca con grullas en el Museo Leonora Carrington',
  'wc-50604767': 'Panorámica de Cerro de San Pedro entre cerros verdes',
  'wc-50604761': 'Calle empedrada con casas de adobe en Cerro de San Pedro',
  'wc-158635553': 'Calle de Cerro de San Pedro con su templo al fondo',
  'wc-50604759': 'Muro antiguo de una casa en Cerro de San Pedro',
  'wc-58118619': 'Patio con arcos de una casona en Santa María del Río',
  'wc-58139974': 'Caja de madera con marquetería y un rebozo',
  'wc-58139971': 'Rebozo de seda gris con su textura de ikat',
  'wc-58139975': 'Rebozo morado y negro tejido en telar',
  'px-14842050': 'La Cascada de Tamul cayendo en el cañón del río Tampaón',
  'px-11775031': 'Kayaks en el río Tampaón frente a la Cascada de Tamul',
  'wc-48806929': 'La Cascada de Tamul vista desde el río, entre paredes de roca',
  'wc-45072519': 'La Cascada de Tamul y el río entre rocas',
  'wc-48806880': 'Vista aérea del borde de la Cascada de Tamul sobre la selva',
  'wc-45072511': 'Cañón del río Tampaón con agua turquesa y vegetación',
  'wc-45072553': 'Proa de una panga avanzando por el río Tampaón',
  'wc-45072509': 'Paredes de roca blanca del cañón del Tampaón',
  'wc-2008166': 'Espeleólogos descendiendo por cuerda en la boca del Sótano de las Golondrinas',
  'wc-2005486': 'Boca del Sótano de las Golondrinas cubierta de vegetación',
  'wc-66633932': 'Paredes de roca y vegetación en la Hoya de las Huahuas',
  'wc-52606453': 'Río turquesa y montañas en Aquismón',
  'wc-21612508': 'Templo de San Miguel Arcángel en Aquismón',
  'wc-128308393': 'Máscara roja de huehue tallada en Xilitla',
  'wc-112989200': 'Montañas verdes de la sierra alrededor de Xilitla',
  'wc-29767255': 'Estructuras surrealistas cubiertas de musgo entre la selva en Las Pozas',
  'wc-29767259': 'Arcos de concreto y una cascada en Las Pozas',
  'wc-2003803': 'Estructura curva de concreto en Las Pozas, rodeada de vegetación',
  'wc-29767260': 'Puertas de concreto pintadas en Las Pozas',
  'wc-6172324': 'Cascada de Tamasopo cayendo sobre una poza',
  'wc-89848894': 'Poza y roca cubierta de musgo en Puente de Dios',
  'wc-45072628': 'Agua azul que corre entre rocas en Puente de Dios',
  'wc-45072664': 'Poza turquesa entre árboles en Puente de Dios',
  'wc-98005525': 'Escalones de agua de las Cascadas de Micos',
  'wc-98005522': 'Río Micos ancho y verde con cascadas al fondo',
  'wc-98005523': 'Río Micos entre árboles con una cascada al fondo',
  'wc-98007105': 'Cascadas de Minas Viejas sobre pozas turquesa',
  'wc-98007106': 'Doble caída de la Cascada de Minas Viejas',
  'wc-98007108': 'La Cascada de Minas Viejas entre la vegetación',
  'wc-75414206': 'Cascada de Minas Viejas cayendo en dos chorros',
  'wc-93308060': 'Escalones de agua blanca de la Cascada El Meco',
  'wc-60066386': 'Explanada verde y estructuras de la Zona Arqueológica de Tamtoc',
  'wc-30478447': 'Detalle de una escultura de piedra de Tamtoc',
  'wc-30478452': 'Monumento de piedra junto al manantial en Tamtoc',
  'wc-105308560': 'Zacahuil envuelto en hojas antes de hornear',
  'wc-76389273': 'Canal de agua de la Media Luna reflejando los árboles',
  'wc-43657425': 'Parroquia de Santa Catarina en Rioverde a la hora azul',
  'wc-43657320': 'Presidencia Municipal de Rioverde de noche',
  'wc-145121025': 'Bordados de colores de comunidades de la Región Media',
  'wc-21779359': 'Torres de la Parroquia de El Refugio en Ciudad Fernández',
  'wc-72476536': 'Iglesia blanca de Ciudad del Maíz',
  'wc-43619684': 'Arcos de la Presidencia de Ciudad del Maíz',
  'wc-72476440': 'Fachada de la Parroquia de la Purísima Concepción en Ciudad del Maíz',
  'wc-32612423': 'Estalactitas iluminadas en las Grutas de la Catedral',
  'wc-32612408': 'Columnas de roca calcárea en las Grutas de la Catedral',
};

export function altFor(id: string | null | undefined): string {
  if (!id) return '';
  if (ALT[id]) return ALT[id];
  const rec = mediaRecord(id);
  if (!rec) return '';
  const region = rec.region ? REGION_NAME[rec.region as keyof typeof REGION_NAME] : null;
  return [rec.destination, region].filter(Boolean).join(', ');
}

export type Variants = { src: string; srcset: string; width: number; height: number };

/** Responsive WebP srcset for one derivative. */
export async function variants(img: ImageMetadata, widths: number[], quality = 72): Promise<Variants> {
  const ws = [...new Set(widths.map((w) => Math.min(w, img.width)))].sort((a, b) => a - b);
  const r = await getImage({ src: img, widths: ws, format: 'webp', quality });
  return { src: r.src, srcset: r.srcSet.attribute, width: img.width, height: img.height };
}

/** Same srcset Photo renders, for <link rel="preload"> of a hero. */
export async function preloadFor(id: string, widths = [480, 800, 1200, 1600, 2000], sizes = '100vw') {
  const img = mediaImage(id);
  if (!img) return null;
  const v = await variants(img, widths);
  return { srcset: v.srcset, sizes };
}

/** A single URL (for JSON consumed on the client: map, Mi Ruta). */
export async function thumbUrl(id: string | null | undefined, width = 640): Promise<string | null> {
  const img = mediaImage(id);
  if (!img) return null;
  const r = await getImage({ src: img, width: Math.min(width, img.width), format: 'webp', quality: 70 });
  return r.src;
}

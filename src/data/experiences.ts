/**
 * Experiencias: editorial framing over verified destinations. The title and
 * the interest cue are editorial (a verb and a way of travelling, no facts);
 * the supporting text is the destination's verified description from the
 * research adapter, DISPUTED overrides included, so nothing new is asserted.
 * Each experience has a page (/experiencias/<slug>/) that gathers the
 * destination's season, nearby places, events and lodging from data.
 * The first six are the home page selection.
 */
import { getDestination, INTERESTS, type Destination, type InterestId } from './research';
import { slugify } from './portal';

type Def = { id: string; title: string; interest: InterestId; image?: string; slug?: string };
// Home selection first: images chosen so none repeats a photograph used by the
// interest cards, the Temporadas stages or the "Qué hacer" selection.
const DEFS: Def[] = [
  { id: 'H02', title: 'Remar el Tampaón hasta Tamul', interest: 'aventura', image: 'wc-45072553' },
  { id: 'M14', title: 'Entrar a una catedral de piedra', interest: 'naturaleza', image: 'wc-32612423' },
  { id: 'A07', title: 'Levantar la vista en Matehuala', interest: 'arquitectura', image: 'wc-129510016' },
  { id: 'H08', title: 'Perderse en un jardín surrealista', interest: 'arte', image: 'wc-29767260' },
  { id: 'C01', title: 'Caminar la capital sin prisa', interest: 'historia', image: 'wc-63495269' },
  { id: 'C10', title: 'Subir al real de minas que dio origen a la capital', interest: 'senderismo', image: 'wc-158635553' },
  // the rest appear on /experiencias/
  { id: 'H06', title: 'Recorrer Aquismón, Pueblo Mágico de la Huasteca', interest: 'cultura', image: 'wc-52606453' },
  { id: 'C12', title: 'Ver nacer un rebozo en Santa María del Río', interest: 'artesania', image: 'wc-58139975' },
  { id: 'H16', title: 'Recorrer la ciudad huasteca de Tamtoc', interest: 'arqueologia', image: 'wc-60066386' },
  { id: 'H04', title: 'Asomarse al Sótano de las Golondrinas', interest: 'aventura', image: 'wc-2008166' },
  { id: 'M01', title: 'Nadar en el agua clara de la Media Luna', interest: 'cascadas', image: 'wc-76389273' },
  { id: 'A01', title: 'Llegar a Real de Catorce por el túnel', interest: 'pueblos-magicos', image: 'wc-119874435' },
];

export type Experience = { slug: string; d: Destination; title: string; interest: string; interestId: InterestId; image: string | null; source: string };

export const ALL_EXPERIENCES: Experience[] = DEFS.map((x) => {
  const d = getDestination(x.id);
  if (!d) throw new Error(`experiences: ${x.id} has no published destination`);
  // the cue must be one of the destination's own interests
  if (!d.interests.includes(x.interest)) throw new Error(`experiences: ${x.id} is not tagged ${x.interest}`);
  return {
    slug: x.slug ?? slugify(x.title).slice(0, 60),
    d,
    title: x.title,
    interest: INTERESTS.find((i) => i.id === x.interest)!.label,
    interestId: x.interest,
    image: x.image ?? d.media.experience ?? d.media.card,
    source: d.descriptionSource,
  };
});
export const EXPERIENCES = ALL_EXPERIENCES.slice(0, 6);

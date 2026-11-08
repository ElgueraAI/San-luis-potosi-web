/** Resolve exact IDs to generated pages or an existing catalogue's ID detail. */
import { destinations } from '@/data/research';
import { municipalities, archaeology, events, museums, venues, lodging, food, protectedAreas, recreation, cathedrals, muniById, archSlug } from '@/data/portal';
import { destHref, muniHref, archHref, eventHref, href } from '@/i18n/routes';
import { validMunicipalityKey } from './municipality';
export const placeAnchor = (id: string) => `place-${id}`;
export function placeDetailsHref(id: string): string | null {
  const d = destinations.find((e) => e.id === id); if (d) return destHref(d.slug);
  const m = municipalities.find((e) => e.id === id); if (m?.slug) return muniHref(m.slug);
  const a = archaeology.find((e) => e.id === id); if (a) return archHref(archSlug(a));
  const event = events.find((e) => e.id === id); if (event?.slug) return eventHref(event.slug);
  const catalogue = [...museums, ...venues].some((e) => e.id === id) ? 'museums' : lodging.some((e) => e.id === id) ? 'lodging' : food.some((e) => e.id === id) ? 'food' : null;
  if (catalogue) return `${href(catalogue)}?place=${encodeURIComponent(id)}#${placeAnchor(id)}`;
  const e = [...protectedAreas, ...recreation, ...cathedrals].find((e) => e.id === id);
  const municipality = e && validMunicipalityKey(e.municipality_id) ? muniById.get(e.municipality_id) : null;
  return municipality?.slug ? `${muniHref(municipality.slug)}#${placeAnchor(id)}` : null;
}

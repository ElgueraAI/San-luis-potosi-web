/**
 * Static search index for /buscar/ and the menu search (src/scripts/search.ts).
 * One row per findable thing: municipalities, regions, destinations,
 * experiences, events, archaeology, museums and venues, lodging, things-to-do
 * categories, guides and resources. Restaurants and bars are reached through
 * the food directory instead (too many rows for a global index).
 */
import type { APIRoute } from 'astro';
import { municipalities, events, archaeology, museums, venues, lodging, protectedAreas, archSlug, muniById } from '@/data/portal';
import { destinations, MONTHS_ES, resources } from '@/data/research';
import { REGIONS } from '@/data/regions';
import { ALL_EXPERIENCES } from '@/data/experiences';
import { THINGS } from '@/data/thingsToDo';
import { href, destHref, regionHref, muniHref, eventHref, experienceHref, tdHref, archHref } from '@/i18n/routes';

type Row = { n: string; k: string; u: string; r: string | null; m: string | null; x: string };
const monthWords = (ms?: number[]) => (ms ?? []).map((m) => MONTHS_ES[m - 1]).join(' ');

export const GET: APIRoute = () => {
  const rows: Row[] = [
    ...REGIONS.map((r) => ({ n: r.name, k: 'Región', u: regionHref(r.slug), r: r.id, m: null, x: r.identity })),
    ...municipalities.map((m) => ({ n: m.canonical_name, k: 'Municipio', u: muniHref(m.slug!), r: m.region, m: m.canonical_name, x: m.seat?.name ?? '' })),
    ...destinations.map((d) => ({ n: d.name, k: d.kind, u: destHref(d.slug), r: d.region, m: d.municipality, x: `${d.tags.join(' ')} ${d.description.slice(0, 140)}` })),
    ...ALL_EXPERIENCES.map((e) => ({ n: e.title, k: 'Experiencia', u: experienceHref(e.slug), r: e.d.region, m: e.d.municipality, x: `${e.interest} ${e.d.name}` })),
    ...events.map((e) => ({ n: e.canonical_name, k: 'Fiesta o evento', u: eventHref(e.slug!), r: e.region, m: e.municipality, x: `${e.subcategory ?? ''} ${monthWords(e.months)}` })),
    ...archaeology.map((a) => ({ n: a.canonical_name, k: 'Arqueología', u: archHref(archSlug(a)), r: a.region, m: a.municipality, x: a.alternate_names.join(' ') })),
    ...museums.map((v) => ({ n: v.canonical_name, k: 'Museo', u: `${href('museums')}?q=${encodeURIComponent(v.canonical_name)}`, r: v.region, m: v.municipality, x: v.subcategory ?? '' })),
    ...venues.map((v) => ({ n: v.canonical_name, k: v.subcategory ?? 'Recinto cultural', u: `${href('museums')}?q=${encodeURIComponent(v.canonical_name)}`, r: v.region, m: v.municipality, x: '' })),
    ...protectedAreas.map((p) => ({ n: p.canonical_name, k: p.subcategory ?? 'Área protegida', u: p.municipality_id ? muniHref(muniById.get(p.municipality_id)!.slug!) : tdHref('naturaleza', 'parques'), r: p.region, m: p.municipality, x: 'naturaleza' })),
    ...lodging.map((l) => ({ n: l.canonical_name, k: l.official_directory ? 'Hospedaje (directorio oficial)' : 'Hospedaje (DENUE)', u: `${href('lodging')}?q=${encodeURIComponent(l.canonical_name)}`, r: l.region, m: l.municipality, x: l.subcategory ?? '' })),
    ...THINGS.flatMap((c) => [
      { n: c.label, k: 'Qué hacer', u: tdHref(c.id), r: null, m: null, x: c.subs.map((s) => s.label).join(' ') },
      ...c.subs.map((s) => ({ n: s.label, k: `Qué hacer · ${c.short}`, u: tdHref(c.id, s.id), r: null, m: null, x: s.intro })),
    ]),
    ...resources.filter((r) => r.url).map((r) => ({ n: r.title, k: 'Recurso oficial', u: href('guides'), r: (r.region || null) as string | null, m: null, x: r.institution })),
    ...[
      ['Mapa interactivo', href('map')], ['Temporadas: qué hacer ahora', href('seasons')], ['Rutas e itinerarios', href('routes')],
      ['Guías y recursos', href('guides')], ['Planea tu viaje', href('plan')], ['Mi Ruta', href('myRoute')], ['Festividades y eventos', href('events')],
      ['Hospedaje', href('lodging')], ['Gastronomía', href('food')], ['Museos y recintos culturales', href('museums')], ['Arqueología', href('archaeology')],
      ['Municipios', href('municipalities')], ['Experiencias', href('experiences')], ['Acerca del proyecto', href('about')],
    ].map(([n, u]) => ({ n, k: 'Sección', u, r: null, m: null, x: '' })),
  ];
  return new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json' } });
};

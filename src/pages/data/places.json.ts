/**
 * One static JSON for the client (map panels, Mi Ruta): every published
 * destination plus every plotted map place, with a small image URL and its
 * weather reference point. Built at compile time from the research adapter.
 */
import type { APIRoute } from 'astro';
import { destinations, mapPlaces, weatherPointFor, type RegionId } from '@/data/research';
import { thumbUrl } from '@/lib/media';
import { municipalities, archaeology, museums, venues, lodging, protectedAreas, muniById, archSlug, type Entity } from '@/data/portal';
import { href, muniHref, archHref } from '@/i18n/routes';
import { destHref } from '@/i18n/routes';

export const GET: APIRoute = async () => {
  const ids = new Set([...destinations.map((d) => d.id), ...mapPlaces.map((p) => p.id)]);
  const out = [];
  for (const id of ids) {
    const d = destinations.find((x) => x.id === id);
    const m = mapPlaces.find((x) => x.id === id);
    const region = (d?.region ?? m!.region) as RegionId;
    const wx = weatherPointFor({ id, region, municipality: d?.municipality ?? m?.municipality ?? null });
    out.push({
      id,
      name: d?.name ?? m!.name,
      region,
      kind: d?.kind ?? m!.kind,
      municipality: d?.municipality ?? m?.municipality ?? null,
      description: d?.description ?? m?.description ?? null,
      url: d ? destHref(d.slug) : null,
      coords: m?.coords ?? null,
      status: m?.status ?? 'none',
      interests: d?.interests ?? m?.interests ?? [],
      image: await thumbUrl(d?.media.card ?? m?.image, 640),
      weather: { key: wx.key, name: wx.name, lat: wx.lat, lon: wx.lon },
    });
  }
  // entity layer: anything a page lets the visitor add to Mi Ruta, with its point.
  // `group` feeds the optional clustered layers of the discovery map (seats, culture, nature, lodging).
  const ent = (e: Entity, kind: string, url: string | null, lat = e.latitude, lon = e.longitude) => ({
    id: e.id, name: e.canonical_name, region: (e.region ?? 'centro') as RegionId, kind, municipality: e.municipality,
    description: e.short_description ? e.short_description.slice(0, 220) : null, url, coords: [lon!, lat!] as [number, number],
    status: e.coordinate_status === 'verified' ? 'ready' : 'provisional', interests: [], image: null, layer: 'entity',
    weather: (() => { const w = weatherPointFor({ id: e.id, region: (e.region ?? 'centro') as RegionId, municipality: e.municipality }); return { key: w.key, name: w.name, lat: w.lat, lon: w.lon }; })(),
  });
  const muniUrl = (e: Entity) => (e.municipality_id ? muniHref(muniById.get(e.municipality_id)!.slug!) : null);
  for (const m of municipalities) if (m.seat && m.region) out.push({ ...ent(m, 'Municipio (cabecera)', muniHref(m.slug!), m.seat.latitude, m.seat.longitude), group: 'seats' });
  for (const a of archaeology) if (a.latitude != null) out.push({ ...ent(a, 'Zona arqueológica', archHref(archSlug(a))), group: 'culture' });
  for (const v of [...museums, ...venues]) if (v.latitude != null && v.region) out.push({ ...ent(v, v.subcategory ?? 'Recinto cultural', `${href('museums')}?q=${encodeURIComponent(v.canonical_name)}`), group: 'culture' });
  for (const p of protectedAreas) if (p.latitude != null && p.region) out.push({ ...ent(p, p.subcategory ?? 'Área protegida', muniUrl(p)), group: 'nature' });
  for (const l of lodging) if (l.latitude != null && l.region) out.push({ ...ent(l, l.subcategory ?? 'Hospedaje', `${href('lodging')}?q=${encodeURIComponent(l.canonical_name)}`), group: 'lodging' });
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
};

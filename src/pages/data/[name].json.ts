/**
 * Directory data for client-side filtering (src/scripts/directory.ts), built
 * at compile time from research/entities. Compact rows; only records the site
 * exposes (food: official listings, cafés, producers, restaurants/bars with
 * 6+ staff; see research/entities/food-drink).
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { lodging, food, museums, venues, muniById, bizNote, type Entity } from '@/data/portal';

const TYPE: Record<string, string> = { food: 'Restaurante', cafe: 'Cafetería', drink: 'Bebidas', nightlife: 'Bar o centro nocturno', lodging: 'Hospedaje', museum: 'Museo', 'cultural-venue': 'Recinto cultural' };
const row = (e: Entity) => ({
  id: e.id,
  n: e.canonical_name,
  t: e.subcategory ?? TYPE[e.entity_type] ?? e.entity_type,
  ty: e.entity_type === 'cultural-venue' || e.entity_type === 'lodging' ? (e.subcategory ?? e.entity_type) : e.entity_type,
  m: e.municipality,
  ms: e.municipality_id ? muniById.get(e.municipality_id)?.slug ?? null : null,
  r: e.region,
  a: e.official_contact?.address ?? null,
  p: e.official_contact?.phone ?? null,
  u: e.official_url && /^https?:/i.test(e.official_url) ? e.official_url : null,
  o: !!e.official_directory,
  c: e.latitude != null,
  s: e.denue || e.official_directory ? bizNote(e) : 'Sistema de Información Cultural (Secretaría de Cultura)',
});
const official = (a: Entity, b: Entity) => Number(!!b.official_directory) - Number(!!a.official_directory) || a.canonical_name.localeCompare(b.canonical_name, 'es');

const SETS: Record<string, () => Entity[]> = {
  lodging: () => [...lodging].sort(official),
  food: () => [...food].sort(official),
  // museums first, then venues; alphabetical inside each
  culture: () => [...museums, ...venues].sort((a, b) => Number(b.entity_type === 'museum') - Number(a.entity_type === 'museum') || a.canonical_name.localeCompare(b.canonical_name, 'es')),
};

export const getStaticPaths: GetStaticPaths = () => Object.keys(SETS).map((name) => ({ params: { name } }));
export const GET: APIRoute = ({ params }) =>
  new Response(JSON.stringify(SETS[params.name!]().map(row)), { headers: { 'Content-Type': 'application/json' } });

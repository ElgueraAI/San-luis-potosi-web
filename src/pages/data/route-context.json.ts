/**
 * Compact context for Mi Ruta recommendations (src/scripts/geo/recommend.ts):
 * verified events with their month pattern and date status, keyed by
 * municipality (or region when an event spans several municipalities), plus
 * the regional dishes from the official brochures. Built at compile time.
 */
import type { APIRoute } from 'astro';
import { events, DATE_STATUS, slugify } from '@/data/portal';
import { gastronomyFor, REGION_IDS } from '@/data/research';
import { eventHref } from '@/i18n/routes';

export const GET: APIRoute = () => {
  const ev = events
    .filter((e) => e.region && (e.months?.length || e.all_year))
    .map((e) => ({
      id: e.id,
      n: e.canonical_name,
      // municipality key for matching stops; null = regional (several municipalities)
      mk: e.municipality_id && e.municipality ? slugify(e.municipality) : null,
      m: e.municipality,
      r: e.region,
      mo: e.months ?? [],
      ay: !!e.all_year,
      ds: DATE_STATUS[e.date_status ?? '']?.short ?? null,
      cd: e.confirmed_dates ?? null,
      u: eventHref(e.slug!),
    }));
  const dishes = Object.fromEntries(REGION_IDS.map((r) => [r, [...new Set(gastronomyFor(r).flatMap((g) => g.dishes))].slice(0, 4)]));
  return new Response(JSON.stringify({ events: ev, dishes }), { headers: { 'Content-Type': 'application/json' } });
};

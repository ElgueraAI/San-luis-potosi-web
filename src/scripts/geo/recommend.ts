/**
 * First, rule-based recommendation layer for Mi Ruta. Every suggestion says
 * why it appears; nothing here claims real-time crowding, availability or
 * traffic (we have no source for that). Pure functions over portal data.
 *
 * Rules
 *  near-route  destinations / nature / archaeology within a corridor around
 *              the road route (straight-line distance to the line, stated as such)
 *  interest    boosts places sharing an interest with the saved stops
 *  event       verified events in a stop's municipality (or region-wide) in the
 *              trip month or the next one, with their date status
 *  lodging     registered lodging near the last stop
 *  dishes      regional dishes from the official brochures for the regions crossed
 */
import { haversine, fmtDistance } from './format';
import type { Coordinate, RouteProfile } from './types';
import { REGION_NAME, type Place } from './places';

export type RouteEvent = { id: string; n: string; mk: string | null; m: string | null; r: string; mo: number[]; ay: boolean; ds: string | null; cd: string | null; u: string };
export type RouteContext = { events: RouteEvent[]; dishes: Record<string, string[]> };

export interface Recommendation {
  kind: 'near-route' | 'event' | 'lodging' | 'dishes';
  id: string;
  title: string;
  reason: string;
  url: string | null;
  /** place id that can be added to Mi Ruta */
  placeId?: string;
  approximate?: boolean;
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const CORRIDOR_M: Record<RouteProfile, number> = { car: 6000, bike: 2500, foot: 1000 };
const LODGING_RADIUS_M = 10000;

export const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Distance (m) from a point to a polyline, equirectangular projection around the point (fine at < 50 km). */
export function distanceToLine(p: Coordinate, line: Coordinate[]): number {
  if (!line.length) return Infinity;
  if (line.length === 1) return haversine(p, line[0]);
  const k = Math.cos((p[1] * Math.PI) / 180) * 111320, kk = 111320;
  const px = p[0] * k, py = p[1] * kk;
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const ax = line[i - 1][0] * k, ay = line[i - 1][1] * kk, bx = line[i][0] * k, by = line[i][1] * kk;
    const dx = bx - ax, dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (d < best) best = d;
  }
  return best;
}

/** Thin a long route geometry so the corridor test stays cheap (keeps ~600 vertices). */
export function thin(line: Coordinate[], max = 600): Coordinate[] {
  if (line.length <= max) return line;
  const step = Math.ceil(line.length / max);
  return line.filter((_, i) => i % step === 0 || i === line.length - 1);
}

export interface RecommendInput {
  stops: Place[];
  /** Road geometry when a route exists; otherwise the stop points (suggestions then say "cerca de tus paradas"). */
  line: Coordinate[] | null;
  profile: RouteProfile;
  places: Place[];
  context: RouteContext | null;
  /** 1–12 */
  month: number;
}

export function recommend(input: RecommendInput): Recommendation[] {
  const { stops, places, context, month, profile } = input;
  if (!stops.length) return [];
  const inRoute = new Set(stops.map((s) => s.id));
  const out: Recommendation[] = [];
  const onRoad = !!input.line && input.line.length > 1;
  const line = thin(onRoad ? input.line! : stops.filter((s) => s.coords).map((s) => s.coords!));

  // ---- near the route (+ shared interests) --------------------------------------
  const savedInterests = new Set(stops.flatMap((s) => s.interests));
  const corridor = onRoad ? CORRIDOR_M[profile] : CORRIDOR_M[profile] * 2;
  const near = places
    .filter((p) => p.coords && p.status !== 'none' && !inRoute.has(p.id))
    .filter((p) => p.layer !== 'entity' || p.group === 'nature' || p.kind === 'Zona arqueológica')
    .map((p) => ({ p, d: distanceToLine(p.coords!, line), shared: p.interests.filter((i) => savedInterests.has(i)) }))
    .filter((x) => x.d <= corridor)
    // shared interests first, then verified points, then distance
    .sort((a, b) => b.shared.length - a.shared.length || Number(b.p.status === 'ready') - Number(a.p.status === 'ready') || a.d - b.d)
    .slice(0, 4);
  for (const { p, d, shared } of near) {
    const where = onRoad ? 'de tu ruta' : 'de tus paradas';
    const dist = d < 300 ? `Junto a tu ruta` : `A ${fmtDistance(d)} ${where} (en línea recta)`;
    out.push({
      kind: 'near-route', id: `near:${p.id}`, title: p.name, placeId: p.id, url: p.url, approximate: p.status !== 'ready',
      reason: `${dist}.${shared.length ? ` Coincide con lo que guardaste: ${shared.map((s) => s.replace(/-/g, ' ')).join(', ')}.` : ''}`,
    });
  }

  // ---- events in the trip month or the next ------------------------------------------
  if (context) {
    const next = (month % 12) + 1;
    const muniKeys = new Map<string, number>();
    stops.forEach((s, i) => { if (s.municipality && !muniKeys.has(slug(s.municipality))) muniKeys.set(slug(s.municipality), i + 1); });
    const regions = new Set(stops.map((s) => s.region));
    const seen = new Set<string>();
    const evs = context.events
      .filter((e) => !e.ay && (e.mo.includes(month) || e.mo.includes(next)))
      .filter((e) => (e.mk ? muniKeys.has(e.mk) : regions.has(e.r)))
      .sort((a, b) => Number(b.mo.includes(month)) - Number(a.mo.includes(month)) || Number(!!b.mk) - Number(!!a.mk))
      .filter((e) => (seen.has(e.n) ? false : (seen.add(e.n), true)))
      .slice(0, 3);
    for (const e of evs) {
      const when = e.mo.includes(month) ? `este ${MONTHS[month - 1]}` : `en ${MONTHS[next - 1]}`;
      const where = e.mk ? `en ${e.m}, tu parada ${muniKeys.get(e.mk)}` : `en la región de tu ruta`;
      out.push({ kind: 'event', id: `ev:${e.id}`, title: e.n, url: e.u, reason: `Se celebra ${when} ${where}.${e.ds ? ` Fecha: ${e.ds.toLowerCase()}.` : ''}` });
    }
  }

  // ---- lodging near the last stop --------------------------------------------------------
  const last = [...stops].reverse().find((s) => s.coords);
  if (last) {
    const lodg = places
      .filter((p) => p.group === 'lodging' && p.coords && !inRoute.has(p.id))
      .map((p) => ({ p, d: haversine(p.coords!, last.coords!) }))
      .filter((x) => x.d <= LODGING_RADIUS_M)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    for (const { p, d } of lodg) {
      out.push({
        kind: 'lodging', id: `lodg:${p.id}`, title: p.name, placeId: p.id, url: p.url, approximate: p.status !== 'ready',
        reason: `Hospedaje registrado a ${fmtDistance(d)} de tu última parada, ${last.name} (en línea recta; registro oficial, no es una reseña).`,
      });
    }
  }

  // ---- regional dishes ------------------------------------------------------------------------
  if (context) {
    const regions = [...new Set(stops.map((s) => s.region))];
    for (const r of regions) {
      const d = context.dishes[r] ?? [];
      if (!d.length) continue;
      out.push({ kind: 'dishes', id: `dish:${r}`, title: `${REGION_NAME[r] ?? r}: ${d.join(' · ')}`, url: null, reason: `Platillos de la región que cruza tu ruta, según los folletos de la Secretaría de Turismo.` });
    }
  }
  return out;
}

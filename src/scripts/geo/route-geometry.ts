/**
 * Pure geometry over a road route polyline, used by live navigation
 * (navigation.ts). No DOM, no network, no state: every function takes the
 * line and returns plain numbers, so it is unit-tested directly.
 *
 * Distances are metres. Along-route distances use haversine segment lengths;
 * the point-to-segment projection uses a local equirectangular plane centred
 * on the visitor, accurate to well under a metre at segment lengths found in
 * road geometry.
 */
import { haversine } from './format';
import type { Coordinate } from './types';

export interface RouteLine {
  coords: Coordinate[];
  /** cum[i] = distance along the line from coords[0] to coords[i] */
  cum: number[];
  total: number;
}

export interface Snap {
  /** segment index: the point lies between coords[index] and coords[index + 1] */
  index: number;
  /** 0..1 position inside that segment */
  t: number;
  point: Coordinate;
  /** metres from the visitor to the closest point of the route */
  distance: number;
  /** metres along the route from its start to the closest point */
  along: number;
}

/** Search window (metres along the route) used when a previous snap is known. */
export const WINDOW_BACK_M = 300;
export const WINDOW_AHEAD_M = 3000;

export function buildLine(coords: Coordinate[]): RouteLine {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]));
  return { coords, cum, total: cum[cum.length - 1] ?? 0 };
}

const M_PER_DEG = 111320;

/** Closest point of segment a–b to p, in a plane centred on p. */
export function projectOnSegment(p: Coordinate, a: Coordinate, b: Coordinate): { t: number; point: Coordinate; distance: number } {
  const kx = M_PER_DEG * Math.cos((p[1] * Math.PI) / 180);
  const ax = (a[0] - p[0]) * kx, ay = (a[1] - p[1]) * M_PER_DEG;
  const bx = (b[0] - p[0]) * kx, by = (b[1] - p[1]) * M_PER_DEG;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  const x = ax + t * dx, y = ay + t * dy;
  return { t, point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], distance: Math.hypot(x, y) };
}

function scan(line: RouteLine, p: Coordinate, from: number, to: number): Snap | null {
  let best: Snap | null = null;
  for (let i = from; i < to; i++) {
    const s = projectOnSegment(p, line.coords[i], line.coords[i + 1]);
    if (!best || s.distance < best.distance) {
      best = { index: i, t: s.t, point: s.point, distance: s.distance, along: line.cum[i] + (line.cum[i + 1] - line.cum[i]) * s.t };
    }
  }
  return best;
}

/**
 * Project the visitor onto the route.
 * With `hint` (the previous snap) only the stretch from WINDOW_BACK_M behind to
 * WINDOW_AHEAD_M ahead is searched; if nothing there is within `maxWindowDistance`
 * the whole line is searched (visitor left the route or jumped).
 * A route with fewer than two points cannot be snapped (returns null).
 */
export function snapToLine(line: RouteLine, p: Coordinate, hint?: Snap | null, maxWindowDistance = 150): Snap | null {
  const n = line.coords.length;
  if (n < 2) return null;
  if (hint && hint.index < n - 1) {
    let from = hint.index, to = hint.index + 1;
    while (from > 0 && line.cum[from] > hint.along - WINDOW_BACK_M) from--;
    while (to < n - 1 && line.cum[to] < hint.along + WINDOW_AHEAD_M) to++;
    const w = scan(line, p, from, to);
    if (w && w.distance <= maxWindowDistance) return w;
  }
  return scan(line, p, 0, n - 1);
}

/** Distance from the visitor to the route (full search). */
export const distanceFromRoute = (line: RouteLine, p: Coordinate): number => snapToLine(line, p)?.distance ?? Infinity;

export const travelled = (along: number): number => Math.max(0, along);
export const remaining = (line: RouteLine, along: number): number => Math.max(0, line.total - along);
export const progress = (line: RouteLine, along: number): number => (line.total > 0 ? Math.max(0, Math.min(1, along / line.total)) : 0);

/**
 * Along-route distance at which each waypoint is reached.
 * boundaries[0] = 0 (origin); boundaries[i] = where the route comes closest to
 * waypoint i, searching forward from the previous waypoint. When the route
 * passes the same spot twice, the first pass within 25 m of the best match wins,
 * so a later loop back does not steal the stop.
 */
export function legBoundaries(line: RouteLine, waypoints: Coordinate[]): number[] {
  const out = [0];
  let from = 0;
  for (let w = 1; w < waypoints.length; w++) {
    const p = waypoints[w];
    const last = w === waypoints.length - 1;
    if (last || line.coords.length < 2) { out.push(line.total); continue; }
    const ds: { i: number; d: number; along: number }[] = [];
    for (let i = from; i < line.coords.length - 1; i++) {
      const s = projectOnSegment(p, line.coords[i], line.coords[i + 1]);
      ds.push({ i, d: s.distance, along: line.cum[i] + (line.cum[i + 1] - line.cum[i]) * s.t });
    }
    const min = Math.min(...ds.map((x) => x.d));
    const pick = ds.find((x) => x.d <= min + 25) ?? ds[0];
    out.push(Math.max(out[w - 1], pick.along));
    from = pick.i;
  }
  return out;
}

/** Index of the leg (0-based: leg k goes from waypoint k to k + 1) that contains `along`. */
export function legAt(boundaries: number[], along: number): number {
  for (let k = 1; k < boundaries.length; k++) if (along < boundaries[k]) return k - 1;
  return Math.max(0, boundaries.length - 2);
}

/** Split the line at `along` into the travelled part and the remaining part (for drawing). */
export function splitAt(line: RouteLine, along: number): { done: Coordinate[]; rest: Coordinate[] } {
  const n = line.coords.length;
  if (n < 2 || along <= 0) return { done: [], rest: line.coords };
  if (along >= line.total) return { done: line.coords, rest: [] };
  let i = 0;
  while (i < n - 2 && line.cum[i + 1] < along) i++;
  const seg = line.cum[i + 1] - line.cum[i];
  const t = seg > 0 ? (along - line.cum[i]) / seg : 0;
  const a = line.coords[i], b = line.coords[i + 1];
  const cut: Coordinate = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return { done: [...line.coords.slice(0, i + 1), cut], rest: [cut, ...line.coords.slice(i + 1)] };
}

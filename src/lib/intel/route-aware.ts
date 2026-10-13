/**
 * Route-aware candidates: places near the corridor of the road route that is
 * already computed. Proximity is measured to the route GEOMETRY (not to the
 * origin, not as the crow flies between stops), reusing the snapping code of
 * live navigation (src/scripts/geo/route-geometry.ts).
 *
 * No routing request is made here. The detour is first an ESTIMATE from the
 * distance to the line, and is labelled as such; `measuredDetours()` turns one
 * road matrix (a single provider request, asked for by the visitor) into
 * measured detours.
 */
import { buildLine, legAt, legBoundaries, snapToLine, type RouteLine } from '../../scripts/geo/route-geometry';
import type { Detour } from './scoring';
import type { Coord, IntelPlace, TravelMode } from './types';

/**
 * Half-width of the corridor searched around the route, by travel mode (km):
 * the distance at which the estimated detour reaches MAX_DETOUR_MIN.
 */
export const CORRIDOR_KM: Record<TravelMode, number> = { car: 12, bike: 3.5, foot: 1.2 };
/** Mean speed assumed on the way off the route and back (km/h): secondary roads, tracks, paths. */
export const DETOUR_SPEED_KMH: Record<TravelMode, number> = { car: 45, bike: 13, foot: 4.5 };
/** Road distance ≈ straight-line distance × this factor (winding roads in the sierras). */
export const WINDING = 1.4;
/** Detours longer than this are not offered as "near your route". */
export const MAX_DETOUR_MIN = 45;
const MAX_VERTICES = 800;

/** Estimated extra minutes to leave the route, reach a point `offKm` away and come back. */
export function estimateDetourMin(offKm: number, mode: TravelMode): number {
  return ((2 * offKm * WINDING) / DETOUR_SPEED_KMH[mode]) * 60;
}

export function thinLine(coords: Coord[], max = MAX_VERTICES): Coord[] {
  if (coords.length <= max) return coords;
  const step = Math.ceil(coords.length / max);
  return coords.filter((_, i) => i % step === 0 || i === coords.length - 1);
}

export interface CorridorCandidate {
  place: IntelPlace;
  /** km from the place to the nearest point of the route geometry */
  offRouteKm: number;
  /** km along the route where that nearest point lies */
  alongKm: number;
  /** nearest point of the route: where the detour would leave it */
  exit: Coord;
  /** index of the waypoint the visitor reaches next after that point (0-based in `waypoints`) */
  beforeStop: number;
  detour: Detour;
}

export interface CorridorInput {
  /** Road geometry of the computed route. */
  line: Coord[];
  /** Route waypoints in order (origin first), to say "antes de llegar a …". */
  waypoints: Coord[];
  mode: TravelMode;
  places: IntelPlace[];
  exclude?: Set<string>;
}

export function corridorCandidates(input: CorridorInput): CorridorCandidate[] {
  const coords = thinLine(input.line);
  if (coords.length < 2) return [];
  const line: RouteLine = buildLine(coords);
  const bounds = legBoundaries(line, input.waypoints);
  const out: CorridorCandidate[] = [];
  for (const p of input.places) {
    if (!p.coord || input.exclude?.has(p.id) || (p.route_id && input.exclude?.has(p.route_id))) continue; // no point: never in a geospatial calculation
    const snap = snapToLine(line, p.coord);
    if (!snap) continue;
    const offRouteKm = snap.distance / 1000;
    if (offRouteKm > CORRIDOR_KM[input.mode]) continue;
    const extraMin = estimateDetourMin(offRouteKm, input.mode);
    if (extraMin > MAX_DETOUR_MIN) continue;
    out.push({
      place: p, offRouteKm, alongKm: snap.along / 1000, exit: snap.point,
      beforeStop: Math.min(input.waypoints.length - 1, legAt(bounds, snap.along) + 1),
      detour: { offRouteKm, extraMin, measured: false },
    });
  }
  return out.sort((a, b) => a.detour.extraMin - b.detour.extraMin);
}

/**
 * Points for ONE matrix request that measures the detours of the candidates:
 * [exit₁ … exitₖ, place₁ … placeₖ]. `measuredDetours` reads it back.
 */
export function detourMatrixPoints(cands: CorridorCandidate[]): Coord[] {
  return [...cands.map((c) => c.exit), ...cands.map((c) => c.place.coord as Coord)];
}

/** Measured detour (min) = road time exit → place + place → exit. null when the provider found no road. */
export function measuredDetours(cands: CorridorCandidate[], durations: (number | null)[][]): Map<string, Detour> {
  const k = cands.length;
  const out = new Map<string, Detour>();
  cands.forEach((c, i) => {
    const go = durations[i]?.[k + i], back = durations[k + i]?.[i];
    if (go == null || back == null || !Number.isFinite(go) || !Number.isFinite(back)) return;
    out.set(c.place.id, { offRouteKm: c.offRouteKm, extraMin: (go + back) / 60, measured: true });
  });
  return out;
}

/** Where a new stop fits in the saved order so the trip keeps flowing: before the stop the route reaches next. */
export function insertionIndex(c: CorridorCandidate, hasOrigin: boolean): number {
  // waypoints = [origin?, stop₁, stop₂ …]; route-store order has no origin
  return Math.max(0, c.beforeStop - (hasOrigin ? 1 : 0));
}

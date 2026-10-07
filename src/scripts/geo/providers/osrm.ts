/**
 * OSRM on the FOSSGIS routing service (routing.openstreetmap.de): open source,
 * no key, CORS enabled. Usage policy: reasonable non-commercial use, at most
 * one request per second, OSM attribution, no guarantees (see
 * docs/map-api-decision.md). Used as the keyless academic fallback.
 */
import { RouteError, type Coordinate, type RouteLeg, type RouteMatrix, type RouteProfile, type RouteResult } from '../types';
import { assertWaypoints, errorForStatus, fetchJson, throttled, type RouteProvider, type RouteRequest } from '../route-provider';

export const OSRM_BASE = 'https://routing.openstreetmap.de';
const PATH: Record<RouteProfile, string> = { car: 'routed-car', foot: 'routed-foot', bike: 'routed-bike' };
const MAX = 25;

type OsrmRoute = { geometry: { type: 'LineString'; coordinates: Coordinate[] }; distance: number; duration: number; legs: { distance: number; duration: number }[] };
type OsrmBody = { code?: string; message?: string; routes?: OsrmRoute[]; durations?: (number | null)[][]; distances?: (number | null)[][] };

export function osrmError(status: number, body: OsrmBody | null): RouteError {
  const code = body?.code ?? '';
  const msg = body?.message || code || `HTTP ${status}`;
  if (code === 'NoRoute') return new RouteError('no-route', msg, status);
  if (code === 'NoSegment') return new RouteError('out-of-coverage', msg, status);
  if (code === 'TooBig') return new RouteError('too-many-waypoints', msg, status);
  if (code === 'InvalidQuery' || code === 'InvalidValue' || code === 'InvalidUrl') return new RouteError('invalid-coordinates', msg, status);
  return status >= 400 ? errorForStatus(status) : new RouteError('unknown', msg, status);
}

const coordPath = (cs: Coordinate[]) => cs.map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join(';');

export function parseRoute(body: OsrmBody, req: RouteRequest): RouteResult {
  const routes = body.routes ?? [];
  if (!routes.length) throw new RouteError('no-route', 'Respuesta sin ruta');
  const main = routes[0];
  const legs: RouteLeg[] = req.waypoints.slice(1).map((w, i) => ({
    from: req.waypoints[i].id, to: w.id, distance: main.legs[i]?.distance ?? 0, duration: main.legs[i]?.duration ?? 0,
  }));
  return {
    provider: 'osrm-fossgis',
    profile: req.profile,
    waypoints: req.waypoints,
    geometry: { type: 'LineString', coordinates: main.geometry.coordinates },
    distance: main.distance,
    duration: main.duration,
    legs,
    alternatives: routes.slice(1).map((r) => ({ geometry: { type: 'LineString' as const, coordinates: r.geometry.coordinates }, distance: r.distance, duration: r.duration })),
    attribution: 'Rutas: OSRM · FOSSGIS · Datos © OpenStreetMap contributors',
    quota: null,
    computedAt: Date.now(),
  };
}

export function createOsrmProvider(base = OSRM_BASE): RouteProvider {
  const queue = throttled(1100); // policy: one request per second max
  const get = async (url: string, signal?: AbortSignal) => {
    const r = await queue(() => fetchJson<OsrmBody>(url, { method: 'GET', headers: { Accept: 'application/json' } }, signal));
    if (r.status >= 400 || (r.body && r.body.code && r.body.code !== 'Ok')) throw osrmError(r.status, r.body);
    if (!r.body) throw new RouteError('provider-down', 'Respuesta vacía del servicio de rutas', r.status);
    return r.body;
  };

  return {
    id: 'osrm-fossgis',
    label: 'OSRM · FOSSGIS (sin clave, uso académico)',
    attribution: 'Rutas: OSRM · FOSSGIS · Datos © OpenStreetMap contributors',
    profiles: ['car', 'foot', 'bike'],
    maxWaypoints: MAX,
    supportsAlternatives: true,
    minInterval: 1100,

    async route(req, signal) {
      assertWaypoints(req, MAX);
      const alt = req.alternatives && req.waypoints.length === 2;
      const q = new URLSearchParams({ overview: 'full', geometries: 'geojson', steps: 'false', alternatives: alt ? '2' : 'false' });
      const body = await get(`${base}/${PATH[req.profile]}/route/v1/driving/${coordPath(req.waypoints.map((w) => w.coord))}?${q}`, signal);
      return parseRoute(body, req);
    },

    async matrix(coords, profile, signal) {
      if (coords.length > MAX) throw new RouteError('too-many-waypoints', `Máximo ${MAX} puntos`);
      const body = await get(`${base}/${PATH[profile]}/table/v1/driving/${coordPath(coords)}?annotations=duration,distance`, signal);
      if (!body.durations) throw new RouteError('no-route', 'Matriz vacía');
      return { provider: 'osrm-fossgis', profile, durations: body.durations, distances: body.distances ?? body.durations.map((r) => r.map(() => null)) } satisfies RouteMatrix;
    },
  };
}

/**
 * openrouteservice (HeiGIT) through a key-holding proxy.
 * Upstream: https://api.heigit.org/openrouteservice/v2/{directions|matrix}/…
 * (api.openrouteservice.org is deprecated; see docs/map-api-decision.md).
 * `base` is the proxy root that maps to https://api.heigit.org/openrouteservice.
 */
import { RouteError, type Coordinate, type RouteLeg, type RouteMatrix, type RouteProfile, type RouteResult } from '../types';
import { assertWaypoints, errorForStatus, fetchJson, quotaFrom, throttled, type RouteProvider, type RouteRequest } from '../route-provider';

const PROFILE: Record<RouteProfile, string> = { car: 'driving-car', foot: 'foot-walking', bike: 'cycling-regular' };
/** Snapping radius (m) per waypoint: approximate points may sit away from the road network. */
const SNAP_RADIUS = 5000;

type OrsError = { error?: { code?: number; message?: string } | string };
type OrsFeature = {
  geometry: { type: 'LineString'; coordinates: Coordinate[] };
  properties: { summary?: { distance?: number; duration?: number }; segments?: { distance?: number; duration?: number }[] };
};
type OrsDirections = OrsError & { type?: 'FeatureCollection'; features?: OrsFeature[] };
type OrsMatrix = OrsError & { durations?: (number | null)[][]; distances?: (number | null)[][] };

/** ORS internal error codes (docs: openrouteservice API reference, "Error codes"). */
export function orsError(status: number, body: OrsError | null, retryAfter: number | null = null): RouteError {
  const e = body && typeof body.error === 'object' ? body.error : null;
  const code = e?.code ?? 0;
  const msg = (e?.message ?? (typeof body?.error === 'string' ? body.error : '')) || `HTTP ${status}`;
  if (status === 403 && /disallowed|key|token/i.test(msg) && !/quota|limit/i.test(msg)) return new RouteError('unauthorized', msg, status);
  if (code === 2010 || /routable point/i.test(msg)) return new RouteError('out-of-coverage', msg, status);
  if (code === 2009 || /route could not be found/i.test(msg)) return new RouteError('no-route', msg, status);
  if (code === 2004 && /waypoint|coordinates/i.test(msg)) return new RouteError('too-many-waypoints', msg, status);
  if (code === 2004) return new RouteError('no-route', msg, status); // distance limit exceeded
  if (code === 2002 || code === 2003) return new RouteError('invalid-coordinates', msg, status);
  return status >= 400 ? errorForStatus(status, retryAfter) : new RouteError('unknown', msg, status);
}

const retryAfterOf = (h: Headers) => { const v = h.get('retry-after'); return v && Number.isFinite(+v) ? +v : null; };

export function parseDirections(body: OrsDirections, req: RouteRequest, quota: RouteResult['quota']): RouteResult {
  const feats = body.features ?? [];
  if (!feats.length || !feats[0].geometry?.coordinates?.length) throw new RouteError('no-route', 'Respuesta sin ruta');
  const main = feats[0];
  const segs = main.properties.segments ?? [];
  const legs: RouteLeg[] = req.waypoints.slice(1).map((w, i) => ({
    from: req.waypoints[i].id,
    to: w.id,
    distance: segs[i]?.distance ?? 0,
    duration: segs[i]?.duration ?? 0,
  }));
  const sum = main.properties.summary ?? {};
  return {
    provider: 'ors',
    profile: req.profile,
    waypoints: req.waypoints,
    geometry: { type: 'LineString', coordinates: main.geometry.coordinates },
    distance: sum.distance ?? legs.reduce((a, l) => a + l.distance, 0),
    duration: sum.duration ?? legs.reduce((a, l) => a + l.duration, 0),
    legs,
    alternatives: feats.slice(1).map((f) => ({
      geometry: { type: 'LineString' as const, coordinates: f.geometry.coordinates },
      distance: f.properties.summary?.distance ?? 0,
      duration: f.properties.summary?.duration ?? 0,
    })),
    attribution: '© openrouteservice.org by HeiGIT · Datos © OpenStreetMap contributors',
    quota,
    computedAt: Date.now(),
  };
}

export function createOrsProvider(base: string | null): RouteProvider {
  const queue = throttled(1600); // 40 requests/min sliding window → ≥ 1.5 s apart
  const post = async <T extends OrsError>(path: string, payload: unknown, signal?: AbortSignal) => {
    if (!base) throw new RouteError('not-configured', 'openrouteservice no está configurado (falta el proxy con la API key)');
    const r = await queue(() => fetchJson<T>(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, application/geo+json' },
      body: JSON.stringify(payload),
    }, signal));
    if (r.status >= 400 || r.body?.error) throw orsError(r.status, r.body, retryAfterOf(r.headers));
    if (!r.body) throw new RouteError('provider-down', 'Respuesta vacía del servicio de rutas', r.status);
    return r;
  };

  return {
    id: 'ors',
    label: 'openrouteservice (HeiGIT)',
    attribution: '© openrouteservice.org by HeiGIT · Datos © OpenStreetMap contributors',
    profiles: ['car', 'foot', 'bike'],
    maxWaypoints: 50,
    supportsAlternatives: true,
    minInterval: 1600,

    async route(req, signal) {
      assertWaypoints(req, 50);
      const alt = req.alternatives && req.waypoints.length === 2;
      const r = await post<OrsDirections>(`/v2/directions/${PROFILE[req.profile]}/geojson`, {
        coordinates: req.waypoints.map((w) => w.coord),
        radiuses: req.waypoints.map(() => SNAP_RADIUS),
        instructions: false,
        units: 'm',
        language: 'es',
        ...(alt ? { alternative_routes: { target_count: 2, share_factor: 0.6, weight_factor: 1.4 } } : {}),
      }, signal);
      return parseDirections(r.body, req, quotaFrom(r.headers));
    },

    async matrix(coords, profile, signal) {
      const r = await post<OrsMatrix>(`/v2/matrix/${PROFILE[profile]}`, {
        locations: coords,
        metrics: ['duration', 'distance'],
        units: 'm',
      }, signal);
      if (!r.body.durations) throw new RouteError('no-route', 'Matriz vacía');
      return { provider: 'ors', profile, durations: r.body.durations, distances: r.body.distances ?? r.body.durations.map((row) => row.map(() => null)) } satisfies RouteMatrix;
    },
  };
}

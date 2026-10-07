/**
 * Normalized geospatial models shared by the location service, the routing
 * providers, the optimizer and the map layers. Coordinates follow GeoJSON
 * order everywhere: [longitude, latitude].
 */

export type Coordinate = [lon: number, lat: number];

/** Transport profiles the UI offers; each provider maps them to its own names. */
export type RouteProfile = 'car' | 'foot' | 'bike';

export type WaypointRole = 'origin' | 'stop' | 'destination';

export interface RouteWaypoint {
  /** Place id from /data/places.json, or 'origin:*' for the starting point. */
  id: string;
  name: string;
  coord: Coordinate;
  role: WaypointRole;
  /** true when the point is approximate (OSM / SIC / DENUE / municipal seat), never an official point. */
  approximate: boolean;
}

export interface RouteLeg {
  from: string; // waypoint id
  to: string;
  distance: number; // metres
  duration: number; // seconds
}

export interface RouteGeometry {
  type: 'LineString';
  coordinates: Coordinate[];
}

export interface RouteAlternative {
  geometry: RouteGeometry;
  distance: number;
  duration: number;
}

export interface QuotaInfo {
  remaining: number | null;
  /** Unix seconds when the provider resets the window, if it says so. */
  reset: number | null;
}

export interface RouteResult {
  provider: string;
  profile: RouteProfile;
  waypoints: RouteWaypoint[];
  geometry: RouteGeometry;
  distance: number; // metres, whole route
  duration: number; // seconds, whole route
  legs: RouteLeg[];
  /** Extra routes (only when the provider supports them, origin → one destination). */
  alternatives: RouteAlternative[];
  attribution: string;
  quota: QuotaInfo | null;
  /** Epoch ms when the result was computed (cached results keep the original time). */
  computedAt: number;
}

export interface RouteMatrix {
  provider: string;
  profile: RouteProfile;
  /** seconds; null = unreachable */
  durations: (number | null)[][];
  /** metres; null = unreachable */
  distances: (number | null)[][];
}

export type RouteErrorCode =
  | 'offline'
  | 'not-configured'
  | 'unauthorized'
  | 'rate-limit'
  | 'quota'
  | 'timeout'
  | 'no-route'
  | 'invalid-coordinates'
  | 'out-of-coverage'
  | 'too-many-waypoints'
  | 'provider-down'
  | 'unknown';

export class RouteError extends Error {
  readonly code: RouteErrorCode;
  readonly status: number | null;
  readonly retryAfter: number | null;
  constructor(code: RouteErrorCode, message: string = code, status: number | null = null, retryAfter: number | null = null) {
    super(message);
    this.name = 'RouteError';
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

/** Visitor position, held in memory only (never stored, never sent to analytics). */
export interface GeoFix {
  coord: Coordinate;
  accuracy: number; // metres (95% radius as reported by the device)
  altitude: number | null; // metres, only when the device reports it
  altitudeAccuracy: number | null;
  timestamp: number; // epoch ms
}

export type LocationStatus =
  | 'idle'
  | 'requesting'
  | 'ok'
  | 'approximate' // fix obtained but accuracy is poor
  | 'stale' // last fix is old
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'unsupported'
  | 'insecure'; // page not served over HTTPS / localhost

export interface LocationState {
  status: LocationStatus;
  fix: GeoFix | null;
  watching: boolean;
  message: string | null;
}

export const isCoordinate = (c: unknown): c is Coordinate =>
  Array.isArray(c) && c.length === 2 &&
  typeof c[0] === 'number' && typeof c[1] === 'number' &&
  Number.isFinite(c[0]) && Number.isFinite(c[1]) &&
  c[0] >= -180 && c[0] <= 180 && c[1] >= -90 && c[1] <= 90;

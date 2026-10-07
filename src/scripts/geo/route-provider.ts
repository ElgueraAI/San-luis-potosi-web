/**
 * RouteProvider abstraction + provider selection.
 *
 * Selection (see docs/map-api-decision.md):
 *   PUBLIC_ROUTING_PROVIDER = auto | ors | osrm-fossgis | none     (default auto)
 *   auto → ors when a key-holding proxy exists, otherwise osrm-fossgis.
 *   ors proxy: PUBLIC_ROUTE_PROXY_URL (production serverless) or, in `astro dev`,
 *   the Vite proxy at /api/ors that adds ORS_API_KEY on the Node side.
 * No API key is ever read here: the browser only knows proxy URLs.
 */
import { RouteError, isCoordinate, type Coordinate, type QuotaInfo, type RouteMatrix, type RouteProfile, type RouteResult, type RouteWaypoint } from './types';

export interface RouteRequest {
  waypoints: RouteWaypoint[];
  profile: RouteProfile;
  alternatives: boolean;
}

export interface RouteProvider {
  readonly id: string;
  readonly label: string;
  readonly attribution: string;
  readonly profiles: RouteProfile[];
  readonly maxWaypoints: number;
  /** Alternatives are only requested for origin → single destination. */
  readonly supportsAlternatives: boolean;
  /** Minimum gap between two requests, enforced by the client (ms). */
  readonly minInterval: number;
  route(req: RouteRequest, signal?: AbortSignal): Promise<RouteResult>;
  matrix(coords: Coordinate[], profile: RouteProfile, signal?: AbortSignal): Promise<RouteMatrix>;
}

// ---------------------------------------------------------------- http ----
export const TIMEOUT_MS = 15000;

export function quotaFrom(h: Headers): QuotaInfo | null {
  const rem = h.get('x-ratelimit-remaining'), reset = h.get('x-ratelimit-reset');
  if (rem === null && reset === null) return null;
  const n = (v: string | null) => (v !== null && v.trim() !== '' && Number.isFinite(+v) ? +v : null);
  return { remaining: n(rem), reset: n(reset) };
}

export interface JsonResponse<T> { body: T; headers: Headers; status: number }

/**
 * fetch + timeout + offline detection. Resolves for any HTTP status that has a
 * JSON body (providers map their own error payloads); network failures become
 * RouteErrors here.
 */
export async function fetchJson<T>(url: string, init: RequestInit, signal?: AbortSignal): Promise<JsonResponse<T>> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new RouteError('offline', 'Sin conexión');
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    let body: unknown = null;
    try { body = await res.json(); } catch { /* non-JSON error page */ }
    return { body: body as T, headers: res.headers, status: res.status };
  } catch (e) {
    if (signal?.aborted) throw e; // superseded request, not an error to show
    if (timedOut) throw new RouteError('timeout', 'El proveedor tardó demasiado');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new RouteError('offline', 'Sin conexión');
    throw new RouteError('provider-down', 'No se pudo contactar al servicio de rutas');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Generic HTTP status → error code, used when the provider gave no better hint. */
export function errorForStatus(status: number, retryAfter: number | null = null): RouteError {
  if (status === 401) return new RouteError('unauthorized', 'Servicio de rutas sin credenciales válidas', status);
  if (status === 403) return new RouteError('quota', 'Se agotó la cuota diaria del servicio de rutas', status, retryAfter);
  if (status === 429) return new RouteError('rate-limit', 'Demasiadas solicitudes al servicio de rutas', status, retryAfter);
  if (status === 408 || status === 504) return new RouteError('timeout', 'El proveedor tardó demasiado', status);
  if (status >= 500) return new RouteError('provider-down', 'El servicio de rutas no está disponible', status);
  return new RouteError('unknown', `Error ${status}`, status);
}

export function assertWaypoints(req: RouteRequest, max: number): void {
  if (req.waypoints.length < 2) throw new RouteError('invalid-coordinates', 'Se necesitan al menos dos puntos');
  if (req.waypoints.length > max) throw new RouteError('too-many-waypoints', `Máximo ${max} puntos por ruta`);
  if (!req.waypoints.every((w) => isCoordinate(w.coord))) throw new RouteError('invalid-coordinates', 'Coordenadas no válidas');
}

/** Serializes requests per provider so the client never exceeds its rate. */
export function throttled(minInterval: number) {
  let last = 0;
  let chain: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(async () => {
      const wait = last + minInterval - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      last = Date.now();
      return fn();
    });
    chain = run.catch(() => undefined);
    return run;
  };
}

// ------------------------------------------------------------ selection ----
export type ProviderChoice = 'auto' | 'ors' | 'osrm-fossgis' | 'none';

export interface RoutingConfig {
  choice: ProviderChoice;
  /** Base URL that maps to https://api.heigit.org/openrouteservice (proxy adds the key). */
  orsBase: string | null;
}

export function readConfig(): RoutingConfig {
  const env = import.meta.env;
  const raw = String(env.PUBLIC_ROUTING_PROVIDER ?? 'auto').trim().toLowerCase();
  const choice: ProviderChoice = (['auto', 'ors', 'osrm-fossgis', 'none'] as const).find((c) => c === raw) ?? 'auto';
  const prodProxy = String(env.PUBLIC_ROUTE_PROXY_URL ?? '').trim().replace(/\/$/, '');
  // __ORS_DEV_PROXY__ is a boolean set by astro.config.mjs only under `astro dev` with ORS_API_KEY present
  const devProxy = typeof __ORS_DEV_PROXY__ !== 'undefined' && __ORS_DEV_PROXY__ ? '/api/ors' : '';
  return { choice, orsBase: prodProxy || devProxy || null };
}

let cached: Promise<RouteProvider | null> | null = null;

/** Provider for this page, or null when routing is switched off. */
export function getProvider(cfg: RoutingConfig = readConfig()): Promise<RouteProvider | null> {
  cached ??= (async () => {
    if (cfg.choice === 'none') return null;
    const wantOrs = cfg.choice === 'ors' || (cfg.choice === 'auto' && cfg.orsBase);
    if (wantOrs) {
      const { createOrsProvider } = await import('./providers/ors');
      // explicit `ors` without a proxy: provider exists but every call says "not configured"
      return createOrsProvider(cfg.orsBase);
    }
    const { createOsrmProvider } = await import('./providers/osrm');
    return createOsrmProvider();
  })();
  return cached;
}

/** Test hook. */
export function resetProviderForTests(): void { cached = null; }

/**
 * Route session: the one place that turns Mi Ruta (route-store ids) + a
 * starting point + a travel mode into a road route. Every map and panel on
 * the page subscribes to it, so a route is requested once and drawn
 * everywhere.
 *
 * Quota rules: requests only while `active`, debounced, cached
 * (route-cache.ts), superseded requests aborted, no automatic retry loop.
 * The visitor's position is used from memory and never persisted.
 */
import { route } from '../route-store';
import { geoLocation } from './location-service';
import { loadPlaces, routable, type Place } from './places';
import { getProvider, type RouteProvider } from './route-provider';
import { cacheGet, cacheSet, routeKey } from './route-cache';
import { optimizeOrder } from './route-optimizer';
import { haversine } from './format';
import { RouteError, type Coordinate, type RouteMatrix, type RouteProfile, type RouteResult, type RouteWaypoint } from './types';

export type Origin =
  | { kind: 'first' }
  | { kind: 'gps' }
  | { kind: 'place'; id: string }
  | { kind: 'point'; coord: Coordinate };

export type Phase = 'idle' | 'disabled' | 'insufficient' | 'loading' | 'ok' | 'error';

export interface Totals { distance: number; duration: number }

export interface Optimization {
  phase: 'idle' | 'loading' | 'ready' | 'error';
  /** Proposed full Mi Ruta order (routable stops reordered, unroutable kept at the end). */
  ids?: string[];
  current?: Totals;
  proposed?: Totals;
  changed?: boolean;
  error?: RouteError;
}

export interface SessionState {
  phase: Phase;
  provider: { id: string; label: string; attribution: string } | null;
  profile: RouteProfile;
  origin: Origin;
  originNote: string | null;
  waypoints: RouteWaypoint[];
  /** Saved places that cannot be routed (no point). */
  skipped: Place[];
  result: RouteResult | null;
  altIndex: number;
  error: RouteError | null;
  fromCache: boolean;
  /** GPS origin moved noticeably since the route was computed. */
  originMoved: boolean;
  optimization: Optimization;
}

type Listener = (s: SessionState) => void;
const PREFS = 'slp:mi-ruta:prefs:v1';
const DEBOUNCE_MS = 450;
const MOVED_M = 300;

function readPrefs(): { profile: RouteProfile; origin: Origin } {
  try {
    const p = JSON.parse(sessionStorage.getItem(PREFS) ?? '{}');
    const profile: RouteProfile = ['car', 'foot', 'bike'].includes(p.profile) ? p.profile : 'car';
    const origin: Origin = p.origin?.kind === 'place' && typeof p.origin.id === 'string' ? { kind: 'place', id: p.origin.id } : { kind: 'first' };
    return { profile, origin };
  } catch { return { profile: 'car', origin: { kind: 'first' } }; }
}
function writePrefs(profile: RouteProfile, origin: Origin) {
  // only non-personal origins are remembered (a municipality / place id); GPS and map points are not
  const o = origin.kind === 'place' ? origin : { kind: 'first' };
  try { sessionStorage.setItem(PREFS, JSON.stringify({ profile, origin: o })); } catch { /* ignore */ }
}

const ROLE = (i: number, n: number): RouteWaypoint['role'] => (i === 0 ? 'origin' : i === n - 1 ? 'destination' : 'stop');

class RouteSession {
  private places: Place[] = [];
  private byId = new Map<string, Place>();
  private provider: RouteProvider | null = null;
  private listeners = new Set<Listener>();
  private timer = 0;
  private ctrl: AbortController | null = null;
  private active = false;
  private ready: Promise<void> | null = null;
  private routedOrigin: Coordinate | null = null;
  private lastKey = '';
  state: SessionState;

  constructor() {
    const { profile, origin } = readPrefs();
    this.state = {
      phase: 'idle', provider: null, profile, origin, originNote: null, waypoints: [], skipped: [], result: null, altIndex: 0,
      error: null, fromCache: false, originMoved: false, optimization: { phase: 'idle' },
    };
  }

  /** Load data + provider once; safe to call from several modules. */
  init(placesUrl: string): Promise<void> {
    this.ready ??= (async () => {
      const [places, provider] = await Promise.all([loadPlaces(placesUrl), getProvider()]);
      this.places = places;
      this.byId = new Map(places.map((p) => [p.id, p]));
      this.provider = provider;
      this.set({ provider: provider ? { id: provider.id, label: provider.label, attribution: provider.attribution } : null });
      route.subscribe(() => this.changed(true));
      geoLocation.subscribe((l) => {
        if (this.state.origin.kind !== 'gps') return;
        if (l.status === 'denied' || l.status === 'unsupported' || l.status === 'insecure') {
          this.setOrigin({ kind: 'first' }, 'No hay acceso a tu ubicación: la ruta empieza en tu primer lugar guardado.');
          return;
        }
        if (l.fix && !this.routedOrigin) this.changed(false);
        else if (l.fix && this.routedOrigin) this.set({ originMoved: haversine(l.fix.coord, this.routedOrigin) > MOVED_M });
      });
      this.changed(false);
    })();
    this.ready.catch(() => { this.ready = null; });
    return this.ready;
  }

  subscribe(l: Listener): () => void { this.listeners.add(l); l(this.state); return () => { this.listeners.delete(l); }; }
  get(): SessionState { return this.state; }
  place(id: string): Place | undefined { return this.byId.get(id); }
  allPlaces(): Place[] { return this.places; }

  private set(patch: Partial<SessionState>) {
    this.state = { ...this.state, ...patch };
    // a failing view must not turn a good route into a routing error
    this.listeners.forEach((l) => { try { l(this.state); } catch (e) { queueMicrotask(() => { throw e; }); } });
  }

  /** Start requesting routes (Mi Ruta page: immediately; discovery map: when the overlay is switched on). */
  activate(): void { if (!this.active) { this.active = true; this.changed(false); } }
  deactivate(): void { this.active = false; this.ctrl?.abort(); clearTimeout(this.timer); }

  setProfile(p: RouteProfile) {
    if (p === this.state.profile) return;
    this.set({ profile: p, optimization: { phase: 'idle' } });
    writePrefs(p, this.state.origin);
    this.changed(false);
  }

  setOrigin(o: Origin, note: string | null = null) {
    this.set({ origin: o, originNote: note, optimization: { phase: 'idle' }, originMoved: false });
    this.routedOrigin = null;
    writePrefs(this.state.profile, o);
    this.changed(false);
  }

  selectAlternative(i: number) { this.set({ altIndex: i }); }

  /** «Reintentar ruta» and «Actualizar desde mi posición»: bypass the debounce, keep the cache. */
  retry() { this.lastKey = ''; this.set({ originMoved: false }); this.routedOrigin = null; this.compute(); }

  // ------------------------------------------------------------ waypoints --
  private originWaypoint(): RouteWaypoint | null {
    const o = this.state.origin;
    if (o.kind === 'gps') {
      const fix = geoLocation.get().fix;
      return fix ? { id: 'origin:gps', name: 'Tu ubicación', coord: fix.coord, role: 'origin', approximate: fix.accuracy > 1500 } : null;
    }
    if (o.kind === 'point') return { id: 'origin:point', name: 'Punto elegido en el mapa', coord: o.coord, role: 'origin', approximate: false };
    if (o.kind === 'place') {
      const p = this.byId.get(o.id);
      return routable(p) ? { id: `origin:${p.id}`, name: p.name, coord: p.coords, role: 'origin', approximate: p.status !== 'ready' } : null;
    }
    return null;
  }

  private build(): { waypoints: RouteWaypoint[]; stops: Place[]; skipped: Place[]; origin: RouteWaypoint | null } {
    const saved = route.get().map((id) => this.byId.get(id)).filter((p): p is Place => !!p);
    const stops = saved.filter(routable);
    const skipped = saved.filter((p) => !routable(p));
    const origin = this.originWaypoint();
    const pts: RouteWaypoint[] = [
      ...(origin ? [origin] : []),
      ...stops.map((p) => ({ id: p.id, name: p.name, coord: p.coords!, role: 'stop' as const, approximate: p.status !== 'ready' })),
    ];
    // two consecutive identical points (origin = first stop) would be a zero leg; drop the duplicate
    const dedup = pts.filter((w, i) => i === 0 || haversine(w.coord, pts[i - 1].coord) > 1);
    const waypoints = dedup.map((w, i) => ({ ...w, role: ROLE(i, dedup.length) }));
    return { waypoints, stops, skipped, origin };
  }

  private changed(storeChanged: boolean) {
    if (!this.ready || !this.places.length) return;
    const { waypoints, skipped } = this.build();
    const patch: Partial<SessionState> = { waypoints, skipped };
    if (storeChanged) patch.optimization = { phase: 'idle' };
    if (!this.provider) { this.set({ ...patch, phase: 'disabled', result: null }); return; }
    if (waypoints.length < 2) { this.ctrl?.abort(); this.set({ ...patch, phase: 'insufficient', result: null, error: null }); return; }
    // inputs changed: never show the previous route under the new stops / mode while debouncing
    if (this.active && this.keyFor(waypoints) !== this.lastKey) Object.assign(patch, { phase: 'loading', error: null });
    this.set(patch);
    if (!this.active) return;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.compute(), DEBOUNCE_MS);
  }

  private keyFor(waypoints: RouteWaypoint[]): string {
    const p = this.provider!;
    return routeKey('route', p.id, this.state.profile, waypoints.map((w) => w.coord), waypoints.length === 2 && p.supportsAlternatives);
  }

  private persistable(): boolean { return this.state.origin.kind !== 'gps' && this.state.origin.kind !== 'point'; }

  private async compute() {
    const p = this.provider;
    const { waypoints } = this.state;
    if (!p || waypoints.length < 2) return;
    const alternatives = waypoints.length === 2 && p.supportsAlternatives;
    const key = routeKey('route', p.id, this.state.profile, waypoints.map((w) => w.coord), alternatives);
    if (key === this.lastKey && this.state.phase === 'ok') return;
    const hit = cacheGet<RouteResult>(key);
    if (hit) {
      this.lastKey = key;
      this.routedOrigin = this.state.origin.kind === 'gps' ? waypoints[0].coord : null;
      // ids/names may differ (same coordinates, different saved place); keep current waypoints
      this.set({ phase: 'ok', result: { ...hit, waypoints }, error: null, altIndex: 0, fromCache: true });
      return;
    }
    this.ctrl?.abort();
    const ctrl = (this.ctrl = new AbortController());
    this.set({ phase: 'loading', error: null });
    try {
      const res = await p.route({ waypoints, profile: this.state.profile, alternatives }, ctrl.signal);
      if (ctrl.signal.aborted) return;
      cacheSet(key, res, this.persistable());
      this.lastKey = key;
      this.routedOrigin = this.state.origin.kind === 'gps' ? waypoints[0].coord : null;
      this.set({ phase: 'ok', result: res, error: null, altIndex: 0, fromCache: false });
    } catch (e) {
      if (ctrl.signal.aborted) return;
      const err = e instanceof RouteError ? e : new RouteError('unknown', String((e as Error)?.message ?? e));
      // never keep an old line on screen for a different set of stops
      this.set({ phase: 'error', error: err, result: null });
    }
  }

  // ---------------------------------------------------------- optimization --
  async optimize(): Promise<void> {
    const p = this.provider;
    const { waypoints, origin } = this.build();
    if (!p || waypoints.length < 3) return;
    this.set({ optimization: { phase: 'loading' } });
    const coords = waypoints.map((w) => w.coord);
    const key = routeKey('matrix', p.id, this.state.profile, coords);
    try {
      let m = cacheGet<RouteMatrix>(key);
      if (!m) {
        m = await p.matrix(coords, this.state.profile);
        cacheSet(key, m, this.persistable());
      }
      const fixedStart = !!origin && waypoints[0].id.startsWith('origin:');
      const opt = optimizeOrder(m.durations, fixedStart);
      if (!Number.isFinite(opt.cost)) throw new RouteError('no-route', 'Algún lugar no tiene conexión por carretera con los demás');
      const sum = (order: number[], mat: (number | null)[][]) => order.slice(1).reduce((s, b, i) => s + (mat[order[i]][b] ?? 0), 0);
      const identity = waypoints.map((_, i) => i);
      const current = { duration: sum(identity, m.durations), distance: sum(identity, m.distances) };
      const proposed = { duration: sum(opt.order, m.durations), distance: sum(opt.order, m.distances) };
      const routedIds = opt.order.map((i) => waypoints[i].id).filter((id) => !id.startsWith('origin:'));
      const rest = route.get().filter((id) => !routedIds.includes(id));
      const ids = [...routedIds, ...rest];
      const changed = ids.join() !== route.get().join();
      this.set({ optimization: { phase: 'ready', ids, current, proposed, changed } });
    } catch (e) {
      const err = e instanceof RouteError ? e : new RouteError('unknown', String((e as Error)?.message ?? e));
      this.set({ optimization: { phase: 'error', error: err } });
    }
  }

  /** «Optimizar recorrido» accepted: the only place the saved order is changed by the system. */
  applyOptimization() {
    const ids = this.state.optimization.ids;
    if (ids) route.set(ids);
    this.set({ optimization: { phase: 'idle' } });
  }

  /** «Conservar mi orden». */
  dismissOptimization() { this.set({ optimization: { phase: 'idle' } }); }
}

export const routeSession = new RouteSession();

/** Visitor-facing text for each error code (no technical jargon, no fake fallback). */
export function errorMessage(e: RouteError | null): string {
  switch (e?.code) {
    case 'offline': return 'Sin conexión a internet. Tus lugares siguen guardados; reintenta cuando vuelvas a tener señal.';
    case 'not-configured': return 'El cálculo de rutas por carretera no está configurado en este sitio.';
    case 'unauthorized': return 'El servicio de rutas rechazó la credencial del sitio.';
    case 'rate-limit': return 'El servicio de rutas recibió demasiadas solicitudes. Espera un minuto y reintenta.';
    case 'quota': return 'Se agotó la cuota gratuita diaria del servicio de rutas. Vuelve a intentarlo más tarde.';
    case 'timeout': return 'El servicio de rutas tardó demasiado en responder.';
    case 'no-route': return 'No existe un recorrido por carretera entre estos puntos con el modo elegido.';
    case 'out-of-coverage': return 'Uno de los puntos está demasiado lejos de un camino conocido.';
    case 'invalid-coordinates': return 'Una de las ubicaciones no es válida.';
    case 'too-many-waypoints': return 'Hay demasiadas paradas para un solo cálculo. Quita algunas e inténtalo de nuevo.';
    case 'provider-down': return 'El servicio de rutas no está disponible en este momento.';
    default: return 'Ocurrió un error inesperado con el servicio de rutas.';
  }
}

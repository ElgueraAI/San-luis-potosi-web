/**
 * Wires the navigation engine (navigation.ts) to the page: location service,
 * route-session (the only routing layer), visited-stops store, connectivity
 * and page visibility. One instance per page; only /mi-ruta/ calls init(),
 * so the discovery map never runs live navigation.
 *
 * Camera follow is view state (shared by the map and the card), kept here
 * rather than in the engine.
 */
import { NavigationEngine, isActive, type NavState } from './navigation';
import { geoLocation } from './location-service';
import { routeSession, type SessionState } from './route-session';
import { tripStore } from './trip-store';
import { route } from '../route-store';
import { routable } from './places';

/** On return to the foreground, a fix older than this is refreshed. */
export const FRESH_ON_RESUME_MS = 30000;
const TICK_MS = 5000;

export type Camera = 'follow' | 'free';
type CamListener = (c: Camera) => void;

class NavController {
  /** stops skipped with «Continuar» (memory only, cleared on reset) */
  private skipped = new Set<string>();
  private inited = false;
  private lastResult: unknown = null;
  private lastError: unknown = null;
  private tickTimer = 0;
  private camListeners = new Set<CamListener>();
  camera: Camera = 'follow';

  readonly engine = new NavigationEngine({
    now: () => Date.now(),
    isOnline: () => typeof navigator === 'undefined' || navigator.onLine !== false,
    reroute: () => routeSession.retry(),
    markVisited: (id) => tripStore.markVisited(id),
    skip: (id) => { this.skipped.add(id); this.syncTrip(); },
  });

  get(): NavState { return this.engine.get(); }
  subscribe(l: (s: NavState) => void) { return this.engine.subscribe(l); }

  setCamera(c: Camera) { if (c !== this.camera) { this.camera = c; this.camListeners.forEach((l) => l(c)); } }
  onCamera(l: CamListener) { this.camListeners.add(l); l(this.camera); return () => { this.camListeners.delete(l); }; }

  /** Call after routeSession.init(). Safe to call twice. */
  init(): void {
    if (this.inited) return;
    this.inited = true;
    this.syncTrip();
    route.subscribe(() => this.syncTrip());
    tripStore.subscribe(() => this.syncTrip());
    routeSession.subscribe((s) => this.onSession(s));
    geoLocation.subscribe((l) => {
      if (!isActive(this.get().status)) return;
      if (l.fix) this.engine.update(l.fix);
      if (l.status === 'denied' || l.status === 'unsupported' || l.status === 'insecure') {
        this.engine.fail('location', l.message ?? 'Sin acceso a tu ubicación.');
      }
    });
    addEventListener('online', () => this.engine.setOnline(true));
    addEventListener('offline', () => this.engine.setOnline(false));
    document.addEventListener('visibilitychange', () => this.onVisibility());
    this.engine.subscribe((s) => {
      // timers and the position watch only live while a trip is active
      if (isActive(s.status) && !this.tickTimer) this.tickTimer = window.setInterval(() => this.engine.tick(), TICK_MS);
      if (!isActive(s.status) && this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = 0; }
    });
  }

  /** Trip = routable saved places; done = visited (stored) ∪ skipped (this session). */
  private syncTrip() {
    const ids = route.get().filter((id) => routable(routeSession.place(id)));
    const done = ids.filter((id) => tripStore.isVisited(id) || this.skipped.has(id));
    this.engine.setTrip(ids.length, done);
    routeSession.setExcluded([...tripStore.visitedIds(), ...this.skipped]);
  }

  private onSession(s: SessionState) {
    if (!isActive(this.get().status)) return;
    // only a route that starts at the visitor is a navigation route
    if (s.phase === 'ok' && s.result && s.result !== this.lastResult && s.result.waypoints[0]?.id === 'origin:gps') {
      this.lastResult = s.result;
      this.engine.setRoute(s.result);
    } else if (s.phase === 'error' && s.error && s.error !== this.lastError) {
      this.lastError = s.error;
      this.engine.routeFailed(s.error);
    }
    // 'insufficient' is not handled here: start() only runs with pending routable stops, and the
    // planning state emitted while the GPS origin is being set would be a false failure
  }

  /** «Iniciar recorrido» / «Reanudar recorrido»: the only place permission is requested. */
  async start(): Promise<void> {
    this.syncTrip();
    this.engine.setOnline(navigator.onLine !== false);
    this.engine.start();
    if (this.get().status !== 'starting') return;
    this.setCamera('follow');
    this.lastResult = null;
    this.lastError = null;
    const fix = await geoLocation.locate({ maximumAge: 10000 });
    if (this.get().status !== 'starting') return; // stopped meanwhile
    if (!fix) {
      this.engine.fail('location', geoLocation.get().message ?? 'No pudimos obtener tu ubicación.');
      return;
    }
    this.engine.update(fix);
    geoLocation.follow();
    routeSession.setOrigin({ kind: 'gps' });
  }

  pause() { this.engine.pause('user'); geoLocation.stopFollowing(); }
  resume() { this.engine.resume('user'); geoLocation.follow(); }

  stop() {
    geoLocation.stopFollowing();
    this.engine.stop();
  }

  reroute() { return this.engine.manualReroute(); }
  markVisited() { this.engine.markVisited(); if (this.get().status === 'finished') geoLocation.stopFollowing(); }
  continueNext() { this.engine.continueNext(); if (this.get().status === 'finished') geoLocation.stopFollowing(); }

  /** «Restablecer recorrido»: visited and skipped stops are routed again. */
  reset() {
    if (isActive(this.get().status)) this.stop();
    this.skipped.clear();
    tripStore.reset();
    this.engine.stop();
  }

  private onVisibility() {
    const s = this.get();
    if (!isActive(s.status)) return;
    if (document.visibilityState === 'hidden') { this.engine.pause('background'); return; }
    // back in the foreground: browsers may have suspended the watch; check freshness first
    const fix = geoLocation.get().fix;
    const old = !fix || Date.now() - fix.timestamp > FRESH_ON_RESUME_MS;
    this.engine.resume('background');
    if (this.get().pauseReason === 'user') return;
    if (geoLocation.get().watching) { geoLocation.stopFollowing(); geoLocation.follow(); }
    if (old) void geoLocation.locate({ maximumAge: 0 });
  }
}

export const navigation = new NavController();

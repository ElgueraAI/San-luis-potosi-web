/**
 * Live navigation engine for Mi Ruta: progress along the road route,
 * remaining distance / time, ETA, off-route detection, controlled rerouting
 * and arrival at each stop. It is a plain state machine with no DOM and no
 * network: time, connectivity and side effects come in through `NavPorts`,
 * so the rules below are unit-tested deterministically (tests/geo/).
 * nav-controller.ts wires it to the location service, route-session and the
 * visited-stops store.
 *
 *   idle ──start──▶ starting ──route──▶ navigating ◀──────────────┐
 *                      │                 │   ▲   │  arrival       │ route ok
 *                      ▼ no route        │   │   ▼                │
 *                    error     off-route ─┘   │  arrived-stop ──continue
 *                                 │  reroute  │        │ last stop
 *                                 ▼           │        ▼
 *                             rerouting ──────┘     finished
 *   any active state ──pause / page hidden──▶ paused ──resume──▶ previous state
 *
 * No turn-by-turn: the extension point is `RouteResult` (a future provider
 * call with steps) plus `NavProgress.legIndex`; this engine would only gain a
 * "next maneuver" field computed from the same snap.
 */
import { haversine } from './format';
import { buildLine, legBoundaries, snapToLine, type RouteLine, type Snap } from './route-geometry';
import type { Coordinate, GeoFix, RouteError, RouteProfile, RouteResult, RouteWaypoint } from './types';

export type NavStatus = 'idle' | 'starting' | 'navigating' | 'paused' | 'off-route' | 'rerouting' | 'arrived-stop' | 'finished' | 'error';
export type GpsQuality = 'none' | 'good' | 'fair' | 'poor' | 'lost';
export type RerouteBlock = null | 'cooldown' | 'limit' | 'offline';

// ---- rules (documented in docs/map-api-decision.md § Live navigation) ----------
/** Off-route when farther than max(OFF_ROUTE_MIN_M, OFF_ROUTE_ACC_FACTOR × accuracy). */
export const OFF_ROUTE_MIN_M = 60;
export const OFF_ROUTE_ACC_FACTOR = 1.5;
/** Confirmation: this many consecutive valid off-route readings… */
export const OFF_ROUTE_READINGS = 3;
/** …or this long off route (with at least two readings). */
export const OFF_ROUTE_MS = 15000;
export const REROUTE_COOLDOWN_MS = 45000;
export const MAX_AUTO_REROUTES = 6;
/** Readings worse than this never drive a decision (off-route, reroute, arrival). */
export const DECISION_MAX_ACCURACY_M = 150;
/** Readings worse than this do not even move the progress. */
export const PROGRESS_MAX_ACCURACY_M = 500;
/** No reading for this long while navigating = GPS signal lost. */
export const GPS_LOST_MS = 30000;
/** Base arrival radius per mode; the reading's accuracy is added up to the same amount again. */
export const ARRIVAL_RADIUS_M: Record<RouteProfile, number> = { car: 80, bike: 50, foot: 35 };

export interface NavPorts {
  now(): number;
  isOnline(): boolean;
  /** Ask the routing layer for a route from the current position (route-session.retry). */
  reroute(): void;
  /** Persist «Marcar como visitado» (place id only, never a position). */
  markVisited(id: string): void;
  /** «Continuar» without marking: skip this stop for the rest of the session (memory only). */
  skip(id: string): void;
}

export interface NavStop { id: string; name: string; coord: Coordinate; approximate: boolean }

export interface NavProgress {
  /** metres along the current route */
  along: number;
  /** 0..1 of the current route (resets when a new route is adopted) */
  routeFraction: number;
  /** 0..1 of the whole trip: completed stops + share of the current leg */
  tripFraction: number;
  distanceFromRoute: number;
  distanceToNext: number;
  timeToNext: number;
  remainingDistance: number;
  remainingTime: number;
  /** epoch ms; provider estimate, no live traffic */
  etaNext: number;
  etaEnd: number;
  legIndex: number;
}

export interface NavSummary { startedAt: number; endedAt: number; visited: string[]; skipped: string[]; travelled: number }

export interface NavState {
  status: NavStatus;
  pauseReason: 'user' | 'background' | null;
  route: RouteResult | null;
  next: NavStop | null;
  arrived: (NavStop & { visited: boolean }) | null;
  progress: NavProgress | null;
  fix: GeoFix | null;
  gps: GpsQuality;
  online: boolean;
  autoReroutes: number;
  rerouteBlock: RerouteBlock;
  /** last routing failure while a previous route is kept on screen */
  routeError: RouteError | null;
  /** fatal problem in `error` status */
  error: { kind: 'location' | 'route' | 'no-stops'; message: string } | null;
  totalStops: number;
  doneStops: number;
  summary: NavSummary | null;
}

type Listener = (s: NavState) => void;
const ACTIVE: NavStatus[] = ['starting', 'navigating', 'off-route', 'rerouting', 'arrived-stop', 'paused'];
export const isActive = (s: NavStatus) => ACTIVE.includes(s);

export function qualityOf(accuracy: number): GpsQuality {
  return accuracy <= 30 ? 'good' : accuracy <= DECISION_MAX_ACCURACY_M ? 'fair' : 'poor';
}

export class NavigationEngine {
  private ports: NavPorts;
  private listeners = new Set<Listener>();
  private lineCache: RouteLine | null = null;
  private bounds: number[] = [];
  private hint: Snap | null = null;
  private offCount = 0;
  private offSince: number | null = null;
  private lastRerouteAt: number | null = null;
  private resumeTo: NavStatus = 'navigating';
  private done = new Set<string>();
  private visited: string[] = [];
  private skipped: string[] = [];
  private legRef = new Map<string, number>();
  /** last on-route snapped point (memory only) for the trip summary distance */
  private lastPoint: Coordinate | null = null;
  private travelledM = 0;
  private startedAt = 0;
  state: NavState;

  constructor(ports: NavPorts) {
    this.ports = ports;
    this.state = this.blank();
  }

  private blank(): NavState {
    return {
      status: 'idle', pauseReason: null, route: null, next: null, arrived: null, progress: null, fix: null, gps: 'none',
      online: true, autoReroutes: 0, rerouteBlock: null, routeError: null, error: null, totalStops: 0, doneStops: 0, summary: null,
    };
  }

  get(): NavState { return this.state; }
  /** Current route polyline with cumulative distances (for drawing the travelled part). */
  get line(): RouteLine | null { return this.lineCache; }
  subscribe(l: Listener): () => void { this.listeners.add(l); l(this.state); return () => { this.listeners.delete(l); }; }

  private set(patch: Partial<NavState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => { try { l(this.state); } catch (e) { queueMicrotask(() => { throw e; }); } });
  }

  // ------------------------------------------------------------------ trip --
  /** Stops of the trip (routable saved places) and those already done (visited ∪ skipped). */
  setTrip(total: number, done: Iterable<string>) {
    this.done = new Set(done);
    this.set({ totalStops: total, doneStops: Math.min(total, this.done.size) });
  }

  private remainingStops(): number { return Math.max(0, this.state.totalStops - this.state.doneStops); }

  start(): void {
    if (isActive(this.state.status)) return;
    if (this.remainingStops() === 0) {
      this.set({ status: 'error', error: { kind: 'no-stops', message: 'No quedan lugares pendientes en tu ruta.' } });
      return;
    }
    this.lineCache = null; this.bounds = []; this.hint = null; this.offCount = 0; this.offSince = null;
    this.lastRerouteAt = null; this.visited = []; this.skipped = []; this.legRef.clear(); this.lastPoint = null; this.travelledM = 0;
    this.startedAt = this.ports.now();
    this.set({
      status: 'starting', pauseReason: null, route: null, next: null, arrived: null, progress: null, autoReroutes: 0,
      rerouteBlock: null, routeError: null, error: null, summary: null, online: this.ports.isOnline(),
    });
  }

  /** «Terminar recorrido»: back to planning; visited stops stay stored. */
  stop(): void {
    this.lineCache = null;
    this.set({ ...this.blank(), totalStops: this.state.totalStops, doneStops: this.state.doneStops, online: this.state.online });
  }

  fail(kind: 'location' | 'route', message: string): void {
    if (!isActive(this.state.status)) return;
    // a lost position after the route exists is not fatal: keep the route, say so
    if (kind === 'location' && this.lineCache && this.state.status !== 'starting') { this.set({ gps: 'lost' }); return; }
    this.set({ status: 'error', error: { kind, message } });
  }

  // ----------------------------------------------------------------- route --
  /** A route from the routing layer (first route, reroute, or recompute after a stop). */
  setRoute(result: RouteResult): void {
    if (!isActive(this.state.status) || result === this.state.route) return;
    this.lineCache = buildLine(result.geometry.coordinates);
    this.bounds = legBoundaries(this.lineCache, result.waypoints.map((w) => w.coord));
    this.hint = null; this.offCount = 0; this.offSince = null;
    const st = this.state.status;
    const status: NavStatus = st === 'starting' || st === 'rerouting' || st === 'off-route' ? 'navigating' : st;
    if (st === 'paused' && (this.resumeTo === 'rerouting' || this.resumeTo === 'starting' || this.resumeTo === 'off-route')) this.resumeTo = 'navigating';
    this.set({ status, route: result, routeError: null, rerouteBlock: null });
    if (this.state.fix) this.update(this.state.fix, true);
    else this.set({ next: this.nextStop()?.stop ?? null });
  }

  /** Routing failed: keep the previous route (if any) and report it. */
  routeFailed(err: RouteError): void {
    const st = this.state.status;
    if (!isActive(st)) return;
    if (!this.lineCache) {
      if (st === 'starting' || st === 'rerouting') this.set({ status: 'error', error: { kind: 'route', message: err.message }, routeError: err });
      return;
    }
    this.set({ status: st === 'rerouting' ? 'off-route' : st, routeError: err });
  }

  private nextStop(): { stop: NavStop; i: number } | null {
    const wps = this.state.route?.waypoints ?? [];
    for (let i = 1; i < wps.length; i++) {
      const w: RouteWaypoint = wps[i];
      if (!w.id.startsWith('origin:') && !this.done.has(w.id)) return { stop: { id: w.id, name: w.name, coord: w.coord, approximate: w.approximate }, i };
    }
    return null;
  }

  // ------------------------------------------------------------ positions --
  update(fix: GeoFix, force = false): void {
    if (!force && fix === this.state.fix) return;
    const now = this.ports.now();
    const st = this.state.status;
    const patch: Partial<NavState> = { fix, gps: qualityOf(fix.accuracy) };
    if (st === 'paused' || st === 'starting' || !isActive(st) || !this.lineCache || !this.state.route) { this.set(patch); return; }
    if (fix.accuracy > PROGRESS_MAX_ACCURACY_M) { this.set(patch); return; }

    const line = this.lineCache;
    const snap = snapToLine(line, fix.coord, this.hint, Math.max(150, fix.accuracy * 3));
    if (!snap) { this.set(patch); return; }
    const threshold = Math.max(OFF_ROUTE_MIN_M, OFF_ROUTE_ACC_FACTOR * fix.accuracy);
    const off = snap.distance > threshold;
    const decides = fix.accuracy <= DECISION_MAX_ACCURACY_M;
    let status: NavStatus = st;

    if (!off) {
      this.hint = snap;
      // straight distance between consecutive on-route points (both on the road); survives route swaps
      if (this.lastPoint) this.travelledM += haversine(this.lastPoint, snap.point);
      this.lastPoint = snap.point;
    }

    // ---- off-route detection: never from one reading, never from a poor one ----
    if (decides && st !== 'arrived-stop') {
      if (off) {
        this.offCount += 1;
        this.offSince ??= now;
        const confirmed = this.offCount >= OFF_ROUTE_READINGS || (this.offCount >= 2 && now - this.offSince >= OFF_ROUTE_MS);
        if (confirmed && st !== 'rerouting') {
          status = 'off-route';
          const block = this.rerouteBlockAt(now);
          patch.rerouteBlock = block;
          if (!block) {
            this.lastRerouteAt = now;
            patch.autoReroutes = this.state.autoReroutes + 1;
            status = 'rerouting';
          }
        }
      } else {
        this.offCount = 0;
        this.offSince = null;
        if (st === 'off-route') { status = 'navigating'; patch.rerouteBlock = null; }
      }
    }

    // ---- progress ------------------------------------------------------------
    const nx = this.nextStop();
    patch.next = nx?.stop ?? null;
    if (nx) patch.progress = this.progressFor(snap, nx.i, nx.stop.id, now);

    // ---- arrival ---------------------------------------------------------------
    if (nx && decides && (status === 'navigating' || status === 'off-route')) {
      const base = ARRIVAL_RADIUS_M[this.state.route.profile] ?? 80;
      const radius = base + Math.min(fix.accuracy, base);
      const direct = haversine(fix.coord, nx.stop.coord);
      const legEnd = this.bounds[nx.i] ?? line.total;
      if (direct <= radius || (snap.along >= legEnd - radius && snap.distance <= radius)) {
        status = 'arrived-stop';
        patch.arrived = { ...nx.stop, visited: false };
        patch.rerouteBlock = null;
        this.offCount = 0; this.offSince = null;
      }
    }

    patch.status = status;
    this.set(patch);
    if (status === 'rerouting' && st !== 'rerouting') this.ports.reroute();
  }

  private rerouteBlockAt(now: number): RerouteBlock {
    if (!this.ports.isOnline()) return 'offline';
    if (this.state.autoReroutes >= MAX_AUTO_REROUTES) return 'limit';
    if (this.lastRerouteAt !== null && now - this.lastRerouteAt < REROUTE_COOLDOWN_MS) return 'cooldown';
    return null;
  }

  private progressFor(snap: Snap, i: number, id: string, now: number): NavProgress {
    const line = this.lineCache!;
    const route = this.state.route!;
    const legEnd = this.bounds[i] ?? line.total;
    const legStart = this.bounds[i - 1] ?? 0;
    const distanceToNext = Math.max(0, legEnd - snap.along);
    const legLen = Math.max(1, legEnd - legStart);
    // provider time for the leg, scaled by the share of the leg still ahead
    const legTime = route.legs[i - 1]?.duration ?? 0;
    const timeToNext = legTime * Math.min(1, distanceToNext / legLen);
    const later = route.legs.slice(i).reduce((s, l) => s + l.duration, 0);
    // trip bar: the reference length of a leg is the longest seen for that stop, so a reroute never jumps it backwards much
    const ref = Math.max(this.legRef.get(id) ?? 0, distanceToNext, 1);
    this.legRef.set(id, ref);
    const legShare = 1 - distanceToNext / ref;
    const total = Math.max(1, this.state.totalStops);
    return {
      along: snap.along,
      routeFraction: line.total > 0 ? Math.min(1, snap.along / line.total) : 0,
      tripFraction: Math.min(1, (this.state.doneStops + legShare) / total),
      distanceFromRoute: snap.distance,
      distanceToNext,
      timeToNext,
      remainingDistance: Math.max(0, line.total - snap.along),
      remainingTime: timeToNext + later,
      etaNext: now + timeToNext * 1000,
      etaEnd: now + (timeToNext + later) * 1000,
      legIndex: i - 1,
    };
  }

  /** Periodic check (every few seconds while active): flags a silent GPS. */
  tick(): void {
    const s = this.state;
    if (!isActive(s.status) || s.status === 'paused' || !s.fix) return;
    if (this.ports.now() - s.fix.timestamp > GPS_LOST_MS && s.gps !== 'lost') this.set({ gps: 'lost' });
  }

  // -------------------------------------------------------------- controls --
  /** «Recalcular ruta»: always allowed when online and nothing is in flight; not counted as automatic. */
  manualReroute(): boolean {
    const st = this.state.status;
    if (!isActive(st) || st === 'rerouting' || st === 'starting' || st === 'paused') return false;
    if (!this.ports.isOnline()) { this.set({ rerouteBlock: 'offline' }); return false; }
    this.set({ status: 'rerouting', rerouteBlock: null, routeError: null, arrived: null });
    this.ports.reroute();
    return true;
  }

  setOnline(online: boolean): void {
    // coming back online does not reroute by itself: the next confirmed off-route reading decides
    this.set({ online, rerouteBlock: online && this.state.rerouteBlock === 'offline' ? null : this.state.rerouteBlock });
  }

  pause(reason: 'user' | 'background' = 'user'): void {
    const st = this.state.status;
    if (!isActive(st) || (st === 'paused' && (reason === 'background' || this.state.pauseReason === 'user'))) return;
    if (st !== 'paused') this.resumeTo = st;
    this.set({ status: 'paused', pauseReason: reason });
  }

  /** Resume after «Reanudar» or when the page is visible again. Old off-route evidence is discarded. */
  resume(reason: 'user' | 'background' = 'user'): void {
    if (this.state.status !== 'paused') return;
    if (reason === 'background' && this.state.pauseReason === 'user') return;
    this.offCount = 0; this.offSince = null;
    const to = this.resumeTo === 'paused' ? 'navigating' : this.resumeTo;
    this.set({ status: this.lineCache || to === 'starting' ? to : 'starting', pauseReason: null });
  }

  /** «Marcar como visitado». */
  markVisited(): void {
    const a = this.state.arrived;
    if (this.state.status !== 'arrived-stop' || !a || a.visited) return;
    this.ports.markVisited(a.id);
    this.done.add(a.id);
    this.visited.push(a.id);
    const doneStops = Math.min(this.state.totalStops, this.done.size);
    this.set({ arrived: { ...a, visited: true }, doneStops });
    if (this.remainingStops() === 0) this.finish();
  }

  /** «Continuar al siguiente lugar» (skips the stop for this session if it was not marked). */
  continueNext(): void {
    const a = this.state.arrived;
    if (this.state.status !== 'arrived-stop' || !a) return;
    if (!a.visited) { this.ports.skip(a.id); this.done.add(a.id); this.skipped.push(a.id); }
    const doneStops = Math.min(this.state.totalStops, this.done.size);
    if (Math.max(0, this.state.totalStops - doneStops) === 0) { this.set({ doneStops }); this.finish(); return; }
    // one patch: never an arrived-stop state without its stop
    // the current geometry already continues to the next stop; route-session refreshes it in the background
    this.set({ status: 'navigating', arrived: null, doneStops, next: this.nextStop()?.stop ?? null });
    if (this.state.fix) this.update(this.state.fix, true);
  }

  private finish(): void {
    this.set({
      status: 'finished', arrived: null, next: null, progress: null,
      summary: { startedAt: this.startedAt, endedAt: this.ports.now(), visited: [...this.visited], skipped: [...this.skipped], travelled: this.travelledM },
    });
  }
}

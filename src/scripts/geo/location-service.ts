/**
 * Visitor location through the Web Geolocation API.
 *  - Never requested on load: only `locate()` (a button) asks for permission.
 *  - The fix lives in memory for this page view. It is not written to storage,
 *    not sent anywhere and not added to any dataset.
 *  - `follow()` starts watchPosition; `stopFollowing()` / `dispose()` clear it.
 */
import type { GeoFix, LocationState, LocationStatus } from './types';

/** Above this radius the fix is shown as approximate (Wi-Fi / cell positioning). */
export const APPROX_ACCURACY_M = 1500;
/** A fix older than this is flagged as stale. */
export const STALE_AFTER_MS = 5 * 60 * 1000;
/**
 * Outlier filter (deliberately simple, no smoothing so the dot never lags):
 * a reading that implies more than MAX_SPEED_MS from the previous fix AND
 * reports a clearly worse accuracy is dropped, at most MAX_REJECTS times in a
 * row (after that it is accepted: the visitor really moved).
 */
export const MAX_SPEED_MS = 70;
export const MAX_REJECTS = 3;

type Listener = (s: LocationState) => void;

const MESSAGES: Partial<Record<LocationStatus, string>> = {
  denied: 'No diste permiso para usar tu ubicación. Puedes elegir un punto de partida manualmente.',
  unavailable: 'Tu dispositivo no pudo determinar la ubicación en este momento.',
  timeout: 'La ubicación tardó demasiado en llegar. Inténtalo de nuevo o elige un punto de partida.',
  unsupported: 'Este navegador no ofrece geolocalización. Elige un punto de partida manualmente.',
  insecure: 'La ubicación solo funciona en una conexión segura (https).',
};

function fromPosition(p: GeolocationPosition): GeoFix {
  const c = p.coords;
  return {
    coord: [c.longitude, c.latitude],
    accuracy: c.accuracy,
    // coords.altitude is null when the device does not measure it; never invent one
    altitude: typeof c.altitude === 'number' && Number.isFinite(c.altitude) ? c.altitude : null,
    altitudeAccuracy: typeof c.altitudeAccuracy === 'number' && Number.isFinite(c.altitudeAccuracy) ? c.altitudeAccuracy : null,
    // heading is NaN when the device is still, null when unsupported: both become null
    heading: typeof c.heading === 'number' && Number.isFinite(c.heading) ? c.heading : null,
    speed: typeof c.speed === 'number' && Number.isFinite(c.speed) && c.speed >= 0 ? c.speed : null,
    timestamp: p.timestamp || Date.now(),
  };
}

export function statusForFix(fix: GeoFix, now = Date.now()): LocationStatus {
  if (now - fix.timestamp > STALE_AFTER_MS) return 'stale';
  return fix.accuracy > APPROX_ACCURACY_M ? 'approximate' : 'ok';
}

/** true when `next` should be ignored as a GPS jump (see MAX_SPEED_MS). */
export function isOutlier(prev: GeoFix | null, next: GeoFix, rejectsInRow: number): boolean {
  if (!prev || rejectsInRow >= MAX_REJECTS) return false;
  if (next.timestamp < prev.timestamp) return true; // out-of-order delivery
  const dt = Math.max(1, next.timestamp - prev.timestamp) / 1000;
  const lat = (prev.coord[1] * Math.PI) / 180;
  const dx = (next.coord[0] - prev.coord[0]) * 111320 * Math.cos(lat), dy = (next.coord[1] - prev.coord[1]) * 111320;
  const jump = Math.hypot(dx, dy);
  return jump / dt > MAX_SPEED_MS && next.accuracy > Math.max(2 * prev.accuracy, 50);
}

function errorStatus(e: GeolocationPositionError): LocationStatus {
  if (e.code === 1) return 'denied';
  if (e.code === 3) return 'timeout';
  return 'unavailable';
}

class LocationService {
  private state: LocationState = { status: 'idle', fix: null, watching: false, message: null };
  private listeners = new Set<Listener>();
  private watchId: number | null = null;
  private staleTimer: ReturnType<typeof setTimeout> | undefined;
  private rejects = 0;

  get(): LocationState { return this.state; }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    l(this.state);
    return () => { this.listeners.delete(l); };
  }

  private set(patch: Partial<LocationState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => { try { l(this.state); } catch (e) { queueMicrotask(() => { throw e; }); } });
  }

  private supported(): boolean {
    if (!('geolocation' in navigator) || !navigator.geolocation) {
      this.set({ status: 'unsupported', message: MESSAGES.unsupported! });
      return false;
    }
    if (typeof isSecureContext === 'boolean' && !isSecureContext) {
      this.set({ status: 'insecure', message: MESSAGES.insecure! });
      return false;
    }
    return true;
  }

  private accept(p: GeolocationPosition) {
    const fix = fromPosition(p);
    if (isOutlier(this.state.fix, fix, this.rejects)) { this.rejects += 1; return; }
    this.rejects = 0;
    this.set({ fix, status: statusForFix(fix), message: null });
    clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => {
      if (this.state.fix === fix) this.set({ status: 'stale' });
    }, STALE_AFTER_MS + 1000);
  }

  private reject(e: GeolocationPositionError) {
    const status = errorStatus(e);
    // keep an earlier fix if we have one: it is still useful, just older
    this.set({ status: this.state.fix && status !== 'denied' ? statusForFix(this.state.fix) : status, message: MESSAGES[status] ?? null });
    if (status === 'denied') { this.stopFollowing(); this.set({ fix: null, status: 'denied' }); }
  }

  /** One explicit request (button). Resolves with the fix or null. */
  locate(opts: { maximumAge?: number } = {}): Promise<GeoFix | null> {
    if (!this.supported()) return Promise.resolve(null);
    this.set({ status: 'requesting', message: null });
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        // an explicit request is always taken (the visitor asked for it), never filtered as a jump
      (p) => { this.rejects = MAX_REJECTS; this.accept(p); resolve(this.state.fix); },
        (e) => { this.reject(e); resolve(null); },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: opts.maximumAge ?? 60000 },
      );
    });
  }

  /** Keep the position updated while the visitor moves (explicit toggle). */
  follow(): void {
    if (this.watchId !== null || !this.supported()) return;
    if (!this.state.fix) this.set({ status: 'requesting' });
    this.watchId = navigator.geolocation.watchPosition(
      (p) => this.accept(p),
      (e) => this.reject(e),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 },
    );
    this.set({ watching: true });
  }

  stopFollowing(): void {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
    if (this.state.watching) this.set({ watching: false });
  }

  /** Forget the position (button «Olvidar mi ubicación»). */
  forget(): void {
    this.stopFollowing();
    clearTimeout(this.staleTimer);
    this.rejects = 0;
    this.set({ status: 'idle', fix: null, message: null });
  }

  dispose(): void {
    this.stopFollowing();
    clearTimeout(this.staleTimer);
    this.listeners.clear();
  }
}

/** One instance per page: every map and panel on the page share the same fix. */
export const geoLocation = new LocationService();
if (typeof addEventListener === 'function') addEventListener('pagehide', () => geoLocation.stopFollowing());

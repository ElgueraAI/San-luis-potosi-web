/**
 * Short-lived cache for computed routes and matrices, to protect the free
 * quota: identical requests (same provider, profile, ordered points,
 * alternatives flag) are answered locally for TTL_MS.
 *
 * Memory always; sessionStorage only for requests that do not contain the
 * visitor's own position (`persist: false`), so a GPS fix never lands in
 * storage.
 */
import type { Coordinate, RouteProfile } from './types';

export const TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 40;
const PREFIX = 'slp:route-cache:';

type Entry<T> = { t: number; v: T };
const mem = new Map<string, Entry<unknown>>();

export function routeKey(kind: 'route' | 'matrix', provider: string, profile: RouteProfile, coords: Coordinate[], alternatives = false): string {
  // 5 decimals ≈ 1 m: tiny GPS jitter below that does not trigger a new request
  return [kind, provider, profile, alternatives ? 'alt' : 'one', coords.map(([x, y]) => `${x.toFixed(5)},${y.toFixed(5)}`).join(';')].join('|');
}

export function cacheGet<T>(key: string, now = Date.now()): T | null {
  const m = mem.get(key);
  if (m && now - m.t < TTL_MS) return m.v as T;
  if (m) mem.delete(key);
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const e = JSON.parse(raw) as Entry<T>;
    if (now - e.t < TTL_MS) { mem.set(key, e); return e.v; }
    sessionStorage.removeItem(PREFIX + key);
  } catch { /* storage unavailable */ }
  return null;
}

export function cacheSet<T>(key: string, v: T, persist: boolean, now = Date.now()): void {
  mem.delete(key);
  mem.set(key, { t: now, v });
  while (mem.size > MAX_ENTRIES) mem.delete(mem.keys().next().value!);
  if (!persist) return;
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify({ t: now, v }));
    // keep sessionStorage bounded too
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); if (k?.startsWith(PREFIX)) keys.push(k); }
    if (keys.length > MAX_ENTRIES) {
      keys.map((k) => { try { return [k, JSON.parse(sessionStorage.getItem(k)!).t as number] as const; } catch { return [k, 0] as const; } })
        .sort((a, b) => a[1] - b[1]).slice(0, keys.length - MAX_ENTRIES).forEach(([k]) => sessionStorage.removeItem(k));
    }
  } catch { /* quota / private mode */ }
}

export function cacheClearForTests(): void { mem.clear(); }

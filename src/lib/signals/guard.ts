/**
 * Cost and failure guards shared by every provider: TTL cache, quota counters,
 * circuit breaker and the client that combines them. Storage and clock are
 * injected, so the whole thing is tested in node (tests/signals).
 *
 * The browser guard is a courtesy: it avoids waste and explains limits. The
 * binding limits live in the Worker (serverless/signals-proxy), because a
 * limit enforced only in the visitor's browser protects nothing.
 */
import { PROVIDER_INFO, unavailable, type ProviderId, type ProviderMode, type SignalType, type TourismSignal } from './types';

export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
export function memoryKV(): KV {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}
export type Clock = () => number;

// --------------------------------------------------------------------- cache --
export interface CacheEntry<T> { value: T; storedAt: number; expiresAt: number }
export class TtlCache {
  constructor(private kv: KV, private now: Clock = Date.now, private prefix = 'slp:sig:c:') {}
  /** Fresh entry, or null. */
  get<T>(key: string): CacheEntry<T> | null {
    const e = this.peek<T>(key);
    return e && e.expiresAt > this.now() ? e : null;
  }
  /** Entry regardless of age (to serve a stale value when the provider fails). */
  peek<T>(key: string): CacheEntry<T> | null {
    try { const raw = this.kv.getItem(this.prefix + key); return raw ? (JSON.parse(raw) as CacheEntry<T>) : null; } catch { return null; }
  }
  set<T>(key: string, value: T, ttlMs: number): CacheEntry<T> {
    const e = { value, storedAt: this.now(), expiresAt: this.now() + ttlMs };
    try { this.kv.setItem(this.prefix + key, JSON.stringify(e)); } catch { /* storage full or blocked: the value is still returned */ }
    return e;
  }
}

// --------------------------------------------------------------------- quota --
export interface QuotaLimits { perDay: number; perMonth: number }
export interface QuotaSnapshot { provider: ProviderId; day: string; month: string; usedToday: number; usedMonth: number; limits: QuotaLimits; shareOfMonth: number }
export class QuotaCounter {
  constructor(private kv: KV, private limits: Record<ProviderId, QuotaLimits>, private now: Clock = Date.now, private prefix = 'slp:sig:q:') {}
  private keys(p: ProviderId) {
    const d = new Date(this.now()).toISOString();
    return { day: d.slice(0, 10), month: d.slice(0, 7), dayKey: `${this.prefix}${p}:d:${d.slice(0, 10)}`, monthKey: `${this.prefix}${p}:m:${d.slice(0, 7)}` };
  }
  private read(k: string) { const n = Number(this.kv.getItem(k)); return Number.isFinite(n) && n > 0 ? n : 0; }
  snapshot(p: ProviderId): QuotaSnapshot {
    const k = this.keys(p), limits = this.limits[p];
    const usedToday = this.read(k.dayKey), usedMonth = this.read(k.monthKey);
    return { provider: p, day: k.day, month: k.month, usedToday, usedMonth, limits, shareOfMonth: limits.perMonth > 0 ? usedMonth / limits.perMonth : 1 };
  }
  /** Whether `cost` more units fit in both windows. A limit of 0 means the provider may not be called. */
  canSpend(p: ProviderId, cost = 1): boolean {
    const s = this.snapshot(p);
    return s.usedToday + cost <= s.limits.perDay && s.usedMonth + cost <= s.limits.perMonth;
  }
  /** Counts BEFORE the request leaves: a request that fails still used quota at the provider. */
  spend(p: ProviderId, cost = 1): void {
    const k = this.keys(p);
    this.kv.setItem(k.dayKey, String(this.read(k.dayKey) + cost));
    this.kv.setItem(k.monthKey, String(this.read(k.monthKey) + cost));
  }
}

// ------------------------------------------------------------------- breaker --
export class CircuitBreaker {
  private failures = 0;
  private openUntil = 0;
  constructor(private threshold = 3, private cooldownMs = 5 * 60_000, private now: Clock = Date.now) {}
  get open() { return this.now() < this.openUntil; }
  get retryInMs() { return Math.max(0, this.openUntil - this.now()); }
  success() { this.failures = 0; }
  failure() { if (++this.failures >= this.threshold) this.trip(this.cooldownMs); }
  /** Opens immediately (HTTP 429, quota at the provider): no call until the cooldown ends. */
  trip(ms: number) { this.openUntil = this.now() + ms; this.failures = 0; }
}

// -------------------------------------------------------------------- client --
export class ProviderError extends Error {
  constructor(message: string, public status: number | null = null, public retryAfterS: number | null = null) { super(message); }
}
export interface SignalRequest<T> {
  provider: ProviderId;
  signalType: SignalType;
  placeId: string;
  /** Cache and de-duplication key, unique per provider + parameters. */
  key: string;
  ttlMs: number;
  /** Quota units this call costs at the provider (BestTime new forecast = 2 credits). */
  cost?: number;
  /** Performs the provider call. Receives nothing: parameters are closed over. Throws ProviderError. */
  fetcher: () => Promise<T>;
  /** Turns the provider payload into signals. Throws if the payload is not what the documentation describes. */
  parse: (payload: T, retrievedAt: Date, expiresAt: Date) => TourismSignal[];
}
export interface ClientOptions {
  modes: Record<ProviderId, ProviderMode>;
  cache: TtlCache;
  quota: QuotaCounter;
  breakers?: Partial<Record<ProviderId, CircuitBreaker>>;
  now?: Clock;
  /** Retries after a network error or 5xx. Never after 4xx. */
  maxRetries?: number;
  /** Fixture transport: when a provider is in `mock` mode the client reads here instead of calling `fetcher`. */
  fixtures?: (req: { provider: ProviderId; key: string }) => unknown;
  onEvent?: (e: { provider: ProviderId; kind: 'cache' | 'network' | 'mock' | 'blocked' | 'error' | 'stale'; detail?: string }) => void;
}

const NOTE = {
  off: 'Integración desactivada: requiere una cuenta del proveedor y autorización para activarla.',
  quota: 'Se alcanzó el límite de consultas configurado para este proveedor. No se hacen más solicitudes.',
  open: 'El proveedor no respondió varias veces seguidas; se pausaron las consultas para no gastar cuota.',
  error: 'El proveedor no respondió. Se muestra el resto de la información sin este dato.',
  format: 'El proveedor devolvió una respuesta que no coincide con su documentación; no se usa.',
  fixture: 'Sin respuesta de ejemplo para esta consulta.',
} as const;

/** Error codes the signals proxy sends in X-Signal-Error for a provider it will not call. */
const DISABLED_AT_PROXY = new Set(['provider-disabled', 'provider-not-configured', 'no-budget-store']);

export class SignalClient {
  private inflight = new Map<string, Promise<TourismSignal[]>>();
  private breakers: Record<ProviderId, CircuitBreaker>;
  private now: Clock;
  constructor(private opt: ClientOptions) {
    this.now = opt.now ?? Date.now;
    const mk = () => new CircuitBreaker(3, 5 * 60_000, this.now);
    this.breakers = { besttime: opt.breakers?.besttime ?? mk(), tomtom: opt.breakers?.tomtom ?? mk(), fr24: opt.breakers?.fr24 ?? mk(), 'open-meteo': opt.breakers?.['open-meteo'] ?? mk() };
  }
  mode(p: ProviderId): ProviderMode { return this.opt.modes[p]; }
  breaker(p: ProviderId): CircuitBreaker { return this.breakers[p]; }

  /** Never throws: any failure becomes one `unavailable` (or `stale`) signal. */
  async get<T>(req: SignalRequest<T>): Promise<TourismSignal[]> {
    const id = `${req.provider}:${req.key}`;
    const running = this.inflight.get(id);
    if (running) return running; // de-duplication: one request per key at a time
    const p = this.run(req).finally(() => this.inflight.delete(id));
    this.inflight.set(id, p);
    return p;
  }

  private none(req: Pick<SignalRequest<unknown>, 'provider' | 'signalType' | 'placeId'>, note: string): TourismSignal[] {
    return [unavailable(req.provider, req.signalType, req.placeId, note, new Date(this.now()))];
  }

  private async run<T>(req: SignalRequest<T>): Promise<TourismSignal[]> {
    const { provider } = req, mode = this.opt.modes[provider], ev = this.opt.onEvent;
    if (mode === 'off') { ev?.({ provider, kind: 'blocked', detail: 'off' }); return this.none(req, NOTE.off); }

    if (mode === 'mock') {
      const payload = this.opt.fixtures?.({ provider, key: req.key });
      if (payload === undefined || payload === null) return this.none(req, NOTE.fixture);
      const at = new Date(this.now());
      try {
        ev?.({ provider, kind: 'mock' });
        // a fixture is relabelled here, after parsing: no adapter can present it as real
        return req.parse(payload as T, at, new Date(at.getTime() + req.ttlMs)).map((s) => (s.status === 'unavailable' ? s : { ...s, status: 'simulated' as const, evidenceType: 'simulated' as const, confidence: null }));
      } catch { return this.none(req, NOTE.format); }
    }

    const cacheKey = `${provider}:${req.key}`;
    const hit = this.opt.cache.get<TourismSignal[]>(cacheKey);
    if (hit) { ev?.({ provider, kind: 'cache' }); return hit.value; }
    const stale = (note: string): TourismSignal[] => {
      const old = this.opt.cache.peek<TourismSignal[]>(cacheKey);
      if (!old) return this.none(req, note);
      ev?.({ provider, kind: 'stale' });
      return old.value.map((s) => (s.status === 'unavailable' ? s : { ...s, status: 'stale' as const, note }));
    };
    const breaker = this.breakers[provider];
    if (breaker.open) { ev?.({ provider, kind: 'blocked', detail: 'breaker' }); return stale(NOTE.open); }
    const cost = req.cost ?? 1;

    const retries = this.opt.maxRetries ?? 1;
    for (let attempt = 0; ; attempt++) {
      if (!this.opt.quota.canSpend(provider, cost)) { ev?.({ provider, kind: 'blocked', detail: 'quota' }); return stale(NOTE.quota); }
      this.opt.quota.spend(provider, cost);
      try {
        ev?.({ provider, kind: 'network' });
        const payload = await req.fetcher();
        const at = new Date(this.now());
        let signals: TourismSignal[];
        try { signals = req.parse(payload, at, new Date(at.getTime() + req.ttlMs)); } catch { breaker.failure(); return stale(NOTE.format); }
        breaker.success();
        this.opt.cache.set(cacheKey, signals, req.ttlMs);
        return signals;
      } catch (e) {
        const err = e instanceof ProviderError ? e : new ProviderError(String(e));
        ev?.({ provider, kind: 'error', detail: String(err.status ?? err.message) });
        if (err.status === 429) { breaker.trip(Math.max(60, err.retryAfterS ?? 300) * 1000); return stale(NOTE.quota); }
        // switched off or without a key at the proxy: a configuration state, not a provider failure (no retry, no breaker)
        if (DISABLED_AT_PROXY.has(err.message)) return this.none(req, NOTE.off);
        if (err.message === 'provider-cooldown') { breaker.trip(Math.max(60, err.retryAfterS ?? 60) * 1000); return stale(NOTE.open); }
        const retriable = err.status === null || err.status >= 500;
        if (!retriable || attempt >= retries) { breaker.failure(); return stale(NOTE.error); }
      }
    }
  }
}

/** Source link of a provider, for attribution lines. */
export const providerUrl = (p: ProviderId) => PROVIDER_INFO[p].url;

/**
 * Browser wiring of the external signals: feature flags, limits and the
 * transport to the Worker. Defaults are safe: every keyed provider runs on
 * fixtures (`mock`) and makes no network request. `live` needs BOTH a flag and
 * a proxy URL; without the proxy it falls back to `off`. No key ever reaches
 * this file: PUBLIC_SIGNALS_PROXY_URL is an address, not a secret.
 */
import { SignalClient, TtlCache, QuotaCounter, ProviderError, memoryKV, type KV, type QuotaLimits } from '@/lib/signals/guard';
import { fixtureFor } from '@/lib/signals/fixtures';
import type { ProviderId, ProviderMode } from '@/lib/signals/types';

const env = import.meta.env as Record<string, string | undefined>;
export const PROXY_URL = (env.PUBLIC_SIGNALS_PROXY_URL ?? '').trim().replace(/\/$/, '');

function flag(name: string, fallback: ProviderMode): ProviderMode {
  const v = (env[name] ?? '').trim().toLowerCase();
  const mode = v === 'off' || v === 'mock' || v === 'live' ? v : fallback;
  return mode === 'live' && !PROXY_URL ? 'off' : mode;
}
export const MODES: Record<ProviderId, ProviderMode> = {
  besttime: flag('PUBLIC_SIGNALS_BESTTIME', 'mock'),
  tomtom: flag('PUBLIC_SIGNALS_TOMTOM', 'mock'),
  fr24: flag('PUBLIC_SIGNALS_FR24', 'mock'),
  'open-meteo': 'live', // keyless, already in use (src/scripts/weather.ts)
};

/** Per-browser courtesy limits. The binding budget is enforced in the Worker. */
export const CLIENT_LIMITS: Record<ProviderId, QuotaLimits> = {
  besttime: { perDay: 12, perMonth: 60 },
  tomtom: { perDay: 60, perMonth: 600 },
  fr24: { perDay: 6, perMonth: 60 },
  'open-meteo': { perDay: 200, perMonth: 3000 },
};

function storage(kind: 'local' | 'session'): KV {
  try { const s = kind === 'local' ? localStorage : sessionStorage; s.setItem('slp:sig:t', '1'); s.removeItem('slp:sig:t'); return s; } catch { return memoryKV(); }
}
export const quota = new QuotaCounter(storage('local'), CLIENT_LIMITS);
export const events: { provider: ProviderId; kind: string; detail?: string; at: number }[] = [];
export const signals = new SignalClient({
  modes: MODES, cache: new TtlCache(storage('session')), quota, fixtures: fixtureFor, maxRetries: 1,
  onEvent: (e) => { events.push({ ...e, at: Date.now() }); if (events.length > 200) events.shift(); },
});

/** GET on the Worker. The browser sends an id from the catalogue, never a coordinate or an address. */
// `any` on purpose: the payload is validated by each adapter parser, not by a cast.
export async function proxyGet(path: string, params: Record<string, string>): Promise<any> {
  if (!PROXY_URL) throw new ProviderError('proxy not configured', 503);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(`${PROXY_URL}/v1/${path}?${new URLSearchParams(params)}`, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) {
      // release the response: an unread error body keeps the connection busy, and the browser
      // allows only a few connections per host, so later requests to the proxy would stall
      await res.body?.cancel().catch(() => {});
      throw new ProviderError(res.headers.get('X-Signal-Error') ?? `HTTP ${res.status}`, res.status, Number(res.headers.get('Retry-After')) || null);
    }
    return ((await res.json()) as { payload: unknown }).payload;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError('network');
  } finally { clearTimeout(timer); }
}

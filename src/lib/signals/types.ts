/**
 * External tourism signals: one shape for every provider.
 *
 * Pure TypeScript (no DOM, no network): the same code runs in the browser and
 * in node tests. A signal always says who produced it, when, what kind of
 * evidence it is and whether it is usable. Observed, estimated and simulated
 * values never share a status, and a simulated value can never be relabelled:
 * `simulated` is set by the fixture transport, not by an adapter.
 */
export type ProviderId = 'besttime' | 'tomtom' | 'fr24' | 'open-meteo';

export type SignalType =
  | 'relative-busyness-forecast'   // BestTime: % of the venue's own weekly peak, per hour
  | 'relative-busyness-live'       // BestTime: % of the venue's own weekly peak, now
  | 'road-speed'                   // TomTom flow: current km/h on a segment
  | 'road-free-flow-speed'         // TomTom flow: km/h under free-flow conditions
  | 'road-speed-ratio'             // current ÷ free flow (1 = free flow)
  | 'road-closure'                 // TomTom flow: boolean
  | 'road-incident'                // TomTom incidents: one incident
  | 'airport-movements'            // FR24: flights counted in a period (NOT passengers, NOT tourists)
  | 'weather-current'              // Open-Meteo: modelled current conditions
  | 'weather-forecast';            // Open-Meteo: forecast

/**
 * live        measured or reported for the present moment by the provider
 * forecast    the provider's prediction for a future or typical period
 * historical  a past period
 * stale       a cached value older than its expiry, shown because nothing newer could be fetched
 * unavailable no value: provider off, no coverage, quota reached, or an error
 * simulated   a fixture, for demonstration; never a statement about a real place
 */
export type SignalStatus = 'live' | 'forecast' | 'historical' | 'stale' | 'unavailable' | 'simulated';
export type EvidenceType = 'observed' | 'estimated' | 'simulated' | 'none';

export interface TourismSignal {
  provider: ProviderId;
  signalType: SignalType;
  /** Portal place id, corridor id or airport code the signal refers to. */
  placeId: string;
  /** When the value applies (ISO 8601), or null when the provider gives none. */
  observedAt: string | null;
  retrievedAt: string;
  expiresAt: string;
  value: number | boolean | string | null;
  unit: string | null;
  evidenceType: EvidenceType;
  /** 0–1 when the provider reports one; null otherwise. Never invented. */
  confidence: number | null;
  status: SignalStatus;
  sourceUrl: string;
  /** Short reason when status is `unavailable` (shown to the visitor). */
  note?: string;
  /** Provider-specific detail an adapter wants to keep (hour, day, segment class…). */
  meta?: Record<string, string | number | boolean | null>;
}

export const SIGNAL_STATUS_LABEL: Record<SignalStatus, string> = {
  live: 'En vivo',
  forecast: 'Previsión',
  historical: 'Histórico',
  stale: 'Dato anterior (no actualizado)',
  unavailable: 'No disponible',
  simulated: 'Datos simulados para demostración académica',
};

export const PROVIDER_INFO: Record<ProviderId, { name: string; url: string; needsKey: boolean }> = {
  besttime: { name: 'BestTime.app', url: 'https://besttime.app/', needsKey: true },
  tomtom: { name: 'TomTom Traffic API', url: 'https://docs.tomtom.com/traffic-api/', needsKey: true },
  fr24: { name: 'Flightradar24 API', url: 'https://fr24api.flightradar24.com/', needsKey: true },
  'open-meteo': { name: 'Open-Meteo', url: 'https://open-meteo.com/', needsKey: false },
};

export type ProviderMode = 'off' | 'mock' | 'live';

/** An `unavailable` signal: the only way an adapter or the client reports "no value". */
export function unavailable(provider: ProviderId, signalType: SignalType, placeId: string, note: string, now = new Date()): TourismSignal {
  const t = now.toISOString();
  return { provider, signalType, placeId, observedAt: null, retrievedAt: t, expiresAt: t, value: null, unit: null, evidenceType: 'none', confidence: null, status: 'unavailable', sourceUrl: PROVIDER_INFO[provider].url, note };
}

/** True for values that may be shown next to observed data without a simulation label. */
export const isReal = (s: TourismSignal) => s.status === 'live' || s.status === 'forecast' || s.status === 'historical' || s.status === 'stale';

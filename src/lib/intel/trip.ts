/**
 * Trip optimisation: what the comparison "original route vs optimised route"
 * may say. The ordering itself is src/scripts/geo/route-optimizer.ts (exact
 * Held–Karp up to 12 points, nearest neighbour + 2-opt + Or-opt above) over
 * ONE road matrix from the routing provider. Every stop is kept; only the
 * order changes. Savings are differences between two sums of that matrix:
 * provider estimates without live traffic, never invented.
 */
export interface Totals { distance: number; duration: number } // metres, seconds

export interface Savings {
  /** metres saved (negative = the optimised order is longer in distance) */
  distance: number;
  /** seconds saved */
  duration: number;
  /** share of travel time saved, 0–1 */
  share: number;
  /** worth proposing: at least a minute and 1 % of the travel time */
  worthwhile: boolean;
}

export const MIN_SAVING_S = 60;
export const MIN_SAVING_SHARE = 0.01;

export function savings(current: Totals, proposed: Totals): Savings {
  const duration = current.duration - proposed.duration;
  const share = current.duration > 0 ? duration / current.duration : 0;
  return { distance: current.distance - proposed.distance, duration, share, worthwhile: duration >= MIN_SAVING_S && share >= MIN_SAVING_SHARE };
}

const km = (m: number) => `${Math.abs(m) < 9950 ? (Math.round(Math.abs(m) / 100) / 10).toLocaleString('es-MX') : Math.round(Math.abs(m) / 1000).toLocaleString('es-MX')} km`;
const min = (s: number) => { const m = Math.max(1, Math.round(Math.abs(s) / 60)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`; };

/** One honest sentence for the comparison. */
export function savingsSentence(s: Savings): string {
  if (!s.worthwhile) return 'El orden optimizado no mejora tu recorrido de forma apreciable.';
  const pct = Math.round(s.share * 100);
  const time = `≈ ${min(s.duration)} menos de traslado${pct >= 1 ? ` (${pct} %)` : ''}`;
  if (s.distance >= 500) return `Con el orden optimizado: ${time} y ≈ ${km(s.distance)} menos.`;
  if (s.distance <= -500) return `Con el orden optimizado: ${time}, aunque recorres ≈ ${km(s.distance)} más.`;
  return `Con el orden optimizado: ${time}, con una distancia prácticamente igual.`;
}

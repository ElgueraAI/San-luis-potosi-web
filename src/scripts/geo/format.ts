/** Distances and durations as written in Mexico: km / m, h / min. */

const nf1 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

export function fmtDistance(m: number): string {
  if (!Number.isFinite(m) || m < 0) return '—';
  if (m < 950) return `${nf0.format(Math.max(10, Math.round(m / 10) * 10))} m`;
  return `${(m < 9950 ? nf1 : nf0).format(m / 1000)} km`;
}

export function fmtDuration(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '—';
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), r = min % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** Signed difference, e.g. "−12 km" / "+5 min"; zero reads "sin cambio". */
export function fmtDelta(v: number, kind: 'distance' | 'duration'): string {
  const threshold = kind === 'distance' ? 50 : 30;
  if (Math.abs(v) < threshold) return 'sin cambio';
  const sign = v < 0 ? '−' : '+';
  return sign + (kind === 'distance' ? fmtDistance(Math.abs(v)) : fmtDuration(Math.abs(v)));
}

export function fmtCoord(v: number, axis: 'lat' | 'lon'): string {
  const hemi = axis === 'lat' ? (v >= 0 ? 'N' : 'S') : (v >= 0 ? 'E' : 'O');
  return `${Math.abs(v).toFixed(5)}° ${hemi}`;
}

export function fmtAge(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return 'hace unos segundos';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  return `hace ${Math.round(m / 60)} h`;
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

/** Great-circle distance in metres (only for "near" hints; never shown as a road distance). */
export function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371008.8, rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

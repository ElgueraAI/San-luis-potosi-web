/**
 * Open-Meteo current weather. One request per page for every point shown
 * (the API accepts coordinate lists), cached 15 minutes in sessionStorage.
 * Any failure leaves a calm "no disponible" state and never throws upward.
 */
const CODES: Record<number, string> = {
  0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado', 45: 'Niebla', 48: 'Niebla con escarcha',
  51: 'Llovizna ligera', 53: 'Llovizna', 55: 'Llovizna intensa', 61: 'Lluvia ligera', 63: 'Lluvia', 65: 'Lluvia intensa',
  80: 'Chubascos ligeros', 81: 'Chubascos', 82: 'Chubascos fuertes', 95: 'Tormenta', 96: 'Tormenta con granizo ligero', 99: 'Tormenta con granizo',
};
export const conditionText = (code: number | undefined) => (code === undefined ? '' : CODES[code] ?? 'Condición variable');

export type Now = {
  temp: number; feels: number; code: number; wind: number; precip: number; max: number; min: number; rainProb: number | null;
};

const TTL = 15 * 60 * 1000;
const fmt = (n: number) => `${Math.round(n)}°`;

function cacheGet(key: string): Now[] | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    return v && Date.now() - v.t < TTL ? v.d : null;
  } catch { return null; }
}
function cacheSet(key: string, d: Now[]) {
  try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch { /* ignore */ }
}

/** Fetch current conditions for several points. Rejects on any failure. */
export async function fetchNow(points: { lat: number; lon: number }[]): Promise<Now[]> {
  const key = 'slp:wx:' + points.map((p) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`).join(';');
  const hit = cacheGet(key);
  if (hit) return hit;
  if (!navigator.onLine) throw new Error('offline');
  const q = new URLSearchParams({
    latitude: points.map((p) => p.lat.toFixed(4)).join(','),
    longitude: points.map((p) => p.lon.toFixed(4)).join(','),
    current: 'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'America/Mexico_City',
    wind_speed_unit: 'kmh',
    forecast_days: '1',
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const arr = Array.isArray(j) ? j : [j];
    const out: Now[] = arr.map((r) => ({
      temp: r.current.temperature_2m,
      feels: r.current.apparent_temperature,
      code: r.current.weather_code,
      wind: r.current.wind_speed_10m,
      precip: r.current.precipitation,
      max: r.daily.temperature_2m_max[0],
      min: r.daily.temperature_2m_min[0],
      rainProb: r.daily.precipitation_probability_max?.[0] ?? null,
    }));
    cacheSet(key, out);
    return out;
  } finally {
    clearTimeout(timer);
  }
}

export function render(item: HTMLElement, n: Now) {
  const set = (k: string, v: string) => { const el = item.querySelector(`[data-wx="${k}"]`); if (el) el.textContent = v; };
  // the degree sign is a separate, smaller element in the markup
  set('temp', String(Math.round(n.temp)));
  set('cond', conditionText(n.code));
  set('feels', fmt(n.feels));
  set('range', `${fmt(n.max)} / ${fmt(n.min)}`);
  set('wind', `${Math.round(n.wind)} km/h`);
  set('rain', n.precip > 0 ? `${n.precip.toFixed(1)} mm` : n.rainProb !== null ? `${n.rainProb}% prob.` : '0 mm');
  item.dataset.state = 'ok';
}

export function initWeather(): void {
  document.querySelectorAll<HTMLElement>('[data-weather]').forEach(async (box) => {
    const items = [...box.querySelectorAll<HTMLElement>('[data-wx-point]')];
    if (!items.length) return;
    try {
      const data = await fetchNow(items.map((i) => ({ lat: +i.dataset.lat!, lon: +i.dataset.lon! })));
      items.forEach((it, k) => data[k] && render(it, data[k]));
    } catch {
      items.forEach((it) => {
        it.dataset.state = 'error';
        const c = it.querySelector('[data-wx="cond"]');
        if (c) c.textContent = 'No disponible';
      });
      const err = box.querySelector<HTMLElement>('[data-wx-error]');
      if (err) err.hidden = false;
    }
  });
}

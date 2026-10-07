/**
 * Location readout shared by the map overlay and the Mi Ruta planner.
 * Each state has its own word and symbol, not only a colour.
 */
import { fmtAge, fmtCoord, fmtTime } from './format';
import type { LocationState } from './types';

const nf = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

export const STATUS_TEXT: Record<LocationState['status'], { word: string; sym: string; tone: 'ok' | 'warn' | 'err' | 'idle' }> = {
  idle: { word: 'Ubicación no solicitada', sym: '○', tone: 'idle' },
  requesting: { word: 'Buscando tu ubicación…', sym: '◌', tone: 'idle' },
  ok: { word: 'Ubicación obtenida', sym: '●', tone: 'ok' },
  approximate: { word: 'Ubicación aproximada', sym: '◐', tone: 'warn' },
  stale: { word: 'Ubicación antigua', sym: '◷', tone: 'warn' },
  denied: { word: 'Permiso denegado', sym: '⊘', tone: 'err' },
  unavailable: { word: 'Ubicación no disponible', sym: '⊘', tone: 'err' },
  timeout: { word: 'Tiempo de espera agotado', sym: '◷', tone: 'err' },
  unsupported: { word: 'Geolocalización no disponible', sym: '⊘', tone: 'err' },
  insecure: { word: 'Requiere conexión segura', sym: '⊘', tone: 'err' },
};

export function locationReadout(s: LocationState, now = Date.now()): string {
  const st = STATUS_TEXT[s.status];
  const head = `<p class="geo-st" data-tone="${st.tone}"><span class="geo-st__sym" aria-hidden="true">${st.sym}</span><span>${st.word}</span>${s.watching ? '<span class="geo-st__live">· siguiendo</span>' : ''}</p>`;
  const msg = s.message ? `<p class="geo-msg">${s.message}</p>` : '';
  const f = s.fix;
  if (!f) return head + msg;
  const age = now - f.timestamp;
  const rows = [
    ['Latitud', fmtCoord(f.coord[1], 'lat')],
    ['Longitud', fmtCoord(f.coord[0], 'lon')],
    ['Precisión', `± ${nf.format(Math.round(f.accuracy))} m`],
    // altitude only when the device reports one (coords.altitude !== null)
    ...(f.altitude !== null ? [['Altitud', `${nf.format(Math.round(f.altitude))} m${f.altitudeAccuracy !== null ? ` (± ${nf.format(Math.round(f.altitudeAccuracy))} m)` : ''}`]] : []),
    ['Hora', `${fmtTime(f.timestamp)} · ${fmtAge(age)}`],
  ];
  const note = s.status === 'approximate'
    ? '<p class="geo-msg">La precisión es baja (red Wi-Fi o celular). El punto puede estar a más de un kilómetro.</p>'
    : s.status === 'stale' ? '<p class="geo-msg">Esta posición tiene más de 5 minutos. Actualízala si te moviste.</p>' : '';
  return `${head}<dl class="geo-dl">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>${f.altitude === null ? '<p class="geo-fine">Tu dispositivo no reporta altitud.</p>' : ''}${note}${msg}`;
}

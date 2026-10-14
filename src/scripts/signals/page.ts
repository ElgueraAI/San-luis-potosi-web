/**
 * /inteligencia-turistica/senales/: the three external-signal modules and the
 * budget table. Requests happen only when the visitor chooses something
 * (never on scroll or on a timer). A module that gets no value says so and
 * the rest of the page keeps working.
 */
import { signals, quota, MODES, CLIENT_LIMITS, PROXY_URL, proxyGet } from './client';
import { BESTTIME, DAYS_ES, TOMTOM, FR24, parseBestTimeForecast, parseBestTimeLive, parseTomTomFlow, parseTomTomIncidents, parseFr24Movements, visitWindows } from '@/lib/signals/providers';
import { SIGNAL_STATUS_LABEL, type ProviderId, type TourismSignal } from '@/lib/signals/types';
import { DEMO_AIRPORT } from '@/lib/signals/fixtures';
import { esc } from '../intel/cards';

interface Catalog { venues: { id: string; name: string }[]; corridors: { id: string; name: string }[]; demoVenues: { id: string; name: string }[]; demoCorridors: { id: string; name: string }[]; airport: { icao: string; name: string } }
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
const when = (iso: string) => new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
const span = (hours: number[]) => (hours.length ? hours.map(hh).join(', ') : 'ninguna');
const badge = (s: TourismSignal) => `<span class="sgl__badge" data-status="${s.status}">${SIGNAL_STATUS_LABEL[s.status]}</span>`;
const none = (s: TourismSignal) => `<p class="sgl__none">${esc(s.note ?? 'Sin información')}</p>`;
const MODE_TEXT = { off: 'Desactivada', mock: 'Solo simulada (respuestas de ejemplo)', live: 'Activa a través del servicio intermedio' } as const;

export function initSignalsPage(root: HTMLElement): void {
  const cat = JSON.parse(root.querySelector('[data-sgl-catalog]')!.textContent!) as Catalog;
  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;

  // ---- status and budget ---------------------------------------------------------------------
  function renderBudget() {
    root.querySelectorAll<HTMLElement>('[data-sgl-mode]').forEach((el) => { const p = el.dataset.sglMode as ProviderId; el.textContent = p === 'open-meteo' ? 'Activa: consulta directa desde el navegador, sin clave ni servicio intermedio' : MODE_TEXT[MODES[p]]; el.dataset.mode = MODES[p]; });
    root.querySelectorAll<HTMLElement>('[data-sgl-used]').forEach((el) => {
      const p = el.dataset.sglUsed as ProviderId, s = quota.snapshot(p);
      el.textContent = MODES[p] === 'live' ? `${s.usedMonth} de ${CLIENT_LIMITS[p].perMonth} en este navegador (${Math.round(s.shareOfMonth * 100)} %)` : '0 · no se hacen solicitudes';
    });
    $('[data-sgl-proxy]').textContent = PROXY_URL ? 'Configurado' : 'No configurado: ninguna integración con clave puede activarse';
  }

  // ---- 1. BestTime: ¿cuándo conviene visitar? ----------------------------------------------------
  const venueSel = $<HTMLSelectElement>('[data-sgl-venue]'), daySel = $<HTMLSelectElement>('[data-sgl-day]'), venueOut = $('[data-sgl-venue-out]');
  const live = MODES.besttime === 'live';
  venueSel.innerHTML = (live ? cat.venues : cat.demoVenues).map((v) => `<option value="${esc(v.id)}">${esc(v.name)}</option>`).join('');
  daySel.value = String((new Date().getDay() + 6) % 7);
  async function renderVenue() {
    const id = venueSel.value, day = +daySel.value;
    venueOut.setAttribute('aria-busy', 'true');
    const [forecast, now] = await Promise.all([
      signals.get({ provider: 'besttime', signalType: 'relative-busyness-forecast', placeId: id, key: `forecast:${id}`, ttlMs: BESTTIME.ttlForecastMs, cost: BESTTIME.costNewForecast, fetcher: () => proxyGet('besttime/forecast', { venue: id }), parse: parseBestTimeForecast(id) }),
      signals.get({ provider: 'besttime', signalType: 'relative-busyness-live', placeId: id, key: `live:${id}`, ttlMs: BESTTIME.ttlLiveMs, cost: BESTTIME.costLive, fetcher: () => proxyGet('besttime/live', { venue: id }), parse: parseBestTimeLive(id) }),
    ]);
    venueOut.removeAttribute('aria-busy');
    const first = forecast[0];
    if (first.status === 'unavailable') { venueOut.innerHTML = none(first); renderBudget(); return; }
    const w = visitWindows(forecast).find((x) => x.day === day);
    if (!w) { venueOut.innerHTML = `<p class="sgl__none">${BESTTIME.noData} para el ${DAYS_ES[day]}.</p>`; return; }
    const max = Math.max(1, ...w.hours.map((h) => h.value));
    const liveS = now[0];
    venueOut.innerHTML = `
      <p>${badge(first)}</p>
      <div class="sgl__hours" role="img" aria-label="Concurrencia prevista por hora, ${DAYS_ES[day]}: ${w.hours.filter((h) => h.value > 0).map((h) => `${hh(h.hour)} ${h.value} por ciento`).join(', ')}">
        ${w.hours.map((h) => `<span class="sgl__h" data-busy="${w.busy.includes(h.hour) ? 'busy' : w.quiet.includes(h.hour) ? 'quiet' : h.value > 0 ? 'mid' : 'closed'}"><i style="height:${Math.round((h.value / max) * 100)}%"></i><small>${h.hour % 3 === 0 ? h.hour : ''}</small></span>`).join('')}
      </div>
      <dl class="sgl__facts">
        <div><dt>Horas más tranquilas</dt><dd>${span(w.quiet)}</dd></div>
        <div><dt>Horas relativamente concurridas</dt><dd>${span(w.busy)}</dd></div>
        <div><dt>Hora de mayor actividad prevista</dt><dd>${w.peak === null ? 'sin datos' : hh(w.peak)}</dd></div>
        <div><dt>Ahora frente a lo previsto</dt><dd>${liveS.status === 'unavailable' ? 'Sin observación actual para este establecimiento' : `${liveS.value} % observado · ${liveS.meta?.forecast ?? '—'} % previsto (${Number(liveS.meta?.delta) > 0 ? '+' : ''}${liveS.meta?.delta ?? '—'})`}</dd></div>
      </dl>
      <p class="sgl__meta">Unidad: ${BESTTIME.unit}. «Tranquila» y «concurrida» se definen frente al máximo de ese mismo día en ese mismo establecimiento; no se comparan establecimientos entre sí ni se estiman personas. Consultado: ${when(first.retrievedAt)}.</p>`;
    renderBudget();
  }
  venueSel.addEventListener('change', renderVenue);
  daySel.addEventListener('change', renderVenue);

  // ---- 2. TomTom: estado de las carreteras ------------------------------------------------------------
  const roadOut = $('[data-sgl-roads]');
  async function renderRoads() {
    const list = MODES.tomtom === 'live' ? cat.corridors : cat.demoCorridors;
    roadOut.setAttribute('aria-busy', 'true');
    // One corridor at a time (flow and incidents together): if the provider refuses or fails,
    // the breaker opens after the first answers and the remaining corridors never leave the browser.
    const rows: { c: { id: string; name: string }; flow: TourismSignal[]; inc: TourismSignal[] }[] = [];
    for (const c of list) {
      const [flow, inc] = await Promise.all([
        signals.get({ provider: 'tomtom', signalType: 'road-speed', placeId: c.id, key: `flow:${c.id}`, ttlMs: TOMTOM.ttlFlowMs, fetcher: () => proxyGet('tomtom/flow', { corridor: c.id }), parse: parseTomTomFlow(c.id) }),
        signals.get({ provider: 'tomtom', signalType: 'road-incident', placeId: c.id, key: `incidents:${c.id}`, ttlMs: TOMTOM.ttlIncidentsMs, fetcher: () => proxyGet('tomtom/incidents', { corridor: c.id }), parse: parseTomTomIncidents(c.id) }),
      ]);
      rows.push({ c, flow, inc });
    }
    roadOut.removeAttribute('aria-busy');
    roadOut.innerHTML = rows.map(({ c, flow, inc }) => {
      const f = (t: string) => flow.find((s) => s.signalType === t);
      const cur = f('road-speed');
      if (!cur || cur.status === 'unavailable') return `<li class="sgl__road"><h4>${esc(c.name)}</h4>${none(flow[0])}</li>`;
      const ratio = f('road-speed-ratio')!.value as number | null, closed = f('road-closure')!.value === true;
      const incidents = inc.filter((s) => s.status !== 'unavailable');
      return `<li class="sgl__road" data-closed="${closed}">
        <h4>${esc(c.name)}</h4><p>${badge(cur)}</p>
        <p class="sgl__speed"><b>${closed ? 'Cerrado' : `${cur.value} km/h`}</b><span>${closed ? 'según el proveedor' : `flujo libre ${f('road-free-flow-speed')!.value} km/h`}</span></p>
        ${!closed && ratio !== null ? `<span class="meter" aria-hidden="true"><i style="--v:${Math.min(1, ratio)}"></i></span><p class="sgl__meta">${Math.round(ratio * 100)} % de la velocidad de flujo libre${cur.confidence !== null ? ` · confianza del proveedor ${cur.confidence.toLocaleString('es-MX')}` : ''}</p>` : ''}
        <p class="sgl__meta">${incidents.length ? `${incidents.length} ${incidents.length === 1 ? 'incidente' : 'incidentes'}: ${incidents.map((s) => `${esc(String(s.value))}${s.meta?.description ? ` (${esc(String(s.meta.description))})` : ''}`).join('; ')}` : inc[0]?.status === 'unavailable' ? esc(inc[0].note ?? '') : 'Sin incidentes reportados en la zona consultada'}</p>
        <p class="sgl__meta">Consultado: ${when(cur.retrievedAt)}</p>
      </li>`;
    }).join('');
    renderBudget();
  }
  $('[data-sgl-roads-load]').addEventListener('click', renderRoads);

  // ---- 3. Flightradar24: conectividad aérea --------------------------------------------------------------
  const airOut = $('[data-sgl-air]');
  $('[data-sgl-air-load]').addEventListener('click', async () => {
    const day = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
    const icao = MODES.fr24 === 'live' ? cat.airport.icao : DEMO_AIRPORT;
    const res = await signals.get({ provider: 'fr24', signalType: 'airport-movements', placeId: icao, key: `movements:${day}`, ttlMs: FR24.ttlMs, fetcher: () => proxyGet('fr24/movements', { day }), parse: parseFr24Movements(icao, { from: `${day}T00:00:00Z`, to: `${day}T23:59:59Z` }, true) });
    if (res[0].status === 'unavailable') { airOut.innerHTML = none(res[0]); return; }
    const dir = (d: string) => res.find((s) => s.meta?.direction === d)?.value ?? '—';
    airOut.innerHTML = `<p>${badge(res[0])}</p>
      <dl class="sgl__facts"><div><dt>Llegadas en la respuesta</dt><dd>${dir('arrivals')}</dd></div><div><dt>Salidas en la respuesta</dt><dd>${dir('departures')}</dd></div></dl>
      <p class="sgl__meta">Unidad: ${FR24.unit}. ${MODES.fr24 === 'live' ? 'Respuesta del entorno de pruebas del proveedor: son datos estáticos de muestra y no describen ningún día real del aeropuerto.' : 'Respuesta de ejemplo del proyecto: no corresponde a ningún aeropuerto.'}</p>`;
    renderBudget();
  });

  renderBudget();
  void renderVenue();
}

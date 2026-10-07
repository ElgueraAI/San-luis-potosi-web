/**
 * Live navigation card on /mi-ruta/ (markup in mi-ruta.astro). Renders the
 * engine state from geo/nav-controller.ts by updating text in place, so the
 * buttons are never re-created and keyboard focus survives once-per-second
 * position updates. Only the status line is a live region.
 *
 * Optional Screen Wake Lock («Mantener pantalla encendida»): requested only
 * from that button, released when the trip ends; navigation never needs it.
 */
import { navigation } from './geo/nav-controller';
import { isActive, MAX_AUTO_REROUTES, type NavState } from './geo/navigation';
import { routeSession, errorMessage } from './geo/route-session';
import { tripStore } from './geo/trip-store';
import { route } from './route-store';
import { esc, routable } from './geo/places';
import { fmtCoord, fmtDistance, fmtDuration, fmtTime } from './geo/format';

const nf = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

type WakeLockSentinelLike = { release(): Promise<void>; addEventListener(t: 'release', f: () => void): void };
type WakeNav = Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } };

export function initNavigation(box: HTMLElement): void {
  const found = box.querySelector<HTMLElement>('[data-nav]');
  if (!found) return;
  const card: HTMLElement = found;
  const q = <T extends HTMLElement>(s: string) => card.querySelector<T>(s)!;
  const all = (s: string) => [...card.querySelectorAll<HTMLElement>(s)];
  const views = all('[data-nav-view]');
  const planner = box.querySelector<HTMLElement>('[data-planner]');
  const statusEl = q('[data-nav-status]');
  const msgEl = q('[data-nav-msg]');
  const bar = q('[data-nav-bar]');
  const wakeBtn = q<HTMLButtonElement>('[data-nav-wake]');
  const rerouteBtn = q<HTMLButtonElement>('[data-nav-reroute]');

  navigation.init();

  // desktop: while a trip runs, the sticky map column (card + map) must fit the viewport
  const mapcol = card.parentElement;
  if (mapcol && 'ResizeObserver' in window) {
    new ResizeObserver(() => mapcol.style.setProperty('--nav-h', `${Math.round(card.getBoundingClientRect().height)}px`)).observe(card);
  }

  // ---- wake lock (optional) ----------------------------------------------------------
  const wakeApi = (navigator as WakeNav).wakeLock;
  let wantWake = false;
  let sentinel: WakeLockSentinelLike | null = null;
  wakeBtn.hidden = !wakeApi;
  async function acquire() {
    if (!wakeApi || sentinel || document.visibilityState !== 'visible') return;
    try {
      sentinel = await wakeApi.request('screen');
      sentinel.addEventListener('release', () => { sentinel = null; });
    } catch {
      // denied (battery saver, policy): the trip goes on without it
      wantWake = false;
      wakeBtn.textContent = 'Pantalla: no disponible';
      wakeBtn.disabled = true;
    }
    wakeBtn.setAttribute('aria-pressed', String(wantWake && !!sentinel));
  }
  function release() {
    wantWake = false;
    void sentinel?.release().catch(() => undefined);
    sentinel = null;
    wakeBtn.setAttribute('aria-pressed', 'false');
  }
  wakeBtn.addEventListener('click', () => { if (wantWake) release(); else { wantWake = true; void acquire(); } });
  // the browser drops the lock when the page is hidden; take it again on return if the visitor asked for it
  document.addEventListener('visibilitychange', () => { if (wantWake && document.visibilityState === 'visible') void acquire(); });

  // ---- actions ------------------------------------------------------------------------
  card.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!b || b.disabled) return;
    if (b.hasAttribute('data-nav-start')) void navigation.start();
    else if (b.hasAttribute('data-nav-pause')) navigation.pause();
    else if (b.hasAttribute('data-nav-resume')) navigation.resume();
    else if (b.hasAttribute('data-nav-center')) navigation.setCamera('follow');
    else if (b.hasAttribute('data-nav-reroute')) navigation.reroute();
    else if (b.hasAttribute('data-nav-stop')) navigation.stop();
    else if (b.hasAttribute('data-nav-visited')) navigation.markVisited();
    else if (b.hasAttribute('data-nav-continue')) navigation.continueNext();
    else if (b.hasAttribute('data-nav-reset')) { if (confirm('¿Restablecer el recorrido? Tus lugares siguen en Mi Ruta; solo se borra cuáles marcaste como visitados.')) navigation.reset(); }
    else if (b.hasAttribute('data-nav-close')) navigation.stop();
  });

  navigation.onCamera((c) => { q('[data-nav-center]').hidden = !(isActive(navigation.get().status) && c === 'free'); });

  // ---- render ---------------------------------------------------------------------------
  const show = (name: string) => views.forEach((v) => (v.hidden = v.dataset.navView !== name));
  let lastView = '';
  let lastStatusText = '';

  function routableSaved() { return route.get().filter((id) => routable(routeSession.place(id))); }

  function renderIdle() {
    const ids = routableSaved();
    const visited = ids.filter((id) => tripStore.isVisited(id)).length;
    const trip = q('[data-nav-trip]');
    const pending = ids.length - visited;
    trip.hidden = visited === 0;
    trip.textContent = pending === 0
      ? `Completaste todos los lugares de tu ruta (${visited} de ${ids.length}).`
      : `Recorrido en curso: ${visited} de ${ids.length} ${ids.length === 1 ? 'lugar visitado' : 'lugares visitados'}.`;
    const start = q<HTMLButtonElement>('[data-nav-view="idle"] [data-nav-start]');
    start.hidden = pending === 0;
    start.textContent = visited ? 'Reanudar recorrido' : 'Iniciar recorrido';
    q('[data-nav-view="idle"] [data-nav-reset]').hidden = visited === 0;
  }

  function statusLine(n: NavState): { sym: string; word: string; tone: string } {
    switch (n.status) {
      case 'starting': return { sym: '◌', word: n.fix ? 'Calculando tu ruta…' : 'Buscando tu ubicación…', tone: 'idle' };
      case 'paused': return n.pauseReason === 'background'
        ? { sym: 'Ⅱ', word: 'En pausa: la página quedó en segundo plano', tone: 'warn' }
        : { sym: 'Ⅱ', word: 'Recorrido en pausa', tone: 'warn' };
      case 'off-route': return { sym: '◐', word: 'Fuera de la ruta', tone: 'warn' };
      case 'rerouting': return { sym: '◌', word: 'Recalculando ruta…', tone: 'idle' };
      default: return { sym: '●', word: 'En ruta', tone: 'ok' };
    }
  }

  function messages(n: NavState): string[] {
    const out: string[] = [];
    if (!n.online) out.push('Sin conexión. Seguimos mostrando tu última ruta; el recálculo se reanudará cuando vuelva la señal.');
    if (n.status === 'off-route' && n.rerouteBlock === 'cooldown') out.push('Volveremos a calcular en unos segundos si sigues fuera de la ruta.');
    if (n.status === 'off-route' && n.rerouteBlock === 'limit') out.push(`Se alcanzó el límite de ${MAX_AUTO_REROUTES} recálculos automáticos. Usa «Recalcular ruta» si lo necesitas.`);
    if (n.routeError && n.status !== 'rerouting') out.push(`No se pudo recalcular: ${errorMessage(n.routeError)} Seguimos con tu ruta anterior.`);
    if (n.gps === 'poor' && n.fix) out.push(`Señal GPS débil (± ${nf.format(Math.round(n.fix.accuracy))} m): el avance puede no ser exacto.`);
    if (n.gps === 'lost') out.push('Sin señal GPS reciente. Mostramos tu última posición conocida.');
    if (n.status === 'paused' && n.pauseReason === 'background') out.push('Los navegadores pueden detener la ubicación cuando la página no está visible.');
    return out;
  }

  function renderLive(n: NavState) {
    const p = n.progress;
    q('[data-nav-dest]').textContent = n.next?.name ?? (n.status === 'starting' ? 'Preparando…' : '—');
    q('[data-nav-dist]').textContent = p ? fmtDistance(p.distanceToNext) : '—';
    q('[data-nav-time]').textContent = p ? fmtDuration(p.timeToNext) : '—';
    q('[data-nav-eta]').textContent = p
      ? `Llegada estimada ${fmtTime(p.etaNext)}${n.next?.approximate ? ' · ubicación aproximada del lugar' : ''} · sin tráfico en tiempo real`
      : '';
    const pct = Math.round((p?.tripFraction ?? n.doneStops / Math.max(1, n.totalStops)) * 100);
    bar.setAttribute('aria-valuenow', String(pct));
    (bar.firstElementChild as HTMLElement).style.width = `${pct}%`;
    q('[data-nav-count]').textContent = `${n.doneStops} de ${n.totalStops} ${n.totalStops === 1 ? 'lugar completado' : 'lugares completados'}${p && n.totalStops - n.doneStops > 1 ? ` · todo el recorrido: ${fmtDistance(p.remainingDistance)}, ${fmtDuration(p.remainingTime)}` : ''}`;
    const st = statusLine(n);
    const text = st.word;
    if (text !== lastStatusText) {
      lastStatusText = text;
      statusEl.dataset.tone = st.tone;
      statusEl.innerHTML = `<span class="geo-st__sym" aria-hidden="true">${st.sym}</span><span>${text}</span>`;
    }
    const msgs = messages(n);
    const msgText = msgs.join(' ');
    if (msgEl.textContent !== msgText) msgEl.textContent = msgText;
    msgEl.hidden = msgs.length === 0;

    const paused = n.status === 'paused';
    q('[data-nav-pause]').hidden = paused || n.status === 'starting';
    q('[data-nav-resume]').hidden = !paused || n.pauseReason !== 'user';
    q('[data-nav-center]').hidden = navigation.camera !== 'free';
    rerouteBtn.hidden = n.status === 'starting' || paused;
    rerouteBtn.disabled = !n.online || n.status === 'rerouting';
    rerouteBtn.title = !n.online ? 'Sin conexión' : '';
    renderDetails(n);
  }

  function renderDetails(n: NavState) {
    const f = n.fix;
    const rows: [string, string][] = [];
    if (f) {
      rows.push(['Latitud', fmtCoord(f.coord[1], 'lat')], ['Longitud', fmtCoord(f.coord[0], 'lon')], ['Precisión', `± ${nf.format(Math.round(f.accuracy))} m`]);
      // only what the device reports: never an invented altitude, speed or heading
      if (f.altitude !== null) rows.push(['Altitud', `${nf.format(Math.round(f.altitude))} m${f.altitudeAccuracy !== null ? ` (± ${nf.format(Math.round(f.altitudeAccuracy))} m)` : ''}`]);
      if (f.speed !== null) rows.push(['Velocidad', `${nf.format(Math.round(f.speed * 3.6))} km/h`]);
      if (f.heading !== null) rows.push(['Rumbo', `${nf.format(Math.round(f.heading))}°`]);
      rows.push(['Hora', fmtTime(f.timestamp)]);
    }
    if (n.progress) rows.push(['Distancia a la ruta', fmtDistance(n.progress.distanceFromRoute)]);
    rows.push(['Recálculos automáticos', `${n.autoReroutes} de ${MAX_AUTO_REROUTES}`]);
    const html = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    const dl = q('[data-nav-details]');
    if (dl.innerHTML !== html) dl.innerHTML = html;
    const notes = [
      f && f.altitude === null ? 'Tu dispositivo no reporta altitud.' : '',
      n.route ? `${n.route.attribution}.` : '',
      'La posición no se guarda: al cerrar o recargar la página se olvida.',
    ].filter(Boolean).join(' ');
    q('[data-nav-details-note]').textContent = notes;
  }

  function renderArrived(n: NavState) {
    const a = n.arrived!;
    q('[data-nav-arrived-title]').textContent = a.visited ? `${a.name}: visitado` : `Has llegado a ${a.name}`;
    const left = n.totalStops - n.doneStops - (a.visited ? 0 : 1);
    q('[data-nav-arrived-note]').textContent = a.visited
      ? left > 0 ? 'Cuando quieras seguir, continúa al siguiente lugar.' : ''
      : `${a.approximate ? 'La ubicación de este lugar es aproximada. ' : ''}Disfruta tu visita. Nada se quita de tu ruta sin que lo decidas.`;
    q('[data-nav-visited]').hidden = a.visited;
    q<HTMLButtonElement>('[data-nav-continue]').textContent = left > 0 ? 'Continuar al siguiente lugar' : 'Terminar recorrido';
  }

  function renderFinished(n: NavState) {
    const s = n.summary;
    const name = (id: string) => routeSession.place(id)?.name ?? id;
    // the whole trip, including stops visited before a reload (stored), not only this page view
    const visited = routableSaved().filter((id) => tripStore.isVisited(id));
    q('[data-nav-sum-title]').textContent = visited.length
      ? `Visitaste ${visited.length} ${visited.length === 1 ? 'lugar' : 'lugares'}`
      : 'Terminaste tu recorrido';
    q('[data-nav-sum]').innerHTML = [...visited.map((id) => `<li>✓ ${esc(name(id))}</li>`), ...(s?.skipped ?? []).map((id) => `<li>— ${esc(name(id))} (sin marcar)</li>`)].join('');
    q('[data-nav-sum-meta]').textContent = s
      ? `Duración ${fmtDuration((s.endedAt - s.startedAt) / 1000)}${s.travelled > 50 ? ` · unos ${fmtDistance(s.travelled)} sobre la ruta` : ''}. Tus lugares visitados siguen marcados en este navegador hasta que restablezcas el recorrido.`
      : '';
  }

  function render(n: NavState) {
    const ids = routableSaved();
    const s = routeSession.get();
    card.hidden = ids.length === 0 || !s.provider;
    const active = isActive(n.status);
    if (planner) { planner.inert = active; planner.toggleAttribute('data-locked', active); }
    mapcol?.toggleAttribute('data-nav-live', active);
    const view = n.status === 'arrived-stop' ? 'arrived' : n.status === 'finished' ? 'finished' : n.status === 'error' ? 'error' : active ? 'live' : 'idle';
    if (view !== lastView) {
      // entering the trip: bring the card into view (on phones it moves to the top of the page)
      if (view === 'live' && lastView === 'idle') requestAnimationFrame(() => card.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
      show(view);
      lastView = view;
      lastStatusText = '';
      if (view !== 'live' && view !== 'arrived') release();
    }
    if (view === 'idle') renderIdle();
    else if (view === 'live') renderLive(n);
    else if (view === 'arrived') renderArrived(n);
    else if (view === 'finished') renderFinished(n);
    else if (view === 'error') q('[data-nav-err]').textContent = n.error?.message ?? '';
  }

  navigation.subscribe(render);
  route.subscribe(() => render(navigation.get()));
  tripStore.subscribe(() => render(navigation.get()));
  routeSession.subscribe(() => { if (!isActive(navigation.get().status)) render(navigation.get()); });
}

/**
 * Mi Ruta planner: starting point, travel mode, road summary, alternatives,
 * «Optimizar recorrido» (always a proposal; the visitor applies or keeps
 * their order) and the rule-based recommendations. State lives in
 * route-session; this module only renders it and forwards choices.
 */
import { route } from './route-store';
import { esc, isSeat, REGION_NAME } from './geo/places';
import { geoLocation } from './geo/location-service';
import { locationReadout } from './geo/location-ui';
import { routeSession, errorMessage, type SessionState, type Origin } from './geo/route-session';
import { fmtDelta, fmtDistance, fmtDuration } from './geo/format';
import { recommend, type RouteContext } from './geo/recommend';
import type { RouteProfile } from './geo/types';

const PROFILE_LABEL: Record<RouteProfile, string> = { car: 'en auto', foot: 'a pie', bike: 'en bicicleta' };

export function initPlanner(box: HTMLElement): void {
  const $ = <T extends HTMLElement>(s: string) => box.querySelector<T>(s)!;
  const planner = $('[data-planner]');
  const sum = $('[data-plan-summary]');
  const opt = $('[data-plan-opt]');
  const geoBox = $('[data-plan-geo]');
  const locateBtn = $<HTMLButtonElement>('[data-plan-locate]');
  const followBtn = $<HTMLButtonElement>('[data-plan-follow]');
  const select = $<HTMLSelectElement>('[data-origin-select]');
  const note = $('[data-origin-note]');
  const recos = $('[data-recos]');
  const recosList = $('[data-recos-list]');
  // declared before any subscribe(): listeners run immediately on subscription
  let context: RouteContext | null = null;
  let recoSig = '';

  // ---- municipality options (INEGI seats from /data/places.json) -------------------
  const seats = routeSession.allPlaces().filter(isSeat).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const groups = Object.entries(REGION_NAME).map(([r, label]) => {
    const opts = seats.filter((s) => s.region === r).map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    return opts ? `<optgroup label="${label}">${opts}</optgroup>` : '';
  });
  select.insertAdjacentHTML('beforeend', groups.join(''));

  // ---- origin + profile controls ------------------------------------------------------
  const originRadios = [...box.querySelectorAll<HTMLInputElement>('input[name="origin"]')];
  const profileRadios = [...box.querySelectorAll<HTMLInputElement>('input[name="profile"]')];
  let uiOrigin: Origin['kind'] = routeSession.get().origin.kind;
  /** A choice waiting for input (municipality not chosen yet, map not tapped yet). */
  let pending: Origin['kind'] | null = null;

  const showOriginPanels = () => {
    $('[data-origin-gps]').hidden = uiOrigin !== 'gps';
    $('[data-origin-place]').hidden = uiOrigin !== 'place';
    $('[data-origin-point]').hidden = uiOrigin !== 'point';
  };

  showOriginPanels();
  originRadios.forEach((r) => r.addEventListener('change', () => {
    if (!r.checked) return;
    uiOrigin = r.value as Origin['kind'];
    showOriginPanels();
    pending = null;
    if (uiOrigin === 'first') routeSession.setOrigin({ kind: 'first' });
    // without a fix the route starts at the first saved place until «Usar mi ubicación» is pressed
    else if (uiOrigin === 'gps') routeSession.setOrigin({ kind: 'gps' });
    else if (uiOrigin === 'place') {
      if (select.value) routeSession.setOrigin({ kind: 'place', id: select.value });
      else { pending = 'place'; select.focus(); }
    } else if (uiOrigin === 'point') {
      pending = 'point';
      const pick = document.querySelector<HTMLButtonElement>('[data-map-mode="route"] [data-pick-origin]');
      if (pick && pick.getAttribute('aria-pressed') !== 'true') pick.click();
    }
  }));
  select.addEventListener('change', () => { if (select.value) routeSession.setOrigin({ kind: 'place', id: select.value }); });
  profileRadios.forEach((r) => r.addEventListener('change', () => { if (r.checked) routeSession.setProfile(r.value as RouteProfile); }));

  locateBtn.addEventListener('click', async () => {
    locateBtn.setAttribute('aria-busy', 'true');
    const fix = await geoLocation.locate();
    locateBtn.removeAttribute('aria-busy');
    if (fix) routeSession.setOrigin({ kind: 'gps' });
  });
  followBtn.addEventListener('click', () => (geoLocation.get().watching ? geoLocation.stopFollowing() : geoLocation.follow()));

  geoLocation.subscribe((l) => {
    geoBox.innerHTML = locationReadout(l);
    locateBtn.textContent = l.fix ? 'Actualizar mi ubicación' : l.status === 'requesting' ? 'Buscando…' : 'Usar mi ubicación';
    followBtn.hidden = !l.fix;
    followBtn.setAttribute('aria-pressed', String(l.watching));
    followBtn.textContent = l.watching ? 'Dejar de seguir' : 'Seguir mi posición';
    if (l.status === 'denied' || l.status === 'unsupported' || l.status === 'insecure') {
      note.hidden = false;
      note.textContent = 'Sin acceso a tu ubicación puedes salir de un municipio, de un punto en el mapa o de tu primer lugar guardado.';
    }
  });

  // ---- render session --------------------------------------------------------------------
  fetch(box.dataset.contextUrl!).then((r) => (r.ok ? r.json() : null)).then((c) => { context = c; renderRecos(routeSession.get()); }).catch(() => { /* recommendations without events */ });

  routeSession.subscribe((s) => {
    planner.hidden = route.get().length === 0;
    // reflect state set elsewhere (map card «Iniciar Mi Ruta aquí», map pick, denied fallback)
    if (s.origin.kind === pending) pending = null;
    if (!pending && s.origin.kind !== uiOrigin) { uiOrigin = s.origin.kind; showOriginPanels(); }
    originRadios.forEach((r) => (r.checked = r.value === uiOrigin));
    profileRadios.forEach((r) => (r.checked = r.value === s.profile));
    if (s.origin.kind === 'place' && select.value !== s.origin.id) select.value = s.origin.id;
    if (s.originNote) { note.hidden = false; note.textContent = s.originNote; }
    else if (geoLocation.get().status !== 'denied') note.hidden = true;
    renderSummary(s);
    renderOpt(s);
    renderRecos(s);
  });

  function renderSummary(s: SessionState) {
    const routed = s.waypoints;
    const stops = routed.filter((w) => !w.id.startsWith('origin:')).length;
    const approx = routed.filter((w) => w.approximate).length;
    const skipped = s.skipped.length ? `<p class="sum__fine">Sin punto en el mapa, fuera del cálculo: ${s.skipped.map((p) => esc(p.name)).join(', ')}.</p>` : '';
    const waitingGps = uiOrigin === 'gps' && !geoLocation.get().fix
      ? '<p class="sum__fine">Mientras no compartas tu ubicación, la ruta empieza en tu primer lugar guardado.</p>' : '';
    let html = '';
    if (s.phase === 'loading') html = '<p class="geo-st"><span class="geo-st__sym" aria-hidden="true">◌</span>Calculando ruta por carretera…</p>';
    else if (s.phase === 'ok' && s.result) {
      const r = s.altIndex ? s.result.alternatives[s.altIndex - 1] ?? s.result : s.result;
      const alts = s.result.alternatives.length
        ? `<fieldset class="sum__alts"><legend class="sum__fine">Alternativas del proveedor</legend>${[s.result, ...s.result.alternatives].map((a, i) =>
            `<label><input type="radio" name="alt" value="${i}" ${i === s.altIndex ? 'checked' : ''}> ${i ? `Alternativa ${i}` : 'Ruta principal'} · ${fmtDistance(a.distance)} · ${fmtDuration(a.duration)}</label>`).join('')}</fieldset>`
        : '';
      html = `<p class="label">Recorrido ${PROFILE_LABEL[s.profile]}</p>
        <p class="sum__big"><b>${fmtDistance(r.distance)}</b><b>${fmtDuration(r.duration)}<span>aprox.</span></b></p>
        <p class="sum__meta">${stops} ${stops === 1 ? 'parada' : 'paradas'} · Inicio: <strong>${esc(routed[0].name)}</strong> · Fin: <strong>${esc(routed[routed.length - 1].name)}</strong></p>
        ${s.originMoved ? '<p class="plan__note small">Te moviste desde que se calculó la ruta. <button type="button" class="geo-act" data-plan-retry>Actualizar desde mi posición</button></p>' : ''}
        ${approx ? `<p class="sum__fine">◐ ${approx} ${approx === 1 ? 'punto tiene' : 'puntos tienen'} ubicación aproximada: el último tramo hacia ${approx === 1 ? 'él' : 'ellos'} puede variar.</p>` : ''}
        ${alts}
        <p class="sum__fine">${esc(s.result.attribution)}${s.fromCache ? ' · resultado reutilizado (sin nueva consulta)' : ''}. Tiempos sin tráfico en tiempo real.</p>`;
    } else if (s.phase === 'error') {
      html = `<p class="geo-st" data-tone="err"><span class="geo-st__sym" aria-hidden="true">⊘</span>No fue posible calcular el recorrido por carretera.</p>
        <p class="geo-msg">${errorMessage(s.error)} Tus lugares siguen guardados y el mapa los muestra sin línea: no dibujamos una línea recta como si fuera carretera.</p>
        <div class="geo-card__acts"><button type="button" class="btn btn--ghost" data-plan-retry>Reintentar ruta</button></div>`;
    } else if (s.phase === 'disabled') html = '<p class="geo-msg">El cálculo de rutas por carretera está desactivado en este sitio. Puedes ordenar tus lugares y verlos en el mapa.</p>';
    else if (s.phase === 'insufficient') html = `<p class="geo-msg">${route.get().length ? 'Para trazar un recorrido hacen falta dos puntos: guarda otro lugar o elige un punto de partida.' : ''}</p>`;
    sum.innerHTML = html + waitingGps + skipped;
  }
  sum.addEventListener('click', (e) => { if ((e.target as Element).closest('[data-plan-retry]')) routeSession.retry(); });
  sum.addEventListener('change', (e) => {
    const r = (e.target as Element).closest<HTMLInputElement>('input[name="alt"]');
    if (r) routeSession.selectAlternative(+r.value);
  });

  // ---- optimization (proposal only) -------------------------------------------------------
  function renderOpt(s: SessionState) {
    const canOptimize = s.provider && s.waypoints.length >= 3;
    opt.hidden = !canOptimize;
    if (!canOptimize) return;
    const o = s.optimization;
    if (o.phase === 'idle') {
      opt.innerHTML = `<p class="small">¿Quieres que propongamos un orden más corto en tiempo? Tu orden actual no cambia hasta que lo aceptes.</p>
        <div class="opt__acts"><button type="button" class="btn btn--ghost" data-opt-run>Optimizar recorrido</button></div>`;
    } else if (o.phase === 'loading') opt.innerHTML = '<p class="geo-st"><span class="geo-st__sym" aria-hidden="true">◌</span>Comparando tiempos entre tus lugares…</p>';
    else if (o.phase === 'error') {
      opt.innerHTML = `<p class="geo-msg">No se pudo calcular un orden optimizado. ${errorMessage(o.error ?? null)}</p>
        <div class="opt__acts"><button type="button" class="btn btn--ghost" data-opt-run>Reintentar</button><button type="button" class="btn btn--ghost" data-opt-keep>Conservar mi orden</button></div>`;
    } else if (o.phase === 'ready' && o.current && o.proposed && o.ids) {
      const names = o.ids.map((id) => routeSession.place(id)?.name ?? id);
      const dd = o.proposed.distance - o.current.distance, dt = o.proposed.duration - o.current.duration;
      opt.innerHTML = o.changed
        ? `<p class="label">Orden propuesto</p>
          <table><thead><tr><th scope="col"></th><th scope="col">Distancia</th><th scope="col">Tiempo</th></tr></thead><tbody>
            <tr><th scope="row">Tu orden</th><td>${fmtDistance(o.current.distance)}</td><td>${fmtDuration(o.current.duration)}</td></tr>
            <tr><th scope="row">Propuesto</th><td>${fmtDistance(o.proposed.distance)}</td><td>${fmtDuration(o.proposed.duration)}</td></tr>
            <tr><th scope="row">Cambio</th><td>${fmtDelta(dd, 'distance')}</td><td>${fmtDelta(dt, 'duration')}</td></tr>
          </tbody></table>
          <ol>${names.map((n) => `<li>${esc(n)}</li>`).join('')}</ol>
          <p class="sum__fine">Calculado con una matriz de tiempos por carretera del mismo proveedor y el orden que minimiza el tiempo total (exacto hasta 12 puntos; heurística vecino más cercano + 2-opt + Or-opt para más)${s.origin.kind === 'first' ? '; también puede cambiar el lugar de inicio' : ''}.</p>
          <div class="opt__acts"><button type="button" class="btn" data-opt-apply>Aplicar orden optimizado</button><button type="button" class="btn btn--ghost" data-opt-keep>Conservar mi orden</button></div>`
        : `<p class="small">Tu orden ya es el más eficiente que encontramos (${fmtDistance(o.current.distance)} · ${fmtDuration(o.current.duration)}).</p>
          <div class="opt__acts"><button type="button" class="btn btn--ghost" data-opt-keep>Conservar mi orden</button></div>`;
    }
  }
  opt.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!b) return;
    if (b.hasAttribute('data-opt-run')) void routeSession.optimize();
    else if (b.hasAttribute('data-opt-apply')) { routeSession.applyOptimization(); $('[data-mr-list]').focus?.(); }
    else if (b.hasAttribute('data-opt-keep')) routeSession.dismissOptimization();
  });

  // ---- recommendations ---------------------------------------------------------------------
  function renderRecos(s: SessionState) {
    const stops = route.get().map((id) => routeSession.place(id)).filter((p): p is NonNullable<typeof p> => !!p);
    // wait for a settled route (or a definitive failure) before suggesting
    if (s.phase === 'loading') return;
    const sig = [stops.map((p) => p.id).join(), s.result?.computedAt ?? '', s.altIndex, s.profile, context ? 1 : 0].join('#');
    if (sig === recoSig) return;
    recoSig = sig;
    const line = s.phase === 'ok' && s.result ? (s.altIndex ? s.result.alternatives[s.altIndex - 1]?.geometry ?? s.result.geometry : s.result.geometry).coordinates : null;
    const items = recommend({ stops, line, profile: s.profile, places: routeSession.allPlaces(), context, month: new Date().getMonth() + 1 });
    recos.hidden = items.length === 0;
    const KIND: Record<string, string> = { 'near-route': 'Cerca de tu ruta', event: 'Evento', lodging: 'Dónde dormir', dishes: 'Qué probar' };
    recosList.innerHTML = items.map((r) => `<li data-kind="${r.kind}">
      <div><p class="rc__k">${KIND[r.kind]}${r.approximate ? ' · ubicación aproximada' : ''}</p>
        <p class="rc__t">${r.url ? `<a href="${r.url}">${esc(r.title)}</a>` : esc(r.title)}</p>
        <p class="rc__r">${esc(r.reason)}</p></div>
      ${r.placeId ? `<button type="button" class="rbtn rbtn--quiet" data-route-add="${r.placeId}" data-route-name="${esc(r.title)}" aria-pressed="false"><span class="rbtn__icon" aria-hidden="true"></span><span data-route-label>Añadir a Mi Ruta</span></button>` : ''}
    </li>`).join('');
    document.dispatchEvent(new Event('route:refresh'));
  }
}

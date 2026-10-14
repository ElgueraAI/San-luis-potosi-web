/**
 * Interaction layer of /inteligencia-turistica/. The charts are already in the
 * HTML (built at compile time); this adds the chapter index, one shared
 * tooltip (hover, focus and touch), the calendar filters, the case tabs and
 * the scenario switch. The map is imported only when its chapter approaches.
 */
import { esc } from './cards';

type Region = 'altiplano' | 'centro' | 'zona-media' | 'huasteca';
interface CalData {
  events: { n: string; u: string | null; r: Region | null; m: number[]; mu: string | null; c: 'confirmed' | 'pattern' | 'past' | 'unknown' }[];
  seasons: { n: string; u: string | null; r: Region | null; m: number[] }[];
  rain: Record<string, number[]>; months: string[]; regions: Record<string, string>;
}
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const DATE_TEXT = { confirmed: 'fecha confirmada', pattern: 'patrón oficial', past: 'última edición conocida', unknown: 'fecha por confirmar' } as const;

// ---------------------------------------------------------------- tooltip ---
function initTooltips(): void {
  const tip = document.createElement('div');
  tip.className = 'vtip'; tip.hidden = true; tip.setAttribute('role', 'tooltip'); tip.id = 'vtip';
  document.body.append(tip);
  let owner: Element | null = null;
  const place = (x: number, y: number) => {
    const r = tip.getBoundingClientRect();
    tip.style.left = `${Math.max(8, Math.min(innerWidth - r.width - 8, x + 14))}px`;
    tip.style.top = `${y + r.height + 24 > innerHeight ? Math.max(8, y - r.height - 12) : y + 16}px`;
  };
  const show = (el: Element, x: number, y: number) => {
    const [head, ...rest] = (el.getAttribute('data-tip') ?? '').split('\n');
    tip.innerHTML = `<b>${esc(head)}</b>${esc(rest.join('\n'))}`;
    tip.hidden = false; owner = el; place(x, y);
  };
  const hide = () => { tip.hidden = true; owner = null; };
  document.addEventListener('pointerover', (e) => { const el = (e.target as Element).closest?.('[data-tip]'); if (el) show(el, e.clientX, e.clientY); else if (owner) hide(); });
  document.addEventListener('pointermove', (e) => { if (owner && e.pointerType === 'mouse') place(e.clientX, e.clientY); });
  document.addEventListener('focusin', (e) => { const el = (e.target as Element).closest?.('[data-tip]'); if (el) { const r = el.getBoundingClientRect(); show(el, r.left + r.width / 2, r.bottom - 8); } });
  document.addEventListener('focusout', hide);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  addEventListener('scroll', hide, { passive: true });
}

// ---------------------------------------------------------- chapter index ---
function initChapterNav(): void {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('.chnav a')];
  const byId = new Map(links.map((a) => [a.hash.slice(1), a]));
  if (!links.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      links.forEach((a) => a.removeAttribute('aria-current'));
      const a = byId.get(en.target.id);
      a?.setAttribute('aria-current', 'true');
      a?.parentElement?.parentElement?.scrollTo({ left: Math.max(0, (a.offsetLeft ?? 0) - 24), behavior: 'auto' });
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  byId.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
}

// --------------------------------------------------------------- calendar ---
function initCalendar(box: HTMLElement): void {
  const data = JSON.parse(document.querySelector('[data-cal-data]')!.textContent!) as CalData;
  const $ = <T extends HTMLElement>(s: string) => box.querySelector<T>(s)!;
  const state = { month: new Date().getMonth() + 1, region: 'all' as Region | 'all', compare: 0 };
  const regions = Object.keys(data.regions) as Region[];
  const count = (m: number, r: Region | 'all') => data.events.filter((e) => e.m.includes(m) && (r === 'all' || e.r === r)).length;
  const link = (n: string, u: string | null) => (u ? `<a href="${esc(u)}">${esc(n)}</a>` : esc(n));

  function render() {
    const { month, region, compare } = state;
    box.querySelectorAll<HTMLButtonElement>('[data-cal-month]').forEach((b) => {
      const cell = b.dataset.calCell;
      b.setAttribute('aria-pressed', String(+b.dataset.calMonth! === month && (cell ? region === cell : true)));
    });
    box.querySelectorAll<HTMLButtonElement>('[data-cal-region]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.calRegion === region)));
    box.querySelectorAll<HTMLElement>('[data-cal-row]').forEach((tr) => tr.toggleAttribute('data-dim', region !== 'all' && tr.dataset.calRow !== region));

    const where = region === 'all' ? 'todo el estado' : data.regions[region];
    const list = data.events.filter((e) => e.m.includes(month) && (region === 'all' || e.r === region)).sort((a, b) => a.n.localeCompare(b.n, 'es'));
    $('[data-cal-title]').textContent = `${cap(data.months[month - 1])} · ${where}`;
    $('[data-cal-summary]').textContent = `${list.length} ${list.length === 1 ? 'evento documentado' : 'eventos documentados'}. Abre una ficha para ver el estado de su fecha y su fuente.`;
    $('[data-cal-events]').innerHTML = list.length
      ? list.map((e) => `<li>${link(e.n, e.u)}<small>${esc(e.mu ?? 'Varios municipios')}${e.r ? ` · ${esc(data.regions[e.r])}` : ''} · ${DATE_TEXT[e.c]}</small></li>`).join('')
      : '<li><small>Sin eventos documentados para esta selección. No significa que no haya fiestas: puede faltar el registro.</small></li>';
    const seasons = data.seasons.filter((s) => s.m.includes(month) && (region === 'all' || s.r === region));
    $('[data-cal-seasons]').innerHTML = seasons.length
      ? seasons.map((s) => `<li>${link(s.n, s.u)}<small>${s.r ? esc(data.regions[s.r]) : ''} · temporada recomendada por la fuente oficial</small></li>`).join('')
      : '<li><small>Ninguna fuente oficial declara temporada para este mes en esta selección. Solo 8 lugares de la base tienen temporada declarada.</small></li>';
    $('[data-cal-rain]').textContent = (region === 'all' ? regions : [region]).map((r) => `${data.regions[r]}: ${data.rain[r][month - 1]} días con lluvia`).join(' · ') + '. Promedio 2016–2025, no es un pronóstico.';

    const cmp = $('[data-cal-cmp-box]');
    cmp.hidden = !compare || compare === month;
    if (!cmp.hidden) {
      const rows = (region === 'all' ? regions : [region]).map((r) => { const a = count(month, r), b = count(compare, r); return `<tr><th scope="row">${esc(data.regions[r])}</th><td class="num">${a}</td><td class="num">${b}</td><td class="num">${a - b > 0 ? '+' : ''}${a - b}</td></tr>`; }).join('');
      $('[data-cal-cmp]').innerHTML = `<table class="dtable"><thead><tr><th scope="col">Región</th><th scope="col" class="num">${esc(cap(data.months[month - 1]))}</th><th scope="col" class="num">${esc(cap(data.months[compare - 1]))}</th><th scope="col" class="num">Diferencia</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
  }
  box.addEventListener('click', (e) => {
    const t = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!t) return;
    if (t.dataset.calMonth) { state.month = +t.dataset.calMonth; state.region = (t.dataset.calCell as Region | undefined) ?? (t.classList.contains('calg__m') ? state.region : 'all'); render(); }
    else if (t.dataset.calRegion) { state.region = t.dataset.calRegion as Region | 'all'; render(); }
  });
  $<HTMLSelectElement>('[data-cal-compare]').addEventListener('change', (e) => { state.compare = +(e.target as HTMLSelectElement).value; render(); });
  render();
}

// ------------------------------------------------------------------ cases ---
function initCases(box: HTMLElement): void {
  const tabs = [...box.querySelectorAll<HTMLButtonElement>('[data-case-tab]')];
  const pick = (id: string, focus = false) => {
    tabs.forEach((t) => { const on = t.dataset.caseTab === id; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
    box.querySelectorAll<HTMLElement>('[data-case-panel]').forEach((p) => (p.hidden = p.dataset.casePanel !== id));
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => pick(t.dataset.caseTab!));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      pick(tabs[(i + d + tabs.length) % tabs.length].dataset.caseTab!, true);
    });
  });
}

// --------------------------------------------------------------- scenario ---
function initScenario(box: HTMLElement): void {
  const data = JSON.parse(box.querySelector('[data-sim-data]')!.textContent!) as { id: string; big: string; n: string }[];
  box.querySelectorAll<HTMLButtonElement>('[data-sim-step]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.simStep!, s = data.find((x) => x.id === id)!;
    box.querySelectorAll('[data-sim-step]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    box.querySelector('[data-sim-big]')!.textContent = s.big;
    box.querySelector('[data-sim-n]')!.textContent = s.n;
    box.querySelectorAll<HTMLElement>('[data-sim-bar]').forEach((li) => li.toggleAttribute('data-on', li.dataset.simBar === id));
    box.querySelectorAll<HTMLElement>('[data-sim-delta]').forEach((ul) => (ul.hidden = ul.dataset.simDelta !== id));
  }));
}

export function initDashboard(): void {
  initTooltips();
  initChapterNav();
  const cal = document.querySelector<HTMLElement>('[data-cal2]'); if (cal) initCalendar(cal);
  const cases = document.querySelector<HTMLElement>('[data-cases]'); if (cases) initCases(cases);
  const sim = document.querySelector<HTMLElement>('[data-sim]'); if (sim) initScenario(sim);
  const opp = document.querySelector<HTMLElement>('[data-opp]');
  if (opp) {
    const load = () => import('./opportunity-map').then((m) => m.initOpportunityMap(opp));
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); void load(); } }, { rootMargin: '900px 0px' });
      io.observe(opp);
    } else void load();
  }
}

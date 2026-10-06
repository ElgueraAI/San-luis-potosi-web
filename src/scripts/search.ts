/**
 * Site search over the static index (/data/search.json): accent- and
 * case-insensitive, every word must match, ranked by where the match falls
 * (name start, name, then context). Filters: kind family and region. Reads and
 * writes ?q=&tipo=&region= so results can be linked.
 */
type Row = { n: string; k: string; u: string; r: string | null; m: string | null; x: string };
const REG: Record<string, string> = { altiplano: 'Altiplano', centro: 'Centro', 'zona-media': 'Zona Media', huasteca: 'Huasteca' };
const FAMILY: [string, RegExp][] = [
  ['lugares', /Municipio|Región|Pueblo|Cascada|Destino|Patrimonio|Naturaleza|Arqueolog|Plaza|Barroco|Cultura|Arte|Ciudad|Paisaje|Cueva|Sima|Río|Haciendas|Fe |Gastronom|Artesan|Aventura|Poblado|Ruinas|Icono|Barrio|Teatro|Museo|Área|Monumento|Sitio|Reserva/i],
  ['eventos', /Fiesta|evento/i],
  ['experiencias', /Experiencia/i],
  ['cultura', /Museo|Teatro|Centro cultural|Galer|Auditorio|artesan/i],
  ['hospedaje', /Hospedaje/i],
  ['secciones', /Qué hacer|Sección|Recurso/i],
];
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function initSearch(): void {
  const box = document.querySelector<HTMLElement>('[data-search]');
  if (!box) return;
  const form = box.querySelector<HTMLFormElement>('form')!;
  const q = form.querySelector<HTMLInputElement>('[name="q"]')!;
  const tipo = form.querySelector<HTMLSelectElement>('[name="tipo"]');
  const region = form.querySelector<HTMLSelectElement>('[name="region"]');
  const out = box.querySelector<HTMLElement>('[data-search-results]')!;
  const status = box.querySelector<HTMLElement>('[data-search-status]')!;
  const p = new URLSearchParams(location.search);
  q.value = p.get('q') ?? '';
  if (tipo) tipo.value = p.get('tipo') ?? '';
  if (region) region.value = p.get('region') ?? '';
  let rows: (Row & { _n: string; _x: string })[] = [];

  const run = () => {
    const words = norm(q.value).split(/\s+/).filter(Boolean);
    const fam = tipo?.value ?? '';
    const reg = region?.value ?? '';
    const famRe = FAMILY.find(([f]) => f === fam)?.[1];
    if (!words.length && !fam && !reg) { out.innerHTML = ''; status.textContent = 'Escribe un destino, municipio, evento o tema.'; return; }
    const hits = rows
      .filter((r) => (!reg || r.r === reg) && (!famRe || famRe.test(r.k)) && words.every((w) => r._n.includes(w) || r._x.includes(w)))
      .map((r) => ({ r, s: words.reduce((a, w) => a + (r._n.startsWith(w) ? 6 : r._n.includes(w) ? 3 : 1), 0) + (r.k === 'Municipio' || r.k === 'Región' ? 1 : 0) }))
      .sort((a, b) => b.s - a.s || a.r.n.localeCompare(b.r.n, 'es'))
      .slice(0, 80);
    status.textContent = `${hits.length === 80 ? 'Más de 80' : hits.length} ${hits.length === 1 ? 'resultado' : 'resultados'}${q.value ? ` para «${q.value}»` : ''}`;
    out.innerHTML = hits.map(({ r }) => `
      <li class="sres" ${r.r ? `data-region="${r.r}"` : ''}>
        <a href="${esc(r.u)}"><span class="sres__k">${esc(r.k)}</span><span class="sres__n">${esc(r.n)}</span>
        <span class="sres__m">${[r.m, r.r ? REG[r.r] : null].filter(Boolean).map((x) => esc(x!)).join(' · ')}</span></a>
      </li>`).join('');
    const u = new URLSearchParams();
    if (q.value) u.set('q', q.value);
    if (fam) u.set('tipo', fam);
    if (reg) u.set('region', reg);
    history.replaceState(null, '', `${location.pathname}${u.toString() ? `?${u}` : ''}`);
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); run(); });
  form.addEventListener('input', run);
  status.textContent = 'Cargando el índice…';
  fetch(box.dataset.searchSrc!)
    .then((r) => r.json())
    .then((data: Row[]) => {
      rows = data.map((r) => ({ ...r, _n: norm(r.n), _x: norm(`${r.k} ${r.m ?? ''} ${r.x}`) }));
      run();
    })
    .catch(() => (status.textContent = 'No se pudo cargar el índice de búsqueda.'));
}

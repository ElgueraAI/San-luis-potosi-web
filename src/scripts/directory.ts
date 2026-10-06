/**
 * Static directory filter: every [data-dir] block loads its JSON (built at
 * compile time under /data/), then filters by text, region, municipality and
 * type and renders 24 cards at a time. The server-rendered first page stays
 * in place until the data arrives, so the list works without JavaScript.
 * Filters are mirrored in the query string (?q=&region=&mun=&tipo=).
 */
type Row = { id: string; n: string; t: string; ty: string; m: string | null; ms: string | null; r: string | null; a: string | null; p: string | null; u: string | null; o: boolean; c: boolean; s: string };

const REG: Record<string, string> = { altiplano: 'Altiplano', centro: 'Centro', 'zona-media': 'Zona Media', huasteca: 'Huasteca' };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function initDirectories(): void {
  document.querySelectorAll<HTMLElement>('[data-dir]').forEach(async (box) => {
    const list = box.querySelector<HTMLElement>('[data-dir-list]')!;
    const count = box.querySelector<HTMLElement>('[data-dir-count]');
    const more = box.querySelector<HTMLButtonElement>('[data-dir-more]');
    const form = box.querySelector<HTMLFormElement>('[data-dir-form]');
    const muniBase = box.dataset.muniBase ?? '';
    let rows: Row[] = [];
    try {
      const r = await fetch(box.dataset.dirSrc!);
      if (!r.ok) return;
      rows = await r.json();
    } catch { return; }
    const field = (n: string) => form?.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${n}"]`);
    const params = new URLSearchParams(location.search);
    for (const k of ['q', 'region', 'mun', 'tipo']) { const f = field(k); if (f && params.get(k)) f.value = params.get(k)!; }
    let shown = 24;

    const card = (x: Row) => `
      <li><article class="ecard" ${x.r ? `data-region="${x.r}"` : ''}>
        <p class="ecard__type">${esc(x.t)}</p>
        <h3 class="ecard__name">${esc(x.n)}</h3>
        ${x.m ? `<p class="ecard__where">${x.ms ? `<a href="${muniBase}${x.ms}/">${esc(x.m)}</a>` : esc(x.m)}${x.r ? `<span class="ecard__reg"><span class="ecard__dot" aria-hidden="true"></span>${REG[x.r]}</span>` : ''}</p>` : ''}
        ${x.a ? `<p class="ecard__meta">${esc(x.a)}</p>` : ''}
        ${x.u || x.p ? `<p class="ecard__links">${x.u ? `<a class="link" href="${esc(x.u)}" rel="noopener" target="_blank">Sitio oficial<span class="visually-hidden"> de ${esc(x.n)} (abre en otra pestaña)</span></a>` : ''}${x.p ? `<span class="ecard__phone">Tel. ${esc(x.p)}</span>` : ''}</p>` : ''}
        <div class="ecard__foot"><p class="ecard__src">${esc(x.s)}</p>${x.c ? `<button type="button" class="rbtn rbtn--icon" data-route-add="${x.id}" data-route-name="${esc(x.n)}" aria-pressed="false" aria-label="Añadir ${esc(x.n)} a Mi Ruta"><span class="rbtn__icon" aria-hidden="true"></span></button>` : ''}</div>
      </article></li>`;

    const apply = (reset = true) => {
      if (reset) shown = 24;
      const q = norm(field('q')?.value ?? '');
      const region = field('region')?.value ?? '';
      const mun = field('mun')?.value ?? '';
      const tipo = field('tipo')?.value ?? '';
      const hit = rows.filter((x) => (!region || x.r === region) && (!mun || x.ms === mun) && (!tipo || x.ty === tipo) && (!q || norm(`${x.n} ${x.m ?? ''} ${x.t} ${x.a ?? ''}`).includes(q)));
      list.innerHTML = hit.slice(0, shown).map(card).join('') || '<li class="dir__empty">Sin resultados con estos filtros.</li>';
      if (count) count.textContent = `${hit.length.toLocaleString('es-MX')} ${hit.length === 1 ? 'resultado' : 'resultados'}`;
      if (more) more.hidden = hit.length <= shown;
      const u = new URLSearchParams();
      if (q) u.set('q', field('q')!.value);
      if (region) u.set('region', region);
      if (mun) u.set('mun', mun);
      if (tipo) u.set('tipo', tipo);
      history.replaceState(null, '', `${location.pathname}${u.toString() ? `?${u}` : ''}${location.hash}`);
      document.dispatchEvent(new CustomEvent('route:refresh'));
    };
    form?.addEventListener('input', () => apply());
    form?.addEventListener('submit', (ev) => { ev.preventDefault(); apply(); });
    more?.addEventListener('click', () => { shown += 24; apply(false); });
    apply();
  });
}

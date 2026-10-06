/**
 * Events calendar: one panel per month plus «Todo el año». Opens on ?mes=
 * (the menu's «Eventos por mes» links), else on the visitor's month; month
 * buttons switch panels, filters hide cards inside the visible panel, the map
 * dims municipalities with no event that month, and hovering or focusing a
 * card highlights its municipality. Without JavaScript all panels show.
 */
export function initCalendar(): void {
  const box = document.querySelector<HTMLElement>('[data-cal]');
  if (!box) return;
  const form = box.querySelector<HTMLFormElement>('[data-cal-form]')!;
  const panels = [...box.querySelectorAll<HTMLElement>('[data-cal-panel]')];
  const buttons = [...box.querySelectorAll<HTMLButtonElement>('[data-cal-month]')];
  const mapBox = box.querySelector<HTMLElement>('[data-cal-map]');
  const dots = mapBox ? [...mapBox.querySelectorAll<SVGGElement>('.sil__dot')] : [];
  const muniMonths: Record<string, number[]> = mapBox ? JSON.parse(mapBox.dataset.munMonths ?? '{}') : {};
  const q = new URLSearchParams(location.search).get('mes');
  let current = q && (q === 'todo' || (+q >= 1 && +q <= 12)) ? q : String(new Date().getMonth() + 1);
  const val = (n: string) => form.querySelector<HTMLSelectElement>(`[name="${n}"]`)?.value ?? '';

  const apply = () => {
    const reg = val('region'), cat = val('cat'), st = val('estado'), mun = val('mun');
    panels.forEach((p) => {
      p.hidden = p.dataset.calPanel !== current;
      if (p.hidden) return;
      const items = [...p.querySelectorAll<HTMLElement>('[data-cal-item]')];
      let n = 0;
      items.forEach((it) => {
        const on = (!reg || it.dataset.region === reg) && (!cat || it.dataset.cat === cat) && (!st || it.dataset.status === st) && (!mun || it.dataset.mun === mun);
        it.hidden = !on;
        if (on) n++;
      });
      const count = p.querySelector<HTMLElement>('[data-cal-count]');
      if (count && current !== 'todo') count.textContent = `${n} ${n === 1 ? 'evento' : 'eventos'}`;
      const empty = p.querySelector<HTMLElement>('[data-cal-empty]');
      if (empty) empty.hidden = !(items.length > 0 && n === 0);
    });
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.calMonth === current)));
    dots.forEach((d) => d.classList.toggle('is-off', current !== 'todo' && !(muniMonths[d.dataset.id ?? ''] ?? []).includes(+current)));
    const u = new URLSearchParams(location.search);
    u.set('mes', current);
    history.replaceState(null, '', `${location.pathname}?${u}`);
  };
  buttons.forEach((b) => b.addEventListener('click', () => { current = b.dataset.calMonth!; apply(); }));
  form.addEventListener('input', apply);

  // card ↔ map: highlight the card's municipality
  const hot = (id: string | null) => dots.forEach((d) => d.classList.toggle('is-hot', !!id && d.dataset.id === id));
  box.addEventListener('pointerover', (e) => { const c = (e.target as Element).closest<HTMLElement>('[data-ev-mun]'); hot(c?.dataset.evMun || null); });
  box.addEventListener('pointerleave', () => hot(null));
  box.addEventListener('focusin', (e) => { const c = (e.target as Element).closest<HTMLElement>('[data-ev-mun]'); hot(c?.dataset.evMun || null); });
  apply();
}

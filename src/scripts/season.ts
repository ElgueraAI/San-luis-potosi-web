/**
 * Month / season switcher for SeasonModule. Opens on the visitor's month,
 * marks it as "hoy", and keeps the active month visible in the rail. Each
 * panel renders its own head (month, season, previous/next); this module
 * keeps every head's labels in step with the selection and passes the visible
 * panel's palette (data-stage-tone) to the rail.
 */
const NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const SEASON_OF = ['Invierno', 'Invierno', 'Primavera', 'Primavera', 'Primavera', 'Verano', 'Verano', 'Verano', 'Otoño', 'Otoño', 'Otoño', 'Invierno'];

export function initSeason(): void {
  document.querySelectorAll<HTMLElement>('[data-season]').forEach((box) => {
    const panels = [...box.querySelectorAll<HTMLElement>('[data-season-panel]')];
    const all = (sel: string) => [...box.querySelectorAll<HTMLElement>(sel)];
    const setText = (sel: string, text: string) => all(sel).forEach((n) => (n.textContent = text));
    const rail = box.querySelector<HTMLElement>('[data-season-rail]');
    const monthBtns = [...box.querySelectorAll<HTMLButtonElement>('[data-season-month]')];
    const picks = [...box.querySelectorAll<HTMLButtonElement>('[data-season-pick]')];
    const today = new Date().getMonth() + 1;
    let month = today;

    monthBtns.find((b) => +b.dataset.seasonMonth! === today)?.setAttribute('data-today', '');

    const show = (key: string) =>
      panels.forEach((p) => {
        p.hidden = p.dataset.seasonPanel !== key;
        // the rail takes the visible story's palette
        if (!p.hidden) box.dataset.mtone = p.dataset.stageTone ?? '';
      });
    const reveal = (btn: HTMLElement | undefined) => {
      if (!rail || !btn || rail.scrollWidth <= rail.clientWidth) return;
      rail.scrollTo({ left: btn.offsetLeft - (rail.clientWidth - btn.offsetWidth) / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    };
    const setMonth = (m: number) => {
      month = ((m - 1 + 12) % 12) + 1;
      show(`m${month}`);
      setText('[data-season-current]', NAMES[month - 1]);
      setText('[data-season-kicker]', SEASON_OF[month - 1]);
      setText('[data-season-prev-label]', NAMES[(month + 10) % 12]);
      setText('[data-season-next-label]', NAMES[month % 12]);
      picks.forEach((b) => b.setAttribute('aria-pressed', 'false'));
      monthBtns.forEach((b) => {
        b.setAttribute('aria-pressed', String(+b.dataset.seasonMonth! === month));
        b.classList.remove('is-in-season');
      });
      reveal(monthBtns[month - 1]);
    };
    all('[data-season-prev]').forEach((b) => b.addEventListener('click', () => setMonth(month - 1)));
    all('[data-season-next]').forEach((b) => b.addEventListener('click', () => setMonth(month + 1)));
    monthBtns.forEach((b) => b.addEventListener('click', () => setMonth(+b.dataset.seasonMonth!)));
    picks.forEach((b) =>
      b.addEventListener('click', () => {
        show(b.dataset.seasonPick!);
        setText('[data-season-current]', b.textContent ?? '');
        setText('[data-season-kicker]', 'Temporada');
        picks.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        const ms = (b.dataset.seasonMonths ?? '').split(' ').map(Number);
        monthBtns.forEach((x) => {
          x.setAttribute('aria-pressed', 'false');
          x.classList.toggle('is-in-season', ms.includes(+x.dataset.seasonMonth!));
        });
        reveal(monthBtns[ms[0] - 1]);
      }),
    );
    setMonth(month);
  });
}

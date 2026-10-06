/** Municipality index: text and region filter over the server-rendered cards. */
export function initMuniIndex(): void {
  const box = document.querySelector<HTMLElement>('[data-muni-index]');
  if (!box) return;
  const q = box.querySelector<HTMLInputElement>('[data-mi-q]')!;
  const btns = [...box.querySelectorAll<HTMLButtonElement>('[data-mi-region]')];
  const items = [...box.querySelectorAll<HTMLElement>('[data-mi-name]')];
  const groups = [...box.querySelectorAll<HTMLElement>('[data-mi-group]')];
  const count = box.querySelector<HTMLElement>('[data-mi-count]');
  let region = new URLSearchParams(location.search).get('region') ?? '';
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const apply = () => {
    const t = norm(q.value.trim());
    let n = 0;
    items.forEach((li) => {
      const on = (!region || li.dataset.miReg === region) && (!t || li.dataset.miName!.includes(t));
      li.hidden = !on;
      if (on) n++;
    });
    groups.forEach((g) => (g.hidden = !g.querySelector('[data-mi-name]:not([hidden])')));
    btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.miRegion === region)));
    if (count) count.textContent = `${n} ${n === 1 ? 'municipio' : 'municipios'}`;
  };
  q.addEventListener('input', apply);
  btns.forEach((b) => b.addEventListener('click', () => { region = b.dataset.miRegion ?? ''; apply(); }));
  apply();
}

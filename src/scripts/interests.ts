/** Interest cards filter the destinations rail beneath them. */
export function initInterests(): void {
  document.querySelectorAll<HTMLElement>('[data-interests]').forEach((box) => {
    const cards = [...box.querySelectorAll<HTMLButtonElement>('[data-interest]')];
    const items = [...box.querySelectorAll<HTMLElement>('li[data-interests]')];
    const label = box.querySelector<HTMLElement>('[data-ints-label]');
    const count = box.querySelector<HTMLElement>('[data-ints-count]');
    const rail = items[0]?.parentElement;
    cards.forEach((c) =>
      c.addEventListener('click', () => {
        const id = c.dataset.interest!;
        cards.forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
        let n = 0;
        items.forEach((li) => {
          const on = li.dataset.interests!.split(' ').includes(id);
          li.hidden = !on;
          if (on) n++;
        });
        if (label) label.textContent = c.dataset.label ?? '';
        if (count) count.textContent = String(n);
        rail?.scrollTo({ left: 0 });
      }),
    );
  });
}

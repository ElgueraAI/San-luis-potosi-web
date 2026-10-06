/**
 * The Descent controller. Mounts the Scroll Craft engine (unmodified) for the
 * one pinned act, then reads the progress it publishes (--sc-p on the section)
 * and turns it into a position along the measured transect.
 *
 *   p 0.00-0.06  hold at Real de Catorce
 *   p 0.06-0.90  travel 0 → 376 km; photograph and copy cut at each boundary
 *   p 0.90-1.00  hold at Ciudad Valles, the finale line appears
 *
 * Reduced motion, Save-Data tiers keep motion off: the section renders as a
 * static figure (data-static), never pinned.
 */
type Data = { length: number; ceil: number; samples: [number, number, string, string][]; segments: { region: string; from: number; to: number }[] };

const fmt = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

function engineReady(): Promise<NonNullable<Window['ScrollCraft']>> {
  return new Promise((resolve, reject) => {
    if (window.ScrollCraft) return resolve(window.ScrollCraft);
    const tag = document.querySelector<HTMLScriptElement>('script[src*="scrollcraft.js"]');
    if (!tag) return reject(new Error('engine script missing'));
    tag.addEventListener('load', () => (window.ScrollCraft ? resolve(window.ScrollCraft) : reject(new Error('engine did not install'))));
    tag.addEventListener('error', () => reject(new Error('engine failed to load')));
  });
}

export async function initDescent(tier: string): Promise<void> {
  const section = document.querySelector<HTMLElement>('[data-descent]');
  if (!section) return;
  const data: Data = JSON.parse(section.querySelector('[data-dsc-data]')!.textContent!);
  const clip = section.querySelector<SVGRectElement>('[data-dsc-clip]')!;
  const W = 1000;

  const makeStatic = () => {
    section.removeAttribute('data-sc-act');
    section.removeAttribute('data-sc-span');
    section.setAttribute('data-static', '');
    clip.setAttribute('width', String(W));
  };
  if (tier !== 'full') return makeStatic();

  if (matchMedia('(max-width: 760px)').matches && section.dataset.spanMobile) {
    section.setAttribute('data-sc-span', section.dataset.spanMobile);
  }
  try {
    const sc = await engineReady();
    sc.mount(document.body);
    document.fonts?.ready.then(() => dispatchEvent(new Event('resize')));
  } catch (err) {
    console.warn('[descent] engine unavailable, static figure instead:', err);
    return makeStatic();
  }

  const photos = [...section.querySelectorAll<HTMLElement>('[data-dsc-photo]')];
  const copies = [...section.querySelectorAll<HTMLElement>('[data-dsc-copy]')];
  const labels = [...section.querySelectorAll<HTMLElement>('[data-dsc-label]')];
  const chart = section.querySelector<HTMLElement>('.dsc__chart')!;
  const marker = section.querySelector<HTMLElement>('[data-dsc-marker]')!;
  const alt = section.querySelector<HTMLElement>('[data-dsc-alt]')!;
  const where = section.querySelector<HTMLElement>('[data-dsc-where]')!;
  const finale = section.querySelector<HTMLElement>('[data-dsc-finale]')!;
  const S = data.samples;

  let region = '';
  let lastP = -1;
  let running = false;

  const sampleAt = (km: number) => {
    const f = (km / data.length) * (S.length - 1);
    const i = Math.min(Math.floor(f), S.length - 2);
    const t = f - i;
    return { m: S[i][1] + (S[i + 1][1] - S[i][1]) * t, region: (t < 0.5 ? S[i] : S[i + 1])[2], near: (t < 0.5 ? S[i] : S[i + 1])[3] };
  };

  const frame = () => {
    if (!running) return;
    requestAnimationFrame(frame);
    const p = parseFloat(section.style.getPropertyValue('--sc-p')) || 0;
    if (Math.abs(p - lastP) < 0.0005) return;
    lastP = p;
    const t = Math.min(Math.max((p - 0.06) / 0.84, 0), 1);
    const km = t * data.length;
    const s = sampleAt(km);
    const cw = chart.clientWidth, ch = chart.clientHeight;
    const x = (km / data.length) * cw;
    const y = (1 - s.m / data.ceil) * ch;
    marker.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    marker.classList.toggle('is-right', x > cw * 0.7);
    clip.setAttribute('width', ((km / data.length) * W).toFixed(1));
    alt.textContent = `${fmt.format(s.m)} m`;
    where.textContent = `km ${fmt.format(km)} · ${s.near}`;
    if (s.region !== region) {
      region = s.region;
      photos.forEach((el) => el.classList.toggle('is-active', el.dataset.dscPhoto === region));
      copies.forEach((el) => el.classList.toggle('is-active', el.dataset.dscCopy === region));
      labels.forEach((el) => el.classList.toggle('is-active', el.dataset.dscLabel === region));
    }
    finale.classList.toggle('is-on', p > 0.9);
  };

  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !running) { running = true; lastP = -1; requestAnimationFrame(frame); }
    else if (!e.isIntersecting) running = false;
  }).observe(section);
  addEventListener('resize', () => (lastP = -1));
}

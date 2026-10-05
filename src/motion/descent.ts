/**
 * The Descent controller.
 *
 * Reads the act progress the engine publishes (--sc-p, inline on the section)
 * and turns it into: a camera position along the terrain line, the cut of each
 * regional world, the drop into the Huasteca, the altitude readout (only when a
 * verified measured profile exists) and the `slp:position` events the Line
 * follows. The engine itself is never touched.
 *
 * Progress map (p is the pinned travel, 0..1):
 *   0.00-0.03  hold on the Altiplano
 *   0.03-0.80  travel west to east; each region gets an equal share and
 *              lingers at its centre; cuts happen at the shares' edges
 *   0.80-0.97  the drop: the line rises off the top, the video takes the frame
 *   0.86-1.00  the finale line (an engine cue)
 */
import { camera, viewBoxAttr, linger, smoothstep, CAMERA_DESKTOP, CAMERA_MOBILE, type CameraOpts } from './camera';
import { profile, altitudesEnabled, elevationAt, WORLD } from '@/data/geo';

const P0 = 0.03;
const P1 = 0.8;
const CUT = 0.03;

type World = {
  el: HTMLElement;
  id: string;
  ground: string;
  from: number;
  to: number;
  svg: SVGSVGElement;
  done: SVGRectElement;
  marker: SVGCircleElement;
  copy: HTMLElement;
};

export function initDescent(tier: SlpTier): void {
  const section = document.querySelector<HTMLElement>('[data-descent]');
  if (!section) return;
  const stage = section.querySelector<HTMLElement>('[data-sc-stage]')!;

  const worlds: World[] = Array.from(section.querySelectorAll<HTMLElement>('[data-world]')).map((el) => ({
    el,
    id: el.dataset.region!,
    ground: el.dataset.ground!,
    from: parseFloat(el.dataset.from!),
    to: parseFloat(el.dataset.to!),
    svg: el.querySelector<SVGSVGElement>('.slp-world__sky')!,
    done: el.querySelector<SVGRectElement>('clipPath rect')!,
    marker: el.querySelector<SVGCircleElement>('.slp-world__marker')!,
    copy: el.querySelector<HTMLElement>('.slp-world__copy')!,
  }));
  const N = worlds.length;
  const share = (P1 - P0) / N;
  const readout = section.querySelector<HTMLElement>('[data-readout-value]');
  const readoutBox = section.querySelector<HTMLElement>('[data-readout]');
  const small = matchMedia('(max-width: 860px)');
  const opts = (): CameraOpts => (small.matches ? CAMERA_MOBILE : CAMERA_DESKTOP);
  const fmt = new Intl.NumberFormat(document.documentElement.lang || 'es-MX', { maximumFractionDigits: 0 });

  const emit = (x: number, region: string) =>
    dispatchEvent(new CustomEvent('slp:position', { detail: { x, region } }));

  /** Marker radius in world units for a ~6px dot at the current scale. */
  const markerR = (o: CameraOpts) => (6 * o.span) / Math.max(stage.clientWidth || innerWidth, 1);

  // ---- static compositions (reduced motion, engine failure) ---------------
  if (tier === 'static' || !section.hasAttribute('data-sc-act')) {
    const frameStatic = () => {
      const o = { ...opts(), mx: 0.5 };
      for (const w of worlds) {
        const aspect = w.el.clientWidth / Math.max(w.el.clientHeight, 1);
        const mid = (w.from + w.to) / 2;
        w.svg.setAttribute('viewBox', viewBoxAttr(camera(mid, aspect, o)));
        w.marker.setAttribute('r', markerR(o).toFixed(2));
      }
    };
    frameStatic();
    addEventListener('resize', frameStatic);
    // Stacked worlds each own the chrome over them.
    worlds.forEach((w) => (w.el.dataset.chrome = 'overlay'));
    dispatchEvent(new Event('slp:chrome-regions'));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const w = worlds.find((x) => x.el === e.target);
          if (w) emit((w.from + w.to) / 2, w.id);
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    worlds.forEach((w) => io.observe(w.el));
    return;
  }

  // ---- the journey --------------------------------------------------------
  const pOf = (k: number) => P0 + k * share;

  function travel(p: number): number {
    if (p <= P0) return 0;
    if (p >= P1) return 1;
    const k = Math.min(N - 1, Math.floor((p - P0) / share));
    const u = (p - pOf(k)) / share;
    const w = worlds[k];
    return w.from + (w.to - w.from) * linger(u);
  }

  let lastP = -1;
  let lastW = 0;
  let lastH = 0;

  function frame(): void {
    const p = parseFloat(section!.style.getPropertyValue('--sc-p') || '0');
    const W = stage.clientWidth, H = stage.clientHeight;
    if (p === lastP && W === lastW && H === lastH) return;
    lastP = p; lastW = W; lastH = H;

    const base = opts();
    const t = travel(p);
    // The marker sinks on screen as the land descends, so the drop is felt.
    const o = { ...base, my: base.my - 0.08 + 0.16 * t };
    const drop = smoothstep(P1, 0.97, p);
    const cam = camera(t, W / Math.max(H, 1), o);
    cam.y += drop * cam.h * 1.15;
    const vb = viewBoxAttr(cam);
    const X = t * WORLD.X;
    const Y = (1 - elevationAt(t)) * WORLD.YR;

    // Cut progress per world. World 0 is always fully present.
    const q = worlds.map((_, k) => (k === 0 ? 1 : smoothstep(pOf(k) - CUT, pOf(k) + CUT, p)));
    let active = 0;
    for (let k = 0; k < N; k++) if (q[k] >= 0.5) active = k;

    for (let k = 0; k < N; k++) {
      const w = worlds[k];
      const coveredBy = k < N - 1 && q[k + 1] >= 1;
      const live = q[k] > 0 && !coveredBy;
      w.el.style.setProperty('--q', q[k].toFixed(4));
      w.el.style.opacity = live ? '' : '0';
      if (!live) continue;
      w.svg.setAttribute('viewBox', vb);
      w.done.setAttribute('width', (X + 3000).toFixed(1));
      w.marker.setAttribute('cx', X.toFixed(2));
      w.marker.setAttribute('cy', Y.toFixed(2));
      w.marker.setAttribute('r', markerR(o).toFixed(2));
    }
    // The Huasteca copy gives way to the finale before the two can overlap.
    worlds[N - 1].copy.style.setProperty('--copy-o', (1 - smoothstep(P1, P1 + 0.05, p)).toFixed(3));

    section!.style.setProperty('--drop', smoothstep(0.83, 0.95, p).toFixed(4));
    section!.toggleAttribute('data-dropped', p > 0.9);

    // Header and Line take the ground that has actually reached them: an arch
    // or a rising waterline reaches the bottom edge first, a curtain the top.
    const reached = (edge: 'top' | 'bottom') => {
      let k = 0;
      for (let i = 1; i < N; i++) {
        const tr = worlds[i].el.dataset.transition;
        const early = (edge === 'top' && tr === 'curtain') || (edge === 'bottom' && (tr === 'waterline' || tr === 'arch'));
        if (q[i] >= (early ? 0.12 : tr === 'shadow' ? 0.5 : 0.94)) k = i;
      }
      return p > 0.9 ? 'dark' : worlds[k].ground;
    };
    section!.dataset.chromeGroundTop = reached('top');
    section!.dataset.chromeGroundBottom = reached('bottom');

    if (readoutBox) {
      const sx = ((X - cam.x) / cam.w) * W;
      const sy = ((Y - cam.y) / cam.h) * H;
      readoutBox.style.setProperty('--rx', `${Math.round(sx + 16)}px`);
      readoutBox.style.setProperty('--ry', `${Math.round(sy - 42)}px`);
      readoutBox.style.setProperty('--ro', (1 - smoothstep(P1 - 0.02, P1 + 0.03, p)).toFixed(3));
      readoutBox.dataset.ground = worlds[active].ground;
    }
    if (readout && altitudesEnabled) readout.textContent = `${fmt.format(metresAt(t))} m`;
    emit(t, worlds[active].id);
  }

  // Run only while the act is near the viewport.
  let running = false;
  function loop(): void {
    frame();
    if (running) requestAnimationFrame(loop);
  }
  new IntersectionObserver(
    ([entry]) => {
      const was = running;
      running = entry.isIntersecting;
      if (running && !was) requestAnimationFrame(loop);
      if (!running) frame();
    },
    { rootMargin: '100% 0px 100% 0px' },
  ).observe(section);
  frame();

  // ---- jumping to a region (the Line, the menu, deep links) ---------------
  function jumpTo(id: string, smooth = true): boolean {
    const k = worlds.findIndex((w) => w.id === id);
    if (k < 0) return false;
    const top = section!.getBoundingClientRect().top + scrollY;
    const travelPx = section!.offsetHeight - innerHeight;
    const p = pOf(k) + share * 0.5;
    scrollTo({ top: top + p * travelPx, behavior: smooth ? 'smooth' : 'auto' });
    return true;
  }

  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href*="#descenso-"]');
    if (!a || a.pathname !== location.pathname) return;
    const id = a.hash.replace('#descenso-', '');
    if (jumpTo(id)) {
      e.preventDefault();
      history.replaceState(null, '', a.hash);
    }
  });

  // Keyboard: focusing a link inside a world (or the finale) brings it on screen.
  const dropEl = section.querySelector<HTMLElement>('[data-drop]');
  section.addEventListener('focusin', (e) => {
    const target = e.target as Node;
    // Deferred a frame so it lands after the browser's own scroll-into-view.
    if (dropEl?.contains(target)) {
      requestAnimationFrame(() => {
        const top = section!.getBoundingClientRect().top + scrollY;
        scrollTo({ top: top + 0.95 * (section!.offsetHeight - innerHeight), behavior: 'auto' });
      });
      return;
    }
    const w = worlds.find((x) => x.el.contains(target));
    if (w && worlds[activeIndex()]?.id !== w.id) requestAnimationFrame(() => jumpTo(w.id, false));
  });
  const activeIndex = () => {
    const p = parseFloat(section!.style.getPropertyValue('--sc-p') || '0');
    return Math.max(0, Math.min(N - 1, Math.floor((p - P0) / share)));
  };

  if (location.hash.startsWith('#descenso-')) {
    const id = location.hash.replace('#descenso-', '');
    addEventListener('load', () => jumpTo(id, false), { once: true });
  }
}

function metresAt(x: number): number {
  const pts = profile.points;
  const n = pts.length - 1;
  const f = Math.min(Math.max(x, 0), 1) * n;
  const i = Math.min(Math.floor(f), n - 1);
  const a = pts[i][2] ?? 0, b = pts[i + 1][2] ?? 0;
  return a + (b - a) * (f - i);
}

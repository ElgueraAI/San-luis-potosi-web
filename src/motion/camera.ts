/**
 * The Descent camera. Pure functions, shared by the build (static compositions
 * for reduced motion and no-JS) and by the browser (the pinned journey).
 *
 * World units: x 0..1000 west to east, y = (1 - elevation) * YR, growing down.
 * The camera is an SVG viewBox that follows a marker along the line.
 */
import { elevationAt, WORLD, type ProfilePoint } from '@/data/geo';

export type CameraOpts = {
  /** Visible width of the window, in world units. */
  span: number;
  /** Marker's horizontal position on screen, 0..1. */
  mx: number;
  /** Preferred vertical position of the marker on screen, 0..1. */
  my: number;
  /** The highest visible land never rises above this fraction of the screen. */
  top: number;
  /** The marker never sinks below this fraction of the screen. */
  bottom: number;
};

export const CAMERA_DESKTOP: CameraOpts = { span: 330, mx: 0.3, my: 0.66, top: 0.56, bottom: 0.84 };
export const CAMERA_MOBILE: CameraOpts = { span: 170, mx: 0.24, my: 0.66, top: 0.58, bottom: 0.84 };

export type ViewBox = { x: number; y: number; w: number; h: number };

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Where the camera sits when the marker is at fraction t of the transect,
 * for a stage of the given aspect ratio (width / height).
 */
export function camera(t: number, aspect: number, o: CameraOpts, pts?: ProfilePoint[]): ViewBox {
  const w = o.span;
  const h = w / aspect;
  const X = t * WORLD.X;
  const Ym = (1 - elevationAt(t, pts)) * WORLD.YR;
  const x = X - o.mx * w;

  // The highest land anywhere in the window (smallest y).
  let ymin = Infinity;
  for (let i = 0; i <= 28; i++) {
    const xi = clamp01((x + (w * i) / 28) / WORLD.X);
    ymin = Math.min(ymin, (1 - elevationAt(xi, pts)) * WORLD.YR);
  }

  let y = Ym - o.my * h;
  y = Math.min(y, ymin - o.top * h);
  y = Math.max(y, Ym - o.bottom * h);
  return { x, y, w, h };
}

export function viewBoxAttr(v: ViewBox): string {
  return `${v.x.toFixed(2)} ${v.y.toFixed(2)} ${v.w.toFixed(2)} ${v.h.toFixed(2)}`;
}

/** Fast at the edges, slow in the middle: each region lingers at its centre. */
export function linger(u: number, k = 0.6): number {
  return u + (k * Math.sin(2 * Math.PI * u)) / (2 * Math.PI);
}

export function smoothstep(a: number, b: number, v: number): number {
  const x = clamp01((v - a) / (b - a));
  return x * x * (3 - 2 * x);
}

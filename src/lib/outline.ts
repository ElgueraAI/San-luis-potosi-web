/**
 * San Luis Potosí silhouette, traced from the INEGI CEM 3.0 raster by
 * scripts/geo/build-outline.mjs. Projected once here (equirectangular, scaled
 * by cos(latitude) at the state's centre) so the mask, the outline and the
 * place markers share one coordinate space.
 */
import outline from '@/data/generated/state-outline.json';

const [x0, y0, x1, y1] = outline.bbox as [number, number, number, number];
const K = Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
/** viewBox width; height follows the state's proportions */
export const OUTLINE_W = 1000;
const S = OUTLINE_W / ((x1 - x0) * K);
export const OUTLINE_H = Math.round((y1 - y0) * S);

export const project = (lon: number, lat: number): [number, number] => [
  +((lon - x0) * K * S).toFixed(1),
  +((y1 - lat) * S).toFixed(1),
];

export const OUTLINE_PATH =
  'M' + (outline.ring as [number, number][]).map(([lon, lat]) => project(lon, lat).join(' ')).join('L') + 'Z';

export const OUTLINE_SOURCE: string = outline.source;

/** The silhouette as a CSS mask (data URL), sized to the same viewBox. */
export const OUTLINE_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${OUTLINE_W} ${OUTLINE_H}' preserveAspectRatio='none'><path d='${OUTLINE_PATH}'/></svg>`,
)}")`;

/** Douglas–Peucker on the projected ring: a lighter outline for small marks. */
function simplify(pts: [number, number][], tol: number): [number, number][] {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  let max = 0, at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / len;
    if (d > max) { max = d; at = i; }
  }
  if (max <= tol) return [a, b];
  return [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)];
}

/**
 * The silhouette redrawn for a small mark: simplified in viewBox units
 * (tolerance `tol` of 1000) and scaled to width `w`. Same shape, fewer points.
 */
export function markPath(w: number, tol = 9): { d: string; h: number } {
  const ring = (outline.ring as [number, number][]).map(([lon, lat]) => project(lon, lat));
  const k = w / OUTLINE_W;
  const pts = simplify(ring, tol);
  return { d: 'M' + pts.map(([x, y]) => `${(x * k).toFixed(2)} ${(y * k).toFixed(2)}`).join('L') + 'Z', h: +(OUTLINE_H * k).toFixed(2) };
}

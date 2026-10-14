/**
 * Chart geometry, pure and unit-tested (tests/intel/charts.test.ts). The
 * dashboard draws its charts as SVG and HTML at build time; these functions
 * only turn numbers into positions. No DOM, no dependency.
 */
export interface Rect { x: number; y: number; w: number; h: number }
export interface TreeItem<T> { value: number; data: T }
export interface TreeCell<T> extends Rect { value: number; data: T }

/**
 * Squarified treemap (Bruls, Huizing and van Wijk, 2000). Areas are
 * proportional to `value`; items with a value of 0 or less are dropped.
 */
export function treemap<T>(items: TreeItem<T>[], box: Rect): TreeCell<T>[] {
  const list = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = list.reduce((s, i) => s + i.value, 0);
  if (!list.length || total <= 0 || box.w <= 0 || box.h <= 0) return [];
  const scale = (box.w * box.h) / total;
  const out: TreeCell<T>[] = [];
  let { x, y, w, h } = box;
  let row: TreeItem<T>[] = [];
  const area = (r: TreeItem<T>[]) => r.reduce((s, i) => s + i.value * scale, 0);
  const worst = (r: TreeItem<T>[], side: number) => {
    const s = area(r);
    const max = Math.max(...r.map((i) => i.value * scale)), min = Math.min(...r.map((i) => i.value * scale));
    return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
  };
  const flush = () => {
    const s = area(row);
    const horizontal = w >= h; // lay the row along the shorter side
    const thick = s / (horizontal ? h : w);
    let off = 0;
    for (const i of row) {
      const len = (i.value * scale) / thick;
      out.push(horizontal ? { x, y: y + off, w: thick, h: len, value: i.value, data: i.data } : { x: x + off, y, w: len, h: thick, value: i.value, data: i.data });
      off += len;
    }
    if (horizontal) { x += thick; w -= thick; } else { y += thick; h -= thick; }
    row = [];
  };
  for (const item of list) {
    const side = Math.min(w, h);
    if (row.length && worst([...row, item], side) > worst(row, side)) flush();
    row.push(item);
  }
  if (row.length) flush();
  return out;
}

/** Linear scale from a domain to a range (no clamping). */
export const linear = (d0: number, d1: number, r0: number, r1: number) => (v: number) => (d1 === d0 ? r0 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));

/** Round axis ticks covering 0…max: at most `count` steps of 1, 2 or 5 × 10ⁿ. */
export function ticks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0];
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  const out: number[] = [];
  for (let v = 0; v <= max + step * 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/** SVG path of a polyline through the points. */
export const linePath = (pts: [number, number][]) => pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');

/** Radius for a proportional symbol: area, not radius, follows the value. */
export const symbolRadius = (value: number, max: number, rMax: number, rMin = 0) => (max > 0 && value > 0 ? Math.max(rMin, Math.sqrt(value / max) * rMax) : 0);

/**
 * Tint (0–1) of a value on a single-hue sequential ramp with five equal
 * classes; 0 stays 0. The tints are spaced so that text keeps ≥ 4.4:1 on every
 * class: ink on the three lighter ones, inverted ink from RAMP_INVERT up.
 */
export const RAMP_TINTS = [0, 0.14, 0.3, 0.52, 0.76, 1] as const;
export const RAMP_INVERT = 0.6;
export function ramp(value: number, max: number): number {
  if (!(value > 0) || !(max > 0)) return 0;
  return RAMP_TINTS[Math.min(5, Math.ceil((value / max) * 5))];
}

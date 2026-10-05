// Generates the topographic contour texture used by every media placeholder.
// Deterministic (seeded), so re-running it produces the same file.
//
//   node scripts/media/make-contours.mjs
//
// Output: public/placeholders/contours.svg, a seamless-enough tile of contour
// lines drawn with marching squares over smooth value noise. Placeholders use it
// as a CSS mask, so its colour comes from the region tokens, never from the file.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(root, 'public/placeholders/contours.svg');

const W = 800, H = 500, CELL = 10;
const COLS = W / CELL, ROWS = H / CELL;

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// Smooth field: a handful of soft hills and valleys plus long ridges.
const bumps = Array.from({ length: 14 }, () => ({
  x: rand() * W, y: rand() * H,
  r: 90 + rand() * 220, a: (rand() - 0.4) * 1.6,
}));
function field(x, y) {
  let v = 0.18 * Math.sin(x / 140 + y / 260) + 0.12 * Math.cos(y / 90 - x / 410);
  for (const b of bumps) {
    const d2 = ((x - b.x) ** 2 + (y - b.y) ** 2) / (b.r * b.r);
    v += b.a * Math.exp(-d2);
  }
  return v;
}

const grid = [];
for (let j = 0; j <= ROWS; j++) {
  grid[j] = [];
  for (let i = 0; i <= COLS; i++) grid[j][i] = field(i * CELL, j * CELL);
}

const levels = [];
for (let l = -1.2; l <= 1.6; l += 0.1) levels.push(+l.toFixed(2));

const r1 = (n) => Math.round(n * 10) / 10;
const parts = [];
for (const lv of levels) {
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const a = grid[j][i], b = grid[j][i + 1], c = grid[j + 1][i + 1], d = grid[j + 1][i];
      const idx = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (c > lv ? 2 : 0) | (d > lv ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const x = i * CELL, y = j * CELL;
      const t = (p, q) => (lv - p) / (q - p);
      const top = [x + CELL * t(a, b), y];
      const right = [x + CELL, y + CELL * t(b, c)];
      const bottom = [x + CELL * t(d, c), y + CELL];
      const left = [x, y + CELL * t(a, d)];
      const seg = {
        1: [left, bottom], 2: [bottom, right], 3: [left, right], 4: [top, right],
        5: [left, top, bottom, right], 6: [top, bottom], 7: [left, top],
        8: [left, top], 9: [top, bottom], 10: [left, bottom, top, right], 11: [top, right],
        12: [left, right], 13: [bottom, right], 14: [left, bottom],
      }[idx];
      for (let s = 0; s < seg.length; s += 2) {
        parts.push(`M${r1(seg[s][0])} ${r1(seg[s][1])}L${r1(seg[s + 1][0])} ${r1(seg[s + 1][1])}`);
      }
    }
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"><path d="${parts.join('')}" fill="none" stroke="#000" stroke-width="1" stroke-linecap="round"/></svg>\n`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, svg);
console.log(`contours.svg: ${parts.length} segments, ${(svg.length / 1024).toFixed(1)} KB`);

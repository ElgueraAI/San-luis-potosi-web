// State silhouette for San Luis Potosí, traced from the INEGI CEM 3.0 raster
// already in the research layer (research/raw/inegi, state 24). The raster is
// masked to the state: every cell outside it is NODATA, so the data/no-data
// edge is the state outline at the raster's resolution. Not a legal boundary.
//   node scripts/geo/build-outline.mjs
// Writes src/data/generated/state-outline.json: one simplified ring in lon/lat
// (largest polygon only; small islands of data along the edge are dropped).
import fs from 'node:fs';
import path from 'node:path';
import { unzipSync } from 'fflate';

const ZIP = path.resolve('research/raw/inegi/CEM_V3_20170619_R90_E24.zip');
const OUT = path.resolve('src/data/generated/state-outline.json');
const STEP = 6; // sample every 6th cell, about 550 m
const TOL = 0.006; // Douglas-Peucker tolerance in degrees, about 650 m

const files = unzipSync(fs.readFileSync(ZIP), { filter: (f) => /\.(hdr|bil)$/.test(f.name) });
const hdr = Object.fromEntries(
  new TextDecoder().decode(files['SanLuisPotosi15_r90m.hdr']).split(/\r?\n/).filter(Boolean).map((l) => l.trim().split(/\s+/)),
);
const NR = +hdr.NROWS, NC = +hdr.NCOLS, X0 = +hdr.ULXMAP, Y0 = +hdr.ULYMAP, DX = +hdr.XDIM, ND = +hdr.NODATA;
const bil = files['SanLuisPotosi15_r90m.bil'];
const view = new DataView(bil.buffer, bil.byteOffset, bil.byteLength);
const inside = (r, c) => view.getInt16((r * NC + c) * 2, true) !== ND;

// Downsampled mask with a one-cell empty border so every contour closes.
const R = Math.ceil(NR / STEP) + 2, C = Math.ceil(NC / STEP) + 2;
const mask = new Uint8Array(R * C);
for (let r = 0; r < R - 2; r++)
  for (let c = 0; c < C - 2; c++) {
    const rr = Math.min(NR - 1, r * STEP), cc = Math.min(NC - 1, c * STEP);
    mask[(r + 1) * C + (c + 1)] = inside(rr, cc) ? 1 : 0;
  }
const m = (r, c) => (r >= 0 && r < R && c >= 0 && c < C ? mask[r * C + c] : 0);

// Boundary edges between inside and outside cells, oriented so inside is on the
// left; chained into closed rings on the cell-corner lattice.
const next = new Map();
const key = (x, y) => x * 100000 + y;
const edge = (x1, y1, x2, y2) => {
  const k = key(x1, y1);
  if (!next.has(k)) next.set(k, []);
  next.get(k).push([x2, y2]);
};
for (let r = 0; r < R; r++)
  for (let c = 0; c < C; c++) {
    if (!m(r, c)) continue;
    if (!m(r - 1, c)) edge(c + 1, r, c, r); // top
    if (!m(r + 1, c)) edge(c, r + 1, c + 1, r + 1); // bottom
    if (!m(r, c - 1)) edge(c, r, c, r + 1); // left
    if (!m(r, c + 1)) edge(c + 1, r + 1, c + 1, r); // right
  }
// A vertex can have two outgoing edges where cells touch only diagonally;
// each is consumed once, so every ring still closes.
const rings = [];
for (const k0 of next.keys()) {
  while (next.get(k0).length) {
    const ring = [];
    let cur = k0;
    for (;;) {
      const outs = next.get(cur);
      if (!outs?.length) break;
      const [x, y] = outs.pop();
      ring.push([x, y]);
      cur = key(x, y);
      if (cur === k0) break;
    }
    if (ring.length > 3) rings.push(ring);
  }
}
const area = (ring) => Math.abs(ring.reduce((a, [x, y], i) => { const [x2, y2] = ring[(i + 1) % ring.length]; return a + x * y2 - x2 * y; }, 0) / 2);
rings.sort((a, b) => area(b) - area(a));
const main = rings[0];

const toLL = ([x, y]) => [X0 + ((x - 1) * STEP - 0.5) * DX, Y0 - ((y - 1) * STEP - 0.5) * DX];
function dp(pts, tol) {
  if (pts.length < 3) return pts;
  let max = 0, idx = 0;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const len = Math.hypot(bx - ax, by - ay) || 1e-12;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len;
    if (d > max) { max = d; idx = i; }
  }
  return max > tol ? [...dp(pts.slice(0, idx + 1), tol).slice(0, -1), ...dp(pts.slice(idx), tol)] : [pts[0], pts[pts.length - 1]];
}
const ll = main.map(toLL);
// split the closed ring at its far point so DP keeps the shape
let far = 0;
ll.forEach((p, i) => { if (Math.hypot(p[0] - ll[0][0], p[1] - ll[0][1]) > Math.hypot(ll[far][0] - ll[0][0], ll[far][1] - ll[0][1])) far = i; });
const simple = [...dp(ll.slice(0, far + 1), TOL).slice(0, -1), ...dp([...ll.slice(far), ll[0]], TOL).slice(0, -1)]
  .map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]);
const lons = simple.map((p) => p[0]), lats = simple.map((p) => p[1]);

fs.writeFileSync(OUT, JSON.stringify({
  source: 'INEGI · Continuo de Elevaciones Mexicano 3.0, San Luis Potosí (90 m). Contorno del área con datos del ráster; aproximado, no es un límite oficial.',
  method: `mask edge every ${STEP} cells, Douglas-Peucker ${TOL}°, largest ring`,
  bbox: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
  ring: simple,
}));
console.log(`rings=${rings.length} main=${main.length} pts -> ${simple.length} pts; bbox`, Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats));

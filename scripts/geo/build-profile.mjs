// Builds the MEASURED elevation profile from an approved INEGI elevation transect.
//
//   npm run geo:profile -- --input data-source/transecto.csv \
//     --source inegi-cem --boundaries data-source/limites.json [--verified 2026-11-02]
//
// Input CSV (exported from QGIS "Profile Tool" or INEGI's elevation viewer over
// the Continuo de Elevaciones Mexicano), header row required:
//   distance_m,elevation_m
// Boundaries JSON: where each region begins along the same transect, in metres,
// taken from the official municipality-to-region assignment:
//   [{ "region": "altiplano", "from_m": 0, "to_m": 81000 }, ...]
//
// Output: src/data/geo/profile.measured.json. Status stays "pending" unless
// --verified <ISO date> is passed AND --source names an entry in
// src/content/sources.yaml. Raw inputs live in data-source/ (git-ignored).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1]]);
    return acc;
  }, []),
);

function fail(msg) {
  console.error(`geo:profile: ${msg}`);
  process.exit(1);
}

if (!args.input) fail('missing --input <csv>');
if (!args.boundaries) fail('missing --boundaries <json>');
if (!args.source) fail('missing --source <id from src/content/sources.yaml>');

const sources = readFileSync(resolve(root, 'src/content/sources.yaml'), 'utf8');
if (!new RegExp(`^- id: ${args.source}\\s*$`, 'm').test(sources)) {
  fail(`source "${args.source}" is not registered in src/content/sources.yaml`);
}

const rows = readFileSync(resolve(root, args.input), 'utf8').trim().split(/\r?\n/);
const header = rows.shift().split(',').map((h) => h.trim());
const di = header.indexOf('distance_m'), ei = header.indexOf('elevation_m');
if (di < 0 || ei < 0) fail('CSV needs distance_m and elevation_m columns');

const raw = rows
  .map((r) => r.split(','))
  .map((c) => [parseFloat(c[di]), parseFloat(c[ei])])
  .filter(([d, e]) => Number.isFinite(d) && Number.isFinite(e))
  .sort((a, b) => a[0] - b[0]);
if (raw.length < 20) fail('transect has fewer than 20 valid samples');

const total = raw[raw.length - 1][0] - raw[0][0];
const d0 = raw[0][0];
const emin = Math.min(...raw.map((r) => r[1]));
const emax = Math.max(...raw.map((r) => r[1]));

// Resample to 320 evenly spaced points so the page geometry matches the schematic.
const N = 320;
const points = [];
for (let i = 0, k = 0; i <= N; i++) {
  const d = d0 + (total * i) / N;
  while (k < raw.length - 2 && raw[k + 1][0] < d) k++;
  const [da, ea] = raw[k], [db, eb] = raw[k + 1];
  const e = ea + ((eb - ea) * (d - da)) / Math.max(db - da, 1e-9);
  points.push([+(i / N).toFixed(4), +((e - emin) / (emax - emin)).toFixed(4), Math.round(e)]);
}

const verified = typeof args.verified === 'string';
const status = verified ? 'verified' : 'pending';
const bounds = JSON.parse(readFileSync(resolve(root, args.boundaries), 'utf8')).map((b) => ({
  region: b.region,
  from: +((b.from_m - d0) / total).toFixed(4),
  to: +((b.to_m - d0) / total).toFixed(4),
  status,
}));

const profile = {
  kind: 'measured',
  status,
  source: args.source,
  verifiedAt: verified ? args.verified : null,
  note: `Resampled from ${raw.length} samples over ${(total / 1000).toFixed(1)} km.`,
  units: { x: 'fraction of transect, west to east', y: 'normalized elevation, 1 = highest', m: 'metres above sea level' },
  elevationRange: { value: [Math.round(emin), Math.round(emax)], status, source: args.source, verifiedAt: verified ? args.verified : undefined },
  boundaries: bounds,
  points,
};

writeFileSync(resolve(root, 'src/data/geo/profile.measured.json'), JSON.stringify(profile) + '\n');
console.log(`profile.measured.json written (${status}). Switch src/data/geo/index.ts to it once verified.`);

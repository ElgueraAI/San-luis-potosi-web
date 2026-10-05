// Writes the SCHEMATIC west-to-east elevation profile used until official INEGI
// data is verified.
//
//   node scripts/geo/schematic-profile.mjs
//
// The shape is illustrative only: it encodes the approved narrative order
// (Altiplano, Centro, Zona Media, Huasteca, high to low) and nothing else. It
// carries no metres, no place names and no real boundary positions, and its
// status is "pending" so the Fact gate never lets it read as data.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(root, 'src/data/geo/profile.schematic.json');

const boundaries = [
  { region: 'altiplano', from: 0, to: 0.3 },
  { region: 'centro', from: 0.3, to: 0.52 },
  { region: 'zona-media', from: 0.52, to: 0.72 },
  { region: 'huasteca', from: 0.72, to: 1 },
];
const levels = [0.8, 0.64, 0.4, 0.08];

const sig = (x, at, w) => 1 / (1 + Math.exp(-(x - at) / w));
const bump = (x, at, h, w) => h * Math.exp(-(((x - at) / w) ** 2));

function elev(x) {
  let v = levels[0];
  v += (levels[1] - levels[0]) * sig(x, 0.3, 0.012);
  v += (levels[2] - levels[1]) * sig(x, 0.535, 0.012);
  v += (levels[3] - levels[2]) * sig(x, 0.735, 0.014);
  v += bump(x, 0.1, 0.13, 0.03) + bump(x, 0.19, 0.05, 0.02) + bump(x, 0.255, 0.035, 0.012);
  v += bump(x, 0.4, 0.04, 0.03) + bump(x, 0.49, 0.15, 0.022);
  v += bump(x, 0.6, 0.05, 0.025) + bump(x, 0.7, 0.2, 0.022);
  v += bump(x, 0.81, 0.07, 0.02) + bump(x, 0.885, 0.045, 0.018) + bump(x, 0.95, 0.02, 0.02);
  v += 0.012 * Math.sin(x * 97) + 0.008 * Math.sin(x * 211 + 1.3) + 0.005 * Math.sin(x * 431);
  return Math.min(1, Math.max(0, v));
}

const N = 320;
const points = Array.from({ length: N + 1 }, (_, i) => {
  const x = i / N;
  return [+x.toFixed(4), +elev(x).toFixed(4)];
});

const profile = {
  kind: 'schematic',
  status: 'pending',
  source: null,
  verifiedAt: null,
  note: 'Illustrative shape only. Replace with `npm run geo:profile` from an approved INEGI elevation transect.',
  units: { x: 'fraction of transect, west to east', y: 'normalized elevation, 1 = highest' },
  elevationRange: { value: null, status: 'pending', note: 'Metres unknown until INEGI data is verified.' },
  boundaries: boundaries.map((b) => ({ ...b, status: 'pending' })),
  points,
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(profile) + '\n');
console.log(`profile.schematic.json: ${points.length} points`);

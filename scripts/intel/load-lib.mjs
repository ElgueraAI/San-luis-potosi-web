// Bundles src/lib/intel (TypeScript, pure) with esbuild and imports it, so
// node scripts use the very code the site ships. esbuild comes with Astro/Vite.
import { build } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const R = (...p) => path.join(root, ...p);
export const J = (p) => JSON.parse(fs.readFileSync(R(p), 'utf8'));
export const E = (c) => J(`research/entities/${c}/index.json`).records;

export async function loadIntel(entry = 'src/lib/intel/index.ts') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slp-intel-'));
  const outfile = path.join(dir, 'intel.mjs');
  await build({ entryPoints: [R(entry)], bundle: true, platform: 'node', format: 'esm', target: 'node20', outfile, logLevel: 'warning', define: { 'import.meta.env': '{}', __ORS_DEV_PROXY__: 'false' } });
  const mod = await import(pathToFileURL(outfile).href);
  fs.rmSync(dir, { recursive: true, force: true });
  return mod;
}

/** Raw sets exactly as the site adapter (src/data/intel.ts) passes them. */
export function rawSets() {
  const seasonal = J('research/generated/seasonal-calendar.json').records;
  const add = J('research/generated/seasonal-additions-pass4.json').records;
  return {
    attractions: E('attractions'), archaeology: E('archaeology'), museums: E('museums'), venues: E('cultural-venues'), recreation: E('recreation'),
    events: E('events'), municipalities: E('municipalities'), seasonRecords: [...seasonal, ...add], priorities: J('research/destinations/index.json').destinations,
  };
}

// Bundles tests/geo/*.test.ts with esbuild (already installed through Astro/Vite)
// and runs them with node:test. No extra test framework.
//   npm run test:geo
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'tests/geo');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'slp-geo-test-'));
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.ts'));
const outputs = [];
for (const f of files) {
  const outfile = path.join(out, f.replace(/\.ts$/, '.mjs'));
  await build({
    entryPoints: [path.join(dir, f)],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    outfile,
    logLevel: 'warning',
    // the browser modules read Vite env; tests run with the defaults (no proxy configured)
    define: { 'import.meta.env': '{}', __ORS_DEV_PROXY__: 'false' },
  });
  outputs.push(outfile);
}
const r = spawnSync(process.execPath, ['--test', ...outputs], { stdio: 'inherit' });
fs.rmSync(out, { recursive: true, force: true });
process.exit(r.status ?? 1);

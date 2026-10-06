// Copies MapLibre's web-worker files into public/vendor/maplibre/.
// MapLibre v6 runs its worker as a separate ES module that imports a sibling
// chunk (maplibre-gl-shared.mjs); both must be served side by side, so they
// are copied verbatim from the installed package on every build.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules/maplibre-gl/dist');
const out = path.join(root, 'public/vendor/maplibre');
fs.mkdirSync(out, { recursive: true });
for (const f of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) fs.copyFileSync(path.join(src, f), path.join(out, f));
const v = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/maplibre-gl/package.json'), 'utf8')).version;
fs.writeFileSync(path.join(out, 'VERSION'), `maplibre-gl ${v} (BSD-3-Clause). Copied by scripts/vendor-maplibre.mjs.\n`);
console.log(`maplibre worker files ${v} → public/vendor/maplibre/`);

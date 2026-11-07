// Offline checks of the existing GitHub Pages build; no browser/network.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const munis = JSON.parse(read('research/entities/municipalities/index.json')).records;
const intel = JSON.parse(read('dist/data/intel.json'));
assert.equal(intel.municipalities.length, 58);
assert.equal(new Set(intel.municipalities.map((m) => m.id)).size, 58);
assert.ok(intel.municipalities.every((m) => /^24\d{3}$/.test(m.id) && m.id !== '24000'));
for (const municipality of munis) {
  assert.ok(fs.existsSync(path.join(root, 'dist/municipios', municipality.slug, 'index.html')), municipality.slug);
}
const pozos = read('dist/municipios/villa-de-pozos/index.html');
assert.ok(pozos.includes('/san-luis-potosi-web/'), 'build must use the tested Pages base path');
const content = pozos.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1];
assert.ok(content, 'municipal main content must exist');
assert.ok(!content.includes('/arqueologia/tanute/'), 'unlocated archaeology cannot be assigned to Pozos');
for (const id of ['A03', 'A15', 'H02', 'H18']) {
  assert.ok(!content.includes(`data-route-add="${id}"`), `no null-joined route stop ${id}`);
}
for (const route of ['mi-ruta', 'mapa', 'inteligencia-turistica', 'rutas']) {
  assert.ok(fs.existsSync(path.join(root, 'dist', route, 'index.html')), route);
}
const countPages = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((sum, item) =>
  sum + (item.isDirectory() ? countPages(path.join(dir, item.name)) : Number(item.name.endsWith('.html'))), 0);
const report = {
  evidence_class: '[DERIVADO]', date: '2026-11-07',
  scope: 'Offline assertions against the existing local Pages build; not visual browser QA or deployment.',
  base_path: '/san-luis-potosi-web/', html_pages: countPages(path.join(root, 'dist')),
  municipal_pages_preserved: munis.length, analytic_municipalities: intel.municipalities.length,
  published_place_candidates: intel.places.length, published_event_pages_in_intel: intel.events.length,
  null_joined_pozos_archaeology_link: false, route_pages_present: true,
};
fs.writeFileSync(path.join(root, 'docs/academic/uca-01-almacenamiento/mision-03-build-verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));

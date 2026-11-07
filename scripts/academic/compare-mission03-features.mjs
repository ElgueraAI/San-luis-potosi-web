// Offline comparison against the immutable pre-mission checkpoint. No build or network.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const baseline = '00d2ca39aeecf7feba863838c509bb15a6b80dba';
const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const original = git(['show', `${baseline}:src/lib/intel/features.ts`]);
const bundle = async (contents, resolveDir) => {
  const result = await build({ stdin: { contents, resolveDir, loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'esm', define: { 'import.meta.env': '{}' } });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
};
const legacy = await bundle(original, path.join(root, 'src/lib/intel'));
const current = await bundle("export {buildDataset} from './src/lib/intel/dataset.ts';", root);
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const records = (name) => read(`research/entities/${name}/index.json`).records;
const raw = {
  attractions: records('attractions'), archaeology: records('archaeology'), museums: records('museums'),
  venues: records('cultural-venues'), recreation: records('recreation'), events: records('events'),
  municipalities: records('municipalities'), seasonRecords: read('research/generated/seasonal-calendar.json').records,
  priorities: read('research/destinations/index.json').destinations,
};
const dataset = current.buildDataset(raw);
const originalMunicipalities = JSON.parse(git(['show', `${baseline}:research/entities/municipalities/index.json`])).records;
const before = legacy.municipalityFeatures(originalMunicipalities, dataset.places);
const after = dataset.municipalities;
const eligibleBefore = before.filter((row) => /^24\d{3}$/.test(row.id));
const stable = (rows) => JSON.stringify([...rows].sort((a, b) => a.id.localeCompare(b.id)));
const sha = (text) => createHash('sha256').update(text).digest('hex');
const differences = eligibleBefore.filter((row) => JSON.stringify(row) !== JSON.stringify(after.find((next) => next.id === row.id)));
const report = {
  evidence_class: '[DERIVADO]', date: '2026-11-07', baseline_commit: baseline, legacy_features_sha256: sha(original),
  scope: 'Features municipales con idénticas fichas normalizadas; snapshots municipales original checkpoint y corregido local. Orden por id; igualdad de todos los campos.',
  before_rows: before.length, after_rows: after.length, comparable_keys: eligibleBefore.length,
  unchanged_comparable_keys: eligibleBefore.length - differences.length,
  baseline_comparable_sha256: sha(stable(eligibleBefore)), new_comparable_sha256: sha(stable(after)),
  differences, excluded_before: before.filter((row) => !/^24\d{3}$/.test(row.id)),
  limits: ['No certifica vigencia de catálogo contemporáneo, afluencia ni capacidad de carga.', 'La comparación mantiene idénticas fichas de lugares; no compara medidas de audiencia.'],
};
fs.writeFileSync(path.join(root, 'docs/academic/uca-01-almacenamiento/mision-03-regresion-municipal.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ before: before.length, after: after.length, comparable: eligibleBefore.length, differences: differences.length, sha_before: report.baseline_comparable_sha256, sha_after: report.new_comparable_sha256 }));
if (differences.length) process.exitCode = 1;

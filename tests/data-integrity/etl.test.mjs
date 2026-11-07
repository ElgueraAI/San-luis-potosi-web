import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildMission03, canonicalText, rawManifest } from '../../scripts/academic/etl-mission03.mjs';
import { coordinateIssues, isValidMunicipalityId } from '../../research/scripts/entities/integrity.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('canonical text is identical for LF, CRLF and BOM without changing JSON values', () => {
  const lf = '{"nombre":"San Luis Potosí"}\n';
  const windows = '\uFEFF' + lf.replaceAll('\n', '\r\n');
  assert.deepEqual(canonicalText(Buffer.from(windows)), Buffer.from(lf));
  assert.deepEqual(canonicalText(canonicalText(Buffer.from(windows))), Buffer.from(lf));
  assert.deepEqual(JSON.parse(canonicalText(Buffer.from(windows))), JSON.parse(lf));
});

test('real ETL: deterministic files, raw conservation, referential integrity and municipal regression', () => {
  const taskTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'slp-m03-qa-'));
  try {
    const rawBefore = rawManifest(root);
    const firstDir = path.join(taskTemp, 'first');
    const secondDir = path.join(taskTemp, 'second');
    const first = buildMission03({ root, outputDir: firstDir });
    const second = buildMission03({ root, outputDir: secondDir });
    const rawAfter = rawManifest(root);
    assert.deepEqual(rawAfter, rawBefore, 'every raw file hash and byte count is preserved');
    assert.deepEqual(first.manifest, second.manifest, 'run manifest and run_id do not depend on clock or output path');
    const outputFiles = fs.readdirSync(firstDir).sort();
    assert.deepEqual(outputFiles, fs.readdirSync(secondDir).sort());
    for (const file of outputFiles) {
      const a = fs.readFileSync(path.join(firstDir, file));
      assert.deepEqual(fs.readFileSync(path.join(secondDir, file)), a, file);
      assert.deepEqual(fs.readFileSync(path.join(root, 'research/curated/mission03', file)), a, `checked-in candidate output ${file} reproduces byte-for-byte`);
      const declared = first.manifest.outputs.find((output) => output.path === file);
      if (declared) {
        assert.equal(declared.bytes, a.length, file);
        assert.equal(declared.sha256, sha256(a), file);
      }
    }
    const { report, products } = first;
    const contract = read('docs/academic/uca-01-almacenamiento/contracts/campaign-data-v1.0.0.json');
    assert.equal(contract.contract_id, report.contract_version);
    for (const [file, rules] of Object.entries(contract.products)) {
      assert.ok(Object.hasOwn(products, file), `contract product exists: ${file}`);
      const product = products[file];
      if (!Array.isArray(product)) continue;
      const primaryKeys = new Set();
      for (const row of product) {
        for (const field of rules.required ?? []) assert.ok(Object.hasOwn(row, field), `${file}: mandatory field ${field}`);
        if (rules.primary_key) {
          const key = JSON.stringify(rules.primary_key.map((field) => row[field]));
          assert.ok(rules.primary_key.every((field) => row[field] != null), `${file}: non-null primary key`);
          assert.equal(primaryKeys.has(key), false, `${file}: primary key uniqueness ${key}`);
          primaryKeys.add(key);
        }
      }
    }
    assert.equal(report.input_rows, 4961, 'local Mission 02 inventory baseline');
    assert.equal(report.input_rows, report.accepted_rows + report.quarantined_rows);
    assert.equal(report.accepted_rows, 4805);
    assert.equal(report.quarantined_rows, 156);
    assert.equal(report.accepted_fk_integrity, true);
    assert.deepEqual(report.municipal_aggregation_mismatches, []);
    assert.equal(report.raw_unchanged, true);
    const accepted = products['entity-snapshot.json'];
    const quarantined = products['quarantine.json'];
    const municipalities = new Set(products['municipality-versions.json'].map((row) => row.municipality_version_id));
    const sources = new Set(products['source-snapshots.json'].map((row) => row.source_snapshot_id));
    const ids = new Set(accepted.map((row) => row.entity_id));
    assert.equal(ids.size, accepted.length, 'accepted primary keys are globally unique');
    const stagingRefs = [
      ...accepted.map((row) => `${row.lineage.input_path}#${row.lineage.input_row}`),
      ...quarantined.map((row) => row.staging_row_id),
    ];
    assert.equal(new Set(stagingRefs).size, report.input_rows, 'partition has neither overlapping nor missing input locators');
    for (const row of accepted) {
      assert.ok(isValidMunicipalityId(row.municipality_id), row.entity_id);
      assert.ok(municipalities.has(row.municipality_version_id), row.entity_id);
      assert.deepEqual(coordinateIssues(row.latitude, row.longitude), [], row.entity_id);
      assert.ok(row.source_snapshot_refs.length > 0, row.entity_id);
      assert.ok(row.source_snapshot_refs.every((source) => sources.has(source)), row.entity_id);
      assert.ok(row.related_entity_ids_eligible.every((id) => ids.has(id)), row.entity_id);
      assert.equal(row.eligibility.publication, false);
      assert.equal(row.eligibility.temporal_territorial_comparison, false);
    }
    assert.equal(quarantined.filter((row) => row.municipality_id_as_declared === '24059').length, 132, 'unverified new key is preserved and quarantined, not reassigned');
    const eligibleAggregates = products['eligible-municipal-aggregates.json'];
    assert.equal(eligibleAggregates.length, 58);
    assert.equal(eligibleAggregates.reduce((sum, row) => sum + row.accepted_member_rows, 0), accepted.length - 58, 'municipal dimension rows are excluded from inventory denominator');
    for (const aggregate of eligibleAggregates) {
      const members = accepted.filter((row) => row.dataset !== 'municipalities' && row.municipality_id === aggregate.municipality_id);
      assert.equal(aggregate.accepted_member_rows, members.length, aggregate.municipality_id);
      assert.ok(aggregate.accepted_member_rows <= aggregate.declared_member_rows);
      assert.equal(aggregate.counts.destinations, members.filter((row) => row.entity_type === 'destination').length);
      assert.equal(aggregate.counts.lodging, members.filter((row) => row.entity_type === 'lodging').length);
      assert.equal(aggregate.counts.food, members.filter((row) => ['food', 'cafe', 'drink'].includes(row.entity_type)).length);
      assert.ok(aggregate.related_entities.every((id) => ids.has(id)), aggregate.municipality_id);
    }
    assert.equal(report.eligible_aggregate_changes.length, 6);
    assert.equal(eligibleAggregates.find((row) => row.municipality_id === '24028').counts.destinations, 6, 'four capital destinations without required evidence are withheld from eligible inventory');
    const before = read('research/curated/mission03/municipalities-before.json').records;
    const current = read('research/entities/municipalities/index.json').records;
    assert.equal(before.length, current.length, 'directory keeps all municipality placeholders');
    for (let index = 0; index < before.length; index++) {
      if (before[index].id !== null) assert.deepEqual(current[index], before[index], before[index].id);
    }
    const pozos = current.find((row) => row.canonical_name === 'Villa de Pozos');
    assert.equal(pozos.id, null);
    assert.equal(pozos.population_2020, null);
    assert.equal(pozos.latitude, null);
    assert.equal(pozos.region, null);
    assert.deepEqual(pozos.related_entities, []);
    assert.ok(Object.values(pozos.counts).every((value) => value === null));
    assert.deepEqual(report.municipal_changes.map((row) => row.name), ['Villa de Pozos']);
  } finally {
    const resolved = path.resolve(taskTemp);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.match(path.basename(resolved), /^slp-m03-qa-/);
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

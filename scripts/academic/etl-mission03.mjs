// Offline, deterministic curation from preserved local entity snapshots.
// Does not execute the historical raw builder, fetch data, or modify its inputs.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { aggregateMunicipalities, isValidMunicipalityId, validateRows } from '../../research/scripts/entities/integrity.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const encode = (data) => JSON.stringify(data, null, 2) + '\n';
const immutableEvidence = new Set(['baseline-audit.json', 'municipalities-before.json', 'raw-manifest-before.json'].map((name) => `research/curated/mission03/${name}`));
// Hash a declared canonical representation without rewriting original inputs.
export const canonicalText = (bytes) => Buffer.from(bytes.toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'), 'utf8');
const representedInput = (name, original) => {
  const immutable = immutableEvidence.has(name);
  const bytes = immutable ? original : canonicalText(original);
  return { bytes, metadata: { path: name, bytes: bytes.length, sha256: hash(bytes), representation: immutable ? 'original_bytes_immutable' : 'utf8_lf_no_bom' } };
};
const sortedFiles = (directory) => fs.existsSync(directory) ? fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en')).flatMap((entry) => entry.isDirectory() ? sortedFiles(path.join(directory, entry.name)) : [path.join(directory, entry.name)]) : [];

export function rawManifest(root = repository) {
  return sortedFiles(path.join(root, 'research/raw')).map((file) => {
    const bytes = fs.readFileSync(file);
    return { path: path.relative(root, file).replaceAll('\\', '/'), bytes: bytes.length, sha256: hash(bytes) };
  });
}

export function buildMission03({ root = repository, outputDir = path.join(root, 'research/curated/mission03'), write = true } = {}) {
  const inputs = [];
  const read = (name) => {
    const { bytes, metadata } = representedInput(name, fs.readFileSync(path.join(root, name)));
    inputs.push(metadata);
    return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  };
  const contract = read('docs/academic/uca-01-almacenamiento/contracts/campaign-data-v1.0.0.json');
  if (contract.contract_id !== 'campaign-data-v1.0.0' || contract.transform !== 'scripts/academic/etl-mission03.mjs' || contract.validator !== 'research/scripts/entities/integrity.mjs') throw new Error('Contract ID or implementation binding mismatch');
  const registryPaths = ['research/source-registry/sources.json', 'research/source-registry/sources-pass5.json', 'research/source-registry/sources-pass6.json', 'research/generated/seasonal-additions-pass4.json'];
  const sourceSnapshots = registryPaths.flatMap((registry) => (read(registry).sources ?? []).map((source, row) => {
    const input = inputs.find((item) => item.path === registry);
    return {
      source_snapshot_id: `${source.source_id}@${input.sha256}:${row}`,
      source_id: source.source_id, registry_path: registry, registry_row: row, snapshot_sha256: input.sha256,
      title: source.title ?? null, institution: source.institution ?? null, url: source.url ?? null,
      retrieved_at: source.retrieval_date ?? source.read ?? null, observation_period: null,
      licence_id: source.licence ?? source.license ?? null, licence_url: null, rights_review_status: 'pending_resource_review',
      attribution: source.institution ?? null, notes_as_declared: source.notes ?? null,
      evidence_class: '[OBSERVADO]', publication_eligible: false,
    };
  }));
  const catalogPath = 'research/generated/municipality-region-map.json';
  const catalog = read(catalogPath);
  const catalogInput = inputs.find((item) => item.path === catalogPath);
  const municipalityIds = new Set(catalog.municipalities.map((municipality) => municipality.inegi_cve).filter(isValidMunicipalityId));
  const sourceIds = new Set(sourceSnapshots.map((source) => source.source_id));
  const sets = fs.readdirSync(path.join(root, 'research/entities'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const staged = sets.flatMap((dataset) => {
    const inputPath = `research/entities/${dataset}/index.json`;
    const data = read(inputPath);
    if (dataset === 'routes') return [];
    const input = inputs.find((item) => item.path === inputPath);
    return data.records.map((record, row) => ({ ...record, dataset, lineage: { input_path: inputPath, input_sha256: input.sha256, input_row: row, generated_as_declared: data.generated ?? null, transformation_id: 'mission03-curation-v1.0.0' } }));
  });
  const checks = validateRows(staged, municipalityIds, sourceIds);
  const quarantinedIndexes = new Set(checks.filter((check) => check.reasons.length).map((check) => check.index));
  const quarantine = checks.filter((check) => check.reasons.length).map(({ index, reasons }) => ({
    staging_row_id: `${staged[index].lineage.input_path}#${staged[index].lineage.input_row}`,
    entity_id: staged[index].id, municipality_id_as_declared: staged[index].municipality_id,
    reasons, resolution_status: 'pending_evidence', lineage: staged[index].lineage,
  }));
  const accepted = staged.filter((_, index) => !quarantinedIndexes.has(index)).map((row) => ({
    entity_id: row.id, dataset: row.dataset, canonical_name: row.canonical_name, entity_type: row.entity_type,
    subcategory: row.subcategory ?? null, municipality_id: row.municipality_id,
    municipality_version_id: `${row.municipality_id}@legacy-map-${catalog.generated}`,
    region_as_declared: row.region ?? null, municipality_name_as_declared: row.municipality ?? null,
    latitude: row.latitude ?? null, longitude: row.longitude ?? null,
    coordinate_status_as_declared: row.coordinate_status ?? 'unknown',
    coordinate_verification: row.latitude == null ? 'unavailable' : 'numeric_bbox_only_no_polygon_or_access_validation',
    source_ids: row.source_ids,
    source_snapshot_refs: sourceSnapshots.filter((source) => row.source_ids.includes(source.source_id)).map((source) => source.source_snapshot_id),
    related_entity_ids_as_declared: row.related_entities ?? [],
    related_entity_ids_eligible: (row.related_entities ?? []).filter((id) => staged.some((candidate, index) => candidate.id === id && !quarantinedIndexes.has(index))),
    related_entity_ids_withheld: (row.related_entities ?? []).filter((id) => staged.some((candidate, index) => candidate.id === id && quarantinedIndexes.has(index))),
    activities_as_declared: row.activities ?? [], tags_as_declared: row.tags ?? [],
    last_verified_as_declared: row.last_verified ?? null,
    observation_period: null, territory_basis: 'legacy_catalog_key_match_only_not_boundary_harmonized',
    measures_as_declared: {
      population_2020: row.population_2020 ?? null, counts: row.counts ?? null,
      months: row.months ?? null, start_date: row.start_date ?? null, end_date: row.end_date ?? null,
      date_status: row.date_status ?? null, denue_activity: row.denue?.scian ?? null,
    },
    measure_evidence: { counts: '[DERIVADO]', population_2020: '[OBSERVADO]', months: 'source_declaration_not_current_edition_confirmation' },
    municipal_counts_scope: row.counts ? 'legacy_all_declared_inventory_for_regression_only_not_eligible_features' : null,
    eligibility: { inventory_analysis: true, municipal_key_grouping: true, temporal_territorial_comparison: false, map_numeric_point: row.latitude != null, publication: false, campaign_claim: false },
    limitations: ['No measured visitor demand or campaign response.', 'Licence and current operation require resource-specific review.', 'Geographical matching establishes catalog key identity only.'],
    evidence_class: '[OBSERVADO]', lineage: row.lineage,
  }));
  const municipalityVersions = catalog.municipalities.filter((municipality) => isValidMunicipalityId(municipality.inegi_cve)).map((municipality) => ({
    municipality_version_id: `${municipality.inegi_cve}@legacy-map-${catalog.generated}`,
    municipality_id: municipality.inegi_cve, name: municipality.municipality,
    catalog_snapshot_date: catalog.generated, catalog_sha256: catalogInput.sha256,
    boundary_version: 'legacy_PDU_regions_ITER2020_not_current_boundaries',
    valid_from: null, valid_to: null, legal_source_id: null, validity_status: 'unknown_legal_interval',
    region: municipality.region ?? null, region_source_id: municipality.source ?? null,
    temporal_comparison_eligible: false, evidence_class: '[OBSERVADO]',
  }));
  const beforeMunicipalities = read('research/curated/mission03/municipalities-before.json').records;
  const baseline = read('research/curated/mission03/baseline-audit.json');
  const currentMunicipalities = staged.filter((row) => row.dataset === 'municipalities');
  const aggregates = aggregateMunicipalities(staged, currentMunicipalities);
  const eligibleStaged = staged.filter((_, index) => !quarantinedIndexes.has(index));
  const eligibleAggregates = aggregateMunicipalities(eligibleStaged, currentMunicipalities.filter((row) => isValidMunicipalityId(row.municipality_id))).map((aggregate) => ({
    ...aggregate, scope: 'structurally_eligible_inventory_key_counts_not_demand_or_current_boundary_harmonization',
    accepted_member_rows: eligibleStaged.filter((row) => row.dataset !== 'municipalities' && row.municipality_id === aggregate.municipality_id).length,
    declared_member_rows: staged.filter((row) => row.dataset !== 'municipalities' && row.municipality_id === aggregate.municipality_id).length,
    unit: 'inventory_records', evidence_class: '[DERIVADO]',
  }));
  const eligibleAggregateChanges = eligibleAggregates.flatMap((aggregate) => {
    const declared = aggregates.find((row) => row.municipality_id === aggregate.municipality_id);
    const counts = Object.fromEntries(Object.entries(aggregate.counts).filter(([metric, count]) => count !== declared.counts[metric]).map(([metric, after]) => [metric, { all_declared: declared.counts[metric], eligible: after }]));
    return Object.keys(counts).length ? [{ municipality_id: aggregate.municipality_id, counts }] : [];
  });
  const municipalChanges = currentMunicipalities.flatMap((row, index) => {
    const before = beforeMunicipalities[index];
    if (before.id !== row.id || before.canonical_name !== row.canonical_name) throw new Error('Municipality snapshot order or identity changed; review required');
    const delta = {};
    for (const field of Object.keys(row)) if (!['dataset', 'lineage'].includes(field) && JSON.stringify(before[field]) !== JSON.stringify(row[field])) delta[field] = { before: before[field] ?? null, after: row[field] ?? null };
    return Object.keys(delta).length ? [{ name: row.canonical_name, municipality_id: row.id, delta }] : [];
  });
  const currentAggregationMismatches = aggregates.flatMap((aggregate, index) => JSON.stringify(aggregate.counts) === JSON.stringify(currentMunicipalities[index].counts) && JSON.stringify(aggregate.related_entities) === JSON.stringify(currentMunicipalities[index].related_entities) ? [] : [{ municipality_id: aggregate.municipality_id, expected: aggregate, snapshot_counts: currentMunicipalities[index].counts }]);
  const rawBefore = read('research/curated/mission03/raw-manifest-before.json');
  const rawAfter = rawManifest(root);
  if (JSON.stringify(rawBefore) !== JSON.stringify(rawAfter)) throw new Error('Raw manifest changed since baseline; mission must be reviewed');
  for (const name of ['scripts/academic/etl-mission03.mjs', 'research/scripts/entities/integrity.mjs', 'research/scripts/entities/build-entities.mjs']) {
    inputs.push(representedInput(name, fs.readFileSync(path.join(root, name))).metadata);
  }
  const reasonCounts = {};
  for (const { reasons } of quarantine) for (const reason of reasons) reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
  const acceptedIds = new Set(accepted.map((row) => row.entity_id));
  const sourceVariants = [...sourceIds].filter((id) => sourceSnapshots.filter((source) => source.source_id === id).length > 1);
  const nameGroups = new Map();
  for (const row of staged) {
    const key = `${row.dataset}|${row.municipality_id}|${row.canonical_name?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()}`;
    if (!nameGroups.has(key)) nameGroups.set(key, []);
    nameGroups.get(key).push(row.id);
  }
  const duplicateCandidates = [...nameGroups].filter(([, ids]) => ids.length > 1).map(([key, entity_ids]) => ({ key, entity_ids, status: 'review_only_no_merge' }));
  const report = {
    contract_version: 'campaign-data-v1.0.0', transformation_version: 'mission03-curation-v1.0.0', evidence_class: '[DERIVADO]',
    audit_date: '2026-11-07', timezone: 'America/Mexico_City',
    input_rows: staged.length, baseline_rows: baseline.total_entity_rows, accepted_rows: accepted.length, quarantined_rows: quarantine.length,
    conservation_passed: staged.length === accepted.length + quarantine.length,
    accepted_by_dataset: Object.fromEntries(sets.filter((dataset) => dataset !== 'routes').map((dataset) => [dataset, accepted.filter((row) => row.dataset === dataset).length])),
    quarantine_by_reason: reasonCounts, source_rows: sourceSnapshots.length, unique_source_ids: sourceIds.size,
    source_variant_ids: sourceVariants, duplicate_name_candidate_groups: duplicateCandidates.length,
    municipality_versions: municipalityVersions.length, raw_files: rawAfter.length, raw_bytes: rawAfter.reduce((sum, item) => sum + item.bytes, 0), raw_unchanged: true,
    municipal_changes: municipalChanges, municipal_aggregation_mismatches: currentAggregationMismatches,
    eligible_aggregate_changes: eligibleAggregateChanges,
    accepted_related_refs_to_quarantine: accepted.reduce((sum, row) => sum + row.related_entity_ids_withheld.length, 0),
    accepted_fk_integrity: accepted.every((row) => municipalityVersions.some((municipality) => municipality.municipality_version_id === row.municipality_version_id) && row.source_snapshot_refs.every((id) => sourceSnapshots.some((source) => source.source_snapshot_id === id)) && row.related_entity_ids_eligible.every((id) => acceptedIds.has(id))),
    publication_eligible_rows: 0, temporal_comparison_eligible_rows: 0,
    notes: ['Counts are inventory records, never visitors.', 'Quarantine reasons overlap; count unique rows separately.', '24059 is preserved as declared and quarantined pending an authoritative versioned catalog.', 'The 2020 census remains on its historical geography; no crosswalk is invented.', 'No source-version precedence is invented: all local variants are retained.', 'No row is certified for publication by this offline ETL.'],
  };
  const products = {
    'entity-snapshot.json': accepted, 'municipality-versions.json': municipalityVersions,
    'source-snapshots.json': sourceSnapshots, 'quarantine.json': quarantine,
    'duplicate-candidates.json': duplicateCandidates, 'municipal-aggregates.json': aggregates.map((aggregate) => ({ ...aggregate, scope: 'regression_from_all_declared_rows_including_quarantine' })),
    'eligible-municipal-aggregates.json': eligibleAggregates,
    'validation-report.json': report,
  };
  const productManifest = Object.entries(products).map(([name, data]) => ({ path: name, bytes: Buffer.byteLength(encode(data)), sha256: hash(encode(data)) }));
  const manifest = { contract_version: report.contract_version, transformation_version: report.transformation_version, run_id: hash(JSON.stringify(inputs)).slice(0, 20), inputs, raw_inputs: rawAfter, outputs: productManifest, determinism: 'same input bytes and code produce same output bytes; no clock, network, or random state' };
  products['manifest.json'] = manifest;
  if (write) {
    fs.mkdirSync(outputDir, { recursive: true });
    for (const [name, data] of Object.entries(products)) fs.writeFileSync(path.join(outputDir, name), encode(data));
  }
  return { report, products, manifest };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = buildMission03();
  console.log(JSON.stringify(result.report, null, 2));
  if (!result.report.conservation_passed || !result.report.accepted_fk_integrity || result.report.municipal_aggregation_mismatches.length) process.exitCode = 1;
}

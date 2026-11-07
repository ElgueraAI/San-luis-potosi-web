import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateMunicipalities, coordinateIssues, isValidMunicipalityId,
  validMunicipalityJoin, validateRows,
} from '../../research/scripts/entities/integrity.mjs';

const municipalities = new Set(['24028', '24003']);
const sources = new Set(['sic-test']);
const entity = (overrides = {}) => ({
  id: 'place-1', canonical_name: 'Ficha de prueba', entity_type: 'destination',
  municipality_id: '24028', source_ids: ['sic-test'], latitude: 22.15, longitude: -100.97,
  ...overrides,
});
const issues = (overrides) => validateRows([entity(overrides)], municipalities, sources)[0].reasons;

test('joins never match null, undefined, malformed, numeric or state-total keys', () => {
  for (const key of [null, undefined, '', '24000', '24ABC', '24028 ', '240280', '99001', 24028]) {
    assert.equal(isValidMunicipalityId(key), false, String(key));
    assert.equal(validMunicipalityJoin(key, key), false, String(key));
    assert.equal(validMunicipalityJoin(key, '24028'), false, String(key));
  }
  assert.equal(validMunicipalityJoin('24028', '24028'), true);
  assert.equal(validMunicipalityJoin('24028', '24003'), false);
});

test('duplicate IDs quarantine every conflicting row, keeping distinct same-name seats', () => {
  const duplicate = validateRows([entity(), entity({ municipality_id: '24003' })], municipalities, sources);
  assert.deepEqual(duplicate.map((row) => row.reasons), [['duplicate_id'], ['duplicate_id']]);
  const sameName = validateRows([entity(), entity({ id: 'place-2' })], municipalities, sources);
  assert.deepEqual(sameName.map((row) => row.reasons), [[], []]);
  assert.ok(issues({ id: null }).includes('missing_id'));
});

test('source and entity foreign keys must resolve; invalid references are retained as findings', () => {
  assert.deepEqual(issues({}), []);
  assert.ok(issues({ source_ids: ['missing'] }).includes('unresolved_source_reference'));
  assert.ok(issues({ source_ids: [null, 'sic-test'] }).includes('null_or_invalid_source_reference'));
  assert.ok(issues({ source_ids: [] }).includes('missing_source'));
  assert.ok(issues({ related_entities: ['missing'] }).includes('unresolved_entity_reference'));
  const linked = validateRows([entity({ related_entities: ['place-2'] }), entity({ id: 'place-2' })], municipalities, sources);
  assert.deepEqual(linked.map((row) => row.reasons), [[], []]);
});

test('a syntactically valid key absent from the temporal catalogue is unmatched', () => {
  assert.ok(issues({ municipality_id: null }).includes('invalid_or_missing_municipality_id'));
  assert.ok(issues({ municipality_id: '24059' }).includes('unmatched_municipality_id'));
  assert.ok(issues({ municipality_id: '24000' }).includes('invalid_or_missing_municipality_id'));
});

test('coordinates: missing pair stays unknown; incomplete, nonnumeric, impossible and external points fail', () => {
  assert.deepEqual(coordinateIssues(null, null), []);
  assert.deepEqual(coordinateIssues(22, null), ['incomplete_coordinate_pair']);
  for (const [lat, lon] of [[NaN, -100], [Infinity, -100], ['22', -100], [91, -100], [22, 181]]) {
    assert.deepEqual(coordinateIssues(lat, lon), ['invalid_coordinate']);
  }
  assert.deepEqual(coordinateIssues(0, 0), ['outside_slp_bbox']);
  assert.deepEqual(coordinateIssues(19.43, -99.13), ['outside_slp_bbox']);
  assert.deepEqual(coordinateIssues(22.15, -100.97), []);
});

test('calendar validation catches impossible dates without silently normalizing them', () => {
  assert.ok(issues({ start_date: '2026-02-30' }).includes('invalid_start_date'));
  assert.ok(issues({ start_date: '2026-05-10', end_date: '2026-05-01' }).includes('reversed_event_dates'));
  assert.ok(issues({ months: [0, 13] }).includes('invalid_month'));
});

test('aggregate excludes null-key rows, conserves known-key membership and preserves unknown versus zero', () => {
  const rows = [entity(), entity({ id: 'unlocated', municipality_id: null }), entity({ id: 'event', entity_type: 'event' })];
  const dimensions = [{ municipality_id: '24028' }, { municipality_id: '24003' }, { municipality_id: null }];
  const result = aggregateMunicipalities(rows, dimensions);
  assert.equal(result[0].counts.destinations, 1);
  assert.equal(result[0].counts.events, 1);
  assert.deepEqual(result[0].related_entities, ['place-1']);
  assert.ok(Object.values(result[1].counts).every((value) => value === 0), 'known empty registry group yields a count of zero');
  assert.ok(Object.values(result[2].counts).every((value) => value === null), 'unknown territory never yields a measured zero');
  assert.deepEqual(result[2].related_entities, []);
  assert.equal(result.reduce((sum, row) => sum + (row.counts.destinations ?? 0), 0), 1);
});

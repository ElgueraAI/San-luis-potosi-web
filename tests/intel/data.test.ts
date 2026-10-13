/**
 * Data intelligence layer: normalization, taxonomy, municipality features and
 * quality controls. Fixtures for each rule, then the real research layer to pin
 * the invariants the engines rely on. Run: npm run test:intel
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlace, normalizeEvent, seasonIndex, coordConfidence, sourceConfidence, evidenceLevel, inSlp, validCoord, kindOf, provenance, type RawEntity } from '../../src/lib/intel/normalize';
import { kindInterests, isOutdoor, reachKm, TAG_MAP, INTERESTS } from '../../src/lib/intel/taxonomy';
import { municipalityFeatures, concentration, topShare } from '../../src/lib/intel/features';
import { runQuality, coverage, levenshtein, norm, summarize } from '../../src/lib/intel/quality';
import { buildDataset } from '../../src/lib/intel/dataset';
import attractions from '../../research/entities/attractions/index.json';
import archaeology from '../../research/entities/archaeology/index.json';
import museums from '../../research/entities/museums/index.json';
import venues from '../../research/entities/cultural-venues/index.json';
import recreation from '../../research/entities/recreation/index.json';
import events from '../../research/entities/events/index.json';
import municipalities from '../../research/entities/municipalities/index.json';
import seasonal from '../../research/generated/seasonal-calendar.json';
import destIndex from '../../research/destinations/index.json';

const ent = (o: Partial<RawEntity>): RawEntity => ({ id: 'x1', canonical_name: 'Lugar de prueba', entity_type: 'destination', ...o });

// --------------------------------------------------------------- normalization --
test('normalize: stated tags and derived interests are kept apart', () => {
  const p = normalizePlace(ent({ tags: ['cascadas', 'aventura'], latitude: 21.8, longitude: -99.18, coordinate_status: 'verified', verification_status: 'verified', short_description: 'x' }))!;
  assert.deepEqual(p.interests.sort(), ['agua', 'aventura']);
  assert.deepEqual(p.derived_interests, []);
  const m = normalizePlace(ent({ id: 'm1', entity_type: 'museum', subcategory: 'Arte', verification_status: 'listed', latitude: 22.15, longitude: -100.97, coordinate_status: 'approximate' }))!;
  assert.deepEqual(m.interests, ['arte', 'cultura']);
  assert.deepEqual(m.derived_interests, ['arte', 'cultura'], 'a museum has no editorial tags: every interest is derived');
});

test('normalize: missing values stay null, nothing is invented', () => {
  const p = normalizePlace(ent({}))!;
  assert.equal(p.coord, null);
  assert.equal(p.coord_confidence, 'unknown');
  assert.equal(p.region, null);
  assert.equal(p.municipality, null);
  assert.equal(p.recommended_months, null);
  assert.equal(p.description, null);
  assert.equal(p.evidence, 'baja');
  assert.equal(p.official_url, null);
});

test('normalize: coordinates of 0,0 or out of range are not a point', () => {
  assert.equal(validCoord(0, 0), false);
  assert.equal(validCoord(-100.9, 95), false);
  assert.equal(validCoord(-100.9, 22.1), true);
  assert.equal(normalizePlace(ent({ latitude: 0, longitude: 0, coordinate_status: 'verified' }))!.coord, null);
  assert.equal(inSlp([-100.97, 22.15]), true);
  assert.equal(inSlp([-99.13, 19.43]), false, 'Mexico City is outside the state');
});

test('normalize: confidence vocabulary', () => {
  assert.equal(coordConfidence('verified'), 'verified');
  assert.equal(coordConfidence('registry'), 'official');
  assert.equal(coordConfidence('municipal-seat'), 'approximate');
  assert.equal(coordConfidence('unavailable'), 'unknown');
  assert.equal(sourceConfidence('listed'), 'official');
  assert.equal(sourceConfidence('pending'), 'unknown');
  assert.equal(evidenceLevel('verified', 'verified', true), 'alta');
  assert.equal(evidenceLevel('official', 'approximate', false), 'baja');
  assert.equal(evidenceLevel('official', 'approximate', true), 'media');
  assert.equal(evidenceLevel('official', 'official', true, true), 'baja', 'a register row never exceeds low evidence');
});

test('normalize: only galleries and craft houses are candidates among venues', () => {
  assert.equal(kindOf(ent({ entity_type: 'cultural-venue', subcategory: 'Auditorio' })), null);
  assert.equal(kindOf(ent({ entity_type: 'cultural-venue', subcategory: 'Galería' })), 'gallery');
  assert.equal(kindOf(ent({ entity_type: 'cultural-venue', subcategory: 'Casa o tienda de artesanía' })), 'craft');
  assert.equal(kindOf(ent({ entity_type: 'lodging' })), null);
});

test('season: months come only from official statements; cautions are not recommendations', () => {
  const idx = seasonIndex(
    [ent({ id: 'exp-a', entity_type: 'seasonal-experience', months: [11, 12, 1], related_entities: ['H01'], source_ids: ['brochure-huasteca'] }), ent({ id: 'exp-b', entity_type: 'seasonal-experience', months: [], related_entities: ['H15'] })],
    [{ record_id: 'se-clima', destination: 'A01|A06', months: [1, 12], notes: 'Climate caution, not a recommendation.', rain_dry_context: 'Invierno de frío extremo. Supporting data: x' }, { record_id: 'se-fiesta', destination: 'C01', months: [8], notes: null }],
  );
  assert.deepEqual(idx.months.get('H01'), { months: [1, 11, 12], source: 'brochure-huasteca' });
  assert.equal(idx.months.has('H15'), false, 'a period without months gives no months');
  assert.deepEqual(idx.cautions.get('A06'), { months: [1, 12], note: 'Invierno de frío extremo.' });
  assert.equal(idx.cautions.has('C01'), false);
  const p = normalizePlace(ent({ id: 'A01' }), { season: idx })!;
  assert.equal(p.recommended_months, null);
  assert.deepEqual(p.caution_months, [1, 12]);
});

test('events: date confidence follows the date status', () => {
  const e = (ds: string) => normalizeEvent(ent({ entity_type: 'event', date_status: ds, months: [4] }))!.date_confidence;
  assert.equal(e('CONFIRMED_CURRENT_YEAR'), 'confirmed');
  assert.equal(e('RECURRENT_OFFICIAL_PATTERN'), 'pattern');
  assert.equal(e('HISTORICAL_LAST_CONFIRMED'), 'past');
  assert.equal(e('DATE_PENDING'), 'unknown');
  assert.equal(normalizeEvent(ent({ entity_type: 'seasonal-experience' })), null);
});

test('provenance: registry rows, short ids and unknown ids', () => {
  const reg = new Map([['sic-museo', { source_id: 'sic-museo', institution: 'Secretaría de Cultura', url: 'https://sic.cultura.gob.mx/', verification_status: 'official', retrieval_date: '2026-10-06' }]]);
  assert.equal(provenance('sic-museo', reg).source_type, 'official');
  assert.match(provenance('sic-museo', reg).licence!, /atribución/);
  assert.equal(provenance('brochure-huasteca', reg).source_type, 'official');
  assert.equal(provenance('no-such-source', reg).source_type, 'unknown');
  assert.equal(provenance('no-such-source', reg).source_url, null);
});

// -------------------------------------------------------------------- taxonomy --
test('taxonomy: every mapped tag points at known interests', () => {
  for (const [tag, list] of Object.entries(TAG_MAP)) for (const i of list) assert.ok(INTERESTS.includes(i), `${tag} → ${i}`);
  assert.deepEqual(kindInterests('archaeology', null), ['arqueologia', 'historia', 'cultura']);
  assert.deepEqual(kindInterests('recreation', 'Parque acuático o balneario (público)'), ['agua', 'relajacion', 'familia']);
  assert.equal(isOutdoor('museum', ['arte']), false);
  assert.equal(isOutdoor('destination', ['agua']), true);
  assert.equal(isOutdoor('destination', ['historia']), null, 'a town may be indoors or outdoors: unknown');
});

test('taxonomy: reach grows with time and shrinks with slower modes', () => {
  assert.ok(reachKm('half-day', 'car') < reachKm('day', 'car'));
  assert.ok(reachKm('day', 'car') < reachKm('long', 'car'));
  assert.ok(reachKm('day', 'foot') < reachKm('day', 'bike'));
  assert.ok(reachKm('day', 'bike') < reachKm('day', 'car'));
});

// -------------------------------------------------------------------- features --
test('features: indices stay in 0–1 and exposure follows lodging, flagships and Pueblo Mágico', () => {
  const munis = [
    { id: '1', canonical_name: 'Grande', region: 'centro', counts: { destinations: 5, lodging: 150, food: 900, events: 10, museums: 5 } },
    { id: '2', canonical_name: 'Discreto', region: 'centro', counts: { destinations: 2, lodging: 6, food: 20, events: 3 } },
    { id: '3', canonical_name: 'Vacío', region: 'altiplano', counts: {} },
  ];
  const place = (id: string, m: string, o: Partial<RawEntity> = {}) => normalizePlace(ent({ id, municipality_id: m, ...o }), { priority: new Map([['a1', 'A'], ['a2', 'A'], ['a3', 'A']]) })!;
  const places = [place('a1', '1', { pueblo_magico: true }), place('a2', '1'), place('a3', '1'), place('b1', '2'), place('b2', '2')];
  const f = municipalityFeatures(munis, places);
  for (const m of f) for (const v of [m.infrastructure_index, m.exposure_proxy, m.diversification_potential, m.coverage_index, m.asset_share]) assert.ok(v >= 0 && v <= 1, `${m.name} ${v}`);
  const [big, quiet, empty] = f;
  assert.equal(big.exposure_proxy, 1, 'max lodging + 3 flagships + Pueblo Mágico');
  assert.ok(quiet.exposure_proxy < big.exposure_proxy);
  assert.ok(quiet.diversification_potential > big.diversification_potential, 'assets with low exposure rank above the most exposed');
  assert.equal(empty.diversification_potential, 0, 'nothing to offer: no potential, whatever the exposure');
  assert.equal(empty.assets, 0);
  assert.equal(Math.round(f.reduce((s, m) => s + m.asset_share, 0) * 100), 100);
});

test('features: concentration measures', () => {
  assert.equal(concentration([10, 0, 0]), 1);
  assert.equal(concentration([5, 5]), 0.5);
  assert.equal(concentration([]), 0);
  assert.equal(topShare([6, 3, 1], 1), 0.6);
});

// --------------------------------------------------------------------- quality --
test('quality: each control fires on its fixture and stays quiet on a clean record', () => {
  const clean = ent({ id: 'ok', municipality_id: '24028', region: 'centro', latitude: 22.15, longitude: -100.97, coordinate_status: 'verified', source_ids: ['s'], verification_status: 'verified' });
  const input = (records: RawEntity[]) => ({ sets: { t: records }, municipalityIds: new Set(['24028', '24003']), municipalityRegion: new Map([['24028', 'centro'], ['24003', 'huasteca']]), geoExpected: ['t'], mediaIds: new Set(['wc-1']) });
  assert.deepEqual(runQuality(input([clean])), []);
  const checks = (records: RawEntity[]) => Object.keys(summarize(runQuality(input(records))));
  assert.ok(checks([{ ...clean, latitude: 122.1 }]).includes('impossible-coordinates'));
  assert.ok(checks([{ ...clean, latitude: 19.43, longitude: -99.13 }]).includes('outside-slp'));
  assert.ok(checks([{ ...clean, latitude: null, longitude: null }]).includes('no-coordinates'));
  assert.ok(checks([{ ...clean, municipality_id: '99999' }]).includes('unknown-municipality'));
  assert.ok(checks([{ ...clean, municipality_id: '24003' }]).includes('region-mismatch'));
  assert.ok(checks([{ ...clean, source_ids: [] }]).includes('no-source'));
  assert.ok(checks([{ ...clean, canonical_name: 'Restaurante sin nombre' }]).includes('placeholder'));
  assert.ok(!checks([{ ...clean, canonical_name: 'Abierto todo el año' }]).includes('placeholder'), '"todo" is a Spanish word');
  assert.ok(checks([{ ...clean, official_url: 'facebook/pagina' }]).includes('malformed-url'));
  assert.ok(checks([{ ...clean, image_ids: ['wc-404'] }]).includes('image-not-in-production'));
  assert.ok(checks([clean, { ...clean }]).includes('duplicate-id'));
  assert.ok(checks([clean, { ...clean, id: 'other' }]).includes('duplicate-name'));
  assert.ok(checks([{ ...clean, canonical_name: 'Museo Regional Potosino' }, { ...clean, id: 'o2', canonical_name: 'Museo Regional Potosina' }]).includes('near-duplicate-name'));
  const ev = { ...clean, entity_type: 'event', start_date: '2026-05-10', end_date: '2026-05-02', months: [4] } as RawEntity;
  assert.ok(checks([ev]).includes('contradictory-dates'));
  assert.ok(checks([ev]).includes('date-month-mismatch'));
  assert.ok(checks([{ ...clean, months: [13] }]).includes('impossible-month'));
});

test('quality: helpers', () => {
  assert.equal(levenshtein('museo', 'museos'), 1);
  assert.equal(levenshtein('abc', 'abc'), 0);
  assert.equal(norm('  Cascada de  Tamúl '), 'cascada de tamul');
  const c = coverage({ t: [ent({ latitude: 22, longitude: -100, source_ids: ['s'], verification_status: 'listed' }), ent({ id: 'x2' })] })[0];
  assert.equal(c.records, 2);
  assert.equal(c.with_point, 0.5);
  assert.equal(c.official_source, 0.5);
});

// --------------------------------------------------------- real research layer --
const raw = {
  attractions: attractions.records as unknown as RawEntity[], archaeology: archaeology.records as unknown as RawEntity[], museums: museums.records as unknown as RawEntity[],
  venues: venues.records as unknown as RawEntity[], recreation: recreation.records as unknown as RawEntity[], events: events.records as unknown as RawEntity[],
  municipalities: municipalities.records as never, seasonRecords: seasonal.records as never, priorities: destIndex.destinations,
};
const ds = buildDataset(raw);

test('real data: the dataset is complete and consistent', () => {
  assert.equal(ds.municipalities.length, 59, '59 municipalities');
  assert.ok(ds.places.length > 120, `${ds.places.length} candidates`);
  assert.equal(new Set(ds.places.map((p) => p.id)).size, ds.places.length, 'unique ids');
  for (const p of ds.places) {
    if (p.coord) assert.ok(inSlp(p.coord), `${p.id} ${p.name} lies inside San Luis Potosí`);
    else assert.equal(p.coord_confidence, 'unknown', `${p.id} without a point is not given a confidence`);
    assert.ok(p.interests.length > 0, `${p.id} ${p.name} has at least one interest`);
    for (const i of p.derived_interests) assert.ok(p.interests.includes(i));
    if (p.recommended_months) assert.ok(p.season_source, `${p.id} season months carry their source`);
  }
  assert.ok(!ds.places.some((p) => p.kind === 'heritage'), 'declarations are context, not candidates');
  assert.ok(ds.places.filter((p) => p.kind === 'recreation').every((p) => p.evidence === 'baja'));
});

test('real data: official season statements reach the right destinations', () => {
  const tamul = ds.places.find((p) => p.id === 'H01')!;
  assert.deepEqual(tamul.recommended_months, [1, 2, 3, 11, 12]);
  assert.equal(tamul.priority, 'A');
  const catorce = ds.places.find((p) => p.id === 'A01')!;
  assert.equal(catorce.recommended_months, null, 'a climate caution is not a recommended season');
  assert.deepEqual(catorce.caution_months, [6, 7, 8, 12, 1, 2]);
  assert.ok(catorce.pueblo_magico && catorce.interests.includes('pueblos-magicos'));
});

test('real data: municipality features', () => {
  const by = (n: string) => ds.municipalities.find((m) => m.name === n)!;
  assert.ok(by('San Luis Potosí').exposure_proxy > by('Tamuín').exposure_proxy);
  assert.ok(by('Catorce').exposure_proxy > by('Guadalcázar').exposure_proxy);
  assert.ok(ds.municipalities.every((m) => m.exposure_proxy >= 0 && m.exposure_proxy <= 1));
  assert.ok(by('Villa de Pozos').id.startsWith('name:'), 'the 2024 municipality has no INEGI 2020 key and keeps a name key');
  assert.ok(ds.municipalities.filter((m) => m.assets === 0).length > 20, 'many municipalities have no scorable asset: the gap the project is about');
});

/**
 * Interpretable segmentation, the session feature row and the campaign
 * matrix. Run: npm run test:intel
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEGMENTS, segmentFor, interestSignal, affinity, sessionFeatures, FEATURE_COLUMNS, MIN_AFFINITY } from '../../src/lib/intel/segments';
import { CAMPAIGNS, PROPOSAL_LABEL, segmentEvidence, campaignSupport, matchesSegment } from '../../src/lib/intel/marketing';
import { FORBIDDEN_KEY } from '../../src/lib/intel/analytics';
import { INTERESTS } from '../../src/lib/intel/taxonomy';
import { buildDataset } from '../../src/lib/intel/dataset';
import type { IntelPlace, TouristProfile } from '../../src/lib/intel/types';
import type { RawEntity } from '../../src/lib/intel/normalize';
import attractions from '../../research/entities/attractions/index.json';
import archaeology from '../../research/entities/archaeology/index.json';
import museums from '../../research/entities/museums/index.json';
import venues from '../../research/entities/cultural-venues/index.json';
import recreation from '../../research/entities/recreation/index.json';
import events from '../../research/entities/events/index.json';
import municipalities from '../../research/entities/municipalities/index.json';
import seasonal from '../../research/generated/seasonal-calendar.json';
import destIndex from '../../research/destinations/index.json';

const profile = (o: Partial<TouristProfile> = {}): TouristProfile => ({ interests: [], duration: 'day', mode: 'car', budget: 'medio', ...o });
const saved = (interests: IntelPlace['interests'], o: Partial<IntelPlace> = {}) => ({ id: 'x', interests, region: 'huasteca', municipality_id: '24003', priority: 'A', ...o }) as IntelPlace;

test('segments: eight, named from the taxonomy, with weights in 0–1 over known interests', () => {
  assert.equal(SEGMENTS.length, 8);
  assert.equal(new Set(SEGMENTS.map((s) => s.id)).size, 8);
  for (const s of SEGMENTS) for (const [i, w] of Object.entries(s.weights)) {
    assert.ok(INTERESTS.includes(i as never), `${s.id}: ${i}`);
    assert.ok(w > 0 && w <= 1);
  }
});

test('segments: declared interests decide the segment', () => {
  const pick = (interests: TouristProfile['interests'], duration: TouristProfile['duration'] = 'day') => segmentFor({ profile: profile({ interests, duration }) }).primary?.segment.id;
  assert.equal(pick(['naturaleza', 'agua']), 'explorador-natural');
  assert.equal(pick(['aventura']), 'aventurero');
  assert.equal(pick(['cultura', 'arte']), 'viajero-cultural');
  assert.equal(pick(['historia', 'arqueologia']), 'explorador-patrimonial');
  assert.equal(pick(['gastronomia']), 'viajero-gastronomico');
  assert.equal(pick(['pueblos-magicos', 'fotografia']), 'explorador-de-pueblos');
  assert.equal(pick(['familia', 'relajacion']), 'viajero-familiar');
});

test('segments: the weekend getaway needs the trip length, and an empty session gets no segment', () => {
  const empty = segmentFor({ profile: profile() });
  assert.equal(empty.primary, null, 'nothing known: no segment is invented');
  assert.equal(empty.hasSignal, false);
  assert.ok(!empty.ranking.some((m) => m.segment.id === 'escapada-fin-de-semana'), 'a one-day trip is not a weekend getaway');
  const weekend = segmentFor({ profile: profile({ duration: 'weekend' }) });
  assert.equal(weekend.primary?.segment.id, 'escapada-fin-de-semana');
  const weekendNature = segmentFor({ profile: profile({ duration: 'weekend', interests: ['naturaleza', 'agua', 'fotografia'] }) });
  assert.equal(weekendNature.primary?.segment.id, 'explorador-natural', 'clear interests outweigh the trip length');
});

test('segments: what the visitor declared outweighs what the saved places suggest', () => {
  // declared nature and water; the saved waterfalls also carry "aventura"
  const res = segmentFor({ profile: profile({ interests: ['naturaleza', 'agua'] }), saved: [saved(['agua', 'aventura', 'naturaleza']), saved(['agua', 'naturaleza', 'relajacion'])] });
  assert.equal(res.primary?.segment.id, 'explorador-natural');
  assert.equal(res.ranking[1].segment.id, 'aventurero', 'the behaviour shows up as the runner-up');
});

test('segments: behaviour counts when nothing was declared, and less than a declaration', () => {
  const byBehaviour = segmentFor({ profile: profile(), saved: [saved(['agua', 'aventura']), saved(['aventura', 'naturaleza'])] });
  assert.equal(byBehaviour.primary?.segment.id, 'aventurero');
  assert.ok(byBehaviour.hasSignal);
  const signal = interestSignal({ profile: profile({ interests: ['arte'] }), saved: [saved(['agua'])], behaviour: { agua: 4, historia: 2 } });
  assert.equal(signal.arte, 1);
  assert.equal(signal.agua, 1, '0.6 (saved) + 0.4 (behaviour), capped at 1');
  assert.equal(signal.historia, 0.2);
  assert.equal(signal.familia, 0);
  const weak = segmentFor({ profile: profile(), behaviour: { arqueologia: 1 } });
  assert.ok(weak.ranking[0].affinity < MIN_AFFINITY && weak.primary === null, 'one weak signal is not enough to label a visitor');
});

test('segments: affinity is 60 % defining interest, 40 % supporting ones, in 0–1, and names its drivers', () => {
  const signal = interestSignal({ profile: profile({ interests: ['naturaleza', 'agua'] }) });
  const a = affinity(SEGMENTS[0], signal, 'day');
  assert.ok(Math.abs(a.value - (0.6 * 1 + 0.4 * (0.8 / 1.6))) < 1e-9);
  assert.deepEqual(a.drivers, ['naturaleza', 'agua']);
  for (const m of segmentFor({ profile: profile({ interests: INTERESTS, duration: 'weekend' }) }).ranking) assert.ok(m.affinity >= 0 && m.affinity <= 1);
});

test('session feature row: numbers only, fixed columns, no identity or position', () => {
  const row = sessionFeatures({
    profile: profile({ interests: ['agua'], duration: 'weekend', mode: 'bike', budget: 'flexible' }), saved: [saved(['agua']), saved(['historia'], { region: 'centro', municipality_id: '24028', priority: 'B' })],
    exposureOf: (id) => (id === '24003' ? 0.75 : 0.2), recommendationsSeen: 18, recommendationsAdded: 3, optimized: true, month: 10,
  });
  assert.deepEqual(Object.keys(row), [...FEATURE_COLUMNS]);
  for (const [k, v] of Object.entries(row)) { assert.equal(typeof v, 'number', k); assert.ok(Number.isFinite(v), k); }
  // column names such as recommendations_seen describe counts; none may name a position or an identity
  const personal = /lat|lon|lng|coord|gps|position|email|phone|name|user|device|token|uuid/i;
  for (const k of Object.keys(row)) assert.ok(!personal.test(k), `${k} is not a personal or position column`);
  assert.ok(FORBIDDEN_KEY.test('gps_history'));
  assert.deepEqual([row.interest_agua, row.duration_ordinal, row.mode_bike, row.mode_car, row.budget_ordinal], [1, 2, 1, 0, 2]);
  assert.deepEqual([row.stops, row.regions, row.municipalities, row.share_flagship, row.share_low_exposure], [2, 2, 2, 0.5, 0.5]);
  assert.deepEqual([row.recommendations_seen, row.recommendations_added, row.add_rate, row.optimized, row.month], [18, 3, 0.17, 1, 10]);
  const blank = sessionFeatures({ profile: profile() });
  assert.equal(blank.add_rate, 0, 'no division by zero on an empty session');
  assert.equal(blank.stops, 0);
});

// ------------------------------------------------------------------- marketing --
const built = buildDataset({
  attractions: attractions.records as unknown as RawEntity[], archaeology: archaeology.records as unknown as RawEntity[], museums: museums.records as unknown as RawEntity[],
  venues: venues.records as unknown as RawEntity[], recreation: recreation.records as unknown as RawEntity[], events: events.records as unknown as RawEntity[],
  municipalities: municipalities.records as never, seasonRecords: seasonal.records as never, priorities: destIndex.destinations,
});
const evidence = segmentEvidence(built.places, built.municipalities, built.events);

test('marketing: evidence comes from the dataset', () => {
  assert.equal(evidence.length, 8);
  for (const e of evidence) {
    assert.equal(e.total, built.places.filter((p) => matchesSegment(p, e.segment)).length);
    assert.ok(e.total > 0, `${e.segment.id} has offer in the base`);
    assert.equal(e.eventsByMonth.length, 12);
    for (const m of e.toPromote) assert.ok(m.exposure < 0.4 && m.places > 0, `${m.name} is little exposed and has matching places`);
  }
  const natural = evidence.find((e) => e.segment.id === 'explorador-natural')!;
  assert.equal(natural.topRegion, 'huasteca');
  assert.deepEqual(natural.seasonMonths, [1, 2, 3, 11, 12], 'the official Huasteca water season');
});

test('marketing: every proposal is supported by offer in its region and carries no result figure', () => {
  assert.ok(CAMPAIGNS.length >= 12);
  assert.equal(PROPOSAL_LABEL, 'Propuesta estratégica');
  for (const s of SEGMENTS) assert.ok(CAMPAIGNS.some((c) => c.segment === s.id), `${s.id} has at least one proposal`);
  for (const c of CAMPAIGNS) {
    assert.ok(campaignSupport(c, evidence) > 0, `${c.segment} / ${c.region}: the base has matching places`);
    assert.ok(c.months.length > 0 && c.months.every((m) => m >= 1 && m <= 12));
    const text = `${c.message} ${c.channel} ${c.cta} ${c.season}`;
    assert.ok(!/\d+\s?%|conversi[oó]n|ROI|alcance de|impresiones|clics/i.test(text), `no performance claim in "${c.message}"`);
    assert.ok(!/saturad|sin gente|vac[ií]o/i.test(text), 'no crowding claim');
  }
});

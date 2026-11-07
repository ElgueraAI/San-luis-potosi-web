/**
 * Recommendation engine and context engine: factor behaviour, missing-data
 * rules, the relevance-first diversity bonus, ranking, and the profile →
 * recommendation path on the real research layer. Run: npm run test:intel
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scorePlace, rank, WEIGHTS, DIVERSITY_BONUS_MAX, EVENT_BONUS, RELEVANCE_GATE, haversineKm, monthRange, weatherState, type ScoreContext, type WeatherNow } from '../../src/lib/intel/scoring';
import { buildContext, contextTags, weatherKey, tripMoment, climateNote } from '../../src/lib/intel/context';
import { buildDataset } from '../../src/lib/intel/dataset';
import { sanitizeEvent, interestSignals, EVENT_SCHEMA, FORBIDDEN_KEY } from '../../src/lib/intel/analytics';
import type { IntelDataset, IntelEvent, IntelPlace, MuniFeatures, TouristProfile } from '../../src/lib/intel/types';
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

const place = (o: Partial<IntelPlace> = {}): IntelPlace => ({
  id: 'p1', name: 'Cascada de prueba', kind: 'destination', label: 'Cascada', region: 'huasteca', municipality: 'Aquismón', municipality_id: '24003',
  coord: [-99.18, 21.8], coord_confidence: 'verified', interests: ['agua', 'naturaleza'], derived_interests: [], recommended_months: null, season_source: null,
  caution_months: null, caution_note: null, outdoor: true, pueblo_magico: false, priority: 'B', description: 'x', url: null, image: null, official_url: null,
  source_ids: ['brochure-huasteca'], source_confidence: 'verified', evidence: 'alta', route_id: 'p1', ...o,
});
const muni = (o: Partial<MuniFeatures> = {}): MuniFeatures => ({
  id: '24003', name: 'Aquismón', slug: 'aquismon', region: 'huasteca', coord: [-99.02, 21.62], population: 48000,
  counts: { destinations: 5, museums: 0, venues: 4, archaeology: 0, events: 4, lodging: 11, food: 17, protected_areas: 2, flagship: 2, pueblo_magico: 1 },
  assets: 7, asset_share: 0.05, infrastructure_index: 0.5, exposure_proxy: 0.6, diversification_potential: 0.1, coverage_index: 0.83, ...o,
});
const profile = (o: Partial<TouristProfile> = {}): TouristProfile => ({ interests: ['agua'], duration: 'day', mode: 'car', budget: 'medio', ...o });
const ctx = (o: Partial<ScoreContext> = {}): ScoreContext => ({ profile: profile(), month: 1, origin: null, events: [], municipalities: new Map([['24003', muni()]]), ...o });
const factor = (r: ReturnType<typeof scorePlace>, id: string) => r.factors.find((f) => f.id === id)!;

// ---------------------------------------------------------------------- weights --
test('weights add up to 1 and interest is the largest', () => {
  const sum = Object.values(WEIGHTS).reduce((s, w) => s + w, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, String(sum));
  assert.equal(Math.max(...Object.values(WEIGHTS)), WEIGHTS.interest);
});

// --------------------------------------------------------------------- interest --
test('interest: more matches score higher; derived matches count less; no match is 0', () => {
  const one = scorePlace(place(), ctx({ profile: profile({ interests: ['agua', 'arte', 'historia'] }) }));
  const two = scorePlace(place(), ctx({ profile: profile({ interests: ['agua', 'naturaleza', 'historia'] }) }));
  assert.ok(factor(two, 'interest').value! > factor(one, 'interest').value!);
  assert.match(two.reasons[0], /2 de tus intereses: Cascadas y agua y Naturaleza/);
  // one interest chosen, one of the two interests of the place matches: 0.75 × 1 + 0.25 × 0.5
  assert.equal(factor(scorePlace(place(), ctx()), 'interest').value, 0.875);
  assert.equal(factor(scorePlace(place({ interests: ['agua'] }), ctx()), 'interest').value, 1, 'a place wholly about the interest fits best');
  const derived = scorePlace(place({ derived_interests: ['agua'] }), ctx());
  assert.ok(Math.abs(factor(derived, 'interest').value! - 0.7) < 1e-9, '0.75 × 0.8 + 0.25 × 0.4');
  assert.match(derived.reasons[0], /clasificación derivada/);
  const none = scorePlace(place(), ctx({ profile: profile({ interests: ['arte'] }) }));
  assert.equal(factor(none, 'interest').value, 0);
  assert.ok(!none.reasons.some((r) => /Coincide/.test(r)), 'no reason without a match');
});

test('interest: an empty profile gives no interest factor instead of a zero', () => {
  const r = scorePlace(place(), ctx({ profile: profile({ interests: [] }) }));
  assert.equal(factor(r, 'interest').value, null);
  assert.ok(r.score > 0);
});

// ----------------------------------------------------------------------- season --
test('season: in season, out of season, and no statement (never penalised)', () => {
  const p = place({ recommended_months: [11, 12, 1, 2, 3], season_source: 'brochure-huasteca' });
  const inS = scorePlace(p, ctx({ month: 1 })), outS = scorePlace(p, ctx({ month: 7 })), unknown = scorePlace(place(), ctx({ month: 7 }));
  assert.equal(factor(inS, 'season').value, 1);
  assert.ok(inS.reasons.some((r) => /noviembre a marzo/.test(r)));
  assert.equal(factor(outS, 'season').value, 0.3);
  assert.ok(outS.warnings.some((w) => /Fuera de la temporada/.test(w)));
  assert.equal(factor(unknown, 'season').value, null, 'missing season is missing data, not a bad season');
  assert.ok(unknown.score > outS.score, 'a place without season evidence is not treated as out of season');
});

test('season: an official climate caution warns without becoming a recommendation', () => {
  const r = scorePlace(place({ caution_months: [12, 1, 2], caution_note: 'Invierno de frío extremo.' }), ctx({ month: 1 }));
  assert.ok(r.warnings.some((w) => /advierte sobre el clima en enero/.test(w)));
  assert.ok(!r.reasons.some((x) => /Temporada favorable/.test(x)));
});

test('monthRange reads wrapped ranges', () => {
  assert.equal(monthRange([11, 12, 1, 2, 3]), 'noviembre a marzo');
  assert.equal(monthRange([8]), 'agosto');
  assert.equal(monthRange([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), 'todo el año');
  assert.equal(monthRange([3, 4, 9]), 'marzo, abril y septiembre');
});

// ---------------------------------------------------------------------- weather --
const wx = (o: Partial<WeatherNow> = {}): WeatherNow => ({ temp: 24, code: 1, precip: 0, rainProb: 10, ...o });
test('weather: rain lowers outdoor places, not indoor ones; no weather means no factor', () => {
  assert.equal(weatherState(wx()), 'dry');
  assert.equal(weatherState(wx({ precip: 2 })), 'rain');
  assert.equal(weatherState(wx({ rainProb: 80 })), 'rain');
  assert.equal(weatherState(wx({ code: 95 })), 'storm');
  const rain = () => wx({ precip: 3, code: 63 });
  const outdoor = scorePlace(place(), ctx({ weatherOf: rain }));
  assert.equal(factor(outdoor, 'weather').value, 0.4);
  assert.ok(outdoor.warnings.some((w) => /puede afectar esta experiencia/.test(w)));
  const indoor = scorePlace(place({ outdoor: false }), ctx({ weatherOf: rain }));
  assert.equal(factor(indoor, 'weather').value, 0.9);
  assert.ok(indoor.reasons.some((r) => /bajo techo/.test(r)));
  const failed = scorePlace(place(), ctx());
  assert.equal(factor(failed, 'weather').value, null);
  assert.ok(!failed.reasons.concat(failed.warnings).some((t) => /clima actual/i.test(t)), 'no weather sentence without weather data');
  const dry = scorePlace(place(), ctx({ weatherOf: () => wx() }));
  assert.ok(failed.score <= dry.score && failed.score >= outdoor.score, 'a failed request neither rewards nor punishes');
});

// --------------------------------------------------------------------- distance --
test('distance: near beats far for the same trip; no origin and no point give no factor', () => {
  const near = scorePlace(place(), ctx({ origin: [-99.02, 21.99] }));
  const far = scorePlace(place(), ctx({ origin: [-100.97, 22.15] }));
  assert.ok(factor(near, 'distance').value! > factor(far, 'distance').value!);
  assert.ok(near.reasons.some((r) => /km en línea recta/.test(r)), 'distance is labelled straight-line');
  assert.ok(far.distanceKm! > 150);
  const half = scorePlace(place(), ctx({ origin: [-100.97, 22.15], profile: profile({ duration: 'half-day' }) }));
  assert.ok(half.warnings.some((w) => /Queda lejos para medio día/.test(w)));
  assert.equal(factor(scorePlace(place(), ctx()), 'distance').value, null);
  const noPoint = scorePlace(place({ coord: null, coord_confidence: 'unknown' }), ctx({ origin: [-99, 22] }));
  assert.ok(factor(noPoint, 'distance').value !== null, 'the municipal seat tells how far the trip is');
  assert.equal(noPoint.distanceKm, null, 'no distance to the place itself is fabricated');
  assert.ok(noPoint.warnings.some((w) => /Sin punto propio.*cabecera municipal/.test(w)));
  const farNoPoint = scorePlace(place({ coord: null, coord_confidence: 'unknown' }), ctx({ origin: [-100.97, 22.15], profile: profile({ duration: 'half-day' }) }));
  assert.ok(factor(farNoPoint, 'distance').value! < 0.2, 'a place without a point does not jump the queue when it is far');
  const orphan = scorePlace(place({ coord: null, coord_confidence: 'unknown', municipality_id: null }), ctx({ origin: [-99, 22] }));
  assert.equal(factor(orphan, 'distance').value, 0.5, 'no point and no municipality: a neutral value, stated as such');
  assert.ok(orphan.warnings.some((w) => /valor neutro/.test(w)));
  assert.ok(Math.abs(haversineKm([-100.97, 22.15], [-99.02, 21.99]) - 201) < 3);
});

test('distance: a route detour replaces straight-line distance and says how it was obtained', () => {
  const small = scorePlace(place(), ctx({ detourOf: () => ({ offRouteKm: 4, extraMin: 12, measured: false }) }));
  assert.ok(small.reasons.some((r) => /Cerca de tu recorrido: ≈ \+12 min estimados/.test(r)));
  const big = scorePlace(place(), ctx({ detourOf: () => ({ offRouteKm: 30, extraMin: 55, measured: true }) }));
  assert.ok(big.warnings.some((w) => /desvío considerable: ≈ \+55 min por carretera/.test(w)));
  assert.ok(factor(small, 'distance').value! > factor(big, 'distance').value!);
});

// ------------------------------------------------------------- events + support --
const ev = (o: Partial<IntelEvent> = {}): IntelEvent => ({ id: 'e1', name: 'Fiesta patronal', municipality_id: '24003', municipality: 'Aquismón', region: 'huasteca', months: [1], date_status: null, date_confidence: 'pattern', url: null, ...o });
test('events: a bonus for this month and this municipality; the date status is stated; never a penalty', () => {
  const plain = scorePlace(place(), ctx({ origin: [-99.1, 21.9] }));
  const hit = scorePlace(place(), ctx({ origin: [-99.1, 21.9], events: [ev()] }));
  assert.equal(hit.eventBonus, EVENT_BONUS.pattern);
  assert.equal(hit.base, plain.base, 'the event does not enter the weighted mean');
  assert.ok(hit.reasons.some((r) => /Evento en Aquismón en enero: Fiesta patronal \(fecha según patrón oficial/.test(r)));
  assert.equal(scorePlace(place(), ctx({ events: [ev({ months: [6] })] })).event, null);
  assert.equal(scorePlace(place(), ctx({ events: [ev({ municipality_id: '24028' })] })).event, null);
  assert.equal(scorePlace(place(), ctx({ events: [ev({ date_confidence: 'unknown' })] })).event, null, 'an event without a date is not a reason');
  const past = scorePlace(place(), ctx({ origin: [-99.1, 21.9], events: [ev({ date_confidence: 'past' })] }));
  assert.ok(past.reasons.some((r) => /última edición conocida/.test(r)), 'a past edition is never presented as a current date');
  assert.ok(past.score >= plain.score, 'an uncertain event never lowers a place');
  const best = scorePlace(place(), ctx({ events: [ev({ date_confidence: 'past' }), ev({ id: 'e2', name: 'Feria', date_confidence: 'confirmed' })] }));
  assert.equal(best.event!.id, 'e2', 'the most certain date is the one shown');
});

test('events: two unknown or invalid municipal keys never create a local event bonus', () => {
  for (const municipality_id of [null, '', '24000', '24ABC', 'name:Villa de Pozos']) {
    const result = scorePlace(place({ municipality_id }), ctx({ events: [ev({ municipality_id })] }));
    assert.equal(result.event, null, String(municipality_id));
    assert.equal(result.eventBonus, 0, String(municipality_id));
  }
});

test('support: only for overnight trips, and it never claims availability', () => {
  assert.equal(factor(scorePlace(place(), ctx()), 'support').value, null);
  const r = scorePlace(place(), ctx({ profile: profile({ duration: 'weekend' }) }));
  assert.ok(factor(r, 'support').value! > 0);
  assert.ok(r.reasons.some((x) => /no confirma disponibilidad/.test(x)));
  const none = scorePlace(place(), ctx({ profile: profile({ duration: 'weekend' }), municipalities: new Map([['24003', muni({ counts: { ...muni().counts, lodging: 0 }, infrastructure_index: 0.1 })]]) }));
  assert.ok(none.warnings.some((w) => /Sin hospedaje registrado/.test(w)));
});

// ------------------------------------------------------------ score + diversity --
test('score: 0–100, renormalised over the factors with data', () => {
  const r = scorePlace(place(), ctx());
  assert.ok(r.score >= 0 && r.score <= 100);
  // only interest (0.875) and evidence (1) have data: (0.36 × 0.875 + 0.09 × 1) / 0.45
  assert.equal(r.base, 90);
  assert.equal(r.coverage, 0.45);
  const full = scorePlace(place({ recommended_months: [1] }), ctx({ origin: [-99.1, 21.9], weatherOf: () => wx(), events: [ev()], profile: profile({ duration: 'weekend' }) }));
  assert.ok(full.coverage === 1, 'every factor had data');
  assert.equal(full.evidence, 'alta');
  assert.equal(scorePlace(place(), ctx()).evidence, 'media', 'few factors with data lower the evidence of the recommendation');
  assert.equal(scorePlace(place({ evidence: 'baja' }), ctx()).evidence, 'baja');
});

test('diversity: a bonus for relevant places only, capped, never a penalty', () => {
  const quiet = new Map([['24003', muni({ diversification_potential: 0.6, exposure_proxy: 0.2 })]]);
  const base = scorePlace(place(), ctx({ origin: [-99.1, 21.9] }));
  const withBonus = scorePlace(place(), ctx({ origin: [-99.1, 21.9], municipalities: quiet, routeRegions: new Set(['centro']) }));
  assert.ok(withBonus.bonus > 0 && withBonus.bonus <= DIVERSITY_BONUS_MAX);
  assert.equal(withBonus.base, base.base, 'the bonus is added on top, the base is untouched');
  assert.ok(withBonus.reasons.some((r) => /Añade una región distinta a tu viaje: Huasteca/.test(r)));
  assert.ok(withBonus.reasons.some((r) => /no mide afluencia/.test(r)));
  const irrelevant = scorePlace(place(), ctx({ profile: profile({ interests: ['arte'] }), origin: [-100.97, 22.15], municipalities: quiet, routeRegions: new Set(['centro']) }));
  assert.ok(irrelevant.base < RELEVANCE_GATE);
  assert.equal(irrelevant.bonus, 0, 'diversification never rescues an irrelevant place');
  const hub = new Map([['24003', muni({ diversification_potential: 0.6, exposure_proxy: 0.55 })]]);
  assert.ok(!scorePlace(place(), ctx({ origin: [-99.1, 21.9], municipalities: hub })).reasons.some((r) => /poco expuesta/.test(r)), 'a regional hub is not called little exposed');
  // a flagship in the most exposed municipality keeps its full base score
  const exposed = new Map([['24003', muni({ exposure_proxy: 1, diversification_potential: 0 })]]);
  assert.equal(scorePlace(place({ priority: 'A' }), ctx({ origin: [-99.1, 21.9], municipalities: exposed })).base, base.base);
});

test('rank: ordered by score, capped per municipality, exclusions respected', () => {
  const many = Array.from({ length: 6 }, (_, i) => place({ id: `a${i}`, name: `Lugar ${i}`, route_id: `a${i}` }));
  const other = place({ id: 'b1', name: 'Otro', municipality_id: '24037', municipality: 'Tamasopo', route_id: 'b1' });
  const out = rank([...many, other], ctx(), { limit: 10, perMunicipality: 3 });
  assert.equal(out.filter((r) => r.place.municipality_id === '24003').length, 3);
  assert.ok(out.some((r) => r.place.id === 'b1'));
  for (let i = 1; i < out.length; i++) assert.ok(out[i - 1].score >= out[i].score);
  assert.ok(!rank([...many, other], ctx(), { exclude: new Set(['b1']) }).some((r) => r.place.id === 'b1'));
  assert.equal(rank([place({ interests: ['arte'] })], ctx()).length, 0, 'no match with the chosen interests: not suggested');
  assert.equal(rank([place({ interests: ['arte'] })], ctx({ profile: profile({ interests: [] }) })).length, 1);
});

// ---------------------------------------------------------------------- context --
const raw = {
  attractions: attractions.records as unknown as RawEntity[], archaeology: archaeology.records as unknown as RawEntity[], museums: museums.records as unknown as RawEntity[],
  venues: venues.records as unknown as RawEntity[], recreation: recreation.records as unknown as RawEntity[], events: events.records as unknown as RawEntity[],
  municipalities: municipalities.records as never, seasonRecords: seasonal.records as never, priorities: destIndex.destinations,
};
const built = buildDataset(raw);
const dataset: IntelDataset = { generated: 'test', ...built, places: built.places.map((p) => ({ ...p, route_id: p.id })), climate: { huasteca: Array.from({ length: 12 }, () => ({ rain_days: 21, tmax: 31, tmin: 23 })) }, sources: {} };

test('context: weather key, moment, climate note', () => {
  assert.equal(weatherKey({ municipality: 'Catorce', region: 'altiplano' }), 'real-de-catorce');
  assert.equal(weatherKey({ municipality: 'Rioverde', region: 'zona-media' }), 'zona-media');
  const m = tripMoment(new Date(2026, 0, 15, 9));
  assert.deepEqual([m.month, m.monthName, m.season, m.partOfDay], [1, 'enero', 'invierno', 'mañana']);
  assert.match(climateNote(dataset, 'huasteca', 9)!, /21 días con lluvia.*no es un pronóstico/);
  assert.equal(climateNote(dataset, 'centro', 9), null, 'no climate data for the region: no sentence');
});

test('integration: profile → recommendation on the real data', () => {
  const c = buildContext({ dataset, profile: profile({ interests: ['agua', 'aventura'], duration: 'weekend' }), now: new Date(2026, 0, 15), origin: [-99.0156, 21.9853] /* Ciudad Valles */ });
  const recs = rank(dataset.places, c, { limit: 8 });
  assert.equal(recs.length, 8);
  for (const r of recs) {
    assert.ok(r.matched.length > 0);
    assert.ok(r.reasons.length > 0, `${r.place.name} explains itself`);
    assert.ok(r.score >= 0 && r.score <= 100);
  }
  assert.ok(recs.some((r) => r.place.id === 'H01'), 'Tamul is in season in January and near Ciudad Valles');
  const tamul = recs.find((r) => r.place.id === 'H01')!;
  assert.ok(tamul.reasons.some((x) => /Temporada favorable/.test(x)));
  assert.ok(contextTags(tamul).includes('Buena opción para esta temporada'));
  assert.ok(recs.every((r) => r.place.region === 'huasteca' || r.distanceKm! < 330), 'the list stays within reach of the origin');
});

test('integration: location → recommendation, and the same profile without a location', () => {
  const p = profile({ interests: ['historia', 'arte'], duration: 'half-day' });
  const here = rank(dataset.places, buildContext({ dataset, profile: p, origin: [-100.9769, 22.1517], now: new Date(2026, 5, 10) }), { limit: 6 });
  assert.ok(here.every((r) => r.distanceKm !== null && r.distanceKm < 100), 'half a day from the capital stays within reach of the capital');
  const nowhere = rank(dataset.places, buildContext({ dataset, profile: p, origin: null, now: new Date(2026, 5, 10) }), { limit: 6 });
  assert.equal(nowhere.length, 6, 'denied or missing location still yields recommendations');
  assert.ok(nowhere.every((r) => r.distanceKm === null && !r.reasons.some((x) => /km/.test(x))), 'and none of them mentions a distance');
});

test('integration: incomplete records and a context with nothing in it', () => {
  const bare = place({ id: 'bare', region: null, municipality: null, municipality_id: null, coord: null, coord_confidence: 'unknown', description: null, source_ids: [], evidence: 'baja', outdoor: null });
  const c = buildContext({ dataset: { ...dataset, places: [bare], events: [], municipalities: [] }, profile: profile(), weather: null, origin: null });
  const [r] = rank([bare], c);
  assert.ok(Number.isFinite(r.score));
  assert.equal(r.evidence, 'baja');
  assert.ok(r.warnings.some((w) => /Información limitada/.test(w)));
});

test('integration: route already saved gives the diversity context', () => {
  const c = buildContext({ dataset, profile: profile({ interests: ['historia'] }), routeIds: ['A01'], origin: [-100.9769, 22.1517] });
  assert.deepEqual([...c.routeRegions!], ['altiplano']);
  const recs = rank(dataset.places, c, { limit: 12, exclude: new Set(['A01']) });
  assert.ok(!recs.some((r) => r.place.id === 'A01'), 'a saved place is not suggested again');
  assert.ok(recs.some((r) => r.reasons.some((x) => /Añade una región distinta/.test(x))));
});

// -------------------------------------------------------------------- analytics --
test('analytics: only whitelisted, non-personal properties survive', () => {
  const e = sanitizeEvent('recommendation_added', { place_id: 'H01', surface: 'descubre', score: 88.6, rank: 2, latitude: 21.8, lon: -99.1, email: 'a@b.c', anything: 'x' }, 1_700_000_123_456)!;
  assert.deepEqual(e.props, { place_id: 'H01', surface: 'descubre', score: 89, rank: 2 });
  assert.equal(e.t % 60000, 0, 'minute resolution');
  assert.equal(sanitizeEvent('made_up_event', {}), null);
  assert.deepEqual(sanitizeEvent('destination_added', { place_id: '<script>', source: 'mapa' })!.props, { source: 'mapa' });
  for (const [name, props] of Object.entries(EVENT_SCHEMA)) for (const k of Object.keys(props)) assert.ok(!FORBIDDEN_KEY.test(k), `${name}.${k} is not a personal or position key`);
  for (const k of ['precise_latitude', 'precise_longitude', 'gps_history', 'user_id', 'email', 'phone', 'device_id', 'coords']) assert.ok(FORBIDDEN_KEY.test(k), k);
});

test('analytics: behaviour turns into interest signals', () => {
  const log = [sanitizeEvent('category_selected', { interest: 'agua', selected: true })!, sanitizeEvent('category_selected', { interest: 'arte', selected: false })!, sanitizeEvent('destination_added', { place_id: 'H01', source: 'mapa' })!];
  const s = interestSignals(log, (id) => (id === 'H01' ? ['agua', 'aventura'] : []));
  assert.deepEqual(s, { agua: 3, aventura: 2 });
});

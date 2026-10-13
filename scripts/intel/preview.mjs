// Prints sample rankings for a few visitor profiles, to inspect how the
// recommender behaves on the real data (a reading aid, not a test).
//   node scripts/intel/preview.mjs
import { loadIntel, rawSets } from './load-lib.mjs';

const intel = await loadIntel('scripts/intel/preview-entry.ts');
const built = intel.buildDataset(rawSets());
const dataset = { generated: 'preview', ...built, climate: {}, sources: {} };
const SLP = [-100.9769, 22.1517], VALLES = [-99.0156, 21.9853];

function show(label, profile, origin, month, routeIds = []) {
  const ctx = intel.buildContext({ dataset, profile: { mode: 'car', budget: 'medio', ...profile }, origin, now: new Date(2026, month - 1, 10), routeIds });
  const recs = intel.rank(dataset.places, ctx, { limit: 8, exclude: new Set(routeIds) });
  console.log(`\n${label}`);
  for (const r of recs) {
    console.log(String(r.score).padStart(3), String(r.base).padStart(5), `+${r.bonus}`, r.evidence.padEnd(5), r.place.id.padEnd(16), r.place.name.slice(0, 36).padEnd(36), '|', (r.place.municipality ?? '-').slice(0, 16).padEnd(16), '|',
      (r.distanceKm?.toFixed(0) ?? '-').padStart(4), '|', r.factors.map((f) => `${f.id.slice(0, 3)}:${f.value === null ? ' · ' : f.value.toFixed(2)}`).join(' '));
  }
}
show('historia + arte · medio día · desde la capital · junio', { interests: ['historia', 'arte'], duration: 'half-day' }, SLP, 6);
show('agua + aventura · fin de semana · desde Ciudad Valles · enero', { interests: ['agua', 'aventura'], duration: 'weekend' }, VALLES, 1);
show('naturaleza · 1 día · sin origen · octubre', { interests: ['naturaleza'], duration: 'day' }, null, 10);
show('pueblos mágicos + gastronomía + cultura · 3 a 5 días · desde la capital · octubre · con Real de Catorce guardado', { interests: ['pueblos-magicos', 'gastronomia', 'cultura'], duration: 'long' }, SLP, 10, ['A01']);

// ---- redistribution: alternatives for a few anchors --------------------------------------
const munis = new Map(dataset.municipalities.map((m) => [m.id, m]));
for (const id of (process.argv[2] ?? 'A01,H01,H07,C01,H08').split(',')) {
  const a = dataset.places.find((p) => p.id === id);
  const alts = intel.alternativesFor(a, dataset.places, { month: 1, mode: 'car', municipalities: munis });
  console.log(`\nAlternativas para ${a.name} [${a.interests.join(', ')}] (exposición ${munis.get(a.municipality_id)?.exposure_proxy})`);
  for (const x of alts.slice(0, 6)) console.log(String(x.score).padStart(3), x.place.id.padEnd(16), x.place.name.slice(0, 34).padEnd(34), '|', (x.place.municipality ?? '').padEnd(18), `${Math.round(x.km)} km`.padStart(7), 'exp', x.exposure.candidate.toFixed(2), '| comparte', x.shared.join(', '));
  if (!alts.length) {
    const near = dataset.places.filter((p) => p.coord && p.municipality_id !== a.municipality_id && intel.haversineKm(a.coord, p.coord) <= 110).map((p) => ({ p, s: intel.similarity(a, p), m: munis.get(p.municipality_id) }));
    for (const x of near.sort((u, v) => v.s.value - u.s.value).slice(0, 10)) console.log('  cand', x.p.id.padEnd(14), x.p.name.slice(0, 30).padEnd(30), 'sim', x.s.value.toFixed(2), 'exp', x.m?.exposure_proxy, 'infra', x.m?.infrastructure_index, x.p.evidence, '[' + x.p.interests.join(',') + ']');
  }
}

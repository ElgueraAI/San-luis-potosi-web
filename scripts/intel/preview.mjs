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

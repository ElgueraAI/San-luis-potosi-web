/**
 * Simulated scenario for the academic dashboard.
 *
 * "Datos simulados para demostración académica": the recommender is run for
 * SYNTHETIC profiles (the eight segments × four starting cities × four
 * months), with no visitor involved, to show how the engines change WHERE the
 * suggestions point. It measures suggestions, not trips, visits or demand,
 * and it is never mixed with observed data.
 */
import { buildContext } from './context';
import { diversifyTrip } from './diversify';
import { LOW_EXPOSURE, rank } from './scoring';
import { SEGMENTS } from './segments';
import type { Coord, Duration, IntelDataset, ProfileInterest, TouristProfile } from './types';

export const SCENARIO_LABEL = 'Datos simulados para demostración académica';
export const SCENARIO_MONTHS = [1, 4, 7, 10];
export const SCENARIO_ORIGINS = ['San Luis Potosí', 'Matehuala', 'Rioverde', 'Ciudad Valles'];
const LIST = 9;

export interface ScenarioStep {
  id: 'relevance' | 'bonus' | 'alternatives';
  label: string;
  suggestions: number;
  /** share of suggestions in municipalities with exposure proxy < LOW_EXPOSURE (0–1) */
  lowExposureShare: number;
  /** distinct municipalities suggested across all runs */
  municipalities: number;
  /** share of suggestions held by the five most suggested municipalities (0–1) */
  top5Share: number;
  /** mean base score of the list (relevance), 0–100 */
  meanRelevance: number;
}
export interface ScenarioResult { runs: number; steps: ScenarioStep[] }

export function runScenario(dataset: IntelDataset): ScenarioResult {
  const munis = new Map(dataset.municipalities.map((m) => [m.id, m]));
  const origins = SCENARIO_ORIGINS.map((n) => dataset.municipalities.find((m) => m.name === n)?.coord).filter((c): c is Coord => !!c);
  const acc = { relevance: [] as { muni: string; base: number }[], bonus: [] as { muni: string; base: number }[], alternatives: [] as { muni: string; base: number }[] };
  let runs = 0;
  for (const s of SEGMENTS) {
    const interests = (Object.entries(s.weights) as [ProfileInterest, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([i]) => i);
    const duration: Duration = s.durations ? 'weekend' : 'two-days';
    const profile: TouristProfile = { interests, duration, mode: 'car', budget: 'medio' };
    for (const origin of origins) for (const month of SCENARIO_MONTHS) {
      runs++;
      const now = new Date(2026, month - 1, 15);
      const plain = rank(dataset.places, { ...buildContext({ dataset, profile, origin, now }), disableBonuses: true }, { limit: LIST });
      const ctx = buildContext({ dataset, profile, origin, now });
      const withBonus = rank(dataset.places, ctx, { limit: LIST });
      const alts = diversifyTrip(withBonus.slice(0, 5).map((r) => r.place), dataset.places, {
        month, mode: 'car', municipalities: munis, exclude: new Set(withBonus.map((r) => r.place.id)), interests,
      }, 3);
      const row = (r: { place: { municipality_id: string | null }; base: number }) => ({ muni: r.place.municipality_id ?? '', base: r.base });
      acc.relevance.push(...plain.map(row));
      acc.bonus.push(...withBonus.map(row));
      acc.alternatives.push(...withBonus.map(row), ...alts.map((a) => ({ muni: a.place.municipality_id ?? '', base: NaN })));
    }
  }
  const summarize = (id: ScenarioStep['id'], label: string, rows: { muni: string; base: number }[]): ScenarioStep => {
    const counts = new Map<string, number>();
    for (const r of rows) if (r.muni) counts.set(r.muni, (counts.get(r.muni) ?? 0) + 1);
    const low = rows.filter((r) => (munis.get(r.muni)?.exposure_proxy ?? 1) < LOW_EXPOSURE).length;
    const bases = rows.map((r) => r.base).filter((b) => Number.isFinite(b));
    const round = (v: number) => Math.round(v * 1000) / 1000;
    return {
      id, label, suggestions: rows.length,
      lowExposureShare: rows.length ? round(low / rows.length) : 0,
      municipalities: counts.size,
      top5Share: rows.length ? round([...counts.values()].sort((a, b) => b - a).slice(0, 5).reduce((s, v) => s + v, 0) / rows.length) : 0,
      meanRelevance: bases.length ? Math.round((bases.reduce((s, b) => s + b, 0) / bases.length) * 10) / 10 : 0,
    };
  };
  return {
    runs,
    steps: [
      summarize('relevance', 'Solo relevancia', acc.relevance),
      summarize('bonus', 'Con bonos de evento y diversificación', acc.bonus),
      summarize('alternatives', 'Con bonos y alternativas de redistribución', acc.alternatives),
    ],
  };
}

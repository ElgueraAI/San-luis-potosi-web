/**
 * Privacy-respecting product events: the schema and the sanitizer.
 *
 * An event is a name plus a few whitelisted, non-personal properties (place
 * ids, interest ids, region ids, counts, rounded scores). The sanitizer drops
 * everything else, and refuses outright any key that could carry a position
 * or an identity, whatever the caller passes.
 *
 * This version has no backend: src/scripts/intel/analytics.ts keeps the events
 * in this browser only, for the visitor to inspect, export or delete.
 * Schema and future adapters: docs/analytics-event-schema.md.
 */
import type { ProfileInterest } from './types';

type PropType = 'id' | 'ids' | 'int' | 'bool' | 'enum';
export const EVENT_SCHEMA = {
  destination_view: { place_id: 'id', region: 'enum', kind: 'enum' },
  destination_added: { place_id: 'id', source: 'enum' },
  destination_removed: { place_id: 'id' },
  route_generated: { stops: 'int', mode: 'enum', provider: 'enum', from_cache: 'bool' },
  route_optimized: { stops: 'int', applied: 'bool', saved_min: 'int', saved_km: 'int' },
  recommendation_seen: { place_ids: 'ids', surface: 'enum', top_score: 'int' },
  recommendation_added: { place_id: 'id', surface: 'enum', score: 'int', rank: 'int' },
  alternative_seen: { anchor_id: 'id', place_ids: 'ids' },
  category_selected: { interest: 'enum', selected: 'bool' },
  region_selected: { region: 'enum' },
  event_viewed: { event_id: 'id', region: 'enum' },
  profile_updated: { interests: 'int', duration: 'enum', mode: 'enum', budget: 'enum' },
} as const satisfies Record<string, Record<string, PropType>>;

export type EventName = keyof typeof EVENT_SCHEMA;
export type EventProps = Record<string, string | number | boolean | string[]>;
export interface ProductEvent { name: EventName; t: number; props: EventProps }

/** Keys that are never accepted, even if a schema were edited to include them. */
export const FORBIDDEN_KEY = /lat|lon|lng|coord|gps|geo|position|accuracy|altitude|heading|speed|email|mail|phone|tel|name|address|ip$|user|device|session|token|uuid|fingerprint/i;
const ID = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,63}$/;

export function sanitizeEvent(name: string, props: Record<string, unknown> = {}, now = Date.now()): ProductEvent | null {
  const schema = (EVENT_SCHEMA as Record<string, Record<string, PropType>>)[name];
  if (!schema) return null;
  const out: EventProps = {};
  for (const [k, type] of Object.entries(schema)) {
    if (FORBIDDEN_KEY.test(k)) continue;
    const v = props[k];
    if (v === undefined || v === null) continue;
    if (type === 'bool' && typeof v === 'boolean') out[k] = v;
    else if (type === 'int' && typeof v === 'number' && Number.isFinite(v)) out[k] = Math.round(v);
    else if ((type === 'id' || type === 'enum') && typeof v === 'string' && ID.test(v)) out[k] = v;
    else if (type === 'ids' && Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === 'string' && ID.test(x)).slice(0, 20);
  }
  // minute resolution: enough to order a session, useless for tracking a person
  return { name: name as EventName, t: Math.floor(now / 60000) * 60000, props: out };
}

/** How often each interest was chosen or acted on in the session log (behavioural signal for segments). */
export function interestSignals(events: ProductEvent[], interestsOfPlace: (id: string) => ProfileInterest[]): Partial<Record<ProfileInterest, number>> {
  const out: Partial<Record<ProfileInterest, number>> = {};
  const add = (i: ProfileInterest, w: number) => { out[i] = (out[i] ?? 0) + w; };
  for (const e of events) {
    if (e.name === 'category_selected' && e.props.selected === true && typeof e.props.interest === 'string') add(e.props.interest as ProfileInterest, 1);
    if ((e.name === 'destination_added' || e.name === 'recommendation_added') && typeof e.props.place_id === 'string') for (const i of interestsOfPlace(e.props.place_id)) add(i, 2);
    if (e.name === 'destination_view' && typeof e.props.place_id === 'string') for (const i of interestsOfPlace(e.props.place_id)) add(i, 0.5);
  }
  return out;
}

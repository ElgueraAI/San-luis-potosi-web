/**
 * Visitor profile for the recommender, kept in localStorage (no account).
 * Only four non-sensitive preferences are stored: interests, available time,
 * travel mode and budget. No name, contact, age or location. `clear()`
 * removes it; the page offers that as «Borrar mis preferencias».
 */
import { BUDGETS, DURATIONS, INTERESTS, MODES } from '@/lib/intel/taxonomy';
import type { TouristProfile } from '@/lib/intel/types';

const KEY = 'slp:perfil:v1';
export const DEFAULT_PROFILE: TouristProfile = { interests: [], duration: 'day', mode: 'car', budget: 'medio' };

/** Keeps only known values (anything else that may be in storage is dropped). */
export function sanitizeProfile(v: unknown): TouristProfile {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<TouristProfile>;
  return {
    interests: Array.isArray(o.interests) ? INTERESTS.filter((i) => (o.interests as string[]).includes(i)) : [],
    duration: DURATIONS.some((d) => d.id === o.duration) ? o.duration! : DEFAULT_PROFILE.duration,
    mode: MODES.some((m) => m.id === o.mode) ? o.mode! : DEFAULT_PROFILE.mode,
    budget: BUDGETS.some((b) => b.id === o.budget) ? o.budget! : DEFAULT_PROFILE.budget,
  };
}

type Listener = (p: TouristProfile) => void;
const listeners = new Set<Listener>();
function read(): TouristProfile {
  try { return sanitizeProfile(JSON.parse(localStorage.getItem(KEY) ?? 'null')); } catch { return { ...DEFAULT_PROFILE }; }
}
let memory = typeof localStorage !== 'undefined' ? read() : { ...DEFAULT_PROFILE };

export const profileStore = {
  get: (): TouristProfile => ({ ...memory, interests: [...memory.interests] }),
  /** true when the visitor has saved a profile at some point. */
  exists: (): boolean => { try { return localStorage.getItem(KEY) !== null; } catch { return false; } },
  set(patch: Partial<TouristProfile>) {
    memory = sanitizeProfile({ ...memory, ...patch });
    try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* private mode: memory only */ }
    listeners.forEach((l) => l(memory));
  },
  clear() {
    memory = { ...DEFAULT_PROFILE };
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    listeners.forEach((l) => l(memory));
  },
  subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },
};

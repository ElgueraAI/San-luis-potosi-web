/**
 * Visited stops of the current trip, kept in localStorage so a refresh does
 * not lose them. Only tourism route state is stored:
 *   { id, startedAt, stops: { [placeId]: { visited: true, visitedAt } } }
 * Never a latitude, longitude, trace, speed or heading: the visitor's
 * position stays in memory (location-service.ts).
 */
const KEY = 'slp:mi-ruta:trip:v1';

export interface TripRecord {
  id: string;
  startedAt: number;
  stops: Record<string, { visited: true; visitedAt: number }>;
}

type Listener = (t: TripRecord | null) => void;
const listeners = new Set<Listener>();

/** Keeps only the allowed shape (drops anything else that may be in storage). */
export function sanitize(v: unknown): TripRecord | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Partial<TripRecord>;
  if (typeof o.id !== 'string' || typeof o.startedAt !== 'number' || !o.stops || typeof o.stops !== 'object') return null;
  const stops: TripRecord['stops'] = {};
  for (const [id, s] of Object.entries(o.stops)) {
    if (typeof id === 'string' && s && s.visited === true && typeof s.visitedAt === 'number') stops[id] = { visited: true, visitedAt: s.visitedAt };
  }
  return { id: o.id, startedAt: o.startedAt, stops };
}

function read(): TripRecord | null {
  try { return sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null')); } catch { return null; }
}

let memory: TripRecord | null = typeof localStorage !== 'undefined' ? read() : null;

function write(t: TripRecord | null) {
  memory = t;
  try { t ? localStorage.setItem(KEY, JSON.stringify(t)) : localStorage.removeItem(KEY); } catch { /* private mode: memory only */ }
  listeners.forEach((l) => l(t));
}

export const tripStore = {
  get: (): TripRecord | null => memory,
  visitedIds: (): string[] => Object.keys(memory?.stops ?? {}),
  isVisited: (id: string) => !!memory?.stops[id],
  markVisited(id: string, now = Date.now()) {
    const t = memory ?? { id: `trip-${now.toString(36)}`, startedAt: now, stops: {} };
    write({ ...t, stops: { ...t.stops, [id]: { visited: true, visitedAt: now } } });
  },
  /** «Restablecer recorrido». */
  reset() { write(null); },
  subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },
};

if (typeof addEventListener === 'function') {
  addEventListener('storage', (e) => { if (e.key === KEY) { memory = read(); listeners.forEach((l) => l(memory)); } });
}

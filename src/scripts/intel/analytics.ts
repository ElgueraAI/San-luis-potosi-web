/**
 * Local event log. Events stay in this browser (localStorage), capped, and are
 * never sent anywhere: this version has no backend. `adapters` is the single
 * extension point for a future, consented collector.
 */
import { sanitizeEvent, type EventName, type ProductEvent } from '@/lib/intel/analytics';

const KEY = 'slp:analitica:v1';
const MAX = 300;
type Adapter = (e: ProductEvent) => void;
/** Empty on purpose. A future adapter must arrive together with an explicit consent control. */
export const adapters: Adapter[] = [];

function read(): ProductEvent[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

export function track(name: EventName, props: Record<string, unknown> = {}): void {
  const e = sanitizeEvent(name, props);
  if (!e) return;
  try { localStorage.setItem(KEY, JSON.stringify([...read(), e].slice(-MAX))); } catch { /* private mode: nothing is kept */ }
  adapters.forEach((a) => { try { a(e); } catch { /* an adapter never breaks the page */ } });
}

export const analyticsLog = {
  all: read,
  clear() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
  /** Voluntary export of the demo log as a JSON file; `extra` adds derived, non-personal summaries. */
  export(extra: Record<string, unknown> = {}) {
    const body = { note: 'Registro local de demostración. No contiene ubicación ni datos personales.', ...extra, events: read() };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' }));
    a.download = 'slp-registro-local.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
};

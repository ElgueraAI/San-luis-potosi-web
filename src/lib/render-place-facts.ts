import type { PlaceFacts, PlaceFact, FactIcon } from './place-facts';
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const paths: Record<FactIcon, string> = {
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',
  landmark: '<path d="m3 8 9-5 9 5M3 9h18M5 10v8m5-8v8m4-8v8m5-8v8M2 21h20M3 18h18"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 11h18m-13 4h2m4 0h2"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  route: '<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h9a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h9"/>',
  ticket: '<path d="M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4Z"/><path d="M15 5v3m0 3v2m0 3v3"/>',
  camera: '<path d="M4 6h4l2-3h4l2 3h4v15H4Z"/><circle cx="12" cy="13" r="4"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10v1"/>',
};
function refs(f: PlaceFact): string {
  return f.sources.map((s) => `<span>${s.url && /^https?:\/\//i.test(s.url) ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>` : esc(s.label)}${s.date ? ` · fecha documentada: ${esc(s.date)}` : ''}</span>`).join('');
}
function item(f: PlaceFact): string {
  return `<div class="pf__item"><dt><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${paths[f.icon]}</svg><span>${esc(f.label)}</span></dt><dd><p class="pf__value">${f.valueHref ? `<a href="${esc(f.valueHref)}">${esc(f.value)}</a>` : esc(f.value)}</p><span class="pf__state">[${f.state}]</span>${f.note ? `<p class="pf__note">${esc(f.note)}</p>` : ''}<span class="pf__sources">${refs(f) || 'Procedencia de campo no resuelta.'}</span></dd></div>`;
}
export function renderPlaceFacts(model: PlaceFacts, compact = false): string {
  const initial = model.fields.slice(0, 4);
  const rest = model.fields.slice(4);
  const body = `<dl class="pf__grid">${initial.map(item).join('')}</dl><details class="pf__more"><summary>Ver información completa<span aria-hidden="true"> +</span></summary><div class="pf__expanded">${rest.length ? `<dl class="pf__grid">${rest.map(item).join('')}</dl>` : ''}<div class="pf__provenance"><h4>Fuentes y alcance documental</h4>${model.sources.length ? `<ul>${model.sources.map((s) => `<li>${s.url && /^https?:\/\//i.test(s.url) ? `<a href="${esc(s.url)}" rel="noopener" target="_blank">${esc(s.label)}</a>` : esc(s.label)} <span class="pf__source-id">(${esc(s.id)})</span>${s.date ? ` · fecha documentada: ${esc(s.date)}` : ''}</li>`).join('')}</ul>` : '<p>[NO DISPONIBLE] No hay fuentes registradas.</p>'}${model.limits.map((l) => `<p class="pf__note">${esc(l)}</p>`).join('')}<p class="pf__note">[OBSERVADO] indica evidencia documental del campo y su fecha, sin garantía de vigencia. [DERIVADO] identifica presentación editorial. [PENDIENTE DE VERIFICACIÓN] requiere cotejo por campo.</p></div></div></details>`;
  return `<section class="pf${compact ? ' pf--compact' : ''}" aria-label="Información del lugar: ${esc(model.name)}" data-place-facts="${esc(model.id)}"><h3 class="pf__title">Información del lugar</h3>${body}</section>`;
}

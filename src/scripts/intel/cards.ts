/**
 * Recommendation cards, shared by /descubre/ and Mi Ruta. A card always shows
 * the score, the reasons the data supports, the warnings, the evidence level
 * and the sources; «Cómo se calculó» lists every factor with its weight,
 * including the ones that had no data. All text is escaped.
 */
import { contextTags } from '@/lib/intel/context';
import { FACTOR_LABEL, type Recommendation } from '@/lib/intel/scoring';
import { REGION_LABEL } from '@/lib/intel/taxonomy';
import type { IntelDataset, IntelPlace } from '@/lib/intel/types';

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const EVIDENCE_TEXT = { alta: 'Evidencia alta', media: 'Evidencia media', baja: 'Evidencia baja' } as const;
const EVIDENCE_HELP = {
  alta: 'Fuente oficial verificada, punto confiable y la mayoría de los factores con datos.',
  media: 'Fuente oficial, pero con ubicación aproximada o con varios factores sin datos.',
  baja: 'Registro sin verificación directa o con poca información: confirma antes de ir.',
} as const;

export function kicker(p: IntelPlace): string {
  return [p.label, p.municipality, p.region ? REGION_LABEL[p.region] : null].filter(Boolean).map((x) => esc(x as string)).join(' · ');
}

export function sourcesLine(p: IntelPlace, ds: Pick<IntelDataset, 'sources'>): string {
  const seen = new Set<string>();
  const items = [...p.source_ids, ...(p.season_source ? [p.season_source] : [])]
    .map((id) => ds.sources[id]).filter((s): s is { name: string; url: string | null } => !!s && !!s.name)
    .filter((s) => (seen.has(s.name) ? false : (seen.add(s.name), true)))
    .slice(0, 3)
    .map((s) => (s.url && /^https?:/i.test(s.url) ? `<a href="${esc(s.url)}" rel="noopener" target="_blank">${esc(s.name)}</a>` : esc(s.name)));
  return items.length ? items.join(' · ') : 'Sin fuente registrada';
}

export function routeButton(p: IntelPlace, extra = ''): string {
  if (!p.route_id) return '<p class="rk__noadd tiny muted">No puede añadirse a Mi Ruta: no tiene punto en el mapa del portal.</p>';
  return `<button type="button" class="rbtn rbtn--quiet" data-route-add="${esc(p.route_id)}" data-route-name="${esc(p.name)}" aria-pressed="false" ${extra}><span class="rbtn__icon" aria-hidden="true"></span><span data-route-label>Añadir a Mi Ruta</span></button>`;
}

function factorRows(r: Recommendation): string {
  return r.factors.map((f) => {
    const pct = f.value === null ? null : Math.round(f.value * 100);
    return `<tr><th scope="row">${FACTOR_LABEL[f.id]}</th><td>${Math.round(f.weight * 100)} %</td><td>${pct === null ? '<span class="muted">sin datos: no cuenta</span>' : `<span class="rk__bar" aria-hidden="true"><i style="width:${pct}%"></i></span>${pct} / 100`}</td></tr>`;
  }).join('');
}

export interface CardOptions { rank?: number; surface: string; compact?: boolean; lead?: string }

export function recommendationCard(r: Recommendation, ds: Pick<IntelDataset, 'sources'>, opt: CardOptions): string {
  const p = r.place;
  const title = p.url ? `<a href="${esc(p.url)}">${esc(p.name)}</a>` : esc(p.name);
  const tags = contextTags(r);
  const media = opt.compact ? '' : p.image
    ? `<img class="rk__img" src="${esc(p.image)}" alt="" width="640" height="480" loading="lazy" decoding="async">`
    : `<span class="rk__ph" aria-hidden="true"><span>${esc(p.label)}</span></span>`;
  return `<li class="rk${opt.compact ? ' rk--compact' : ''}" data-region="${p.region ?? ''}" data-reco="${esc(p.id)}" data-score="${r.score}" data-rank="${opt.rank ?? 0}" data-surface="${esc(opt.surface)}">
    ${media}
    <div class="rk__body">
      <p class="rk__kicker">${kicker(p)}</p>
      <h3 class="rk__title">${title}</h3>
      ${opt.lead ? `<p class="rk__lead">${esc(opt.lead)}</p>` : ''}
      ${!opt.compact && p.description ? `<p class="rk__desc">${esc(p.description)}</p>` : ''}
      ${tags.length ? `<ul class="rk__tags" aria-label="Contexto">${tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      ${r.reasons.length ? `<p class="rk__why">Por qué te lo recomendamos</p><ul class="rk__reasons">${r.reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${r.warnings.length ? `<ul class="rk__warn" aria-label="Ten en cuenta">${r.warnings.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <details class="rk__how">
        <summary>Cómo se calculó</summary>
        <table><thead><tr><th scope="col">Factor</th><th scope="col">Peso</th><th scope="col">Valor</th></tr></thead><tbody>${factorRows(r)}</tbody></table>
        <p class="tiny muted">Puntaje base ${r.base.toLocaleString('es-MX')} sobre los factores con datos (${Math.round(r.coverage * 100)} % del peso total)${r.eventBonus > 0 ? `, más ${r.eventBonus.toLocaleString('es-MX')} por un evento del mes` : ''}${r.bonus > 0 ? `, más ${r.bonus.toLocaleString('es-MX')} por diversificación` : ''}. ${EVIDENCE_HELP[r.evidence]}</p>
        <p class="tiny muted">Fuentes: ${sourcesLine(p, ds)}</p>
      </details>
    </div>
    <div class="rk__side">
      <p class="rk__score" aria-label="Puntaje ${r.score} de 100"><b>${r.score}</b><span aria-hidden="true">/ 100</span></p>
      <p class="rk__ev" data-evidence="${r.evidence}">${EVIDENCE_TEXT[r.evidence]}</p>
      ${routeButton(p)}
    </div>
  </li>`;
}

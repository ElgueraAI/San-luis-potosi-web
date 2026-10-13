/**
 * «Alternativas para descubrir»: cards for the redistribution engine
 * (src/lib/intel/diversify.ts). Each card names the place it is an alternative
 * to, what they share, what it costs to add, and the exposure proxy behind
 * it, always labelled as a proxy.
 */
import { DOS_LABEL, type Alternative } from '@/lib/intel/diversify';
import type { IntelDataset } from '@/lib/intel/types';
import { esc, kicker, routeButton, sourcesLine } from './cards';

export function alternativeCard(a: Alternative, ds: Pick<IntelDataset, 'sources'>, surface: string, rank: number): string {
  const p = a.place;
  const title = p.url ? `<a href="${esc(p.url)}">${esc(p.name)}</a>` : esc(p.name);
  const rows = a.components.map((c) => `<tr><th scope="row">${DOS_LABEL[c.id]}</th><td>${Math.round(c.weight * 100)} %</td><td>${c.value === null ? '<span class="muted">sin datos: no cuenta</span>' : `<span class="rk__bar" aria-hidden="true"><i style="width:${Math.round(c.value * 100)}%"></i></span>${Math.round(c.value * 100)} / 100`}</td></tr>`).join('');
  return `<li class="rk rk--compact" data-region="${p.region ?? ''}" data-reco="${esc(p.id)}" data-anchor="${esc(a.anchor.id)}" data-score="${a.score}" data-rank="${rank}" data-surface="${esc(surface)}">
    <div class="rk__body">
      <p class="rk__kicker">${kicker(p)}</p>
      <h3 class="rk__title">${title}</h3>
      <p class="rk__lead">${esc(a.sentence)}</p>
      <p class="rk__why">Por qué es una buena alternativa</p>
      <ul class="rk__reasons">${a.reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <details class="rk__how">
        <summary>Cómo se calculó</summary>
        <table><thead><tr><th scope="col">Componente</th><th scope="col">Peso</th><th scope="col">Valor</th></tr></thead><tbody>${rows}</tbody></table>
        <p class="tiny muted">Oportunidad de diversificación: promedio ponderado de los componentes con datos. La exposición es un proxy construido con registros de hospedaje, destinos emblemáticos y Pueblos Mágicos; el portal no tiene datos de afluencia ni de ocupación.</p>
        <p class="tiny muted">Fuentes: ${sourcesLine(p, ds)}</p>
      </details>
    </div>
    <div class="rk__side">
      <p class="rk__score" aria-label="Oportunidad de diversificación ${a.score} de 100"><b>${a.score}</b><span aria-hidden="true">/ 100</span></p>
      <p class="rk__ev" data-evidence="${p.evidence}">Evidencia ${p.evidence}</p>
      ${routeButton(p)}
    </div>
  </li>`;
}

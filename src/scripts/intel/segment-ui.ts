/**
 * «Tu segmento en esta sesión»: assigns the current browser session to an
 * interpretable segment (src/lib/intel/segments.ts) from the saved profile,
 * the places in Mi Ruta and the local event log. Computed here, in the
 * browser; nothing is sent anywhere.
 */
import { route } from '../route-store';
import { loadIntel } from './data';
import { profileStore } from './profile-store';
import { analyticsLog } from './analytics';
import { esc } from './cards';
import { interestSignals } from '@/lib/intel/analytics';
import { segmentFor, sessionFeatures, MIN_AFFINITY } from '@/lib/intel/segments';
import { INTEREST_LABEL } from '@/lib/intel/taxonomy';
import type { IntelDataset } from '@/lib/intel/types';

export function sessionInputs(ds: IntelDataset) {
  const ids = route.get();
  const saved = ds.places.filter((p) => ids.includes(p.id) || (p.route_id && ids.includes(p.route_id)));
  const log = analyticsLog.all();
  const byId = new Map(ds.places.map((p) => [p.id, p]));
  const behaviour = interestSignals(log, (id) => byId.get(id)?.interests ?? []);
  return { profile: profileStore.get(), saved, behaviour, log };
}

export async function initSegment(box: HTMLElement): Promise<void> {
  const out = box.querySelector<HTMLElement>('[data-segment-out]')!;
  let ds: IntelDataset;
  try { ds = await loadIntel(box.dataset.intelUrl!); } catch { out.textContent = 'No se pudieron cargar los datos para calcular tu segmento.'; return; }
  const munis = new Map(ds.municipalities.map((m) => [m.id, m]));

  const render = () => {
    const { profile, saved, behaviour, log } = sessionInputs(ds);
    const res = segmentFor({ profile, saved, behaviour });
    const bars = res.ranking.map((m) => `<li class="ibar"><span>${esc(m.segment.name)}</span><span class="ibar__track"><span class="ibar__fill" style="width:${Math.round(m.affinity * 100)}%"></span></span><span class="ibar__v">${Math.round(m.affinity * 100)}</span></li>`).join('');
    const evidence = [
      profile.interests.length ? `elegiste ${profile.interests.map((i) => INTEREST_LABEL[i]).join(', ')}` : null,
      saved.length ? `guardaste ${saved.length} ${saved.length === 1 ? 'lugar' : 'lugares'} en Mi Ruta` : null,
      log.length ? `hay ${log.length} ${log.length === 1 ? 'evento' : 'eventos'} en el registro local` : null,
    ].filter(Boolean).join('; ');
    const head = res.primary
      ? `<p class="seg-now__name display display--md">${esc(res.primary.segment.name)}</p>
         <p class="body">${esc(res.primary.segment.summary)}</p>
         <p class="small muted">Afinidad ${Math.round(res.primary.affinity * 100)} de 100${res.primary.drivers.length ? `, sobre todo por ${res.primary.drivers.slice(0, 3).map((i) => INTEREST_LABEL[i]).join(', ')}` : ''}. Base: ${esc(evidence || 'el tiempo de viaje que indicaste')}.</p>`
      : `<p class="seg-now__name display display--md">Perfil aún sin definir</p>
         <p class="body">${res.hasSignal ? `Ningún segmento alcanza ${Math.round(MIN_AFFINITY * 100)} de afinidad con lo que sabemos de esta sesión.` : 'Todavía no elegiste intereses ni guardaste lugares en este navegador.'} Elige tus intereses y vuelve.</p>`;
    out.innerHTML = `${head}<ul class="seg-now__bars" aria-label="Afinidad con cada segmento, de 0 a 100">${bars}</ul>`;

    const seen = log.filter((e) => e.name === 'recommendation_seen').reduce((s, e) => s + (Array.isArray(e.props.place_ids) ? e.props.place_ids.length : 0), 0);
    const row = sessionFeatures({
      profile, saved, behaviour, exposureOf: (id) => munis.get(id)?.exposure_proxy ?? null, recommendationsSeen: seen,
      recommendationsAdded: log.filter((e) => e.name === 'recommendation_added').length, optimized: log.some((e) => e.name === 'route_optimized' && e.props.applied === true), month: new Date().getMonth() + 1,
    });
    const table = document.querySelector<HTMLElement>('[data-segment-row]'); // lives in the «De reglas a modelos» section
    if (table) table.innerHTML = Object.entries(row).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('');
  };
  render();
  profileStore.subscribe(render);
  route.subscribe(render);
}

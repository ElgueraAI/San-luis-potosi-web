import { profile, simplifiedProfile, type RegionId } from '@/data/research';

/**
 * SVG geometry for the measured INEGI transect ("The Line").
 * x: 0..W across the 376 km; y: 0..H, top = `ceil` metres, bottom = 0 m.
 */
export function profileGeometry(W: number, H: number, opts: { tolerance?: number; ceil?: number; floor?: number } = {}) {
  const { tolerance = 8, ceil = 3200, floor = 0 } = opts;
  const pts = simplifiedProfile(tolerance);
  const X = (km: number) => (km / profile.lengthKm) * W;
  const Y = (m: number) => H - ((m - floor) / (ceil - floor)) * H;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.km).toFixed(1)} ${Y(p.m).toFixed(1)}`).join('');
  const area = `${line}L${W} ${H}L0 ${H}Z`;
  const segment = (r: RegionId) => {
    const s = profile.segments.find((x) => x.region === r)!;
    const sel = pts.filter((p) => p.km >= s.from - 0.6 && p.km <= s.to + 1.2);
    return sel.map((p, i) => `${i ? 'L' : 'M'}${X(p.km).toFixed(1)} ${Y(p.m).toFixed(1)}`).join('');
  };
  return { line, area, segment, X, Y, points: pts };
}

export const fmtM = (m: number) => `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(m)} m`;
export const fmtKm = (km: number) => `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(km)} km`;

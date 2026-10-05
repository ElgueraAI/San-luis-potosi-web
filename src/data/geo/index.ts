import schematic from './profile.schematic.json';

export type ProfilePoint = [x: number, y: number, metres?: number];
export type Boundary = { region: string; from: number; to: number; status: 'pending' | 'verified' };
export type Profile = {
  kind: 'schematic' | 'measured';
  status: 'pending' | 'verified';
  source: string | null;
  verifiedAt: string | null;
  boundaries: Boundary[];
  points: ProfilePoint[];
};

/**
 * The one terrain line the whole site is drawn from.
 * Swap to `./profile.measured.json` once `npm run geo:profile` has produced a
 * verified INEGI transect. Nothing else changes.
 */
export const profile = schematic as unknown as Profile;

/** Numeric altitudes may render only from a measured, verified profile. */
export const altitudesEnabled = profile.kind === 'measured' && profile.status === 'verified';

/** Elevation (0..1) at a fraction x of the transect, linearly interpolated. */
export function elevationAt(x: number, pts: ProfilePoint[] = profile.points): number {
  const n = pts.length - 1;
  const f = Math.min(Math.max(x, 0), 1) * n;
  const i = Math.min(Math.floor(f), n - 1);
  const t = f - i;
  return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
}

/**
 * Line geometry in world units: x 0..1000 west to east, y grows downward,
 * with YR units of drop between the highest and lowest point.
 */
export const WORLD = { X: 1000, YR: 300 } as const;

export function worldPath(pts: ProfilePoint[] = profile.points, from = 0, to = 1, overrun = 0): string {
  const sel = pts.filter(([x]) => x >= from - 1e-6 && x <= to + 1e-6);
  const d = sel.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * WORLD.X).toFixed(1)} ${((1 - y) * WORLD.YR).toFixed(1)}`);
  if (overrun > 0 && sel.length) {
    const first = sel[0], last = sel[sel.length - 1];
    d.unshift(`M${(first[0] * WORLD.X - overrun).toFixed(1)} ${((1 - first[1]) * WORLD.YR).toFixed(1)}`);
    d[1] = d[1].replace(/^M/, 'L');
    d.push(`L${(last[0] * WORLD.X + overrun).toFixed(1)} ${((1 - last[1]) * WORLD.YR).toFixed(1)}`);
  }
  return d.join('');
}

/** Closed polygon covering everything ABOVE the line (the sky). */
export function skyPath(pts: ProfilePoint[] = profile.points, overrun = 2000, ceiling = -4000): string {
  const line = worldPath(pts, 0, 1, overrun).replace(/^M/, 'L');
  return `M${-overrun} ${ceiling}${line}L${WORLD.X + overrun} ${ceiling}Z`;
}

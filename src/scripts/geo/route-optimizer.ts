/**
 * Visit order for several stops from a road cost matrix (seconds or metres
 * from the routing provider, never straight-line distance).
 *
 * Open path (the trip does not return to the start):
 *   - fixed start (index 0 = origin) when the visitor has a starting point;
 *   - otherwise every stop is tried as the start.
 * Up to EXACT_MAX points the order is exact (Held–Karp dynamic programming,
 * < 1 M steps). Beyond that, nearest neighbour gives a first tour, then 2-opt
 * and Or-opt improve it. Pure functions: no DOM, no network.
 */

export type CostMatrix = (number | null)[][];

const cost = (m: CostMatrix, a: number, b: number) => {
  const v = m[a]?.[b];
  return v === null || v === undefined || !Number.isFinite(v) ? Infinity : v;
};

export function pathCost(m: CostMatrix, order: number[]): number {
  let s = 0;
  for (let i = 1; i < order.length; i++) s += cost(m, order[i - 1], order[i]);
  return s;
}

export function nearestNeighbour(m: CostMatrix, nodes: number[], start: number): number[] {
  const left = new Set(nodes.filter((n) => n !== start));
  const out = [start];
  let cur = start;
  while (left.size) {
    let best = -1, bestC = Infinity;
    for (const n of left) {
      const c = cost(m, cur, n);
      if (c < bestC || best === -1) { bestC = c; best = n; }
    }
    out.push(best);
    left.delete(best);
    cur = best;
  }
  return out;
}

/** 2-opt for an open path; position 0 stays fixed. Asymmetric costs are evaluated exactly. */
export function twoOpt(m: CostMatrix, order: number[], maxPasses = 50): number[] {
  let best = [...order];
  let bestCost = pathCost(m, best);
  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false;
    for (let i = 1; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const cand = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
        const c = pathCost(m, cand);
        if (c + 1e-9 < bestCost) { best = cand; bestCost = c; improved = true; }
      }
    }
    if (!improved) break;
  }
  return best;
}

/** Or-opt: move segments of 1–3 stops elsewhere in the path (position 0 fixed). */
export function orOpt(m: CostMatrix, order: number[]): number[] {
  let best = [...order];
  let bestCost = pathCost(m, best);
  let improved = true;
  while (improved) {
    improved = false;
    for (let len = 1; len <= 3; len++) {
      for (let i = 1; i + len <= best.length; i++) {
        const seg = best.slice(i, i + len);
        const rest = [...best.slice(0, i), ...best.slice(i + len)];
        for (let k = 1; k <= rest.length; k++) {
          if (k === i) continue;
          for (const s of [seg, [...seg].reverse()]) {
            const cand = [...rest.slice(0, k), ...s, ...rest.slice(k)];
            const c = pathCost(m, cand);
            if (c + 1e-9 < bestCost) { best = cand; bestCost = c; improved = true; }
          }
        }
      }
    }
  }
  return best;
}

/** 2-opt and Or-opt alternated until neither improves. */
export function localSearch(m: CostMatrix, order: number[]): number[] {
  let cur = order, c = pathCost(m, cur);
  for (let i = 0; i < 20; i++) {
    const next = orOpt(m, twoOpt(m, cur));
    const nc = pathCost(m, next);
    if (nc + 1e-9 >= c) break;
    cur = next; c = nc;
  }
  return cur;
}

export const EXACT_MAX = 12;

/** Exact shortest open path (Held–Karp). fixedStart: path must begin at index 0. */
export function heldKarp(m: CostMatrix, fixedStart: boolean): number[] {
  const n = m.length;
  const full = (1 << n) - 1;
  const dp = new Float64Array((1 << n) * n).fill(Infinity);
  const parent = new Int8Array((1 << n) * n).fill(-1);
  const starts = fixedStart ? [0] : Array.from({ length: n }, (_, i) => i);
  for (const s of starts) dp[(1 << s) * n + s] = 0;
  for (let mask = 1; mask <= full; mask++) {
    for (let j = 0; j < n; j++) {
      const cur = dp[mask * n + j];
      if (!(mask & (1 << j)) || cur === Infinity) continue;
      for (let k = 0; k < n; k++) {
        if (mask & (1 << k)) continue;
        const nm = mask | (1 << k);
        const c = cur + cost(m, j, k);
        if (c < dp[nm * n + k]) { dp[nm * n + k] = c; parent[nm * n + k] = j; }
      }
    }
  }
  let end = 0;
  for (let j = 1; j < n; j++) if (dp[full * n + j] < dp[full * n + end]) end = j;
  if (dp[full * n + end] === Infinity) return Array.from({ length: n }, (_, i) => i);
  const order: number[] = [];
  let mask = full, j = end;
  while (j !== -1) { order.push(j); const p = parent[mask * n + j]; mask &= ~(1 << j); j = p; }
  return order.reverse();
}

export interface OptimizeResult {
  /** Matrix indices in the proposed visiting order (includes the fixed start when there is one). */
  order: number[];
  cost: number;
  originalCost: number;
}

/**
 * @param m        square cost matrix
 * @param fixedStart true when index 0 is the visitor's origin (must stay first)
 */
export function optimizeOrder(m: CostMatrix, fixedStart: boolean): OptimizeResult {
  const n = m.length;
  const identity = Array.from({ length: n }, (_, i) => i);
  const originalCost = pathCost(m, identity);
  if (n <= 2) return { order: identity, cost: originalCost, originalCost };
  if (n <= EXACT_MAX) {
    const order = heldKarp(m, fixedStart);
    const c = pathCost(m, order);
    return c < originalCost ? { order, cost: c, originalCost } : { order: identity, cost: originalCost, originalCost };
  }
  const starts = fixedStart ? [0] : identity;
  let best = identity, bestCost = originalCost;
  for (const s of starts) {
    const tour = localSearch(m, nearestNeighbour(m, identity, s));
    const c = pathCost(m, tour);
    if (c < bestCost) { best = tour; bestCost = c; }
  }
  return { order: best, cost: bestCost, originalCost };
}

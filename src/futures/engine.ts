/**
 * AI Futures Map — pure engine. No React, no DOM, no I/O.
 *
 * Maths (see design doc section 4):
 *   - Curves are interpolated linearly IN LOG-ODDS between horizons and held flat outside.
 *   - Only deltas travel through edges. At baseline every edge contributes zero, so the
 *     curated seed is reproduced exactly.
 *   - Each year is solved in topological order of the zero-lag edges; lagged edges read
 *     already-frozen earlier years. A zero-lag cycle is a validation error.
 *   - `requires` edges clamp child <= parent; event curves are made monotone; state
 *     marginals are renormalised to sum to 1 at every year.
 */

import {
  Axis,
  Baseline,
  Curve,
  FuturesGraph,
  FuturesNode,
  GoodnessSeries,
  Intervention,
  MAGNITUDE_LOG_ODDS,
  ShiftVector,
  SolveResult,
  StateFlow,
} from './types';

// ---------------------------------------------------------------------------
// Scalar helpers
// ---------------------------------------------------------------------------

export const P_MIN = 0.005;
export const P_MAX = 0.995;
export const SHOCK_CLAMP = 4;

export const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));

export const logit = (p: number): number => {
  const q = clamp(p, P_MIN, P_MAX);
  return Math.log(q / (1 - q));
};

export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

// ---------------------------------------------------------------------------
// Curves
// ---------------------------------------------------------------------------

export function yearsOf(graph: Pick<FuturesGraph, 'startYear' | 'endYear'>): number[] {
  const out: number[] = [];
  for (let y = graph.startYear; y <= graph.endYear; y++) out.push(y);
  return out;
}

/**
 * Interpolate a sparse curve onto a dense year list, linearly in log-odds.
 * Before the first key and after the last key the value is held flat.
 */
export function interpolateCurve(curve: Curve, years: number[]): number[] {
  const keys = Object.keys(curve)
    .map(Number)
    .filter((k) => Number.isFinite(k))
    .sort((a, b) => a - b);
  if (keys.length === 0) throw new Error('interpolateCurve: empty curve');
  if (keys.length === 1) return years.map(() => curve[String(keys[0])]);
  return years.map((y) => {
    if (y <= keys[0]) return curve[String(keys[0])];
    if (y >= keys[keys.length - 1]) return curve[String(keys[keys.length - 1])];
    let k = 0;
    while (k < keys.length - 2 && keys[k + 1] < y) k++;
    const y0 = keys[k];
    const y1 = keys[k + 1];
    const f = (y - y0) / (y1 - y0);
    const l0 = logit(curve[String(y0)]);
    const l1 = logit(curve[String(y1)]);
    return sigmoid((1 - f) * l0 + f * l1);
  });
}

/** Per-year hazard from a cumulative curve: (P(y+1) - P(y)) / (1 - P(y)). Last year repeats. */
export function hazardOf(cumulative: number[]): number[] {
  return cumulative.map((p, t) => {
    const next = cumulative[Math.min(t + 1, cumulative.length - 1)];
    return clamp((next - p) / Math.max(1e-9, 1 - p), 0, 1);
  });
}

// ---------------------------------------------------------------------------
// Graph indexing
// ---------------------------------------------------------------------------

interface Indexed {
  nodes: FuturesNode[];
  byId: Map<string, FuturesNode>;
  index: Map<string, number>;
  stateIds: string[];
  /** Topological order over the zero-lag subgraph, as node ids. */
  order: string[];
}

export function activeNodes(graph: FuturesGraph): FuturesNode[] {
  return graph.nodes.filter((n) => !n.retired);
}

/**
 * Kahn's algorithm over edges with lag 0. Throws if a zero-lag cycle exists.
 * Lagged edges are legal in cycles because they read frozen earlier years.
 */
export function topoOrder(graph: FuturesGraph): string[] {
  const nodes = activeNodes(graph);
  const ids = nodes.map((n) => n.id);
  const idSet = new Set(ids);
  const indeg = new Map<string, number>(ids.map((id) => [id, 0]));
  const out = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const n of nodes) {
    for (const e of n.parents ?? []) {
      if (!idSet.has(e.from)) throw new Error(`Edge ${e.from} -> ${n.id}: unknown or retired parent`);
      if ((e.lag ?? 0) === 0) {
        indeg.set(n.id, (indeg.get(n.id) ?? 0) + 1);
        out.get(e.from)!.push(n.id);
      }
    }
  }
  const queue = ids.filter((id) => indeg.get(id) === 0);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const child of out.get(id) ?? []) {
      const d = (indeg.get(child) ?? 0) - 1;
      indeg.set(child, d);
      if (d === 0) queue.push(child);
    }
  }
  if (order.length !== ids.length) {
    const stuck = ids.filter((id) => !order.includes(id));
    throw new Error(`Zero-lag cycle among: ${stuck.join(', ')}. Give at least one edge in the cycle lag >= 1.`);
  }
  return order;
}

function indexGraph(graph: FuturesGraph): Indexed {
  const nodes = activeNodes(graph);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const stateIds = graph.axis.states.filter((id) => byId.has(id));
  for (const id of stateIds) {
    if (byId.get(id)!.kind !== 'state') throw new Error(`Axis state ${id} is not a state node`);
  }
  return { nodes, byId, index, stateIds, order: topoOrder(graph) };
}

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------

function renormaliseStates(P: Record<string, number[]>, stateIds: string[], nYears: number): void {
  for (let t = 0; t < nYears; t++) {
    let z = 0;
    for (const id of stateIds) z += P[id][t];
    // Skip when already normalised so a no-op solve reproduces the baseline bit-for-bit.
    if (z > 0 && Math.abs(z - 1) > 1e-12) for (const id of stateIds) P[id][t] /= z;
  }
}

/** Dense baseline curves for every active node, states renormalised per year. */
export function buildBaseline(graph: FuturesGraph): Baseline {
  const years = yearsOf(graph);
  const ix = indexGraph(graph);
  const P: Record<string, number[]> = {};
  for (const n of ix.nodes) P[n.id] = interpolateCurve(n.seed.curve, years);
  renormaliseStates(P, ix.stateIds, years.length);
  return { years, P };
}

// ---------------------------------------------------------------------------
// Solve
// ---------------------------------------------------------------------------

/**
 * Propagate log-odds shifts through the graph.
 *
 * @param graph    the graph
 * @param shifts   nodeId -> per-year shift (index 0 = startYear). Use `mergeShifts` to compose.
 * @param baseline optional precomputed baseline (buildBaseline) to avoid recomputation on drag.
 */
export function solve(graph: FuturesGraph, shifts: ShiftVector = {}, baseline?: Baseline): SolveResult {
  const base = baseline ?? buildBaseline(graph);
  const years = base.years;
  const nY = years.length;
  const ix = indexGraph(graph);

  // d[id][t] = total log-odds delta at year t
  const d: Record<string, number[]> = {};
  for (const n of ix.nodes) d[n.id] = new Array(nY).fill(0);

  for (let t = 0; t < nY; t++) {
    for (const id of ix.order) {
      const node = ix.byId.get(id)!;
      let s = 0;
      for (const e of node.parents ?? []) {
        const tt = t - (e.lag ?? 0);
        if (tt >= 0) s += e.strength * d[e.from][tt];
      }
      const u = shifts[id]?.[t] ?? 0;
      d[id][t] = u + clamp(s, -SHOCK_CLAMP, SHOCK_CLAMP);
    }
  }

  // A zero delta returns the base value exactly (logit clamps at P_MIN/P_MAX would otherwise
  // nudge tiny seeds like 0.002 up to 0.005), so the baseline is always reproduced bit-for-bit.
  const P: Record<string, number[]> = {};
  for (const n of ix.nodes) {
    P[n.id] = base.P[n.id].map((p, t) => (d[n.id][t] === 0 ? p : sigmoid(logit(p) + d[n.id][t])));
  }

  // requires: a consequence is never likelier than its prerequisite
  for (const n of ix.nodes) {
    for (const e of n.parents ?? []) {
      if (e.kind !== 'requires') continue;
      const lag = e.lag ?? 0;
      for (let t = 0; t < nY; t++) {
        P[n.id][t] = Math.min(P[n.id][t], P[e.from][Math.max(0, t - lag)]);
      }
    }
  }

  // events: once happened, stays happened
  for (const n of ix.nodes) {
    if (n.kind !== 'event') continue;
    for (let t = 1; t < nY; t++) P[n.id][t] = Math.max(P[n.id][t], P[n.id][t - 1]);
  }

  renormaliseStates(P, ix.stateIds, nY);

  return { years, P, base: base.P };
}

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

/** Add `value` to node `id` from year index `fromT` onward. Mutates and returns `shifts`. */
export function addShift(shifts: ShiftVector, id: string, fromT: number, value: number, nYears: number): ShiftVector {
  if (!shifts[id]) shifts[id] = new Array(nYears).fill(0);
  for (let t = Math.max(0, fromT); t < nYears; t++) shifts[id][t] += value;
  return shifts;
}

/** Sum several shift vectors. Order-independent. */
export function mergeShifts(nYears: number, ...vectors: ShiftVector[]): ShiftVector {
  const out: ShiftVector = {};
  for (const v of vectors) {
    for (const id of Object.keys(v)) {
      if (!out[id]) out[id] = new Array(nYears).fill(0);
      for (let t = 0; t < nYears; t++) out[id][t] += v[id][t] ?? 0;
    }
  }
  return out;
}

/** A constant whole-curve shift for a node (what a slider does). */
export function sliderShift(graph: Pick<FuturesGraph, 'startYear' | 'endYear'>, id: string, logOdds: number): ShiftVector {
  const nY = graph.endYear - graph.startYear + 1;
  return addShift({}, id, 0, logOdds, nY);
}

/** Shift vector for one or more interventions applied together. */
export function shiftsFromInterventions(
  graph: Pick<FuturesGraph, 'startYear' | 'endYear'>,
  interventions: Intervention[],
): ShiftVector {
  const nY = graph.endYear - graph.startYear + 1;
  const out: ShiftVector = {};
  for (const iv of interventions) {
    for (const n of iv.nudges) {
      const fromT = iv.startYear - graph.startYear + (n.lag ?? 0);
      const value = (n.direction === 'up' ? 1 : -1) * MAGNITUDE_LOG_ODDS[n.magnitude];
      addShift(out, n.node, fromT, value, nY);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Goodness and flows (the one graph)
// ---------------------------------------------------------------------------

export function goodnessOf(node: FuturesNode): number {
  if (node.kind !== 'state' || typeof node.goodness !== 'number') {
    throw new Error(`goodnessOf: ${node.id} is not a state with a goodness value`);
  }
  return node.goodness;
}

/** Expected goodness, floor risk and ceiling chance per year from a solve (or a baseline). */
export function goodnessSeries(graph: FuturesGraph, P: Record<string, number[]>, years?: number[]): GoodnessSeries {
  const ys = years ?? yearsOf(graph);
  const byId = new Map(activeNodes(graph).map((n) => [n.id, n]));
  const axis: Axis = graph.axis;
  const floorG = axis.floorGoodness ?? 20;
  const ceilG = axis.ceilingGoodness ?? 90;
  const states = axis.states.filter((id) => byId.has(id));
  const mean: number[] = [];
  const floor: number[] = [];
  const ceiling: number[] = [];
  for (let t = 0; t < ys.length; t++) {
    let g = 0;
    let f = 0;
    let c = 0;
    for (const id of states) {
      const p = P[id][t];
      const v = goodnessOf(byId.get(id)!);
      g += p * v;
      if (v <= floorG) f += p;
      if (v >= ceilG) c += p;
    }
    mean.push(g);
    floor.push(f);
    ceiling.push(c);
  }
  return { years: ys, mean, floor, ceiling };
}

/**
 * Probability mass flowing between world-states across consecutive axis horizons.
 * Deterministic "minimal movement" coupling: absorbing states keep their mass, then the
 * remaining mass is matched north-west-corner style over states sorted by goodness, so
 * probability moves as little along the goodness axis as possible. Never voted on.
 */
export function stateFlows(graph: FuturesGraph, P: Record<string, number[]>, years?: number[]): StateFlow[] {
  const ys = years ?? yearsOf(graph);
  const byId = new Map(activeNodes(graph).map((n) => [n.id, n]));
  const states = graph.axis.states
    .filter((id) => byId.has(id))
    .sort((a, b) => goodnessOf(byId.get(a)!) - goodnessOf(byId.get(b)!));
  const absorbing = new Set(graph.axis.absorbing ?? []);
  const horizons = [graph.startYear, ...graph.axis.horizons.filter((h) => h > graph.startYear && h <= graph.endYear)];
  const flows: StateFlow[] = [];

  for (let k = 0; k < horizons.length - 1; k++) {
    const h0 = horizons[k];
    const h1 = horizons[k + 1];
    const t0 = ys.indexOf(h0);
    const t1 = ys.indexOf(h1);
    if (t0 < 0 || t1 < 0) continue;
    const p = states.map((id) => P[id][t0]);
    const q = states.map((id) => P[id][t1]);

    // absorbing states: mass stays put (capped by what is there at h1)
    const pRem = [...p];
    const qRem = [...q];
    states.forEach((id, i) => {
      if (!absorbing.has(id)) return;
      const keep = Math.min(p[i], q[i]);
      if (keep > 0) flows.push({ from: id, to: id, fromYear: h0, toYear: h1, mass: keep });
      pRem[i] -= keep;
      qRem[i] -= keep;
    });

    // scale so remaining supply equals remaining demand (guards rounding)
    const sp = pRem.reduce((a, b) => a + b, 0);
    const sq = qRem.reduce((a, b) => a + b, 0);
    if (sp > 0 && sq > 0) for (let i = 0; i < qRem.length; i++) qRem[i] *= sp / sq;

    // north-west corner over goodness-sorted states
    let i = 0;
    let j = 0;
    while (i < states.length && j < states.length) {
      const m = Math.min(pRem[i], qRem[j]);
      if (m > 1e-12) flows.push({ from: states[i], to: states[j], fromYear: h0, toYear: h1, mass: m });
      pRem[i] -= m;
      qRem[j] -= m;
      if (pRem[i] <= 1e-12) i++;
      if (qRem[j] <= 1e-12) j++;
    }
  }
  return flows;
}

/**
 * AI Futures Map — applying interventions to the one graph, and scoring them.
 *
 * Design: tmp/futures-design/ai-futures-map-design.html section 5 ("Interventions, wedges and
 * the cost curve"). An intervention is a named bundle of log-odds nudges plus an ordinal cost
 * band. It is scored four ways at the graph's end year:
 *
 *   mean shift    dG(endYear)                     the wedge area's height at the right edge
 *   floor lift    -dF(endYear)                    positive = the bad tail shrank
 *   ceiling lift  dC(endYear)                     positive = the good tail grew
 *   cost          ordinal band 1-5
 *
 * As in the marginal abatement cost curve this borrows from, **each intervention is measured
 * alone against baseline**, never marginally against whatever else is toggled on. Interventions
 * compose additively in log-odds, so `applyInterventions` is the one place stacking happens.
 *
 * Pure: no React, no DOM, no I/O. All the maths lives in engine.ts.
 */

import {
  buildBaseline,
  goodnessSeries,
  mergeShifts,
  shiftsFromInterventions,
  solve,
} from './engine';
import {
  Baseline,
  CostBand,
  FuturesGraph,
  Intervention,
  InterventionMetrics,
  NodeKind,
  ShiftVector,
  SolveResult,
} from './types';

/** A node whose end-year probability moved once shifts were applied. */
export interface MovedNode {
  nodeId: string;
  /** `shortLabel` when the node has one, else `label` — this is a display string. */
  label: string;
  kind: NodeKind;
  /** Baseline probability at the graph's end year. */
  from: number;
  /** Post-solve probability at the graph's end year. */
  to: number;
  /** to - from. Signed. */
  delta: number;
}

/** Deltas smaller than this are rounding noise and are never reported by `whatMoved`. */
export const WHAT_MOVED_EPSILON = 0.005;

/**
 * Score every intervention **alone** against the baseline, sorted by bang-per-buck.
 *
 * @param graph         the graph
 * @param interventions the cards to score
 * @param baseline      optional precomputed baseline, to avoid recomputing it per card
 * @returns one row per intervention, sorted by `shiftPerCost` descending (best first)
 */
export function interventionMetrics(
  graph: FuturesGraph,
  interventions: Intervention[],
  baseline?: Baseline,
): InterventionMetrics[] {
  const base = baseline ?? buildBaseline(graph);
  const last = base.years.length - 1;
  const gBase = goodnessSeries(graph, base.P, base.years);

  const rows = interventions.map((iv): InterventionMetrics => {
    const result = solve(graph, shiftsFromInterventions(graph, [iv]), base);
    const g = goodnessSeries(graph, result.P, result.years);
    const cost: CostBand = iv.cost.band;
    const meanShift = g.mean[last] - gBase.mean[last];
    return {
      interventionId: iv.id,
      meanShift,
      floorLift: gBase.floor[last] - g.floor[last],
      ceilingLift: g.ceiling[last] - gBase.ceiling[last],
      cost,
      // cost bands are 1-5 by construction; the guard keeps a malformed card from producing NaN
      shiftPerCost: cost > 0 ? meanShift / cost : 0,
    };
  });

  return rows.sort((a, b) => b.shiftPerCost - a.shiftPerCost);
}

/**
 * Solve the graph with a set of interventions switched on, plus any extra shifts (what the
 * sliders produce). Additive in log-odds, so the order of `active` never matters.
 *
 * @param graph       the graph
 * @param active      the toggled-on intervention cards
 * @param extraShifts slider shifts (see `sliderShift` / `mergeShifts` in engine.ts)
 * @param baseline    optional precomputed baseline
 */
export function applyInterventions(
  graph: FuturesGraph,
  active: Intervention[],
  extraShifts?: ShiftVector,
  baseline?: Baseline,
): SolveResult {
  const nYears = graph.endYear - graph.startYear + 1;
  const shifts = mergeShifts(nYears, shiftsFromInterventions(graph, active), extraShifts ?? {});
  return solve(graph, shifts, baseline);
}

/**
 * "What moved?" — the nodes whose end-year probability changed most, for the explanation panel
 * next to the one graph. Sorted by absolute delta, noise excluded.
 *
 * @param result a solve result (it carries its own baseline in `result.base`)
 * @param topN   how many rows to return. Default 8.
 */
export function whatMoved(graph: FuturesGraph, result: SolveResult, topN = 8): MovedNode[] {
  const last = result.years.length - 1;
  if (last < 0) return [];

  const moved: MovedNode[] = [];
  for (const node of graph.nodes) {
    const after = result.P[node.id];
    const before = result.base[node.id];
    // retired nodes are absent from a solve result
    if (!after || !before) continue;
    const from = before[last];
    const to = after[last];
    const delta = to - from;
    if (!Number.isFinite(delta) || Math.abs(delta) < WHAT_MOVED_EPSILON) continue;
    moved.push({ nodeId: node.id, label: node.shortLabel ?? node.label, kind: node.kind, from, to, delta });
  }

  return moved.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, Math.max(0, topN));
}

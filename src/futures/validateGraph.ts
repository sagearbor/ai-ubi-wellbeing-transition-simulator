/**
 * AI Futures Map — graph and intervention validator.
 *
 * Three layers of checking, all pure (no I/O):
 *   1. JSON Schema (schemas/futuresGraph.schema.json), via ajv.
 *   2. Semantic checks that a schema cannot express: id uniqueness, dangling edges,
 *      monotonicity, edge-count budgets, sign consistency, and that the zero-lag
 *      subgraph is acyclic (delegated to engine.topoOrder).
 *   3. A cheap edge sensitivity probe and a golden-file comparison, both used by
 *      scripts/validate-futures.ts.
 *
 * See data/futures/README.md for the authoring workflow this supports.
 */

import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';

import futuresGraphSchema from '../../schemas/futuresGraph.schema.json';
import {
  Axis,
  EdgeKind,
  FuturesGraph,
  FuturesNode,
  Intervention,
  ParentEdge,
} from './types';
import { buildBaseline, goodnessOf, sliderShift, solve, topoOrder, yearsOf } from './engine';

// ---------------------------------------------------------------------------
// ajv setup
// ---------------------------------------------------------------------------

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const SCHEMA_ID = (futuresGraphSchema as { $id: string }).$id;
// addSchema throws if the same $id is registered twice (e.g. hot reload in tests); guard it.
if (!ajv.getSchema(SCHEMA_ID)) {
  ajv.addSchema(futuresGraphSchema, SCHEMA_ID);
}

const validateGraphSchema = ajv.compile(futuresGraphSchema);
const validateInterventionSchema = ajv.compile({ $ref: `${SCHEMA_ID}#/definitions/Intervention` });

function formatAjvErrors(errors: ErrorObject[] | null | undefined, label: string): string[] {
  if (!errors) return [];
  return errors.map((e) => `${label}${e.instancePath || '/'} ${e.message ?? ''}`.trim());
}

// ---------------------------------------------------------------------------
// Result shapes
// ---------------------------------------------------------------------------

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const EDGE_KIND_SIGN: Record<EdgeKind, 'positive' | 'negative'> = {
  requires: 'positive',
  enables: 'positive',
  amplifies: 'positive',
  dampens: 'negative',
  prevents: 'negative',
};

const MAX_PARENTS_PER_NODE = 5;
const MAX_EDGES_PER_NODE_BUDGET = 3;
const MARGINAL_SUM_TOLERANCE = 0.01;

// ---------------------------------------------------------------------------
// validateGraph
// ---------------------------------------------------------------------------

export function validateGraph(graph: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const schemaOk = validateGraphSchema(graph);
  if (!schemaOk) {
    errors.push(...formatAjvErrors(validateGraphSchema.errors, 'schema'));
    // Further checks assume the shape is at least structurally sound; bail out early.
    return { ok: false, errors, warnings };
  }

  const g = graph as FuturesGraph;

  // --- id uniqueness + pattern (pattern already enforced by schema; uniqueness is not) ---
  const seenIds = new Set<string>();
  for (const n of g.nodes) {
    if (seenIds.has(n.id)) errors.push(`duplicate node id: "${n.id}"`);
    seenIds.add(n.id);
  }

  const byId = new Map<string, FuturesNode>(g.nodes.map((n) => [n.id, n]));

  // --- edges: dangling parents, self-parent, max-parents, sign consistency, note, monotonicity ---
  let totalEdges = 0;
  for (const n of g.nodes) {
    const parents = n.parents ?? [];
    totalEdges += parents.length;

    if (parents.length > MAX_PARENTS_PER_NODE) {
      errors.push(`node "${n.id}" has ${parents.length} parents, max is ${MAX_PARENTS_PER_NODE}`);
    }

    for (const e of parents) {
      if (e.from === n.id) {
        errors.push(`node "${n.id}" has a self-parent edge`);
        continue;
      }
      const parentNode = byId.get(e.from);
      if (!parentNode) {
        errors.push(`node "${n.id}": parent edge from unknown node "${e.from}"`);
      } else if (parentNode.retired) {
        errors.push(`node "${n.id}": parent edge from retired node "${e.from}"`);
      }
      if (!e.note || !e.note.trim()) {
        errors.push(`node "${n.id}": edge from "${e.from}" is missing a note`);
      }
      checkEdgeSign(n.id, e, errors);
    }

    if (n.kind === 'event') {
      checkNonDecreasing(n, errors);
    }
    if (n.kind === 'state') {
      checkStateCurveKeys(n, g, errors);
    }
  }

  if (totalEdges > MAX_EDGES_PER_NODE_BUDGET * g.nodes.length) {
    errors.push(
      `total edges (${totalEdges}) exceeds budget of ${MAX_EDGES_PER_NODE_BUDGET} * nodes (${g.nodes.length} nodes = ${MAX_EDGES_PER_NODE_BUDGET * g.nodes.length})`,
    );
  }

  // --- axis: states exist, are kind 'state', have numeric goodness ---
  checkAxis(g, byId, errors);

  // --- state marginals sum to ~1 at each axis horizon (warning only) ---
  checkMarginalSums(g, byId, warnings);

  // --- zero-lag subgraph must be acyclic ---
  try {
    topoOrder(g);
  } catch (err) {
    errors.push(`topoOrder: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

function checkEdgeSign(childId: string, e: ParentEdge, errors: string[]): void {
  const wantSign = EDGE_KIND_SIGN[e.kind];
  if (wantSign === 'positive' && e.strength <= 0) {
    errors.push(`node "${childId}": edge from "${e.from}" kind "${e.kind}" must have strength > 0, got ${e.strength}`);
  }
  if (wantSign === 'negative' && e.strength >= 0) {
    errors.push(`node "${childId}": edge from "${e.from}" kind "${e.kind}" must have strength < 0, got ${e.strength}`);
  }
}

function checkNonDecreasing(n: FuturesNode, errors: string[]): void {
  const keys = Object.keys(n.seed.curve)
    .map(Number)
    .filter((k) => Number.isFinite(k))
    .sort((a, b) => a - b);
  for (let i = 1; i < keys.length; i++) {
    const prev = n.seed.curve[String(keys[i - 1])];
    const cur = n.seed.curve[String(keys[i])];
    if (cur < prev) {
      errors.push(`node "${n.id}": event curve decreases from ${keys[i - 1]}=${prev} to ${keys[i]}=${cur}`);
    }
  }
}

function checkStateCurveKeys(n: FuturesNode, g: FuturesGraph, errors: string[]): void {
  const allowed = new Set<number>([g.startYear, ...g.axis.horizons]);
  for (const key of Object.keys(n.seed.curve)) {
    const y = Number(key);
    if (!allowed.has(y)) {
      errors.push(
        `state node "${n.id}": curve key ${key} is not the graph startYear (${g.startYear}) or an axis horizon (${g.axis.horizons.join(', ')})`,
      );
    }
  }
}

function checkAxis(g: FuturesGraph, byId: Map<string, FuturesNode>, errors: string[]): void {
  const axis: Axis = g.axis;
  for (const id of axis.states) {
    const node = byId.get(id);
    if (!node) {
      errors.push(`axis: state "${id}" does not exist`);
      continue;
    }
    if (node.kind !== 'state') {
      errors.push(`axis: node "${id}" is listed as a state but has kind "${node.kind}"`);
    }
    if (typeof node.goodness !== 'number') {
      errors.push(`axis: state "${id}" is missing a numeric goodness value`);
    }
  }
  for (const id of axis.absorbing ?? []) {
    if (!axis.states.includes(id)) {
      errors.push(`axis: absorbing state "${id}" is not in axis.states`);
    }
  }
}

function checkMarginalSums(g: FuturesGraph, byId: Map<string, FuturesNode>, warnings: string[]): void {
  const states = g.axis.states.filter((id) => byId.has(id));
  for (const horizon of g.axis.horizons) {
    let sum = 0;
    let missing = false;
    for (const id of states) {
      const node = byId.get(id)!;
      const v = node.seed.curve[String(horizon)];
      if (typeof v !== 'number') {
        missing = true;
        continue;
      }
      sum += v;
    }
    if (missing) continue; // already reported by checkStateCurveKeys / schema shape elsewhere
    if (Math.abs(sum - 1) > MARGINAL_SUM_TOLERANCE) {
      warnings.push(
        `state marginals at ${horizon} sum to ${sum.toFixed(4)}, not 1 (tolerance ${MARGINAL_SUM_TOLERANCE}); the engine renormalises this at solve time`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// validateIntervention
// ---------------------------------------------------------------------------

export function validateIntervention(iv: unknown, graph: FuturesGraph): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const schemaOk = validateInterventionSchema(iv);
  if (!schemaOk) {
    errors.push(...formatAjvErrors(validateInterventionSchema.errors, 'schema'));
    return { ok: false, errors, warnings };
  }

  const intervention = iv as Intervention;
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  if (intervention.startYear < graph.startYear || intervention.startYear > graph.endYear) {
    errors.push(
      `intervention "${intervention.id}": startYear ${intervention.startYear} is outside graph range [${graph.startYear}, ${graph.endYear}]`,
    );
  }

  if (intervention.cost.band < 1 || intervention.cost.band > 5) {
    errors.push(`intervention "${intervention.id}": cost.band ${intervention.cost.band} must be 1-5`);
  }

  if (intervention.nudges.length === 0) {
    errors.push(`intervention "${intervention.id}": must have at least one nudge`);
  }

  for (const nudge of intervention.nudges) {
    const node = byId.get(nudge.node);
    if (!node) {
      errors.push(`intervention "${intervention.id}": nudge targets unknown node "${nudge.node}"`);
    } else if (node.retired) {
      warnings.push(`intervention "${intervention.id}": nudge targets retired node "${nudge.node}"`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// sensitivityReport
// ---------------------------------------------------------------------------

export interface SensitivityFinding {
  from: string;
  to: string;
  kind: EdgeKind;
  strength: number;
  /** The state whose endYear marginal moved the most when this edge was zeroed. */
  mostShiftedState: string;
  /** |marginal(with edge) - marginal(edge zeroed)| for mostShiftedState, at endYear, under a +1 log-odds probe on the edge's parent. */
  maxAbsShift: number;
}

/**
 * For every edge, zero its strength, re-solve under a standard +1 log-odds probe applied to
 * the edge's parent node from startYear, and compare each axis state's endYear marginal with
 * and without the edge. Edges whose removal shifts some state marginal by more than 0.05 are
 * reported. This is a coarse "does this edge matter" signal, not a formal sensitivity analysis:
 * it probes exactly one shift shape (a constant +1 nudge on the parent) and only checks the
 * final year.
 */
export function sensitivityReport(graph: FuturesGraph, threshold = 0.05): SensitivityFinding[] {
  const baseline = buildBaseline(graph);
  const endIdx = baseline.years.length - 1;
  const findings: SensitivityFinding[] = [];

  for (const n of graph.nodes) {
    for (const e of n.parents ?? []) {
      const probe = sliderShift(graph, e.from, 1);

      const withEdge = solve(graph, probe, baseline);

      const zeroedGraph = zeroEdge(graph, n.id, e.from);
      const withoutEdge = solve(zeroedGraph, probe, baseline);

      let maxAbsShift = 0;
      let mostShiftedState = '';
      for (const stateId of graph.axis.states) {
        const a = withEdge.P[stateId]?.[endIdx];
        const b = withoutEdge.P[stateId]?.[endIdx];
        if (a === undefined || b === undefined) continue;
        const shift = Math.abs(a - b);
        if (shift > maxAbsShift) {
          maxAbsShift = shift;
          mostShiftedState = stateId;
        }
      }

      if (maxAbsShift > threshold) {
        findings.push({ from: e.from, to: n.id, kind: e.kind, strength: e.strength, mostShiftedState, maxAbsShift });
      }
    }
  }

  return findings.sort((a, b) => b.maxAbsShift - a.maxAbsShift);
}

/** Deep-clones `graph` and sets one edge's strength to 0 (identified by child id + parent id). */
function zeroEdge(graph: FuturesGraph, childId: string, fromId: string): FuturesGraph {
  const clone: FuturesGraph = JSON.parse(JSON.stringify(graph));
  const child = clone.nodes.find((n) => n.id === childId);
  const edge = child?.parents?.find((p) => p.from === fromId);
  if (edge) edge.strength = 0;
  return clone;
}

// ---------------------------------------------------------------------------
// checkGolden
// ---------------------------------------------------------------------------

export interface GoldenFile {
  graphVersion: string;
  /** year -> stateId -> baseline marginal, 4 decimals, at each axis horizon. */
  stateMarginals: Record<string, Record<string, number>>;
  /** Baseline goodnessSeries at endYear, 4 decimals. */
  goodnessAtEndYear: { mean: number; floor: number; ceiling: number };
}

export interface GoldenCheckResult {
  ok: boolean;
  errors: string[];
}

const GOLDEN_TOLERANCE = 1e-4;

export function checkGolden(graph: FuturesGraph, golden: GoldenFile): GoldenCheckResult {
  const errors: string[] = [];
  const baseline = buildBaseline(graph);
  const years = yearsOf(graph);

  for (const horizon of graph.axis.horizons) {
    const idx = years.indexOf(horizon);
    const expected = golden.stateMarginals[String(horizon)];
    if (idx < 0 || !expected) {
      errors.push(`golden: no data for horizon ${horizon}`);
      continue;
    }
    for (const stateId of graph.axis.states) {
      const actual = baseline.P[stateId]?.[idx];
      const exp = expected[stateId];
      if (actual === undefined || exp === undefined) {
        errors.push(`golden: missing marginal for state "${stateId}" at ${horizon}`);
        continue;
      }
      if (Math.abs(actual - exp) > GOLDEN_TOLERANCE) {
        errors.push(`golden: state "${stateId}" at ${horizon}: expected ${exp}, got ${actual.toFixed(4)}`);
      }
    }
  }

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const endIdx = years.length - 1;
  const floorG = graph.axis.floorGoodness ?? 20;
  const ceilG = graph.axis.ceilingGoodness ?? 90;
  let mean = 0;
  let floor = 0;
  let ceiling = 0;
  for (const stateId of graph.axis.states) {
    const p = baseline.P[stateId]?.[endIdx] ?? 0;
    const v = goodnessOf(byId.get(stateId)!);
    mean += p * v;
    if (v <= floorG) floor += p;
    if (v >= ceilG) ceiling += p;
  }

  const checks: [string, number, number][] = [
    ['mean', mean, golden.goodnessAtEndYear.mean],
    ['floor', floor, golden.goodnessAtEndYear.floor],
    ['ceiling', ceiling, golden.goodnessAtEndYear.ceiling],
  ];
  for (const [label, actual, expected] of checks) {
    if (Math.abs(actual - expected) > GOLDEN_TOLERANCE) {
      errors.push(`golden: goodnessAtEndYear.${label}: expected ${expected}, got ${actual.toFixed(4)}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/** Computes a fresh GoldenFile from a graph (used by scripts/validate-futures.ts --update-golden). */
export function computeGolden(graph: FuturesGraph): GoldenFile {
  const baseline = buildBaseline(graph);
  const years = yearsOf(graph);
  const round4 = (x: number) => Math.round(x * 10000) / 10000;

  const stateMarginals: Record<string, Record<string, number>> = {};
  for (const horizon of graph.axis.horizons) {
    const idx = years.indexOf(horizon);
    const row: Record<string, number> = {};
    for (const stateId of graph.axis.states) {
      row[stateId] = round4(baseline.P[stateId]?.[idx] ?? 0);
    }
    stateMarginals[String(horizon)] = row;
  }

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const endIdx = years.length - 1;
  const floorG = graph.axis.floorGoodness ?? 20;
  const ceilG = graph.axis.ceilingGoodness ?? 90;
  let mean = 0;
  let floor = 0;
  let ceiling = 0;
  for (const stateId of graph.axis.states) {
    const p = baseline.P[stateId]?.[endIdx] ?? 0;
    const v = goodnessOf(byId.get(stateId)!);
    mean += p * v;
    if (v <= floorG) floor += p;
    if (v >= ceilG) ceiling += p;
  }

  return {
    graphVersion: graph.graphVersion,
    stateMarginals,
    goodnessAtEndYear: { mean: round4(mean), floor: round4(floor), ceiling: round4(ceiling) },
  };
}

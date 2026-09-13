/**
 * Authoring core — model file contract (stage 2 of the v3 plan).
 *
 * A model is data: parameters (sourced, optionally ranged), exogenous inputs (curves), variables
 * (equations, stocks, hooks), effects that attach to hooks, scalar equilibrium blocks, optional
 * entities with cross-entity aggregates, outputs, and reproduction tests. Overlays add effects,
 * inputs, parameters or new variables on top of a base model without rewriting its equations;
 * replacing an existing equation is a structural fork, not an overlay.
 *
 * Expression language: the mathjs subset allowed by src/core/expr.ts. Lags are written inline as
 * `x[t-1]`. Aggregates over entities are `sum(x)`, `mean(x)`, `min(x)`, `max(x)` where x is a
 * variable; inside an entity expression they refer to all entities' values of x at the same step.
 * `t` is the step index (0 at start) and `year` the calendar year (fractional for monthly models).
 */

export type StepUnit = 'year' | 'month';

export type EvidenceKind = 'causal' | 'associational' | 'calibrated' | 'elicited' | 'assumed' | 'guess';

export interface Source {
  label: string;
  /** What kind of claim the number is. Defaults to 'assumed' if omitted. */
  kind?: EvidenceKind;
  url?: string;
  note?: string;
}

/** Uncertainty literal: p5 and p95 of the declared shape. Sampled once per Monte Carlo run. */
export interface Range {
  dist: 'normal' | 'lognormal' | 'uniform';
  p5: number;
  p95: number;
}

export interface Parameter {
  id: string;
  value: number;
  unit?: string;
  range?: Range;
  source: Source;
  /** Per-entity overrides of `value`. */
  byEntity?: Record<string, number>;
  /** Hard bounds the sampled value is clamped to (e.g. probabilities). */
  bounds?: [number, number];
}

export interface Input {
  id: string;
  unit?: string;
  /** Sparse curve keyed by calendar year (string), e.g. {"2026": 0.1, "2030": 0.45}. */
  curve: Record<string, number>;
  /** How to interpolate between keys. 'logodds' is for probabilities. Default 'linear'. */
  interp?: 'linear' | 'step' | 'logodds';
  /** Behaviour outside the keyed range. 'hold' (default) holds the end values; 'error' fails the run. */
  outside?: 'hold' | 'error';
  byEntity?: Record<string, Record<string, number>>;
  source?: Source;
}

export interface Variable {
  id: string;
  unit?: string;
  /** Expression evaluated each step. Stocks reference their own lag, e.g. `capital[t-1] * (1 - d) + invest`. */
  equation: string;
  /** Marks a stock: `initial` is the value at t = 0 and the equation applies for t >= 1. */
  initial?: number | string;
  /** Values for t < 0 needed by lags deeper than the available history. index 0 = t-1, 1 = t-2, ... */
  history?: number[];
  /** Whether effects may attach here. Default true. */
  hook?: boolean;
  /** Plain-English meaning, shown in the UI. */
  description?: string;
}

export interface Effect {
  id: string;
  /** Variable id the effect attaches to (must have hook !== false). */
  target: string;
  /** add: summed then added to the target's base value; multiply: product applied after adds. */
  op: 'add' | 'multiply';
  expr: string;
  unit?: string;
  source: Source;
  /** Optional: apply only from this calendar year. */
  from?: number;
}

/** Scalar equilibrium: find `unknown` in `bracket` such that `residual` = 0 (bisection). */
export interface SolveBlock {
  id: string;
  unknown: string;
  residual: string;
  bracket: [number, number];
  tol?: number;
  maxIter?: number;
  unit?: string;
  description?: string;
}

export interface ModelTest {
  name: string;
  /** Calendar year at which to evaluate. */
  at: number;
  entity?: string;
  expr: string;
  expected: number;
  /** Absolute tolerance. */
  tol: number;
}

export interface Entities {
  kind: string;
  ids: string[];
  /** Role name -> entity id, or an expression over entity parameters (`argmax(chipShare)`). */
  roles?: Record<string, string>;
}

export interface CoreModel {
  schemaVersion: 1;
  id: string;
  name: string;
  description?: string;
  /** Free text: what this model can and cannot say. Shown before results. */
  scope?: string;
  license?: string;
  sources?: Source[];
  time: { start: number; end: number; step: StepUnit };
  entities?: Entities;
  parameters: Parameter[];
  inputs?: Input[];
  variables: Variable[];
  effects?: Effect[];
  solves?: SolveBlock[];
  outputs: string[];
  tests?: ModelTest[];
}

/** An overlay adds to a base model. It may not replace an existing variable's equation. */
export interface Overlay {
  id: string;
  name?: string;
  description?: string;
  parameters?: Array<Partial<Parameter> & { id: string }>;
  inputs?: Input[];
  variables?: Variable[];
  effects?: Effect[];
  solves?: SolveBlock[];
  outputs?: string[];
  tests?: ModelTest[];
}

// ---------------------------------------------------------------------------
// Results and diagnostics
// ---------------------------------------------------------------------------

export interface Diagnostic {
  level: 'error' | 'warning';
  code:
    | 'unknown-symbol'
    | 'cycle'
    | 'missing-history'
    | 'duplicate-id'
    | 'unit-mismatch'
    | 'no-hook'
    | 'structural-change'
    | 'solve-no-root'
    | 'solve-no-convergence'
    | 'input-out-of-range'
    | 'disconnected'
    | 'non-finite'
    | 'missing-source'
    | 'parse';
  message: string;
  /** Element id the diagnostic is about. */
  where?: string;
  entity?: string;
  step?: number;
}

/** Which argument of a min()/max() call was active. One entry per call in the equation, in source order. */
export interface BindingRecord {
  fn: 'min' | 'max';
  /** Source text of each argument. */
  args: string[];
  /** Index of the active argument per step (or -1 if the call was not reached). */
  activeArg: number[];
}

export interface SolveRecord {
  status: 'ok' | 'no-root' | 'no-convergence';
  iterations: number[];
  residual: number[];
}

export interface RunResult {
  ok: boolean;
  diagnostics: Diagnostic[];
  /** Step index -> calendar year (fractional for months). */
  years: number[];
  /** entity -> variable/input/parameter id -> series. Single-entity models use entity "_". */
  series: Record<string, Record<string, number[]>>;
  /** Aggregate series by expression key, e.g. "sum(gdp)". */
  aggregates: Record<string, number[]>;
  /** entity -> variable -> min/max binding records. */
  binding: Record<string, Record<string, BindingRecord[]>>;
  /** solve id -> record (per entity). */
  solves: Record<string, Record<string, SolveRecord>>;
  /** Resolved parameter values actually used (after entity overrides and sampling). */
  parameters: Record<string, Record<string, number>>;
  manifest: RunManifest;
}

export interface RunManifest {
  modelId: string;
  overlayIds: string[];
  /** Stable hash of the resolved model + overlays + seed. */
  hash: string;
  seed: number | null;
  engineVersion: string;
  createdAt: string;
}

export interface MonteCarloResult {
  ok: boolean;
  diagnostics: Diagnostic[];
  years: number[];
  runs: number;
  /** entity -> variable -> quantile -> series. Quantiles: p5, p25, p50, p75, p95, mean. */
  quantiles: Record<string, Record<string, Record<'p5' | 'p25' | 'p50' | 'p75' | 'p95' | 'mean', number[]>>>;
  manifest: RunManifest;
}

export interface TestOutcome {
  name: string;
  passed: boolean;
  actual: number | null;
  expected: number;
  tol: number;
  message: string;
}

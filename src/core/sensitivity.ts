/**
 * Authoring core — sensitivity protocol (v3 section 6, "investigate small nudges and large responses").
 *
 * Three probes, all pure, all built on runModel; no statistics library, nothing fitted.
 *
 *   sweep(model, {parameter, grid|steps, output, at})
 *       Re-runs the model once per grid value and reports, at one calendar year: the output, the
 *       absolute change from baseline, the relative change (null when the baseline is ~0 rather
 *       than a meaningless huge percentage), which min()/max() argument was binding there, and a
 *       classification of the response curve.
 *
 *   neighbourhood(model, parameter, {output})
 *       The same knob nudged by +/-1% and +/-10%. Comparing the two scales is the cheap test for
 *       "small nudge, large response": if the 10% response is far more than ten times the 1%
 *       response the model is amplifying near this point; far less and something is capping it.
 *
 *   interactions(model, [p1, p2], {output})
 *       A 3x3 joint grid. For each off-axis cell it compares the joint response with the sum of
 *       the two single responses and reports the excess. More than 10% excess means the two knobs
 *       are not separable and single-parameter sweeps understate what the pair can do.
 *
 * Classification (classifyShape), in the order the tests are applied:
 *   flat          the whole curve moves less than flatTol of its own magnitude.
 *   threshold     one adjacent-grid step carries at least jumpShare of the entire response — an
 *                 eligibility cliff, a discrete switch, or a solver changing branch.
 *   non-monotone  the response goes both up and down.
 *   saturating    the slope over the last third of the grid has fallen to plateauTol or less of
 *                 the slope over the first third — a capacity plateau.
 *   linear        none of the above. A calm, monotone, roughly proportional curve.
 *
 * The point of the classification is that a calm curve and a cliff must not look the same. A
 * harness that rewards smooth output would pass a fabricated cap and a real capacity limit alike;
 * this one names which it saw and, for a min()/max() cap, which argument bound.
 */

import { explainBinding, resolveModel, runModel } from './engine';
import type { CoreModel, Overlay, RunResult } from './types';

// ---------------------------------------------------------------------------
// Shape classification
// ---------------------------------------------------------------------------

export type ResponseShape = 'flat' | 'linear' | 'saturating' | 'threshold' | 'non-monotone';

export interface ShapeOptions {
  /** Span below which the curve counts as flat, relative to its own magnitude. Default 1e-3. */
  flatTol?: number;
  /** Share of the total response one adjacent step must carry to be a threshold. Default 0.6. */
  jumpShare?: number;
  /** Fraction of the opening slope the closing slope must fall to for a plateau. Default 0.1. */
  plateauTol?: number;
}

export interface ShapeDetail {
  shape: ResponseShape;
  /** max(y) - min(y) over the grid. */
  span: number;
  /** Largest single-step |change| divided by the span. 1 means one step did everything. */
  maxStepShare: number;
  /** Index of the grid interval carrying that step (i -> between points i and i+1). */
  jumpAt: number;
  /** Mean |slope| over the first and last third of the grid. */
  openSlope: number;
  closeSlope: number;
  monotone: 'up' | 'down' | 'none';
  /** Why this shape was chosen, in one line. */
  reason: string;
}

const DEFAULT_SHAPE: Required<ShapeOptions> = { flatTol: 1e-3, jumpShare: 0.6, plateauTol: 0.1 };

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Classify a response curve from its grid values alone. `ys` must be finite and ordered by `xs`. */
export function classifyShape(ys: number[], opts: ShapeOptions = {}): ShapeDetail {
  const o = { ...DEFAULT_SHAPE, ...opts };
  const n = ys.length;
  const base: ShapeDetail = { shape: 'linear', span: 0, maxStepShare: 0, jumpAt: -1, openSlope: 0, closeSlope: 0, monotone: 'none', reason: '' };
  if (n < 2 || ys.some((y) => !Number.isFinite(y))) {
    return { ...base, reason: 'not enough finite grid points to classify' };
  }
  const ymin = Math.min(...ys);
  const ymax = Math.max(...ys);
  const span = ymax - ymin;
  const scale = Math.max(Math.abs(ymax), Math.abs(ymin), 1e-12);
  if (span <= o.flatTol * scale) {
    return { ...base, shape: 'flat', span, reason: `the output moves by ${span.toPrecision(3)}, under ${o.flatTol * 100}% of its own size` };
  }
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push(ys[i + 1] - ys[i]);
  const eps = 1e-9 * span;
  const abs = d.map(Math.abs);
  const maxAbs = Math.max(...abs);
  const jumpAt = abs.indexOf(maxAbs);
  const maxStepShare = maxAbs / span;
  const up = d.some((x) => x > eps);
  const down = d.some((x) => x < -eps);
  const k = Math.max(1, Math.floor(d.length / 3));
  const openSlope = mean(abs.slice(0, k));
  const closeSlope = mean(abs.slice(d.length - k));
  const monotone: ShapeDetail['monotone'] = up && down ? 'none' : up ? 'up' : 'down';
  const detail: ShapeDetail = { shape: 'linear', span, maxStepShare, jumpAt, openSlope, closeSlope, monotone, reason: '' };

  if (n >= 4 && maxStepShare >= o.jumpShare) {
    return { ...detail, shape: 'threshold', reason: `one step of the grid (interval ${jumpAt}) carries ${(maxStepShare * 100).toFixed(0)}% of the whole response` };
  }
  if (up && down) {
    return { ...detail, shape: 'non-monotone', reason: 'the response changes direction inside the grid' };
  }
  if (openSlope > eps && closeSlope <= o.plateauTol * openSlope) {
    return { ...detail, shape: 'saturating', reason: `the slope falls from ${openSlope.toPrecision(3)} per step to ${closeSlope.toPrecision(3)}; more of this input stops buying output` };
  }
  return { ...detail, shape: 'linear', reason: 'monotone with no plateau and no jump' };
}

// ---------------------------------------------------------------------------
// Running one point of a sweep
// ---------------------------------------------------------------------------

export interface ProbeOptions {
  /** Overlays applied before the sweep; the swept knob may come from one of them. */
  overlays?: Overlay[];
  /** Variable, input, parameter or solve-unknown id to read. `sum(x)` / `mean(x)` read an aggregate. */
  output: string;
  /** Entity to read; defaults to the model's first entity ("_" for single-entity models). */
  entity?: string;
  /** Calendar year to read at; defaults to the model's end year. */
  at?: number;
  shape?: ShapeOptions;
}

const AGG_RE = /^(sum|mean|min|max)\(([A-Za-z_]\w*)\)$/;

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

/**
 * A model with one knob moved. A parameter takes the value directly (per-entity overrides keep
 * their ratio to the base, the same rule the Monte Carlo sampler uses). An input is replaced by a
 * flat curve at that level, which is what "how much budget" means for a sweep.
 */
function withKnob(model: CoreModel, knob: string, value: number): { model: CoreModel; kind: 'parameter' | 'input' } | null {
  const next = clone(model);
  const p = next.parameters.find((x) => x.id === knob);
  if (p) {
    if (p.byEntity && p.value !== 0) {
      const ratio = value / p.value;
      for (const e of Object.keys(p.byEntity)) p.byEntity[e] *= ratio;
    }
    p.value = value;
    return { model: next, kind: 'parameter' };
  }
  const i = (next.inputs ?? []).find((x) => x.id === knob);
  if (i) {
    i.curve = { [String(model.time.start)]: value };
    delete i.byEntity;
    i.outside = 'hold';
    return { model: next, kind: 'input' };
  }
  return null;
}

function indexAt(result: RunResult, at: number | undefined): number {
  if (at === undefined) return result.years.length - 1;
  const i = result.years.findIndex((y) => Math.abs(y - at) < 1e-9);
  return i;
}

interface Reading {
  ok: boolean;
  value: number;
  binding: string[];
  errors: string[];
  year: number;
}

function read(model: CoreModel, opts: ProbeOptions): Reading {
  const result = runModel(model, { overlays: [] });
  if (!result.ok) {
    return { ok: false, value: NaN, binding: [], year: NaN, errors: result.diagnostics.filter((d) => d.level === 'error').map((d) => `${d.code}: ${d.message}`) };
  }
  const t = indexAt(result, opts.at);
  if (t < 0) return { ok: false, value: NaN, binding: [], year: NaN, errors: [`year ${opts.at} is not a step of this model`] };
  const entity = opts.entity ?? Object.keys(result.series)[0];
  const agg = AGG_RE.exec(opts.output);
  let value: number;
  if (agg) {
    value = result.aggregates[`__agg_${agg[1]}_${agg[2]}`]?.[t] ?? NaN;
  } else {
    value = result.series[entity]?.[opts.output]?.[t] ?? NaN;
  }
  if (!Number.isFinite(value)) {
    return { ok: false, value: NaN, binding: [], year: result.years[t], errors: [`output "${opts.output}" has no finite value for ${entity} at year ${result.years[t]}`] };
  }
  return { ok: true, value, binding: agg ? [] : explainBinding(result, entity, opts.output, t), errors: [], year: result.years[t] };
}

// ---------------------------------------------------------------------------
// sweep
// ---------------------------------------------------------------------------

export interface SweepOptions extends ProbeOptions {
  /** Parameter or input id to move. */
  parameter: string;
  /** Explicit grid values. Sorted ascending before running. */
  grid?: number[];
  /** Points in the generated grid when `grid` is omitted. Default 9. */
  steps?: number;
  /** Half-width of the generated grid as a fraction of the baseline value. Default 0.5 (+/-50%). */
  spread?: number;
}

export interface SweepPoint {
  /** Grid value of the swept knob. */
  value: number;
  output: number;
  /** output - baseline. */
  absChange: number;
  /** absChange / |baseline|, or null when the baseline is too near zero for a ratio to mean anything. */
  relChange: number | null;
  /** Which min()/max() argument was active for the output variable here, in plain English. */
  binding: string[];
  ok: boolean;
  errors: string[];
}

export interface SweepResult {
  ok: boolean;
  /** The swept knob. */
  parameter: string;
  kind: 'parameter' | 'input' | 'unknown';
  output: string;
  entity: string;
  /** Calendar year read. */
  at: number;
  /** Baseline value of the knob. */
  baselineValue: number;
  /** Baseline value of the output. */
  baseline: number;
  points: SweepPoint[];
  shape: ResponseShape;
  detail: ShapeDetail;
  /** Distinct binding explanations seen across the grid, in first-seen order. */
  bindingSummary: string[];
  errors: string[];
  notes: string[];
}

/** Baselines are treated as zero for relative change below this fraction of the output's own span. */
const REL_EPS = 1e-9;

function relativeChange(baseline: number, absChange: number): number | null {
  if (!Number.isFinite(baseline) || Math.abs(baseline) <= REL_EPS) return null;
  return absChange / Math.abs(baseline);
}

function emptySweep(parameter: string, opts: ProbeOptions, errors: string[]): SweepResult {
  return {
    ok: false, parameter, kind: 'unknown', output: opts.output, entity: opts.entity ?? '_', at: opts.at ?? NaN,
    baselineValue: NaN, baseline: NaN, points: [], shape: classifyShape([]).shape,
    detail: classifyShape([]), bindingSummary: [], errors, notes: [],
  };
}

/** v3 section 6: move one knob across a grid and report what the model did, not just that it moved. */
export function sweep(base: CoreModel, opts: SweepOptions): SweepResult {
  const notes: string[] = [];
  const { model } = resolveModel(base, opts.overlays ?? []);
  const baselineRead = read(model, opts);
  if (!baselineRead.ok) return emptySweep(opts.parameter, opts, [`baseline run failed: ${baselineRead.errors.join('; ')}`]);

  const param = model.parameters.find((p) => p.id === opts.parameter);
  const input = (model.inputs ?? []).find((i) => i.id === opts.parameter);
  if (!param && !input) return emptySweep(opts.parameter, opts, [`"${opts.parameter}" is not a parameter or input of this model`]);
  const kind: 'parameter' | 'input' = param ? 'parameter' : 'input';

  // Baseline knob value: a parameter's point value, or what the input curve actually reached at `at`.
  let baselineValue: number;
  if (param) baselineValue = param.value;
  else {
    const r = read(model, { ...opts, output: opts.parameter });
    baselineValue = r.ok ? r.value : NaN;
    notes.push(`"${opts.parameter}" is an input: each grid value replaces its whole curve with that constant level`);
  }

  let grid: number[];
  if (opts.grid?.length) {
    grid = [...opts.grid].sort((a, b) => a - b);
  } else {
    const steps = Math.max(3, opts.steps ?? 9);
    const spread = opts.spread ?? 0.5;
    if (!Number.isFinite(baselineValue) || baselineValue === 0) {
      grid = Array.from({ length: steps }, (_, i) => -1 + (2 * i) / (steps - 1));
      notes.push('the baseline value is zero, so the generated grid runs from -1 to 1 in absolute terms');
    } else {
      const lo = baselineValue * (1 - spread);
      const hi = baselineValue * (1 + spread);
      grid = Array.from({ length: steps }, (_, i) => lo + ((hi - lo) * i) / (steps - 1));
    }
  }

  const points: SweepPoint[] = [];
  const errors: string[] = [];
  for (const value of grid) {
    const moved = withKnob(model, opts.parameter, value);
    if (!moved) { errors.push(`cannot move "${opts.parameter}"`); continue; }
    const r = read(moved.model, opts);
    const absChange = r.ok ? r.value - baselineRead.value : NaN;
    points.push({
      value,
      output: r.value,
      absChange,
      relChange: r.ok ? relativeChange(baselineRead.value, absChange) : null,
      binding: r.binding,
      ok: r.ok,
      errors: r.errors,
    });
    if (!r.ok) errors.push(`at ${opts.parameter} = ${value}: ${r.errors.join('; ')}`);
  }

  const usable = points.filter((p) => p.ok);
  const detail = classifyShape(usable.map((p) => p.output), opts.shape);
  const bindingSummary: string[] = [];
  for (const p of points) for (const b of p.binding) if (!bindingSummary.includes(b)) bindingSummary.push(b);
  if (usable.length < points.length) notes.push(`${points.length - usable.length} of ${points.length} grid points failed to run; the classification uses the rest`);
  if (relativeChange(baselineRead.value, 0) === null) notes.push('the baseline output is ~0, so relative changes are reported as null rather than as huge percentages');

  return {
    ok: errors.length === 0,
    parameter: opts.parameter,
    kind,
    output: opts.output,
    entity: opts.entity ?? model.entities?.ids?.[0] ?? '_',
    at: baselineRead.year,
    baselineValue,
    baseline: baselineRead.value,
    points,
    shape: detail.shape,
    detail,
    bindingSummary,
    errors,
    notes,
  };
}

// ---------------------------------------------------------------------------
// neighbourhood
// ---------------------------------------------------------------------------

export interface NeighbourhoodArm {
  /** Knob value used. */
  value: number;
  output: number;
  abs: number;
  rel: number | null;
  ok: boolean;
  errors: string[];
}

export interface NeighbourhoodScale {
  /** 0.01 for +/-1%, 0.10 for +/-10%. */
  fraction: number;
  down: NeighbourhoodArm;
  up: NeighbourhoodArm;
  /** Largest |absolute response| at this scale. */
  maxAbs: number;
  /** |up.abs| / |down.abs|; far from 1 means the response is one-sided (a bound or a kink nearby). */
  asymmetry: number | null;
}

export interface NeighbourhoodResult {
  ok: boolean;
  parameter: string;
  output: string;
  at: number;
  baseline: number;
  baselineValue: number;
  scales: NeighbourhoodScale[];
  /**
   * Per direction: the large-scale response divided by what the small nudge predicts if the
   * response were proportional. ~1 locally linear; well under 1 means something caps the response
   * between the two scales; well over 1 means the small nudge understates a real-sized move.
   */
  linearityUp: number | null;
  linearityDown: number | null;
  /** Whichever of the two is furthest from 1 — the direction worth explaining. */
  linearity: number | null;
  note: string;
  errors: string[];
}

/** The two scales v3 section 6 asks for: a 1% nudge and a 10% move, reported side by side. */
export function neighbourhood(
  base: CoreModel,
  parameter: string,
  opts: ProbeOptions & { fractions?: [number, number] },
): NeighbourhoodResult {
  const fractions = opts.fractions ?? [0.01, 0.1];
  const { model } = resolveModel(base, opts.overlays ?? []);
  const baselineRead = read(model, opts);
  const param = model.parameters.find((p) => p.id === parameter);
  const isInput = !param && (model.inputs ?? []).some((i) => i.id === parameter);
  const errors: string[] = [];
  let baselineValue = NaN;
  if (param) baselineValue = param.value;
  else if (isInput) { const r = read(model, { ...opts, output: parameter }); baselineValue = r.ok ? r.value : NaN; }
  else errors.push(`"${parameter}" is not a parameter or input of this model`);
  if (!baselineRead.ok) errors.push(`baseline run failed: ${baselineRead.errors.join('; ')}`);

  const arm = (value: number): NeighbourhoodArm => {
    const moved = withKnob(model, parameter, value);
    if (!moved) return { value, output: NaN, abs: NaN, rel: null, ok: false, errors: [`cannot move "${parameter}"`] };
    const r = read(moved.model, opts);
    const abs = r.ok ? r.value - baselineRead.value : NaN;
    return { value, output: r.value, abs, rel: r.ok ? relativeChange(baselineRead.value, abs) : null, ok: r.ok, errors: r.errors };
  };

  const scales: NeighbourhoodScale[] = [];
  if (errors.length === 0) {
    for (const fraction of fractions) {
      const delta = baselineValue === 0 ? fraction : baselineValue * fraction;
      const down = arm(baselineValue - delta);
      const up = arm(baselineValue + delta);
      const maxAbs = Math.max(Math.abs(down.abs) || 0, Math.abs(up.abs) || 0);
      const asymmetry = Math.abs(down.abs) > 1e-12 ? Math.abs(up.abs) / Math.abs(down.abs) : null;
      scales.push({ fraction, down, up, maxAbs, asymmetry });
    }
  }

  let linearityUp: number | null = null;
  let linearityDown: number | null = null;
  let linearity: number | null = null;
  let note = '';
  if (scales.length === 2) {
    const [small, large] = scales;
    const step = large.fraction / small.fraction;
    const ratio = (s: number, l: number): number | null => (Math.abs(s) > 1e-12 ? Math.abs(l) / (step * Math.abs(s)) : null);
    linearityUp = ratio(small.up.abs, large.up.abs);
    linearityDown = ratio(small.down.abs, large.down.abs);
    const candidates = [linearityUp, linearityDown].filter((x): x is number => x !== null && Number.isFinite(x));
    linearity = candidates.length ? candidates.reduce((a, b) => (Math.abs(b - 1) > Math.abs(a - 1) ? b : a)) : null;
    if (linearity === null) note = 'the small nudge did nothing measurable, so the two scales cannot be compared';
    else if (linearity > 1.2) note = `the ${large.fraction * 100}% move does ${linearity.toFixed(2)}x what the ${small.fraction * 100}% nudge predicts: the response grows with the size of the move`;
    else if (linearity < 0.8) note = `the ${large.fraction * 100}% move does only ${linearity.toFixed(2)}x what the ${small.fraction * 100}% nudge predicts: something caps the response between the two scales`;
    else note = 'the response is proportional at both scales';
  }

  return {
    ok: errors.length === 0 && scales.every((s) => s.up.ok && s.down.ok),
    parameter, output: opts.output, at: baselineRead.year, baseline: baselineRead.value, baselineValue,
    scales, linearityUp, linearityDown, linearity, note, errors,
  };
}

// ---------------------------------------------------------------------------
// interactions
// ---------------------------------------------------------------------------

export interface InteractionCell {
  v1: number;
  v2: number;
  /** Output with both knobs moved. */
  joint: number;
  /** Output with only the first knob moved, and only the second. */
  single1: number;
  single2: number;
  /** The two single responses and their sum, as changes from baseline. */
  delta1: number;
  delta2: number;
  sumDelta: number;
  jointDelta: number;
  /** baseline + sumDelta: what the two single sweeps predict together. */
  additive: number;
  /**
   * (|jointDelta| - |sumDelta|) divided by the largest response in play, so a cell where the two
   * singles happen to cancel cannot produce a meaningless ratio. Positive means the pair does more
   * than the sum of its parts; Infinity means neither knob moves the output alone but both do.
   */
  excess: number | null;
  ok: boolean;
}

export interface InteractionResult {
  ok: boolean;
  parameters: [string, string];
  output: string;
  at: number;
  baseline: number;
  /** Relative size of the move applied to each knob. Default 0.1. */
  fraction: number;
  cells: InteractionCell[];
  /** Largest excess over the grid. */
  maxExcess: number | null;
  /** True when the joint response beats the sum of the singles by more than `threshold`. */
  interacts: boolean;
  threshold: number;
  note: string;
  errors: string[];
}

/** Joint response of two knobs against the sum of their separate responses, on a 3x3 grid. */
export function interactions(
  base: CoreModel,
  pair: [string, string],
  opts: ProbeOptions & { fraction?: number; threshold?: number },
): InteractionResult {
  const fraction = opts.fraction ?? 0.1;
  const threshold = opts.threshold ?? 0.1;
  const { model } = resolveModel(base, opts.overlays ?? []);
  const baselineRead = read(model, opts);
  const errors: string[] = [];
  if (!baselineRead.ok) errors.push(`baseline run failed: ${baselineRead.errors.join('; ')}`);

  const valueOf = (id: string): number => {
    const p = model.parameters.find((x) => x.id === id);
    if (p) return p.value;
    const r = read(model, { ...opts, output: id });
    return r.ok ? r.value : NaN;
  };
  const b1 = valueOf(pair[0]);
  const b2 = valueOf(pair[1]);
  for (const id of pair) {
    if (!model.parameters.some((p) => p.id === id) && !(model.inputs ?? []).some((i) => i.id === id)) {
      errors.push(`"${id}" is not a parameter or input of this model`);
    }
  }

  const at = (v1: number | null, v2: number | null): Reading => {
    let m = model;
    if (v1 !== null) { const s = withKnob(m, pair[0], v1); if (!s) return { ok: false, value: NaN, binding: [], errors: [`cannot move "${pair[0]}"`], year: NaN }; m = s.model; }
    if (v2 !== null) { const s = withKnob(m, pair[1], v2); if (!s) return { ok: false, value: NaN, binding: [], errors: [`cannot move "${pair[1]}"`], year: NaN }; m = s.model; }
    return read(m, opts);
  };

  const cells: InteractionCell[] = [];
  let maxExcess: number | null = null;
  if (errors.length === 0) {
    const offsets = [-fraction, fraction];
    for (const f1 of offsets) {
      for (const f2 of offsets) {
        const v1 = b1 === 0 ? f1 : b1 * (1 + f1);
        const v2 = b2 === 0 ? f2 : b2 * (1 + f2);
        const joint = at(v1, v2);
        const s1 = at(v1, null);
        const s2 = at(null, v2);
        const ok = joint.ok && s1.ok && s2.ok;
        const delta1 = s1.value - baselineRead.value;
        const delta2 = s2.value - baselineRead.value;
        const sumDelta = delta1 + delta2;
        const jointDelta = joint.value - baselineRead.value;
        const additive = baselineRead.value + sumDelta;
        const tiny = 1e-12 * Math.max(1, Math.abs(baselineRead.value));
        const scale = Math.max(Math.abs(sumDelta), Math.abs(delta1), Math.abs(delta2));
        let excess: number | null = null;
        if (ok) {
          if (scale <= tiny) excess = Math.abs(jointDelta) > tiny ? Infinity : 0;
          else excess = (Math.abs(jointDelta) - Math.abs(sumDelta)) / scale;
        }
        cells.push({ v1, v2, joint: joint.value, single1: s1.value, single2: s2.value, delta1, delta2, sumDelta, jointDelta, additive, excess, ok });
        if (excess !== null) maxExcess = maxExcess === null ? excess : Math.max(maxExcess, excess);
        if (!ok) errors.push(`cell (${v1}, ${v2}) failed: ${[...joint.errors, ...s1.errors, ...s2.errors].join('; ')}`);
      }
    }
  }

  const interacts = maxExcess !== null && maxExcess > threshold;
  const note = maxExcess === null
    ? 'no cell could be evaluated, so there is nothing to add up'
    : maxExcess === Infinity
      ? 'neither knob alone moves the output at this scale, but moving both together does: the pair is doing something neither single sweep can see'
      : interacts
        ? `moving both together beats the sum of moving each alone by up to ${(maxExcess * 100).toFixed(0)}%: these knobs are not separable, and single sweeps understate the pair`
        : `the joint response is within ${(threshold * 100).toFixed(0)}% of the sum of the singles: the two knobs are separable here`;

  return {
    ok: errors.length === 0, parameters: pair, output: opts.output, at: baselineRead.year,
    baseline: baselineRead.value, fraction, cells, maxExcess, interacts, threshold, note, errors,
  };
}

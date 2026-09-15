import type { CoreModel } from './types';

/**
 * Hard execution limits for the authoring core.
 *
 * The engine enforces these itself (a model file, an imported model or a shared link cannot raise
 * them), and the UI checks run settings against the same numbers before it starts anything, so an
 * oversized request is refused with a `limit-exceeded` diagnostic instead of hanging the tab.
 *
 * Why these numbers (measured on the bundled fixtures, 2026-09-14):
 *   - maxSteps 5,000: the largest bundled model has 73 steps; 5,000 is 400 years monthly.
 *   - maxEntities 500: the largest has 26 (Gasteiger-Prettner's tax grid).
 *   - maxDraws 2,000: the Policy panel's own ceiling; the Lab band uses 200.
 *   - maxSolverIterations 1,000 per solve: bundled solves declare at most 200; bisection on a
 *     double halves the bracket 1,074 times before it cannot narrow further.
 *   - maxWallClockMs 60,000 per job: the slowest bundled model (Gasteiger-Prettner) takes ~240 ms per
 *     run, Korinek faithful ~60 ms; 200 draws of either finish well inside it.
 */

export interface RunLimits {
  /** Declaration/source/retention bounds applied before expression compilation. */
  maxVariables: number;
  maxSourceChars: number;
  maxExpressionChars: number;
  maxRetainedCells: number;
  maxWorkUnits: number;
  /** Steps per run (time.end - time.start in engine steps, inclusive). */
  maxSteps: number;
  /** Entities per model. */
  maxEntities: number;
  /** Monte Carlo draws per request (a paired run counts its draws once, not per side). */
  maxDraws: number;
  /** Bisection iterations one solve block may declare (maxIter). */
  maxSolverIterations: number;
  /** Wall-clock budget for one run request (all its draws), in milliseconds. */
  maxWallClockMs: number;
}

export const RUN_LIMITS: Readonly<RunLimits> = Object.freeze({
  // A retained cell is budgeted at 64 bytes (numbers, arrays, binding records and overhead).
  // 4M cells = 256 MB per request. Work includes solve iterations and expression complexity.
  maxVariables: 1_000,
  maxSourceChars: 250_000,
  maxExpressionChars: 4_096,
  maxRetainedCells: 4_000_000,
  // Character-weighted scalar work, deliberately conservative; the wall-clock limit also applies.
  // This accommodates the existing GP fine grids and faithful Korinek fixtures without exceptions.
  maxWorkUnits: 20_000_000_000,
  maxSteps: 5_000,
  maxEntities: 500,
  maxDraws: 2_000,
  maxSolverIterations: 1_000,
  maxWallClockMs: 60_000,
});

/** Callers may tighten a limit (tests do), never loosen one. */
export function effectiveLimits(override?: Partial<RunLimits>): RunLimits {
  const out = { ...RUN_LIMITS };
  if (override) {
    for (const k of Object.keys(out) as Array<keyof RunLimits>) {
      const v = override[k];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = Math.min(out[k], v);
    }
  }
  return out;
}

/** Number of engine steps a time block asks for, without allocating anything. */
export function stepCount(time: { start: number; end: number; step: string } | undefined): number {
  if (!time || !Number.isFinite(time.start) || !Number.isFinite(time.end)) return NaN;
  const perUnit = time.step === 'month' ? 12 : 1;
  return Math.round((time.end - time.start) * perUnit) + 1;
}

export interface LimitProblem {
  code: 'limit-exceeded';
  limit: keyof RunLimits | 'seed';
  message: string;
}

/**
 * Check run settings against the limits BEFORE executing: the draw count, the seed, and the size of
 * the model (steps, entities, declared solver iterations). Used for shared links and bundles, whose
 * settings come from outside the app, and for the Run buttons.
 */
export function checkRunSettings(
  settings: { runs?: number; seed?: number; model?: Partial<CoreModel>; sides?: number; retainedJobs?: number; ensemble?: boolean },
  override?: Partial<RunLimits>,
): LimitProblem[] {
  const limits = effectiveLimits(override);
  const out: LimitProblem[] = [];
  const { runs, seed, model } = settings;
  if (runs !== undefined && (!Number.isInteger(runs) || runs < 1 || runs > limits.maxDraws)) {
    out.push({ code: 'limit-exceeded', limit: 'maxDraws', message: `${String(runs)} draws requested; the limit is 1 to ${limits.maxDraws.toLocaleString('en-US')} draws per run` });
  }
  if (seed !== undefined && (!Number.isSafeInteger(seed))) {
    out.push({ code: 'limit-exceeded', limit: 'seed', message: `seed ${String(seed)} is not a safe integer` });
  }
  if (model) {
    const steps = stepCount(model.time);
    if (!Number.isFinite(steps) || steps < 1 || steps > limits.maxSteps) {
      out.push({ code: 'limit-exceeded', limit: 'maxSteps', message: `the model asks for ${Number.isFinite(steps) ? steps.toLocaleString('en-US') : 'an invalid number of'} steps; the limit is ${limits.maxSteps.toLocaleString('en-US')}` });
    }
    const entities = model.entities?.ids?.length ?? 1;
    if (entities > limits.maxEntities) {
      out.push({ code: 'limit-exceeded', limit: 'maxEntities', message: `the model has ${entities.toLocaleString('en-US')} entities; the limit is ${limits.maxEntities.toLocaleString('en-US')}` });
    }
    if (out.length) return out;
    const variables = model.variables?.length ?? 0;
    if (variables > limits.maxVariables) out.push({ code: 'limit-exceeded', limit: 'maxVariables', message: `${variables} variables; limit is ${limits.maxVariables}` });
    if (out.length) return out;
    // Bound the complete author-supplied source, including curves, metadata and declarations.
    // Visit incrementally (no JSON.stringify copy of an oversized model).
    let sourceSize = 0;
    const pending: unknown[] = [model];
    const visited = new Set<object>();
    while (pending.length && sourceSize <= limits.maxSourceChars) {
      const value = pending.pop();
      if (typeof value === 'string') sourceSize += value.length + 2;
      else if (value && typeof value === 'object') {
        if (visited.has(value)) continue;
        visited.add(value);
        for (const key in value) {
          const child = (value as Record<string, unknown>)[key];
          sourceSize += key.length + 4;
          if (sourceSize > limits.maxSourceChars) break;
          pending.push(child);
        }
      } else sourceSize += 16;
    }
    if (sourceSize > limits.maxSourceChars) return [...out, { code: 'limit-exceeded', limit: 'maxSourceChars', message: `model source exceeds ${limits.maxSourceChars} conservative characters` }];
    // Count source before parsing any expression; character count also bounds possible AST nodes.
    const expressions = [ ...(model.variables ?? []).flatMap(v => [v.equation, v.initial]),
      ...(model.effects ?? []).map(e => e.expr), ...(model.solves ?? []).map(s => s.residual),
      ...(model.tests ?? []).map(t => t.expr), ...(model.invariants ?? []).map(i => i.expr) ].filter((x): x is string => typeof x === 'string');
    let sourceChars = 0;
    for (const expression of expressions) {
      sourceChars += expression.length;
      let depth = 0, maxDepth = 0;
      for (const c of expression) { if (c === '(' || c === '[') maxDepth = Math.max(maxDepth, ++depth); else if (c === ')' || c === ']') depth--; }
      if (expression.length > limits.maxExpressionChars || maxDepth > 64) {
        out.push({ code: 'limit-exceeded', limit: 'maxExpressionChars', message: `expression exceeds ${limits.maxExpressionChars} characters or 64 nesting levels` }); break;
      }
    }
    if (sourceChars > limits.maxSourceChars) out.push({ code: 'limit-exceeded', limit: 'maxSourceChars', message: `expression source exceeds ${limits.maxSourceChars} characters` });
    const draws = model.parameters?.some(p => p.range) ? (runs ?? 1) : 1;
    const sides = settings.sides ?? 1;
    const jobs = settings.retainedJobs ?? 1;
    // Include inputs, all intermediate variables, solve records, aggregate/binding upper bounds,
    // point runs, and six quantile arrays per output (even when only one output is shown).
    const bindingCalls = expressions.reduce((n, e) => n + (e.match(/\b(?:min|max|sum|mean)\s*\(/g)?.length ?? 0), 0);
    const width = 1 + variables * 3 + bindingCalls + (model.parameters?.length ?? 0) + (model.inputs?.length ?? 0) + (model.solves?.length ?? 0) * 4;
    const cells = steps * entities * width * (draws + (settings.ensemble ? 7 : 0)) * sides * jobs;
    if (cells > limits.maxRetainedCells) out.push({ code: 'limit-exceeded', limit: 'maxRetainedCells', message: `${cells} conservative retained cells exceed ${limits.maxRetainedCells} (64 bytes per cell)` });
    const solveWork = (model.solves ?? []).reduce((n, s) => n + (s.maxIter ?? 100) * (s.residual.length + (s.through ?? []).reduce((a, id) => a + (model.variables?.find(v => v.id === id)?.equation.length ?? 0), 0)), 0);
    const work = steps * entities * (variables + sourceChars + solveWork) * draws * sides * jobs;
    if (work > limits.maxWorkUnits) out.push({ code: 'limit-exceeded', limit: 'maxWorkUnits', message: `${work} conservative work units exceed ${limits.maxWorkUnits}` });
    for (const s of model.solves ?? []) {
      if ((s.maxIter ?? 100) > limits.maxSolverIterations) {
        out.push({ code: 'limit-exceeded', limit: 'maxSolverIterations', message: `solve "${s.id}" declares maxIter ${s.maxIter}; the limit is ${limits.maxSolverIterations.toLocaleString('en-US')} iterations per solve` });
      }
    }
  }
  return out;
}

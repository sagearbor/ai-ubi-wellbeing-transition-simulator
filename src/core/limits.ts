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
  settings: { runs?: number; seed?: number; model?: { time?: { start: number; end: number; step: string }; entities?: { ids?: string[] }; solves?: Array<{ id: string; maxIter?: number }> } },
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
    for (const s of model.solves ?? []) {
      if ((s.maxIter ?? 100) > limits.maxSolverIterations) {
        out.push({ code: 'limit-exceeded', limit: 'maxSolverIterations', message: `solve "${s.id}" declares maxIter ${s.maxIter}; the limit is ${limits.maxSolverIterations.toLocaleString('en-US')} iterations per solve` });
      }
    }
  }
  return out;
}

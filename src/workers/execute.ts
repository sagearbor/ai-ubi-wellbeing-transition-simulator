/**
 * Job execution for the model runner, shared by the Web Worker and the synchronous fallback.
 *
 * Every job is a generator that yields { done, total } between units of work (a draw, a run), so:
 *   - executeAsync (the worker) runs a time slice, reports progress, yields to its event loop (where
 *     a cancel message can land) and checks cancellation and the wall-clock budget between slices;
 *   - executeSync (tests, SSR, browsers without workers) drains the same generator in one go.
 * Both check run settings against RUN_LIMITS before doing anything (preflight), and both run the
 * engine under a RunBudget, so a single long run also stops at the deadline, inside its step loop.
 */

import { budgetFor, budgetProblem, runModel, runTests, withRunBudget, monteCarloSteps, type RunBudget } from '../core/engine';
import { findFixture } from '../core/fixtures';
import { checkRunSettings, effectiveLimits, type LimitProblem, type RunLimits } from '../core/limits';
import { resolveModel } from '../core/engine';
import type { CoreModel } from '../core/types';
import { validateCoreModel, validateOverlay } from '../core/validate';
import { reopenBundle } from '../policy/bundle';
import { pairedRunSteps } from '../policy/draft';
import { modelHash } from '../policy/hash';
import type { PairedRunResult } from '../policy/types';
import type { LabPointResult, Progress, RunJob, RunOutcome } from './protocol';

const clock = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Settings that come from outside (a link, a bundle, a number field) checked before anything runs. */
export function preflight(job: RunJob, limits?: Partial<RunLimits>): LimitProblem[] {
  switch (job.kind) {
    case 'monte-carlo':
      return checkRunSettings({ runs: job.runs, seed: job.seed, ensemble: true, model: resolveModel(job.model, job.overlays).model }, limits);
    case 'paired':
      return checkRunSettings({ runs: job.runs, seed: job.seed, ensemble: true, sides: 3, retainedJobs: Math.max(1, job.drafts.length), model: resolveModel(job.model, job.overlays).model }, limits);
    case 'reopen-bundle': {
      const m = job.bundle?.manifest;
      const model = registryFor(job.models)(String(m?.modelId ?? ''), String(m?.modelHash ?? ''));
      return checkRunSettings({ runs: Number(m?.runs), seed: Number(m?.seed), ...(model ? { model: resolveModel(model, Array.isArray(job.bundle.overlays) ? job.bundle.overlays : []).model } : {}) }, limits);
    }
    case 'lab-point':
      return [job.overlays, job.hypotheticalOverlays ?? []].flatMap(overlays =>
        checkRunSettings({ model: resolveModel(job.model, overlays).model, sides: 4 }, limits));
    default:
      // Point runs and validation: the engine itself refuses a model over the step, entity or
      // solver limits, with a diagnostic the Lab lists like any other.
      return [];
  }
}

/** Extra models first (preferring the one whose version matches), then the bundled fixtures. */
export function registryFor(models: CoreModel[]): (id: string, hash?: string) => CoreModel | undefined {
  return (id, hash) => {
    const candidates = models.filter((m) => m?.id === id);
    return (hash ? candidates.find((m) => modelHash(m) === hash) : undefined) ?? candidates[0] ?? findFixture(id)?.model;
  };
}

/** The job as a generator of progress, returning its result. */
export function* jobSteps(job: RunJob, now: () => number = clock): Generator<Progress, unknown, void> {
  const problems = preflight(job);
  if (problems.length) throw new Error(problems.map(p => `[limit-exceeded] ${p.message}`).join('; '));
  switch (job.kind) {
    case 'lab-point': {
      const total = job.hypotheticalOverlays ? 4 : 3;
      const baseline = runModel(job.model);
      yield { done: 1, total };
      let t0 = now();
      const plain = runModel(job.model, { overlays: job.overlays });
      const plainMs = now() - t0;
      yield { done: 2, total };
      let hyp = null;
      let hypMs = 0;
      if (job.hypotheticalOverlays) {
        t0 = now();
        hyp = runModel(job.model, { overlays: job.hypotheticalOverlays });
        hypMs = now() - t0;
        yield { done: 3, total };
      }
      const outcomes = runTests(job.model, { overlays: job.hypotheticalOverlays ?? job.overlays });
      const result: LabPointResult = { baseline, plain, plainMs, hyp, hypMs, outcomes };
      return result;
    }
    case 'monte-carlo':
      return yield* monteCarloSteps(job.model, { overlays: job.overlays, runs: job.runs, seed: job.seed });
    case 'paired': {
      const runnable = job.drafts.filter((d) => d.modelId === job.model.id).length || 1;
      const text = job.sourceText.trim() ? job.sourceText : undefined;
      const out: Array<PairedRunResult | null> = [];
      let offset = 0;
      for (const d of job.drafts) {
        if (d.modelId !== job.model.id) {
          out.push(null);
          continue;
        }
        const gen = pairedRunSteps(job.model, job.overlays, d, { runs: job.runs, seed: job.seed, sourceText: text });
        let last = 0;
        for (;;) {
          const step = gen.next();
          if (step.done) {
            out.push(step.value as PairedRunResult);
            break;
          }
          const prog = step.value as Progress;
          last = prog.total;
          yield { done: offset + prog.done, total: prog.total * runnable };
        }
        offset += last;
      }
      return out;
    }
    case 'reopen-bundle': {
      const reg = registryFor(job.models);
      const hash = String(job.bundle?.manifest?.modelHash ?? '');
      return reopenBundle(job.bundle, (id) => reg(id, hash));
    }
    case 'validate-model':
      return validateCoreModel(job.json);
    case 'validate-overlay':
      return validateOverlay(job.base, job.json);
  }
}

function limitOutcome<R>(problems: LimitProblem[]): RunOutcome<R> {
  return { status: 'limit-exceeded', message: `Not run: ${problems.map((p) => p.message).join('; ')}.`, problems };
}

function stopOutcome<R>(budget: RunBudget): RunOutcome<R> | null {
  const stop = budgetProblem(budget);
  if (!stop) return null;
  return stop.code === 'cancelled' ? { status: 'cancelled', message: 'Cancelled.' } : { status: 'limit-exceeded', message: stop.message };
}

/** Run a job to completion on this thread (tests, SSR, no Worker). Same limits, same results. */
export function executeSync<R = unknown>(job: RunJob, opts: { limits?: Partial<RunLimits>; now?: () => number } = {}): RunOutcome<R> {
  if (activeAsyncJob) return { status: 'limit-exceeded', message: 'An asynchronous job currently reserves the execution memory budget.' };
  const now = opts.now ?? clock;
  const limits = effectiveLimits(opts.limits);
  const problems = preflight(job, limits);
  if (problems.length) return limitOutcome(problems);
  const t0 = now();
  const budget = budgetFor(limits.maxWallClockMs, { now, limits: opts.limits });
  try {
    const gen = jobSteps(job, now);
    for (;;) {
      const step = withRunBudget(budget, () => gen.next());
      const stop = stopOutcome<R>(budget);
      if (stop) return stop;
      if (step.done) return { status: 'done', result: step.value as R, elapsedMs: now() - t0 };
    }
  } catch (e) {
    return { status: 'error', message: (e as Error)?.message ?? String(e) };
  }
}

export interface AsyncOptions {
  onProgress?: (p: Progress) => void;
  isCancelled?: () => boolean;
  limits?: Partial<RunLimits>;
  now?: () => number;
  /** Work this long before reporting progress and yielding to the event loop. */
  sliceMs?: number;
  /** How to yield; defaults to a macrotask so queued messages (cancel) are handled. */
  pause?: () => Promise<void>;
}

const macrotask = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Run a job in time slices, yielding between them. Used inside the worker. */
async function executeAsyncJob<R = unknown>(job: RunJob, opts: AsyncOptions = {}): Promise<RunOutcome<R>> {
  const now = opts.now ?? clock;
  const isCancelled = opts.isCancelled ?? (() => false);
  const limits = effectiveLimits(opts.limits);
  const problems = preflight(job, limits);
  if (problems.length) return limitOutcome(problems);
  const sliceMs = opts.sliceMs ?? 16;
  const pause = opts.pause ?? macrotask;
  const t0 = now();
  const budget = budgetFor(limits.maxWallClockMs, { now, shouldStop: isCancelled, limits: opts.limits });
  try {
    const gen = jobSteps(job, now);
    let sliceStart = now();
    for (;;) {
      if (isCancelled()) return { status: 'cancelled', message: 'Cancelled.' };
      const step = withRunBudget(budget, () => gen.next());
      const stop = stopOutcome<R>(budget);
      if (stop) return stop;
      if (step.done) return { status: 'done', result: step.value as R, elapsedMs: now() - t0 };
      if (now() - sliceStart >= sliceMs) {
        opts.onProgress?.(step.value as Progress);
        await pause();
        sliceStart = now();
      }
    }
  } catch (e) {
    return { status: 'error', message: (e as Error)?.message ?? String(e) };
  }
}

// One retained asynchronous job at a time in this execution realm. Queued jobs own no result
// arrays; this reserves the full retained-cell budget instead of multiplying it across lanes.
let executionTail: Promise<void> = Promise.resolve();
let queuedJobs = 0;
let activeAsyncJob = false;
export async function executeAsync<R = unknown>(job: RunJob, opts: AsyncOptions = {}): Promise<RunOutcome<R>> {
  const problems = preflight(job, opts.limits);
  if (problems.length) return limitOutcome(problems);
  if (queuedJobs >= 16) return { status: 'limit-exceeded', message: 'At most 16 queued jobs per execution realm.' };
  queuedJobs++;
  const previous = executionTail;
  let release!: () => void;
  executionTail = new Promise<void>(resolve => { release = resolve; });
  await previous;
  activeAsyncJob = true;
  try { return await executeAsyncJob<R>(job, opts); }
  finally { activeAsyncJob = false; queuedJobs--; release(); }
}

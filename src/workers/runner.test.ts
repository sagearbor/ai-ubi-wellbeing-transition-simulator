/**
 * The model runner: hard limits in the engine, bounded and cancellable execution, and the worker
 * message protocol (run ids, supersession, cancellation, restart of a worker that does not stop),
 * driven through a fake worker because vitest has no Worker.
 */

import { describe, expect, it, vi } from 'vitest';
import { budgetFor, compileModel, runModel, runMonteCarlo, withRunBudget } from '../core/engine';
import { findFixture } from '../core/fixtures';
import { RUN_LIMITS, checkRunSettings, effectiveLimits } from '../core/limits';
import type { CoreModel, MonteCarloResult } from '../core/types';
import { pairedRun } from '../policy/draft';
import { modelHash } from '../policy/hash';
import { retraining, threeStatusDraft, training } from '../policy/testDrafts';
import { createSyncRunner, createWorkerRunner, type WorkerLike } from './client';
import { executeAsync, executeSync, preflight } from './execute';
import { createRunnerHost, type HostOptions } from './host';
import type { FromRunner, MonteCarloJob, ToRunner } from './protocol';

const minimal = findFixture('minimal')!.model;
const cohort = findFixture('cohort-flow')!.model;

const mcJob = (runs = 200, model: CoreModel = training): MonteCarloJob => ({ kind: 'monte-carlo', model, overlays: [], runs, seed: 1 });

// ---------------------------------------------------------------------------
// Engine limits
// ---------------------------------------------------------------------------

describe('hard limits in the engine', () => {
  it('refuses a model with more steps than the limit, before allocating them', () => {
    const huge: CoreModel = { ...minimal, time: { start: 0, end: 1_000_000_000, step: 'month' } };
    const r = runModel(huge);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.map((d) => d.code)).toContain('limit-exceeded');
    expect(r.years.length).toBe(0);
    expect(r.diagnostics.find((d) => d.code === 'limit-exceeded')!.message).toContain(`limit is ${RUN_LIMITS.maxSteps.toLocaleString('en-US')} steps`);
  });

  it('refuses too many entities and a solver maxIter over the limit', () => {
    const many: CoreModel = { ...minimal, entities: { kind: 'region', ids: Array.from({ length: RUN_LIMITS.maxEntities + 1 }, (_, i) => `r${i}`) } };
    expect(compileModel(many).diagnostics.filter((d) => d.code === 'limit-exceeded')).toHaveLength(1);
    const market = findFixture('market-clearing')!.model;
    const greedy: CoreModel = { ...market, solves: market.solves!.map((s) => ({ ...s, maxIter: RUN_LIMITS.maxSolverIterations + 1 })) };
    const r = runModel(greedy);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => d.code === 'limit-exceeded' && d.message.includes('iterations per solve'))).toBe(true);
  });

  it('lets a caller tighten a limit but never loosen one', () => {
    expect(effectiveLimits({ maxDraws: 10 }).maxDraws).toBe(10);
    expect(effectiveLimits({ maxDraws: 10_000_000 }).maxDraws).toBe(RUN_LIMITS.maxDraws);
    expect(runModel(minimal, { limits: { maxSteps: 5 } }).diagnostics.some((d) => d.code === 'limit-exceeded')).toBe(true);
  });

  it('refuses more Monte Carlo draws than the limit, and paired runs too', () => {
    const mc = runMonteCarlo(minimal, { runs: RUN_LIMITS.maxDraws + 1 });
    expect(mc.ok).toBe(false);
    expect(mc.runs).toBe(0);
    expect(mc.diagnostics[0].code).toBe('limit-exceeded');
    const paired = pairedRun(training, [], threeStatusDraft(), { runs: RUN_LIMITS.maxDraws + 1 });
    expect(paired.ok).toBe(false);
    expect(paired.errors[0]).toContain('[limit-exceeded]');
  });

  it('stops a run at its wall-clock deadline with limit-exceeded, and on cancel with cancelled', () => {
    let clock = 0;
    const now = () => (clock += 10); // every look at the clock costs 10 ms
    const late = runModel(cohort, { budget: budgetFor(100, { now }) });
    expect(late.ok).toBe(false);
    const d = late.diagnostics.find((x) => x.code === 'limit-exceeded')!;
    expect(d.message).toContain('wall-clock limit of 0.1 s');
    expect(d.step).toBeGreaterThan(0);

    let stop = false;
    let steps = 0;
    const cancelled = runModel(cohort, { budget: { shouldStop: () => (++steps > 5 ? (stop = true) : stop) } });
    expect(cancelled.ok).toBe(false);
    expect(cancelled.diagnostics.some((x) => x.code === 'cancelled')).toBe(true);
  });

  it('applies a budget set with withRunBudget to code that has none of its own', () => {
    const r = withRunBudget({ shouldStop: () => true }, () => pairedRun(training, [], threeStatusDraft(), { runs: 3 }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('cancelled');
  });

  it('checks run settings from outside (links, bundles) before executing', () => {
    expect(checkRunSettings({ runs: 200, seed: 1, model: training })).toEqual([]);
    expect(checkRunSettings({ runs: 10_000, seed: 1, model: training }).map((p) => p.limit)).toEqual(['maxDraws']);
    expect(checkRunSettings({ runs: 3, seed: 1.5 }).map((p) => p.limit)).toEqual(['seed']);
    expect(checkRunSettings({ model: { ...minimal, time: { start: 0, end: 1e9, step: 'year' } } }).map((p) => p.limit)).toEqual(['maxSteps']);
  });
});

describe('deterministic models are not run N identical times', () => {
  it('Monte Carlo on a model with no ranged parameter runs once and says so', () => {
    const mc = runMonteCarlo(cohort, { runs: 200, seed: 1 });
    expect(mc.ok).toBe(true);
    expect(mc.deterministic).toBe(true);
    expect(mc.runs).toBe(1);
    const point = runModel(cohort);
    const key = cohort.outputs[0];
    expect(mc.quantiles._[key].p5).toEqual(point.series._[key]);
    expect(mc.quantiles._[key].p95).toEqual(point.series._[key]);
    // a ranged model still draws
    const ranged = runMonteCarlo(minimal, { runs: 20, seed: 1 });
    expect(ranged.deterministic).toBe(false);
    expect(ranged.runs).toBe(20);
  });

  it('a paired run on a deterministic model runs one draw and records it in the manifest', () => {
    const draft = { ...threeStatusDraft(), modelId: cohort.id, modelHash: modelHash(cohort), provisions: threeStatusDraft().provisions.slice(1) };
    const r = pairedRun(cohort, [retraining], draft, { runs: 50, seed: 2 });
    expect(r.ok, r.errors.join('; ')).toBe(true);
    expect(r.deterministic).toBe(true);
    expect(r.runs).toBe(1);
    expect(r.manifest.runs).toBe(50);
    expect(r.manifest.draws).toEqual({ count: 1, seed: 2, firstIndex: 0, deterministic: true });
    const ranged = pairedRun(training, [], threeStatusDraft(), { runs: 4 });
    expect(ranged.deterministic).toBeUndefined();
    expect(ranged.runs).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

describe('executeSync and executeAsync', () => {
  it('the synchronous fallback returns exactly what the engine returns', () => {
    const o = executeSync<MonteCarloResult>(mcJob(30, minimal));
    expect(o.status).toBe('done');
    const direct = runMonteCarlo(minimal, { runs: 30, seed: 1 });
    expect((o as { result: MonteCarloResult }).result.quantiles).toEqual(direct.quantiles);
  });

  it('preflight refuses over-limit settings without running anything', async () => {
    expect(preflight(mcJob(5000))).toHaveLength(1);
    const spy = vi.fn();
    const o = await executeAsync(mcJob(5000), { onProgress: spy });
    expect(o.status).toBe('limit-exceeded');
    expect(spy).not.toHaveBeenCalled();
  });

  it('reports progress between slices and stops when cancelled', async () => {
    const seen: number[] = [];
    let cancel = false;
    const o = await executeAsync(mcJob(200), {
      sliceMs: 0,
      onProgress: (p) => {
        seen.push(p.done);
        if (p.done >= 10) cancel = true;
      },
      isCancelled: () => cancel,
      pause: () => Promise.resolve(),
    });
    expect(o.status).toBe('cancelled');
    expect(seen[0]).toBe(1);
    expect(Math.max(...seen)).toBeLessThan(200);
  });

  it('stops at the wall-clock limit', async () => {
    let clock = 0;
    const o = await executeAsync(mcJob(200), { now: () => (clock += 5), limits: { maxWallClockMs: 200 }, sliceMs: 1e9 });
    expect(o.status).toBe('limit-exceeded');
  });
});

// ---------------------------------------------------------------------------
// Worker protocol through a fake worker
// ---------------------------------------------------------------------------

interface FakeWorker extends WorkerLike {
  terminated: boolean;
  posted: ToRunner[];
  received: FromRunner[];
}

/** A Worker stand-in: messages cross asynchronously, as they would between threads. */
function fakeWorkers(hostOpts: HostOptions = {}, { deaf = false }: { deaf?: boolean } = {}) {
  const created: FakeWorker[] = [];
  const factory = (): WorkerLike => {
    let handler: (m: ToRunner) => void = () => {};
    const w: FakeWorker = {
      onmessage: null,
      terminated: false,
      posted: [],
      received: [],
      postMessage(m) {
        w.posted.push(m);
        if (!deaf) setTimeout(() => !w.terminated && handler(m), 0);
      },
      terminate() {
        w.terminated = true;
      },
    };
    createRunnerHost(
      {
        post: (m) =>
          setTimeout(() => {
            if (w.terminated) return;
            w.received.push(m);
            w.onmessage?.({ data: m });
          }, 0),
        listen: (h) => (handler = h),
      },
      hostOpts,
    );
    created.push(w);
    return w;
  };
  return { factory, created };
}

const fast: HostOptions = { sliceMs: 0 };

describe('runner protocol (fake worker)', () => {
  it('runs a job and returns the same numbers as the synchronous runner', async () => {
    const { factory } = fakeWorkers(fast);
    const runner = createWorkerRunner(factory);
    const progress: number[] = [];
    const o = await runner.run('lab-mc', mcJob(40, minimal), { onProgress: (p) => progress.push(p.done) }).promise;
    expect(o.status).toBe('done');
    const sync = createSyncRunner().runSync(mcJob(40, minimal));
    expect((o as { result: MonteCarloResult }).result.quantiles).toEqual((sync as { result: MonteCarloResult }).result.quantiles);
    expect(progress.length).toBeGreaterThan(0);
    expect(progress[progress.length - 1]).toBeLessThanOrEqual(40);
    runner.dispose();
  });

  it('a newer run in the same lane supersedes the older one; the stale completion is discarded', async () => {
    const { factory, created } = fakeWorkers(fast);
    const runner = createWorkerRunner(factory);
    const first = runner.run('lab-mc', mcJob(200));
    const second = runner.run('lab-mc', mcJob(30, minimal));
    const other = runner.run('lab-point', { kind: 'lab-point', model: minimal, overlays: [], hypotheticalOverlays: null });
    const [a, b, c] = await Promise.all([first.promise, second.promise, other.promise]);
    expect(a.status).toBe('superseded');
    expect(b.status).toBe('done');
    expect(c.status).toBe('done'); // other lanes are unaffected
    expect(second.id).toBeGreaterThan(first.id);
    // the worker was told to stop the first run, and never delivered a result for it
    await new Promise((r) => setTimeout(r, 30));
    const w = created[0];
    expect(w.posted.some((m) => m.type === 'cancel' && m.id === first.id)).toBe(true);
    expect(w.received.some((m) => m.type === 'done' && m.id === first.id)).toBe(false);
    // (the client's cancel reaches the worker before the newer run does, so it reports the stop as a cancel)
    expect(w.received.some((m) => m.type === 'stopped' && m.id === first.id && (m.code === 'superseded' || m.code === 'cancelled'))).toBe(true);
    expect(created).toHaveLength(1);
    runner.dispose();
  });

  it('cancel settles at once, the worker confirms, and no restart is needed', async () => {
    const { factory, created } = fakeWorkers(fast);
    const runner = createWorkerRunner(factory, { cancelGraceMs: 200 });
    const h = runner.run('policy', mcJob(200));
    await new Promise((r) => setTimeout(r, 5));
    h.cancel();
    expect((await h.promise).status).toBe('cancelled');
    await new Promise((r) => setTimeout(r, 300));
    expect(created[0].received.some((m) => m.type === 'stopped' && m.id === h.id && m.code === 'cancelled')).toBe(true);
    expect(created[0].terminated).toBe(false);
    expect(created).toHaveLength(1);
    runner.dispose();
  });

  it('a worker that does not confirm a cancel is terminated and restarted; other runs are re-sent', async () => {
    const timers: Array<{ fn: () => void; ms: number }> = [];
    const { factory, created } = fakeWorkers(fast, { deaf: true });
    const runner = createWorkerRunner(factory, { setTimer: (fn, ms) => timers.push({ fn, ms }), clearTimer: () => {}, cancelGraceMs: 100 });
    const stuck = runner.run('lab-mc', mcJob(200));
    const waiting = runner.run('lab-point', { kind: 'lab-point', model: minimal, overlays: [], hypotheticalOverlays: null });
    stuck.cancel();
    expect((await stuck.promise).status).toBe('cancelled');
    timers.find((t) => t.ms === 100)!.fn(); // the grace period passes with no confirmation
    expect(created[0].terminated).toBe(true);
    expect(created).toHaveLength(2);
    expect(created[1].posted.map((m) => (m.type === 'run' ? m.id : -1))).toEqual([waiting.id]);
    runner.dispose();
  });

  it('the watchdog stops a run that outlives the wall-clock limit', async () => {
    const timers: Array<{ fn: () => void; ms: number }> = [];
    const { factory, created } = fakeWorkers(fast, { deaf: true });
    const runner = createWorkerRunner(factory, { setTimer: (fn, ms) => timers.push({ fn, ms }), clearTimer: () => {}, limits: { maxWallClockMs: 1000 }, watchdogSlackMs: 0 });
    const h = runner.run('lab-mc', mcJob(200));
    timers.find((t) => t.ms === 1000)!.fn();
    const o = await h.promise;
    expect(o.status).toBe('limit-exceeded');
    expect(created[0].terminated).toBe(true);
    runner.dispose();
  });

  it('over-limit settings come back as limit-exceeded with the problems, before any progress', async () => {
    const { factory, created } = fakeWorkers(fast);
    const runner = createWorkerRunner(factory);
    const job = { kind: 'paired' as const, model: training, overlays: [], drafts: [threeStatusDraft()], runs: 50_000, seed: 1, sourceText: '' };
    const o = await runner.run('policy', job).promise;
    expect(o.status).toBe('limit-exceeded');
    expect((o as { problems: unknown[] }).problems).toHaveLength(1);
    expect(created[0].received.some((m) => m.type === 'progress')).toBe(false);
    runner.dispose();
  });
});

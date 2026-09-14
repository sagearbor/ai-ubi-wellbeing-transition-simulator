/**
 * Runner client: what the page calls to run a model job. Two implementations, one API:
 *
 *   createWorkerRunner(factory)  jobs run in a Web Worker (src/workers/runner.worker.ts). Each call
 *                                gets a run id; a newer run in the same lane supersedes the older
 *                                one (its promise settles `superseded` at once and any later message
 *                                for it is discarded). cancel() settles `cancelled` at once and asks
 *                                the worker to stop; if the worker does not confirm within the grace
 *                                period (a single long step), it is terminated and restarted, and the
 *                                other lanes' runs are re-sent. A watchdog does the same for a run
 *                                that outlives the wall-clock limit.
 *   createSyncRunner()           the same jobs on the calling thread, for tests and SSR (vitest has
 *                                no Worker). runSync() returns the outcome immediately, so a React
 *                                render can use it inline.
 *
 * getDefaultRunner() picks the worker in a browser and the synchronous runner elsewhere.
 */

import { effectiveLimits, type RunLimits } from '../core/limits';
import { executeSync } from './execute';
import type { FromRunner, Progress, ResultOf, RunJob, RunOutcome, ToRunner } from './protocol';

export interface RunHandle<R> {
  id: number;
  lane: string;
  promise: Promise<RunOutcome<R>>;
  cancel: () => void;
}

export interface RunOptions {
  onProgress?: (p: Progress) => void;
}

export interface Runner {
  mode: 'worker' | 'sync';
  run<J extends RunJob>(lane: string, job: J, opts?: RunOptions): RunHandle<ResultOf<J>>;
  /** Synchronous execution (always available; blocks the calling thread). */
  runSync<J extends RunJob>(job: J): RunOutcome<ResultOf<J>>;
  cancelLane(lane: string): void;
  dispose(): void;
}

/** The part of a Worker the client uses. */
export interface WorkerLike {
  postMessage(msg: ToRunner): void;
  onmessage: ((ev: { data: FromRunner }) => void) | null;
  onerror?: ((ev: unknown) => void) | null;
  terminate(): void;
}

export interface WorkerRunnerOptions {
  limits?: Partial<RunLimits>;
  /** How long a cancelled run may take to confirm before the worker is restarted. */
  cancelGraceMs?: number;
  /** Extra time past the wall-clock limit before the watchdog restarts the worker. */
  watchdogSlackMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (t: unknown) => void;
}

export function createSyncRunner(opts: { limits?: Partial<RunLimits> } = {}): Runner {
  let nextId = 1;
  return {
    mode: 'sync',
    run(lane, job) {
      const id = nextId++;
      const outcome = executeSync(job, { limits: opts.limits });
      return { id, lane, promise: Promise.resolve(outcome as RunOutcome<ResultOf<typeof job>>), cancel: () => {} };
    },
    runSync(job) {
      return executeSync(job, { limits: opts.limits }) as RunOutcome<ResultOf<typeof job>>;
    },
    cancelLane() {},
    dispose() {},
  };
}

interface Pending {
  id: number;
  lane: string;
  job: RunJob;
  resolve: (o: RunOutcome<unknown>) => void;
  onProgress?: (p: Progress) => void;
  watchdog: unknown;
}

export function createWorkerRunner(factory: () => WorkerLike, opts: WorkerRunnerOptions = {}): Runner {
  const limits = effectiveLimits(opts.limits);
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>));
  const grace = opts.cancelGraceMs ?? 1500;
  const slack = opts.watchdogSlackMs ?? 5000;

  let nextId = 1;
  let worker: WorkerLike | null = null;
  const pending = new Map<number, Pending>();
  const latest = new Map<string, number>();
  /** Runs cancelled or superseded here whose stop the worker has not confirmed yet. */
  const awaitingStop = new Map<number, unknown>();

  const settle = (id: number, outcome: RunOutcome<unknown>) => {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    clearTimer(p.watchdog);
    if (latest.get(p.lane) === id) latest.delete(p.lane);
    p.resolve(outcome);
  };

  const onMessage = (ev: { data: FromRunner }) => {
    const msg = ev?.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'stopped' && awaitingStop.has(msg.id)) {
      clearTimer(awaitingStop.get(msg.id));
      awaitingStop.delete(msg.id);
    }
    const p = pending.get(msg.id);
    if (!p) return; // stale: superseded, cancelled or from a terminated worker
    if (msg.type === 'progress') p.onProgress?.({ done: msg.done, total: msg.total });
    else if (msg.type === 'done') settle(msg.id, { status: 'done', result: msg.result, elapsedMs: msg.elapsedMs });
    else if (msg.type === 'stopped') settle(msg.id, { status: msg.code, message: msg.message, ...(msg.problems ? { problems: msg.problems } : {}) });
  };

  const spawn = (): WorkerLike => {
    const w = factory();
    w.onmessage = onMessage;
    w.onerror = (ev: unknown) => {
      const message = (ev as { message?: string })?.message ?? 'the model runner stopped unexpectedly';
      for (const id of [...pending.keys()]) settle(id, { status: 'error', message: `Runner error: ${message}` });
      restart();
    };
    return w;
  };
  const ensure = (): WorkerLike => (worker ??= spawn());

  const post = (p: Pending) => ensure().postMessage({ type: 'run', id: p.id, lane: p.lane, job: p.job, limits: opts.limits });

  /** Terminate the worker and start a fresh one; runs still pending are sent again. */
  function restart() {
    for (const t of awaitingStop.values()) clearTimer(t);
    awaitingStop.clear();
    worker?.terminate();
    worker = null;
    for (const p of pending.values()) post(p);
  }

  const armWatchdog = (id: number) =>
    setTimer(() => {
      if (!pending.has(id)) return;
      settle(id, { status: 'limit-exceeded', message: `The run did not finish within the wall-clock limit (${(limits.maxWallClockMs / 1000).toLocaleString('en-US')} s) and was stopped.` });
      restart();
    }, limits.maxWallClockMs + slack);

  const stop = (id: number, code: 'cancelled' | 'superseded') => {
    if (!pending.has(id)) return;
    settle(id, code === 'cancelled' ? { status: 'cancelled', message: 'Cancelled.' } : { status: 'superseded', message: 'Superseded by a newer run.' });
    if (!worker) return;
    worker.postMessage({ type: 'cancel', id });
    // A run inside one long step cannot hear the cancel; if it does not confirm, restart the worker.
    awaitingStop.set(
      id,
      setTimer(() => {
        if (awaitingStop.has(id)) restart();
      }, grace),
    );
  };

  return {
    mode: 'worker',
    run(lane, job, runOpts = {}) {
      const prev = latest.get(lane);
      if (prev !== undefined) stop(prev, 'superseded');
      const id = nextId++;
      latest.set(lane, id);
      let resolve!: (o: RunOutcome<unknown>) => void;
      const promise = new Promise<RunOutcome<unknown>>((r) => (resolve = r));
      const p: Pending = { id, lane, job, resolve, onProgress: runOpts.onProgress, watchdog: armWatchdog(id) };
      pending.set(id, p);
      post(p);
      return { id, lane, promise: promise as Promise<RunOutcome<ResultOf<typeof job>>>, cancel: () => stop(id, 'cancelled') };
    },
    runSync(job) {
      return executeSync(job, { limits: opts.limits }) as RunOutcome<ResultOf<typeof job>>;
    },
    cancelLane(lane) {
      const id = latest.get(lane);
      if (id !== undefined) stop(id, 'cancelled');
    },
    dispose() {
      for (const id of [...pending.keys()]) settle(id, { status: 'cancelled', message: 'The runner was closed.' });
      for (const t of awaitingStop.values()) clearTimer(t);
      awaitingStop.clear();
      worker?.terminate();
      worker = null;
    },
  };
}

let defaultRunner: Runner | null = null;

/** A Web Worker runner in the browser; the synchronous runner in tests, SSR and old browsers. */
export function getDefaultRunner(): Runner {
  if (defaultRunner) return defaultRunner;
  const canWork = typeof window !== 'undefined' && typeof Worker !== 'undefined';
  if (canWork) {
    try {
      defaultRunner = createWorkerRunner(
        () => new Worker(new URL('./runner.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike,
      );
      return defaultRunner;
    } catch {
      // fall through to the synchronous runner
    }
  }
  defaultRunner = createSyncRunner();
  return defaultRunner;
}

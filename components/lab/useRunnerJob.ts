/**
 * useRunnerJob — run a model job through the runner (src/workers/client.ts) from a component.
 *
 * Worker runner: the job starts in an effect whenever `key` changes; a newer key supersedes the
 * running job in its lane. The last completed result stays on screen (marked stale) while the new
 * one runs, with progress and a cancel. Synchronous runner (tests, SSR): the job runs inline during
 * render, so a server-rendered page already shows its results — the same API either way.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LimitProblem } from '../../src/core/limits';
import type { Runner } from '../../src/workers/client';
import type { Progress, ResultOf, RunJob, RunOutcome, StopCode } from '../../src/workers/protocol';

export type JobStatus = 'idle' | 'running' | 'done' | Exclude<StopCode, 'superseded'>;

export interface JobState<R> {
  status: JobStatus;
  /** The last completed result (possibly for an earlier key while a new run is going). */
  result: R | null;
  /** Key the result was computed for. */
  resultKey: string | null;
  progress: Progress | null;
  /** Why the last run stopped, when it did not complete. */
  message: string | null;
  problems: LimitProblem[];
  elapsedMs: number | null;
}

export interface JobControls<R> extends JobState<R> {
  /** True while the shown result is for an earlier key. */
  stale: boolean;
  cancel: () => void;
  /** Run the current job again (after a cancel or a limit). */
  rerun: () => void;
}

const IDLE: JobState<any> = { status: 'idle', result: null, resultKey: null, progress: null, message: null, problems: [], elapsedMs: null };

function fromOutcome<R>(prev: JobState<R>, key: string, o: RunOutcome<R>): JobState<R> {
  if (o.status === 'done') return { status: 'done', result: o.result, resultKey: key, progress: null, message: null, problems: [], elapsedMs: o.elapsedMs };
  if (o.status === 'superseded') return prev;
  return { ...prev, status: o.status, progress: null, message: o.message, problems: o.problems ?? [] };
}

export function useRunnerJob<J extends RunJob>(runner: Runner, lane: string, job: J | null, key: string): JobControls<ResultOf<J>> {
  type R = ResultOf<J>;
  const sync = runner.mode === 'sync';
  const [nonce, setNonce] = useState(0);
  const jobRef = useRef(job);
  jobRef.current = job;

  // Synchronous runner: compute during render.
  const syncState = useMemo<JobState<R> | null>(() => {
    if (!sync) return null;
    if (!job) return IDLE as JobState<R>;
    return fromOutcome(IDLE as JobState<R>, key, runner.runSync(job) as RunOutcome<R>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync, key, nonce]);

  const [state, setState] = useState<JobState<R>>(IDLE as JobState<R>);
  const handleRef = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => {
    if (sync) return;
    const current = jobRef.current;
    if (!current) {
      setState(IDLE as JobState<R>);
      return;
    }
    let live = true;
    setState((s) => ({ ...s, status: 'running', progress: null, message: null, problems: [] }));
    const handle = runner.run(lane, current, {
      onProgress: (p) => {
        if (live) setState((s) => (s.status === 'running' ? { ...s, progress: p } : s));
      },
    });
    handleRef.current = handle;
    handle.promise.then((o) => {
      if (!live) return;
      setState((s) => fromOutcome(s, key, o as RunOutcome<R>));
    });
    return () => {
      live = false;
    };
  }, [sync, runner, lane, key, nonce]);

  // Cancel whatever is running when the component goes away.
  useEffect(() => () => handleRef.current?.cancel(), []);

  const cancel = useCallback(() => {
    handleRef.current?.cancel();
    setState((s) => (s.status === 'running' ? { ...s, status: 'cancelled', progress: null, message: 'Cancelled. The last completed result (if any) is still shown.' } : s));
  }, []);
  const rerun = useCallback(() => setNonce((n) => n + 1), []);

  const shown = syncState ?? state;
  return { ...shown, stale: shown.resultKey !== null && shown.resultKey !== key, cancel, rerun };
}

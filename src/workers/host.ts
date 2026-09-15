/**
 * Runner host: the worker side of the protocol (src/workers/protocol.ts), written against a port so
 * tests can drive it without a Worker.
 *
 * Lanes: each job runs in a named lane ("lab-point", "lab-mc", "policy", ...). A run arriving in a
 * lane supersedes the lane's previous run: that run is flagged, stops at its next draw or step, and
 * reports `superseded` instead of a result. A cancel message does the same with `cancelled`. Runs in
 * different lanes reserve execution memory one at a time; queued cancellation is acknowledged
 * without waiting for the active lane to finish.
 */

import type { RunLimits } from '../core/limits';
import { executeAsync, type AsyncOptions } from './execute';
import type { FromRunner, ToRunner } from './protocol';

export interface HostPort {
  post: (msg: FromRunner) => void;
  listen: (handler: (msg: ToRunner) => void) => void;
}

export interface HostOptions {
  limits?: Partial<RunLimits>;
  now?: () => number;
  sliceMs?: number;
  pause?: AsyncOptions['pause'];
}

export function createRunnerHost(port: HostPort, opts: HostOptions = {}): { active: () => number[] } {
  const runs = new Map<number, { lane: string; stop: 'cancelled' | 'superseded' | null }>();
  const latest = new Map<string, number>();

  port.listen((msg) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'cancel') {
      const r = runs.get(msg.id);
      if (r && !r.stop) r.stop = 'cancelled';
      else if (!r) port.post({ type: 'stopped', id: msg.id, code: 'cancelled', message: 'Cancelled (it had already finished).' });
      return;
    }
    if (msg.type !== 'run') return;
    const { id, lane, job } = msg;
    const prev = latest.get(lane);
    if (prev !== undefined) {
      const p = runs.get(prev);
      if (p && !p.stop) p.stop = 'superseded';
    }
    latest.set(lane, id);
    const entry = { lane, stop: null as 'cancelled' | 'superseded' | null };
    runs.set(id, entry);
    void executeAsync(job, {
      limits: msg.limits ?? opts.limits,
      now: opts.now,
      sliceMs: opts.sliceMs,
      pause: opts.pause,
      isCancelled: () => entry.stop !== null,
      onProgress: (p) => {
        if (!entry.stop) port.post({ type: 'progress', id, done: p.done, total: p.total });
      },
    }).then((outcome) => {
      runs.delete(id);
      if (latest.get(lane) === id) latest.delete(lane);
      if (entry.stop) {
        port.post({ type: 'stopped', id, code: entry.stop, message: entry.stop === 'superseded' ? 'Superseded by a newer run.' : 'Cancelled.' });
      } else if (outcome.status === 'done') {
        port.post({ type: 'done', id, result: outcome.result, elapsedMs: outcome.elapsedMs });
      } else {
        port.post({ type: 'stopped', id, code: outcome.status, message: outcome.message, ...(outcome.problems ? { problems: outcome.problems } : {}) });
      }
    });
  });

  return { active: () => [...runs.keys()] };
}

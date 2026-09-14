/**
 * Runner protocol: the messages between the page and the model runner (a Web Worker in the browser,
 * an in-process host in tests), and the jobs it executes.
 *
 *   page -> runner   { type: 'run', id, lane, job }   start a job; a newer id in the same lane
 *                                                      supersedes (cancels) the older one
 *                    { type: 'cancel', id }           stop a job at its next draw or step
 *   runner -> page   { type: 'progress', id, done, total }
 *                    { type: 'done', id, result, elapsedMs }
 *                    { type: 'stopped', id, code, message }   code: cancelled | superseded |
 *                                                              limit-exceeded | error
 *
 * Everything in a message is plain JSON-like data (models, overlays, results), so it crosses the
 * worker boundary by structured clone.
 */

import type { LimitProblem, RunLimits } from '../core/limits';
import type { CoreModel, MonteCarloResult, Overlay, RunResult, TestOutcome } from '../core/types';
import type { OverlayValidationResult, ValidationResult } from '../core/validate';
import type { PolicyBundle, ReopenReport } from '../policy/bundle';
import type { PairedRunResult, PolicyDraft } from '../policy/types';

/** The Lab's point runs: the bundled baseline, the current scenario, the hypothetical, the tests. */
export interface LabPointJob {
  kind: 'lab-point';
  model: CoreModel;
  overlays: Overlay[];
  /** Scenario overlays plus the hypothetical, when one is on. */
  hypotheticalOverlays: Overlay[] | null;
}

export interface MonteCarloJob {
  kind: 'monte-carlo';
  model: CoreModel;
  overlays: Overlay[];
  runs: number;
  seed: number;
}

export interface PairedJob {
  kind: 'paired';
  model: CoreModel;
  overlays: Overlay[];
  drafts: PolicyDraft[];
  runs: number;
  seed: number;
  sourceText: string;
}

export interface ReopenJob {
  kind: 'reopen-bundle';
  bundle: PolicyBundle;
  /** Models to resolve the bundle against before the bundled fixtures (an embedded or imported model). */
  models: CoreModel[];
}

export interface ValidateModelJob {
  kind: 'validate-model';
  json: unknown;
}

export interface ValidateOverlayJob {
  kind: 'validate-overlay';
  base: CoreModel;
  json: unknown;
}

export type RunJob = LabPointJob | MonteCarloJob | PairedJob | ReopenJob | ValidateModelJob | ValidateOverlayJob;

export interface LabPointResult {
  baseline: RunResult;
  plain: RunResult;
  plainMs: number;
  hyp: RunResult | null;
  hypMs: number;
  outcomes: TestOutcome[];
}

export interface JobResults {
  'lab-point': LabPointResult;
  'monte-carlo': MonteCarloResult;
  /** One entry per draft; null for a draft written for another model. */
  paired: Array<PairedRunResult | null>;
  'reopen-bundle': ReopenReport;
  'validate-model': ValidationResult;
  'validate-overlay': OverlayValidationResult;
}

export type ResultOf<J extends RunJob> = JobResults[J['kind']];

export type StopCode = 'cancelled' | 'superseded' | 'limit-exceeded' | 'error';

export type ToRunner =
  | { type: 'run'; id: number; lane: string; job: RunJob; limits?: Partial<RunLimits> }
  | { type: 'cancel'; id: number };

export type FromRunner =
  | { type: 'progress'; id: number; done: number; total: number }
  | { type: 'done'; id: number; result: unknown; elapsedMs: number }
  | { type: 'stopped'; id: number; code: StopCode; message: string; problems?: LimitProblem[] };

export interface Progress {
  done: number;
  total: number;
}

/** What a caller gets back for one job. */
export type RunOutcome<R> =
  | { status: 'done'; result: R; elapsedMs: number }
  | { status: StopCode; message: string; problems?: LimitProblem[] };

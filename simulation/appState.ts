/**
 * Pure helpers that App.tsx's React layer delegates to.
 *
 * Stage 1 of the v3 plan (docs/design/audit-2026-09-13.md) found three defects that all came
 * from simulation logic living inside React callbacks: seek restored only countries (A3), the
 * comparison panel never advanced (A4), and save files stored a partial, mutated picture (A6).
 * Everything here is a plain function over `SimulationRun` so it can be tested without a DOM -
 * see simulation/appState.test.ts. App.tsx keeps only the state wiring.
 */

import type { HistoryPoint, SavedState } from '../types';
import {
  advanceRun,
  initialRun,
  replayTo,
  runMonths,
  type RunInputs,
  type SimulationRun,
} from './run';

/** One history point carrying the whole run, not just the country slice. */
export function historyPoint(run: SimulationRun): HistoryPoint {
  return { month: run.state.month, state: run.state, run };
}

/**
 * Append `run` to the timeline, dropping any points at or after its month (the app branches
 * into an alternate future when parameters change after a rewind).
 */
export function recordRunInHistory(history: HistoryPoint[], run: SimulationRun): HistoryPoint[] {
  return [...history.filter((p) => p.month < run.state.month), historyPoint(run)];
}

/** The latest recorded point at or before `month` that carries a full run, else null. */
export function nearestFullPoint(history: HistoryPoint[], month: number): SimulationRun | null {
  let best: SimulationRun | null = null;
  for (const p of history) {
    if (!p.run) continue;
    const m = p.run.state.month;
    if (m <= month && (!best || m > best.state.month)) best = p.run;
  }
  return best;
}

/**
 * Restore the complete run at `month`.
 *
 * Exact history point with a run -> return it verbatim. Otherwise replay deterministically from
 * the nearest earlier full point, or from `base` (month 0). Never returns a run whose
 * corporations, ledger and game theory come from a different month than its countries.
 */
export function seekInHistory(
  history: HistoryPoint[],
  month: number,
  inputs: RunInputs,
  base: SimulationRun,
): SimulationRun {
  const target = Math.max(0, month);
  if (target === 0) return base;
  const exact = history.find((p) => p.month === target);
  if (exact?.run) return exact.run;
  const from = nearestFullPoint(history, target) ?? base;
  if (from.state.month >= target) return from;
  return replayTo(from, target, inputs);
}

/** Advance two runs one month each, with their own inputs. Neither input run is modified. */
export function stepBoth(
  a: SimulationRun,
  inputsA: RunInputs,
  b: SimulationRun,
  inputsB: RunInputs,
): { a: SimulationRun; b: SimulationRun } {
  return { a: advanceRun(a, inputsA), b: advanceRun(b, inputsB) };
}

/**
 * Bring a freshly built run up to `month`, returning the run and the history behind it.
 * Used when comparison mode is switched on mid-run so both panels show the same month.
 */
export function catchUp(
  base: SimulationRun,
  month: number,
  inputs: RunInputs,
): { run: SimulationRun; history: HistoryPoint[] } {
  const target = Math.max(0, month);
  const runs = runMonths(base, target, inputs);
  return { run: runs[target], history: runs.slice(1).map(historyPoint) };
}

/**
 * History as it should be written to a file or to localStorage.
 *
 * A point's `run.state` IS its `state`, so serialising both writes every country twice and
 * doubles the payload (20MB vs 11MB over 60 months). The duplicate is dropped on the way out
 * and rebuilt by `historyFromSave` on the way in; points without a run are left alone.
 */
export function historyForSave(history: HistoryPoint[]): HistoryPoint[] {
  return history.map((p) => (p.run ? ({ month: p.month, run: p.run } as unknown as HistoryPoint) : p));
}

/** History with only the chartable slice: what leaves the app for an LLM prompt. */
export function historyForPrompt(history: HistoryPoint[]): HistoryPoint[] {
  return history.map((p) => ({ month: p.month, state: p.state ?? p.run!.state }));
}

export interface LoadedSave {
  /** The month-0 run the timeline is anchored to. */
  base: SimulationRun;
  /** The run at the save's month. */
  run: SimulationRun;
  history: HistoryPoint[];
  /** True when the save predates the run contract and was rebuilt by replaying. */
  replayed: boolean;
  note: string;
}

/**
 * Turn a save file into a complete run plus timeline.
 *
 * New files carry `run` and history points that carry runs: they load verbatim. Files written
 * before the contract stored corporations, ledger and game theory only for the final month, and
 * their history points were corrupted by the in-place mutation bug (A1), so there is nothing
 * honest to restore from them: the run is rebuilt by replaying month 0 to `month` with the
 * saved model. The caller is told, and says so in the console.
 */
export function historyFromSave(saved: SavedState): LoadedSave {
  const inputs: RunInputs = { model: saved.model };
  if (saved.run) {
    // Rebuild each point's `state` from its run (historyForSave drops the duplicate).
    const history = (saved.history ?? []).map((p) => (p.run ? historyPoint(p.run) : p));
    const partial = history.some((p) => !p.run);
    return {
      base: nearestFullPoint(history, 0) ?? initialRun(),
      run: saved.run,
      history,
      replayed: false,
      note: partial
        ? 'History points without full runs were kept for charting; seeking to them replays from month 0.'
        : '',
    };
  }
  const base = initialRun();
  const month = Math.max(0, saved.month || 0);
  const { run, history } = catchUp(base, month, inputs);
  return {
    base,
    run,
    history,
    replayed: true,
    note: `Save file predates the simulation-run format: rebuilt months 0-${month} by replaying with the saved model.`,
  };
}

import { conditionalWorld } from './conditionalWorld';
import { assertRunSupported } from './capabilities';
/**
 * Pure helpers that App.tsx's React layer delegates to.
 *
 * Stage 1 of the v3 plan (docs/design/audit-2026-09-13.md) found three defects that all came
 * from simulation logic living inside React callbacks: seek restored only countries (A3), the
 * comparison panel never advanced (A4), and save files stored a partial, mutated picture (A6).
 * Everything here is a plain function over `SimulationRun` so it can be tested without a DOM -
 * see simulation/appState.test.ts. App.tsx keeps only the state wiring.
 */

import type { Corporation, CountryStats, HistoryPoint, SavedState, SimulationState } from '../types';
import {
  COUNTRY_DATASET_ID,
  LEGACY_COUNTRY_DATASET_ID,
  isCountryDatasetId,
  worldPopulationMillionsFor,
  type CountryDatasetId,
} from '../constants';
import {
  advanceRun,
  initialRun, initOptionsFor, initializeConditionalOutputs,
  noCorporateUbiInputs,
  replayTo,
  runMonths,
  type RunInputs,
  type SimulationRun,
} from './run';
import { usdPerPerson } from './units';

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
  assertRunSupported(inputs.model,month,inputs.equations);
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
  assertRunSupported(inputsA.model,a.state.month+1,inputsA.equations);
  assertRunSupported(inputsB.model,b.state.month+1,inputsB.equations);
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
  assertRunSupported(inputs.model,month,inputs.equations);
  const target = Math.max(0, month);
  const elapsed=target-base.state.month;
  if(elapsed<0) throw new Error('Requested month precedes the available scenario snapshot');
  const runs = runMonths(base, elapsed, inputs);
  return { run: runs[elapsed], history: runs.slice(1).map(historyPoint) };
}

// ============================================================================
// PAIRED NO-UBI COUNTERFACTUAL (review 2026-09-14, finding 2)
// ============================================================================
// The Charts tab compares the main run with a second run from the SAME month-0 run, model,
// equations and corporations, differing only in that every contribution rate is held at 0.
// These helpers are the only way App.tsx steps, seeks and rebuilds that pair, so the two
// timelines cannot drift apart.

/** The main run and its paired counterfactual at the same month. */
export interface RunPair {
  run: SimulationRun;
  paired: SimulationRun;
}

/** Advance the main run with `inputs` and the counterfactual with the same inputs minus corporate UBI. */
export function stepWithCounterfactual(pair: RunPair, inputs: RunInputs): RunPair {
  return { run: advanceRun(pair.run, inputs), paired: advanceRun(pair.paired, noCorporateUbiInputs(inputs)) };
}

/** Seek both timelines to `month`. Both share the month-0 `base`. */
export function seekWithCounterfactual(
  history: HistoryPoint[],
  pairedHistory: HistoryPoint[],
  month: number,
  inputs: RunInputs,
  base: SimulationRun,
): RunPair {
  return {
    run: seekInHistory(history, month, inputs, base),
    paired: seekInHistory(pairedHistory, month, noCorporateUbiInputs(inputs), inputs.model.executionMode === 'world-conditional-v1' ? initializeConditionalOutputs(base,noCorporateUbiInputs(inputs)) : base),
  };
}

/**
 * Rebuild the counterfactual for a timeline that exists without one (a loaded save or autosave):
 * replay from the shared month-0 run to the furthest recorded month, and return the paired run
 * at `month` plus its history.
 */
export function rebuildCounterfactual(
  base: SimulationRun,
  history: HistoryPoint[],
  month: number,
  inputs: RunInputs,
): { paired: SimulationRun; pairedHistory: HistoryPoint[] } {
  const last = Math.max(month, 0, ...history.map((p) => p.month));
  const pairedBase = inputs.model.executionMode === 'world-conditional-v1' ? initializeConditionalOutputs(base,noCorporateUbiInputs(inputs)) : base;
  const caught = catchUp(pairedBase, last, noCorporateUbiInputs(inputs));
  const at = caught.history.find((p) => p.month === month)?.run ?? pairedBase;
  return { paired: at, pairedHistory: caught.history };
}

/**
 * A user edit to a corporation, as it should reach the counterfactual: identical except that the
 * contribution rate stays pinned (the counterfactual's one stated difference).
 */
export function corporationEditForCounterfactual(updates: Partial<Corporation>): Partial<Corporation> {
  const { contributionRate: _ignored, ...rest } = updates;
  return rest;
}

/** Apply the same corporation edit to a run (used for both members of the pair). */
export function editCorporation(run: SimulationRun, id: string, updates: Partial<Corporation>): SimulationRun {
  return { ...run, corporations: run.corporations.map((c) => (c.id === id ? { ...c, ...updates } : c)) };
}

/** Apply the same country edit to a run (used for both members of the pair). */
export function editCountry(
  run: SimulationRun,
  id: string,
  edit: (country: CountryStats) => Partial<CountryStats>,
): SimulationRun {
  const country = run.state.countryData[id];
  if (!country) return run;
  return {
    ...run,
    state: { ...run.state, countryData: { ...run.state.countryData, [id]: { ...country, ...edit(country) } } },
  };
}

// ============================================================================
// MAP HEADLINE STATS (review 2026-09-14, finding 13)
// ============================================================================

/** World population in millions of the process-default dataset (the engine uses the state's dataset; see headlineStats). */
export const WORLD_POPULATION_MILLIONS = worldPopulationMillionsFor(COUNTRY_DATASET_ID);

export interface HeadlineStats {
  /** Unweighted mean of country wellbeing (0-100). */
  meanCountryWellbeing: number;
  wellbeingAvailable: boolean;
  wellbeingLabel: string;
  /** USD per person this month from the global pool (equal per capita; excludes customer-weighted and HQ-local payments). */
  globalDividendUsd: number;
  /** Unweighted mean of country AI adoption (0-1). */
  meanCountryAdoption: number;
  /** Billions USD routed to the global pool this month (paid out the same month, not accumulated). */
  globalPoolBillions: number;
}

/** The numbers the map's headline row shows, from the same state the engine wrote. */
export function headlineStats(state: SimulationState): HeadlineStats {
  const countries = Object.values(state.countryData);
  const n = countries.length || 1;
  return {
    meanCountryWellbeing: state.conditionalSummary ? state.conditionalSummary.value ?? NaN : state.averageWellbeing,
    wellbeingAvailable: !state.conditionalSummary || state.conditionalSummary.value !== null,
    wellbeingLabel: state.conditionalSummary ? 'Population-weighted conditional index' : 'Mean country wellbeing',
    globalDividendUsd: usdPerPerson(
      state.globalFund,
      worldPopulationMillionsFor(isCountryDatasetId(state.countryDataset) ? state.countryDataset : COUNTRY_DATASET_ID),
    ),
    meanCountryAdoption: countries.reduce((a, c) => a + c.aiAdoption, 0) / n,
    globalPoolBillions: state.globalFund,
  };
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
  /** The country dataset the save runs on ('countries-legacy-v1' for saves written before the 2026-09 migration). */
  countryDataset: CountryDatasetId;
}

/**
 * The country dataset a save file was made on. Saves written before the 2026-09 migration carry no
 * dataset id anywhere and ran on the hand-entered table, so they reopen on 'countries-legacy-v1'.
 * An id this build does not know is an error, not a silent fallback.
 */
export function saveCountryDataset(saved: Pick<SavedState, 'countryDataset' | 'run'>): CountryDatasetId {
  // The run's own stamp is what the timeline was computed on; the top-level field is its copy.
  const id = saved.run?.state?.countryDataset ?? saved.countryDataset ?? LEGACY_COUNTRY_DATASET_ID;
  if (!isCountryDatasetId(id)) throw new Error(`save file uses country dataset "${id}", which this build does not have`);
  return id;
}

/** A run stamped with a dataset id when it has none (pre-migration saves). */
function withCountryDataset(run: SimulationRun, countryDataset: CountryDatasetId): SimulationRun {
  return run.state.countryDataset ? run : { ...run, state: { ...run.state, countryDataset } };
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
  const countryDataset = saveCountryDataset(saved);
  const init = initOptionsFor(saved.model, countryDataset);
  assertRunSupported(saved.model,saved.run?.state.month ?? saved.month);
  if (saved.model.executionMode === 'world-conditional-v1') {
    if (!saved.run || !saved.baseRun) throw new Error('Conditional save requires complete current and initial run inputs');
    const refresh = (r: SimulationRun): SimulationRun => {
      assertRunSupported(saved.model,r.state.month);
      const out=conditionalWorld({state:r.state,corporations:r.corporations,model:saved.model},false,true);
      return {...out,state:{...out.state,importedUnverified:true}};
    };
    const base=refresh(saved.baseRun), run=refresh(saved.run);
    const history=(saved.history??[]).map(p=>{if(!p.run) throw new Error('Conditional save needs complete history inputs');return historyPoint(refresh(p.run));});
    return {base,run,history,replayed:false,note:'Conditional accounting and mapping recomputed from imported economic inputs. Macro/input history is unverified; this snapshot is not a verified replay.',countryDataset};
  }
  if (saved.run) {
    // Rebuild each point's `state` from its run (historyForSave drops the duplicate). Runs from
    // pre-migration saves are stamped with the legacy dataset so replay and seek use its world
    // population and anchor coefficients.
    const history = (saved.history ?? []).map((p) => (p.run ? historyPoint(withCountryDataset(p.run, countryDataset)) : p));
    const partial = history.some((p) => !p.run);
    return {
      base: nearestFullPoint(history, 0) ?? initialRun(undefined, undefined, init),
      run: withCountryDataset(saved.run, countryDataset),
      history,
      replayed: false,
      note: partial
        ? 'History points without full runs were kept for charting; seeking to them replays from month 0.'
        : '',
      countryDataset,
    };
  }
  const base = initialRun(undefined, undefined, init);
  const month = Math.max(0, saved.month || 0);
  const { run, history } = catchUp(base, month, inputs);
  return {
    base,
    run,
    history,
    replayed: true,
    note: `Save file predates the simulation-run format: rebuilt months 0-${month} by replaying with the saved model.`,
    countryDataset,
  };
}

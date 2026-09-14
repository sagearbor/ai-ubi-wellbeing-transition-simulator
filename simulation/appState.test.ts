import { describe, it, expect } from 'vitest';
import {
  catchUp,
  historyForPrompt,
  historyForSave,
  historyFromSave,
  historyPoint,
  nearestFullPoint,
  recordRunInHistory,
  saveCountryDataset,
  seekInHistory,
  stepBoth,
} from './appState';
import { initialRun, runMonths, runsEqual, type RunInputs, type SimulationRun } from './run';
import { PRESET_MODELS, COUNTRY_DATASET_ID, LEGACY_COUNTRY_DATASET_ID, WB_COUNTRY_DATASET_ID } from '../constants';
import type { HistoryPoint, SavedState, SimulationState } from '../types';

const inputs: RunInputs = { model: PRESET_MODELS[0] };
const other: RunInputs = { model: PRESET_MODELS[1] };

/** The timeline the app builds by pressing Step N times. */
function play(months: number, from = initialRun(), how: RunInputs = inputs) {
  let history: HistoryPoint[] = [];
  let run = from;
  for (let i = 0; i < months; i++) {
    run = runMonths(run, 1, how)[1];
    history = recordRunInHistory(history, run);
  }
  return { run, history, base: from };
}

describe('history recording (audit A3)', () => {
  it('every recorded point carries the whole run, not just the countries', () => {
    const { history } = play(4);
    expect(history).toHaveLength(4);
    for (const p of history) {
      expect(p.run).toBeDefined();
      expect(p.run!.state.month).toBe(p.month);
      expect(p.run!.corporations.length).toBeGreaterThan(0);
      expect(p.run!.state).toBe(p.state);
    }
  });

  it('recording after a rewind drops the abandoned future', () => {
    const { history, base } = play(5);
    const atTwo = seekInHistory(history, 2, inputs, base);
    const branched = recordRunInHistory(history, runMonths(atTwo, 1, other)[1]);
    expect(branched.map((p) => p.month)).toEqual([1, 2, 3]);
    expect(branched[2].run).not.toBe(history[2].run);
  });

  it('nearestFullPoint ignores points that carry no run', () => {
    const { history } = play(5);
    const stripped = history.map((p, i) => (i >= 2 ? { month: p.month, state: p.state } : p));
    expect(nearestFullPoint(stripped, 5)?.state.month).toBe(2);
    expect(nearestFullPoint([], 5)).toBeNull();
  });
});

describe('seek restores the complete run (audit A3)', () => {
  it('seeking to month m equals stepping to m, in every part of the run', () => {
    const { history, base } = play(12);
    for (const m of [0, 1, 5, 11, 12]) {
      const sought = seekInHistory(history, m, inputs, base);
      const stepped = runMonths(base, m, inputs)[m];
      expect(runsEqual(sought, stepped)).toBe(true);
      expect(sought.ledger).toEqual(stepped.ledger);
      expect(sought.gameTheory).toEqual(stepped.gameTheory);
      expect(sought.state.month).toBe(m);
    }
  });

  it('a seek never mixes corporations from one month with countries from another', () => {
    const { history, base } = play(8);
    const sought = seekInHistory(history, 3, inputs, base);
    const stepped = runMonths(base, 3, inputs)[3];
    // The specific bug: state came from history, corporations stayed at the latest month.
    const latest = history[history.length - 1].run!;
    expect(sought.corporations[0].aiRevenue).toBe(stepped.corporations[0].aiRevenue);
    expect(sought.corporations[0].aiRevenue).not.toBe(latest.corporations[0].aiRevenue);
    expect(sought.ledger.totalFunds).not.toBe(latest.ledger.totalFunds);
  });

  it('replays when the history point has no run (old save files)', () => {
    const { history, base } = play(9);
    const stripped: HistoryPoint[] = history.map((p) => ({ month: p.month, state: p.state }));
    const sought = seekInHistory(stripped, 7, inputs, base);
    expect(runsEqual(sought, runMonths(base, 7, inputs)[7])).toBe(true);
  });

  it('replays forward from the nearest earlier full point', () => {
    const { history, base } = play(10);
    // Only months 1-4 kept their runs; seeking to 9 must replay from month 4.
    const partial = history.map((p) => (p.month > 4 ? { month: p.month, state: p.state } : p));
    const sought = seekInHistory(partial, 9, inputs, base);
    expect(runsEqual(sought, runMonths(base, 9, inputs)[9])).toBe(true);
  });

  it('seeking to month 0 returns the base run, whatever the history holds', () => {
    const { history, base } = play(6);
    expect(seekInHistory(history, 0, inputs, base)).toBe(base);
    expect(seekInHistory([], 0, inputs, base)).toBe(base);
  });
});

describe('comparison mode advances in lockstep (audit A4)', () => {
  it('both runs move one month per step and stay on the same month', () => {
    let a = initialRun();
    let b = initialRun();
    for (let m = 1; m <= 10; m++) {
      ({ a, b } = stepBoth(a, inputs, b, other));
      expect(a.state.month).toBe(m);
      expect(b.state.month).toBe(m);
    }
  });

  it('zero policy difference gives zero paired difference at every month', () => {
    let a = initialRun();
    let b = initialRun();
    for (let m = 1; m <= 24; m++) {
      ({ a, b } = stepBoth(a, inputs, b, inputs));
      expect(runsEqual(a, b)).toBe(true);
      expect(a.state.averageWellbeing - b.state.averageWellbeing).toBe(0);
      expect(a.ledger.totalFunds - b.ledger.totalFunds).toBe(0);
    }
  });

  it('a different scenario does diverge, so the panel is not vacuous', () => {
    let a = initialRun();
    let b = initialRun();
    for (let m = 1; m <= 24; m++) ({ a, b } = stepBoth(a, inputs, b, other));
    expect(runsEqual(a, b)).toBe(false);
  });

  it('catchUp puts a freshly built comparison run on the main panel month', () => {
    const main = runMonths(initialRun(), 7, inputs)[7];
    const caught = catchUp(initialRun(), main.state.month, inputs);
    expect(caught.run.state.month).toBe(main.state.month);
    expect(caught.history.map((p) => p.month)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(runsEqual(caught.run, main)).toBe(true);
  });

  it('stepBoth does not modify either input run', () => {
    const a0 = initialRun();
    const b0 = initialRun();
    const snapshot = JSON.stringify(a0.state.countryData.USA);
    stepBoth(a0, inputs, b0, other);
    expect(JSON.stringify(a0.state.countryData.USA)).toBe(snapshot);
    expect(a0.state.month).toBe(0);
    expect(b0.state.month).toBe(0);
  });
});

describe('save files (audit A6)', () => {
  function newFormatSave(months: number): SavedState {
    const { run, history } = play(months);
    return {
      version: '2.1',
      timestamp: Date.now(),
      month: run.state.month,
      run,
      corporations: run.corporations,
      countryData: run.state.countryData,
      globalLedger: run.ledger,
      gameTheoryState: run.gameTheory,
      model: inputs.model,
      history,
    };
  }

  /**
   * What the app wrote before the run contract: final month only, history without runs. Those
   * saves also predate the 2026-09 country-data migration, so they ran on the hand-entered table
   * and carry no dataset id.
   */
  function oldFormatSave(months: number): SavedState {
    const legacyBase = initialRun(undefined, undefined, { countryDataset: LEGACY_COUNTRY_DATASET_ID });
    const { run, history } = play(months, legacyBase);
    const strip = (state: SimulationState): SimulationState => {
      const { countryDataset: _none, ...rest } = state;
      return rest;
    };
    return {
      version: '2.0',
      timestamp: Date.now(),
      month: run.state.month,
      corporations: run.corporations,
      countryData: run.state.countryData,
      globalLedger: run.ledger,
      gameTheoryState: run.gameTheory,
      model: inputs.model,
      history: history.map((p) => ({ month: p.month, state: strip(p.state) })),
    };
  }

  const legacyInit = () => initialRun(undefined, undefined, { countryDataset: LEGACY_COUNTRY_DATASET_ID });

  it('a new-format save loads its run verbatim, with a seekable timeline', () => {
    const saved = newFormatSave(6);
    const loaded = historyFromSave(saved);
    expect(loaded.replayed).toBe(false);
    expect(loaded.run).toBe(saved.run);
    expect(loaded.history).toHaveLength(6);
    expect(seekInHistory(loaded.history, 4, inputs, loaded.base).state.month).toBe(4);
  });

  it('loading an old-format save yields the same run as a fresh replay', () => {
    const months = 8;
    const loaded = historyFromSave(oldFormatSave(months));
    const fresh = runMonths(legacyInit(), months, inputs)[months];
    expect(loaded.countryDataset).toBe(LEGACY_COUNTRY_DATASET_ID);
    expect(loaded.replayed).toBe(true);
    expect(loaded.run.state.month).toBe(months);
    expect(runsEqual(loaded.run, fresh)).toBe(true);
    expect(loaded.run.ledger).toEqual(fresh.ledger);
    expect(loaded.run.gameTheory).toEqual(fresh.gameTheory);
    expect(loaded.note).toMatch(/predates/);
  });

  it('the rebuilt timeline is complete and seekable', () => {
    const loaded = historyFromSave(oldFormatSave(8));
    expect(loaded.history.map((p) => p.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const p of loaded.history) expect(p.run).toBeDefined();
    const sought = seekInHistory(loaded.history, 5, inputs, loaded.base);
    expect(runsEqual(sought, runMonths(legacyInit(), 5, inputs)[5])).toBe(true);
  });

  it('a new-format save records its dataset and reloads on it', () => {
    const plain = newFormatSave(3);
    const loaded = historyFromSave({ ...plain, countryDataset: plain.run!.state.countryDataset });
    expect(loaded.countryDataset).toBe(COUNTRY_DATASET_ID);
    expect(loaded.run.state.countryDataset).toBe(COUNTRY_DATASET_ID);
    // A file whose run carries no stamp but whose top level does (e.g. an autosave written without runs).
    const { run: _run, ...noRun } = plain;
    expect(historyFromSave({ ...noRun, countryDataset: WB_COUNTRY_DATASET_ID }).countryDataset).toBe(WB_COUNTRY_DATASET_ID);
  });

  it('a run-format save written before the country-data migration reopens on countries-legacy-v1 and replays exactly', () => {
    // Build the timeline on the legacy table, then remove every dataset id, as such a file has none.
    const { run, history } = play(6, legacyInit());
    const strip = (r: SimulationRun): SimulationRun => {
      const { countryDataset: _none, ...state } = r.state;
      return { ...r, state };
    };
    const saved: SavedState = {
      version: '2.1', timestamp: 0, month: 6, run: strip(run), corporations: run.corporations,
      countryData: run.state.countryData, globalLedger: run.ledger, gameTheoryState: run.gameTheory,
      model: inputs.model, history: historyForSave(history.map((p) => historyPoint(strip(p.run!)))),
    };
    const loaded = historyFromSave(saved);
    expect(loaded.countryDataset).toBe(LEGACY_COUNTRY_DATASET_ID);
    expect(loaded.run.state.countryDataset).toBe(LEGACY_COUNTRY_DATASET_ID);
    // Continuing the loaded run matches continuing the original legacy run.
    const next = runMonths(loaded.run, 3, inputs)[3];
    expect(runsEqual(next, runMonths(run, 3, inputs)[3])).toBe(true);
    // Seeking to a month without a recorded run replays on the legacy dataset too.
    const sparse = loaded.history.filter((p) => p.month !== 4);
    expect(runsEqual(seekInHistory(sparse, 4, inputs, loaded.base), runMonths(legacyInit(), 4, inputs)[4])).toBe(true);
  });

  it('an unknown dataset id is an error, not a silent fallback', () => {
    expect(() => saveCountryDataset({ countryDataset: 'countries-from-the-future' })).toThrow(/does not have/);
    expect(saveCountryDataset({})).toBe(LEGACY_COUNTRY_DATASET_ID);
  });

  it('a save at month 0 round-trips without replaying anything', () => {
    const loaded = historyFromSave(oldFormatSave(0));
    expect(loaded.run.state.month).toBe(0);
    expect(loaded.history).toEqual([]);
  });

  it('a JSON round trip through historyForSave restores the same runs', () => {
    const saved = newFormatSave(5);
    saved.history = historyForSave(saved.history);
    // The duplicated country block is not written twice.
    for (const p of saved.history) expect((p as { state?: unknown }).state).toBeUndefined();
    const onDisk = JSON.parse(JSON.stringify(saved)) as SavedState;
    const loaded = historyFromSave(onDisk);
    expect(loaded.history.map((p) => p.month)).toEqual([1, 2, 3, 4, 5]);
    for (const p of loaded.history) expect(p.state).toBe(p.run!.state);
    const sought = seekInHistory(loaded.history, 4, inputs, loaded.base);
    expect(runsEqual(sought, runMonths(initialRun(), 4, inputs)[4])).toBe(true);
    expect(JSON.stringify(saved).length).toBeLessThan(JSON.stringify(newFormatSave(5)).length);
  });

  it('historyForPrompt keeps the chartable slice and drops the run payload', () => {
    const { history } = play(4);
    const trimmed = historyForPrompt(history);
    expect(trimmed.map((p) => p.month)).toEqual([1, 2, 3, 4]);
    for (const p of trimmed) expect(p.run).toBeUndefined();
    expect(trimmed[0].state).toBe(history[0].state);
    expect(JSON.stringify(trimmed).length).toBeLessThan(JSON.stringify(history).length);
  });

  it('a new-format save whose points lost their runs still seeks, by replaying', () => {
    const saved = newFormatSave(5);
    saved.history = saved.history.map((p) => ({ month: p.month, state: p.state }));
    const loaded = historyFromSave(saved);
    expect(loaded.replayed).toBe(false);
    expect(loaded.note).toMatch(/replays from month 0/);
    const sought = seekInHistory(loaded.history, 3, inputs, loaded.base);
    expect(runsEqual(sought, runMonths(initialRun(), 3, inputs)[3])).toBe(true);
  });
});

describe('historyPoint', () => {
  it('records the month and shares the run object it was built from', () => {
    const r: SimulationRun = runMonths(initialRun(), 2, inputs)[2];
    const p = historyPoint(r);
    expect(p.month).toBe(2);
    expect(p.run).toBe(r);
    expect(p.state).toBe(r.state);
  });
});

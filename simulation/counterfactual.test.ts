/**
 * Review 2026-09-14, finding 2: the Charts "No UBI" line must be a paired run of the same model
 * that differs only in corporate UBI. These tests check the rows MotionChart actually draws
 * (buildMotionChartData), not just two runs of the engine.
 */
import { describe, it, expect } from 'vitest';
import { buildMotionChartData } from '../components/MotionChart';
import {
  corporationEditForCounterfactual,
  editCorporation,
  historyForSave,
  historyFromSave,
  rebuildCounterfactual,
  recordRunInHistory,
  seekWithCounterfactual,
  stepWithCounterfactual,
  type RunPair,
} from './appState';
import { initialRun, noCorporateUbiInputs, runMonths, runsEqual, type RunInputs, type SimulationRun } from './run';
import { INITIAL_CORPORATIONS, PRESET_MODELS } from '../constants';
import type { HistoryPoint, SavedState } from '../types';

const inputs: RunInputs = { model: PRESET_MODELS[0] };

/** Press Step `months` times the way App.tsx does, recording both timelines. */
function playPair(months: number, base: SimulationRun, how: RunInputs = inputs, from?: { pair: RunPair; history: HistoryPoint[]; pairedHistory: HistoryPoint[] }) {
  let pair: RunPair = from?.pair ?? { run: base, paired: base };
  let history = from?.history ?? [];
  let pairedHistory = from?.pairedHistory ?? [];
  for (let i = 0; i < months; i++) {
    pair = stepWithCounterfactual(pair, how);
    history = recordRunInHistory(history, pair.run);
    pairedHistory = recordRunInHistory(pairedHistory, pair.paired);
  }
  return { pair, history, pairedHistory, base };
}

const zeroRoster = () => INITIAL_CORPORATIONS.map((c) => ({ ...c, contributionRate: 0 }));
const ids = (run: SimulationRun) => ['Global', ...Object.keys(run.state.countryData)];

describe('paired no-UBI counterfactual at the chart boundary (finding 2)', () => {
  it('with every contribution at 0, the displayed counterfactual equals the main run exactly', () => {
    const base = initialRun(zeroRoster());
    const { history, pairedHistory } = playPair(24, base);
    const rows = buildMotionChartData(history, pairedHistory);

    // The reviewer's probe: after one month with all contributions 0, US wellbeing was 92.472
    // and the old shadow showed 67.128. The paired line must show the same number.
    const m1 = rows.find((r) => r.month === 1)!;
    expect(history[0].run!.ledger.monthlyInflow).toBe(0);
    expect(m1.Paired_USA).toBe(m1.Wellbeing_USA);
    expect(m1.Wellbeing_USA).toBeCloseTo(92.472, 3);

    // The engine's adaptive rules may later RAISE a rate from 0 in the main run (the pinned run
    // cannot). For every month in which the main run has paid no UBI at all so far, every
    // series - each country and the global mean - must be identical.
    let zeroSoFar = 0;
    for (const row of rows) {
      const point = history.find((p) => p.month === row.month)!;
      const paidSoFar = history.filter((p) => p.month <= row.month).some((p) => p.run!.ledger.monthlyInflow !== 0);
      if (paidSoFar) break;
      zeroSoFar++;
      for (const id of ids(point.run!)) expect(row[`Paired_${id}`]).toBe(row[`Wellbeing_${id}`]);
    }
    expect(zeroSoFar).toBeGreaterThanOrEqual(1);
  });

  it('with no UBI in either run for the whole horizon, all 24 months of every displayed series are identical', () => {
    // Hold the main run's rates at 0 too: the model, roster and equations are the same, so the
    // chart must show no gap at all, at any month.
    const base = initialRun(zeroRoster());
    let run = base;
    let paired = base;
    let history: HistoryPoint[] = [];
    let pairedHistory: HistoryPoint[] = [];
    for (let m = 0; m < 24; m++) {
      const next = stepWithCounterfactual({ run, paired }, noCorporateUbiInputs(inputs));
      run = next.run;
      paired = next.paired;
      history = recordRunInHistory(history, run);
      pairedHistory = recordRunInHistory(pairedHistory, paired);
    }
    const rows = buildMotionChartData(history, pairedHistory);
    expect(rows).toHaveLength(24);
    for (const row of rows) {
      for (const id of ids(base)) expect(row[`Paired_${id}`]).toBe(row[`Wellbeing_${id}`]);
    }
  });

  it('with contributions, the only differences stem from UBI', () => {
    const base = initialRun();
    const { history, pairedHistory } = playPair(24, base);
    const rows = buildMotionChartData(history, pairedHistory);
    const cumulativeUbi: Record<string, number> = {};
    let differing = 0;

    for (let i = 0; i < history.length; i++) {
      const main = history[i].run!;
      const cf = pairedHistory[i].run!;
      expect(cf.state.month).toBe(main.state.month);

      // The counterfactual pays nothing, ever.
      expect(cf.ledger.monthlyInflow).toBe(0);
      expect(cf.ledger.monthlyOutflow).toBe(0);
      expect(cf.corporations.every((c) => c.contributionRate === 0)).toBe(true);

      const row = rows[i];
      for (const id of Object.keys(main.state.countryData)) {
        const a = main.state.countryData[id];
        const b = cf.state.countryData[id];
        expect(b.totalUbiReceived).toBe(0);
        // Adoption does not depend on transfers in this model: identical in both runs.
        expect(b.aiAdoption).toBe(a.aiAdoption);
        cumulativeUbi[id] = (cumulativeUbi[id] ?? 0) + a.totalUbiReceived;
        // A country that has received no UBI yet has not been treated: no gap on the chart.
        if (cumulativeUbi[id] === 0) expect(row[`Paired_${id}`]).toBe(row[`Wellbeing_${id}`]);
        else if (row[`Paired_${id}`] !== row[`Wellbeing_${id}`]) differing++;
      }
    }
    // Not vacuous: treated countries do show a gap.
    expect(differing).toBeGreaterThan(0);
    expect(history[history.length - 1].run!.ledger.monthlyInflow).toBeGreaterThan(0);
  });

  it('a corporation edit reaches the counterfactual except for its contribution rate', () => {
    const base = initialRun();
    const id = base.corporations[0].id;
    const updates = { contributionRate: 0.4, distributionStrategy: 'hq-local' as const };
    const main = editCorporation(base, id, updates);
    const cf = editCorporation(base, id, corporationEditForCounterfactual(updates));
    expect(main.corporations[0].contributionRate).toBe(0.4);
    expect(cf.corporations[0].contributionRate).toBe(base.corporations[0].contributionRate);
    expect(cf.corporations[0].distributionStrategy).toBe('hq-local');
  });
});

describe('seek, replay, branch and load keep both timelines in sync (finding 2)', () => {
  it('seeking restores both runs at the same month, equal to stepping each from month 0', () => {
    const { history, pairedHistory, base } = playPair(12, initialRun());
    for (const m of [0, 1, 5, 11, 12]) {
      const { run, paired } = seekWithCounterfactual(history, pairedHistory, m, inputs, base);
      expect(run.state.month).toBe(m);
      expect(paired.state.month).toBe(m);
      expect(runsEqual(run, runMonths(base, m, inputs)[m])).toBe(true);
      const expected = runMonths(base, m, noCorporateUbiInputs(inputs))[m];
      expect(runsEqual(paired, expected)).toBe(true);
      expect(paired.ledger).toEqual(expected.ledger);
    }
  });

  it('seeking a timeline whose points carry no runs replays both and still matches', () => {
    const { history, pairedHistory, base } = playPair(8, initialRun());
    const strip = (h: HistoryPoint[]) => h.map((p) => ({ month: p.month, state: p.state }));
    const replayed = seekWithCounterfactual(strip(history), strip(pairedHistory), 6, inputs, base);
    const exact = seekWithCounterfactual(history, pairedHistory, 6, inputs, base);
    expect(runsEqual(replayed.run, exact.run)).toBe(true);
    expect(runsEqual(replayed.paired, exact.paired)).toBe(true);
  });

  it('rewinding and stepping on with a different model branches both timelines together', () => {
    const played = playPair(6, initialRun());
    const at3 = seekWithCounterfactual(played.history, played.pairedHistory, 3, inputs, played.base);
    const other: RunInputs = { model: PRESET_MODELS[1] };
    const branched = playPair(2, played.base, other, { pair: at3, history: played.history, pairedHistory: played.pairedHistory });
    expect(branched.history.map((p) => p.month)).toEqual([1, 2, 3, 4, 5]);
    expect(branched.pairedHistory.map((p) => p.month)).toEqual([1, 2, 3, 4, 5]);
    const expectedPaired = runMonths(runMonths(played.base, 3, noCorporateUbiInputs(inputs))[3], 2, noCorporateUbiInputs(other))[2];
    expect(runsEqual(branched.pair.paired, expectedPaired)).toBe(true);
    const rows = buildMotionChartData(branched.history, branched.pairedHistory);
    expect(rows[4].Paired_USA).toBe(expectedPaired.state.countryData.USA.wellbeing);
  });

  it('a loaded save rebuilds the counterfactual identical to the one that was stepped', () => {
    const { pair, history, pairedHistory } = playPair(10, initialRun());
    // Seek back to month 7 before saving: the file's run is at 7, its history runs to 10.
    const at7 = seekWithCounterfactual(history, pairedHistory, 7, inputs, initialRun());
    expect(pair.run.state.month).toBe(10);
    const saved = JSON.parse(JSON.stringify({
      version: '2.1', timestamp: 0, month: 7, run: at7.run, corporations: at7.run.corporations,
      countryData: at7.run.state.countryData, globalLedger: at7.run.ledger, gameTheoryState: at7.run.gameTheory,
      model: inputs.model, history: historyForSave(history),
    })) as SavedState;
    const loaded = historyFromSave(saved);
    const cf = rebuildCounterfactual(loaded.base, loaded.history, loaded.run.state.month, { model: saved.model });
    expect(cf.paired.state.month).toBe(7);
    expect(runsEqual(cf.paired, at7.paired)).toBe(true);
    expect(cf.pairedHistory.map((p) => p.month)).toEqual(pairedHistory.map((p) => p.month));
    const before = buildMotionChartData(history, pairedHistory);
    const after = buildMotionChartData(loaded.history, cf.pairedHistory);
    for (let i = 0; i < before.length; i++) expect(after[i].Paired_USA).toBe(before[i].Paired_USA);
  });
});

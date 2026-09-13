import { describe, it, expect } from 'vitest';
import { advanceRun, initialRun, replayTo, runMonths, runsEqual } from './run';
import { PRESET_MODELS } from '../constants';

const inputs = { model: PRESET_MODELS[0] };

describe('SimulationRun purity (audit 2026-09-13)', () => {
  it('advancing a run does not modify the input run', () => {
    const r0 = initialRun();
    const usaBefore = r0.state.countryData.USA.wellbeing;
    const corpBefore = { ...r0.corporations[0] };
    const snapshot = JSON.stringify(r0.state.countryData.USA);
    const r1 = advanceRun(r0, inputs);
    expect(r0.state.countryData.USA.wellbeing).toBe(usaBefore);
    expect(JSON.stringify(r0.state.countryData.USA)).toBe(snapshot);
    expect(r0.corporations[0]).toEqual(corpBefore);
    expect(r1.state.month).toBe(1);
    expect(r1.state.countryData.USA).not.toBe(r0.state.countryData.USA);
  });

  it('stored history points keep their own values (the in-place mutation bug)', () => {
    const runs = runMonths(initialRun(), 6, inputs);
    const recorded = runs.map((r) => r.state.countryData.USA.wellbeing);
    // Re-read after all steps: values must be unchanged and distinct objects per month.
    for (let m = 0; m <= 6; m++) expect(runs[m].state.countryData.USA.wellbeing).toBe(recorded[m]);
    expect(runs[1].state.countryData.USA).not.toBe(runs[6].state.countryData.USA);
    expect(new Set(recorded).size).toBeGreaterThan(1);
  });

  it('replayTo reproduces stepping exactly (seek == step)', () => {
    const base = initialRun();
    const stepped = runMonths(base, 12, inputs)[12];
    const replayed = replayTo(base, 12, inputs);
    expect(runsEqual(stepped, replayed)).toBe(true);
    expect(replayed.ledger).toEqual(stepped.ledger);
    expect(replayed.gameTheory).toEqual(stepped.gameTheory);
  });

  it('paired comparison: identical inputs give identical runs (zero policy difference = zero paired difference)', () => {
    const a = runMonths(initialRun(), 24, inputs)[24];
    const b = runMonths(initialRun(), 24, inputs)[24];
    expect(runsEqual(a, b)).toBe(true);
    expect(a.state.averageWellbeing).toBe(b.state.averageWellbeing);
  });

  it('a different model gives a different run (the comparison is not vacuous)', () => {
    const a = runMonths(initialRun(), 24, inputs)[24];
    const b = runMonths(initialRun(), 24, { model: PRESET_MODELS[1] })[24];
    expect(runsEqual(a, b)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL } from '../constants';
import { conditionalWorld } from './conditionalWorld';
import { advanceRun, evaluateConditionalSnapshot, initialRun, initOptionsFor, noCorporateUbiInputs, replayTo } from './run';
import { historyThroughCurrent, rebuildCounterfactual, seekInHistory, writeRecoverySnapshot } from './appState';
import { decodeSharePayload, encodeSharePayload } from '../src/services/scenarioShare';
import type { ModelParameters, SavedState } from '../types';

const initial = (model: ModelParameters = DEFAULT_MODEL) => initialRun(undefined, undefined, initOptionsFor(model));
const evaluate = (run: ReturnType<typeof initial>) => evaluateConditionalSnapshot(run, { model: DEFAULT_MODEL });

describe('conditional adversarial review regressions', () => {
  it.each([false, true])('keeps month-12 snapshot macro state in its zero-transfer arm (reference=%s)', reference => {
    const model = reference ? { ...DEFAULT_MODEL, macro: { ...DEFAULT_MODEL.macro!, usReference: 'substantial' as const } } : DEFAULT_MODEL;
    const snapshot = replayTo(initial(model), 12, { model });
    expect(snapshot.state.countryData.USA.displacedPool).toBeGreaterThan(0);
    const reopened = decodeSharePayload(encodeSharePayload(model, 'countries-wb-2026-09', snapshot)).run!;
    const paired = rebuildCounterfactual(reopened, [], 12, { model }).paired;
    expect(paired.state.month).toBe(12);
    expect(paired.ledger.monthlyInflow).toBe(0);
    for (const id of Object.keys(reopened.state.countryData)) {
      for (const field of ['gdpPerCapita', 'gdpNoAi', 'aiAdoption', 'lastAiAdoption', 'displacedPool', 'unemployment', 'laborShare'] as const) {
        expect(paired.state.countryData[id][field]).toBe(reopened.state.countryData[id][field]);
      }
    }
    const nextMain = advanceRun(reopened, { model });
    const nextPaired = advanceRun(paired, noCorporateUbiInputs({ model }));
    expect(nextPaired.state.countryData.USA.gdpPerCapita).toBe(nextMain.state.countryData.USA.gdpPerCapita);
    expect(nextPaired.state.countryData.USA.unemployment).toBe(nextMain.state.countryData.USA.unemployment);
    expect(nextPaired.state.countryData.USA.conditionalWellbeing!.nonIncomeUnemployment).toBe(nextMain.state.countryData.USA.conditionalWellbeing!.nonIncomeUnemployment);
  });

  it('rejects overflowing aggregate requests and population without modifying the snapshot', () => {
    const requests = initial();
    requests.corporations.slice(0, 2).forEach(c => { c.fundingRequest = { kind: 'amount', monthlyBillions: 1e308 }; });
    const before = structuredClone(requests);
    expect(() => evaluate(requests)).toThrow(/aggregate requested/);
    expect(requests).toEqual(before);
    const population = initial();
    Object.values(population.state.countryData).forEach(c => { c.population = 1e308; });
    population.corporations.forEach(c => { c.contributionRate = 0; });
    expect(() => evaluate(population)).toThrow(/population/);
  });

  it('normalizes weighted means before multiplication for representable extreme populations', () => {
    const run = initial();
    Object.values(run.state.countryData).forEach(c => { c.population = 1e305; });
    run.corporations.forEach(c => { c.contributionRate = 0; });
    const out = evaluate(run);
    expect(Number.isFinite(out.state.conditionalSummary!.rawPopulationWeighted)).toBe(true);
    expect(Number.isFinite(out.state.conditionalSummary!.populationMillions)).toBe(true);
    expect(out.state.conditionalSummary!.value).not.toBeNull();
  });

  it.each([
    ['displacedPool', -10], ['displacedPool', 2], ['gdpNoAi', 0], ['gdpNoAi', NaN],
    ['lastAiAdoption', -1], ['lastAiAdoption', 2], ['laborShare', -0.1], ['laborShare', 2],
  ] as const)('rejects invalid hidden state %s=%s on evaluation, stepping and share import', (field, value) => {
    const run = initial();
    run.state.countryData.USA[field] = value;
    expect(() => evaluate(run)).toThrow();
    expect(() => advanceRun(run, { model: DEFAULT_MODEL })).toThrow();
    expect(() => decodeSharePayload(encodeSharePayload(DEFAULT_MODEL, 'countries-wb-2026-09', run))).toThrow();
  });

  it('validates post-macro state, not only supplied individual inputs', () => {
    const run = initial();
    run.state.countryData.USA.gdpNoAi = 1e308;
    const model = { ...DEFAULT_MODEL, macro: { ...DEFAULT_MODEL.macro!, productivityGain: 100 } };
    expect(() => advanceRun(run, { model })).toThrow(/gdpPerCapita/);
  });

  it('retains the raw adoption calculation and explicitly marks its numerical cap', () => {
    const model = { ...DEFAULT_MODEL, aiGrowthRate: 100 };
    const run = initial(model);
    const country = run.state.countryData.USA;
    const serving = run.corporations.filter(c => c.operatingCountries.includes('USA'));
    const meanCapability = serving.reduce((s, c) => s + c.aiAdoptionLevel, 0) / serving.length;
    const expected = country.aiAdoption + 100 * (1 + country.gdpPerCapita / 100000) * meanCapability * .1 * (1 - country.aiAdoption);
    const out = advanceRun(run, { model });
    expect(out.state.countryData.USA.aiAdoption).toBe(.999);
    expect(out.state.countryData.USA.adoptionDiagnostics).toEqual({ raw: expected, actual: .999, cap: .999, capActive: true, kind: 'numerical-cap' });
  });

  it('rejects helper seeks before a snapshot anchor, even with an earlier cached point', () => {
    const base = replayTo(initial(), 12, { model: DEFAULT_MODEL });
    const earlier = initial();
    expect(() => seekInHistory([], 0, { model: DEFAULT_MODEL }, base)).toThrow(/precedes/);
    expect(() => seekInHistory([{ month: 0, state: earlier.state, run: earlier }], 0, { model: DEFAULT_MODEL }, base)).toThrow(/precedes/);
    expect(seekInHistory([], 12, { model: DEFAULT_MODEL }, base)).toBe(base);
  });

  it('includes exactly one contemporaneous month-zero chart point', () => {
    const base = initial();
    const points = historyThroughCurrent([], base, base);
    expect(points).toHaveLength(1);
    expect(points[0].month).toBe(0);
    expect(points[0].state.conditionalSummary!.value).toBe(base.state.conditionalSummary!.value);
  });

  it('preserves last successful recovery on quota failure and never repeats the same conditional payload', () => {
    const stored = new Map([['ubi-sim-autosave', 'previous successful snapshot']]);
    let attempts = 0;
    const storage = {
      setItem: (_key: string, _value: string) => { attempts++; throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }); },
      removeItem: (key: string) => { stored.delete(key); },
    };
    const full = { model: DEFAULT_MODEL } as SavedState;
    const result = writeRecoverySnapshot(storage, full);
    expect(result.saved).toBe(false);
    expect(attempts).toBe(1);
    expect(stored.get('ubi-sim-autosave')).toBe('previous successful snapshot');
    const legacy = writeRecoverySnapshot(storage, full, () => ({ ...full, history: [] }));
    expect(legacy.saved).toBe(false);
    expect(attempts).toBe(3);
    expect(stored.get('ubi-sim-autosave')).toBe('previous successful snapshot');
  });
});

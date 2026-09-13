import { describe, it, expect } from 'vitest';
import { anchoredWellbeingTarget, wellbeingAnchor } from './pure';
import { initialRun, advanceRun, latestLadderIndex, initOptionsFor } from './run';
import { PRESET_MODELS, DEFAULT_MACRO } from '../constants';
import type { CountryStats, MacroParameters } from '../types';

const anchoredModel = PRESET_MODELS.find((m) => m.id === 'evidence-anchored')!;
const legacyModel = PRESET_MODELS[0];

const country = (over: Partial<CountryStats> = {}): CountryStats =>
  ({
    id: 'X', name: 'X', population: 10, gdpPerCapita: 24000, governance: 0.7, gini: 0.35,
    aiAdoption: 0.2, wellbeing: 60, companiesJoined: 0, laborShare: 0.6,
    unemployment: 0.05, naturalUnemployment: 0.05, ...over,
  }) as CountryStats;

const macro: MacroParameters = { ...DEFAULT_MACRO, wellbeingAnchorRate: 0.02, wellbeingMode: 'anchored', ubiEffectPerDoubling: 4, unemploymentEffectPerPoint: 0.45 };

describe('stage 4 anchored wellbeing mode', () => {
  it('the preset exists and asks for ladder-based initial wellbeing; legacy presets do not', () => {
    expect(anchoredModel.macro?.wellbeingMode).toBe('anchored');
    expect(initOptionsFor(anchoredModel).initialWellbeing).toBe('ladder');
    expect(initOptionsFor(legacyModel).initialWellbeing).toBe('formula');
    expect(initOptionsFor(undefined).initialWellbeing).toBe('formula');
  });

  it('ladder initialisation puts the US near its observed ladder, not the formula value', () => {
    const ladder = initialRun(undefined, undefined, { initialWellbeing: 'ladder' }).state.countryData['USA'].wellbeing;
    const formula = initialRun().state.countryData['USA'].wellbeing;
    expect(formula).toBeCloseTo(92.5, 6);
    expect(ladder).toBeGreaterThan(60);
    expect(ladder).toBeLessThan(80);
    expect(latestLadderIndex('USA')).toBe(ladder);
    expect(latestLadderIndex('ZZZ')).toBeUndefined();
  });

  it('with no transfer and no excess unemployment the target is the income/governance anchor', () => {
    const c = country();
    const t = anchoredWellbeingTarget(c, macro, 0);
    expect(t.ubiEffect).toBe(0);
    expect(t.unemploymentEffect).toBe(0);
    expect(t.target).toBeCloseTo(wellbeingAnchor(24000, 0.7), 9);
  });

  it('a transfer raises the target monotonically with diminishing returns (log in transfer/income)', () => {
    const c = country(); // monthly labour income 2000
    const t1 = anchoredWellbeingTarget(c, macro, 200).ubiEffect;   // 10% of monthly income
    const t2 = anchoredWellbeingTarget(c, macro, 2000).ubiEffect;  // a doubling
    const t3 = anchoredWellbeingTarget(c, macro, 20000).ubiEffect; // 10x income
    expect(t1).toBeGreaterThan(0);
    expect(t2).toBeGreaterThan(t1);
    expect(t3).toBeGreaterThan(t2);
    expect(t3).toBeLessThan(10 * t2); // concave
    // A doubling of income is worth exactly ubiEffectPerDoubling x ln 2.
    expect(t2).toBeCloseTo(4 * Math.log(2), 9);
    // 10% of income: about 0.38 index points (0.04 ladder), the evidence note's rule of thumb.
    expect(t1).toBeCloseTo(4 * Math.log(1.1), 9);
  });

  it('excess unemployment and a falling labour share lower the target', () => {
    const base = anchoredWellbeingTarget(country(), macro, 0).target;
    const unemployed = anchoredWellbeingTarget(country({ unemployment: 0.10 }), macro, 0);
    expect(unemployed.unemploymentEffect).toBeCloseTo(0.45 * 5, 9);
    expect(unemployed.target).toBeLessThan(base);
    const lowShare = anchoredWellbeingTarget(country({ laborShare: 0.45 }), macro, 0).target;
    expect(lowShare).toBeLessThan(base);
  });

  it('wellbeing relaxes toward the target at the anchor rate and stays bounded over a long run', () => {
    let run = initialRun(undefined, undefined, initOptionsFor(anchoredModel));
    const w0 = run.state.countryData['USA'].wellbeing;
    for (let m = 0; m < 120; m++) run = advanceRun(run, { model: anchoredModel });
    for (const c of Object.values(run.state.countryData)) {
      expect(c.wellbeing).toBeGreaterThanOrEqual(1);
      expect(c.wellbeing).toBeLessThanOrEqual(100);
    }
    // A decade under the candidate does not send the US to the floor the legacy default reaches.
    expect(run.state.countryData['USA'].wellbeing).toBeGreaterThan(40);
    expect(Math.abs(run.state.countryData['USA'].wellbeing - w0)).toBeLessThan(30);
  });

  it('legacy presets are untouched by the anchored code path', () => {
    let a = initialRun();
    for (let m = 0; m < 6; m++) a = advanceRun(a, { model: legacyModel });
    expect(a.state.countryData['USA'].displacementGap).toBeGreaterThan(0);
    // The regression pin in pure.test.ts covers exact values; here only that the mode flag is absent.
    expect(legacyModel.macro).toBeUndefined();
  });
});

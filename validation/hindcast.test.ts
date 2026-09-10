/**
 * Unit tests for the hindcast harness.
 *
 * Uses a tiny inline fixture (3 countries x 3 years) so nothing here touches the network
 * or data/hindcast/*.json - those are only read by scripts/hindcast/run-hindcast.ts.
 */

import { describe, it, expect } from 'vitest';
import type { Corporation, CountryStats } from '../types';
import {
  buildInitialStateFromActuals,
  runHindcast,
  scoreHindcast,
  pearson,
  ladderToWellbeingIndex,
  wellbeingIndexToLadder,
  defaultHindcastParams,
  LADDER_TO_INDEX_SCALE,
  HindcastActuals,
  HindcastCountryBase,
  HindcastCountryResult
} from './hindcast';
import {
  runHc1,
  runHc2,
  runHindcastTests,
  HC1_CORR_THRESHOLD,
  HC2_MAE_THRESHOLD,
  HC2_MAE_LADDER_THRESHOLD
} from './hindcastTests';

// ---------------------------------------------------------------------------
// Fixture: 3 countries x 3 years (2020, 2021, 2022)
// ---------------------------------------------------------------------------

function country(
  id: string,
  name: string,
  population: number,
  gdpPerCapita: number,
  governance: number,
  gini: number
): HindcastCountryBase {
  return {
    id,
    name,
    population,
    gdpPerCapita,
    governance,
    gini,
    socialResilience: governance,
    corruption: 1 - governance,
    archetype: 'middle-stable',
    participatesInGlobalUBI: true,
    headquarteredCorps: [],
    customerOfCorps: [],
    ubiReceivedGlobal: 0,
    ubiReceivedLocal: 0,
    ubiReceivedCustomerWeighted: 0,
    totalUbiReceived: 0,
    nationalPolicy: { allowsDirectWallet: true, localTaxOnUbi: 0, corporateIncentives: 0 },
    wellbeingTrend: []
  };
}

const COUNTRIES: HindcastCountryBase[] = [
  country('AAA', 'Alphaland', 100, 40000, 0.85, 0.30),
  country('BBB', 'Betastan', 50, 12000, 0.55, 0.45),
  country('CCC', 'Gammaria', 10, 2000, 0.30, 0.55)
];

/** A country the actuals know nothing about, to exercise the drop path. */
const UNCOVERED = country('ZZZ', 'Nowhereland', 5, 5000, 0.5, 0.4);

const ACTUALS: HindcastActuals = {
  wellbeingLadder: {
    AAA: { '2020': 7.0, '2021': 7.2, '2022': 7.4 },
    BBB: { '2020': 5.0, '2021': 5.1, '2022': 5.6 },
    CCC: { '2020': 3.0, '2021': 3.1, '2022': 2.8 }
  },
  gdpPerCapita: {
    AAA: { '2020': 40000, '2021': 41000, '2022': 42000 },
    BBB: { '2020': 12000, '2021': 12600, '2022': 13200 },
    CCC: { '2020': 2000, '2021': 2100, '2022': 2000 }
  }
};

const CORPS: Corporation[] = [
  {
    id: 'acme',
    name: 'Acme AI',
    headquartersCountry: 'AAA',
    operatingCountries: ['AAA', 'BBB', 'CCC'],
    aiRevenue: 10,
    aiAdoptionLevel: 0.5,
    marketCap: 1000,
    contributionRate: 0.2,
    distributionStrategy: 'global',
    policyStance: 'moderate',
    reputationScore: 70
  }
];

const runOpts = { actuals: ACTUALS, fromYear: 2020, toYear: 2022, countries: COUNTRIES, corporations: CORPS };

// ---------------------------------------------------------------------------

describe('ladder scaling', () => {
  it('maps the 0-10 ladder onto the 0-100 wellbeing index', () => {
    expect(LADDER_TO_INDEX_SCALE).toBe(10);
    expect(ladderToWellbeingIndex(6.5)).toBeCloseTo(65, 10);
    expect(wellbeingIndexToLadder(65)).toBeCloseTo(6.5, 10);
  });
});

describe('buildInitialStateFromActuals', () => {
  it('seeds gdp and wellbeing from actuals, keeps structural fields, zeroes AI adoption', () => {
    const { state, included, dropped } = buildInitialStateFromActuals(2020, ACTUALS, COUNTRIES);

    expect(included).toEqual(['AAA', 'BBB', 'CCC']);
    expect(dropped).toEqual([]);

    const aaa = state.countryData.AAA;
    expect(aaa.gdpPerCapita).toBe(40000);
    expect(aaa.wellbeing).toBeCloseTo(70, 10);
    expect(aaa.aiAdoption).toBe(0);
    expect(aaa.governance).toBe(0.85); // from constants, not the actuals
    expect(aaa.population).toBe(100);
    expect(aaa.wellbeingTrend).toEqual([70]);

    // GDP that differs from the constants.ts value is actually overridden
    const ccc = state.countryData.CCC;
    expect(ccc.gdpPerCapita).toBe(2000);
    expect(ccc.wellbeing).toBeCloseTo(30, 10);

    expect(state.month).toBe(0);
    expect(state.averageWellbeing).toBeCloseTo((70 + 50 + 30) / 3, 10);
    // The shadow record must exist for every country or the engine dereferences undefined
    expect(Object.keys(state.shadowCountryData).sort()).toEqual(['AAA', 'BBB', 'CCC']);
    expect(state.shadowCountryData.AAA).not.toBe(state.countryData.AAA);
  });

  it('drops countries with no observation instead of imputing one', () => {
    const { included, dropped } = buildInitialStateFromActuals(2020, ACTUALS, [...COUNTRIES, UNCOVERED]);
    expect(included).not.toContain('ZZZ');
    expect(dropped).toHaveLength(1);
    expect(dropped[0].id).toBe('ZZZ');
    expect(dropped[0].reason).toContain('ladder 2020');
    expect(dropped[0].reason).toContain('gdpPerCapita 2020');
  });

  it('drops a country missing only one of the two series', () => {
    const partial: HindcastActuals = {
      wellbeingLadder: ACTUALS.wellbeingLadder,
      gdpPerCapita: { AAA: ACTUALS.gdpPerCapita.AAA, BBB: ACTUALS.gdpPerCapita.BBB }
    };
    const { included, dropped } = buildInitialStateFromActuals(2020, partial, COUNTRIES);
    expect(included).toEqual(['AAA', 'BBB']);
    expect(dropped.map(d => d.id)).toEqual(['CCC']);
    expect(dropped[0].reason).toBe('no gdpPerCapita 2020');
  });
});

describe('runHindcast', () => {
  it('runs 12 monthly steps per year and records one snapshot per year', () => {
    const run = runHindcast({ ...runOpts, aiOff: true });

    expect(run.monthsRun).toBe(24); // 2020 -> 2022, anchored at the start of each year
    expect(run.years).toEqual([2020, 2021, 2022]);
    expect(run.score.nCountries).toBe(3);
    for (const c of run.countries) {
      expect(c.predictedWellbeingSeries).toHaveLength(3);
      expect(c.actualWellbeingSeries).toHaveLength(3);
      expect(c.predictedGdpSeries).toHaveLength(3);
    }
  });

  it('starts predictions exactly on the actuals, so start error is zero by construction', () => {
    const run = runHindcast({ ...runOpts, aiOff: true });
    for (const c of run.countries) {
      expect(c.predictedWellbeingStart).toBeCloseTo(c.actualWellbeingStart, 10);
      expect(c.predictedGdpStart).toBeCloseTo(c.actualGdpStart, 10);
    }
  });

  it('aiOff pins AI adoption at zero and zeroes corporate contributions', () => {
    const run = runHindcast({ ...runOpts, aiOff: true });
    expect(run.params.aiGrowthRate).toBe(0);
    expect(run.corpContributionRate).toBe(0);
    expect(run.diagnostics.meanPredictedAiAdoptionEnd).toBe(0);
    for (const c of run.countries) expect(c.predictedAiAdoptionEnd).toBe(0);
  });

  it('corpContributionRate: null keeps the configured rates even with aiOff', () => {
    const run = runHindcast({ ...runOpts, aiOff: true, corpContributionRate: null });
    expect(run.corpContributionRate).toBeNull();
    expect(run.params.aiGrowthRate).toBe(0);
  });

  it('aiOn lets adoption grow away from zero', () => {
    const run = runHindcast({ ...runOpts, aiOff: false });
    expect(run.params.aiGrowthRate).toBe(defaultHindcastParams().aiGrowthRate);
    expect(run.diagnostics.meanPredictedAiAdoptionEnd).toBeGreaterThan(0);
  });

  it('reports that the engine never moves gdpPerCapita (simulation/pure.ts has no GDP dynamics)', () => {
    const run = runHindcast({ ...runOpts, aiOff: false });
    expect(run.diagnostics.gdpIsStatic).toBe(true);
    for (const c of run.countries) {
      expect(c.predictedGdpEnd).toBe(c.predictedGdpStart);
      expect(c.predictedGdpGrowthPct).toBeCloseTo(0, 10);
    }
    // ...so the GDP correlation is undefined (zero variance) and reported as 0
    expect(run.score.corrGdpGrowth).toBe(0);
    // AAA +5%, BBB +10%, CCC 0% -> mean |error| = 5
    expect(run.score.maeGdpGrowthPct).toBeCloseTo(5, 6);
  });

  it('drops countries that lack an end-year observation from scoring only', () => {
    const truncated: HindcastActuals = {
      wellbeingLadder: {
        ...ACTUALS.wellbeingLadder,
        CCC: { '2020': 3.0, '2021': 3.1 } // no 2022
      },
      gdpPerCapita: ACTUALS.gdpPerCapita
    };
    const run = runHindcast({ ...runOpts, actuals: truncated, aiOff: true });
    expect(run.score.nCountries).toBe(2);
    expect(run.droppedAtEnd.map(d => d.id)).toEqual(['CCC']);
    expect(run.dropped).toEqual([]);
  });

  it('rejects a backwards span', () => {
    expect(() => runHindcast({ ...runOpts, fromYear: 2022, toYear: 2020, aiOff: true })).toThrow(/must be after/);
  });

  it('does not mutate the caller\'s corporations or country definitions', () => {
    const corpsBefore = JSON.stringify(CORPS);
    const countriesBefore = JSON.stringify(COUNTRIES);
    runHindcast({ ...runOpts, aiOff: false });
    expect(JSON.stringify(CORPS)).toBe(corpsBefore);
    expect(JSON.stringify(COUNTRIES)).toBe(countriesBefore);
  });
});

describe('pearson / scoreHindcast', () => {
  it('returns 1 for a perfectly correlated pair and -1 for an anti-correlated one', () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10);
    expect(pearson([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1, 10);
  });

  it('returns 0 rather than NaN when a side has no variance', () => {
    expect(pearson([1, 1, 1], [1, 2, 3])).toBe(0);
    expect(pearson([1], [1])).toBe(0);
    expect(pearson([], [])).toBe(0);
  });

  it('scores a hand-built result set', () => {
    const mk = (
      id: string,
      predEnd: number,
      actEnd: number,
      predGrowth: number,
      actGrowth: number
    ): HindcastCountryResult => ({
      id,
      name: id,
      actualWellbeingStart: 50,
      actualWellbeingEnd: actEnd,
      actualWellbeingChange: actEnd - 50,
      predictedWellbeingStart: 50,
      predictedWellbeingEnd: predEnd,
      predictedWellbeingChange: predEnd - 50,
      wellbeingError: predEnd - actEnd,
      actualGdpStart: 100,
      actualGdpEnd: 100 * (1 + actGrowth / 100),
      actualGdpGrowthPct: actGrowth,
      predictedGdpStart: 100,
      predictedGdpEnd: 100 * (1 + predGrowth / 100),
      predictedGdpGrowthPct: predGrowth,
      gdpGrowthErrorPct: predGrowth - actGrowth,
      predictedWellbeingSeries: [50, predEnd],
      actualWellbeingSeries: [50, actEnd],
      predictedGdpSeries: [100, 100],
      actualGdpSeries: [100, 100],
      predictedAiAdoptionEnd: 0
    });

    const score = scoreHindcast([
      mk('A', 52, 54, 2, 4),
      mk('B', 54, 58, 4, 8),
      mk('C', 56, 62, 6, 12)
    ]);

    expect(score.nCountries).toBe(3);
    expect(score.corrWellbeingChange).toBeCloseTo(1, 10); // predicted change ranks perfectly
    expect(score.maeWellbeing).toBeCloseTo((2 + 4 + 6) / 3, 10);
    expect(score.corrGdpGrowth).toBeCloseTo(1, 10);
    expect(score.maeGdpGrowthPct).toBeCloseTo((2 + 4 + 6) / 3, 10);
  });

  it('handles an empty result set without NaN', () => {
    const score = scoreHindcast([]);
    expect(score).toEqual({
      corrWellbeingChange: 0,
      maeWellbeing: 0,
      corrGdpGrowth: 0,
      maeGdpGrowthPct: 0,
      nCountries: 0
    });
  });
});

describe('HC-1 / HC-2 anchor tests', () => {
  it('exposes the design-doc thresholds as constants', () => {
    expect(HC1_CORR_THRESHOLD).toBe(0.5);
    expect(HC2_MAE_LADDER_THRESHOLD).toBe(0.6);
    expect(HC2_MAE_THRESHOLD).toBe(6); // 0.6 ladder points on the 0-100 index
  });

  it('returns AnchorTestResult-shaped objects', () => {
    const run = runHindcast({ ...runOpts, aiOff: true });
    const results = runHindcastTests({ actuals: ACTUALS, fromYear: 2020, toYear: 2022, run });

    expect(results.map(r => r.testId)).toEqual(['HC-1', 'HC-2']);
    for (const r of results) {
      expect(r.category).toBe('consistency');
      expect(typeof r.passed).toBe('boolean');
      expect(typeof r.reason).toBe('string');
      expect(r.details?.expected).toBeTruthy();
      expect(r.details?.actual).toBeTruthy();
      expect(r.details?.metrics?.nCountries).toBe(3);
    }
  });

  it('HC-1 passes when the run tracks the actuals and fails when it does not', () => {
    const run = runHindcast({ ...runOpts, aiOff: true });

    // The AI-off engine holds wellbeing still, so the correlation is degenerate -> 0 -> fail.
    const real = runHc1({ actuals: ACTUALS, fromYear: 2020, toYear: 2022, run });
    expect(real.passed).toBe(false);

    // Inject a run whose predictions track the actuals to prove the pass path works.
    const perfect = {
      ...run,
      score: { ...run.score, corrWellbeingChange: 0.9 }
    };
    expect(runHc1({ actuals: ACTUALS, fromYear: 2020, toYear: 2022, run: perfect }).passed).toBe(true);
  });

  it('HC-2 flags a pass that merely ties the "nothing changes" null model', () => {
    const run = runHindcast({ ...runOpts, aiOff: true });
    const hc2 = runHc2({ actuals: ACTUALS, fromYear: 2020, toYear: 2022, run });
    expect(hc2.passed).toBe(true); // 2 years of drift is small in ladder points
    expect(hc2.reason).toContain('null model');
  });

  it('HC-2 fails when the error exceeds the ladder budget', () => {
    const run = runHindcast({ ...runOpts, aiOff: true });
    const bad = { ...run, score: { ...run.score, maeWellbeing: HC2_MAE_THRESHOLD + 1 } };
    const hc2 = runHc2({ actuals: ACTUALS, fromYear: 2020, toYear: 2022, run: bad });
    expect(hc2.passed).toBe(false);
    expect(hc2.reason).toContain('exceeds');
  });

  it('runs the engine itself when no precomputed run is supplied', () => {
    const results = runHindcastTests({
      actuals: ACTUALS,
      fromYear: 2020,
      toYear: 2022,
      overrides: { countries: COUNTRIES, corporations: CORPS }
    });
    expect(results).toHaveLength(2);
    expect(results[0].details?.metrics?.monthsRun).toBe(24);
  });
});

describe('CountryStats compatibility', () => {
  it('produces states the engine can consume without casts', () => {
    const { state } = buildInitialStateFromActuals(2020, ACTUALS, COUNTRIES);
    const c: CountryStats = state.countryData.AAA;
    expect(c.id).toBe('AAA');
  });
});

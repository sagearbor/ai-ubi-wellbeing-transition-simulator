import { describe, it, expect } from 'vitest';
import { adoptionPath, runKorinekScenario } from './korinek';
import { runKorinekSuite, KJ_TOLERANCE } from './korinekTests';
import { KORINEK_SCENARIOS } from '../constants';
import { applyMacroDynamics, wellbeingAnchor, BASE_LABOR_SHARE } from '../simulation/pure';
import type { CountryStats } from '../types';

describe('adoptionPath', () => {
  it('starts at start, ends at target, and is monotone', () => {
    const months = 54;
    let prev = -1;
    for (let t = 0; t <= months; t++) {
      const v = adoptionPath(0.01, 0.45, months, t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(adoptionPath(0.01, 0.45, months, 0)).toBeCloseTo(0.01, 9);
    expect(adoptionPath(0.01, 0.45, months, months)).toBeCloseTo(0.45, 9);
  });
});

describe('macro block', () => {
  const country = (over: Partial<CountryStats> = {}): CountryStats => ({
    id: 'X', name: 'X', population: 10, aiAdoption: 0, gdpPerCapita: 50000, wellbeing: 60, companiesJoined: 0,
    socialResilience: 0.8, gini: 0.35, governance: 0.8, corruption: 0.2, archetype: 'rich-democracy',
    participatesInGlobalUBI: true, headquarteredCorps: [], customerOfCorps: [], ubiReceivedGlobal: 0,
    ubiReceivedLocal: 0, ubiReceivedCustomerWeighted: 0, totalUbiReceived: 0,
    nationalPolicy: { allowsDirectWallet: true, localTaxOnUbi: 0, corporateIncentives: 0 }, wellbeingTrend: [60],
    ...over,
  });
  const macro = { baselineGrowth: 0.02, productivityGain: 1.13, automationShare: 0.9, reemploymentMonths: 18, laborShareSensitivity: 0.88, wellbeingAnchorRate: 0 };

  it('with zero adoption the no-AI path grows at baselineGrowth and nothing else moves', () => {
    const c = country();
    for (let m = 0; m < 12; m++) applyMacroDynamics(c, macro);
    expect(c.gdpPerCapita / 50000).toBeCloseTo(1.02, 6);
    expect(c.laborShare).toBeCloseTo(BASE_LABOR_SHARE, 9);
    expect(c.unemployment).toBeCloseTo(0.039, 9);
    expect(c.wellbeing).toBe(60);
  });

  it('a jump in adoption raises GDP, lowers the labour share and creates a displaced pool that decays', () => {
    const c = country();
    applyMacroDynamics(c, macro);
    c.aiAdoption = 0.45;
    applyMacroDynamics(c, macro);
    const affected = 0.45 * 0.62;
    expect(c.gdpPerCapita / c.gdpNoAi!).toBeCloseTo(1 + 1.13 * affected, 6);
    expect(c.laborShare).toBeCloseTo(0.6 * (1 - 0.88 * affected), 6);
    const poolAfterJump = c.displacedPool!;
    expect(poolAfterJump).toBeCloseTo(0.45 * 0.62 * 0.9, 6);
    applyMacroDynamics(c, macro);
    expect(c.displacedPool!).toBeCloseTo(poolAfterJump * (1 - 1 / 18), 6);
    expect(c.cognitiveUnemployment!).toBeGreaterThan(c.unemployment!);
  });

  it('wellbeing relaxes toward the anchor only when wellbeingAnchorRate > 0', () => {
    const c = country({ wellbeing: 30 });
    applyMacroDynamics(c, { ...macro, wellbeingAnchorRate: 0.5 });
    // The anchor is evaluated on that month's (post-growth) GDP.
    const anchor = wellbeingAnchor(c.gdpPerCapita, c.governance);
    expect(c.wellbeing).toBeCloseTo(30 + (anchor - 30) * 0.5, 6);
  });

  it('anchor is monotone in GDP and governance and bounded', () => {
    expect(wellbeingAnchor(60000, 0.8)).toBeGreaterThan(wellbeingAnchor(2000, 0.8));
    expect(wellbeingAnchor(20000, 0.9)).toBeGreaterThan(wellbeingAnchor(20000, 0.3));
    expect(wellbeingAnchor(1, 0)).toBeGreaterThanOrEqual(15);
    expect(wellbeingAnchor(1e9, 1)).toBeLessThanOrEqual(90);
  });
});

describe('Korinek et al. (2026) reproduction', () => {
  it('reproduces all three US 2030 scenarios within tolerance', () => {
    const suite = runKorinekSuite();
    for (const r of suite.results) expect(r.passed, r.reason).toBe(true);
    expect(suite.passed).toBe(3);
  });

  it('extreme scenario: growth well above modest, labour share falls, unemployment rises', () => {
    const [modest, , extreme] = KORINEK_SCENARIOS.map((s) => runKorinekScenario(s));
    expect(extreme.growthPctPerYear).toBeGreaterThan(modest.growthPctPerYear + 3);
    expect(extreme.laborSharePct).toBeLessThan(modest.laborSharePct - 10);
    expect(extreme.unemploymentPct).toBeGreaterThan(modest.unemploymentPct + 5);
    expect(Math.abs(modest.gdpBoostPct - modest.targets.gdpBoostPct)).toBeLessThanOrEqual(KJ_TOLERANCE.gdpBoostPct);
  });
});

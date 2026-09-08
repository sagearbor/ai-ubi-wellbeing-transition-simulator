/**
 * Basic smoke tests for the pure simulation engine.
 * These tests verify that the extraction was successful and the function is callable.
 */

import { describe, it, expect } from 'vitest';
import { stepSimulationPure } from './pure';
import type { SimulationState, Corporation, ModelParameters } from '../types';
import { INITIAL_COUNTRIES, DEFAULT_EQUATIONS } from '../constants';
import { getCompiledEquationSet } from '../src/services/equationParser';

// Helper to create a minimal test state
function createTestState(): SimulationState {
  const countryData: any = {};
  
  // Create a minimal country dataset
  INITIAL_COUNTRIES.slice(0, 5).forEach(country => {
    countryData[country.id] = {
      ...country,
      // INITIAL_COUNTRIES carries no aiAdoption; App.tsx's getInitialState() seeds it at
      // 0.01. Leaving this unset previously made it `undefined`, so every arithmetic
      // expression touching it (adoption deltas, displacement friction, ...) silently
      // produced NaN - tests that didn't inspect those values never noticed.
      aiAdoption: 0.01,
      // INITIAL_COUNTRIES carries no wellbeing; App.tsx derives it from GDP per capita
      wellbeing: Math.min(100, Math.max(10, country.gdpPerCapita / 1200 + 40)),
      wellbeingTrend: [50]
    };
  });

  return {
    month: 0,
    globalFund: 0,
    averageWellbeing: 50,
    totalAiCompanies: 0,
    countryData,
    shadowCountryData: JSON.parse(JSON.stringify(countryData)),
    globalDisplacementGap: 0,
    corruptionLeakage: 0,
    countriesInCrisis: 0
  };
}

function createTestCorporation(): Corporation {
  return {
    id: 'test-corp',
    name: 'Test Corp',
    headquartersCountry: 'USA',
    operatingCountries: ['USA', 'CAN', 'MEX'],
    aiRevenue: 0,
    aiAdoptionLevel: 0.5,
    marketCap: 100,
    contributionRate: 0.15,
    distributionStrategy: 'global',
    policyStance: 'moderate',
    reputationScore: 50
  };
}

function createTestModel(): ModelParameters {
  return {
    id: 'test',
    name: 'Test Model',
    description: 'Test',
    corporateTaxRate: 0.21,
    adoptionIncentive: 0.05,
    baseUBI: 500,
    aiGrowthRate: 0.08,
    volatility: 0.05,
    gdpScaling: 0.5,
    globalRedistributionRate: 1.0,
    displacementRate: 0.75,
    directToWalletEnabled: true,
    defaultCorpPolicy: 'free-market',
    marketPressure: 0.8
  };
}

describe('stepSimulationPure', () => {
  it('should execute without errors', () => {
    const state = createTestState();
    const corporations = [createTestCorporation()];
    const model = createTestModel();

    const result = stepSimulationPure({ state, corporations, model });

    expect(result).toBeDefined();
    expect(result.state).toBeDefined();
    expect(result.corporations).toBeDefined();
    expect(result.ledger).toBeDefined();
    expect(result.gameTheory).toBeDefined();
  });

  it('should advance the month', () => {
    const state = createTestState();
    const corporations = [createTestCorporation()];
    const model = createTestModel();

    const result = stepSimulationPure({ state, corporations, model });

    expect(result.state.month).toBe(1);
  });

  it('should be deterministic', () => {
    // stepSimulationPure shallow-copies state.countryData but mutates the nested
    // per-country objects in place (see the pure_mutation_gotcha finding in the repo's
    // tmp/wrapups/ notes), so the two calls below must each get their own fresh state/
    // corporations - reusing the same instances would let the first call's in-place
    // mutations leak into the second call's input, which is not what "deterministic"
    // is meant to test here.
    const corporations1 = [createTestCorporation()];
    const corporations2 = [createTestCorporation()];
    const model = createTestModel();

    const result1 = stepSimulationPure({ state: createTestState(), corporations: corporations1, model });
    const result2 = stepSimulationPure({ state: createTestState(), corporations: corporations2, model });

    expect(result1.state.month).toBe(result2.state.month);
    expect(result1.state.averageWellbeing).toBe(result2.state.averageWellbeing);
  });

  it('should update corporation state', () => {
    const state = createTestState();
    const corporations = [createTestCorporation()];
    const model = createTestModel();

    const result = stepSimulationPure({ state, corporations, model });

    expect(result.corporations[0].aiRevenue).toBeGreaterThanOrEqual(0);
    expect(result.corporations[0].customerBaseWellbeing).toBeDefined();
  });

  it('should create a global ledger', () => {
    const state = createTestState();
    const corporations = [createTestCorporation()];
    const model = createTestModel();

    const result = stepSimulationPure({ state, corporations, model });

    expect(result.ledger.totalFunds).toBeGreaterThanOrEqual(0);
    expect(result.ledger.corruptionLeakage).toBe(0);
  });

  it('should conserve money: ledger inflow equals UBI paid out (AT-6 invariant)', () => {
    const state = createTestState();
    const corporations = [
      { ...createTestCorporation(), id: 'global-corp', distributionStrategy: 'global' as const },
      { ...createTestCorporation(), id: 'cw-corp', distributionStrategy: 'customer-weighted' as const },
      { ...createTestCorporation(), id: 'hq-corp', distributionStrategy: 'hq-local' as const }
    ];
    const model = createTestModel();

    const result = stepSimulationPure({ state, corporations, model });

    const contributions = Object.values(result.ledger.contributorBreakdown).reduce((a, b) => a + b, 0);
    expect(contributions).toBeGreaterThan(0);
    expect(result.ledger.monthlyInflow).toBeCloseTo(contributions, 6);
    // The global pool is split per capita over INITIAL_COUNTRIES; this state only holds the
    // first 5, so only that share of the global pool is observable here.
    const worldPop = INITIAL_COUNTRIES.reduce((a, c) => a + c.population, 0);
    const localPop = INITIAL_COUNTRIES.slice(0, 5).reduce((a, c) => a + c.population, 0);
    const globalContribution = result.ledger.contributorBreakdown['global-corp'];
    const expectedOutflow = contributions - globalContribution + globalContribution * (localPop / worldPop);
    expect(result.ledger.monthlyOutflow).toBeCloseTo(expectedOutflow, 6);
  });

  it('should analyze game theory', () => {
    const state = createTestState();
    const corporations = [
      createTestCorporation(),
      { ...createTestCorporation(), id: 'test-corp-2' }
    ];
    const model = createTestModel();

    const result = stepSimulationPure({ state, corporations, model });

    expect(result.gameTheory.avgContributionRate).toBeGreaterThan(0);
    expect(result.gameTheory.cooperationCount).toBeGreaterThanOrEqual(0);
    expect(result.gameTheory.defectionCount).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// P8-T9: CUSTOM MODEL EXECUTION
// ============================================================================
// Uploaded/edited models (types.ts::ModelConfig) are compiled by
// src/services/equationParser.ts::getCompiledEquationSet into a CompiledEquationSet,
// which SimulationInput.equations now accepts. These tests cover:
//   1. The no-equations path is untouched (regression / bit-for-bit identical).
//   2. Compiling and running the DEFAULT_EQUATIONS reproduces the hardcoded engine
//      (a "golden" cross-check that the default equation set is a faithful port).
//   3. A custom equation actually changes the simulated trajectory.
// ============================================================================
describe('stepSimulationPure - P8-T9 custom equations', () => {
  // createTestState() above never initializes `aiAdoption`, which is fine for the
  // pre-existing smoke tests (they don't inspect wellbeing/adoption magnitudes) but
  // produces NaN for any test that actually compares numeric trajectories, since
  // `undefined + delta` is NaN. This local helper is a corrected copy used only by
  // the tests below; it intentionally does not touch the shared createTestState()
  // to avoid changing behavior for the pre-existing tests above.
  function createEquationTestState(): SimulationState {
    const countryData: any = {};
    INITIAL_COUNTRIES.slice(0, 5).forEach(country => {
      countryData[country.id] = {
        ...country,
        aiAdoption: 0.1,
        wellbeing: Math.min(100, Math.max(10, country.gdpPerCapita / 1200 + 40)),
        wellbeingTrend: [50]
      };
    });

    return {
      month: 0,
      globalFund: 0,
      averageWellbeing: 50,
      totalAiCompanies: 0,
      countryData,
      shadowCountryData: JSON.parse(JSON.stringify(countryData)),
      globalDisplacementGap: 0,
      corruptionLeakage: 0,
      countriesInCrisis: 0
    };
  }

  function createEquationTestCorporation(): Corporation {
    return {
      id: 'test-corp',
      name: 'Test Corp',
      headquartersCountry: 'USA',
      operatingCountries: ['USA', 'CAN', 'MEX'],
      aiRevenue: 0,
      aiAdoptionLevel: 0.5,
      marketCap: 100,
      contributionRate: 0.15,
      distributionStrategy: 'global',
      policyStance: 'moderate',
      reputationScore: 50
    };
  }

  function createEquationTestModel(): ModelParameters {
    return {
      id: 'test',
      name: 'Test Model',
      description: 'Test',
      corporateTaxRate: 0.21,
      adoptionIncentive: 0.05,
      baseUBI: 500,
      aiGrowthRate: 0.08,
      volatility: 0.05,
      gdpScaling: 0.5,
      globalRedistributionRate: 1.0,
      displacementRate: 0.75,
      directToWalletEnabled: true,
      defaultCorpPolicy: 'free-market',
      marketPressure: 0.8
    };
  }

  // stepSimulationPure shallow-copies state.countryData but mutates the nested
  // per-country objects in place, so two calls must never share the same state
  // instance if their outputs will be compared - each branch below gets its own
  // freshly-built state/corporations.
  function runMonths(months: number, equations?: ReturnType<typeof getCompiledEquationSet>) {
    let state = createEquationTestState();
    let corporations = [createEquationTestCorporation()];
    const model = createEquationTestModel();
    let ledger = null as ReturnType<typeof stepSimulationPure>['ledger'] | null;
    let gameTheory = null as ReturnType<typeof stepSimulationPure>['gameTheory'] | null;

    for (let i = 0; i < months; i++) {
      const output = stepSimulationPure({
        state,
        corporations,
        model,
        equations: equations ?? undefined
      });
      state = output.state;
      corporations = output.corporations;
      ledger = output.ledger;
      gameTheory = output.gameTheory;
    }

    return { state, corporations, ledger: ledger!, gameTheory: gameTheory! };
  }

  describe('regression: default model is unchanged when no equations are supplied', () => {
    it('an explicit `equations: undefined` produces output identical to omitting the field', () => {
      const stateA = createEquationTestState();
      const stateB = createEquationTestState();
      const corporationsA = [createEquationTestCorporation()];
      const corporationsB = [createEquationTestCorporation()];
      const model = createEquationTestModel();

      const withoutField = stepSimulationPure({ state: stateA, corporations: corporationsA, model });
      const withUndefined = stepSimulationPure({ state: stateB, corporations: corporationsB, model, equations: undefined });

      expect(withUndefined.state).toEqual(withoutField.state);
      expect(withUndefined.ledger).toEqual(withoutField.ledger);
      expect(withUndefined.gameTheory).toEqual(withoutField.gameTheory);
    });

    it('reproduces known-good hardcoded-engine values over 6 months (locks the default formulas)', () => {
      const { state } = runMonths(6);

      // These are the exact values produced by the hardcoded (no-equations) formulas in
      // simulation/pure.ts for the fixture above. If a future change to the hardcoded
      // Phase 1/2/4 formulas alters these, this test is expected to fail - update it only
      // as a deliberate, reviewed change to the default model, not as a side effect of P8-T9.
      expect(state.month).toBe(6);
      expect(state.averageWellbeing).toBeCloseTo(58.0217714682572, 9);
      expect(state.countryData['USA'].aiAdoption).toBeCloseTo(0.13463907428778998, 9);
      expect(state.globalFund).toBeCloseTo(1.1266875, 9);
    });
  });

  it('golden test: compiled DEFAULT_EQUATIONS reproduce the hardcoded engine bit-for-bit over 12 months', () => {
    const equations = getCompiledEquationSet(DEFAULT_EQUATIONS);
    expect(equations).not.toBeNull();

    const hardcoded = runMonths(12);
    const compiled = runMonths(12, equations!);

    expect(compiled.state.averageWellbeing).toBe(hardcoded.state.averageWellbeing);
    expect(compiled.state.countryData['USA'].aiAdoption).toBe(hardcoded.state.countryData['USA'].aiAdoption);
    expect(compiled.state.countryData['USA'].wellbeing).toBe(hardcoded.state.countryData['USA'].wellbeing);
    expect(compiled.state.globalFund).toBe(hardcoded.state.globalFund);
    expect(compiled.corporations[0].reputationScore).toBe(hardcoded.corporations[0].reputationScore);
  });

  describe('a custom equation changes the simulated output', () => {
    it('aiAdoptionGrowth: a faster custom growth curve increases AI adoption vs. the default', () => {
      const fast = getCompiledEquationSet({
        ...DEFAULT_EQUATIONS,
        aiAdoptionGrowth: '(1 - adoption) * 0.5' // deliberately much faster than the default
      });
      expect(fast).not.toBeNull();

      const hardcoded = runMonths(3);
      const custom = runMonths(3, fast!);

      expect(custom.state.countryData['USA'].aiAdoption).toBeGreaterThan(
        hardcoded.state.countryData['USA'].aiAdoption
      );
    });

    it('surplusGeneration: doubling contribution surplus doubles corporation monthly inflow', () => {
      const doubled = getCompiledEquationSet({
        ...DEFAULT_EQUATIONS,
        surplusGeneration: 'aiRevenue * contributionRate * 2'
      });
      expect(doubled).not.toBeNull();

      const hardcoded = runMonths(1);
      const custom = runMonths(1, doubled!);

      // aiRevenue itself is unaffected by surplusGeneration (that equation only governs
      // how much of it becomes a UBI contribution), so it should be identical...
      expect(custom.corporations[0].aiRevenue).toBeCloseTo(hardcoded.corporations[0].aiRevenue, 9);
      // ...while the contribution/ledger inflow it feeds should exactly double.
      expect(hardcoded.ledger.monthlyInflow).toBeGreaterThan(0);
      expect(custom.ledger.monthlyInflow).toBeCloseTo(hardcoded.ledger.monthlyInflow * 2, 9);
    });

    it('wellbeingDelta: a custom equation that always crashes wellbeing overrides the default trajectory', () => {
      const crushed = getCompiledEquationSet({
        ...DEFAULT_EQUATIONS,
        wellbeingDelta: '-50' // constant crash, ignoring ubiBoost/displacementFriction entirely
      });
      expect(crushed).not.toBeNull();

      const hardcoded = runMonths(1);
      const custom = runMonths(1, crushed!);

      expect(custom.state.countryData['USA'].wellbeing).toBeLessThan(
        hardcoded.state.countryData['USA'].wellbeing
      );
      // Starting wellbeing (92.5) - 50 = 42.5, well below the default trajectory.
      expect(custom.state.countryData['USA'].wellbeing).toBeCloseTo(42.5, 6);
    });

    it('displacementFriction: zeroing friction produces higher wellbeing than the default', () => {
      const noFriction = getCompiledEquationSet({
        ...DEFAULT_EQUATIONS,
        displacementFriction: '0'
      });
      expect(noFriction).not.toBeNull();

      const hardcoded = runMonths(3);
      const custom = runMonths(3, noFriction!);

      expect(custom.state.countryData['USA'].wellbeing).toBeGreaterThan(
        hardcoded.state.countryData['USA'].wellbeing
      );
    });

    it('ubiUtility: a much larger UBI-to-wellbeing multiplier produces higher wellbeing than the default', () => {
      const boosted = getCompiledEquationSet({
        ...DEFAULT_EQUATIONS,
        ubiUtility: '(ubi / utilityScale) * 12000' // 100x the default multiplier
      });
      expect(boosted).not.toBeNull();

      const hardcoded = runMonths(3);
      const custom = runMonths(3, boosted!);

      expect(custom.state.countryData['USA'].wellbeing).toBeGreaterThan(
        hardcoded.state.countryData['USA'].wellbeing
      );
    });
  });
});

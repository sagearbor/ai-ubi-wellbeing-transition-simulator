/**
 * Basic smoke tests for the pure simulation engine.
 * These tests verify that the extraction was successful and the function is callable.
 */

import { stepSimulationPure } from './pure';
import type { SimulationState, Corporation, ModelParameters } from '../types';
import { INITIAL_COUNTRIES } from '../constants';

// Helper to create a minimal test state
function createTestState(): SimulationState {
  const countryData: any = {};
  
  // Create a minimal country dataset
  INITIAL_COUNTRIES.slice(0, 5).forEach(country => {
    countryData[country.id] = {
      ...country,
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
    headquartersCountry: 'usa',
    operatingCountries: ['usa'],
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
    const state = createTestState();
    const corporations = [createTestCorporation()];
    const model = createTestModel();

    const result1 = stepSimulationPure({ state, corporations, model });
    const result2 = stepSimulationPure({ state, corporations, model });

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

/**
 * Anchor Test Definitions
 *
 * These tests verify causal invariants that MUST hold in any valid economic model.
 * They test DIRECTIONAL causality, not specific magnitudes.
 *
 * Philosophy: Test things that must logically be true, not ideological outcomes.
 */

import { AnchorTest, AnchorTestSetup, Corporation, SimulationState, ModelParameters } from '../types';
import { stepSimulationPure, SimulationInput, SimulationOutput } from '../simulation/pure';
import { INITIAL_COUNTRIES, INITIAL_CORPORATIONS } from '../constants';

/** Result of running a single anchor test */
export interface AnchorTestResult {
  testId: string;
  testName: string;
  category: 'causal' | 'equilibrium' | 'consistency';
  passed: boolean;
  reason: string;
  details?: {
    expected: string;
    actual: string;
    metrics?: Record<string, number>;
  };
}

/** Result of running all anchor tests */
export interface AnchorTestSuiteResult {
  passed: number;
  total: number;
  results: AnchorTestResult[];
  tier2Passed: boolean; // True if passed >= 4/6
}

/**
 * AT-1: Displacement Without UBI (Dystopia Test)
 * If AI displaces 50%+ of jobs with zero UBI, wellbeing MUST decline.
 */
const AT1_DYSTOPIA: AnchorTest = {
  id: 'AT-1',
  name: 'Displacement Without UBI (Dystopia Test)',
  category: 'causal',
  description: 'If AI displaces 50%+ of jobs with zero UBI, wellbeing MUST decline significantly.',
  simulationMonths: 36,
  setup: {
    displacementRate: 0.85,
    allCorpsContributionRate: 0,
    allCorpsPolicyStance: 'selfish'
  },
  assert: {
    type: 'wellbeingDelta',
    operator: '<',
    value: -5
  }
};

/**
 * AT-2: Generous UBI Prevents Collapse
 * With 40%+ contribution rates globally distributed, wellbeing should NOT collapse.
 */
const AT2_UBI_PREVENTS_COLLAPSE: AnchorTest = {
  id: 'AT-2',
  name: 'Generous UBI Prevents Collapse',
  category: 'causal',
  description: 'With 40%+ contribution rates globally distributed, wellbeing should maintain within 20% of initial.',
  simulationMonths: 60,
  setup: {
    displacementRate: 0.80,
    allCorpsContributionRate: 0.40,
    distributionStrategy: 'global',
    allCorpsPolicyStance: 'generous'
  },
  assert: {
    type: 'threshold',
    operator: '>=',
    value: 0.8  // Final wellbeing >= 80% of initial
  }
};

/**
 * AT-3: Prisoner's Dilemma Dynamics
 * When ALL corporations are selfish, system should detect race-to-bottom risk.
 */
const AT3_PRISONERS_DILEMMA: AnchorTest = {
  id: 'AT-3',
  name: "Prisoner's Dilemma Dynamics",
  category: 'equilibrium',
  description: 'When all corps are selfish with 5% contribution, race-to-bottom risk should exceed 0.6 at some point.',
  simulationMonths: 48,
  setup: {
    allCorpsPolicyStance: 'selfish',
    allCorpsContributionRate: 0.05
  },
  assert: {
    type: 'gameTheory',
    operator: '>',
    value: 0.6
  }
};

/**
 * AT-4: Demand Collapse Triggers Adaptation
 * When customer wellbeing drops, adaptive corporations should increase contributions.
 */
const AT4_DEMAND_TRIGGERS_ADAPTATION: AnchorTest = {
  id: 'AT-4',
  name: 'Demand Collapse Triggers Adaptation',
  category: 'causal',
  description: 'When wellbeing drops significantly, average contribution rate should increase.',
  simulationMonths: 48,
  setup: {
    allCorpsContributionRate: 0.10,
    allCorpsPolicyStance: 'moderate',
    marketPressure: 0.8
  },
  assert: {
    type: 'threshold',
    operator: '>',
    value: 0  // Final avg contribution > initial
  }
};

/**
 * AT-5: Global Distribution Helps Poor Countries
 * Global distribution should benefit poor countries more than HQ-local.
 */
const AT5_GLOBAL_HELPS_POOR: AnchorTest = {
  id: 'AT-5',
  name: 'Global Distribution Helps Poor Countries',
  category: 'equilibrium',
  description: 'Poor countries should have higher wellbeing under global vs HQ-local distribution.',
  simulationMonths: 60,
  setup: {
    compareStrategies: ['global', 'hq-local']
  },
  assert: {
    type: 'comparison',
    operator: '>',
    value: 0
  }
};

/**
 * AT-6: Money Conservation (Accounting Sanity)
 * Total fund inflows must equal outflows within tolerance.
 */
const AT6_MONEY_CONSERVATION: AnchorTest = {
  id: 'AT-6',
  name: 'Money Conservation (Accounting Sanity)',
  category: 'consistency',
  description: 'Total inflows must equal outflows within 1% tolerance.',
  simulationMonths: 12,
  setup: {
    anyValidConfiguration: true
  },
  assert: {
    type: 'conservation',
    operator: 'within',
    tolerance: 0.01
  }
};

/** All anchor tests */
export const ANCHOR_TESTS: AnchorTest[] = [
  AT1_DYSTOPIA,
  AT2_UBI_PREVENTS_COLLAPSE,
  AT3_PRISONERS_DILEMMA,
  AT4_DEMAND_TRIGGERS_ADAPTATION,
  AT5_GLOBAL_HELPS_POOR,
  AT6_MONEY_CONSERVATION
];

// Poor countries for AT-5 comparison
const POOR_COUNTRY_IDS = ['HTI', 'AFG', 'YEM', 'ETH', 'COD', 'SYR', 'PRK', 'TJK'];

/**
 * Create initial simulation state for testing
 */
function createInitialState(): SimulationState {
  const countryData: Record<string, any> = {};
  const shadowCountryData: Record<string, any> = {};

  for (const country of INITIAL_COUNTRIES) {
    countryData[country.id] = {
      ...country,
      aiAdoption: 0.1,  // Start with 10% adoption
      wellbeing: 70,    // Start at neutral wellbeing
      companiesJoined: 0
    };
    shadowCountryData[country.id] = { ...countryData[country.id] };
  }

  return {
    month: 0,
    globalFund: 0,
    averageWellbeing: 70,
    totalAiCompanies: INITIAL_CORPORATIONS.length,
    countryData,
    shadowCountryData,
    globalDisplacementGap: 0,
    corruptionLeakage: 0,
    countriesInCrisis: 0
  };
}

/**
 * Create corporations with setup overrides
 */
function createCorporations(setup: AnchorTestSetup): Corporation[] {
  return INITIAL_CORPORATIONS.map(corp => ({
    ...corp,
    contributionRate: setup.allCorpsContributionRate ?? corp.contributionRate,
    policyStance: setup.allCorpsPolicyStance ?? corp.policyStance,
    distributionStrategy: setup.distributionStrategy ?? corp.distributionStrategy
  }));
}

/**
 * Create model parameters with setup overrides
 */
function createModelParams(setup: AnchorTestSetup): ModelParameters {
  return {
    id: 'test-model',
    name: 'Test Model',
    description: 'Model for anchor testing',
    corporateTaxRate: 0.20,
    adoptionIncentive: 0.20,
    baseUBI: 300,
    aiGrowthRate: 0.08,
    volatility: 0.05,
    gdpScaling: 0.4,
    globalRedistributionRate: 0.3,
    displacementRate: setup.displacementRate ?? 0.75,
    directToWalletEnabled: true,
    defaultCorpPolicy: 'mixed-reality',
    marketPressure: setup.marketPressure ?? 0.5
  };
}

/**
 * Run simulation for N months and return history
 */
function runSimulation(
  months: number,
  setup: AnchorTestSetup
): { initial: SimulationState; final: SimulationState; history: SimulationOutput[]; maxRaceToBottomRisk: number } {
  const initialState = createInitialState();
  let corporations = createCorporations(setup);
  const model = createModelParams(setup);

  let currentState = initialState;
  const history: SimulationOutput[] = [];
  let maxRaceToBottomRisk = 0;

  for (let i = 0; i < months; i++) {
    const input: SimulationInput = {
      state: currentState,
      corporations,
      model
    };

    const output = stepSimulationPure(input);
    history.push(output);
    currentState = output.state;
    corporations = output.corporations;

    // Track max race-to-bottom risk for AT-3
    if (output.gameTheory.raceToBottomRisk > maxRaceToBottomRisk) {
      maxRaceToBottomRisk = output.gameTheory.raceToBottomRisk;
    }
  }

  return {
    initial: initialState,
    final: currentState,
    history,
    maxRaceToBottomRisk
  };
}

/**
 * Run a single anchor test
 */
export function runAnchorTest(test: AnchorTest): AnchorTestResult {
  try {
    // Special handling for comparison test (AT-5)
    if (test.setup.compareStrategies) {
      return runComparisonTest(test);
    }

    const { initial, final, history, maxRaceToBottomRisk } = runSimulation(test.simulationMonths, test.setup);

    const initialWellbeing = initial.averageWellbeing;
    const finalWellbeing = final.averageWellbeing;
    const wellbeingDelta = finalWellbeing - initialWellbeing;

    let passed = false;
    let reason = '';
    let actual = '';

    switch (test.assert.type) {
      case 'wellbeingDelta':
        passed = evaluateAssertion(wellbeingDelta, test.assert.operator!, test.assert.value!);
        actual = `Wellbeing delta: ${wellbeingDelta.toFixed(2)}`;
        reason = passed
          ? `Wellbeing changed by ${wellbeingDelta.toFixed(2)} (expected ${test.assert.operator} ${test.assert.value})`
          : `Wellbeing delta ${wellbeingDelta.toFixed(2)} did not satisfy ${test.assert.operator} ${test.assert.value}`;
        break;

      case 'threshold':
        if (test.id === 'AT-2') {
          // AT-2: Check if final >= 80% of initial
          const ratio = finalWellbeing / initialWellbeing;
          passed = ratio >= test.assert.value!;
          actual = `Final/Initial ratio: ${ratio.toFixed(3)}`;
          reason = passed
            ? `Wellbeing maintained at ${(ratio * 100).toFixed(1)}% of initial`
            : `Wellbeing collapsed to ${(ratio * 100).toFixed(1)}% of initial (expected >= ${test.assert.value! * 100}%)`;
        } else if (test.id === 'AT-4') {
          // AT-4: Check if avg contribution increased
          const initialAvg = test.setup.allCorpsContributionRate || 0.10;
          const finalAvg = history[history.length - 1]?.gameTheory.avgContributionRate || initialAvg;
          passed = finalAvg > initialAvg;
          actual = `Contribution rate: ${initialAvg.toFixed(3)} → ${finalAvg.toFixed(3)}`;
          reason = passed
            ? `Contribution rate increased from ${(initialAvg * 100).toFixed(1)}% to ${(finalAvg * 100).toFixed(1)}%`
            : `Contribution rate did not increase (stayed at ${(finalAvg * 100).toFixed(1)}%)`;
        }
        break;

      case 'gameTheory':
        // AT-3: Check if race-to-bottom risk exceeded threshold at some point
        passed = maxRaceToBottomRisk > test.assert.value!;
        actual = `Max race-to-bottom risk: ${maxRaceToBottomRisk.toFixed(3)}`;
        reason = passed
          ? `Race-to-bottom risk reached ${(maxRaceToBottomRisk * 100).toFixed(1)}% (threshold: ${test.assert.value! * 100}%)`
          : `Race-to-bottom risk only reached ${(maxRaceToBottomRisk * 100).toFixed(1)}% (expected > ${test.assert.value! * 100}%)`;
        break;

      case 'conservation':
        // AT-6: Check money conservation
        const lastOutput = history[history.length - 1];
        const inflow = lastOutput?.ledger.monthlyInflow || 0;
        const outflow = lastOutput?.ledger.monthlyOutflow || 0;
        const diff = Math.abs(inflow - outflow) / Math.max(inflow, 1);
        passed = diff <= (test.assert.tolerance || 0.01);
        actual = `Inflow: ${inflow.toFixed(2)}, Outflow: ${outflow.toFixed(2)}, Diff: ${(diff * 100).toFixed(2)}%`;
        reason = passed
          ? `Money conserved within ${(diff * 100).toFixed(2)}% tolerance`
          : `Money conservation violated: ${(diff * 100).toFixed(2)}% difference (allowed: ${(test.assert.tolerance! * 100).toFixed(0)}%)`;
        break;

      default:
        reason = `Unknown assertion type: ${test.assert.type}`;
    }

    return {
      testId: test.id,
      testName: test.name,
      category: test.category,
      passed,
      reason,
      details: {
        expected: `${test.assert.operator} ${test.assert.value}`,
        actual,
        metrics: {
          initialWellbeing,
          finalWellbeing,
          wellbeingDelta,
          months: test.simulationMonths
        }
      }
    };

  } catch (error) {
    return {
      testId: test.id,
      testName: test.name,
      category: test.category,
      passed: false,
      reason: `Test execution error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Run comparison test (AT-5)
 */
function runComparisonTest(test: AnchorTest): AnchorTestResult {
  const strategies = test.setup.compareStrategies!;

  // Run with global distribution
  const globalSetup: AnchorTestSetup = {
    ...test.setup,
    distributionStrategy: 'global',
    allCorpsContributionRate: 0.20,
    allCorpsPolicyStance: 'moderate'
  };
  const globalResult = runSimulation(test.simulationMonths, globalSetup);

  // Run with HQ-local distribution
  const localSetup: AnchorTestSetup = {
    ...test.setup,
    distributionStrategy: 'hq-local',
    allCorpsContributionRate: 0.20,
    allCorpsPolicyStance: 'moderate'
  };
  const localResult = runSimulation(test.simulationMonths, localSetup);

  // Calculate poor countries' wellbeing in each scenario
  const globalPoorWellbeing = calculatePoorCountriesWellbeing(globalResult.final);
  const localPoorWellbeing = calculatePoorCountriesWellbeing(localResult.final);

  const passed = globalPoorWellbeing > localPoorWellbeing;

  return {
    testId: test.id,
    testName: test.name,
    category: test.category,
    passed,
    reason: passed
      ? `Poor countries' wellbeing higher with global (${globalPoorWellbeing.toFixed(1)}) vs HQ-local (${localPoorWellbeing.toFixed(1)})`
      : `Poor countries' wellbeing NOT higher with global (${globalPoorWellbeing.toFixed(1)}) vs HQ-local (${localPoorWellbeing.toFixed(1)})`,
    details: {
      expected: 'Global > HQ-local for poor countries',
      actual: `Global: ${globalPoorWellbeing.toFixed(2)}, HQ-local: ${localPoorWellbeing.toFixed(2)}`,
      metrics: {
        globalPoorWellbeing,
        localPoorWellbeing,
        difference: globalPoorWellbeing - localPoorWellbeing
      }
    }
  };
}

/**
 * Calculate average wellbeing of poor countries
 */
function calculatePoorCountriesWellbeing(state: SimulationState): number {
  let total = 0;
  let count = 0;

  for (const id of POOR_COUNTRY_IDS) {
    const country = state.countryData[id];
    if (country) {
      total += country.wellbeing;
      count++;
    }
  }

  return count > 0 ? total / count : 0;
}

/**
 * Evaluate an assertion
 */
function evaluateAssertion(actual: number, operator: string, expected: number): boolean {
  switch (operator) {
    case '<': return actual < expected;
    case '>': return actual > expected;
    case '<=': return actual <= expected;
    case '>=': return actual >= expected;
    case '==': return Math.abs(actual - expected) < 0.001;
    default: return false;
  }
}

/**
 * Run all anchor tests
 */
export function runAllAnchorTests(): AnchorTestSuiteResult {
  const results: AnchorTestResult[] = [];

  for (const test of ANCHOR_TESTS) {
    results.push(runAnchorTest(test));
  }

  const passed = results.filter(r => r.passed).length;

  return {
    passed,
    total: ANCHOR_TESTS.length,
    results,
    tier2Passed: passed >= 4
  };
}

/**
 * Get anchor test by ID
 */
export function getAnchorTest(id: string): AnchorTest | undefined {
  return ANCHOR_TESTS.find(t => t.id === id);
}

/**
 * Run specific anchor tests by ID
 */
export function runAnchorTestsById(ids: string[]): AnchorTestResult[] {
  return ids
    .map(id => getAnchorTest(id))
    .filter((t): t is AnchorTest => t !== undefined)
    .map(test => runAnchorTest(test));
}

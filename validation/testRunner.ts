/**
 * Anchor Test Runner
 * Orchestrates running anchor tests with progress reporting
 *
 * Note: Web Worker implementation deferred - runs in main thread with chunking
 * to avoid blocking UI. Full Web Worker can be added later for better performance.
 */

import { ModelConfig, ModelValidationResult } from '../types';
import {
  ANCHOR_TESTS,
  runAnchorTest,
  runAllAnchorTests
} from './anchorTests';
import type { AnchorTestResult, AnchorTestSuiteResult } from './anchorTests';
import { validateTier1, calculateComplexity } from '../src/services/modelValidator';

/** Progress callback for UI updates */
export type ProgressCallback = (progress: TestRunProgress) => void;

/** Progress update during test run */
export interface TestRunProgress {
  currentTest: number;
  totalTests: number;
  currentTestName: string;
  status: 'running' | 'completed' | 'error';
  results: AnchorTestResult[];
}

/** Complete validation result including both tiers */
export interface FullValidationResult {
  tier1: {
    passed: boolean;
    failures: Array<{ testId: string; reason: string }>;
  };
  tier2: AnchorTestSuiteResult;
  complexity: number;
  eligible: boolean;  // True if tier1 passed AND tier2.passed >= 4
  summary: string;
}

/**
 * Run all anchor tests with progress reporting
 * Uses chunked execution to avoid blocking UI
 */
export async function runTestsWithProgress(
  onProgress?: ProgressCallback
): Promise<AnchorTestSuiteResult> {
  const results: AnchorTestResult[] = [];

  for (let i = 0; i < ANCHOR_TESTS.length; i++) {
    const test = ANCHOR_TESTS[i];

    // Report progress before running test
    onProgress?.({
      currentTest: i + 1,
      totalTests: ANCHOR_TESTS.length,
      currentTestName: test.name,
      status: 'running',
      results: [...results]
    });

    // Yield to UI thread between tests
    await new Promise(resolve => setTimeout(resolve, 0));

    try {
      const result = runAnchorTest(test);
      results.push(result);
    } catch (error) {
      results.push({
        testId: test.id,
        testName: test.name,
        category: test.category,
        passed: false,
        reason: `Test execution error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  // Report completion
  const passed = results.filter(r => r.passed).length;
  onProgress?.({
    currentTest: ANCHOR_TESTS.length,
    totalTests: ANCHOR_TESTS.length,
    currentTestName: 'Complete',
    status: 'completed',
    results
  });

  return {
    passed,
    total: ANCHOR_TESTS.length,
    results,
    tier2Passed: passed >= 4
  };
}

/**
 * Run full validation pipeline (Tier 1 + Tier 2)
 */
export async function runFullValidation(
  config: ModelConfig,
  onProgress?: ProgressCallback
): Promise<FullValidationResult> {
  // First run Tier 1 validation
  const tier1Failures = validateTier1(config);
  const tier1Passed = tier1Failures.length === 0;

  // Calculate complexity
  const complexity = calculateComplexity(config);

  // If Tier 1 fails, skip Tier 2
  if (!tier1Passed) {
    return {
      tier1: {
        passed: false,
        failures: tier1Failures.map(f => ({ testId: f.testId, reason: f.reason }))
      },
      tier2: {
        passed: 0,
        total: ANCHOR_TESTS.length,
        results: [],
        tier2Passed: false
      },
      complexity,
      eligible: false,
      summary: `❌ Tier 1 failed: ${tier1Failures.length} error(s). Fix before running anchor tests.`
    };
  }

  // Run Tier 2 anchor tests
  const tier2 = await runTestsWithProgress(onProgress);

  const eligible = tier1Passed && tier2.tier2Passed;

  return {
    tier1: {
      passed: true,
      failures: []
    },
    tier2,
    complexity,
    eligible,
    summary: eligible
      ? `✅ Eligible for leaderboard (${tier2.passed}/${tier2.total} anchors, complexity: ${complexity})`
      : `⚠️ Not eligible: passed ${tier2.passed}/${tier2.total} anchors (need 4+)`
  };
}

/**
 * Quick test run - just run Tier 2 without Tier 1 (for already validated models)
 */
export function runQuickTest(): AnchorTestSuiteResult {
  return runAllAnchorTests();
}

/**
 * Run a single test by ID
 */
export function runSingleTest(testId: string): AnchorTestResult | null {
  const test = ANCHOR_TESTS.find(t => t.id === testId);
  if (!test) return null;
  return runAnchorTest(test);
}

/**
 * Get test descriptions for UI display
 */
export function getTestDescriptions(): Array<{
  id: string;
  name: string;
  category: string;
  description: string;
  months: number;
}> {
  return ANCHOR_TESTS.map(t => ({
    id: t.id,
    name: t.name,
    category: t.category,
    description: t.description,
    months: t.simulationMonths
  }));
}

/**
 * Format test result for display
 */
export function formatTestResult(result: AnchorTestResult): string {
  const icon = result.passed ? '✅' : '❌';
  return `${icon} ${result.testName}: ${result.reason}`;
}

/**
 * Get summary statistics from test results
 */
export function getTestSummary(results: AnchorTestResult[]): {
  causal: { passed: number; total: number };
  equilibrium: { passed: number; total: number };
  consistency: { passed: number; total: number };
} {
  const summary = {
    causal: { passed: 0, total: 0 },
    equilibrium: { passed: 0, total: 0 },
    consistency: { passed: 0, total: 0 }
  };

  for (const result of results) {
    summary[result.category].total++;
    if (result.passed) {
      summary[result.category].passed++;
    }
  }

  return summary;
}

// Re-export useful types
export { AnchorTestResult, AnchorTestSuiteResult };

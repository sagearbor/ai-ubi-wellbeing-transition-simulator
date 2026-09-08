/**
 * Tests for anchorTests.ts's optional compiled-equation-set support.
 *
 * Background: runAllAnchorTests()/runAnchorTest() always scored the hardcoded default
 * engine, regardless of which model was being validated in the Models tab UI - a
 * model's "N/6 anchor tests passed" score never actually reflected its own equations
 * (see the repo's tmp/wrapups/ notes). These tests cover the fix: an optional
 * `equations?: CompiledEquationSet` parameter, threaded through runSimulation /
 * runAnchorTest / runComparisonTest / runAllAnchorTests / runAnchorTestsById.
 */

import { describe, it, expect } from 'vitest';
import { runAllAnchorTests, runAnchorTest, getAnchorTest } from './anchorTests';
import { getCompiledEquationSet } from '../src/services/equationParser';
import { DEFAULT_EQUATIONS } from '../constants';

describe('anchorTests - optional compiled equation set', () => {
  it('regression: omitting equations scores the hardcoded default engine, unchanged', () => {
    const suite = runAllAnchorTests();

    expect(suite.total).toBe(6);
    // Locks the known baseline (see scripts/run-anchor-tests.ts output / prior wrapups):
    // AT-1, AT-3, AT-4, AT-5, AT-6 pass; AT-2 fails (owner-acknowledged, untouched).
    expect(suite.passed).toBe(5);
    const at2 = suite.results.find(r => r.testId === 'AT-2');
    expect(at2?.passed).toBe(false);
  });

  it('golden: compiled DEFAULT_EQUATIONS reproduce the hardcoded-engine anchor results bit-for-bit', () => {
    const equations = getCompiledEquationSet(DEFAULT_EQUATIONS);
    expect(equations).not.toBeNull();

    const hardcoded = runAllAnchorTests();
    const compiled = runAllAnchorTests(equations!);

    expect(compiled.passed).toBe(hardcoded.passed);
    for (let i = 0; i < hardcoded.results.length; i++) {
      expect(compiled.results[i].passed).toBe(hardcoded.results[i].passed);
      expect(compiled.results[i].details?.actual).toBe(hardcoded.results[i].details?.actual);
    }
  });

  it("a model's own equations change its anchor-test outcome (proves the score is no longer generic)", () => {
    // AT-1 (Dystopia Test) asserts wellbeing DECLINES by more than 5 points when AI
    // displaces jobs with zero UBI. Overriding wellbeingDelta to always be strongly
    // positive should flip AT-1 from passing (default engine) to failing (this model).
    const alwaysThrives = getCompiledEquationSet({
      ...DEFAULT_EQUATIONS,
      wellbeingDelta: '5' // constant positive delta every month, ignoring inputs entirely
    });
    expect(alwaysThrives).not.toBeNull();

    const at1 = getAnchorTest('AT-1')!;
    const defaultResult = runAnchorTest(at1);
    const customResult = runAnchorTest(at1, alwaysThrives!);

    expect(defaultResult.passed).toBe(true);
    expect(customResult.passed).toBe(false);
  });

  it('runAllAnchorTests with a custom equation set produces a different pass count than the default engine', () => {
    const alwaysThrives = getCompiledEquationSet({
      ...DEFAULT_EQUATIONS,
      wellbeingDelta: '5'
    });
    expect(alwaysThrives).not.toBeNull();

    const hardcoded = runAllAnchorTests();
    const custom = runAllAnchorTests(alwaysThrives!);

    // Not asserting an exact custom pass count (several tests may shift), just that the
    // model-specific run is observably different from the always-default-engine run.
    expect(custom.results).not.toEqual(hardcoded.results);
  });
});

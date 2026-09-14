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
    // Locks the known baseline. Until 2026-09-13 this read 5/6 (AT-2 failing). That count was an
    // artefact: stepSimulationPure mutated country objects in place, including the wellbeingTrend
    // array shared with the INITIAL_COUNTRIES constant, so each anchor test started from state
    // polluted by the previous one and AT-3's race-to-bottom trigger fired only because of that.
    // With the engine made pure (docs/design/audit-2026-09-13.md) the honest baseline was 4/6:
    // AT-1, AT-4, AT-5, AT-6 pass; AT-2 and AT-3 fail on a clean run (owner-acknowledged).
    // Stage 3 (same day, docs/design/model-card-default.md) fixed three unit/aggregation
    // artefacts - adoption summed over corporations (C2), per-capita UBI understated 10,000x
    // (C3), monthly revenue at an annual ratio (C4). AT-2 now passes for the stated reason
    // (UBI at real magnitude holds wellbeing); AT-3 still fails. Baseline: 5/6.
    expect(suite.passed).toBe(5);
    const at2 = suite.results.find(r => r.testId === 'AT-2');
    expect(at2?.passed).toBe(true);
    const at3 = suite.results.find(r => r.testId === 'AT-3');
    expect(at3?.passed).toBe(false);
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

describe('review finding 10: directional anchors never gate eligibility', () => {
  it('eligibility is the accounting invariant alone; directional passes are reported separately', async () => {
    const { summariseAnchors } = await import('./anchorTests');
    const r = (id: string, category: 'causal' | 'equilibrium' | 'consistency', passed: boolean) => ({ testId: id, testName: id, category, passed, reason: '' });
    const allDirectionalFail = summariseAnchors([r('AT-1', 'causal', false), r('AT-2', 'causal', false), r('AT-3', 'equilibrium', false), r('AT-6', 'consistency', true)]);
    expect(allDirectionalFail.tier2Passed).toBe(true);
    expect(allDirectionalFail.directional).toEqual({ passed: 0, total: 3 });
    const brokenAccounting = summariseAnchors([r('AT-1', 'causal', true), r('AT-2', 'causal', true), r('AT-6', 'consistency', false)]);
    expect(brokenAccounting.tier2Passed).toBe(false);
    expect(summariseAnchors([]).tier2Passed).toBe(false);
  });
});

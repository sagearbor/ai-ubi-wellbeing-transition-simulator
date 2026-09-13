/**
 * KJ-1..3: Korinek et al. (2026) reproduction tests.
 *
 * Each scenario must reproduce the published US 2030 outcomes within tolerance:
 *   GDP boost vs no-AI path      +/- 2.0 percentage points
 *   labour share of income       +/- 2.0 percentage points
 *   cognitive-worker unemployment +/- 2.5 percentage points
 *
 * Kept as a separate suite from the six causal anchor tests (AT-1..6) so that the
 * model-eligibility rule "4 of 6" is untouched.
 */

import type { AnchorTestResult } from './anchorTests';
import { KORINEK_SCENARIOS } from '../constants';
import { runKorinekScenario, KorinekOutcome } from './korinek';

export const KJ_TOLERANCE = { gdpBoostPct: 2.0, laborSharePct: 2.0, cognitiveUnemploymentPct: 2.5 } as const;

export interface KorinekSuiteResult {
  passed: number;
  total: number;
  results: AnchorTestResult[];
  outcomes: KorinekOutcome[];
}

export function scoreKorinekOutcome(o: KorinekOutcome, index: number): AnchorTestResult {
  const checks = [
    ['gdpBoostPct', o.gdpBoostPct, o.targets.gdpBoostPct, KJ_TOLERANCE.gdpBoostPct],
    ['laborSharePct', o.laborSharePct, o.targets.laborSharePct, KJ_TOLERANCE.laborSharePct],
    ['cognitiveUnemploymentPct', o.cognitiveUnemploymentPct, o.targets.cognitiveUnemploymentPct, KJ_TOLERANCE.cognitiveUnemploymentPct],
  ] as const;
  const failures = checks.filter(([, actual, target, tol]) => Math.abs(actual - target) > tol);
  const fmt = (x: number) => x.toFixed(1);
  const summary = checks
    .map(([k, a, t]) => `${k}: ${fmt(a)} (target ${fmt(t)})`)
    .join('; ');
  return {
    testId: `KJ-${index + 1}`,
    testName: `Korinek et al. 2026 ${o.scenarioId} scenario, US 2030`,
    category: 'consistency',
    passed: failures.length === 0,
    reason: failures.length === 0
      ? `Reproduced within tolerance. ${summary}`
      : `Off target on ${failures.map(([k]) => k).join(', ')}. ${summary}`,
    details: {
      expected: `GDP +${o.targets.gdpBoostPct}% ±${KJ_TOLERANCE.gdpBoostPct}, labour share ${o.targets.laborSharePct}% ±${KJ_TOLERANCE.laborSharePct}, cognitive unemployment ${o.targets.cognitiveUnemploymentPct}% ±${KJ_TOLERANCE.cognitiveUnemploymentPct}`,
      actual: summary,
      metrics: {
        gdpBoostPct: o.gdpBoostPct,
        laborSharePct: o.laborSharePct,
        unemploymentPct: o.unemploymentPct,
        cognitiveUnemploymentPct: o.cognitiveUnemploymentPct,
        growthPctPerYear: o.growthPctPerYear,
        adoptionEnd: o.adoptionEnd,
      },
    },
  };
}

export function runKorinekSuite(): KorinekSuiteResult {
  const outcomes = KORINEK_SCENARIOS.map((s) => runKorinekScenario(s));
  const results = outcomes.map((o, i) => scoreKorinekOutcome(o, i));
  return { passed: results.filter((r) => r.passed).length, total: results.length, results, outcomes };
}

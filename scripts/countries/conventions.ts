/**
 * The conventions of `countries-wb-2026-09`, as code (data/countries/README.md is the prose).
 * Pure; imported by the build script and by tests that re-derive stored values.
 */

export const WB_DATASET_ID = 'countries-wb-2026-09';
export const REFERENCE_YEAR = 2024;

/** Observation windows: each value is the LATEST observation inside its window. */
export const WINDOWS = {
  population: [2018, REFERENCE_YEAR] as [number, number],
  gdpPerCapita: [2018, REFERENCE_YEAR] as [number, number],
  gini: [2014, REFERENCE_YEAR] as [number, number],
  governance: [2018, REFERENCE_YEAR] as [number, number],
};

/**
 * Governance transform (data/countries/README.md, "Governance"):
 *
 *   governance = clamp(GOVERNANCE_SCALE.intercept + GOVERNANCE_SCALE.slope x mean(GE, RL, CC), 0, 1)
 *
 * The WGI mean (Government Effectiveness, Rule of Law, Control of Corruption estimates, same
 * year) supplies every country's value and ordering. The two constants only put it on the
 * governance scale the engine's fixed constants were written for (archetype thresholds 0.35 /
 * 0.50 / 0.60 / 0.80, direct-wallet cut 0.40, friction (1 - g)^1.5): they match the mean and
 * standard deviation of the WGI mean to those of the hand-entered column over the 128 countries
 * both cover (WGI 2024 vintage, computed once on 2026-09-14 and then FIXED - a later WGI vintage
 * is mapped with the same constants, it does not refit them). Re-derived in
 * scripts/countries/countryDatasets.test.ts.
 */
export const GOVERNANCE_SCALE = { intercept: 0.5668, slope: 0.2264 } as const;

export function wgiMean(ge: number, rl: number, cc: number): number {
  return (ge + rl + cc) / 3;
}

export function governanceFromWgi(ge: number, rl: number, cc: number): number {
  return Math.min(1, Math.max(0, GOVERNANCE_SCALE.intercept + GOVERNANCE_SCALE.slope * wgiMean(ge, rl, cc)));
}

/** Mean/SD location-scale match of `x` onto `y` (population moments). */
export function locationScaleMatch(x: readonly number[], y: readonly number[]): { intercept: number; slope: number } {
  const n = x.length;
  const mean = (v: readonly number[]) => v.reduce((a, b) => a + b, 0) / n;
  const mx = mean(x);
  const my = mean(y);
  const sx = Math.sqrt(x.reduce((a, v) => a + (v - mx) ** 2, 0) / n);
  const sy = Math.sqrt(y.reduce((a, v) => a + (v - my) ** 2, 0) / n);
  const slope = sy / sx;
  return { intercept: my - slope * mx, slope };
}

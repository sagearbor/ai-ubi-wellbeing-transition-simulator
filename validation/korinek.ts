/**
 * Korinek et al. (2026) scenario reproduction.
 *
 * Reproduces the three US 2030 scenarios of Korinek, Jones, Sacher, Cotter & McCrory,
 * "Economic Scenarios for Transformative AI" (Anthropic Institute WP 2026-02) with this
 * engine's macro block. Their explorer treats the AI capability/adoption path as an INPUT
 * and derives GDP, the labour share and unemployment; this harness does the same: the US
 * share of cognitive tasks performed by AI follows an exogenous logistic path from a small
 * mid-2026 value to `adoption2030`, overriding the engine's corporation-driven adoption for
 * the US only, and the macro block produces the outcomes.
 *
 * Pure: no I/O. Used by validation/korinekTests.ts and scripts/validate-korinek.ts.
 */

import { CountryStats, ModelParameters, SimulationState } from '../types';
import { stepSimulationPure } from '../simulation/pure';
import { INITIAL_COUNTRIES, INITIAL_CORPORATIONS, KORINEK_SCENARIOS, KorinekScenario } from '../constants';

export const KORINEK_START = { year: 2026, month: 6 }; // their mid-2026 anchor
export const KORINEK_END_YEAR = 2030;
export const KORINEK_START_ADOPTION = 0.01;

export interface KorinekOutcome {
  scenarioId: KorinekScenario['id'];
  months: number;
  adoptionEnd: number;
  gdpBoostPct: number;
  laborSharePct: number;
  unemploymentPct: number;
  cognitiveUnemploymentPct: number;
  /** Annualised US GDP-per-capita growth over the run, %. */
  growthPctPerYear: number;
  targets: KorinekScenario['targets'];
}

/** Logistic adoption path from start to target over `months`, hitting ~target at the end. */
export function adoptionPath(start: number, target: number, months: number, t: number): number {
  if (t <= 0) return start;
  if (t >= months) return target;
  const k = 8 / months; // steepness: most of the rise in the middle of the window
  const s = 1 / (1 + Math.exp(-k * (t - months * 0.6)));
  const s0 = 1 / (1 + Math.exp(-k * (0 - months * 0.6)));
  const s1 = 1 / (1 + Math.exp(-k * (months - months * 0.6)));
  const f = (s - s0) / (s1 - s0);
  return start + (target - start) * f;
}

function buildState(): SimulationState {
  const countryData: Record<string, CountryStats> = {};
  for (const c of INITIAL_COUNTRIES) {
    countryData[c.id] = { ...c, aiAdoption: KORINEK_START_ADOPTION, wellbeing: 70, companiesJoined: 0, wellbeingTrend: [70] };
  }
  return {
    month: 0,
    globalFund: 0,
    averageWellbeing: 70,
    totalAiCompanies: INITIAL_CORPORATIONS.length,
    countryData,
    shadowCountryData: JSON.parse(JSON.stringify(countryData)),
    globalDisplacementGap: 0,
    corruptionLeakage: 0,
    countriesInCrisis: 0,
  };
}

export function korinekModel(scenario: KorinekScenario): ModelParameters {
  return {
    id: `korinek-${scenario.id}`,
    name: scenario.name,
    description: scenario.description,
    corporateTaxRate: 0.2,
    adoptionIncentive: 0.2,
    baseUBI: 300,
    // The adoption path is the scenario INPUT (set exogenously each month below), so the
    // engine's own corporation-driven adoption growth is switched off.
    aiGrowthRate: 0,
    volatility: 0.05,
    gdpScaling: 0.4,
    globalRedistributionRate: 0.3,
    displacementRate: 0.75,
    directToWalletEnabled: true,
    defaultCorpPolicy: 'mixed-reality',
    marketPressure: 0.5,
    macro: scenario.macro,
  };
}

/** Run one scenario and return the US 2030 outcomes next to the published targets. */
export function runKorinekScenario(scenario: KorinekScenario, countryId = 'USA'): KorinekOutcome {
  const months = (KORINEK_END_YEAR - KORINEK_START.year) * 12 + (12 - KORINEK_START.month); // mid-2026 -> end-2030
  const model = korinekModel(scenario);
  let state = buildState();
  let corporations = INITIAL_CORPORATIONS.map((c) => ({ ...c }));

  for (let t = 1; t <= months; t++) {
    const out = stepSimulationPure({ state, corporations, model });
    state = out.state;
    corporations = out.corporations;
    // Exogenous adoption path for the country under study (the scenario input).
    const c = state.countryData[countryId];
    c.aiAdoption = adoptionPath(KORINEK_START_ADOPTION, scenario.adoption2030, months, t);
  }

  const us = state.countryData[countryId];
  const gdpNoAi = us.gdpNoAi ?? us.gdpPerCapita;
  const startGdp = INITIAL_COUNTRIES.find((c) => c.id === countryId)!.gdpPerCapita;
  const years = months / 12;
  return {
    scenarioId: scenario.id,
    months,
    adoptionEnd: us.aiAdoption,
    gdpBoostPct: (us.gdpPerCapita / gdpNoAi - 1) * 100,
    laborSharePct: (us.laborShare ?? 0.6) * 100,
    unemploymentPct: (us.unemployment ?? 0) * 100,
    cognitiveUnemploymentPct: (us.cognitiveUnemployment ?? 0) * 100,
    growthPctPerYear: (Math.pow(us.gdpPerCapita / startGdp, 1 / years) - 1) * 100,
    targets: scenario.targets,
  };
}

export function runAllKorinekScenarios(): KorinekOutcome[] {
  return KORINEK_SCENARIOS.map((s) => runKorinekScenario(s));
}

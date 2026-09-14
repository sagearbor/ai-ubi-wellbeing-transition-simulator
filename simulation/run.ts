/**
 * A complete, replayable simulation run.
 *
 * Stage 1 of the v3 plan (docs/design/audit-2026-09-13.md): the app kept four pieces of state
 * (countries, corporations, ledger, game theory) in four React hooks and stored only the first in
 * history, so seeking restored countries from the past next to corporations from the present, the
 * comparison panel never advanced, and save files carried a partial picture. This module defines
 * the one object that IS a simulation at a point in time, and pure functions to advance, replay
 * and compare it. App.tsx and tests build on this; simulation/pure.ts stays the engine.
 */

import type {
  Corporation,
  CountryStats,
  GameTheoryState,
  GlobalLedger,
  ModelParameters,
  SimulationState,
} from '../types';
import { stepSimulationPure } from './pure';
import type { CompiledEquationSet } from '../src/services/equationParser';
import { INITIAL_COUNTRIES, INITIAL_CORPORATIONS } from '../constants';
import ladderJson from '../data/hindcast/wellbeing-ladder.json';

/** Everything the engine reads and writes in one step. Immutable by convention: never edit in place. */
export interface SimulationRun {
  state: SimulationState;
  corporations: Corporation[];
  ledger: GlobalLedger;
  gameTheory: GameTheoryState;
}

/** Inputs that stay fixed across steps of one run (may be swapped to fork a run). */
export interface RunInputs {
  model: ModelParameters;
  /** Compiled uploaded equations; undefined = the built-in engine. */
  equations?: CompiledEquationSet;
  /**
   * When set, every corporation's contributionRate is held at this value: it is applied before
   * each month is stepped (so contributions are computed from it) and again to the stepped
   * corporations (so the engine's adaptive rules cannot move it). Everything else - initial
   * state, model, equations, corporations' other fields - is untouched. This is the one
   * difference between a run and its paired no-UBI counterfactual; see noCorporateUbiInputs.
   */
  contributionRateOverride?: number;
}

/**
 * The paired counterfactual's inputs: the same model and equations, with every corporation's
 * contribution rate held at 0 every month, so no corporate UBI is paid. Advanced from the same
 * month-0 run as the main timeline, the difference between the two runs is the effect of the
 * corporate UBI in THIS model - nothing else (review 2026-09-14, finding 2).
 *
 * Caveat: an uploaded surplusGeneration equation that pays out when contributionRate is 0 would
 * still fund transfers; the counterfactual pins the rate, not the equation.
 */
export function noCorporateUbiInputs(inputs: RunInputs): RunInputs {
  return { ...inputs, contributionRateOverride: 0 };
}

export const EMPTY_LEDGER: GlobalLedger = {
  totalFunds: 0,
  monthlyInflow: 0,
  monthlyOutflow: 0,
  fundsPerCapita: 0,
  fundsByCountry: {},
  contributorBreakdown: {},
  distributionBreakdown: {},
  corruptionLeakage: 0,
};

export const EMPTY_GAME_THEORY: GameTheoryState = {
  isInPrisonersDilemma: false,
  defectionCount: 0,
  cooperationCount: 0,
  moderateCount: 0,
  raceToBottomRisk: 0,
  virtuousCycleStrength: 0,
  avgContributionRate: 0,
};

/** A country record before the simulation fields are set (what constants.ts INITIAL_COUNTRIES holds). */
export type CountryBase = Omit<CountryStats, 'aiAdoption' | 'wellbeing' | 'companiesJoined'> & Partial<Pick<CountryStats, 'aiAdoption' | 'wellbeing' | 'companiesJoined'>>;

/** Latest World Happiness Report ladder (0-10) per ISO3, from data/hindcast/wellbeing-ladder.json. */
const LADDER_DATA: Record<string, Record<string, number>> = (ladderJson as { data: Record<string, Record<string, number>> }).data;

/** Latest available ladder value for a country, scaled to the 0-100 index; undefined when unobserved. */
export function latestLadderIndex(id: string): number | undefined {
  const rec = LADDER_DATA[id];
  if (!rec) return undefined;
  const years = Object.keys(rec).map(Number).sort((a, b) => b - a);
  return years.length ? rec[String(years[0])] * 10 : undefined;
}

export interface InitOptions {
  /**
   * 'formula' (default, legacy): wellbeing = clamp(gdpPerCapita / 1200 + 40, 10, 100), an
   * unsourced rule (US 92.5). 'ladder': the latest World Happiness Report Cantril ladder × 10
   * (US ~70), falling back to the formula for countries the WHR does not cover. Stage 4; used by
   * models whose macro.wellbeingMode is 'anchored' so the level model starts on the scale it
   * was calibrated on.
   */
  initialWellbeing?: 'formula' | 'ladder';
}

/** Which initialisation a model asks for (anchored models start from observed ladder values). */
export function initOptionsFor(model?: Pick<ModelParameters, 'macro'> | null): InitOptions {
  return { initialWellbeing: model?.macro?.wellbeingMode === 'anchored' ? 'ladder' : 'formula' };
}

/** The app's month-0 country initialisation, extracted verbatim from App.tsx getInitialState. */
export function initialCountryData(countries: readonly CountryBase[] = INITIAL_COUNTRIES, opts: InitOptions = {}): Record<string, CountryStats> {
  const out: Record<string, CountryStats> = {};
  for (const c of countries) {
    const formula = Math.min(100, Math.max(10, c.gdpPerCapita / 1200 + 40));
    const ladder = opts.initialWellbeing === 'ladder' ? latestLadderIndex(c.id) : undefined;
    out[c.id] = {
      ...c,
      aiAdoption: 0.01,
      wellbeing: ladder ?? formula,
      companiesJoined: 0,
      displacementGap: 0,
      headquarteredCorps: [],
      customerOfCorps: [],
      ubiReceivedGlobal: 0,
      ubiReceivedLocal: 0,
      ubiReceivedCustomerWeighted: 0,
      totalUbiReceived: 0,
      nationalPolicy: {
        allowsDirectWallet: c.governance > 0.4,
        localTaxOnUbi: 0,
        corporateIncentives: 0,
      },
      wellbeingTrend: [],
    };
  }
  return out;
}

export function initialState(countries: readonly CountryBase[] = INITIAL_COUNTRIES, corporations: readonly Corporation[] = INITIAL_CORPORATIONS, opts: InitOptions = {}): SimulationState {
  const countryData = initialCountryData(countries, opts);
  const n = Object.keys(countryData).length;
  const avg = n ? Object.values(countryData).reduce((s, c) => s + c.wellbeing, 0) / n : 0;
  return {
    month: 0,
    globalFund: 0,
    averageWellbeing: avg,
    totalAiCompanies: corporations.length,
    countryData,
    globalDisplacementGap: 0,
    corruptionLeakage: 0,
    countriesInCrisis: 0,
  };
}

export function initialRun(
  corporations: readonly Corporation[] = INITIAL_CORPORATIONS,
  countries: readonly CountryBase[] = INITIAL_COUNTRIES,
  opts: InitOptions = {},
): SimulationRun {
  return {
    state: initialState(countries, corporations, opts),
    corporations: corporations.map((c) => ({ ...c })),
    ledger: { ...EMPTY_LEDGER, fundsByCountry: {}, contributorBreakdown: {}, distributionBreakdown: {} },
    gameTheory: { ...EMPTY_GAME_THEORY },
  };
}

/** Advance one month. Pure: the input run is not modified (the engine clones countries; corporations are re-mapped). */
export function advanceRun(run: SimulationRun, inputs: RunInputs): SimulationRun {
  const pin = inputs.contributionRateOverride;
  const hold = (corps: Corporation[]): Corporation[] =>
    pin === undefined ? corps : corps.map((c) => (c.contributionRate === pin ? c : { ...c, contributionRate: pin }));
  const out = stepSimulationPure({
    state: run.state,
    corporations: hold(run.corporations),
    model: inputs.model,
    equations: inputs.equations,
  });
  return { state: out.state, corporations: hold(out.corporations), ledger: out.ledger, gameTheory: out.gameTheory };
}

/** Advance `months` times, returning every intermediate run (index 0 = the input). */
export function runMonths(run: SimulationRun, months: number, inputs: RunInputs): SimulationRun[] {
  const out: SimulationRun[] = [run];
  let cur = run;
  for (let i = 0; i < months; i++) {
    cur = advanceRun(cur, inputs);
    out.push(cur);
  }
  return out;
}

/**
 * Replay from a base run to a target month, deterministically. Used by seek when history is
 * incomplete (older save files) and by tests that assert seek reproduces stepping.
 */
export function replayTo(base: SimulationRun, month: number, inputs: RunInputs): SimulationRun {
  let cur = base;
  while (cur.state.month < month) cur = advanceRun(cur, inputs);
  return cur;
}

/** Deterministic structural equality on the numbers that matter, for paired-comparison tests. */
export function runsEqual(a: SimulationRun, b: SimulationRun): boolean {
  if (a.state.month !== b.state.month) return false;
  if (a.state.averageWellbeing !== b.state.averageWellbeing) return false;
  if (a.ledger.totalFunds !== b.ledger.totalFunds || a.ledger.monthlyInflow !== b.ledger.monthlyInflow) return false;
  const ids = Object.keys(a.state.countryData);
  if (ids.length !== Object.keys(b.state.countryData).length) return false;
  for (const id of ids) {
    const x = a.state.countryData[id];
    const y = b.state.countryData[id];
    if (!y || x.wellbeing !== y.wellbeing || x.aiAdoption !== y.aiAdoption || x.totalUbiReceived !== y.totalUbiReceived) return false;
  }
  if (a.corporations.length !== b.corporations.length) return false;
  for (let i = 0; i < a.corporations.length; i++) {
    const x = a.corporations[i];
    const y = b.corporations[i];
    if (x.id !== y.id || x.contributionRate !== y.contributionRate || x.aiRevenue !== y.aiRevenue || x.reputationScore !== y.reputationScore) return false;
  }
  return true;
}

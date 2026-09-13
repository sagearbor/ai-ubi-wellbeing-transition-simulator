/**
 * Hindcast harness: score the pure engine against the 2015-2025 record.
 *
 * PURE - no I/O. The caller loads data/hindcast/*.json (see
 * scripts/hindcast/fetch-actuals.ts) and hands the parsed series in.
 *
 * WHAT THIS DOES AND DOES NOT VALIDATE
 * ------------------------------------
 * AI's macro effect on 2015-2025 is tiny next to COVID, war and inflation, so a
 * hindcast cannot validate the AI displacement channel. It validates the baseline
 * economy and calibrates the wellbeing coefficients. The headline run is therefore
 * the one with AI OFF; the AI-on run is reported next to it for contrast only.
 *
 * SCALING CHOICE (documented, load-bearing)
 * -----------------------------------------
 * The World Happiness Report Cantril ladder is 0-10; the simulator's `wellbeing` is
 * a 0-100 index. We map ladder -> index by multiplying by 10 (`ladderToWellbeingIndex`).
 * This is a pure rescale: it preserves correlations exactly, and it turns "0.6 ladder
 * points of mean absolute error" into "6.0 index points" (see HC2_MAE_THRESHOLD in
 * validation/hindcastTests.ts). It is not a claim that the engine's wellbeing index and
 * the ladder measure the same construct - only that they share a floor, a ceiling and a
 * direction, which is what a correlation/MAE score needs.
 *
 * CALENDAR
 * --------
 * Annual observations are anchored at the START of their year, so the state built from
 * the 2015 observations is Jan-2015 and year Y is the state after (Y - fromYear) * 12
 * monthly steps. 2015 -> 2025 is therefore 120 steps, not 132.
 *
 * WHAT "AI OFF" MEANS FOR THIS ENGINE
 * -----------------------------------
 * simulation/pure.ts has exactly two channels that can move wellbeing:
 *   1. displacement friction, driven by `country.aiAdoption`; and
 *   2. the UBI boost, funded by corporate AI revenue.
 * Country AI adoption grows by `aiGrowthRate * regionalModifier * corp.aiAdoptionLevel *
 * 0.1 * (1 - adoption)`, so `aiGrowthRate = 0` with a starting adoption of 0 pins adoption
 * at 0 forever and kills channel 1 (sin(0) * baseFriction = 0, lostWages = 0). Channel 2
 * does NOT depend on aiGrowthRate - corporations keep earning off their own
 * `aiAdoptionLevel` and keep paying UBI - and a decade of counterfactual corporate UBI is
 * not what happened between 2015 and 2025. So `aiOff: true` ALSO sets every corporation's
 * contributionRate to 0. Both channels off is the honest "no AI" baseline; see
 * `corpContributionRate` to override.
 */

import { CountryStats, ModelParameters, Corporation, SimulationState } from '../types';
import { stepSimulationPure, SimulationInput } from '../simulation/pure';
import { INITIAL_COUNTRIES, INITIAL_CORPORATIONS, DEFAULT_MACRO } from '../constants';

// ============================================================================
// DATA SHAPES (mirrors data/hindcast/*.json)
// ============================================================================

/** year (as a string) -> observed value */
export type YearSeries = Record<string, number>;

/** ISO3 country code -> year -> observed value */
export type CountrySeries = Record<string, YearSeries>;

/** One data/hindcast/*.json file. */
export interface HindcastSeriesFile {
  series: string;
  description: string;
  units: string;
  /** Name of the source column / indicator code the values came from. */
  valueColumn?: string;
  source: {
    name: string;
    url: string;
    retrievedAt: string;
    fallbackUrl?: string;
    lastUpdated?: string;
  };
  yearRange: [number, number];
  rowCount: number;
  countryCount: number;
  data: CountrySeries;
}

/** The observed series the harness scores against. */
export interface HindcastActuals {
  /** Cantril ladder, 0-10, ISO3 -> year -> value. */
  wellbeingLadder: CountrySeries;
  /** GDP per capita, constant 2015 US$, ISO3 -> year -> value. */
  gdpPerCapita: CountrySeries;
  /** Unemployment, % of labour force. Fetched, not yet scored (the engine has no such state). */
  unemployment?: CountrySeries;
}

// ============================================================================
// SCALING
// ============================================================================

/** Cantril ladder (0-10) -> simulator wellbeing index (0-100). */
export const LADDER_TO_INDEX_SCALE = 10;

export function ladderToWellbeingIndex(ladder: number): number {
  return ladder * LADDER_TO_INDEX_SCALE;
}

export function wellbeingIndexToLadder(index: number): number {
  return index / LADDER_TO_INDEX_SCALE;
}

// ============================================================================
// INITIAL STATE FROM ACTUALS
// ============================================================================

/** The fields the harness needs from a country definition (constants.ts INITIAL_COUNTRIES). */
export type HindcastCountryBase = Omit<CountryStats, 'aiAdoption' | 'wellbeing' | 'companiesJoined'>;

export interface DroppedCountry {
  id: string;
  name: string;
  /** Which series was missing an endpoint. */
  reason: string;
}

export interface InitialStateResult {
  state: SimulationState;
  /** ISO3 ids that had both a ladder and a GDP observation for `year`. */
  included: string[];
  /** Repo countries with no usable observation, and why. */
  dropped: DroppedCountry[];
}

function lookup(series: CountrySeries | undefined, id: string, year: number): number | undefined {
  const v = series?.[id]?.[String(year)];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/**
 * Build a SimulationState from real observations for `year`.
 *
 * - gdpPerCapita: taken from the actuals (constant 2015 US$), REPLACING the constants.ts value.
 * - wellbeing: the Cantril ladder for that year, scaled to 0-100.
 * - aiAdoption: 0 (the hindcast starts before measurable AI diffusion).
 * - population / governance / gini / archetype / corp relationships: kept from constants.ts,
 *   because no comparable panel exists in the fetched series.
 *
 * Countries missing either endpoint series are DROPPED, not imputed - never fabricate data.
 */
export function buildInitialStateFromActuals(
  year: number,
  actuals: HindcastActuals,
  countries: readonly HindcastCountryBase[] = INITIAL_COUNTRIES
): InitialStateResult {
  const countryData: Record<string, CountryStats> = {};
  const shadowCountryData: Record<string, CountryStats> = {};
  const included: string[] = [];
  const dropped: DroppedCountry[] = [];

  for (const base of countries) {
    const ladder = lookup(actuals.wellbeingLadder, base.id, year);
    const gdp = lookup(actuals.gdpPerCapita, base.id, year);

    if (ladder === undefined || gdp === undefined) {
      const missing: string[] = [];
      if (ladder === undefined) missing.push(`ladder ${year}`);
      if (gdp === undefined) missing.push(`gdpPerCapita ${year}`);
      dropped.push({ id: base.id, name: base.name, reason: `no ${missing.join(' and ')}` });
      continue;
    }

    const wellbeing = ladderToWellbeingIndex(ladder);
    const country: CountryStats = {
      ...base,
      gdpPerCapita: gdp,
      aiAdoption: 0,
      wellbeing,
      companiesJoined: 0,
      ubiReceivedGlobal: 0,
      ubiReceivedLocal: 0,
      ubiReceivedCustomerWeighted: 0,
      totalUbiReceived: 0,
      wellbeingTrend: [wellbeing]
    };

    countryData[base.id] = country;
    // The engine mutates both records in place, so the shadow must be its own deep-ish copy.
    shadowCountryData[base.id] = { ...country, wellbeingTrend: [wellbeing] };
    included.push(base.id);
  }

  const avgWellbeing = included.length > 0
    ? included.reduce((s, id) => s + countryData[id].wellbeing, 0) / included.length
    : 0;

  return {
    state: {
      month: 0,
      globalFund: 0,
      averageWellbeing: avgWellbeing,
      totalAiCompanies: INITIAL_CORPORATIONS.length,
      countryData,
      shadowCountryData,
      globalDisplacementGap: 0,
      corruptionLeakage: 0,
      countriesInCrisis: 0
    },
    included,
    dropped
  };
}

// ============================================================================
// RUNNING
// ============================================================================

/** Default engine parameters for the hindcast (mirrors validation/anchorTests.ts createModelParams). */
export function defaultHindcastParams(): ModelParameters {
  return {
    id: 'hindcast-model',
    name: 'Hindcast Model',
    description: 'Default engine parameters, used as the AI-on hindcast baseline',
    corporateTaxRate: 0.20,
    adoptionIncentive: 0.20,
    baseUBI: 300,
    aiGrowthRate: 0.08,
    volatility: 0.05,
    gdpScaling: 0.4,
    globalRedistributionRate: 0.3,
    displacementRate: 0.75,
    directToWalletEnabled: true,
    defaultCorpPolicy: 'mixed-reality',
    marketPressure: 0.5,
    // Macro block: gives the baseline economy dynamics of its own (GDP path, unemployment) and
    // lets wellbeing relax toward the level implied by GDP and governance, so the hindcast has a
    // non-trivial null model to score. wellbeingAnchorRate 0.02/month ~ 3-year half-life.
    macro: { ...DEFAULT_MACRO, wellbeingAnchorRate: 0.02 }
  };
}

export interface HindcastOptions {
  actuals: HindcastActuals;
  fromYear: number;
  toYear: number;
  /**
   * true  -> aiGrowthRate 0, starting adoption 0 and (unless `corpContributionRate` says
   *          otherwise) every corporation contributing 0%: no displacement, no UBI.
   * false -> `params` as given (default: defaultHindcastParams()).
   */
  aiOff: boolean;
  params?: ModelParameters;
  /**
   * Override every corporation's contributionRate (0-0.5), winning over the aiOff default.
   * Pass `null` to explicitly KEEP each corporation's configured rate even when aiOff is
   * true - that isolates the UBI channel from the displacement channel.
   */
  corpContributionRate?: number | null;
  countries?: readonly HindcastCountryBase[];
  corporations?: readonly Corporation[];
  /** Months per simulated year. 12 unless you are testing. */
  monthsPerYear?: number;
  /** Report label. Defaults to "AI off" / "AI on". */
  label?: string;
}

/** Predicted vs actual for one country over the whole span. */
export interface HindcastCountryResult {
  id: string;
  name: string;
  /** 0-100 index (ladder x 10). */
  actualWellbeingStart: number;
  actualWellbeingEnd: number;
  actualWellbeingChange: number;
  predictedWellbeingStart: number;
  predictedWellbeingEnd: number;
  predictedWellbeingChange: number;
  wellbeingError: number;
  /** constant 2015 US$. */
  actualGdpStart: number;
  actualGdpEnd: number;
  actualGdpGrowthPct: number;
  predictedGdpStart: number;
  predictedGdpEnd: number;
  predictedGdpGrowthPct: number;
  gdpGrowthErrorPct: number;
  /** 0-100 index, one entry per simulated year (fromYear..toYear). */
  predictedWellbeingSeries: number[];
  /** 0-100 index or null where the year was not observed. */
  actualWellbeingSeries: Array<number | null>;
  predictedGdpSeries: number[];
  actualGdpSeries: Array<number | null>;
  predictedAiAdoptionEnd: number;
}

export interface HindcastScore {
  /** Pearson r between predicted and actual wellbeing CHANGE across countries. 0 if undefined. */
  corrWellbeingChange: number;
  /** Mean |predicted - actual| final wellbeing, in 0-100 index points (= ladder points x 10). */
  maeWellbeing: number;
  /** Pearson r between predicted and actual GDP-per-capita growth across countries. 0 if undefined. */
  corrGdpGrowth: number;
  /** Mean |predicted - actual| GDP growth over the span, in percentage points. */
  maeGdpGrowthPct: number;
  nCountries: number;
}

export interface HindcastRun {
  label: string;
  fromYear: number;
  toYear: number;
  monthsRun: number;
  aiOff: boolean;
  params: ModelParameters;
  corpContributionRate: number | null;
  years: number[];
  countries: HindcastCountryResult[];
  score: HindcastScore;
  /** Repo countries with no usable 2015 observation. */
  dropped: DroppedCountry[];
  /** Countries initialised but dropped from scoring for want of an end-year observation. */
  droppedAtEnd: DroppedCountry[];
  /** Diagnostics that make a degenerate score readable instead of mysterious. */
  diagnostics: {
    predictedWellbeingChangeVariance: number;
    predictedGdpGrowthVariance: number;
    meanPredictedAiAdoptionEnd: number;
    /** simulation/pure.ts never writes country.gdpPerCapita, so this is expected to be true. */
    gdpIsStatic: boolean;
  };
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * Run the pure engine from `fromYear` actuals to `toYear` and score it against actuals.
 */
export function runHindcast(options: HindcastOptions): HindcastRun {
  const {
    actuals,
    fromYear,
    toYear,
    aiOff,
    countries = INITIAL_COUNTRIES,
    corporations = INITIAL_CORPORATIONS,
    monthsPerYear = 12
  } = options;

  if (toYear <= fromYear) throw new Error(`toYear (${toYear}) must be after fromYear (${fromYear})`);

  const params: ModelParameters = {
    ...(options.params ?? defaultHindcastParams()),
    ...(aiOff ? { aiGrowthRate: 0 } : {})
  };

  const corpRate = options.corpContributionRate !== undefined
    ? options.corpContributionRate
    : (aiOff ? 0 : null);
  let corps: Corporation[] = corporations.map(c => ({
    ...clone(c),
    ...(corpRate !== null ? { contributionRate: corpRate } : {})
  }));

  const { state: initialState, included, dropped } = buildInitialStateFromActuals(fromYear, actuals, countries);

  const years: number[] = [];
  for (let y = fromYear; y <= toYear; y++) years.push(y);

  // Snapshot per year: index 0 is the initial (fromYear) state, index k is after k*12 months.
  const wellbeingByYear: Record<string, number[]> = {};
  const gdpByYear: Record<string, number[]> = {};
  const record = (state: SimulationState) => {
    for (const id of included) {
      const c = state.countryData[id];
      (wellbeingByYear[id] ||= []).push(c.wellbeing);
      (gdpByYear[id] ||= []).push(c.gdpPerCapita);
    }
  };

  let state = initialState;
  record(state);

  const monthsRun = (toYear - fromYear) * monthsPerYear;
  for (let m = 0; m < monthsRun; m++) {
    const input: SimulationInput = { state, corporations: corps, model: params };
    const out = stepSimulationPure(input);
    state = out.state;
    corps = out.corporations;
    if ((m + 1) % monthsPerYear === 0) record(state);
  }

  // ---- score ----
  const results: HindcastCountryResult[] = [];
  const droppedAtEnd: DroppedCountry[] = [];
  const nameOf = new Map<string, string>(countries.map(c => [c.id, c.name] as [string, string]));

  for (const id of included) {
    const ladderEnd = lookup(actuals.wellbeingLadder, id, toYear);
    const gdpEnd = lookup(actuals.gdpPerCapita, id, toYear);
    const ladderStart = lookup(actuals.wellbeingLadder, id, fromYear)!;
    const gdpStart = lookup(actuals.gdpPerCapita, id, fromYear)!;

    if (ladderEnd === undefined || gdpEnd === undefined) {
      const missing: string[] = [];
      if (ladderEnd === undefined) missing.push(`ladder ${toYear}`);
      if (gdpEnd === undefined) missing.push(`gdpPerCapita ${toYear}`);
      droppedAtEnd.push({ id, name: nameOf.get(id) ?? id, reason: `no ${missing.join(' and ')}` });
      continue;
    }

    const predW = wellbeingByYear[id];
    const predG = gdpByYear[id];
    const actualWellbeingStart = ladderToWellbeingIndex(ladderStart);
    const actualWellbeingEnd = ladderToWellbeingIndex(ladderEnd);
    const predictedWellbeingStart = predW[0];
    const predictedWellbeingEnd = predW[predW.length - 1];
    const predictedGdpStart = predG[0];
    const predictedGdpEnd = predG[predG.length - 1];

    const actualGdpGrowthPct = (gdpEnd / gdpStart - 1) * 100;
    const predictedGdpGrowthPct = (predictedGdpEnd / predictedGdpStart - 1) * 100;

    results.push({
      id,
      name: nameOf.get(id) ?? id,
      actualWellbeingStart,
      actualWellbeingEnd,
      actualWellbeingChange: actualWellbeingEnd - actualWellbeingStart,
      predictedWellbeingStart,
      predictedWellbeingEnd,
      predictedWellbeingChange: predictedWellbeingEnd - predictedWellbeingStart,
      wellbeingError: predictedWellbeingEnd - actualWellbeingEnd,
      actualGdpStart: gdpStart,
      actualGdpEnd: gdpEnd,
      actualGdpGrowthPct,
      predictedGdpStart,
      predictedGdpEnd,
      predictedGdpGrowthPct,
      gdpGrowthErrorPct: predictedGdpGrowthPct - actualGdpGrowthPct,
      predictedWellbeingSeries: predW.slice(),
      actualWellbeingSeries: years.map(y => {
        const l = lookup(actuals.wellbeingLadder, id, y);
        return l === undefined ? null : ladderToWellbeingIndex(l);
      }),
      predictedGdpSeries: predG.slice(),
      actualGdpSeries: years.map(y => lookup(actuals.gdpPerCapita, id, y) ?? null),
      predictedAiAdoptionEnd: state.countryData[id].aiAdoption
    });
  }

  const score = scoreHindcast(results);

  return {
    label: options.label ?? (aiOff ? 'AI off' : 'AI on'),
    fromYear,
    toYear,
    monthsRun,
    aiOff,
    params,
    corpContributionRate: corpRate,
    years,
    countries: results,
    score,
    dropped,
    droppedAtEnd,
    diagnostics: {
      predictedWellbeingChangeVariance: variance(results.map(r => r.predictedWellbeingChange)),
      predictedGdpGrowthVariance: variance(results.map(r => r.predictedGdpGrowthPct)),
      meanPredictedAiAdoptionEnd: mean(results.map(r => r.predictedAiAdoptionEnd)),
      gdpIsStatic: results.every(r => Math.abs(r.predictedGdpGrowthPct) < 1e-9)
    }
  };
}

// ============================================================================
// SCORING
// ============================================================================

export function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length;
}

/**
 * Pearson correlation. Returns 0 when either side has no variance - which happens
 * whenever the engine predicts an identical change for every country (see the
 * `diagnostics` on a run before reading a 0 as "uncorrelated").
 */
export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return 0;
  const r = sxy / Math.sqrt(sxx * syy);
  return Number.isFinite(r) ? r : 0;
}

export function scoreHindcast(results: readonly HindcastCountryResult[]): HindcastScore {
  const rs = results.slice();
  return {
    corrWellbeingChange: pearson(
      rs.map(r => r.predictedWellbeingChange),
      rs.map(r => r.actualWellbeingChange)
    ),
    maeWellbeing: mean(rs.map(r => Math.abs(r.wellbeingError))),
    corrGdpGrowth: pearson(
      rs.map(r => r.predictedGdpGrowthPct),
      rs.map(r => r.actualGdpGrowthPct)
    ),
    maeGdpGrowthPct: mean(rs.map(r => Math.abs(r.gdpGrowthErrorPct))),
    nCountries: rs.length
  };
}

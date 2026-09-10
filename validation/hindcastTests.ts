/**
 * Hindcast anchor tests (HC-1, HC-2).
 *
 * Same result shape as validation/anchorTests.ts (AnchorTestResult), so a UI or CLI can
 * render them next to AT-1..AT-6 without a second code path. They are kept in their own
 * module because they need the fetched data/hindcast/*.json series, which the six
 * built-in anchor tests do not.
 *
 * Both thresholds are PLACEHOLDERS from the design doc, to be reset after the first run.
 * The design predicted the first run would fail, and it does; that is the useful
 * information, so nothing here is tuned to make the tests pass.
 *
 * The scored run is the AI-OFF one. A hindcast of 2015-2025 cannot validate the AI
 * displacement channel (AI's macro effect over that decade is dwarfed by COVID, war and
 * inflation) - it validates the baseline economy and the wellbeing coefficients.
 */

import type { AnchorTestResult } from './anchorTests';
import {
  runHindcast,
  HindcastActuals,
  HindcastRun,
  HindcastOptions,
  LADDER_TO_INDEX_SCALE
} from './hindcast';

/** HC-1: Pearson r between predicted and actual 2015-2025 wellbeing change. */
export const HC1_CORR_THRESHOLD = 0.5;

/**
 * HC-2: mean absolute error of final wellbeing.
 * The design states 0.6 ladder points; the engine's index is the ladder x 10, so the
 * threshold in index points is 6.0.
 */
export const HC2_MAE_LADDER_THRESHOLD = 0.6;
export const HC2_MAE_THRESHOLD = HC2_MAE_LADDER_THRESHOLD * LADDER_TO_INDEX_SCALE;

export const HINDCAST_FROM_YEAR = 2015;
export const HINDCAST_TO_YEAR = 2025;

export interface HindcastTestOptions {
  actuals: HindcastActuals;
  fromYear?: number;
  toYear?: number;
  /** Reuse an already-computed AI-off run instead of running the engine again. */
  run?: HindcastRun;
  /** Extra knobs forwarded to runHindcast (countries/corporations/params, for tests). */
  overrides?: Partial<Omit<HindcastOptions, 'actuals' | 'fromYear' | 'toYear' | 'aiOff'>>;
}

function resolveRun(options: HindcastTestOptions): HindcastRun {
  if (options.run) return options.run;
  return runHindcast({
    actuals: options.actuals,
    fromYear: options.fromYear ?? HINDCAST_FROM_YEAR,
    toYear: options.toYear ?? HINDCAST_TO_YEAR,
    aiOff: true,
    ...options.overrides
  });
}

function degenerateNote(run: HindcastRun): string {
  return run.diagnostics.predictedWellbeingChangeVariance < 1e-12
    ? ' (the engine predicted an IDENTICAL change for every country, so the correlation is undefined and reported as 0)'
    : '';
}

/** HC-1: does the model rank countries' wellbeing trajectories correctly? */
export function runHc1(options: HindcastTestOptions): AnchorTestResult {
  const run = resolveRun(options);
  const r = run.score.corrWellbeingChange;
  const passed = r >= HC1_CORR_THRESHOLD;

  return {
    testId: 'HC-1',
    testName: `Hindcast wellbeing-change correlation (${run.fromYear}-${run.toYear}, ${run.label})`,
    category: 'consistency',
    passed,
    reason: passed
      ? `Predicted vs actual wellbeing change correlates at r=${r.toFixed(3)} across ${run.score.nCountries} countries`
      : `Predicted vs actual wellbeing change correlates at only r=${r.toFixed(3)} across ${run.score.nCountries} countries (need >= ${HC1_CORR_THRESHOLD})${degenerateNote(run)}`,
    details: {
      expected: `>= ${HC1_CORR_THRESHOLD}`,
      actual: `r = ${r.toFixed(4)}`,
      metrics: {
        corrWellbeingChange: r,
        nCountries: run.score.nCountries,
        predictedChangeVariance: run.diagnostics.predictedWellbeingChangeVariance,
        monthsRun: run.monthsRun
      }
    }
  };
}

/**
 * A near-zero predicted change means the engine passed by refusing to move, i.e. it tied
 * the trivial "nothing changes" null model rather than beating it. Say so in the reason.
 */
function nullModelNote(run: HindcastRun): string {
  const meanAbsPredictedChange = run.countries.length === 0
    ? 0
    : run.countries.reduce((s, c) => s + Math.abs(c.predictedWellbeingChange), 0) / run.countries.length;
  return meanAbsPredictedChange < 0.5
    ? ' - but the engine moved wellbeing by only ' +
      `${meanAbsPredictedChange.toFixed(3)} index points on average, so this merely ties the ` +
      '"nothing ever changes" null model rather than beating it'
    : '';
}

/** HC-2: is the model's absolute wellbeing level right at the end of the span? */
export function runHc2(options: HindcastTestOptions): AnchorTestResult {
  const run = resolveRun(options);
  const mae = run.score.maeWellbeing;
  const passed = mae <= HC2_MAE_THRESHOLD;

  return {
    testId: 'HC-2',
    testName: `Hindcast wellbeing MAE (${run.fromYear}-${run.toYear}, ${run.label})`,
    category: 'consistency',
    passed,
    reason: passed
      ? `Mean absolute wellbeing error ${mae.toFixed(2)} index points (${(mae / LADDER_TO_INDEX_SCALE).toFixed(3)} ladder points) across ${run.score.nCountries} countries${nullModelNote(run)}`
      : `Mean absolute wellbeing error ${mae.toFixed(2)} index points (${(mae / LADDER_TO_INDEX_SCALE).toFixed(3)} ladder points) exceeds the ${HC2_MAE_THRESHOLD} index-point (${HC2_MAE_LADDER_THRESHOLD} ladder-point) budget across ${run.score.nCountries} countries`,
    details: {
      expected: `<= ${HC2_MAE_THRESHOLD} index points (${HC2_MAE_LADDER_THRESHOLD} ladder points)`,
      actual: `${mae.toFixed(4)} index points (${(mae / LADDER_TO_INDEX_SCALE).toFixed(4)} ladder points)`,
      metrics: {
        maeWellbeing: mae,
        maeWellbeingLadder: mae / LADDER_TO_INDEX_SCALE,
        nCountries: run.score.nCountries,
        monthsRun: run.monthsRun
      }
    }
  };
}

/** Both hindcast tests against a single AI-off run. */
export function runHindcastTests(options: HindcastTestOptions): AnchorTestResult[] {
  const run = resolveRun(options);
  const withRun: HindcastTestOptions = { ...options, run };
  return [runHc1(withRun), runHc2(withRun)];
}

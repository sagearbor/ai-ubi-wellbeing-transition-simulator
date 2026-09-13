#!/usr/bin/env tsx
/**
 * Hindcast CLI.
 *
 * Loads data/hindcast/*.json (fetch them first with scripts/hindcast/fetch-actuals.ts),
 * runs the pure engine from 2015 actuals to 2025 with AI off and with AI on, scores both
 * against the observed series, and prints the report plus the two hindcast anchor tests.
 *
 * Usage:
 *   npx tsx scripts/hindcast/run-hindcast.ts
 *   npx tsx scripts/hindcast/run-hindcast.ts --json
 *   npx tsx scripts/hindcast/run-hindcast.ts --from 2015 --to 2024 --worst 20
 *
 * Exit code is 0 even when the anchor tests fail: the first-run failure IS the finding,
 * and this script is a report, not a gate. Use --strict to exit non-zero on failure.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INITIAL_COUNTRIES } from '../../constants';
import {
  runHindcast,
  HindcastActuals,
  HindcastRun,
  HindcastSeriesFile,
  LADDER_TO_INDEX_SCALE
} from '../../validation/hindcast';
import { runHindcastTests, HC1_CORR_THRESHOLD, HC2_MAE_THRESHOLD } from '../../validation/hindcastTests';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', '..', 'data', 'hindcast');

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = Number(process.argv[i + 1]);
  return Number.isFinite(v) ? v : fallback;
}

const AS_JSON = process.argv.includes('--json');
const STRICT = process.argv.includes('--strict');
const FROM_YEAR = arg('from', 2015);
const TO_YEAR = arg('to', 2025);
const WORST = arg('worst', 10);

function loadSeries(file: string): HindcastSeriesFile {
  const path = join(DATA_DIR, file);
  if (!existsSync(path)) {
    console.error(
      `Missing ${path}.\nRun: npx tsx scripts/hindcast/fetch-actuals.ts`
    );
    process.exit(2);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as HindcastSeriesFile;
}

const ladder = loadSeries('wellbeing-ladder.json');
const gdp = loadSeries('gdp-per-capita.json');
const unemployment = existsSync(join(DATA_DIR, 'unemployment.json'))
  ? loadSeries('unemployment.json')
  : undefined;

const actuals: HindcastActuals = {
  wellbeingLadder: ladder.data,
  gdpPerCapita: gdp.data,
  unemployment: unemployment?.data
};

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

const base = { actuals, fromYear: FROM_YEAR, toYear: TO_YEAR } as const;

/** Headline: no displacement channel and no corporate UBI channel. */
const aiOff: HindcastRun = runHindcast({ ...base, aiOff: true });

/**
 * Diagnostic middle case: AI adoption pinned at 0 (no displacement friction) but the
 * corporations still pay their default UBI contributions - isolates how much of the
 * AI-on trajectory is the UBI channel rather than the displacement channel.
 */
const aiOffUbiOn: HindcastRun = runHindcast({
  ...base,
  aiOff: true,
  corpContributionRate: null, // keep the rates configured in constants.ts
  label: 'AI off, UBI on'
});

/** Default parameters, adoption free to grow from 0. */
const aiOn: HindcastRun = runHindcast({ ...base, aiOff: false });

const tests = runHindcastTests({ actuals, fromYear: FROM_YEAR, toYear: TO_YEAR, run: aiOff });

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const matchedIds = new Set(aiOff.countries.map(c => c.id));
const unmatched = INITIAL_COUNTRIES.filter(c => !matchedIds.has(c.id));
/** Repo ids with no row at all in a source (as opposed to a missing endpoint year). */
const absentFromLadder = INITIAL_COUNTRIES.filter(c => !ladder.data[c.id]).map(c => c.id);
const absentFromGdp = INITIAL_COUNTRIES.filter(c => !gdp.data[c.id]).map(c => c.id);

if (AS_JSON) {
  console.log(JSON.stringify({
    fromYear: FROM_YEAR,
    toYear: TO_YEAR,
    sources: {
      wellbeingLadder: ladder.source,
      gdpPerCapita: gdp.source,
      unemployment: unemployment?.source
    },
    coverage: {
      repoCountries: INITIAL_COUNTRIES.length,
      scored: aiOff.score.nCountries,
      unmatched: unmatched.map(c => ({ id: c.id, name: c.name })),
      absentFromLadder,
      absentFromGdp
    },
    runs: {
      'ai-off': aiOff,
      'ai-off-ubi-on': aiOffUbiOn,
      'ai-on': aiOn
    },
    tests
  }, null, 2));
} else {
  const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

  console.log(`Hindcast ${FROM_YEAR} -> ${TO_YEAR} against simulation/pure.ts\n`);
  console.log('Data');
  console.log(`  wellbeing  ${ladder.source.name}`);
  console.log(`             ${ladder.units}, retrieved ${ladder.source.retrievedAt}, ${ladder.rowCount} rows / ${ladder.countryCount} countries`);
  console.log(`  gdp        ${gdp.source.name}`);
  console.log(`             ${gdp.units}, retrieved ${gdp.source.retrievedAt}, ${gdp.rowCount} rows / ${gdp.countryCount} countries`);
  if (unemployment) {
    console.log(`  unemp      ${unemployment.source.name} (fetched, not scored - the engine has no unemployment state)`);
  }

  console.log('\nCoverage');
  console.log(`  ${aiOff.score.nCountries} of ${INITIAL_COUNTRIES.length} repo countries scored ` +
    `(need both a ${FROM_YEAR} and a ${TO_YEAR} observation in both series)`);
  console.log(`  dropped at ${FROM_YEAR}: ${aiOff.dropped.length}${aiOff.dropped.length ? ' -> ' + aiOff.dropped.map(d => `${d.id} (${d.reason})`).join(', ') : ''}`);
  console.log(`  dropped at ${TO_YEAR}:   ${aiOff.droppedAtEnd.length}${aiOff.droppedAtEnd.length ? ' -> ' + aiOff.droppedAtEnd.map(d => `${d.id} (${d.reason})`).join(', ') : ''}`);
  console.log(`  repo ids with NO row at all in the ladder series: ${absentFromLadder.join(', ') || 'none'}`);
  console.log(`  repo ids with NO row at all in the gdp series:    ${absentFromGdp.join(', ') || 'none'}`);

  console.log('\nScores (wellbeing in 0-100 index points; ladder points x 10)');
  const header = ['run', 'corr dWB', 'MAE WB', 'MAE (ladder)', 'corr dGDP', 'MAE GDP %', 'n'];
  const rows = [aiOff, aiOffUbiOn, aiOn].map(r => [
    r.label,
    r.score.corrWellbeingChange.toFixed(3),
    r.score.maeWellbeing.toFixed(2),
    (r.score.maeWellbeing / LADDER_TO_INDEX_SCALE).toFixed(3),
    r.score.corrGdpGrowth.toFixed(3),
    r.score.maeGdpGrowthPct.toFixed(2),
    String(r.score.nCountries)
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map(r => r[i].length)));
  const line = (cells: string[]) => '  ' + cells.map((c, i) => c.padEnd(widths[i])).join('  ');
  console.log(line(header));
  console.log(line(widths.map(w => '-'.repeat(w))));
  for (const r of rows) console.log(line(r));

  for (const r of [aiOff, aiOffUbiOn, aiOn]) {
    console.log(`\n${r.label}: ${r.monthsRun} monthly steps, aiGrowthRate=${r.params.aiGrowthRate}, ` +
      `corp contributionRate=${r.corpContributionRate === null ? 'as configured in constants.ts' : r.corpContributionRate}`);
    console.log(`  mean predicted wellbeing change: ${mean(r.countries.map(c => c.predictedWellbeingChange)).toFixed(2)} index pts ` +
      `(actual ${mean(r.countries.map(c => c.actualWellbeingChange)).toFixed(2)})`);
    console.log(`  variance of predicted wellbeing change across countries: ${r.diagnostics.predictedWellbeingChangeVariance.toExponential(2)}`);
    console.log(`  mean predicted AI adoption at ${TO_YEAR}: ${(r.diagnostics.meanPredictedAiAdoptionEnd * 100).toFixed(1)}%`);
    console.log(`  predicted GDP per capita is static: ${r.diagnostics.gdpIsStatic} ` +
      `(mean actual growth over the span ${pct(mean(r.countries.map(c => c.actualGdpGrowthPct)))})`);
  }

  console.log(`\nWorst ${WORST} wellbeing errors (${aiOff.label} run)`);
  const worst = aiOff.countries.slice().sort((a, b) => Math.abs(b.wellbeingError) - Math.abs(a.wellbeingError)).slice(0, WORST);
  console.log('  id   country                    actual ' + FROM_YEAR + '  actual ' + TO_YEAR + '  predicted ' + TO_YEAR + '   error');
  for (const c of worst) {
    console.log(
      `  ${c.id}  ${c.name.slice(0, 24).padEnd(24)}  ${c.actualWellbeingStart.toFixed(1).padStart(11)}  ` +
      `${c.actualWellbeingEnd.toFixed(1).padStart(11)}  ${c.predictedWellbeingEnd.toFixed(1).padStart(14)}  ` +
      `${(c.wellbeingError >= 0 ? '+' : '') + c.wellbeingError.toFixed(1)}`
    );
  }

  console.log(`\nHindcast anchor tests (scored on the "${aiOff.label}" run; thresholds are design-doc placeholders)`);
  for (const t of tests) {
    console.log(`[${t.passed ? 'PASS' : 'FAIL'}] ${t.testId} ${t.testName}`);
    console.log(`       ${t.reason}`);
    if (t.details) {
      console.log(`       expected: ${t.details.expected}`);
      console.log(`       actual:   ${t.details.actual}`);
    }
  }
  console.log(`\nThresholds: HC-1 r >= ${HC1_CORR_THRESHOLD}, HC-2 MAE <= ${HC2_MAE_THRESHOLD} index points.`);
  console.log('Caveat: a 2015-2025 hindcast cannot validate the AI displacement channel (COVID, war and');
  console.log('inflation dominate the decade). It validates the baseline economy and the wellbeing coefficients.');
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

const failed = tests.filter(t => !t.passed).length;
process.exit(STRICT && failed > 0 ? 1 : 0);

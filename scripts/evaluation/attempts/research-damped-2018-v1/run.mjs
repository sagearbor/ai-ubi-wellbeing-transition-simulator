/** Fixed-input runner: never opens outcomes, full panels, old predictions or scores. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {fitAndPredict} from './model.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const ID = 'research-damped-2018-v1';
const REGISTERED = '7d40306fdf677d756042e75ca2fa56afc839c5fe';
const DIR = `data/evaluation/${ID}`;
const SCRIPT_DIR = `scripts/evaluation/attempts/${ID}`;
const NOTE = `docs/design/research/2026-09-16-${ID}.md`;
const ENTRY = `docs/design/research/entries/${ID}.json`;
const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--verify'), 'Only --verify is supported');
const verify = args[0] === '--verify';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = relative => fs.readFileSync(path.join(ROOT, relative));
const protocolBytes = read(`${DIR}/protocol.json`);
const registeredProtocol = execFileSync('git', ['show', `${REGISTERED}:${DIR}/protocol.json`], {cwd: ROOT});
assert.equal(sha256(protocolBytes), sha256(registeredProtocol), 'Registered protocol changed');
const protocol = JSON.parse(protocolBytes);
const inputBytes = Object.fromEntries(protocol.inputFiles.map(input => {
  assert.ok(['data/evaluation/level-holdout-2018/train.json', 'data/evaluation/level-holdout-2018/origin.json'].includes(input.path));
  const bytes = read(input.path);
  assert.equal(sha256(bytes), input.sha256, 'Frozen input hash mismatch');
  return [path.basename(input.path), bytes];
}));
const train = JSON.parse(inputBytes['train.json']);
const origin = JSON.parse(inputBytes['origin.json']);
assert.equal(train.countries.length, 101);
assert.equal(origin.countries.length, 100);
assert.equal(origin.excluded.length, 28);
const pairs = train.countries.flatMap(country => train.years.filter(year => train.ladder[country.id]?.[year] !== undefined && train.gdp[country.id]?.[year] !== undefined).map(year => `${country.id}:${year}`));
assert.equal(pairs.length, 399);
const result = fitAndPredict(train, origin, protocol);
assert.equal(result.predictions.rows.length, 700);
assert.equal(new Set(result.predictions.rows.map(row => `${row.id}:${row.year}`)).size, 700);
const ladder = result.internalValidation.outcomes.ladder;
const gdp = result.internalValidation.outcomes.gdp;
const fixed = value => value === null ? 'undefined' : value.toFixed(8);
const candidateDescription = outcome => `${outcome.selectedCandidate.target} target, country weight ${outcome.selectedCandidate.countryWeight}, damping ${outcome.selectedCandidate.damping}`;
const note = `# Registered damped country trend attempt\n\nExternal result: **pending the controller’s family freeze and single heldout scoring call**. No heldout data, previous country errors, or future country features were read by this entry. Predictions are frozen for all 100 origin countries and seven years (700 rows). This is retrospective automated-agent research; the known aggregate prior miss and later-vintage historical inputs prevent a blinded or archived-as-of-2018 claim.\n\n## Method and primary question\n\nFor ladder and natural-log GDP separately, estimate each country’s ordinary least-squares slope using observed 2015–2018 calendar years. Anchor forecasts at the exact 2018 observation. Shrink the slope toward zero or the equal-country mean slope, then multiply it by the cumulative damping sum. Forecast GDP is never a ladder predictor, so neither equation asserts that GDP causes wellbeing.\n\nThe primary external comparison will be 2025 ladder mean absolute error (MAE), against persistence with identical observed-country masks. Pooled 2019–2025 MAE is a separate secondary statistic. GDP error is cumulative growth error in percentage points relative to origin GDP. The controller must also publish every horizon and origin-income quartile; sort 2018 GDP then id and take floor(index*4/100). All 28 frozen roster exclusions remain in the protocol.\n\nThe registered protocol is [protocol.json](../../../data/evaluation/${ID}/protocol.json), committed as ${REGISTERED} before any fit or validation execution. There were no protocol amendments. The finite search has 30 nominal triples per outcome (25 generic forecast forms including explicit duplicates), with a predeclared deterministic tie rule.\n\n## Training-only internal selection\n\nThe first fold trains on 2015–2016 and predicts 2017 and 2018; the second trains on 2015–2017 and predicts 2018. Country slopes and pooled slopes are recomputed from each fold’s past. Selection minimizes pooled ladder MAE or GDP cumulative growth MAE, independently. Country reuse and repeated 2018 targets create dependence. These selected errors are optimistic internal estimates and cannot establish seven-year accuracy.\n\n| Outcome | Selected rule | Valid internal records | Selected MAE | Persistence MAE | Difference |\n| --- | --- | ---: | ---: | ---: | ---: |\n| Ladder, points | ${candidateDescription(ladder)} | ${ladder.selectedPooledMetrics.count} | ${fixed(ladder.selectedPooledMetrics.mae)} | ${fixed(ladder.selectedPooledMetrics.persistenceMae)} | ${fixed(ladder.selectedPooledMetrics.deltaMae)} |\n| GDP growth, percentage points | ${candidateDescription(gdp)} | ${gdp.selectedPooledMetrics.count} | ${fixed(gdp.selectedPooledMetrics.mae)} | ${fixed(gdp.selectedPooledMetrics.persistenceMae)} | ${fixed(gdp.selectedPooledMetrics.deltaMae)} |\n\nEvery candidate, skipped internal pair, per-fold and per-horizon score, and clamp is preserved in internal-validation.json. Full calibration retains the transformed observations, sample sizes, country slopes, pooled slopes, and selected settings for both outcomes. Numerical provenance records the calculation for every country/year/outcome.\n\n## Range handling and coverage\n\nLadder forecasts are clamped to 0–10 after trend extrapolation. The selected final forecast produced ${result.diagnostics.clampCount} clamps, listed with raw values in numerical-provenance.json. GDP uses exponentiation without growth caps or bias correction; invalid output fails generation. Missing trend data use the predeclared target slope, without dropping any final origin country. All 399 paired training rows and 101 background countries are retained as available. Only 100 have frozen valid 2018 origin outcomes.\n\n## Evidence and limits\n\n[Hyndman and Athanasopoulos, methods with trend](https://otexts.com/fpp3/holt.html) describes gradually diminishing trend contributions. This entry uses that forecast shape and its cited practical damping range; country OLS slopes and cross-country shrinkage are our declared simplification, not an estimated Holt state-space model. [Their time-series cross-validation chapter](https://otexts.com/fpp3/tscv.html) motivates predicting later observations from earlier data and evaluating relevant horizons.\n\nOnly four annual observations are available per complete country. Global shrinkage is selected from two short origins, with no independent-country validation, no uncertainty intervals, and no direct evidence for the seven-year endpoint. The inherited panel may contain later revisions and annual-label interpretation issues; no source vintage was repaired. Long-lived structural changes are not forecast. Both outcomes flatten asymptotically; this can understate long-run economic growth. No result has yet established superiority to persistence. All five alternatives must be published regardless of sign; picking the best remains exploratory.\n\n## Reproduction and checks\n\nRun from the repository root, using the supplied Node 22 executable and no added packages:\n\n\`\`\`sh\n/private/tmp/history-node22/package/bin/node --test scripts/evaluation/attempts/${ID}/model.node-test.mjs\n/private/tmp/history-node22/package/bin/node scripts/evaluation/attempts/${ID}/run.mjs --verify\n\`\`\`\n\nThe first command uses synthetic and permitted training/origin fixtures only. The second reconstructs every entry artifact in memory and checks exact bytes against the frozen files. The fixed runner reads only the registered train/origin inputs, its own protocol/code/test files, and its own output files during verification. Full repository checks and heldout scoring belong to the controller after the family freeze gate.\n`;
const entry = {schema: 'forecast-research-entry/1', id: ID, familyId: protocol.familyId, branch: 'codex/research-damped-20260916',
  status: 'predictions-frozen-awaiting-controller-score', protocolCommit: REGISTERED, protocol: `${DIR}/protocol.json`,
  predictions: `${DIR}/predictions.json`, calibration: `${DIR}/calibration.json`, internalValidation: `${DIR}/internal-validation.json`,
  provenance: `${DIR}/provenance.json`, numericalProvenance: `${DIR}/numerical-provenance.json`, note: NOTE,
  externalScoreStatus: 'pending-controller-family-freeze', authorship: 'Automated research agent; no independent human review',
  counts: {trainingBackgroundCountries: 101, pairedTrainingRows: 399, originCountries: 100, excludedCountries: 28, predictionRows: 700},
  primaryComparison: '2025 ladder MAE versus persistence, common observed mask', amendments: []};
const encode = value => JSON.stringify(value, null, 2) + '\n';
const outputs = new Map([
  [`${DIR}/predictions.json`, encode(result.predictions)], [`${DIR}/calibration.json`, encode(result.calibration)],
  [`${DIR}/internal-validation.json`, encode(result.internalValidation)],
  [`${DIR}/numerical-provenance.json`, encode({schema: 'damped-numerical-provenance/1', entryId: ID, ...result.diagnostics})],
  [NOTE, note], [ENTRY, encode(entry)]
]);
const provenance = {schema: 'forecast-provenance/1', entryId: ID, registeredProtocolCommit: REGISTERED,
  baseCommit: '0ca2eda3ea5db518499abebda1de1367d4e1ab7e', protocolSha256: sha256(protocolBytes),
  runtime: {node: process.version, numericalPrecision: 'JavaScript IEEE-754 binary64; JSON decimal serialization', packagesAdded: []},
  inputs: protocol.inputFiles, code: ['model.mjs', 'run.mjs', 'model.node-test.mjs', 'registered.test.ts'].map(name => ({path: `${SCRIPT_DIR}/${name}`, sha256: sha256(read(`${SCRIPT_DIR}/${name}`))})),
  outputHashes: [...outputs].map(([relative, content]) => ({path: relative, sha256: sha256(content)})),
  sourceReferences: protocol.sources, boundary: {numericalInputYears: [2015, 2016, 2017, 2018], heldoutRead: false, heldoutScored: false,
    gate: 'All five approaches plus long-run protocol/predictions must freeze before controller scores any entry'},
  reproduction: 'No random numbers, date-dependent output, environment-dependent settings, or network reads; --verify compares exact bytes.'};
outputs.set(`${DIR}/provenance.json`, encode(provenance));
for (const [relative, content] of outputs) {
  if (verify) assert.equal(read(relative).toString(), content, `Artifact differs: ${relative}`);
  else fs.writeFileSync(path.join(ROOT, relative), content);
}
console.log(JSON.stringify({mode: verify ? 'verified' : 'generated', entryId: ID, predictionRows: 700, clampCount: result.diagnostics.clampCount,
  ladder: {candidate: ladder.selectedCandidate, internal: ladder.selectedPooledMetrics}, gdp: {candidate: gdp.selectedCandidate, internal: gdp.selectedPooledMetrics}, externalResult: 'pending'}, null, 2));

/** Reads only the two allowlisted historical inputs and the registered protocol. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { fit, predict, validate, LAMBDAS } from './model.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const entry = 'research-changes-2018-v1';
const out = path.join(root, 'data/evaluation', entry);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const protocolBytes = fs.readFileSync(path.join(out, 'protocol.json'));
const protocol = JSON.parse(protocolBytes);
const protocolCommit = execFileSync('git', ['log', '-1', '--format=%H', '--', `data/evaluation/${entry}/protocol.json`], { cwd: root, encoding: 'utf8' }).trim();
if (!protocolCommit || protocol.id !== entry || protocol.schema !== 'forecast-protocol/1') throw Error('Protocol must be committed before fitting');
const committedProtocol = execFileSync('git', ['show', `${protocolCommit}:data/evaluation/${entry}/protocol.json`], { cwd: root });
if (sha(protocolBytes) !== sha(committedProtocol)) throw Error('Uncommitted protocol amendment');
if (JSON.stringify(protocol.fit.candidateGrid.lambda) !== JSON.stringify(LAMBDAS)) throw Error('Protocol grid mismatch');
const inputs = ['train', 'origin'].map(name => {
  const relative = `data/evaluation/level-holdout-2018/${name}.json`;
  const bytes = fs.readFileSync(path.join(root, relative));
  if (protocol.numericInputs.find(s => s.path === relative)?.sha256 !== sha(bytes)) throw Error(`Source identity mismatch: ${relative}`);
  return { name, path: relative, sha256: sha(bytes), value: JSON.parse(bytes) };
});
const [train, origin] = inputs.map(s => s.value);
if (JSON.stringify(train.years) !== JSON.stringify(protocol.trainingYears) || origin.originYear !== 2018) throw Error('Source years drift');
for (const panel of [train.ladder, train.gdp]) for (const values of Object.values(panel)) for (const year of Object.keys(values)) if (!protocol.trainingYears.includes(Number(year))) throw Error('Nontraining numeric year in source');
if (train.countries.length !== 101 || origin.countries.length !== 100 || origin.excluded.length !== 28 || JSON.stringify(origin.countries.map(c => c.id)) !== JSON.stringify(protocol.cohort.originCountryIds)) throw Error('Cohort drift');
const internal = validate(train);
const calibration = fit(train, 2018, internal.selection.lambda);
const forecast = predict(origin, calibration, 7);
if (forecast.rows.length !== 700 || new Set(forecast.rows.map(r => `${r.id}/${r.year}`)).size !== 700) throw Error('Prediction coverage mismatch');
const write = (name, data) => fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 2) + '\n');
write('predictions.json', { rows: forecast.rows });
write('calibration.json', { ...calibration, protocolCommit, protocolSha256: sha(protocolBytes), forecastDiagnostics: forecast.diagnostics });
write('internal-validation.json', internal);
const incomeQuartiles = [...origin.countries].sort((a, b) => a.gdp - b.gdp || a.id.localeCompare(b.id)).map((c, i) => ({ id: c.id, quartile: Math.floor(i * 4 / 100) + 1 }));
const codePaths = ['model.mjs', 'run.mjs', 'model.test.ts'].map(file => `scripts/evaluation/attempts/${entry}/${file}`);
write('provenance.json', {
  schema: 'changes-provenance/1', entryId: entry, familyId: protocol.familyId, protocolCommit, protocolSha256: sha(protocolBytes),
  authorship: 'Automated research agent; not independent human/domain-expert review',
  inputs: inputs.map(({ value, ...source }) => source),
  code: codePaths.map(relative => ({ path: relative, sha256: sha(fs.readFileSync(path.join(root, relative))) })),
  outputs: ['predictions.json', 'calibration.json', 'internal-validation.json'].map(file => ({ path: `data/evaluation/${entry}/${file}`, sha256: sha(fs.readFileSync(path.join(out, file))) })),
  observedYearRange: [2015, 2018], numericExternalDataFetched: false, externalOutcomeReads: 0, externalScoreInvocations: 0,
  trainingBackgroundCountries: 101, pairedTrainingRows: Object.values(train.ladder).reduce((n, xs) => n + Object.keys(xs).length, 0),
  originCountries: origin.countries.length, originExclusions: origin.excluded, predictionRows: forecast.rows.length, incomeQuartiles,
  references: protocol.references, amendments: protocol.amendments,
  pending: 'Controller must freeze all five methods and the long-run proxy before the single external score invocation per entry. No external results available here.',
  limitations: [protocol.vintageLimit, internal.warning],
});
console.log(JSON.stringify({ entry, protocolCommit, selectedLambda: internal.selection.lambda, trainTransitions: calibration.nTransitions, predictionRows: forecast.rows.length, ladderClamps: forecast.diagnostics.ladderClamps.length, growthClamps: calibration.gdp.growthClamps.length, externalScoring: 'pending' }, null, 2));

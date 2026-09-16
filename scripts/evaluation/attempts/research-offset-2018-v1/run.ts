/** Frozen research generator: the only numeric readers are registered train/origin JSON. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { fitTraining, forecast, internalValidation, validateTraining, type Origin, type Training } from './model';

export const ENTRY = 'research-offset-2018-v1';
export const REGISTERED_COMMIT = 'e8e6e72700ba32576269901885f27c7dab7574c9';
const output = `data/evaluation/${ENTRY}/`;
const source = 'data/evaluation/level-holdout-2018/';
const script = `scripts/evaluation/attempts/${ENTRY}/`;
const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const write = (file: string, data: unknown) => writeFileSync(file, JSON.stringify(data, null, 2) + '\n');

function finiteNumbers(value: unknown): void {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Nonfinite artifact value');
  if (Array.isArray(value)) value.forEach(finiteNumbers);
  else if (value !== null && typeof value === 'object') Object.values(value).forEach(finiteNumbers);
}

export function run(): void {
  const protocolPath = output + 'protocol.json';
  const protocol = read(protocolPath);
  const registered = execFileSync('git', ['show', `${REGISTERED_COMMIT}:${protocolPath}`], { encoding: 'utf8' });
  if (registered !== readFileSync(protocolPath, 'utf8')) throw new Error('Protocol changed since registration');
  if (protocol.id !== ENTRY || protocol.schema !== 'forecast-protocol/1') throw new Error('Protocol identity drift');
  for (const [file, expected] of Object.entries(protocol.inputHashes))
    if (hash(file) !== expected) throw new Error(`Input hash mismatch: ${file}`);
  const train = read(source + 'train.json') as Training;
  const origin = read(source + 'origin.json') as Origin & { excluded: unknown[] };
  validateTraining(train);
  for (const c of [...train.countries, ...origin.countries])
    for (const key of ['population', 'gini', 'ge', 'rl', 'cc'] as const)
      if (!c[key]) throw new Error('Frozen historical background field missing');
  if (JSON.stringify(train.years) !== '[2015,2016,2017,2018]' || origin.originYear !== 2018 ||
      origin.countries.length !== 100 || origin.excluded.length !== 28 ||
      JSON.stringify(origin.countries.map(c => c.id)) !== JSON.stringify(protocol.cohort.ids))
    throw new Error('Training/origin/cohort drift');
  // Source hashes are collected before any fit. No original prediction or outcome files are read.
  const sourceFiles = [source + 'train.json', source + 'origin.json', protocolPath,
    script + 'model.ts', script + 'run.ts', script + 'model.test.ts', 'package-lock.json'];
  const sourceHashes = Object.fromEntries(sourceFiles.map(file => [file, hash(file)]));
  const validation = internalValidation(train);
  const calibration = fitTraining(train);
  const predicted = forecast(origin, calibration, validation.selectedSetting, 7);
  if (predicted.rows.length !== 700 || new Set(predicted.rows.map(r => `${r.id}/${r.year}`)).size !== 700 ||
      predicted.rows.some(r => r.year < 2019 || r.year > 2025 || r.horizon !== r.year - 2018))
    throw new Error('Forecast grid drift');
  const fitArtifact = {
    schema: 'research-offset-calibration/1', entryId: ENTRY, registeredProtocolCommit: REGISTERED_COMMIT,
    protocolHash: hash(protocolPath), trainHash: hash(source + 'train.json'), originHash: hash(source + 'origin.json'),
    selectedSetting: validation.selectedSetting, fit: calibration, countryRates: predicted.rates,
    originOffsets: predicted.countryOffsets, diagnostics: predicted.diagnostics,
    uncertainty: 'No prediction interval. Four-year panel and tuning losses cannot establish seven-year validity.'
  };
  const internalArtifact = { schema: 'research-internal-validation/1', entryId: ENTRY,
    protocolHash: hash(protocolPath), ...validation, externalResults: 'PENDING — external scoring prohibited before joint freeze' };
  finiteNumbers(fitArtifact); finiteNumbers(internalArtifact); finiteNumbers(predicted.rows);
  write(output + 'calibration.json', fitArtifact);
  write(output + 'internal-validation.json', internalArtifact);
  write(output + 'predictions.json', { rows: predicted.rows });
  write(output + 'source-hashes.json', {
    schema: 'research-source-hashes/1', entryId: ENTRY, familyId: protocol.familyId,
    registeredProtocolCommit: REGISTERED_COMMIT, baseCommit: '0ca2eda3ea5db518499abebda1de1367d4e1ab7e',
    sourceHashes, outputHashes: Object.fromEntries(['calibration.json', 'internal-validation.json', 'predictions.json']
      .map(file => [output + file, hash(output + file)])),
    allowedNumericInputs: protocol.allowedNumericInputs,
    externalDataFetched: false, rawFutureObservationsRead: false, externalScoreInvocations: 0,
    runtime: process.version, generator: script + 'run.ts',
    references: protocol.references, note: 'Reference metadata records method sources; no external numeric series or fitted coefficients imported.'
  });
  console.log(JSON.stringify({ entryId: ENTRY, rows: predicted.rows.length, selected: validation.selectedSetting,
    trainingRows: calibration.rows, coefficients: calibration.coefficients, diagnostics: predicted.diagnostics,
    internalLadder: validation.ladderCandidates.find(c => c.offsetWeight === validation.selectedSetting.offsetWeight &&
      c.annualAdjustment === validation.selectedSetting.annualAdjustment)?.selectionLoss,
    externalResults: 'PENDING' }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run();

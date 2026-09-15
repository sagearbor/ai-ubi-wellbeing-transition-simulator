import { contentHash } from './hash';
import { expect, it } from 'vitest';
import { runModel, runMonteCarlo } from '../core/engine';
import { training, threeStatusDraft, SOURCE_TEXT } from './testDrafts';
import { pairedRun } from './draft';
import { buildBundle, reopenBundle } from './bundle';
import { buildModelExport, classifyImport } from '../../components/lab/importState';

it('distinguishes two versus three draws and each sampled draw', () => {
  const a = runMonteCarlo(training, {runs: 2, seed: 1});
  const b = runMonteCarlo(training, {runs: 3, seed: 1});
  expect(a.ok && b.ok).toBe(true);
  expect(a.manifest.hash).not.toBe(b.manifest.hash);
  expect(runModel(training, {seed: 1, run: 0}).manifest.hash).not.toBe(runModel(training, {seed: 1, run: 1}).manifest.hash);
});
it('refuses wrong model hash or old engine for package import', () => {
  const p = buildModelExport(training, [], 'curated');
  expect(classifyImport({...p, modelHash: 'wrong'}).kind).toBe('incompatible-package');
  expect(classifyImport({...p, engineVersion: 'core-0.1.0'}).kind).toBe('incompatible-package');
});
it('replays complete bundles and detects corrupt results and settings', () => {
  const d = threeStatusDraft();
  const b = buildBundle(training, [], d, pairedRun(training, [], d, {runs: 2, seed: 1, sourceText: SOURCE_TEXT}), {sourceText: SOURCE_TEXT});
  const registry = () => training;
  expect(reopenBundle(b, registry).status).toBe('reproduced');
  const corrupt = structuredClone(b);
  const entity = Object.keys(corrupt.results.baseline)[0];
  const output = Object.keys(corrupt.results.baseline[entity])[0];
  corrupt.results.baseline[entity][output].p50[0] += 1000;
  expect(reopenBundle(corrupt, registry).status).toBe('not-reproduced');
  const settings = structuredClone(b);
  settings.manifest.draws.firstIndex = 1 as 0;
  expect(reopenBundle(settings, registry).status).toBe('cannot-open');
});

it('records numerical conventions and requested/effective counts without timestamp identity', () => {
  const deterministic = {...training, parameters: training.parameters.map(({range: _range, ...p}) => p)};
  const a = runMonteCarlo(deterministic, {runs: 2, seed: 1});
  const b = runMonteCarlo(deterministic, {runs: 3, seed: 1});
  expect(a.runs).toBe(1);
  expect(a.manifest).toMatchObject({requestedRuns: 2, effectiveRuns: 1, numerical: {generator: expect.any(String), sampler: expect.any(String), correlation: expect.any(String), solver: expect.any(String), expression: expect.stringMatching(/^mathjs\//)}});
  expect(a.manifest.hash).not.toBe(b.manifest.hash);
  expect(a.manifest.hash).toBe(runMonteCarlo(deterministic, {runs: 2, seed: 1}).manifest.hash);
  const d = threeStatusDraft();
  expect(pairedRun(training, [], d, {runs: 2, now: () => 'old'}).manifest.hash).toBe(pairedRun(training, [], d, {runs: 2, now: () => 'new'}).manifest.hash);
});
it('refuses result scope, extra samples, source, and numerical tampering', () => {
  const d = threeStatusDraft();
  const b = buildBundle(training, [], d, pairedRun(training, [], d, {runs: 2, sourceText: SOURCE_TEXT}), {sourceText: SOURCE_TEXT});
  const mutations: Array<(changed: typeof b) => void> = [
    b => { b.results.outputs = []; },
    b => { b.results.baseline._.placements.p50.push(0); },
    b => { b.sourceText += '\nchanged'; },
    b => { b.manifest.numerical.sampler = 'different'; },
    b => { b.manifest.runs = 3; },
    b => { b.tolerance.absolute = Infinity; },
    b => { b.results.years[0] += 1e-7; },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(b); mutate(changed);
    expect(reopenBundle(changed, () => training).status).not.toBe('reproduced');
  }
  expect(b.model).toEqual(training);
  expect(reopenBundle(JSON.parse(JSON.stringify(b)), () => training).rerun?.manifest).toEqual(b.manifest);
});
it('never accepts a package status claim as curation and retains source-import provenance', () => {
  const changed = {...training, name: 'Changed content'};
  const p = buildModelExport(changed, [], 'curated', undefined, ['NEW experimental source import; not replay: old engine']);
  expect(p.status).toContain('experimental');
  const classified = classifyImport(JSON.parse(JSON.stringify(p)));
  expect(classified.kind).toBe('package');
  if (classified.kind === 'package') expect(classified.warnings).toEqual(p.importWarnings);
  expect(classifyImport({...p, schema: 'core-model-export/999'}).kind).toBe('incompatible-package');
});

it('checks actual settings even when an edited manifest is rehashed', () => {
  const draft = threeStatusDraft();
  const bundle = buildBundle(training, [], draft, pairedRun(training, [], draft, {runs: 2}));
  bundle.manifest.draws.firstIndex = 1 as 0;
  const {hash: _hash, createdAt: _time, ...identity} = bundle.manifest;
  bundle.manifest.hash = contentHash(identity);
  expect(reopenBundle(bundle, () => training).status).toBe('cannot-open');
});

it('refuses exports that cannot reopen or no longer describe the recorded input', () => {
  expect(() => buildModelExport({...training, name: '界'.repeat(1_700_000)}, [], 'imported')).toThrow('5 MB');
  const d = threeStatusDraft();
  const result = pairedRun(training, [], d, {runs: 2, sourceText: SOURCE_TEXT});
  expect(() => buildBundle(training, [], d, result)).toThrow('differs from the completed run');
  expect(() => buildBundle(training, [], d, result, {sourceText: SOURCE_TEXT, tolerance: {absolute: 10, relative: 0, note: 'too loose'}})).toThrow('finite tolerances');
});

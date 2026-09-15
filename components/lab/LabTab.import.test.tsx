/**
 * Model import/export (review finding 14), model-native calendars in the Lab (finding 15) and the
 * bounded runner as the Lab uses it (stage-5 gap 2). Rendered to strings like the other Lab tests.
 */

import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import LabTab from './LabTab';
import { NUMERICAL_CONVENTIONS, ENGINE_VERSION } from '../../src/core/engine';
import { findFixture } from '../../src/core/fixtures';
import type { CoreModel } from '../../src/core/types';
import { validateCoreModel } from '../../src/core/validate';
import { buildBundle, encodeLabLink, LAB_HASH_PREFIX, parseBundleJson, reopenBundle } from '../../src/policy/bundle';
import { pairedRun } from '../../src/policy/draft';
import { modelHash } from '../../src/policy/hash';
import { renderMemo } from '../../src/policy/memo';
import { registryFor } from '../../src/workers/execute';
import {
  EXPERIMENTAL_LABEL,
  buildModelExport,
  classifyImport,
  curatedMatch,
  explainValidationErrors,
  importKey,
  parseImportText,
} from './importState';
import { findPolicyExample } from '../../src/policy/examples';

const html = (props: React.ComponentProps<typeof LabTab> = {}): string =>
  renderToString(React.createElement(LabTab, { initialHash: '', ...props })).replace(/<!-- -->/g, '');

const training = findFixture('training-budget')!.model;
/** A copy of the training model with a different id: what an author would import. */
const authored: CoreModel = { ...JSON.parse(JSON.stringify(training)), id: 'my-training-variant', name: 'My training variant' };

describe('importState', () => {
  it('classifies models, exported packages, overlays and policy bundles', () => {
    expect(classifyImport(authored).kind).toBe('model');
    expect(classifyImport(buildModelExport(authored, [], 'imported')).kind).toBe('package');
    expect(classifyImport({ id: 'o', effects: [] }).kind).toBe('overlay');
    expect(classifyImport({ schema: 'policy-bundle/2' }).kind).toBe('policy-bundle');
    expect(classifyImport([1, 2]).kind).toBe('unknown');
    expect(parseImportText('{nope').ok).toBe(false);
  });

  it('an export is marked experimental for an imported model and curated for a bundled one, and re-imports', () => {
    const exp = buildModelExport(authored, [], 'imported', () => '2026-09-14T00:00:00.000Z');
    expect(exp.status).toBe(EXPERIMENTAL_LABEL);
    expect(exp.modelHash).toBe(modelHash(authored));
    expect(buildModelExport(training, [], 'curated').status).toBe('curated');
    const back = classifyImport(JSON.parse(JSON.stringify(exp)));
    expect(back.kind).toBe('package');
    expect(validateCoreModel((back as { model: unknown }).model).ok).toBe(true);
  });

  it('an unchanged bundled model is recognised as curated; any change is not', () => {
    expect(curatedMatch(JSON.parse(JSON.stringify(training)))?.model.id).toBe('training-budget');
    expect(curatedMatch(authored)).toBeUndefined();
    const tweaked = JSON.parse(JSON.stringify(training)) as CoreModel;
    tweaked.parameters[0].value += 1;
    expect(curatedMatch(tweaked)).toBeUndefined();
  });

  it('reports fields the format does not have as unsupported capabilities', () => {
    const withExtra = { ...authored, agents: [{ id: 'household' }], time: { ...authored.time, calendar: 'fiscal' } };
    const v = validateCoreModel(withExtra);
    expect(v.ok).toBe(false);
    const explained = explainValidationErrors(v.errors);
    expect(explained.some((e) => e.startsWith('unsupported capability: "agents" at the top level'))).toBe(true);
    expect(explained.some((e) => e.startsWith('unsupported capability: "calendar" at /time'))).toBe(true);
    const badStep = validateCoreModel({ ...authored, time: { ...authored.time, step: 'generation' } });
    expect(explainValidationErrors(badStep.errors).join(' ')).toContain('declares the unit with time.stepLabel');
    const fn = validateCoreModel({ ...authored, variables: [...authored.variables, { id: 'noise', equation: 'random()' }] });
    expect(explainValidationErrors(fn.errors).join(' ')).toContain('unsupported capability: variable noise: function "random" is not allowed');
  });
});

describe('Lab with an imported model', () => {
  it('flags it experimental in the picker, the header and the results, and still runs it', () => {
    const out = html({ initialImports: [{ model: authored }] });
    expect(out).toContain(`label="Imported (${EXPERIMENTAL_LABEL})"`);
    expect(out).toContain(`value="${importKey(authored)}" selected=""`);
    expect(out).toContain(`My training variant — ${EXPERIMENTAL_LABEL}`);
    expect(out).toContain(`Imported model: ${EXPERIMENTAL_LABEL}.`);
    // it ran through the same runner: results, binding and tests are all there
    expect(out).toContain('completions is limited by instructor_capacity');
    expect(out).toContain('2 of 2 passing');
    const resultsAt = out.indexOf('Results');
    expect(out.indexOf(EXPERIMENTAL_LABEL, resultsAt)).toBeGreaterThan(resultsAt);
    // the export says so too, and the old "no app code changes" promise is gone
    expect(out).toContain('Export model + overlays (JSON)');
    expect(out).not.toContain('no app code changes');
    expect(out).toContain('Import a model or overlay (JSON)');
  });

  it('curated fixtures stay curated: no experimental label without an import', () => {
    const out = html({ initialModelId: 'training-budget' });
    expect(out).not.toContain(`Imported model: ${EXPERIMENTAL_LABEL}`);
    expect(out).not.toContain('label="Imported');
  });

  it('a policy run on an imported model is labelled experimental, links are off, and its bundle carries the model and reopens', () => {
    const example = findPolicyExample('s3877-itwa-2026')!;
    const draft = { ...example.draft, modelId: authored.id, modelHash: modelHash(authored) };
    const out = html({
      initialImports: [{ model: authored }],
      initialPolicy: { drafts: [draft], source: { title: example.source.title, url: example.source.url, text: example.source.text }, runs: 20, seed: 1, run: true },
    });
    expect(out).toContain('paired difference A');
    expect(out).toContain('Experimental — not curated: these results come from a model imported into the Lab');
    expect(out).toContain('links are off; the bundle carries the model');

    const result = pairedRun(authored, [], draft, { runs: 20, seed: 1, sourceText: example.source.text });
    expect(result.ok, result.errors.join('; ')).toBe(true);
    const bundle = buildBundle(authored, [], draft, result, { sourceText: example.source.text, embedModel: true });
    expect(bundle.modelStatus).toBe(EXPERIMENTAL_LABEL);
    const parsed = parseBundleJson(JSON.stringify(bundle));
    expect(parsed.ok).toBe(true);
    // a registry that only knows the bundled fixtures cannot open it; the carried model can
    expect(reopenBundle(parsed.value!, (id) => findFixture(id)?.model).status).toBe('cannot-open');
    const reg = registryFor([parsed.value!.model!]);
    expect(reopenBundle(parsed.value!, (id) => reg(id, parsed.value!.manifest.modelHash)).status).toBe('reproduced');

    const memo = renderMemo({ model: authored, overlays: [], draft, result, sourceText: example.source.text, modelStatus: 'imported' });
    expect(memo).toContain('**Model status:** experimental — not curated');
  });
});

describe('Lab calendars and steady-state outputs', () => {
  it('labels the Gasteiger-Prettner model in generations and shows no transition chart for welfare', () => {
    const out = html({ initialModelId: 'gasteiger-prettner-2020' });
    expect(out).toContain('One step is one generation (25 years)');
    expect(out).toContain('41 generations');
    expect(out).toContain('Generation 40:'); // chart captions
    expect(out).toContain('Steady state (Generation 40)');
    expect(out).toContain('steady state only');
    expect(out).toContain('data-steady-state-only="utility_prev"');
    expect(out).toContain('data-steady-state-only="cv1_pct"');
    expect(out).not.toContain('data-steady-state-only="k"');
    expect(out).toContain('No transition chart:');
    expect(out).toMatch(/<label[^>]*for="lab-year"[^>]*>Generation<\/label>/);
    expect(out).not.toMatch(/Year 20\d\d/);
    // deterministic: no ranged parameter, so no 200 identical draws
    expect(out).toContain('deterministic: uncertainty off');
  });

  it('calendar models keep calendar years', () => {
    const out = html({ initialModelId: 'training-budget' });
    expect(out).toContain('2029:');
    expect(out).not.toContain('One step is one');
    expect(out).toMatch(/<label[^>]*for="lab-year"[^>]*>Year<\/label>/);
  });

  it('Korinek faithful is deterministic: uncertainty runs once instead of 200 times', () => {
    const out = html({ initialModelId: 'korinek-2026-faithful', initialUncertainty: true });
    expect(out).toContain('deterministic: uncertainty off');
    expect(out).not.toContain('200 runs, seed 1');
  });
});

describe('links are checked against the limits before anything runs', () => {
  it('a link asking for more draws than the limit opens for inspection but is not run', () => {
    const example = findPolicyExample('s3877-itwa-2026')!;
    const hash = `${LAB_HASH_PREFIX}${encodeLabLink({ v: 2, modelId: 'training-budget', modelHash: modelHash(training), engineVersion: ENGINE_VERSION, numerical: NUMERICAL_CONVENTIONS, overlays: [], drafts: [example.draft], runs: 9_999, seed: 1 })}`;
    const out = html({ initialHash: hash });
    expect(out).toContain('did not run it');
    expect(out).toContain('9999 draws requested; the limit is 1 to 2,000 draws per run');
    expect(out).not.toContain('paired difference A');
  });

  it('a link within the limits still runs on opening', () => {
    const example = findPolicyExample('s3877-itwa-2026')!;
    const hash = `${LAB_HASH_PREFIX}${encodeLabLink({ v: 2, modelId: 'training-budget', modelHash: modelHash(training), engineVersion: ENGINE_VERSION, numerical: NUMERICAL_CONVENTIONS, overlays: [], drafts: [example.draft], runs: 10, seed: 1 })}`;
    const out = html({ initialHash: hash });
    expect(out).toContain('paired difference A');
  });
});

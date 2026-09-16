import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PublishedExperience from './PublishedExperience';
import LabTab from '../lab/LabTab';
import { buildExperiment, decodeExperiment, exactModel, financialDataHash, validateExperiment } from '../../src/financials/share';
import { modelHash } from '../../src/policy/hash';
import { createSyncRunner } from '../../src/workers/client';
import { importFinancialExperiment, importKey, verifiedFinancialOrigin } from '../lab/importState';
import recordedPrepatchExperiments from '../../src/financials/fixtures/v1-experiments.json';
// Revision behavior uses explicitly new executions on this runtime, never relabeled fixture pins.
const originalExperiments = recordedPrepatchExperiments.map(e => buildExperiment(e.recordId, e.scenarios, e.view as 'explore' | 'compare', e.collectionId));
import { financialRecordForModel, reportedFinancialParameters } from '../../src/financials/presentation';

const runner = createSyncRunner();
const defaults = buildExperiment();
const current = buildExperiment('nvidia-fy2025', {
  A: { ...defaults.scenarios.A, recipientCountry: 'GBR', policyShare: .37, trainingShare: .12 },
  B: { ...defaults.scenarios.B, recipientCountry: 'GBR', policyShare: .61, trainingShare: .43 },
}, 'compare');
const published = (experiment = current) => renderToString(<PublishedExperience mode="compare" initial={experiment} runner={runner}
  onMode={() => {}} onLab={() => {}} onWorld={() => {}} onHistory={() => {}} onRisk={() => {}} />).replace(/<!-- -->/g, '');
function destination(text: string, experiment = current): URL {
  const anchor = [...published(experiment).matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)]
    .find(([, , label]) => label === text);
  expect(anchor, `A real scenario link must carry ${text}`).toBeDefined();
  return new URL(anchor![1].replace(/&amp;/g, '&'));
}
const lab = (props: object) => renderToString(<LabTab initialHash="" runner={runner} {...props} />).replace(/<!-- -->/g, '');

describe('published financial scenario handoff', () => {
  it.each([['Paste a policy', 'policy'], ['Inspect extension options', 'author'], ['Inspect uncertainty', 'uncertainty']])(
    '%s carries current A, source pins and its intended Lab tool', (label, entry) => {
      const url = destination(label);
      expect(url.searchParams.get('tab')).toBe('lab');
      expect(url.searchParams.get('side')).toBe('A');
      expect(url.searchParams.get('entry')).toBe(entry);
      const reopened = decodeExperiment(url.hash);
      expect(reopened.recordId).toBe('nvidia-fy2025');
      expect(reopened.dataHash).toBe(current.dataHash);
      expect(reopened.scenarios.A.policyShare).toBe(.37);
      expect(reopened.scenarios.A.recipientCountry).toBe('GBR');
      const output = lab({ initialFinancialExperiment: { experiment: reopened, side: 'A' } });
      expect(output).toContain(`value="${importKey(exactModel(current, 'A'))}" selected=""`);
      expect(output).toContain('Built by this app from the pinned FY2025 dataset');
      expect(output).toContain('illustrative');
      expect(output).not.toContain('Loaded from a file on this device');
      // The policy panel names the same origin as the Lab header (review 2026-09-15), not "imported".
      expect(output).toContain('Experimental scenario — not curated');
      expect(output).toContain('app-built from the pinned financial dataset');
      expect(output).not.toMatch(/Base model: (<!-- -->)?imported/);
    },
  );
  it('keeps the explicit B link on the exact independent B model', () => {
    const url = destination('Open training equations B in Model Lab');
    expect(url.searchParams.get('side')).toBe('B');
    expect(url.searchParams.get('entry')).toBeNull();
    const reopened = decodeExperiment(url.hash);
    expect(modelHash(exactModel(reopened, 'B'))).toBe(current.modelHashes.B);
    const output = lab({ initialFinancialExperiment: { experiment: reopened, side: 'B' } });
    expect(output).toContain(`value="${importKey(exactModel(current, 'B'))}" selected=""`);
    expect(output).not.toContain(`value="${importKey(exactModel(current, 'A'))}" selected=""`);
  });
});

describe('financial origin stays distinct from an uploaded claim', () => {
  it.each(originalExperiments)('recognizes both revisions of $recordId using the complete model and collection', original => {
    const old = validateExperiment(original);
    const revised = buildExperiment(old.recordId, old.scenarios);
    for (const experiment of [old, revised]) for (const side of ['A', 'B'] as const) {
      const entry = importFinancialExperiment(experiment, side);
      expect(verifiedFinancialOrigin(entry)).toEqual({ collectionId: experiment.collectionId, dataHash: experiment.dataHash,
        modelHash: experiment.modelHashes[side], fiscalYear: 2025 });
      expect(reportedFinancialParameters(entry.model).size).toBe(3);
      expect(financialRecordForModel(entry.model, experiment.collectionId)?.id).toBe(experiment.recordId);
    }
  });
  it('rejects a legacy source relabeled with the current collection and its matching data hash', () => {
    const entry = importFinancialExperiment(validateExperiment(originalExperiments[0]), 'A');
    entry.financialOrigin!.collectionId = current.collectionId;
    entry.financialOrigin!.dataHash = financialDataHash(current.collectionId);
    expect(verifiedFinancialOrigin(entry)).toBeUndefined();
  });
  it('rejects a rewritten fiscal year and missing model match, even with caller-rewritten hashes', () => {
    const entry = importFinancialExperiment(current, 'A');
    entry.financialOrigin!.fiscalYear = 2026;
    expect(verifiedFinancialOrigin(entry)).toBeUndefined();
    entry.model.variables[0].equation = '1';
    entry.financialOrigin!.modelHash = modelHash(entry.model);
    delete entry.financialOrigin!.fiscalYear;
    expect(verifiedFinancialOrigin(entry)).toBeUndefined();
  });
  it.each(['dataHash', 'modelHash', 'collectionId'])('rejects a stale retained origin %s', key => {
    const entry = importFinancialExperiment(current, 'A');
    entry.financialOrigin = { ...entry.financialOrigin!, [key]: 'stale' };
    expect(verifiedFinancialOrigin(entry)).toBeUndefined();
  });
  it('rejects a tampered model even if its retained hash is rewritten', () => {
    const entry = importFinancialExperiment(current, 'A');
    entry.model.parameters[0].source = { kind: 'causal', label: 'Claimed official', url: 'https://example.org' };
    entry.financialOrigin!.modelHash = modelHash(entry.model);
    expect(verifiedFinancialOrigin(entry)).toBeUndefined();
  });
  it('keeps a genuine financial model file experimental even if it claims app origin', () => {
    const model = exactModel(current, 'A');
    const output = lab({ initialImports: [{ model, origin: 'financial-catalog', financialOrigin: current }] });
    expect(output).toContain('Imported model: experimental — not curated');
    expect(output).toContain('Loaded from a file on this device');
    expect(output).not.toContain('Built by this app');
  });
  it.each(['dataHash', 'collectionId', 'engineVersion'])(
    'refuses an app-origin claim with stale %s', key => {
      const output = lab({ initialFinancialExperiment: { experiment: { ...current, [key]: 'stale' }, side: 'A' } });
      expect(output).toContain('This financial experiment could not be opened');
      expect(output).not.toContain('Built by this app');
      expect(output).not.toContain(`value="${importKey(exactModel(current, 'A'))}" selected=""`);
    },
  );
  it('refuses edited assumptions when the saved exact model identity is unchanged', () => {
    const experiment = { ...current, scenarios: { ...current.scenarios, A: { ...current.scenarios.A, policyShare: .99 } } };
    const output = lab({ initialFinancialExperiment: { experiment, side: 'A' } });
    expect(output).toContain('Model hashes do not match');
    expect(output).not.toContain('Built by this app');
  });
});

describe('published collection source identity', () => {
  const legacyApple = validateExperiment(originalExperiments[0]);
  it.each([['Paste a policy', 'policy'], ['Inspect extension options', 'author'], ['Inspect uncertainty', 'uncertainty']])(
    '%s preserves an opened v1 experiment and source', (label, entry) => {
      const url = destination(label, legacyApple);
      expect(url.searchParams.get('entry')).toBe(entry);
      const reopened = decodeExperiment(url.hash);
      expect(reopened).toEqual({ ...legacyApple, view: 'compare' });
      const output = lab({ initialFinancialExperiment: { experiment: reopened, side: 'A' } });
      expect(output).toContain('Built by this app from the pinned FY2025 dataset');
      expect(output).toContain('apple.com/newsroom/pdfs/fy2025-q4');
      expect(output).not.toContain('aapl-20250927.htm');
    },
  );
  it('renders the original unaudited Apple source only for the original collection', () => {
    const output = published(legacyApple);
    expect(output).toContain('annual columns, unaudited');
    expect(output).toContain('Report dated 2025-10-30');
    expect(output).toContain('reported-company-financials-fy2025-v1');
    expect(output).not.toContain('aapl-20250927.htm');
    const updated = published(buildExperiment());
    expect(updated).toContain('audited consolidated financial statements');
    expect(updated).toContain('Report dated 2025-10-31');
    expect(updated).toContain('aapl-20250927.htm');
    expect(updated).toContain('reported-company-financials-fy2025-v2');
    expect(updated).not.toContain('apple.com/newsroom');
  });
  it('labels Amazon dividends derived and distinguishes old missing values from verified zero', () => {
    const old = published(validateExperiment(originalExperiments[3]));
    expect(old).toContain('Shareholder dividends (not collected)');
    expect(old).toContain('Not collected; not assumed zero');
    const updated = published(buildExperiment('amazon-fy2025'));
    expect(updated).toContain('Shareholder dividends (derived)');
    expect(updated).toContain('Share repurchases (reported)');
    expect(updated).toContain('0 million USD (derived)');
    expect(updated).toContain('172,866 + net income 77,670 = closing retained earnings 250,536');
    expect(updated).toContain('Note 8');
    expect(updated).not.toContain('Not collected; not assumed zero');
  });
  it('explains why the financial uncertainty action cannot run ranges yet', () => {
    expect(published()).toContain('This financial model has no uncertainty ranges; add ranges in a model file to compare uncertainty.');
    expect(published()).toContain('Inspect uncertainty');
  });
});

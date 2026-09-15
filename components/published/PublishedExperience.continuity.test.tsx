import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PublishedExperience from './PublishedExperience';
import LabTab from '../lab/LabTab';
import { buildExperiment, decodeExperiment, exactModel } from '../../src/financials/share';
import { modelHash } from '../../src/policy/hash';
import { createSyncRunner } from '../../src/workers/client';
import { importFinancialExperiment, importKey, verifiedFinancialOrigin } from '../lab/importState';

const runner = createSyncRunner();
const defaults = buildExperiment();
const current = buildExperiment('nvidia-fy2025', {
  A: { ...defaults.scenarios.A, recipientCountry: 'GBR', policyShare: .37, trainingShare: .12 },
  B: { ...defaults.scenarios.B, recipientCountry: 'GBR', policyShare: .61, trainingShare: .43 },
}, 'compare');
const published = () => renderToString(<PublishedExperience mode="compare" initial={current} runner={runner}
  onMode={() => {}} onLab={() => {}} onWorld={() => {}} onHistory={() => {}} onRisk={() => {}} />).replace(/<!-- -->/g, '');
function destination(text: string): URL {
  const anchor = [...published().matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)]
    .find(([, , label]) => label === text);
  expect(anchor, `A real scenario link must carry ${text}`).toBeDefined();
  return new URL(anchor![1].replace(/&amp;/g, '&'));
}
const lab = (props: object) => renderToString(<LabTab initialHash="" runner={runner} {...props} />).replace(/<!-- -->/g, '');

describe('published financial scenario handoff', () => {
  it.each([['Paste a policy', 'policy'], ['Add a variable', 'author'], ['Explore uncertainty', 'uncertainty']])(
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

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildExperiment, decodeExperiment, encodeExperiment, exactModel, experimentUrl, FINANCE_PREFIX, financialDataHash, parseExperiment, validateExperiment } from './share';
import { createSyncRunner } from '../workers/client';
import { modelHash } from '../policy/hash';
import { buildModelExport, classifyImport } from '../../components/lab/importState';
import originalExperiments from './fixtures/v1-experiments.json';
const result = (model: ReturnType<typeof exactModel>) => { const run = createSyncRunner().runSync({ kind: 'lab-point', model, overlays: [], hypotheticalOverlays: null }); if (run.status !== 'done' || !run.result.plain.ok) throw new Error('Real worker calculation failed'); return {series:run.result.plain.series,binding:run.result.plain.binding,diagnostics:run.result.plain.diagnostics,hash:run.result.plain.manifest.hash}; };
describe('portable published experiments', () => {
  it('reopens both independent scenarios with identical real worker results', () => {
    const first = buildExperiment();
    const edited = buildExperiment('nvidia-fy2025', { A: {...first.scenarios.A, policyShare: .234, recipientCountry: 'GBR'}, B: {...first.scenarios.B, policyShare: .63, trainingShare: .91, instructorCapacity: 17, recipientCountry: 'GBR'} }, 'compare');
    for (const reopened of [parseExperiment(JSON.stringify(edited)), decodeExperiment(FINANCE_PREFIX + encodeExperiment(edited))]) {
      expect(reopened).toEqual(edited);
      for (const side of ['A','B'] as const) expect(result(exactModel(reopened,side))).toEqual(result(exactModel(edited,side)));
    }
  });
  it('pins exact models in separate Lab URLs and importable model packages', () => {
    const e = buildExperiment(); const url = new URL(experimentUrl(e,'https://example.org/?tab=map#share=old','B'));
    expect(url.searchParams.get('tab')).toBe('lab');expect(url.searchParams.get('side')).toBe('B');
    const model = exactModel(decodeExperiment(url.hash),'B');expect(modelHash(model)).toBe(e.modelHashes.B);
    const packaged = buildModelExport(model, [], 'imported');expect(classifyImport(packaged).kind).toBe('package');expect(packaged.model).toEqual(model);
  });
  it.each(['version','collectionId','recipientsId','dataHash','engineVersion','numericalHash','recordId','view'])('rejects stale or unknown %s', key => { expect(()=>validateExperiment({...buildExperiment(),[key]:'unknown'})).toThrow(); });
  it.each([NaN,Infinity,-.01,1.01,'0.1',null])('rejects invalid assumption %s', value => {
    const e = buildExperiment(); (e.scenarios.A.policyShare as unknown) = value;expect(()=>validateExperiment(e)).toThrow();
  });
  it('rejects changed hashes, cohorts, missing inputs, malformed and oversized payloads', () => {
    const e = buildExperiment();e.modelHashes.A='forged';expect(()=>validateExperiment(e)).toThrow(/hash/);
    const c = buildExperiment();c.scenarios.B.recipientCountry='GBR';expect(()=>validateExperiment(c)).toThrow(/cohort/);
    for (const input of ['{', 'null', '{}',' '.repeat(16001)]) expect(()=>parseExperiment(input)).toThrow();
    for (const hash of ['#share=abc', '#finance=%xx', '#finance=garbage']) expect(()=>decodeExperiment(hash)).toThrow();
  });
});

describe('immutable financial collection replay', () => {
  // These six experiment payloads were captured from the actual pre-revision runtime.
  // Never regenerate them from buildExperiment: their data and model hashes are the contract.
  it('retains the original collection and captured experiment bytes', () => {
    const sha256 = (relative: string) => createHash('sha256').update(readFileSync(new URL(relative, import.meta.url))).digest('hex');
    expect(sha256('../../data/financials/fy2025-v1.json')).toBe('fa0017ef898082cb7289448a2fc7e174a39039c8b67bd9683aacc8ea7bc64dba');
    expect(sha256('./fixtures/v1-experiments.json')).toBe('12bb8f688e1e087aeda1bfa6d3edceb08b9924c42c6ac818690c890d8c909d6b');
  });
  it.each(originalExperiments)('replays the original $recordId models and allocation outputs', original => {
    expect(original.collectionId).toBe('reported-company-financials-fy2025-v1');
    expect(original.dataHash).toBe('6cc262100734a0ba');
    const old = parseExperiment(JSON.stringify(original));
    expect(old).toEqual(original);
    expect(decodeExperiment(FINANCE_PREFIX + encodeExperiment(old))).toEqual(original);
    const current = buildExperiment(old.recordId, old.scenarios, old.view);
    expect(current.collectionId).toBe('reported-company-financials-fy2025-v2');
    expect(current.dataHash).not.toBe(old.dataHash);
    if (old.recordId === 'apple-fy2025') expect(current.modelHashes).not.toEqual(old.modelHashes);
    else expect(current.modelHashes).toEqual(old.modelHashes);
    const fixedBases = { 'apple-fy2025': 98767e6, 'microsoft-fy2025': 71611e6, 'alphabet-fy2025': 73266e6,
      'amazon-fy2025': 7695e6, 'meta-fy2025': 46109e6, 'nvidia-fy2025': 60853e6 };
    for (const side of ['A', 'B'] as const) {
      const model = exactModel(old, side);
      expect(modelHash(model)).toBe(original.modelHashes[side]);
      const oldResult = result(model);
      expect(oldResult.series._.source_cash_flow).toEqual([fixedBases[old.recordId]]);
      expect(oldResult.series._.allocatable_base).toEqual([fixedBases[old.recordId]]);
      expect(oldResult.series).toEqual(result(exactModel(current, side)).series);
      expect(oldResult.binding).toEqual(result(exactModel(current, side)).binding);
    }
  });
  it('retains old collection pins through scenario edits and all exact Lab links', () => {
    const old = validateExperiment(originalExperiments[0]);
    const edited = buildExperiment(old.recordId, { A: { ...old.scenarios.A, policyShare: .37 }, B: old.scenarios.B }, 'compare', old.collectionId);
    expect(edited.collectionId).toBe(old.collectionId);
    expect(edited.dataHash).toBe(old.dataHash);
    expect(edited.modelHashes.A).not.toBe(old.modelHashes.A);
    expect(edited.modelHashes.B).toBe(old.modelHashes.B);
    for (const entry of ['policy', 'author', 'uncertainty'] as const) {
      const url = new URL(experimentUrl(edited, 'https://example.org', 'A', entry));
      expect(decodeExperiment(url.hash)).toEqual(edited);
      expect(exactModel(decodeExperiment(url.hash), 'A').sources[0].url).toContain('apple.com/newsroom');
    }
  });
  it('does not accept exchanged collection/data pins or a source from another collection', () => {
    const old = validateExperiment(originalExperiments[0]);
    const current = buildExperiment();
    expect(() => validateExperiment({ ...old, collectionId: current.collectionId })).toThrow(/dataHash/);
    expect(() => validateExperiment({ ...current, collectionId: old.collectionId })).toThrow(/dataHash/);
    expect(() => validateExperiment({ ...old, collectionId: current.collectionId, dataHash: current.dataHash })).toThrow(/Model hashes/);
    expect(() => financialDataHash('unknown')).toThrow(/collectionId/);
    expect(() => validateExperiment({ ...old, collectionId: undefined })).toThrow(/collectionId/);
    expect(exactModel(old, 'A').sources[0].url).toContain('apple.com/newsroom');
    expect(exactModel(current, 'A').sources[0].url).toContain('sec.gov');
  });
});

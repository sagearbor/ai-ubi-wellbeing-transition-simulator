import { describe, expect, it } from 'vitest';
import { buildExperiment, decodeExperiment, encodeExperiment, exactModel, experimentUrl, FINANCE_PREFIX, parseExperiment, validateExperiment } from './share';
import { createSyncRunner } from '../workers/client';
import { modelHash } from '../policy/hash';
import { buildModelExport, classifyImport } from '../../components/lab/importState';
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

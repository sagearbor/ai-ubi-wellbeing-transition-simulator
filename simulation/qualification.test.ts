import { describe, it, expect, vi } from 'vitest';
import structure from '../data/qualification/world-conditional-v1-structure.json';
import evidence from '../data/qualification/world-conditional-v1-evidence.json';
vi.mock('./sourceFreshness', () => ({ executingSourceHash: () => structure.hash }));
import record from '../data/qualification/world-conditional-v1.json';
import { DEFAULT_MODEL } from '../constants';
import { initialRun, initOptionsFor, advanceRun } from './run';
import { qualificationIdentity, resolveQualification } from './qualification';
describe('actual qualification identity', () => {
    const base = initialRun(undefined, undefined, initOptionsFor(DEFAULT_MODEL));
    it('binds complete country, model, corporate and snapshot inputs', () => {
        const id = qualificationIdentity(DEFAULT_MODEL, base);
        for (const edit of [(r: any) => r.state.countryData.USA.cognitiveShare += .01, (r: any) => r.corporations[0].marketCap += 1, (r: any) => r.state.countryData.USA.monetaryBasis.source += 'changed', (r: any) => r.state.month += 1]) {
            const r = structuredClone(base);
            edit(r);
            expect(qualificationIdentity(DEFAULT_MODEL, r)).not.toBe(id);
        }
        expect(qualificationIdentity({ ...DEFAULT_MODEL, aiGrowthRate: 9 }, base)).not.toBe(id);
    });
    it('cannot certify imported flags or known IDs', () => { const r = structuredClone(base); r.state.importedUnverified = true; expect(resolveQualification(DEFAULT_MODEL, r).accounting).not.toBe('reviewed-conditional'); expect(resolveQualification(DEFAULT_MODEL, r).reasons.join(' ')).toContain('import'); });
    it('does not manufacture independent review', () => { expect(resolveQualification(DEFAULT_MODEL, base).independentReview).toBe(record.independentReview); });
});
it('keeps exact authored inputs while tolerating only derived mapping roundoff', () => {
    const base = initialRun(undefined, undefined, initOptionsFor(DEFAULT_MODEL));
    const rounded = structuredClone(base);
    rounded.state.countryData.HUN.conditionalWellbeing!.income += 1.4210854715202004e-14;
    rounded.state.countryData.HUN.conditionalWellbeing!.raw += 1.4210854715202004e-14;
    expect(qualificationIdentity(DEFAULT_MODEL, rounded)).toBe(qualificationIdentity(DEFAULT_MODEL, base));
    const changed = structuredClone(base);
    changed.state.countryData.HUN.gdpPerCapita += 1e-10;
    expect(qualificationIdentity(DEFAULT_MODEL, changed)).not.toBe(qualificationIdentity(DEFAULT_MODEL, base));
    expect(resolveQualification(DEFAULT_MODEL, rounded).reasons.join(' ')).not.toContain('Derived output');
    rounded.state.countryData.HUN.conditionalWellbeing!.raw += 0.01;
    expect(resolveQualification(DEFAULT_MODEL, rounded).reasons.join(' ')).toContain('Derived output');
});
it('keeps all 61 independently accepted baseline points eligible across derived roundoff only', () => {
    const savedRecord = structuredClone(record), savedEvidence = structuredClone(evidence);
    try {
        Object.assign(record, { independentReview: 'accepted', reviewer: 'test-only', reviewReport: 'test-only', evidenceHash: evidence.payloadHash, structureHash: structure.hash, reviewedRunIdentities: [] });
        Object.assign(evidence, { structureHash: structure.hash, audit: { ...evidence.audit, pass: true } });
        let run = initialRun(undefined, undefined, initOptionsFor(DEFAULT_MODEL));
        for (let month = 0; month <= 60; month++) {
            (record.reviewedRunIdentities as string[]).push(qualificationIdentity(DEFAULT_MODEL, run));
            const otherPlatform = structuredClone(run);
            otherPlatform.state.countryData.HUN.conditionalWellbeing!.income += 1.4210854715202004e-14;
            otherPlatform.state.countryData.HUN.conditionalWellbeing!.raw += 1.4210854715202004e-14;
            otherPlatform.state.conditionalSummary!.rawPopulationWeighted += 1.4210854715202004e-14;
            expect(resolveQualification(DEFAULT_MODEL, otherPlatform).accounting).toBe('reviewed-conditional');
            if (month < 60)
                run = advanceRun(run, { model: DEFAULT_MODEL });
        }
        for (const edit of [
            (r: typeof run) => { r.state.countryData.USA.laborForcePerResident! += 1e-12; },
            (r: typeof run) => { r.corporations[0].marketCap += 1e-10; },
            (r: typeof run) => { r.state.importedUnverified = true; },
            (r: typeof run) => { r.state.countryData.USA.conditionalWellbeing!.raw += .01; },
        ]) {
            const altered = structuredClone(run);
            edit(altered);
            expect(resolveQualification(DEFAULT_MODEL, altered).accounting).toBe('unreviewed');
        }
        expect(resolveQualification(DEFAULT_MODEL, run, {}).accounting).toBe('unreviewed');
    }
    finally {
        Object.assign(record, savedRecord);
        Object.assign(evidence, savedEvidence);
    }
});

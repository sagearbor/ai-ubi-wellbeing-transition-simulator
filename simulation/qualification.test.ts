import { describe, it, expect } from 'vitest';
import record from '../data/qualification/world-conditional-v1.json';
import { DEFAULT_MODEL } from '../constants';
import { initialRun, initOptionsFor } from './run';
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

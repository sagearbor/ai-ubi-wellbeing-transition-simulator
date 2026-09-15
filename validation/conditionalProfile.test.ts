import { describe, it, expect } from 'vitest';
import { DEFAULT_MODEL_ID } from '../constants';
import { defaultScenario } from './responseProfile';
import { conditionalCases, profileConditionalCase, auditConditionalProfile, runConditionalProfile } from './conditionalProfile';
describe('actual default response evidence', () => {
    it('selects actual shipped default', () => expect(defaultScenario().model.id).toBe(DEFAULT_MODEL_ID));
    it('records all months, components and population coverage', () => { const p = profileConditionalCase(conditionalCases()[0], 2); expect(p.months.map(m => m.month)).toEqual([0, 1, 2]); expect(p.months[0].countries.USA.conditionalWellbeing?.raw).toBeTypeOf('number'); expect(p.months[0].realizedWellbeing).toBeNull(); expect(p.months[0].summary?.countryCount).toBe(128); });
    it('counts failures and omitted cases instead of hiding them', () => { const p = runConditionalProfile({ months: 1, cases: conditionalCases().slice(0, 2) }); expect(auditConditionalProfile(p).missing).toBeGreaterThan(0); const bad = structuredClone(p); bad.cases[0].months = []; expect(auditConditionalProfile(bad).incomplete).toBeGreaterThan(0); });
    it('actually moves contribution away from zero and crosses exhaustion', () => { const cases = conditionalCases(); expect(cases.find(c => c.id === 'absolute-zero-contributionRate-plus')!.scenario.corporations.every(c => c.contributionRate > 0)).toBe(true); const p = profileConditionalCase(cases.find(c => c.id === 'funding-exhaustion-1.001')!, 1); expect(p.months[0].accounting!.unfunded).toBeGreaterThan(0); });
});
it('detects doubled effects, unit mismatches and nonfinite raw diagnostics', () => {
    const p = runConditionalProfile({ months: 1, cases: conditionalCases().slice(0, 1) });
    for (const mutate of [(m: any) => m.countries.USA.conditionalWellbeing.transfer += 1, (m: any) => m.countries.USA.conditionalWellbeing.transferRatio *= 1000, (m: any) => m.countries.USA.gdpPerCapita = Infinity]) {
        const bad = structuredClone(p);
        mutate(bad.cases[0].months[0]);
        expect(auditConditionalProfile(bad).outputFailures).toBeGreaterThan(0);
    }
});
it('relative contribution nudges preserve every heterogeneous corporate rate', () => {
    const cases = conditionalCases(), base = cases[0], plus = cases.find(c => c.id === 'relative-contributionRate-0.01')!;
    plus.scenario.corporations.forEach((c, i) => expect(c.contributionRate).toBeCloseTo(Math.min(1, base.scenario.corporations[i].contributionRate * 1.01), 12));
    const b = profileConditionalCase(base, 1), p = profileConditionalCase(plus, 1);
    expect(p.months[1].summary!.rawPopulationWeighted).toBeGreaterThan(b.months[1].summary!.rawPopulationWeighted);
});
it('includes all required dose/population combinations and cryptographic baseline identities', () => {
    const cases = conditionalCases();
    expect(cases.filter(c => c.kind === 'joint-dose-population')).toHaveLength(81);
    expect(profileConditionalCase(cases[0], 0).months[0].identity).toMatch(/^[a-f0-9]{64}$/);
});
it('macro cap neighbors remain feasible and cross their raw numerical thresholds', () => {
    for (const name of ['unemployment', 'cognitive-unemployment']) {
        const cases = conditionalCases().filter(c => c.id.startsWith(`${name}-cap-neighbor-`));
        const results = cases.map(c => profileConditionalCase(c, 1));
        expect(results.every(c => c.failure === null)).toBe(true);
        const raw = results.map(c => name === 'unemployment' ? c.months[1].countries.USA.macroDiagnostics!.rawUnemployment : c.months[1].countries.USA.macroDiagnostics!.rawCognitiveUnemployment);
        const bound = name === 'unemployment' ? .6 : .9;
        expect(raw[0]).toBeLessThan(bound);
        expect(raw[1]).toBeCloseTo(bound, 12);
        expect(raw[2]).toBeGreaterThan(bound);
    }
});

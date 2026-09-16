import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { analyze, validatePredictions, skill, sealAttempt, verifyBindings } from './family-20260916';
const origin = { originYear: 2018, excluded: [{ id: 'CCC', reason: 'Synthetic missing origin' }], countries: [
    { id: 'AAA', name: 'A', ladder: 5, gdp: 100 }, { id: 'BBB', name: 'B', ladder: 6, gdp: 200 },
] };
const predictions = () => origin.countries.flatMap(c => Array.from({ length: 7 }, (_, i) => ({
    id: c.id, name: c.name, year: 2019 + i, horizon: i + 1, ladder: c.ladder + .25, gdp: c.gdp * 1.1, originLadder: c.ladder, originGdp: c.gdp,
})));
describe('sealed forecast-family evaluation using synthetic data only', () => {
    it('requires complete finite predictions with exact origin values', () => {
        expect(() => validatePredictions(predictions(), origin)).not.toThrow();
        for (const mutate of [
            (p: ReturnType<typeof predictions>) => p.pop(),
            (p: ReturnType<typeof predictions>) => { p[0].gdp = NaN; },
            (p: ReturnType<typeof predictions>) => { p[0].originLadder = 4; },
            (p: ReturnType<typeof predictions>) => { p[0] = p[1]; },
            (p: ReturnType<typeof predictions>) => { p[0].ladder = 11; },
        ]) { const p = predictions(); mutate(p); expect(() => validatePredictions(p, origin)).toThrow(); }
    });
    it('uses identical masks, original GDP units, and transparent missing endpoint coverage', () => {
        const result = analyze(predictions(), origin, { ladder: { AAA: { 2019: 5.5, 2025: 5.5 } }, gdp: { BBB: { 2019: 220, 2025: 220 } } });
        expect(result.analysis.ladder.primaryEndpoint.model.mae).toBe(.25);
        expect(result.analysis.ladder.primaryEndpoint.persistence.mae).toBe(.5);
        expect(result.analysis.ladder.primaryEndpoint.skill.value).toBe(.5);
        expect(result.analysis.ladder.primaryEndpoint.unscored).toBe(1);
        expect(result.analysis.gdp.primaryEndpoint.persistence.mae).toBe(10);
        expect(result.analysis.gdp.primaryEndpoint.model.mae).toBeCloseTo(0, 10);
        expect(result.analysis.ladder.byHorizon[1].model.mae).toBeNull();
        expect(result.excludedOriginCountries).toEqual(origin.excluded);
        expect(result.analysis.ladder.countryContributions.reduce((s: number, x: any) => s + (x.endpointMaeImprovementContribution ?? 0), 0)).toBe(.25);
    });
    it('does not turn an undefined skill ratio into success', () => {
        expect(skill(0, 0).value).toBeNull();
        expect(skill(null, null).value).toBeNull();
        expect(skill(2, 1).value).toBe(-1);
    });
    it('retains an exclusive first-attempt receipt and detects binding tampering', () => {
        const dir = mkdtempSync(join(tmpdir(), 'family-synthetic-'));
        try {
            const receipt = join(dir, 'receipt.json');
            sealAttempt(receipt, { status: 'started' });
            expect(() => sealAttempt(receipt, { status: 'overwritten' })).toThrow();
            expect(JSON.parse(readFileSync(receipt, 'utf8')).status).toBe('started');
            writeFileSync(join(dir, 'input'), 'original');
            const bindings = { input: createHash('sha256').update('original').digest('hex') };
            expect(() => verifyBindings(bindings, dir)).not.toThrow();
            writeFileSync(join(dir, 'input'), 'changed');
            expect(() => verifyBindings(bindings, dir)).toThrow(/drift/);
        } finally { rmSync(dir, { recursive: true, force: true }); }
    });
});

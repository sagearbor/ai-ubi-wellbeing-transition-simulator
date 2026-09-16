import { describe, expect, it } from 'vitest';
import { analyzeObjective, objectivePanel, validateObjective } from './family-objective-20260916';

const countries = [{ id: 'AAA', name: 'A', originIncomeQuartile: 1, availability: { lifeExpectancy: { origin: 60 }, gdp: { origin: 100 } } }];
const predictions = () => Array.from({ length: 45 }, (_, i) => (['lifeExpectancy', 'gdp'] as const).map(target => ({
    id: 'AAA', name: 'A', target, year: 1981 + i, horizon: i + 1, originYear: 1980,
    unit: target === 'gdp' ? 'constant-2015 USD per person' : 'years', originValue: target === 'gdp' ? 100 : 60,
    prediction: target === 'gdp' ? 120 : 62, rawPrediction: target === 'gdp' ? 120 : 62,
}))).flat();
const response = (indicator: string, value: number | null, year = 1981) => [{ page: 1, pages: 1, total: 1 }, [{ countryiso3code: 'AAA', date: String(year), indicator: { id: indicator }, value }]];

describe('registered objective evaluator', () => {
    it('requires all country-target-year forecasts and correct units/origins', () => {
        expect(() => validateObjective(predictions(), countries)).not.toThrow();
        expect(() => validateObjective(predictions().slice(1), countries)).toThrow(/coverage/);
        const p = predictions(); p[1] = { ...p[0] };
        expect(() => validateObjective(p, countries)).toThrow(/Duplicate/);
        const q = predictions(); q[0].unit = 'ladder';
        expect(() => validateObjective(q, countries)).toThrow(/unit/);
    });
    it('rejects incomplete pages, wrong indicator, duplicate and out-of-period outcomes', () => {
        const r = response('SP.DYN.LE00.IN', 65) as any;
        r[0].pages = 2; expect(() => objectivePanel(r, 'lifeExpectancy', countries)).toThrow(/Incomplete/);
        expect(() => objectivePanel(response('wrong', 65), 'lifeExpectancy', countries)).toThrow(/boundary/);
        expect(() => objectivePanel(response('SP.DYN.LE00.IN', 65, 1980), 'lifeExpectancy', countries)).toThrow(/boundary/);
        const d = response('SP.DYN.LE00.IN', 65) as any; d[1].push(d[1][0]); d[0].total = 2;
        expect(() => objectivePanel(d, 'lifeExpectancy', countries)).toThrow(/Duplicate/);
    });
    it('preserves endpoint missingness and separates life years from GDP growth points', () => {
        const r = analyzeObjective(predictions(), countries, { lifeExpectancy: response('SP.DYN.LE00.IN', 65), gdp: response('NY.GDP.PCAP.KD', 140) });
        expect(r.analysis.lifeExpectancy.pooled.model.mae).toBe(3);
        expect(r.analysis.lifeExpectancy.pooled.persistence.mae).toBe(5);
        expect(r.analysis.lifeExpectancy.pooled.skill.value).toBeCloseTo(.4);
        expect(r.analysis.gdp.pooled.model.mae).toBe(20);
        expect(r.analysis.gdp.pooled.persistence.mae).toBe(40);
        expect(r.analysis.gdp.pooled.skill.value).toBe(.5);
        expect(r.analysis.lifeExpectancy.primaryEndpoint.model.mae).toBeNull();
        expect(r.analysis.lifeExpectancy.primaryEndpoint.skill.value).toBeNull();
        expect(r.analysis.lifeExpectancy.byHorizon).toHaveLength(45);
        expect(r.analysis.gdp.pooled.unscored).toBe(44);
        expect(r.analysis.gdp.countryContributions[0].pooledMaeImprovementContribution).toBe(20);
    });
    it('treats invalid targets as jointly missing and a zero baseline denominator as undefined', () => {
        const r = analyzeObjective(predictions(), countries, { lifeExpectancy: response('SP.DYN.LE00.IN', null, 2025), gdp: response('NY.GDP.PCAP.KD', 100, 2025) });
        expect(r.analysis.lifeExpectancy.primaryEndpoint.observed).toBe(0);
        expect(r.analysis.gdp.primaryEndpoint.skill.value).toBeNull();
        expect(r.analysis.gdp.primaryEndpoint.skill.reason).toMatch(/Zero/);
        const r2 = analyzeObjective(predictions(), countries, { lifeExpectancy: response('SP.DYN.LE00.IN', 150), gdp: response('NY.GDP.PCAP.KD', -1) });
        expect(r2.analysis.lifeExpectancy.pooled.model.n).toBe(0);
        expect(r2.analysis.gdp.pooled.persistence.n).toBe(0);
    });
});

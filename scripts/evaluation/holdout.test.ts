import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { captureDefaults } from './capture-defaults';
import { prepare, validateBackground, type Raw } from './partition';
import { fit } from './fit';
import { predict, initialHistoricalState, evaluationModel } from './predict';
import { score, metrics } from './score';
import { stepSimulationPure } from '../../simulation/pure';
const base = 'data/evaluation/level-holdout-2018/';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const raw = Object.fromEntries(Object.entries(read(base + 'sources/provenance.json')).map(([id, v]: [
    string,
    any
]) => [id, read(v.path)])) as Raw;
const roster = read('data/countries/wb-2026-09.json').countries.map(({ id, name }: any) => ({ id, name }));
const ladder = read('data/hindcast/wellbeing-ladder.json').data, gdp = read('data/hindcast/gdp-per-capita.json').data;
const partition = () => prepare(roster, raw, ladder, gdp);
describe('registered holdout integrity', () => {
    it('reproduces persisted partitions, frozen fit, predictions and independent scores exactly', () => {
        const p = partition(), k = fit(p.train), pred = predict(p.origin, k), scored = score(pred, p.test);
        expect(p.train).toEqual(read(base + 'train.json'));
        expect(p.origin).toEqual(read(base + 'origin.json'));
        expect(p.test).toEqual(read(base + 'test-outcomes.json'));
        const stored = read(base + 'frozen-fit.json');
        expect(k.coefficients).toEqual(stored.coefficients);
        expect(k.training).toEqual(stored.training);
        expect(pred).toEqual(read(base + 'predictions.json').rows);
        const storedScores = read(base + 'scores.json');
        expect(scored.rows).toEqual(storedScores.rows);
        expect(scored.outcomes).toEqual(storedScores.outcomes);
        const artifact = read(base + 'experience.json');
        for (const [file, expected] of Object.entries(artifact.artifactHashes))
            expect(createHash('sha256').update(readFileSync(base + file)).digest('hex')).toBe(expected);
        for (const [file, expected] of Object.entries(artifact.sourceHashes))
            expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(expected);
    });
    it('matches pre-edit full-output hashes with omitted and explicit current coefficients', () => {
        const before = read(base + 'default-before.json');
        expect(captureDefaults()).toEqual(before);
        expect(captureDefaults(true)).toEqual(before);
    });
    it('rejects nonfinite frozen engine calibration', () => { const p = partition(); expect(() => stepSimulationPure({
        state: initialHistoricalState(p.origin), corporations: [], model: evaluationModel, wellbeingAnchorCoefficients: { intercept: NaN, lnGdp: 1, governance: 1 }
    })).toThrow(/finite/); });
    it('future outcome changes cannot affect fit, origin/cohort, predictions or training exclusions', () => {
        const p = partition(), futureL = structuredClone(ladder), futureG = structuredClone(gdp);
        for (const panel of [futureL, futureG])
            for (const rows of Object.values(panel) as Record<string, number>[])
                for (const year of Object.keys(rows))
                    if (Number(year) > 2018)
                        rows[year] *= .8;
        const q = prepare(roster, raw, futureL, futureG);
        expect(q.train).toEqual(p.train);
        expect(q.origin).toEqual(p.origin);
        const k = fit(p.train);
        expect(fit(q.train)).toEqual(k);
        expect(predict(q.origin, fit(q.train))).toEqual(predict(p.origin, k));
    });
    it('rejects future-dated historical features and training outcomes', () => {
        const p = partition(), b = structuredClone(p.train.countries[0]);
        b.gini.year = 2016;
        expect(() => validateBackground(b)).toThrow(/historical/);
        p.train.ladder[p.train.countries[0].id]['2019'] = 5;
        expect(() => fit(p.train)).toThrow(/Unexpected/);
        const changed = structuredClone(raw);
        changed['GE.EST'][1].find(r => r.countryiso3code === p.train.countries[0].id)!.date = '2024';
        expect(() => prepare(roster, changed, ladder, gdp)).toThrow(/Future/);
    });
    it('passes the identical frozen coefficients to all 84 full-engine calls', () => {
        const p = partition(), k = fit(p.train);
        let calls = 0, first: any;
        predict(p.origin, k, input => { calls++; expect(input.wellbeingAnchorCoefficients).toEqual(k.coefficients); expect(Object.isFrozen(input.wellbeingAnchorCoefficients)).toBe(true); if (first)
            expect(input.wellbeingAnchorCoefficients).toBe(first); first = input.wellbeingAnchorCoefficients; return stepSimulationPure(input); });
        expect(calls).toBe(84);
        const a = predict(p.origin, k), b = predict(p.origin, { ...k, coefficients: { intercept: 10, lnGdp: 0, governance: 0 } });
        expect(a).not.toEqual(b);
    });
    it('neutral inactive fields and current dataset population have no effect on evaluated outcomes', () => {
        const p = partition(), k = fit(p.train), baseline = predict(p.origin, k), state = initialHistoricalState(p.origin);
        state.countryDataset = 'countries-legacy-v1';
        for (const c of Object.values(state.countryData)) {
            c.cognitiveShare = .9;
            c.naturalUnemployment = .2;
            c.socialResilience = .1;
            c.gini = .7;
            c.corruption = .8;
            c.archetype = 'failed-state';
            c.population *= 2;
            c.participatesInGlobalUBI = false;
            c.nationalPolicy = { allowsDirectWallet: false, localTaxOnUbi: .3, corporateIncentives: .5 };
        }
        const varied = predict(p.origin, k, input => stepSimulationPure({ ...input, model: {
                ...input.model, gdpScaling: 100, displacementRate: 1, macro: {
                    ...input.model.macro!, productivityGain: 10, automationShare: 1, laborShareSensitivity: 1, reemploymentMonths: 4, ubiEffectPerDoubling: 50, unemploymentEffectPerPoint: 50
                }
            } }), state);
        expect(varied).toEqual(baseline);
    });
    it('removing final outcomes preserves earlier scores; independent masks equal persistence', () => {
        const p = partition(), pred = predict(p.origin, fit(p.train));
        const original = score(pred, p.test);
        const removed = structuredClone(p.test);
        for (const panel of [removed.ladder, removed.gdp])
            for (const rows of Object.values(panel))
                delete rows['2025'];
        const after = score(pred, removed);
        expect(after.rows.filter(r => r.year < 2025)).toEqual(original.rows.filter(r => r.year < 2025));
        expect(after.rows.filter(r => r.year === 2025).every(r => r.error === null && r.persistenceError === null && r.reason)).toBe(true);
        for (const r of original.rows)
            expect(r.error === null).toBe(r.persistenceError === null);
        const id = pred[0].id;
        delete removed.ladder[id];
        const separate = score(pred, removed);
        expect(separate.rows.filter(r => r.id === id && r.outcome === 'gdp' && r.year < 2025)).toEqual(original.rows.filter(r => r.id === id && r.outcome === 'gdp' && r.year < 2025));
        expect(metrics([])).toEqual({
            n: 0, mae: null, rmse: null, bias: null, reason: 'No observed country-years'
        });
    });
    it('uses paired training only and records every excluded roster/year and origin country', () => {
        const p = partition();
        expect(fit(p.train).training.n + p.train.excluded.length).toBe(roster.length * 4);
        expect(p.origin.countries.length + p.origin.excluded.length).toBe(roster.length);
        expect(p.train.countries.every(c => c.ge.year === 2015 && c.rl.year === 2015 && c.cc.year === 2015 && c.population.year === 2015 && c.gini.year <= 2015)).toBe(true);
    });
});

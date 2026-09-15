import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL, DEFAULT_EQUATIONS, PRESET_MODELS, countriesForDataset } from '../constants';
import { initialRun, initOptionsFor, advanceRun, replayTo, runMonths, initializeConditionalOutputs, noCorporateUbiInputs } from './run';
import { allocateConditional, sourceBudget, requireCompatibleMoney, conditionalWorld } from './conditionalWorld';
import { parseEquationSet } from '../src/services/equationParser';
import { seekInHistory, stepBoth, historyFromSave, historyPoint } from './appState';
import { stepSimulationPure } from './pure';
import { decodeSharePayload, encodeSharePayload } from '../src/services/scenarioShare';
import type { SavedState } from '../types';
const initial = (model = DEFAULT_MODEL) => initialRun(undefined, undefined, initOptionsFor(model));
describe('conditional world reference', () => {
    it('reconciles independent below/at/above source arithmetic and all routes', () => {
        const run = initial();
        for (const [request, paid, unpaid, retained] of [[12.1875, 12.1875, 0, 12.1875], [24.375, 24.375, 0, 0], [36.5625, 24.375, 12.1875, 0]]) {
            for (const distributionStrategy of ['global', 'hq-local', 'customer-weighted'] as const) {
                const corp = { ...run.corporations[0], distributionStrategy, fundingRequest: { kind: 'amount' as const, monthlyBillions: request } };
                const b = sourceBudget(corp);
                expect(b.source).toBe(24.375);
                expect(b.actual).toBe(paid);
                expect(b.unfunded).toBe(unpaid);
                expect(b.slack).toBe(retained);
                const r = allocateConditional(run.state.countryData, [corp]);
                expect(Object.values(r.receipts).reduce((n, r) => n + r.global + r.local + r.customer, 0)).toBeCloseTo(paid, 12);
                expect(b.actual + b.slack + b.reservedForOtherUses).toBe(b.source);
                expect(b.actual + b.unfunded).toBe(request);
            }
        }
    });
    it('has consistent month-zero static macro and contemporaneous transfer mapping', () => {
        const model = { ...DEFAULT_MODEL, aiGrowthRate: 0, macro: { ...DEFAULT_MODEL.macro!, baselineGrowth: 0 } };
        const r = initial(model), next = advanceRun(r, { model });
        for (const c of Object.values(r.state.countryData)) {
            expect(c.gdpPerCapita).toBe(countriesForDataset().find(x => x.id === c.id)!.gdpPerCapita);
            expect(next.state.countryData[c.id].gdpPerCapita).toBeCloseTo(c.gdpPerCapita, 8);
            expect(next.state.countryData[c.id].conditionalWellbeing!.raw).toBeCloseTo(c.conditionalWellbeing!.raw, 12);
        }
        expect(r.state.sourceAccounting!.actual).toBeGreaterThan(0);
        expect(r.state.outputDefinition!.flowConvention).toBe('monthly-flow-at-month');
        expect(r.state.countryData.USA.observedInitialLadder).toBeDefined();
        const paired = initializeConditionalOutputs(r, noCorporateUbiInputs({ model }));
        expect(paired.ledger.monthlyInflow).toBe(0);
        expect(paired.state.countryData.USA.conditionalWellbeing!.transfer).toBe(0);
    });
    it('cannot feed conditional or observed wellbeing into corporate or macro dynamics', () => {
        const a = initial(), b = structuredClone(a);
        Object.values(b.state.countryData).forEach(c => { c.wellbeing = -999; c.wellbeingTrend = [-999]; c.conditionalWellbeing!.raw = 1e9; });
        const x = replayTo(a, 12, { model: DEFAULT_MODEL }), y = replayTo(b, 12, { model: DEFAULT_MODEL });
        expect(x.corporations).toEqual(y.corporations);
        expect(x.ledger).toEqual(y.ledger);
        for (const id of Object.keys(x.state.countryData)) {
            expect(x.state.countryData[id].gdpPerCapita).toBe(y.state.countryData[id].gdpPerCapita);
            expect(x.state.countryData[id].conditionalWellbeing).toEqual(y.state.countryData[id].conditionalWellbeing);
        }
    });
    it('retains raw large responses and disables full-roster headline', () => {
        const model = { ...DEFAULT_MODEL, conditional: { ...DEFAULT_MODEL.conditional!, transferEffectPerDoubling: 1e6 } };
        const r = initial(model);
        expect(r.state.conditionalSummary!.value).toBeNull();
        expect(r.state.conditionalSummary!.invalidCountryCount).toBeGreaterThan(0);
        expect(Math.max(...Object.values(r.state.countryData).map(c => c.conditionalWellbeing!.raw))).toBeGreaterThan(100);
    });
    it('workforce values do not depend on governance bucket crossings', () => {
        const base = initial();
        for (const t of [.35, .4, .5, .6, .8]) {
            const a = structuredClone(base), b = structuredClone(base);
            a.state.countryData.USA.governance = t - .0001;
            b.state.countryData.USA.governance = t + .0001;
            const x = advanceRun(a, { model: DEFAULT_MODEL }), y = advanceRun(b, { model: DEFAULT_MODEL });
            expect(x.state.countryData.USA.cognitiveShare).toBe(y.state.countryData.USA.cognitiveShare);
            expect(x.state.countryData.USA.unemployment).toBe(y.state.countryData.USA.unemployment);
        }
    });
    it('rejects missing recipients, partial roster, unknown money and invalid population', () => {
        const r = initial();
        const partial = structuredClone(r);
        delete partial.state.countryData.USA;
        expect(() => advanceRun(partial, { model: DEFAULT_MODEL })).toThrow(/complete/);
        expect(() => allocateConditional(r.state.countryData, [{ ...r.corporations[0], headquartersCountry: 'XXX' }])).toThrow(/unresolved/);
        expect(() => requireCompatibleMoney(undefined)).toThrow(/constant-2015/);
        expect(() => requireCompatibleMoney({ ...r.corporations[0].monetaryBasis!, currency: 'EUR' as 'USD' })).toThrow();
    });
    it('computes per-resident annual/monthly denominator without unit mixing', () => {
        const r = initial(), c = r.state.countryData.USA, w = c.conditionalWellbeing!;
        expect(w.transferRatio).toBeCloseTo(c.totalUbiReceived * 1000 / c.population / (c.gdpPerCapita * c.laborShare! / 12), 14);
        expect(w.nonIncomeUnemployment).toBe(0);
        expect(r.state.conditionalSummary!.assumedGdpCountryCount).toBe(2);
    });
    it('rejects 0 and -50 uploads in anchored and conditional modes; executes legacy flow hooks', () => {
        for (const value of ['0', '-50']) {
            const equations = parseEquationSet({ ...DEFAULT_EQUATIONS, wellbeingDelta: value }).compiledEquations!;
            for (const model of [DEFAULT_MODEL, PRESET_MODELS.find(m => m.id === 'evidence-anchored')!])
                expect(() => advanceRun(initial(model), { model, equations })).toThrow(/hooks are unsupported/);
            const model = PRESET_MODELS[0], r = initial(model), out = advanceRun(r, { model, equations });
            expect(out.state.averageWellbeing).toBeLessThanOrEqual(r.state.averageWellbeing);
        }
    });
    it('stops all horizon entry points atomically including both comparison orders and cached seek', () => {
        const model = PRESET_MODELS.find(m => m.id === 'us-reference-korinek')!, base = initial(model), r = replayTo(base, 60, { model }), before = JSON.stringify(r);
        for (const action of [() => advanceRun(r, { model }), () => stepSimulationPure({ state: r.state, corporations: r.corporations, model }), () => runMonths(base, 61, { model }), () => replayTo(base, 61, { model }), () => seekInHistory([{ month: 61, run: { ...r, state: { ...r.state, month: 61 } }, state: r.state }], 61, { model }, base), () => stepBoth(initial(), { model: DEFAULT_MODEL }, r, { model }), () => stepBoth(r, { model }, initial(), { model: DEFAULT_MODEL })])
            expect(action).toThrow(/outside supported scope/);
        expect(JSON.stringify(r)).toBe(before);
    });
    it('shares actual edited amounts and recomputes imported results, flagged unverified', () => {
        const r = initial();
        r.corporations[0].fundingRequest = { kind: 'amount', monthlyBillions: 36.5625 };
        r.state.conditionalSummary!.value = -999;
        const decoded = decodeSharePayload(encodeSharePayload(DEFAULT_MODEL, 'countries-wb-2026-09', r));
        expect(decoded.run!.corporations[0].sourceBudget!.unfunded).toBe(12.1875);
        expect(decoded.run!.state.conditionalSummary!.value).not.toBe(-999);
        expect(decoded.run!.state.importedUnverified).toBe(true);
        const saved = { model: DEFAULT_MODEL, run: r, baseRun: initial(), history: [historyPoint(r)], countryDataset: 'countries-wb-2026-09', month: 0 } as SavedState;
        expect(historyFromSave(saved).run.state.conditionalSummary!.value).not.toBe(-999);
    });
    it('uses the explicit additive unemployment assumption and keeps transfer-to-GDP absent', () => {
        const a=initial(), b=structuredClone(a);
        b.state.countryData.USA.unemployment=b.state.countryData.USA.naturalUnemployment!+0.01;
        const mapped=conditionalWorld({state:b.state,corporations:b.corporations,model:DEFAULT_MODEL},false,true);
        expect(mapped.state.countryData.USA.conditionalWellbeing!.nonIncomeUnemployment).toBeCloseTo(0.025,14);
        const paired=initializeConditionalOutputs(a,noCorporateUbiInputs({model:DEFAULT_MODEL}));
        const mainEnd=replayTo(a,12,{model:DEFAULT_MODEL}),zeroEnd=replayTo(paired,12,noCorporateUbiInputs({model:DEFAULT_MODEL}));
        for(const id of Object.keys(a.state.countryData)) expect(mainEnd.state.countryData[id].gdpPerCapita).toBe(zeroEnd.state.countryData[id].gdpPerCapita);
        const changed=structuredClone(a);changed.state.countryData.USA.cognitiveShare=0.2;
        expect(advanceRun(changed,{model:DEFAULT_MODEL}).state.countryData.USA.laborShare).not.toBe(advanceRun(a,{model:DEFAULT_MODEL}).state.countryData.USA.laborShare);
    });

});

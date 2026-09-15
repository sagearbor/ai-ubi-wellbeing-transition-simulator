/** Deterministic assumption scenarios, not uncertainty probabilities or causal validation. */
import { initialRun, initOptionsFor, advanceRun, type SimulationRun, type CountryBase } from '../simulation/run';
import { qualificationInputText } from '../simulation/qualification';
import { createHash } from 'node:crypto';
import { canonicalJson } from '../src/policy/hash';
const hashText = (s: string) => createHash('sha256').update(s).digest('hex');
const contentHash = (v: unknown) => hashText(canonicalJson(v));
import { defaultScenario, type Scenario } from './responseProfile';
import { countriesForDataset, COUNTRY_DATASET_ID } from '../constants';
import type { CountryStats } from '../types';
export interface ConditionalCase {
    id: string;
    kind: string;
    scenario: Scenario;
    countries?: CountryBase[];
    change?: {
        lever: string;
        requested: number;
        actual: number;
        base: number;
        boundary: boolean;
    };
}
/** Finite investigation ranges, not empirical support bounds; unbounded executable domains remain unbounded. */
export const CONDITIONAL_RANGES: Record<string, [
    number,
    number
]> = {
    contributionRate: [0, 1], availableShare: [0, 1], aiGrowthRate: [0, .1], baselineGrowth: [-.05, .1], productivityGain: [0, 3], automationShare: [0, 1], reemploymentMonths: [1, 60], laborShareSensitivity: [0, 1], transferEffectPerDoubling: [0, 10], nonIncomeLossPerAdditionalUnemployedPerson: [0, 30], incomeDenominatorMultiplier: [.1, 3], marketCap: [0, 10000], aiAdoptionLevel: [0, 1], cognitiveShare: [.01, 1], naturalUnemployment: [0, .6], laborForcePerResident: [0, 1], governance: [0, 1]
};
const corpKeys = ['contributionRate', 'availableShare', 'marketCap', 'aiAdoptionLevel'];
const conditionalKeys = ['transferEffectPerDoubling', 'nonIncomeLossPerAdditionalUnemployedPerson', 'incomeDenominatorMultiplier'];
const countryKeys = ['cognitiveShare', 'naturalUnemployment', 'laborForcePerResident', 'governance'];
function baseCase(): ConditionalCase { return { id: 'base', kind: 'baseline', scenario: defaultScenario() }; }
function valueOf(c: ConditionalCase, k: string): number {
    if (corpKeys.includes(k))
        return c.scenario.corporations.reduce((n, x) => n + ((x as any)[k] ?? 1), 0) / c.scenario.corporations.length;
    if (countryKeys.includes(k)) {
        const r = initialRun(c.scenario.corporations, c.countries, initOptionsFor(c.scenario.model));
        return (r.state.countryData.USA as any)[k];
    }
    return (conditionalKeys.includes(k) ? c.scenario.model.conditional : k === 'aiGrowthRate' ? c.scenario.model : c.scenario.model.macro as any)?.[k as never] as number;
}
function set(c: ConditionalCase, k: string, v: number): ConditionalCase {
    const out = structuredClone(c);
    if (corpKeys.includes(k))
        out.scenario.corporations = out.scenario.corporations.map(x => ({ ...x, [k]: v }));
    else if (countryKeys.includes(k)) {
        out.countries ??= structuredClone([...countriesForDataset(COUNTRY_DATASET_ID)]);
        out.countries = out.countries.map(x => x.id === 'USA' ? { ...x, [k]: v } : x);
    }
    else if (conditionalKeys.includes(k))
        out.scenario.model.conditional = { ...out.scenario.model.conditional!, [k]: v };
    else if (k === 'aiGrowthRate')
        out.scenario.model.aiGrowthRate = v;
    else
        out.scenario.model.macro = { ...out.scenario.model.macro!, [k]: v };
    return out;
}
export function conditionalCases(): ConditionalCase[] {
    const base = baseCase(), cases = [base];
    for (const [lever, [lo, hi]] of Object.entries(CONDITIONAL_RANGES)) {
        const b = valueOf(base, lever), eps = (hi - lo) * .001;
        const arms = [...[-.1, -.01, .01, .1].map(d => ({ kind: 'relative', v: b * (1 + d), tag: String(d) })), ...[-10, -1, 1, 10].map(d => ({ kind: 'absolute', v: b + d * eps, tag: String(d) })), ...[0, .25, .5, .75, 1].map(f => ({ kind: 'range', v: lo + f * (hi - lo), tag: String(f) }))];
        for (const a of arms) {
            let actual = Math.max(lo, Math.min(hi, a.v));
            let c = set(base, lever, actual);
            if (corpKeys.includes(lever) && a.kind !== 'range') {
                c = structuredClone(base);
                c.scenario.corporations = c.scenario.corporations.map(x => { const old = (x as any)[lever] ?? 1; const requested = a.kind === 'relative' ? old * (1 + Number(a.tag)) : old + (a.v - b); return { ...x, [lever]: Math.max(lo, Math.min(hi, requested)) }; });
                actual = valueOf(c, lever);
            }
            cases.push({ ...c, id: `${a.kind}-${lever}-${a.tag}`, kind: a.kind, change: { lever, requested: a.v, actual, base: b, boundary: Math.abs(actual - a.v) > 1e-12 } });
        }
    }
    cases.push({ ...set(base, 'contributionRate', .001), id: 'absolute-zero-contributionRate-plus', kind: 'near-zero', change: { lever: 'contributionRate', requested: .001, actual: .001, base: 0, boundary: true } });
    for (const boundary of [.35, .4, .5, .6, .8])
        for (const d of [-.0001, 0, .0001])
            cases.push({ ...set(base, 'governance', boundary + d), id: `legacy-governance-boundary-${boundary}-${d}`, kind: 'threshold-neighbor' });
    for (const factor of [.999, 1, 1.001, 2]) {
        const c = set(base, 'availableShare', .5);
        const initialized = initialRun(c.scenario.corporations, undefined, initOptionsFor(c.scenario.model));
        c.scenario.corporations = c.scenario.corporations.map(x => ({ ...x, fundingRequest: { kind: 'amount', monthlyBillions: initialized.corporations.find(y => y.id === x.id)!.sourceBudget!.available * factor } }));
        cases.push({ ...c, id: `funding-exhaustion-${factor}`, kind: 'funding-threshold' });
    }
    const strategies = ['global', 'customer-weighted', 'hq-local'] as const;
    let index = 0;
    for (const rate of [0, .5, 1])
        for (const strategy of strategies)
            for (const available of [.25, 1]) {
                const c = set(set(base, 'contributionRate', rate), 'availableShare', available);
                c.scenario.corporations = c.scenario.corporations.map(x => ({ ...x, distributionStrategy: strategy }));
                cases.push({ ...c, id: `joint-allocation-${index++}`, kind: 'joint' });
            }
    // Paired factorial extremes retain a feasible full roster; no sampled-case share is a probability.
    for (const growth of [0, .1])
        for (const automation of [0, 1])
            for (const months of [1, 60])
                cases.push({ ...set(set(set(base, 'aiGrowthRate', growth), 'automationShare', automation), 'reemploymentMonths', months), id: `joint-macro-${index++}`, kind: 'joint' });
    for (const beta of [0, 10])
        for (const denominator of [.1, 3])
            for (const loss of [0, 30])
                cases.push({ ...set(set(set(set(base, 'transferEffectPerDoubling', beta), 'incomeDenominatorMultiplier', denominator), 'nonIncomeLossPerAdditionalUnemployedPerson', loss), 'contributionRate', 1), id: `joint-mapping-${index++}`, kind: 'joint' });
    // Required dose/population bridge factorial: all resident labor-force fractions explicitly overridden.
    for (const loss of [0, 5, 10])
        for (const lf of [.35, .5, .65])
            for (const beta of [0, 2.8, 5.6])
                for (const denominator of [.5, 1, 2]) {
                    const c = set(set(set(base, 'nonIncomeLossPerAdditionalUnemployedPerson', loss), 'transferEffectPerDoubling', beta), 'incomeDenominatorMultiplier', denominator);
                    c.countries = structuredClone([...countriesForDataset(COUNTRY_DATASET_ID)]).map(x => ({ ...x, laborForcePerResident: lf }));
                    cases.push({ ...c, id: `joint-dose-population-${loss}-${lf}-${beta}-${denominator}`, kind: 'joint-dose-population' });
                }
    const initialized = initialRun(base.scenario.corporations, undefined, initOptionsFor(base.scenario.model)), us = initialized.state.countryData.USA;
    const serving = base.scenario.corporations.filter(c => c.operatingCountries.includes('USA'));
    const level = serving.reduce((n, c) => n + c.aiAdoptionLevel, 0) / serving.length;
    const growthAtCap = (.999 - us.aiAdoption) / ((1 + us.gdpPerCapita / 100000) * level * .1 * (1 - us.aiAdoption));
    for (const delta of [-.000001, 0, .000001])
        cases.push({ ...set(base, 'aiGrowthRate', growthAtCap + delta), id: `adoption-cap-neighbor-${delta}`, kind: 'numerical-bound-neighbor' });
    for (const boundary of [5000, 10000, 35000])
        for (const delta of [-.01, 0, .01]) {
            const c = structuredClone(base);
            c.countries = structuredClone([...countriesForDataset(COUNTRY_DATASET_ID)]).map(x => x.id === 'USA' ? { ...x, gdpPerCapita: boundary + delta } : x);
            cases.push({ ...c, id: `legacy-gdp-boundary-${boundary}-${delta}`, kind: 'legacy-threshold-neighbor' });
        }
    const atOne = advanceRun(initialized, { model: base.scenario.model }).state.countryData.USA;
    const lossAtFloor = (atOne.conditionalWellbeing!.income + atOne.conditionalWellbeing!.transfer) / ((atOne.unemployment! - atOne.naturalUnemployment!) * atOne.laborForcePerResident!);
    const betaAtCeiling = (100 - us.conditionalWellbeing!.income) / Math.log2(1 + us.conditionalWellbeing!.transferRatio);
    for (const delta of [-.000001, 0, .000001]) {
        cases.push({ ...set(base, 'nonIncomeLossPerAdditionalUnemployedPerson', lossAtFloor + delta), id: `mapping-floor-neighbor-${delta}`, kind: 'mapping-bound-neighbor' });
        cases.push({ ...set(base, 'transferEffectPerDoubling', betaAtCeiling + delta), id: `mapping-ceiling-neighbor-${delta}`, kind: 'mapping-bound-neighbor' });
    }
    // Both macro numerical caps: solve the natural-rate input giving the exact first-month raw bound.
    const stress = set(set(set(base, 'aiGrowthRate', 100), 'automationShare', .5), 'naturalUnemployment', 0);
    const stressStart = initialRun(stress.scenario.corporations, stress.countries, initOptionsFor(stress.scenario.model));
    const stressUs = advanceRun(stressStart, { model: stress.scenario.model }).state.countryData.USA;
    for (const [name, target, excess] of [['unemployment', .6, stressUs.displacedPool!], ['cognitive-unemployment', .9, stressUs.displacedPool! / stressUs.cognitiveShare!]] as const) {
        const natural = target - excess;
        for (const delta of [-.000001, 0, .000001])
            cases.push({ ...set(stress, 'naturalUnemployment', natural + delta), id: `${name}-cap-neighbor-${delta}`, kind: 'numerical-bound-neighbor' });
    }
    // Deliberately extreme values expose numerical/output bounds, not a preferred calmness ceiling.
    cases.push({ ...set(base, 'aiGrowthRate', 100), id: 'numerical-adoption-cap', kind: 'numerical-bound' });
    cases.push({ ...set(set(base, 'transferEffectPerDoubling', 1000), 'contributionRate', 1), id: 'raw-outside-scale', kind: 'mapping-bound' });
    return cases;
}
function capture(run: SimulationRun, scenario: Scenario) {
    const countries = Object.fromEntries(Object.entries(run.state.countryData).map(([id, c]) => [id, {
            population: c.population, gdpPerCapita: c.gdpPerCapita, gdpNoAi: c.gdpNoAi, laborShare: c.laborShare, laborIncomeAnnual: c.gdpPerCapita * (c.laborShare ?? 0), unemployment: c.unemployment, cognitiveUnemployment: c.cognitiveUnemployment, aiAdoption: c.aiAdoption,
            cognitiveShare: c.cognitiveShare, naturalUnemployment: c.naturalUnemployment, laborForcePerResident: c.laborForcePerResident, conditionalWellbeing: c.conditionalWellbeing, macroDiagnostics: c.macroDiagnostics, adoptionDiagnostics: c.adoptionDiagnostics,
            transferMonthlyBillions: c.ubiReceivedGlobal + c.ubiReceivedLocal + c.ubiReceivedCustomerWeighted, observedInitialLadder: c.observedInitialLadder
        }]));
    return { month: run.state.month, identity: hashText(qualificationInputText(scenario.model, run)), realizedWellbeing: null, summary: run.state.conditionalSummary, accounting: run.state.sourceAccounting, countries,
        budgets: run.corporations.map(c => ({ id: c.id, ...c.sourceBudget })),
        constraints: { mappingOutsideScale: Object.values(run.state.countryData).filter(c => !c.conditionalWellbeing?.valid).map(c => c.id), adoptionCap: Object.values(run.state.countryData).filter(c => c.adoptionDiagnostics?.capActive).map(c => c.id), unemploymentCap: Object.values(run.state.countryData).filter(c => c.macroDiagnostics?.unemploymentCapActive || c.macroDiagnostics?.cognitiveUnemploymentCapActive).map(c => c.id), fundingExhausted: run.corporations.filter(c => (c.sourceBudget?.unfunded ?? 0) > 0).map(c => c.id) } };
}
export function profileConditionalCase(c: ConditionalCase, months = 60) {
    const path: ReturnType<typeof capture>[] = [];
    let failure: string | null = null;
    try {
        let run = initialRun(c.scenario.corporations, c.countries, initOptionsFor(c.scenario.model));
        path.push(capture(run, c.scenario));
        for (let m = 1; m <= months; m++) {
            run = advanceRun(run, { model: c.scenario.model });
            path.push(capture(run, c.scenario));
        }
    }
    catch (e) {
        failure = e instanceof Error ? e.message : String(e);
    }
    return { id: c.id, kind: c.kind, inputHash: contentHash(c), inputs: c, change: c.change, months: path, failure };
}
export function runConditionalProfile(opts: {
    months?: number;
    cases?: ConditionalCase[];
} = {}) {
    const months = opts.months ?? 60, expected = conditionalCases();
    return { version: 'conditional-response-v1', modelId: defaultScenario().model.id, months, horizons: [1, 12, 24, 60].filter(x => x <= months), ranges: CONDITIONAL_RANGES, expectedIds: expected.map(c => c.id), expectedInputHashes: Object.fromEntries(expected.map(c => [c.id, contentHash(c)])), unsupported: ['realized wellbeing and adaptation timing', 'transfer-to-macro/demand feedback', 'net welfare', 'empirical probability'], cases: (opts.cases ?? expected).map(c => profileConditionalCase(c, months)) };
}
let cachedExpected: ConditionalCase[] | undefined;
export function auditConditionalProfile(p: ReturnType<typeof runConditionalProfile>) {
    const expected = cachedExpected ?? (cachedExpected = conditionalCases()), ids = p.cases.map(c => c.id), missing = expected.filter(c => !ids.includes(c.id)).length;
    let incomplete = 0, altered = 0, accountingFailures = 0, outputFailures = 0;
    const close = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
    const allFinite = (v: unknown): boolean => typeof v === 'number' ? Number.isFinite(v) : !v || typeof v !== 'object' || Object.values(v).every(allFinite);
    for (const c of p.cases) {
        const expectedCase = expected.find(x => x.id === c.id);
        if (!expectedCase || contentHash(c.inputs) !== contentHash(expectedCase) || c.inputHash !== contentHash(c.inputs))
            altered++;
        if (c.months.length !== p.months + 1 || c.months.some((m, i) => m.month !== i || Object.keys(m.countries).length !== 128))
            incomplete++;
        for (const m of c.months) {
            if (!allFinite(m))
                outputFailures++;
            for (const country of Object.values(m.countries)) {
                const w = country.conditionalWellbeing;
                if (!w) {
                    outputFailures++;
                    continue;
                }
                if (!close(w.raw, w.income + w.transfer - w.nonIncomeUnemployment) || !close(w.transferRatio, country.transferMonthlyBillions * 12000 / country.population / w.incomeDenominatorAnnual) || !close(w.transfer, c.inputs.scenario.model.conditional!.transferEffectPerDoubling * Math.log2(1 + w.transferRatio)))
                    outputFailures++;
            }
            for (const b of m.budgets)
                if (!close(b.source!, b.actual! + b.slack! + b.reservedForOtherUses!) || !close(b.requested!, b.actual! + b.unfunded!) || !close(b.actual!, Math.min(b.available!, b.requested!)))
                    outputFailures++;
            const a = m.accounting;
            if (!a || !Object.values(a).every(Number.isFinite) || Math.abs(a.residual) > 1e-8 * Math.max(1, a.source) || Math.abs(a.actual + a.unused + a.reserved - a.source) > 1e-8 * Math.max(1, a.source) || Math.abs(a.actual + a.unfunded - a.requested) > 1e-8 * Math.max(1, a.source))
                accountingFailures++;
        }
    }
    const failures = p.cases.filter(c => c.failure).length, duplicates = ids.length - new Set(ids).size;
    return { expected: expected.length, attempted: ids.length, completed: p.cases.filter(c => !c.failure && c.months.length === p.months + 1).length, missing, incomplete, altered, duplicates, failures, accountingFailures, outputFailures, pass: missing + incomplete + altered + duplicates + failures + accountingFailures + outputFailures === 0 };
}
export function renderConditionalMarkdown(p: ReturnType<typeof runConditionalProfile>, providedAudit?: ReturnType<typeof auditConditionalProfile>) {
    const audit = providedAudit ?? auditConditionalProfile(p), base = p.cases.find(c => c.id === 'base');
    const lines = ['# Conditional default response evidence', '', `Model: ${p.modelId}. Deterministic assumption grid; not a probability distribution.`, '', `Computational audit: ${JSON.stringify(audit)}. Independent review is separate.`, '', '| Month | Full-roster conditional index | Raw weighted | Invalid countries | Modeled residents (millions) | Source / funded (billions constant-2015 USD/month) |', '|---|---|---|---|---|---|'];
    for (const m of base?.months.filter(m => [0, ...p.horizons].includes(m.month)) ?? [])
        lines.push(`| ${m.month} | ${m.summary?.value ?? 'unavailable'} | ${m.summary?.rawPopulationWeighted} | ${m.summary?.invalidCountryCount} | ${m.summary?.populationMillions} | ${m.accounting?.source} / ${m.accounting?.actual} |`);
    lines.push('', '## Every attempted case', '', '| Case | Complete months | Failure | Raw headline min/max | Invalid country-months | Funding exhausted corporation-months |', '|---|---|---|---|---|---|');
    for (const c of p.cases) {
        const raw = c.months.map(m => m.summary!.rawPopulationWeighted);
        lines.push(`| ${c.id} | ${c.months.length} | ${c.failure ?? 'none'} | ${raw.length ? `${Math.min(...raw)} / ${Math.max(...raw)}` : 'missing'} | ${c.months.reduce((n, m) => n + m.constraints.mappingOutsideScale.length, 0)} | ${c.months.reduce((n, m) => n + m.constraints.fundingExhausted.length, 0)} |`);
    }
    lines.push('', '## Declared range directions at month 60', '', '| Lever | Raw index minimum | Raw index maximum | Direction reversals across sampled range |', '|---|---|---|---|');
    for (const lever of Object.keys(CONDITIONAL_RANGES)) {
        const rows = p.cases.filter(c => c.kind === 'range' && c.change?.lever === lever).sort((a, b) => a.change!.actual - b.change!.actual);
        const ys = rows.map(c => c.months.at(-1)?.summary?.rawPopulationWeighted).filter((y): y is number => y !== undefined);
        const signs = ys.slice(1).map((y, i) => Math.sign(y - ys[i])).filter(x => x !== 0);
        const reversals = signs.slice(1).filter((x, i) => x !== signs[i]).length;
        lines.push(`| ${lever} | ${Math.min(...ys)} | ${Math.max(...ys)} | ${reversals} |`);
    }
    lines.push('', '## Material investigation triggers', '', 'These are selected review triggers, not benefit/harm limits: paired raw population-weighted index difference ≥1 point or US GDP difference ≥5% at months 1/12/24/60. Any invalid-country or active numerical cap also requires explanation. Comparisons use the complete same roster; raw differences are diagnostics when either full-roster headline is unavailable.', '', '| Case | Month | Raw index difference | US GDP difference % |', '|---|---|---|---|');
    for (const c of p.cases)
        for (const m of c.months.filter(m => p.horizons.includes(m.month))) {
            const b = base?.months.find(x => x.month === m.month);
            if (!b)
                continue;
            const d = m.summary!.rawPopulationWeighted - b.summary!.rawPopulationWeighted;
            const g = 100 * (m.countries.USA.gdpPerCapita / b.countries.USA.gdpPerCapita - 1);
            if (Math.abs(d) >= 1 || Math.abs(g) >= 5)
                lines.push(`| ${c.id} | ${m.month} | ${d} | ${g} |`);
        }
    lines.push('', 'Realized wellbeing is unavailable in every case. The raw conditional mapping is not an adaptation path. All country components, monthly macro values, budget identities, raw caps and actual input hashes are retained in the compressed JSON artifact. Regions without operating corporations can have disconnected adoption; this is a missing diffusion channel, not evidence of resilience. Governance threshold probes locate legacy bucket boundaries; those workforce discontinuities are absent from this version.');
    return lines.join('\n');
}

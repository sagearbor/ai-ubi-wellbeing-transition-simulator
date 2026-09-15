/** Conditional accounting only. No wellbeing value is consumed by any economic equation here. */
import type { Corporation, CountryStats, ModelParameters, MonetaryBasis, SourceBudget } from '../types';
import type { SimulationInput, SimulationOutput } from './pure';
import { applyMacroDynamics, stateCountryDataset } from './pure';
import { countriesForDataset, countryDatasetFile, wellbeingAnchorCoefficientsFor } from '../constants';
import workforce from '../data/countries/conditional-workforce-v1.json';
import { applyUsReference, usReferencePath, portStepForWorldMonth } from './usReference';
import { usdPerPerson } from './units';
import { RunScopeError, resolveRunCapabilities, assertRunSupported } from './capabilities';
export const CONDITIONAL_MONEY: MonetaryBasis = {
    currency: 'USD', priceYear: 2015, observationYear: null, status: 'dated-assumption', source: 'conditional-assumptions-v1: newly authored hypothetical constant-2015 USD corporate stock and monthly flows; no historical conversion from unknown vintage'
};
const fail = (message: string): never => {
    throw new RunScopeError('invalid-scenario', message);
};
function finite(n: number, name: string, min = 0, max = Infinity): number {
    if (!Number.isFinite(n) || n < min || n > max)
        fail(`${name} must be finite in [${min},${max}]`);
    return n;
}
/** Reject nonrepresentable totals before they can become JSON nulls. */
function sumFinite(values: Iterable<number>, name: string): number {
    let total = 0;
    for (const value of values) total = finite(total + finite(value, name), name);
    return total;
}

function validateMacroState(country: CountryStats): void {
    const prefix = country.id;
    finite(country.population, `${prefix}.population`, Number.MIN_VALUE);
    finite(country.aiAdoption, `${prefix}.aiAdoption`, 0, 1);
    finite(country.lastAiAdoption!, `${prefix}.lastAiAdoption`, 0, 1);
    finite(country.gdpPerCapita, `${prefix}.gdpPerCapita`, Number.MIN_VALUE);
    finite(country.gdpNoAi!, `${prefix}.gdpNoAi`, Number.MIN_VALUE);
    finite(country.governance, `${prefix}.governance`, 0, 1);
    finite(country.cognitiveShare!, `${prefix}.cognitiveShare`, Number.MIN_VALUE, 1);
    finite(country.naturalUnemployment!, `${prefix}.naturalUnemployment`, 0, 0.6);
    finite(country.displacedPool!, `${prefix}.displacedPool`, 0, 1 - country.naturalUnemployment!);
    finite(country.laborShare!, `${prefix}.laborShare`, Number.MIN_VALUE, 1);
    finite(country.unemployment!, `${prefix}.unemployment`, 0, 1);
    if (country.cognitiveUnemployment !== undefined) finite(country.cognitiveUnemployment, `${prefix}.cognitiveUnemployment`, 0, 1);
    finite(country.laborForcePerResident!, `${prefix}.laborForcePerResident`, 0, 1);
}

/** Validate composed published diagnostics, including signed raw mapping values. */
function assertFiniteNumbers(value: unknown, path: string): void {
    if (typeof value === 'number' && !Number.isFinite(value)) fail(`${path} is not a representable finite number`);
    if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) assertFiniteNumbers(child, `${path}.${key}`);
    }
}

export function requireCompatibleMoney(basis: MonetaryBasis | undefined): void {
    if (!basis || basis.currency !== 'USD' || basis.priceYear !== 2015)
        fail('Conditional ratios require a declared constant-2015 USD basis; unknown vintages cannot be converted implicitly.');
}
export function sourceBudget(c: Corporation): SourceBudget {
    requireCompatibleMoney(c.monetaryBasis);
    const source = finite(c.marketCap, 'marketCap') * finite(c.aiAdoptionLevel, 'aiAdoptionLevel', 0, 1) * 0.15 / 12;
    finite(source, 'monthly modeled source');
    const available = source * finite(c.availableShare ?? 1, 'availableShare', 0, 1);
    const kind = c.fundingRequest?.kind ?? 'share';
    if (kind !== 'share' && kind !== 'amount')
        fail('Unknown funding request kind');
    const requested = kind === 'amount' && c.fundingRequest?.kind === 'amount' ? finite(c.fundingRequest.monthlyBillions, 'requested monthly amount') : source * finite(c.contributionRate, 'contributionRate', 0, 1);
    const actual = Math.min(requested, available);
    return {
        name: 'modeled-source-pool',
        unit: 'billion-constant-2015-USD/month',
        source,
        reservedForOtherUses: source - available,
        requested,
        available,
        actual,
        slack: available - actual,
        unfunded: requested - actual,
        assumptionId: 'conditional-assumptions-v1'
    };
}
/** Pure allocation over an explicitly complete supplied roster, useful for independent hand fixtures. */
export function allocateConditional(countries: Record<string, CountryStats>, corps: Corporation[]) {
    const ids = Object.keys(countries);
    if (!ids.length || ids.some(id => countries[id].id !== id))
        fail('Country roster must have unique matching IDs');
    ids.forEach(id => finite(countries[id].population, `${id}.population`, Number.MIN_VALUE));
    const receipts = Object.fromEntries(ids.map(id => [id, {
            global: 0, local: 0, customer: 0
        }]));
    const budgets: Record<string, SourceBudget> = {};
    for (const c of corps) {
        if (budgets[c.id])
            fail('Duplicate corporation ID');
        if (!countries[c.headquartersCountry] || !c.operatingCountries.length || new Set(c.operatingCountries).size !== c.operatingCountries.length || c.operatingCountries.some(id => !countries[id]))
            fail(`${c.id}: unresolved HQ/operating-country residents`);
        const budget = budgets[c.id] = sourceBudget(c);
        const route = c.distributionStrategy;
        if (!['global', 'customer-weighted', 'hq-local'].includes(route))
            fail('Unknown allocation strategy');
        const destinations = route === 'global' ? ids : route === 'hq-local' ? [c.headquartersCountry] : c.operatingCountries;
        const population = sumFinite(destinations.map(id => countries[id].population), 'destination population');
        const key = route === 'global' ? 'global' : route === 'hq-local' ? 'local' : 'customer';
        destinations.forEach(id => {
            const residentShare = countries[id].population / population;
            receipts[id][key] = finite(receipts[id][key] + budget.actual * residentShare, `${id} receipts`);
        });
    }
    assertFiniteNumbers(budgets, 'source budgets');
    assertFiniteNumbers(receipts, 'receipts');
    return { receipts, budgets };
}
export function conditionalWorld(input: SimulationInput, initialize = false, evaluateOnly = false): SimulationOutput {
    const { model } = input;
    assertRunSupported(model, input.state.month + (initialize || evaluateOnly ? 0 : 1), input.equations);
    if (initialize && input.state.month !== 0) fail('Conditional initialization requires month zero');
    if (model.executionMode !== 'world-conditional-v1')
        fail('Conditional executor requires its explicit execution mode');
    const macro = model.macro ?? fail('Conditional world requires declared macro assumptions');
    finite(model.aiGrowthRate, 'aiGrowthRate');
    finite(macro.baselineGrowth, 'baselineGrowth', -0.99);
    finite(macro.productivityGain, 'productivityGain');
    finite(macro.automationShare, 'automationShare', 0, 1);
    finite(macro.reemploymentMonths, 'reemploymentMonths', 1);
    finite(macro.laborShareSensitivity, 'laborShareSensitivity', 0, 1);
    const assumptions = model.conditional ?? fail('Missing conditional assumptions');
    if (assumptions.version !== 'conditional-assumptions-v1')
        fail('Unknown conditional assumptions version');
    finite(assumptions.transferEffectPerDoubling, 'transferEffectPerDoubling');
    finite(assumptions.nonIncomeLossPerAdditionalUnemployedPerson, 'nonIncomeLossPerAdditionalUnemployedPerson');
    finite(assumptions.incomeDenominatorMultiplier, 'incomeDenominatorMultiplier', Number.MIN_VALUE);
    const dataset = stateCountryDataset(input.state);
    const roster = countriesForDataset(dataset).map(c => c.id);
    if (roster.length !== Object.keys(input.state.countryData).length || roster.some(id => !input.state.countryData[id]))
        fail('Conditional execution requires the complete declared dataset country roster');
    const countryData = structuredClone(input.state.countryData);
    const corporations = structuredClone(input.corporations);
    // Supplied wellbeing and histories remain observed/legacy fields, never behavior inputs.
    const month = input.state.month + (initialize || evaluateOnly ? 0 : 1);
    if (!initialize && input.state.executionMode !== 'world-conditional-v1')
        fail('Initialize conditional outputs before stepping this execution mode');
    const records = countryDatasetFile(dataset).countries;
    for (const c of Object.values(countryData)) {
        if (initialize) {
            const w = workforce.countries[c.id as keyof typeof workforce.countries] ?? fail(`No versioned workforce assumptions for ${c.id}`);
            c.cognitiveShare ??= w.cognitiveShare;
            c.naturalUnemployment ??= w.naturalUnemployment;
            c.laborForcePerResident ??= w.laborForcePerResident;
            c.workforceAssumption = {
                version: workforce.version, source: workforce.source, status: 'assumed', year: workforce.year
            };
            const record = records.find(r => r.id === c.id)!;
            c.monetaryBasis ??= {
                currency: 'USD', priceYear: 2015, observationYear: record.gdpPerCapita.year, status: record.gdpPerCapita.status === 'observed' ? 'observed' : 'dated-assumption', source: record.gdpPerCapita.status === 'observed' ? record.gdpPerCapita.source : 'conditional-assumptions-v1: hypothetical constant-2015 GDP fallback; not a historical conversion'
            };
            const affected = c.aiAdoption * c.cognitiveShare;
            c.gdpNoAi = c.gdpPerCapita / (1 + macro.productivityGain * affected);
            c.laborShare = 0.60 * (1 - macro.laborShareSensitivity * affected);
            c.unemployment = c.naturalUnemployment;
            c.cognitiveUnemployment = c.naturalUnemployment;
            c.displacedPool = 0;
            c.lastAiAdoption = c.aiAdoption;
            if (macro.usReference && c.id === 'USA') {
                const p = usReferencePath(macro.usReference).points[portStepForWorldMonth(0)];
                c.gdpNoAi = c.gdpPerCapita / (1 + p.gdpGap);
            }
        }
        requireCompatibleMoney(c.monetaryBasis);
        validateMacroState(c);
        if (!initialize && !evaluateOnly) {
            const serving = corporations.filter(corp => corp.operatingCountries.includes(c.id));
            const level = serving.length ? serving.reduce((n, corp) => n + corp.aiAdoptionLevel, 0) / serving.length : 0;
            const rawAdoption = finite(c.aiAdoption + model.aiGrowthRate * (1 + c.gdpPerCapita / 100000) * level * .1 * (1 - c.aiAdoption), `${c.id}.rawAdoption`);
            c.aiAdoption = Math.min(.999, rawAdoption);
            c.adoptionDiagnostics = {
                raw: rawAdoption,
                actual: c.aiAdoption,
                cap: .999,
                capActive: rawAdoption > .999,
                kind: 'numerical-cap',
            };
        }
        if (!evaluateOnly && macro.usReference && c.id === 'USA')
            applyUsReference(c, month, macro.usReference, macro.baselineGrowth);
        else if (!initialize && !evaluateOnly)
            applyMacroDynamics(c, {
                ...macro, wellbeingAnchorRate: 0
            });
        validateMacroState(c);
        assertFiniteNumbers(c.macroDiagnostics, `${c.id}.macroDiagnostics`);
        assertFiniteNumbers(c.adoptionDiagnostics, `${c.id}.adoptionDiagnostics`);
    }
    corporations.forEach(c => {
        if (initialize) {
            c.monetaryBasis ??= {
                ...CONDITIONAL_MONEY
            };
            c.availableShare ??= 1;
            c.fundingRequest ??= {
                kind: 'share'
            };
        }
    });
    const { receipts, budgets } = allocateConditional(countryData, corporations);
    const ledger = {
        totalFunds: 0, monthlyInflow: 0, monthlyOutflow: 0, fundsPerCapita: 0, fundsByCountry: {} as Record<string, number>, contributorBreakdown: {} as Record<string, number>, distributionBreakdown: {} as Record<string, number>, corruptionLeakage: 0 as const
    };
    corporations.forEach(c => {
        c.sourceBudget = budgets[c.id];
        c.aiRevenue = budgets[c.id].source;
        delete c.customerBaseWellbeing;
        delete c.projectedDemandCollapse;
        ledger.contributorBreakdown[c.id] = budgets[c.id].actual;
    });
    // Annual GDP-derived resident income is divided by twelve exactly once.
    const k = wellbeingAnchorCoefficientsFor(dataset);
    const population = sumFinite(Object.values(countryData).map(c => c.population), 'modeled population');
    let weighted = 0, validPopulation = 0, invalid = 0, assumedCount = 0, assumedPopulation = 0;
    for (const c of Object.values(countryData)) {
        const r = receipts[c.id];
        c.ubiReceivedGlobal = r.global;
        c.ubiReceivedLocal = r.local;
        c.ubiReceivedCustomerWeighted = r.customer;
        c.totalUbiReceived = r.global + r.local + r.customer;
        ledger.totalFunds += r.global;
        ledger.monthlyInflow += c.totalUbiReceived;
        ledger.fundsByCountry[c.id] = c.totalUbiReceived;
        ledger.distributionBreakdown[c.id] = c.totalUbiReceived;
        const incomeIndex = finite(c.gdpPerCapita * c.laborShare! / .60, 'income index', Number.MIN_VALUE);
        const denominator = finite(c.gdpPerCapita * c.laborShare! * assumptions.incomeDenominatorMultiplier, 'annual per-resident income proxy', Number.MIN_VALUE);
        const transferRatio = usdPerPerson(c.totalUbiReceived, c.population) / (denominator / 12);
        const income = k.intercept + k.lnGdp * Math.log(incomeIndex) + k.governance * c.governance;
        const transfer = assumptions.transferEffectPerDoubling * Math.log2(1 + transferRatio);
        // Assumed additive non-income decrement; not proof of empirical independence.
        const nonIncomeUnemployment = assumptions.nonIncomeLossPerAdditionalUnemployedPerson * Math.max(0, c.unemployment! - c.naturalUnemployment!) * c.laborForcePerResident!;
        const raw = income + transfer - nonIncomeUnemployment;
        if (!Number.isFinite(raw))
            fail('Non-finite conditional mapping');
        const valid = raw >= 0 && raw <= 100;
        c.conditionalWellbeing = {
            raw, income, transfer, nonIncomeUnemployment, transferRatio, incomeDenominatorAnnual: denominator, valid, status: valid ? 'illustrative' : 'outside-mapping-scale'
        };
        // Normalize first: raw * population can overflow even when the mean is finite.
        weighted += raw * (c.population / population);
        if (!Number.isFinite(weighted)) fail('Population-weighted mapping is not representable');
        if (valid)
            validPopulation += c.population;
        else
            invalid++;
        if (c.monetaryBasis?.status !== 'observed') {
            assumedCount++;
            assumedPopulation += c.population;
        }
    }
    ledger.monthlyOutflow = ledger.monthlyInflow;
    ledger.fundsPerCapita = usdPerPerson(ledger.totalFunds, population);
    // This is a monthly-flow snapshot. Month zero is not elapsed historical spending.
    const sum = (key: keyof SourceBudget) => sumFinite(Object.values(budgets).map(b => Number(b[key])), `aggregate ${key}`);
    const sourceAccounting = {
        source: sum('source'),
        available: sum('available'),
        requested: sum('requested'),
        actual: sum('actual'),
        unfunded: sum('unfunded'),
        unused: sum('slack'),
        reserved: sum('reservedForOtherUses'),
        receipts: ledger.monthlyInflow,
        residual: sum('actual') - ledger.monthlyInflow,
    };
    const conditionalSummary = {
        rawPopulationWeighted: weighted,
        value: invalid ? null : weighted,
        populationMillions: population,
        countryCount: roster.length,
        invalidCountryCount: invalid,
        validPopulationMillions: validPopulation,
        assumedGdpCountryCount: assumedCount,
        assumedGdpPopulationMillions: assumedPopulation,
    };
    const output: SimulationOutput = {
        state: {
            ...input.state,
            month,
            countryData,
            sourceAccounting,
            globalFund: ledger.totalFunds,
            executionMode: 'world-conditional-v1',
            conditionalSummary,
            outputDefinition: {
                version: assumptions.version,
                flowConvention: 'monthly-flow-at-month',
                monetaryBasis: CONDITIONAL_MONEY,
                limitations: resolveRunCapabilities(model).limitations,
            },
        },
        corporations,
        ledger,
        // Compatibility shape only: capability guards prevent interpreting these as findings.
        gameTheory: {
            isInPrisonersDilemma: false,
            defectionCount: 0,
            cooperationCount: 0,
            moderateCount: 0,
            raceToBottomRisk: 0,
            virtuousCycleStrength: 0,
            avgContributionRate: 0,
        },
    };
    assertFiniteNumbers(output, 'conditional output');
    return output;
}

/** No data readers or fit: frozen origin and calibration are the only numeric inputs. */
import { stepSimulationPure, type SimulationInput } from '../../simulation/pure';
import { getArchetype } from '../../constants';
import type { CountryStats, ModelParameters, SimulationState } from '../../types';
import { validateBackground, type Origin } from './partition';
import type { fit } from './fit';
export const evaluationModel: ModelParameters = {
    id: 'level-holdout-2018', name: 'Held-out level baseline', description: 'Existing anchored level engine; AI and transfers off', corporateTaxRate: 0, adoptionIncentive: 0, baseUBI: 0, aiGrowthRate: 0, volatility: 0, gdpScaling: 0, globalRedistributionRate: 0, displacementRate: 0, directToWalletEnabled: true, defaultCorpPolicy: 'mixed-reality', marketPressure: 0, macro: {
        baselineGrowth: .02, productivityGain: 0, automationShare: 0, reemploymentMonths: 12, laborShareSensitivity: 0, wellbeingAnchorRate: .02, wellbeingMode: 'anchored', ubiEffectPerDoubling: 0, unemploymentEffectPerPoint: 0
    }
};
export function initialHistoricalState(origin: Origin): SimulationState {
    if (origin.originYear !== 2018)
        throw Error('Origin year drift');
    if (!origin.countries.length)
        throw Error('Empty origin cohort');
    if (new Set(origin.countries.map(c => c.id)).size !== origin.countries.length)
        throw Error('Duplicate origin country');
    const countryData: Record<string, CountryStats> = {};
    for (const b of origin.countries) {
        validateBackground(b);
        if (!(b.gdp > 0) || !Number.isFinite(b.gdp) || !Number.isFinite(b.ladder) || b.ladder < 0 || b.ladder > 10)
            throw Error('Invalid origin outcome');
        countryData[b.id] = {
            id: b.id, name: b.name, population: b.population.value / 1e6, gdpPerCapita: b.gdp, wellbeing: b.ladder * 10, aiAdoption: 0, companiesJoined: 0, socialResilience: b.governance, gini: b.gini.value / 100, governance: b.governance, corruption: 1 - b.governance, archetype: getArchetype(b.gdp, b.governance), participatesInGlobalUBI: true, headquarteredCorps: [], customerOfCorps: [], ubiReceivedGlobal: 0, ubiReceivedLocal: 0, ubiReceivedCustomerWeighted: 0, totalUbiReceived: 0, nationalPolicy: { allowsDirectWallet: true, localTaxOnUbi: 0, corporateIncentives: 0 }, wellbeingTrend: [], cognitiveShare: .5, naturalUnemployment: .05, displacedPool: 0, lastAiAdoption: 0
        };
    }
    return {
        month: 0, globalFund: 0, averageWellbeing: origin.countries.reduce((s, c) => s + c.ladder * 10, 0) / origin.countries.length, totalAiCompanies: 0, countryData, globalDisplacementGap: 0, corruptionLeakage: 0, countriesInCrisis: 0
    };
}
export interface Prediction {
    id: string;
    name: string;
    year: number;
    horizon: number;
    ladder: number;
    gdp: number;
    originLadder: number;
    originGdp: number;
}
export function predict(origin: Origin, calibration: ReturnType<typeof fit>, step: (input: SimulationInput) => ReturnType<typeof stepSimulationPure> = stepSimulationPure, state = initialHistoricalState(origin)) {
    const k = Object.freeze({ ...calibration.coefficients });
    if (![k.intercept, k.lnGdp, k.governance].every(Number.isFinite))
        throw Error('Invalid frozen coefficients');
    const rows: Prediction[] = [];
    for (let month = 1; month <= 84; month++) {
        const out = step({
            state, corporations: [], model: structuredClone(evaluationModel), wellbeingAnchorCoefficients: k
        });
        state = out.state;
        for (const c of Object.values(state.countryData))
            if (c.aiAdoption !== 0 || c.totalUbiReceived !== 0 || !Number.isFinite(c.wellbeing) || !Number.isFinite(c.gdpPerCapita))
                throw Error('Disabled channel or numeric integrity drift');
        if (month % 12 === 0)
            for (const c of origin.countries) {
                const p = state.countryData[c.id];
                rows.push({
                    id: c.id, name: c.name, year: 2018 + month / 12, horizon: month / 12, ladder: p.wellbeing / 10, gdp: p.gdpPerCapita, originLadder: c.ladder, originGdp: c.gdp
                });
            }
    }
    return rows;
}

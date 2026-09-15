import { createHash } from 'node:crypto';
import { countriesForDataset, INITIAL_CORPORATIONS, DEFAULT_MODEL, PRESET_MODELS, wellbeingAnchorCoefficientsFor } from '../../constants';
import { stepSimulationPure } from '../../simulation/pure';
import { initialRun, initOptionsFor } from '../../simulation/run';
import type { SimulationState } from '../../types';
export function captureDefaults(explicit = false) {
    const results = [];
    for (const dataset of ['countries-legacy-v1', 'countries-wb-2026-09'] as const)
        for (const selected of [DEFAULT_MODEL, PRESET_MODELS[0], { ...PRESET_MODELS[0], macro: { ...PRESET_MODELS[0].macro!, wellbeingMode: 'anchored' as const } }]) {
            let state: SimulationState = {
                countryDataset: dataset, month: 0, globalFund: 0, averageWellbeing: 50, totalAiCompanies: 0, globalDisplacementGap: 0, corruptionLeakage: 0, countriesInCrisis: 0, countryData: Object.fromEntries(countriesForDataset(dataset).map(c => [c.id, {
                        ...c, aiAdoption: .01, wellbeing: 50, companiesJoined: 0, wellbeingTrend: []
                    }]))
            };
            let corporations = structuredClone(INITIAL_CORPORATIONS);
            if (selected.executionMode === 'world-conditional-v1') {
                const r = initialRun(undefined, undefined, initOptionsFor(selected, dataset));
                state = r.state;
                corporations = r.corporations;
            }
            const hashes = [];
            for (let m = 0; m < 12; m++) {
                const out = stepSimulationPure({
                    state, corporations, model: selected, ...(explicit ? { wellbeingAnchorCoefficients: wellbeingAnchorCoefficientsFor(dataset) } : {})
                });
                hashes.push(createHash('sha256').update(JSON.stringify(out)).digest('hex'));
                state = out.state;
                corporations = out.corporations;
            }
            results.push({
                dataset, model: selected.id, mode: selected.macro?.wellbeingMode, hashes
            });
        }
    return results;
}

import type { Panel } from './partition';
import type { Prediction } from './predict';
export function metrics(errors: number[]) { const n = errors.length; return {
    n, mae: n ? errors.reduce((s, e) => s + Math.abs(e), 0) / n : null, rmse: n ? Math.sqrt(errors.reduce((s, e) => s + e * e, 0) / n) : null, bias: n ? errors.reduce((s, e) => s + e, 0) / n : null, reason: n ? null : 'No observed country-years'
}; }
export function score(predictions: Prediction[], test: {
    ladder: Panel;
    gdp: Panel;
}) {
    const keys = new Set<string>();
    for (const p of predictions) {
        const key = p.id + '/' + p.year;
        if (keys.has(key) || p.year < 2019 || p.year > 2025 || p.horizon !== p.year - 2018)
            throw Error('Duplicate/invalid prediction boundary');
        keys.add(key);
    }
    for (const panel of [test.ladder, test.gdp])
        for (const rows of Object.values(panel))
            for (const year of Object.keys(rows))
                if (Number(year) < 2019 || Number(year) > 2025)
                    throw Error('Unexpected test year');
    const rows = predictions.flatMap(p => (['ladder', 'gdp'] as const).map(outcome => {
        const raw = test[outcome][p.id]?.[p.year];
        const actual = typeof raw === 'number' && Number.isFinite(raw) && (outcome === 'gdp' ? raw > 0 : raw >= 0 && raw <= 10) ? raw : null;
        const observed = actual !== null;
        const error = observed ? (outcome === 'ladder' ? p.ladder - actual : 100 * (p.gdp - actual) / p.originGdp) : null;
        const persistenceError = observed ? (outcome === 'ladder' ? p.originLadder - actual : 100 * (p.originGdp - actual) / p.originGdp) : null;
        return {
            ...p, outcome, actual, error, persistenceError, reason: observed ? null : `Missing/invalid ${outcome} observation for ${p.year}`
        };
    }));
    const summarize = (subset: typeof rows) => { const observed = subset.filter(r => r.error !== null); const model = metrics(observed.map(r => r.error!)), persistence = metrics(observed.map(r => r.persistenceError!)); return {
        expected: subset.length, observed: observed.length, unscored: subset.length - observed.length, model, persistence, modelMinusPersistenceMae: model.mae === null ? null : model.mae - persistence.mae!
    }; };
    const outcomes = Object.fromEntries((['ladder', 'gdp'] as const).map(o => { const subset = rows.filter(r => r.outcome === o); return [o, {
            units: o === 'ladder' ? 'Cantril ladder points' : 'Cumulative growth percentage points relative to origin GDP', overall: summarize(subset), byYear: Array.from({ length: 7 }, (_, i) => ({ year: 2019 + i, horizon: i + 1, ...summarize(subset.filter(r => r.year === 2019 + i)) })), byCountry: [...new Set(predictions.map(p => p.id))].map(id => ({ id, ...summarize(subset.filter(r => r.id === id)) }))
        }]; }));
    return { rows, outcomes, weighting: 'Equally weighted observed country-years; outcomes have independent masks, identical between model and persistence. No confidence interval assuming independent rows.' };
}

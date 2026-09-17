/** Pure forecast functions. No filesystem, future covariates or production engine imports. */
export type Outcome = 'ladder' | 'gdp';
export type Weights = [number, number, number, number];
export interface Row { id: string; year: number; ladder: number; gdp: number }
export interface Config { weights: Weights[]; damping: number; tolerance: number }
export interface CountryFit {
    id: string; latestYear: number; ladder: number; gdp: number; observations: number;
    ladderSlope: number; logGdpSlope: number; ladderSmoother: number; logGdpSmoother: number;
}
export interface Fit { originYear: number; countries: CountryFit[]; pooled: { ladderSlope: number; logGdpSlope: number; countries: number } }
export interface Summary { n: number; mae: number; rmse: number; bias: number }
export interface CandidateResult { index: number; weights: Weights; score: number; pooled: Summary; cells: { origin: number; year: number; horizon: number; metrics: Summary; clamped: number }[] }
export const FOLDS = [{ origin: 2016, targets: [2017, 2018] }, { origin: 2017, targets: [2018] }];
const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;

export function validateRows(rows: Row[], latestYear = 2018) {
    const seen = new Set<string>();
    for (const r of rows) {
        if (!r.id || !Number.isInteger(r.year) || r.year < 2015 || r.year > latestYear) throw Error('Training year outside past boundary');
        if (!Number.isFinite(r.ladder) || r.ladder < 0 || r.ladder > 10 || !Number.isFinite(r.gdp) || r.gdp <= 0) throw Error('Invalid training value');
        const key = `${r.id}/${r.year}`;
        if (seen.has(key)) throw Error('Duplicate training observation');
        seen.add(key);
    }
    if (!rows.length) throw Error('Empty training history');
}

export function validateConfig(config: Config) {
    if (!(config.damping > 0 && config.damping < 1) || config.tolerance < 0 || !Number.isFinite(config.tolerance)) throw Error('Invalid ensemble configuration');
    if (!config.weights.length || config.weights.some(w => w.length !== 4 || w.some(x => !Number.isFinite(x) || x < 0) || w[0] < .5 || Math.abs(w.reduce((a,b) => a+b, 0)-1) > 1e-12)) throw Error('Invalid convex weights');
}

function slope(years: number[], values: number[]) {
    if (years.length < 2) return 0;
    const y = mean(years), v = mean(values);
    return values.reduce((sum, value, i) => sum + (years[i]-y)*(value-v), 0) / years.reduce((sum, year) => sum+(year-y)**2, 0);
}
function median(values: number[]) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a,b) => a-b), mid = Math.floor(sorted.length/2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
}

/** Passing any later-year row is an error: callers must explicitly construct each past-only fold. */
export function fit(rows: Row[], originYear: number): Fit {
    if (![2016,2017,2018].includes(originYear)) throw Error('Unregistered origin');
    validateRows(rows, originYear);
    const countries = [...new Set(rows.map(r => r.id))].sort().map(id => {
        const history = rows.filter(r => r.id === id).sort((a,b) => a.year-b.year);
        const last = history.at(-1)!, previous = history.at(-2) ?? last;
        return { id, latestYear: last.year, ladder: last.ladder, gdp: last.gdp, observations: history.length,
            ladderSlope: slope(history.map(r => r.year), history.map(r => r.ladder)),
            logGdpSlope: slope(history.map(r => r.year), history.map(r => Math.log(r.gdp))),
            ladderSmoother: (2*last.ladder+previous.ladder)/3,
            logGdpSmoother: (2*Math.log(last.gdp)+Math.log(previous.gdp))/3 };
    });
    const estimable = countries.filter(c => c.observations >= 2);
    return { originYear, countries, pooled: { countries: estimable.length,
        ladderSlope: median(estimable.map(c => c.ladderSlope)), logGdpSlope: median(estimable.map(c => c.logGdpSlope)) } };
}

export function dampingSum(horizon: number, damping: number) {
    if (!Number.isInteger(horizon) || horizon < 1 || horizon > 7) throw Error('Invalid forecast horizon');
    let sum = 0;
    for (let k = 1; k <= horizon; k++) sum += damping**k;
    return sum;
}

export function forecast(model: Fit, id: string, horizon: number, outcome: Outcome, weights: Weights, damping = .8) {
    validateConfig({ weights: [weights], damping, tolerance: 0 });
    const c = model.countries.find(x => x.id === id);
    if (!c || c.latestYear !== model.originYear) throw Error('Missing valid fold origin');
    const d = dampingSum(horizon, damping);
    const x = outcome === 'ladder' ? c.ladder : Math.log(c.gdp);
    const smooth = outcome === 'ladder' ? c.ladderSmoother : c.logGdpSmoother;
    const trend = outcome === 'ladder' ? c.ladderSlope : c.logGdpSlope;
    const pooled = outcome === 'ladder' ? model.pooled.ladderSlope : model.pooled.logGdpSlope;
    // Algebraically identical to the convex sum; avoids round-trip drift for exact persistence.
    const delta = weights[1]*(smooth-x) + weights[2]*d*trend + weights[3]*d*pooled;
    const raw = outcome === 'ladder' ? c.ladder + delta : c.gdp*Math.exp(delta);
    if (!Number.isFinite(raw) || (outcome === 'gdp' && raw <= 0)) throw Error('Nonfinite/nonpositive prediction');
    return { value: outcome === 'ladder' ? Math.max(0, Math.min(10, raw)) : raw,
        clamped: outcome === 'ladder' && (raw < 0 || raw > 10), raw };
}

export function summarize(errors: number[]): Summary {
    if (!errors.length || errors.some(x => !Number.isFinite(x))) throw Error('Empty/invalid validation cell');
    return { n: errors.length, mae: mean(errors.map(Math.abs)), rmse: Math.sqrt(mean(errors.map(x => x*x))), bias: mean(errors) };
}

export function choose(results: CandidateResult[], tolerance: number): CandidateResult {
    if (!results.length || results.some(r => !Number.isFinite(r.score))) throw Error('Invalid candidate scores');
    const minimum = Math.min(...results.map(r => r.score));
    return results.filter(r => r.score <= minimum*(1+tolerance)+1e-12)
        .sort((a,b) => b.weights[0]-a.weights[0] || a.score-b.score || a.index-b.index)[0];
}

export function crossValidate(rows: Row[], config: Config) {
    validateRows(rows); validateConfig(config);
    const fitted = FOLDS.map(fold => ({ ...fold, model: fit(rows.filter(r => r.year <= fold.origin), fold.origin) }));
    const evaluate = (outcome: Outcome) => {
        const results: CandidateResult[] = config.weights.map((weights, index) => {
            const errors: number[] = [];
            const cells = fitted.flatMap(fold => fold.targets.map(year => {
                const cellErrors: number[] = []; let clamped = 0;
                for (const c of fold.model.countries.filter(c => c.latestYear === fold.origin)) {
                    const target = rows.find(r => r.id === c.id && r.year === year);
                    if (!target) continue;
                    const p = forecast(fold.model, c.id, year-fold.origin, outcome, weights, config.damping);
                    const error = outcome === 'ladder' ? p.value-target.ladder : 100*(p.value-target.gdp)/c.gdp;
                    cellErrors.push(error); errors.push(error); clamped += Number(p.clamped);
                }
                return { origin: fold.origin, year, horizon: year-fold.origin, metrics: summarize(cellErrors), clamped };
            }));
            return { index, weights, score: mean(cells.map(c => c.metrics.mae)), pooled: summarize(errors), cells };
        });
        return { selectionLoss: 'equal mean of three cell MAEs', selected: choose(results, config.tolerance), persistence: results[0], candidates: results };
    };
    return { folds: fitted.map(f => ({ origin: f.origin, targets: f.targets, model: f.model })), ladder: evaluate('ladder'), gdp: evaluate('gdp') };
}

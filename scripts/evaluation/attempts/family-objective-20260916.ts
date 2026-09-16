/** One-shot objective-proxy evaluation. This never maps a proxy onto the ladder. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { metrics } from '../score';
import { FAMILY, IDS, skill, sealAttempt, verifyBindings } from './family-20260916';

export const LONG_ID = 'research-objective-1980-v1';
const INDICATORS = { lifeExpectancy: 'SP.DYN.LE00.IN', gdp: 'NY.GDP.PCAP.KD' } as const;
type Target = keyof typeof INDICATORS;
type Country = { id: string; name: string; originIncomeQuartile: number; availability: Record<Target, { origin: number }> };
type Forecast = { id: string; name: string; target: Target; unit: string; year: number; horizon: number; originYear: number; originValue: number; prediction: number; rawPrediction: number };
const hash = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

export function validateObjective(rows: Forecast[], countries: Country[]) {
    const origins = new Map(countries.map(c => [c.id, c]));
    if (!countries.length || origins.size !== countries.length || rows.length !== countries.length * 90) throw Error('Objective coverage mismatch');
    const seen = new Set<string>();
    for (const p of rows) {
        const c = origins.get(p.id);
        if (!c || !(p.target in INDICATORS) || !Number.isInteger(p.year) || p.year < 1981 || p.year > 2025 || p.horizon !== p.year - 1980 || p.originYear !== 1980) throw Error('Objective boundary mismatch');
        if (p.originValue !== c.availability[p.target].origin || p.name !== c.name || !Number.isFinite(p.originValue) || p.originValue <= 0) throw Error('Objective origin mismatch');
        if (!Number.isFinite(p.prediction) || !Number.isFinite(p.rawPrediction) || (p.target === 'gdp' ? p.prediction <= 0 : p.prediction < 0 || p.prediction > 120)) throw Error('Invalid objective prediction');
        if (p.unit !== (p.target === 'gdp' ? 'constant-2015 USD per person' : 'years')) throw Error('Objective unit mismatch');
        const key = `${p.id}/${p.target}/${p.year}`;
        if (seen.has(key)) throw Error('Duplicate objective prediction');
        seen.add(key);
    }
}

/** Validate the complete single-page official response; retain nulls as missing. */
export function objectivePanel(response: any, target: Target, countries: Country[]) {
    if (!Array.isArray(response) || response.length !== 2 || !Array.isArray(response[1])) throw Error('Invalid World Bank response');
    const [meta, values] = response;
    if (Number(meta.pages) !== 1 || Number(meta.page) !== 1 || Number(meta.total) !== values.length) throw Error('Incomplete World Bank response');
    const cohort = new Set(countries.map(c => c.id)), seen = new Set<string>();
    const panel: Record<string, Record<string, number | null>> = {};
    for (const row of values) {
        const year = Number(row.date);
        if (!Number.isInteger(year) || year < 1981 || year > 2025 || row.indicator?.id !== INDICATORS[target]) throw Error('Unexpected outcome boundary/indicator');
        if (!cohort.has(row.countryiso3code)) continue;
        const key = `${row.countryiso3code}/${year}`;
        if (seen.has(key)) throw Error('Duplicate objective outcome');
        seen.add(key);
        const value = row.value;
        const valid = typeof value === 'number' && Number.isFinite(value) && (target === 'gdp' ? value > 0 : value > 0 && value < 120);
        (panel[row.countryiso3code] ??= {})[year] = valid ? value : null;
    }
    return panel;
}

export function analyzeObjective(predictions: Forecast[], countries: Country[], responses: Record<Target, any>) {
    validateObjective(predictions, countries);
    const panels = { lifeExpectancy: objectivePanel(responses.lifeExpectancy, 'lifeExpectancy', countries), gdp: objectivePanel(responses.gdp, 'gdp', countries) };
    const groups = new Map(countries.map(c => [c.id, c.originIncomeQuartile]));
    const rows = predictions.map(p => {
        const actual = panels[p.target][p.id]?.[p.year] ?? null;
        const multiplier = p.target === 'gdp' ? 100 / p.originValue : 1;
        return { ...p, actual, error: actual === null ? null : (p.prediction - actual) * multiplier,
            persistenceError: actual === null ? null : (p.originValue - actual) * multiplier,
            levelError: actual === null ? null : p.prediction - actual,
            persistenceLevelError: actual === null ? null : p.originValue - actual,
            reason: actual === null ? 'Missing/invalid observed target; both methods unscored' : null };
    });
    const summarize = (rs: typeof rows) => {
        const observed = rs.filter(r => r.error !== null);
        const model = metrics(observed.map(r => r.error!)), persistence = metrics(observed.map(r => r.persistenceError!));
        return { expected: rs.length, observed: observed.length, unscored: rs.length - observed.length, model, persistence,
            skill: skill(model.mae, persistence.mae), supplementaryLevels: { model: metrics(observed.map(r => r.levelError!)), persistence: metrics(observed.map(r => r.persistenceLevelError!)) } };
    };
    const analysis = Object.fromEntries((Object.keys(INDICATORS) as Target[]).map(target => {
        const subset = rows.filter(r => r.target === target), endpoint = subset.filter(r => r.year === 2025);
        const n = subset.filter(r => r.error !== null).length, ne = endpoint.filter(r => r.error !== null).length;
        const contributions = countries.map(c => {
            const own = subset.filter(r => r.id === c.id && r.error !== null), end = own.find(r => r.year === 2025);
            return { id: c.id, name: c.name, observedYears: own.length,
                pooledMaeImprovementContribution: n ? own.reduce((s, r) => s + Math.abs(r.persistenceError!) - Math.abs(r.error!), 0) / n : null,
                endpointMaeImprovementContribution: end && ne ? (Math.abs(end.persistenceError!) - Math.abs(end.error!)) / ne : null };
        });
        return [target, { units: target === 'gdp' ? 'Cumulative growth percentage points relative to 1980 GDP' : 'Life expectancy years',
            primaryEndpoint: summarize(endpoint), pooled: summarize(subset),
            byHorizon: Array.from({ length: 45 }, (_, i) => ({ year: 1981 + i, horizon: i + 1, ...summarize(subset.filter(r => r.year === 1981 + i)) })),
            byOriginIncomeGroup: [1, 2, 3, 4].map(group => ({ group, pooled: summarize(subset.filter(r => groups.get(r.id) === group)), endpoint: summarize(endpoint.filter(r => groups.get(r.id) === group)) })),
            countryContributions: contributions.sort((a, b) => (b.endpointMaeImprovementContribution ?? -Infinity) - (a.endpointMaeImprovementContribution ?? -Infinity) || a.id.localeCompare(b.id)) }];
    }));
    return { analysis, rows, interpretation: 'Retrospective current-vintage objective proxy forecasts, separate targets and identical persistence masks. Missing 2025 outcomes remain unscored; earlier endpoints do not replace the registered primary. No ladder mapping, causal interpretation, or 1980 real-time forecast claim.' };
}

export function scoreObjectiveOnce() {
    const base = `data/evaluation/${LONG_ID}/`, familyPath = `data/evaluation/${FAMILY}/registry.json`;
    const registry = read(familyPath), manifest = read(base + 'scoring-manifest.json');
    if (registry.family !== FAMILY || JSON.stringify(registry.entries.map((e: any) => e.id).sort()) !== JSON.stringify([...IDS, LONG_ID].sort())) throw Error('Incomplete family freeze');
    if (manifest.entry !== LONG_ID || manifest.family !== FAMILY) throw Error('Wrong objective manifest');
    const entry = registry.entries.find((e: any) => e.id === LONG_ID);
    for (const [file, field] of [['protocol.json', 'protocolSha256'], ['predictions.json', 'predictionsSha256']]) if (hash(readFileSync(base + file)) !== entry[field]) throw Error('Objective registry mismatch');
    verifyBindings(manifest.bindings);
    for (const path of [...Object.keys(manifest.bindings), base + 'scoring-manifest.json', familyPath]) if (hash(execFileSync('git', ['show', `HEAD:${path}`])) !== hash(readFileSync(path))) throw Error(`Uncommitted objective input: ${path}`);
    const countries = read(base + 'cohort.json').countries as Country[], predictions = read(base + 'predictions.json').rows as Forecast[];
    validateObjective(predictions, countries);
    if (countries.length !== 140 || predictions.length !== 12600 || existsSync(base + 'scores.json')) throw Error('Objective cohort changed or already scored');
    const receiptPath = base + 'score-receipt.json';
    const receipt: any = { schema: 'one-shot-score-receipt/1', entry: LONG_ID, family: FAMILY, preScoreCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), startedAt: new Date().toISOString(), status: 'started', registrySha256: hash(readFileSync(familyPath)), predictionsSha256: entry.predictionsSha256, protocolSha256: entry.protocolSha256 };
    sealAttempt(receiptPath, receipt);
    try {
        const responses = Object.fromEntries(Object.entries(INDICATORS).map(([target, indicator]) => [target, read(base + `external/${indicator}-1981-2025.json`)])) as Record<Target, any>;
        const result = { schema: 'objective-family-result/1', entry: LONG_ID, receipt: { ...receipt }, ...analyzeObjective(predictions, countries, responses) };
        writeFileSync(base + 'scores.json', JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
        Object.assign(receipt, { status: 'completed', completedAt: new Date().toISOString(), scoresSha256: hash(readFileSync(base + 'scores.json')) });
        writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
        console.log(JSON.stringify(result.analysis, null, 2));
    } catch (error) {
        Object.assign(receipt, { status: 'failed-no-automatic-retry', failure: String(error) });
        writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
        throw error;
    }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) scoreObjectiveOnce();

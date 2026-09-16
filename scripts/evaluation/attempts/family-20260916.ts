/** Common evaluator for a predeclared family. Model fitting is deliberately absent. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { score, metrics } from '../score';
import type { Prediction } from '../predict';

export const FAMILY = 'five-approaches-20260916';
export const IDS = ['offset', 'damped', 'changes', 'health', 'ensemble'].map(x => `research-${x}-2018-v1`);
const LONG_ID = 'research-objective-1980-v1';
type Country = { id: string; name: string; ladder: number; gdp: number };
type Origin = { originYear: number; countries: Country[]; excluded: unknown[] };
const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function validatePredictions(rows: Prediction[], origin: Origin) {
    if (origin.originYear !== 2018 || !origin.countries.length) throw Error('Invalid origin');
    const countries = new Map(origin.countries.map(c => [c.id, c]));
    if (countries.size !== origin.countries.length) throw Error('Duplicate origin country');
    if (!Array.isArray(rows) || rows.length !== countries.size * 7) throw Error('Prediction coverage mismatch');
    const seen = new Set<string>();
    for (const row of rows) {
        const c = countries.get(row.id);
        if (!c || !Number.isInteger(row.year) || row.year < 2019 || row.year > 2025 || row.horizon !== row.year - 2018) throw Error('Prediction boundary mismatch');
        if (row.originLadder !== c.ladder || row.originGdp !== c.gdp || row.name !== c.name) throw Error('Prediction origin mismatch');
        if (!Number.isFinite(row.ladder) || row.ladder < 0 || row.ladder > 10 || !Number.isFinite(row.gdp) || row.gdp <= 0) throw Error('Invalid prediction value');
        const key = `${row.id}/${row.year}`;
        if (seen.has(key)) throw Error('Duplicate prediction');
        seen.add(key);
    }
}

export function skill(model: number | null, persistence: number | null) {
    return model === null || persistence === null || persistence === 0
        ? { value: null, reason: persistence === 0 ? 'Zero persistence MAE; skill ratio undefined' : 'No scored observations' }
        : { value: 1 - model / persistence, reason: null };
}

export function analyze(rows: Prediction[], origin: Origin, test: Parameters<typeof score>[1]) {
    validatePredictions(rows, origin);
    const scored = score(rows, test); // Original masks, units, and scoring implementation are unchanged.
    const ranked = [...origin.countries].sort((a, b) => a.gdp - b.gdp || a.id.localeCompare(b.id));
    const groups = new Map(ranked.map((c, i) => [c.id, `origin-income-Q${Math.floor(i * 4 / ranked.length) + 1}`]));
    const summarize = (subset: typeof scored.rows) => {
        const observed = subset.filter(r => r.error !== null);
        const model = metrics(observed.map(r => r.error!));
        const persistence = metrics(observed.map(r => r.persistenceError!));
        return { expected: subset.length, observed: observed.length, unscored: subset.length - observed.length, model, persistence,
            modelMinusPersistenceMae: model.mae === null ? null : model.mae - persistence.mae!, skill: skill(model.mae, persistence.mae) };
    };
    const analysis = Object.fromEntries((['ladder', 'gdp'] as const).map(outcome => {
        const subset = scored.rows.filter(r => r.outcome === outcome);
        const endpoint = subset.filter(r => r.year === 2025);
        const nEndpoint = endpoint.filter(r => r.error !== null).length;
        const nOverall = subset.filter(r => r.error !== null).length;
        const contributions = origin.countries.map(c => {
            const observed = subset.filter(r => r.id === c.id && r.error !== null);
            const end = observed.find(r => r.year === 2025);
            const improvement = observed.reduce((s, r) => s + Math.abs(r.persistenceError!) - Math.abs(r.error!), 0);
            return { id: c.id, name: c.name, group: groups.get(c.id), observedYears: observed.length,
                pooledMaeImprovementContribution: nOverall ? improvement / nOverall : null,
                endpointMaeImprovementContribution: end && nEndpoint ? (Math.abs(end.persistenceError!) - Math.abs(end.error!)) / nEndpoint : null };
        });
        return [outcome, { primaryEndpoint: summarize(endpoint), pooled: summarize(subset),
            byHorizon: Array.from({ length: 7 }, (_, i) => ({ year: 2019 + i, horizon: i + 1, ...summarize(subset.filter(r => r.year === 2019 + i)) })),
            byOriginIncomeGroup: Array.from({ length: 4 }, (_, i) => ({ group: `origin-income-Q${i + 1}`,
                pooled: summarize(subset.filter(r => groups.get(r.id) === `origin-income-Q${i + 1}`)),
                endpoint: summarize(endpoint.filter(r => groups.get(r.id) === `origin-income-Q${i + 1}`)) })),
            countryContributions: contributions.sort((a, b) => (b.endpointMaeImprovementContribution ?? -Infinity) - (a.endpointMaeImprovementContribution ?? -Infinity) || a.id.localeCompare(b.id)) }];
    }));
    return { ...scored, analysis, excludedOriginCountries: origin.excluded,
        interpretation: 'One predeclared family of five retrospective attempts. Publish all. Best-of-five selection is exploratory and requires genuinely new data for confirmation. No causal/AI/UBI claim or confidence interval is inferred.' };
}

export function verifyBindings(bindings: Record<string, string>, root = '.') {
    if (!bindings || !Object.keys(bindings).length) throw Error('Empty source bindings');
    for (const [path, expected] of Object.entries(bindings)) {
        if (path.startsWith('/') || path.split('/').includes('..') || !/^[a-f0-9]{64}$/.test(expected)) throw Error('Invalid source binding');
        if (hash(readFileSync(resolve(root, path))) !== expected) throw Error(`Frozen source drift: ${path}`);
    }
}

/** Exclusive receipt is created before outcomes are read. A failed attempt is retained, not retried. */
export function sealAttempt(path: string, receipt: unknown) {
    writeFileSync(path, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
}

export function scoreOnce(id: string) {
    if (!IDS.includes(id)) throw Error('Unregistered family entry');
    const base = `data/evaluation/${id}/`;
    const registry = read('data/evaluation/five-approaches-20260916/registry.json');
    if (registry.family !== FAMILY || !same([...registry.entries.map((e: any) => e.id)].sort(), [...IDS, LONG_ID].sort())) throw Error('Incomplete family freeze');
    const entry = registry.entries.find((e: any) => e.id === id);
    const manifest = read(base + 'scoring-manifest.json');
    if (manifest.entry !== id || manifest.family !== FAMILY) throw Error('Manifest identity mismatch');
    for (const path of [base + 'protocol.json', base + 'predictions.json']) {
        const field = path.endsWith('protocol.json') ? 'protocolSha256' : 'predictionsSha256';
        if (hash(readFileSync(path)) !== entry[field]) throw Error('Registry hash mismatch');
    }
    verifyBindings(manifest.bindings);
    // Require all bound files, registry and manifest committed before test data are opened.
    for (const path of [...Object.keys(manifest.bindings), base + 'scoring-manifest.json', 'data/evaluation/five-approaches-20260916/registry.json']) {
        const committed = execFileSync('git', ['show', `HEAD:${path}`]);
        if (hash(committed) !== hash(readFileSync(path))) throw Error(`Uncommitted frozen file: ${path}`);
    }
    if (existsSync(base + 'scores.json')) throw Error('Scored output already exists');
    const origin = read('data/evaluation/level-holdout-2018/origin.json') as Origin;
    const predictionFile = read(base + 'predictions.json');
    const rows = predictionFile.rows as Prediction[];
    validatePredictions(rows, origin);
    if (origin.countries.length !== 100 || rows.length !== 700) throw Error('Frozen cohort changed');
    const receiptPath = base + 'score-receipt.json';
    const receipt: any = { schema: 'one-shot-score-receipt/1', entry: id, family: FAMILY, startedAt: new Date().toISOString(),
        preScoreCommit: git('rev-parse', 'HEAD'), registrySha256: hash(readFileSync('data/evaluation/five-approaches-20260916/registry.json')),
        protocolSha256: entry.protocolSha256, predictionsSha256: entry.predictionsSha256, status: 'started' };
    sealAttempt(receiptPath, receipt);
    try {
        const testPath = 'data/evaluation/level-holdout-2018/test-outcomes.json';
        const testBytes = readFileSync(testPath);
        if (hash(testBytes) !== manifest.testOutcomesSha256) throw Error('Test artifact drift');
        const result = { schema: 'forecast-family-result/1', entry: id, family: FAMILY, receipt: { ...receipt },
            testOutcomesSha256: hash(testBytes), ...analyze(rows, origin, JSON.parse(testBytes.toString())) };
        writeFileSync(base + 'scores.json', JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
        receipt.status = 'completed';
        receipt.completedAt = new Date().toISOString();
        receipt.scoresSha256 = hash(readFileSync(base + 'scores.json'));
        writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
        console.log(JSON.stringify({ entry: id, ladder: result.analysis.ladder, gdp: result.analysis.gdp }, null, 2));
    } catch (error) {
        receipt.status = 'failed-no-automatic-retry';
        receipt.failure = String(error);
        writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
        throw error;
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (process.argv.length !== 3) throw Error('Usage: node --import tsx scripts/evaluation/attempts/family-20260916.ts ENTRY_ID');
    scoreOnce(process.argv[2]);
}

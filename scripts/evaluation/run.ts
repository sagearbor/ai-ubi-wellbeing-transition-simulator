/** Separate OS processes: prepare → fit → predict → score → package.
 * Fit reads only train.json/protocol; prediction only frozen-fit.json/origin.json/protocol.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const base = 'data/evaluation/level-holdout-2018/';
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const write = (name: string, value: unknown) => writeFileSync(base + name, JSON.stringify(value, null, 2) + '\n');
const protocolHash = hash(base + 'protocol.json');
const assertProtocol = () => { if (protocolHash !== '694cc25212c42a84c873a55b7f6db7023e604fd5bbedde2ff9639d2faaaa1c3b')
    throw Error('Registered protocol changed'); };
assertProtocol();
const stage = process.argv[2];
if (stage === 'prepare') {
    const { prepare } = await import('./partition');
    const roster = read('data/countries/wb-2026-09.json').countries.map(({ id, name }: {
        id: string;
        name: string;
    }) => ({ id, name }));
    const provenance = read(base + 'sources/provenance.json');
    const raw: Record<string, any> = {};
    for (const [id, v] of Object.entries(provenance) as [
        string,
        any
    ][]) {
        if (hash(v.path) !== v.sha256)
            throw Error('Source hash drift');
        raw[id] = read(v.path);
        if (raw[id][0].pages !== 1 || raw[id][1].some((r: any) => r.indicator.id !== v.apiIndicator))
            throw Error('Incomplete/wrong indicator response');
    }
    const prepared = prepare(roster, raw, read('data/hindcast/wellbeing-ladder.json').data, read('data/hindcast/gdp-per-capita.json').data);
    write('roster.json', roster);
    write('train.json', prepared.train);
    write('origin.json', prepared.origin);
    write('test-outcomes.json', prepared.test);
    write('partition-provenance.json', {
        protocolHash, sourceHashes: Object.fromEntries(['data/countries/wb-2026-09.json', 'data/hindcast/wellbeing-ladder.json', 'data/hindcast/gdp-per-capita.json', base + 'sources/provenance.json'].map(p => [p, hash(p)])), rosterUse: 'Only immutable IDs and names; no current numeric country features', backgroundExcluded: prepared.backgroundExcluded
    });
}
else if (stage === 'fit') {
    const { fit } = await import('./fit');
    write('frozen-fit.json', { protocolHash, trainHash: hash(base + 'train.json'), ...fit(read(base + 'train.json')) });
}
else if (stage === 'predict') {
    const { predict } = await import('./predict');
    const calibration = read(base + 'frozen-fit.json');
    if (calibration.protocolHash !== protocolHash)
        throw Error('Calibration protocol mismatch');
    write('predictions.json', {
        protocolHash, calibrationHash: hash(base + 'frozen-fit.json'), originHash: hash(base + 'origin.json'), rows: predict(read(base + 'origin.json'), calibration)
    });
}
else if (stage === 'score') {
    const { score } = await import('./score');
    const predictions = read(base + 'predictions.json');
    if (predictions.protocolHash !== protocolHash || predictions.calibrationHash !== hash(base + 'frozen-fit.json') || predictions.originHash !== hash(base + 'origin.json'))
        throw Error('Prediction identity mismatch');
    write('scores.json', {
        protocolHash, predictionsHash: hash(base + 'predictions.json'), testHash: hash(base + 'test-outcomes.json'), ...score(predictions.rows, read(base + 'test-outcomes.json'))
    });
}
else if (stage === 'package') {
    const { sourceHashes } = await import('../hindcast/export-experience');
    const { evaluationModel } = await import('./predict');
    const sources = sourceHashes();
    for (const p of ['scripts/evaluation/partition.ts', 'scripts/evaluation/fit.ts', 'scripts/evaluation/predict.ts', 'scripts/evaluation/score.ts', 'scripts/evaluation/run.ts', base + 'sources/wgi-indicator-catalog.json', base + 'sources/catalog-provenance.json', ...Object.values(read(base + 'sources/provenance.json')).map((x: any) => x.path)])
        sources[p] = hash(p);
    const artifactHashes = Object.fromEntries(['protocol.json', 'train.json', 'origin.json', 'frozen-fit.json', 'predictions.json', 'test-outcomes.json', 'scores.json', 'partition-provenance.json', 'sources/provenance.json'].map(p => [p, hash(base + p)]));
    write('experience.json', {
        artifactHashes, schema: 'level-holdout-experience/1', title: 'Held-out baseline evaluation of the existing level model (AI and transfers off)', protocol: read(base + 'protocol.json'), protocolHash, calibrationIdentity: hash(base + 'frozen-fit.json'), sourceHashes: sources, parameters: evaluationModel, backgroundSources: read(base + 'sources/provenance.json'), limitations: ['Retrospective out-of-fit temporal performance; not a blind or archived-as-of forecast.', 'Revised data retrieved in 2026; annual origin is a nominal end-of-observation-year boundary, without publication-lag reconstruction.', 'Model form and structural assumptions selected after evaluation years were known.', 'Does not validate the conditional world default or disabled AI, transfer, training, migration or policy channels.', 'No accuracy pass threshold; untuned performance published regardless of sign.'], inactiveAssumptions: 'No corporations or transfers, no AI. Cognitive share 0.5, natural unemployment 0.05, policy/tax/incentive neutral. Tests vary inactive fields and parameters without changing predicted GDP/ladder. Existing full engine runs all monthly phases; current dataset world population divides a zero pool only.', fit: read(base + 'frozen-fit.json'), origin: read(base + 'origin.json'), trainingExclusions: read(base + 'train.json').excluded, predictions: read(base + 'predictions.json').rows, scores: read(base + 'scores.json')
    });
}
else if (stage === 'all') {
    for (const s of ['prepare', 'fit', 'predict', 'score', 'package'])
        execFileSync(process.execPath, ['--import', 'tsx', 'scripts/evaluation/run.ts', s], { stdio: 'inherit' });
}
else
    throw Error('Usage: node --import tsx scripts/evaluation/run.ts prepare|fit|predict|score|package|all');

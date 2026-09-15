/** Publication checks. These read identities only and never refit or rescore data. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

export const evaluationBase = 'data/evaluation/level-holdout-2018/';
const backgroundIndicators = ['SP.POP.TOTL', 'SI.POV.GINI', 'GE.EST', 'RL.EST', 'CC.EST'];
const partitionSources = [
    'data/countries/wb-2026-09.json',
    'data/hindcast/wellbeing-ladder.json',
    'data/hindcast/gdp-per-capita.json',
    evaluationBase + 'sources/provenance.json',
];

export function fileHash(path: string): string {
    return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** Same local-import traversal used by the historical exporter, rooted at this pipeline. */
export function evaluationSourceHashes(root = process.cwd()): Record<string, string> {
    const pending = ['scripts/evaluation/run.ts', 'package-lock.json'];
    const hashes: Record<string, string> = {};
    while (pending.length) {
        const name = pending.pop()!;
        if (hashes[name]) continue;
        const full = join(root, name);
        const content = readFileSync(full, 'utf8');
        hashes[name] = fileHash(full);
        if (!/\.[cm]?[jt]sx?$/.test(name)) continue;
        for (const imported of ts.preProcessFile(content).importedFiles) {
            if (!imported.fileName.startsWith('.')) continue;
            const base = resolve(dirname(full), imported.fileName);
            const target = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, join(base, 'index.ts')]
                .find(candidate => existsSync(candidate) && /\.[cm]?[jt]sx?$|\.json$/.test(candidate));
            if (!target) throw new Error(`Unresolved evaluation source: ${name} -> ${imported.fileName}`);
            pending.push(relative(root, target));
        }
    }
    return Object.fromEntries(Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b)));
}

/** Validate every persisted link before package can overwrite the published artifact. */
export function assertPackageIdentities(protocolHash: string, root = process.cwd()): void {
    const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8'));
    const hash = (path: string) => fileHash(join(root, path));
    const matches = (actual: unknown, expected: string, label: string) => {
        if (actual !== expected) throw new Error(`Package identity mismatch: ${label}`);
    };
    const partition = read(evaluationBase + 'partition-provenance.json');
    const calibration = read(evaluationBase + 'frozen-fit.json');
    const predictions = read(evaluationBase + 'predictions.json');
    const scores = read(evaluationBase + 'scores.json');
    for (const [label, artifact] of Object.entries({ partition, calibration, predictions, scores })) {
        matches(artifact.protocolHash, protocolHash, `${label} protocol`);
    }
    matches(calibration.trainHash, hash(evaluationBase + 'train.json'), 'calibration → training');
    matches(predictions.calibrationHash, hash(evaluationBase + 'frozen-fit.json'), 'predictions → calibration');
    matches(predictions.originHash, hash(evaluationBase + 'origin.json'), 'predictions → origin');
    matches(scores.predictionsHash, hash(evaluationBase + 'predictions.json'), 'scores → predictions');
    matches(scores.testHash, hash(evaluationBase + 'test-outcomes.json'), 'scores → test outcomes');
    for (const path of partitionSources) {
        matches(partition.sourceHashes?.[path], hash(path), `partition → ${path}`);
    }
    // Check any additional declared sources too; required entries cannot silently disappear.
    for (const [path, expected] of Object.entries(partition.sourceHashes)) {
        matches(expected, hash(path), `partition source ${path}`);
    }
    const background = read(evaluationBase + 'sources/provenance.json');
    for (const indicator of backgroundIndicators) {
        const source = background[indicator];
        const expectedPath = evaluationBase + `sources/${indicator}.json`;
        matches(source?.path, expectedPath, `background path ${indicator}`);
        matches(source.sha256, hash(expectedPath), `background ${indicator}`);
    }
    const catalog = read(evaluationBase + 'sources/catalog-provenance.json');
    const catalogPath = evaluationBase + 'sources/wgi-indicator-catalog.json';
    matches(catalog.path, catalogPath, 'catalog path');
    matches(catalog.sha256, hash(catalogPath), 'catalog source');
}

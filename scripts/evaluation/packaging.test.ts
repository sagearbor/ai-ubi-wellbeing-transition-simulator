import { describe, expect, it } from 'vitest';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { assertPackageIdentities, evaluationBase, evaluationSourceHashes } from './integrity';

const artifact = JSON.parse(readFileSync(evaluationBase + 'experience.json', 'utf8'));
const protocolHash = artifact.protocolHash;

describe('evaluation publication boundary', () => {
    it('covers the numerical fitter and recursively follows evaluation imports', () => {
        const sources = evaluationSourceHashes();
        for (const path of [
            'scripts/countries/anchorFit.ts',
            'scripts/evaluation/fit.ts',
            'scripts/evaluation/integrity.ts',
            'scripts/evaluation/partition.ts',
            'simulation/pure.ts',
        ]) {
            expect(sources).toHaveProperty(path);
            expect(artifact.sourceHashes[path]).toBe(sources[path]);
        }
        // Exercise a previously unseen nested dependency, not just a hardcoded fitter entry.
        const root = mkdtempSync(join(tmpdir(), 'evaluation-closure-'));
        try {
            mkdirSync(join(root, 'scripts/evaluation/nested'), { recursive: true });
            writeFileSync(join(root, 'package-lock.json'), '{}');
            writeFileSync(join(root, 'scripts/evaluation/run.ts'), "import './nested/one';");
            writeFileSync(join(root, 'scripts/evaluation/nested/one.ts'), "import './two';");
            writeFileSync(join(root, 'scripts/evaluation/nested/two.ts'), 'export const value = 1;');
            const before = evaluationSourceHashes(root);
            writeFileSync(join(root, 'scripts/evaluation/nested/two.ts'), 'export const value = 2;');
            const after = evaluationSourceHashes(root);
            expect(after['scripts/evaluation/nested/two.ts']).not.toBe(before['scripts/evaluation/nested/two.ts']);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it('accepts the registered unmodified artifact identity chain', () => {
        expect(() => assertPackageIdentities(protocolHash)).not.toThrow();
    });

    const staleInputs = [
        ['train.json', (data: any) => { data.excluded[0].reason += ' changed'; }],
        ['origin.json', (data: any) => { data.countries[0].ladder += 1; }],
        ['frozen-fit.json', (data: any) => { data.coefficients.intercept += 1; }],
        ['predictions.json', (data: any) => { data.rows[0].ladder += 1; }],
        ['test-outcomes.json', (data: any) => { data.ladder = {}; }],
        ['scores.json', (data: any) => { data.protocolHash = 'stale'; }],
        ['partition-provenance.json', (data: any) => { delete data.sourceHashes['data/hindcast/wellbeing-ladder.json']; }],
        ['sources/GE.EST.json', (data: any) => { data[1][0].value += 1; }],
        ['sources/provenance.json', (data: any) => { data['GE.EST'].sha256 = 'stale'; }],
        ['sources/wgi-indicator-catalog.json', (data: any) => { data[1][0].name += ' changed'; }],
        ['sources/catalog-provenance.json', (data: any) => { data.sha256 = 'stale'; }],
    ] as const;

    it.each(staleInputs)('rejects stale %s in the actual package command without overwriting output', (path, mutate) => {
        const root = mkdtempSync(join(tmpdir(), 'evaluation-package-'));
        try {
            for (const source of [
                evaluationBase,
                'data/countries/wb-2026-09.json',
                'data/hindcast/wellbeing-ladder.json',
                'data/hindcast/gdp-per-capita.json',
            ]) {
                mkdirSync(dirname(join(root, source)), { recursive: true });
                cpSync(source, join(root, source), { recursive: true });
            }
            const output = join(root, evaluationBase, 'experience.json');
            const before = readFileSync(output);
            const changedPath = join(root, evaluationBase, path);
            const data = JSON.parse(readFileSync(changedPath, 'utf8'));
            mutate(data);
            writeFileSync(changedPath, JSON.stringify(data));
            const result = spawnSync(process.execPath, [
                '--import', resolve('node_modules/tsx/dist/loader.mjs'),
                resolve('scripts/evaluation/run.ts'), 'package',
            ], { cwd: root, encoding: 'utf8' });
            expect(result.status).not.toBe(0);
            expect(result.stderr).toContain('Package identity mismatch');
            expect(readFileSync(output)).toEqual(before);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});

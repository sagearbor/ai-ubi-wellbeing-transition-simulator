/** Verify frozen research artifacts without fitting a model or rescoring outcomes. */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { verifyBindings, FAMILY, IDS } from './family-20260916';

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
const registry = read(`data/evaluation/${FAMILY}/registry.json`);
const present = registry.entries.filter((e: any) => existsSync(`data/evaluation/${e.id}/protocol.json`));

describe('published research artifact integrity (no outcome scoring)', () => {
    it('retains the complete declared family and original holdout identities', () => {
        expect(registry.entries.map((e: any) => e.id).sort()).toEqual([...IDS, 'research-objective-1980-v1'].sort());
        expect(present.length).toBeGreaterThan(0);
        verifyBindings(read(`data/evaluation/${FAMILY}/protected-artifacts.json`).sha256);
    });
    for (const entry of present) it(`preserves ${entry.id}'s freeze and sealed published score`, () => {
        const base = `data/evaluation/${entry.id}/`;
        expect(sha(base + 'protocol.json')).toBe(entry.protocolSha256);
        expect(sha(base + 'predictions.json')).toBe(entry.predictionsSha256);
        verifyBindings(read(base + 'scoring-manifest.json').bindings);
        const receipt = read(base + 'score-receipt.json');
        expect(receipt.status).toBe('completed');
        expect(receipt.protocolSha256).toBe(entry.protocolSha256);
        expect(receipt.predictionsSha256).toBe(entry.predictionsSha256);
        expect(receipt.scoresSha256).toBe(sha(base + 'scores.json'));
        const scores = read(base + 'scores.json');
        expect(scores.entry).toBe(entry.id);
        expect(scores.receipt.predictionsSha256).toBe(entry.predictionsSha256);
        expect(scores.receipt.preScoreCommit).toBe(receipt.preScoreCommit);
    });
});

import { it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceManifest, assertFreshSources } from './qualificationSources';
it('rejects a source edit even when its evaluated baseline number stays unchanged', () => {
    const root = mkdtempSync(join(tmpdir(), 'source-gate-'));
    try {
        writeFileSync(join(root, 'entry.ts'), "import {value} from './dependency'; export const baseline=value;");
        writeFileSync(join(root, 'dependency.ts'), 'export const value=1;');
        const pin = sourceManifest(root, ['entry.ts']);
        expect(() => assertFreshSources(root, pin, ['entry.ts'])).not.toThrow();
        writeFileSync(join(root, 'dependency.ts'), 'export const value=1; // unchanged number, unreviewed source');
        expect(() => assertFreshSources(root, pin, ['entry.ts'])).toThrow('stale');
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
});
it('binds transitive parser/schema/fixture imports and rejects unresolved local dependencies', () => {
    const root = mkdtempSync(join(tmpdir(), 'source-closure-'));
    try {
        writeFileSync(join(root, 'entry.ts'), "export {value} from './parser';");
        writeFileSync(join(root, 'parser.ts'), "import data from './fixture.json'; export const value=data.x;");
        writeFileSync(join(root, 'fixture.json'), '{"x":1}');
        const pin = sourceManifest(root, ['entry.ts']);
        expect(Object.keys(pin.sources)).toEqual(['entry.ts', 'fixture.json', 'parser.ts']);
        writeFileSync(join(root, 'parser.ts'), "import './missing';");
        expect(() => sourceManifest(root, ['entry.ts'])).toThrow('Unresolved');
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
});

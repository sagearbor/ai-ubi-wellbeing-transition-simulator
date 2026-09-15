import { it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { sourceManifest, currentSourceStatus } from './qualificationSources';
import { qualificationSourcePlugin } from './qualificationSourcePlugin';
it('guards direct builds and invalidates dev authority after a numerically neutral edit, without raw evidence', () => {
    const root = mkdtempSync(join(tmpdir(), 'qualification-vite-'));
    try {
        const pin = sourceManifest(process.cwd());
        for (const name of Object.keys(pin.sources)) {
            const destination = join(root, name);
            mkdirSync(dirname(destination), { recursive: true });
            copyFileSync(resolve(name), destination);
        }
        mkdirSync(join(root, 'data/qualification'), { recursive: true });
        writeFileSync(join(root, 'data/qualification/world-conditional-v1.json'), '{}');
        writeFileSync(join(root, 'data/qualification/world-conditional-v1-structure.json'), JSON.stringify(pin));
        writeFileSync(join(root, 'data/qualification/world-conditional-v1-evidence.json'), JSON.stringify({ structureHash: pin.hash, audit: { pass: true } }));
        expect(currentSourceStatus(root).hash).toBe(pin.hash);
        const plugin = qualificationSourcePlugin() as any;
        plugin.configResolved({ root, command: 'build' });
        expect(() => plugin.buildStart()).not.toThrow();
        const marker = join(root, 'simulation/sourceFreshness.ts');
        expect(plugin.transform('', marker).code).toContain(pin.hash);
        writeFileSync(marker, readFileSync(marker, 'utf8') + '\n// Numerically neutral, unreviewed edit.\n');
        expect(() => plugin.buildStart()).toThrow('stale');
        expect(() => plugin.generateBundle()).toThrow('stale');
        const changed = currentSourceStatus(root);
        expect(changed.actualHash).not.toBe(pin.hash);
        expect(plugin.transform('', marker).code).toContain(changed.actualHash);
        plugin.configResolved({ root, command: 'serve' });
        let invalidated = 0, reloaded = 0;
        plugin.configureServer({
            watcher: { on() { return this; }, off() { } },
            moduleGraph: { getModuleById: () => ({}), invalidateModule: () => invalidated++ },
            ws: { send: () => reloaded++ },
        });
        writeFileSync(marker, readFileSync(resolve('simulation/sourceFreshness.ts'), 'utf8'));
        plugin.handleHotUpdate();
        expect(invalidated).toBe(1);
        expect(reloaded).toBe(1);
        expect(plugin.transform('', marker).code).toContain(pin.hash);
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
});

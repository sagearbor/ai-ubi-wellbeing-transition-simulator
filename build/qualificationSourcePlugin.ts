import { resolve } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { assertCurrentSourceStatus, currentSourceStatus } from './qualificationSources';
/** Direct vite builds are guarded too. Dev remains usable for unreviewed edits, but its runtime
 * marker identifies changed sources and all open pages reload when freshness changes. */
export function qualificationSourcePlugin(): Plugin {
    let root = process.cwd(), building = false;
    let lastSignature: string | undefined;
    let server: ViteDevServer | undefined;
    const marker = () => resolve(root, 'simulation/sourceFreshness.ts');
    function refresh(): void {
        const signature = JSON.stringify(currentSourceStatus(root));
        if (signature !== lastSignature) {
            lastSignature = signature;
            const module = server?.moduleGraph.getModuleById(marker());
            if (module)
                server!.moduleGraph.invalidateModule(module);
            server?.ws.send({ type: 'full-reload' });
        }
    }
    return {
        name: 'qualification-source-freshness',
        enforce: 'pre',
        configResolved(config) { root = config.root; building = config.command === 'build'; },
        buildStart() { if (building)
            assertCurrentSourceStatus(root); },
        generateBundle() { if (building)
            assertCurrentSourceStatus(root); },
        configureServer(value) {
            server = value;
            lastSignature = JSON.stringify(currentSourceStatus(root));
            server.watcher.on('add', refresh).on('unlink', refresh);
            server.httpServer?.once('close', () => {
                server?.watcher.off('add', refresh).off('unlink', refresh);
            });
        },
        handleHotUpdate() { refresh(); },
        transform(_source, id) {
            if (id.split('?')[0] !== marker())
                return;
            const hash = currentSourceStatus(root).actualHash;
            return { code: `export function executingSourceHash() { return ${JSON.stringify(hash)}; }`, map: null };
        },
    };
}

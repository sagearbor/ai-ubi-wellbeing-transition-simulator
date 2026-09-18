import type { Plugin } from 'vite';
import { createReleaseIdentity, readSourceIdentity, type ReleaseIdentity } from './releaseIdentity';

const MODULE = 'virtual:release-identity';
const RESOLVED_MODULE = `\0${MODULE}`;
export function releaseIdentityPlugin(): Plugin {
  let root: string, identity: ReleaseIdentity;
  return {
    name: 'release-identity',
    configResolved(config) { root = config.root; identity = createReleaseIdentity(root); },
    resolveId(id) { if (id === MODULE) return RESOLVED_MODULE; },
    load(id) { if (id === RESOLVED_MODULE) return `export default ${JSON.stringify(identity)};`; },
    configureServer(server) {
      function refresh() {
        const next = { ...createReleaseIdentity(root), builtAt: identity.builtAt };
        if (JSON.stringify(next) === JSON.stringify(identity)) return;
        identity = next;
        const module = server.moduleGraph.getModuleById(RESOLVED_MODULE);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: 'full-reload' });
      }
      server.watcher.on('all', refresh);
      server.httpServer?.once('close', () => server.watcher.off('all', refresh));
      server.middlewares.use('/release.json', (_request, response) => {
        refresh();
        response.setHeader('Content-Type', 'application/json');
        response.setHeader('Cache-Control', 'no-store');
        response.end(JSON.stringify({ ...identity, assets: [] }));
      });
    },
    generateBundle(_options, bundle) {
      const current = readSourceIdentity(root);
      if (current.commit !== identity.commit || current.dirty !== identity.dirty) throw new Error('Source identity changed during the build; rebuild from a stable checkout.');
      const assets = Object.keys(bundle).filter(name => /\.(js|css)$/.test(name)).sort();
      this.emitFile({ type: 'asset', fileName: 'release.json', source: JSON.stringify({ ...identity, assets }, null, 2) + '\n' });
    },
  };
}

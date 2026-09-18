import { expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { execFileSync } from 'node:child_process';
import { releaseIdentityPlugin } from './releaseIdentityPlugin';
it('emits release identity and assets from a source package with no .git', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'release-build-')));
  try {
    writeFileSync(join(root, '.release-source.json'), JSON.stringify({ schemaVersion: 1, commit: 'a'.repeat(40), dirty: false }));
    writeFileSync(join(root, 'package.json'), '{"version":"1.2.3"}');
    writeFileSync(join(root, 'index.html'), '<script type="module" src="/app.js"></script>');
    writeFileSync(join(root, 'app.js'), "import identity from 'virtual:release-identity'; document.body.dataset.release = identity.commit;");
    const result = await build({ root, configFile: false, logLevel: 'silent', plugins: [releaseIdentityPlugin()], build: { write: false } }) as any;
    const manifest = JSON.parse(result.output.find((entry: any) => entry.fileName === 'release.json').source);
    expect(manifest).toMatchObject({ commit: 'a'.repeat(40), dirty: false, version: '1.2.3', schemaVersion: 1 });
    expect(manifest.assets).toHaveLength(1);
    expect(result.output.find((entry: any) => entry.fileName === manifest.assets[0]).code).toContain('a'.repeat(40));
    expect(Number.isFinite(Date.parse(manifest.builtAt))).toBe(true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refreshes the dev identity when a formerly clean checkout is edited', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'release-dev-')));
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    writeFileSync(join(root, 'package.json'), '{"version":"1.2.3"}');
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['-c', 'user.name=Release Test', '-c', 'user.email=release@example.invalid', 'commit', '-qm', 'fixture'], { cwd: root });
    const plugin = releaseIdentityPlugin() as any;
    plugin.configResolved({ root, command: 'serve' });
    const id = plugin.resolveId('virtual:release-identity');
    expect(plugin.load(id)).toContain('"dirty":false');
    let refresh: () => void, reloads = 0;
    plugin.configureServer({
      middlewares: { use() {} },
      watcher: { on(_event: string, callback: () => void) { refresh = callback; }, off() {} },
      moduleGraph: { getModuleById() { return {}; }, invalidateModule() {} },
      ws: { send() { reloads++; } },
    });
    writeFileSync(join(root, 'new-source.ts'), 'export const changed = true;');
    refresh!();
    expect(plugin.load(id)).toContain('"dirty":true');
    expect(reloads).toBe(1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

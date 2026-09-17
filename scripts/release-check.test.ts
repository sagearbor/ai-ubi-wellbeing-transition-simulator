import { afterEach, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { checkRelease } from './release-check';
const commit = 'a'.repeat(40);
const release = { schemaVersion: 1, commit, dirty: false, builtAt: '2026-09-17T00:00:00.000Z', version: '1.2.3', assets: ['assets/index-abc.js', 'assets/index-def.css'] };
const servers: Server[] = [];
async function site(overrides: Record<string, { status?: number; type?: string; body: string }> = {}) {
  const routes = { '/': { type: 'text/html', body: '<!doctype html><script type="module" src="/assets/index-abc.js"></script>' }, '/release.json': { type: 'application/json', body: JSON.stringify(release) }, '/assets/index-abc.js': { type: 'application/javascript', body: 'console.log("fixture")' }, '/assets/index-def.css': { type: 'text/css', body: 'body { color: black; }' }, ...overrides };
  const server = createServer((req, res) => { const route = routes[req.url!] ?? { status: 404, body: 'missing' }; res.writeHead(route.status ?? 200, { 'Content-Type': route.type ?? 'text/plain' }); res.end(route.body); });
  servers.push(server);
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = (server.address() as { port: number }).port;
  return `http://127.0.0.1:${port}`;
}
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }))); });
it('verifies exact clean identity and every emitted asset over HTTP', async () => {
  expect(await checkRelease(await site(), commit)).toMatchObject({ commit, assetsChecked: 2 });
});
it.each([
  ['SPA fallback', { type: 'text/html', body: '<html>app shell</html>' }, /JSON/i],
  ['malformed JSON', { type: 'application/json', body: '{bad' }, /JSON/i],
  ['unknown commit', { type: 'application/json', body: JSON.stringify({ ...release, commit: 'unknown', dirty: null }) }, /unknown/i],
  ['wrong commit', { type: 'application/json', body: JSON.stringify({ ...release, commit: 'b'.repeat(40) }) }, /mismatch/i],
  ['dirty source', { type: 'application/json', body: JSON.stringify({ ...release, dirty: true }) }, /dirty/i],
  ['missing assets', { type: 'application/json', body: JSON.stringify({ ...release, assets: [] }) }, /assets/i],
] as const)('rejects %s', async (_name, response, expected) => {
  await expect(checkRelease(await site({ '/release.json': response }), commit)).rejects.toThrow(expected);
});
it('rejects an asset returning an error status', async () => {
  await expect(checkRelease(await site({ '/assets/index-def.css': { status: 404, body: 'missing' } }), commit)).rejects.toThrow(/asset.*404/i);
});
it('rejects a missing asset hidden by a successful SPA fallback', async () => {
  await expect(checkRelease(await site({ '/assets/index-abc.js': { type: 'text/html', body: '<html>fallback</html>' } }), commit)).rejects.toThrow(/asset.*HTML|asset.*type/i);
});
it('rejects cross-origin asset URLs before requesting them', async () => {
  await expect(checkRelease(await site({ '/release.json': { type: 'application/json', body: JSON.stringify({ ...release, assets: ['https://example.invalid/key'] }) } }), commit)).rejects.toThrow(/asset/i);
});
it('rejects cached HTML that points at a different release entry asset', async () => {
  await expect(checkRelease(await site({ '/': { type: 'text/html', body: '<script type="module" src="/assets/stale-build.js"></script>' } }), commit)).rejects.toThrow(/HTML.*asset|entry.*asset/i);
});
it('rejects a nominal HTML page with no emitted application script', async () => {
  await expect(checkRelease(await site({ '/': { type: 'text/html', body: '<script>window.login=true</script>' } }), commit)).rejects.toThrow(/HTML.*asset|entry.*asset/i);
});

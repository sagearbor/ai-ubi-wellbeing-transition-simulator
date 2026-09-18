import { pathToFileURL } from 'node:url';
import { COMMIT_PATTERN, type ReleaseManifest } from '../build/releaseIdentity';

function validateManifest(value: unknown, expectedCommit: string): ReleaseManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Release JSON must contain an identity object.');
  const release = value as ReleaseManifest;
  if (release.commit === 'unknown' || release.dirty === null) throw new Error('Release identity is unknown; deploy an identified source package.');
  if (release.schemaVersion !== 1 || !COMMIT_PATTERN.test(release.commit) || !Number.isFinite(Date.parse(release.builtAt)) || typeof release.version !== 'string' || !release.version.length) throw new Error('Release JSON has a malformed identity.');
  if (release.commit !== expectedCommit) throw new Error(`Release commit mismatch: expected ${expectedCommit}, received ${release.commit}.`);
  if (release.dirty !== false) throw new Error('Release source is dirty or its clean status is missing.');
  if (!Array.isArray(release.assets) || release.assets.length === 0 || !release.assets.some(asset => typeof asset === 'string' && asset.endsWith('.js')) || release.assets.some(asset => typeof asset !== 'string' || !/^assets\/[a-zA-Z0-9_./-]+\.(js|css)$/.test(asset) || asset.includes('..'))) throw new Error('Release assets are missing or contain invalid paths.');
  return release;
}

export async function checkRelease(base: string, expectedCommit: string): Promise<ReleaseManifest & { assetsChecked: number }> {
  if (!COMMIT_PATTERN.test(expectedCommit)) throw new Error('An exact full expected Git commit is required.');
  const origin = new URL(base);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.search || origin.hash || !['', '/'].includes(origin.pathname)) throw new Error('Use the site origin without credentials, path, query, or fragment.');
  async function get(path: string) {
    let response: Response;
    try { response = await fetch(new URL(path, origin), { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20000) }); }
    catch { throw new Error(`Could not fetch ${path}; check reachability and access to the origin.`); }
    if (!response.ok) throw new Error(`${path.startsWith('/assets/') ? 'Asset' : 'Release check'} ${path} returned HTTP ${response.status}.`);
    return response;
  }
  const response = await get('/release.json');
  if (!/\bapplication\/json\b/i.test(response.headers.get('content-type') ?? '')) throw new Error('release.json did not return JSON; an SPA fallback or sign-in page is not release identity.');
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new Error('release.json returned malformed JSON.'); }
  const release = validateManifest(payload, expectedCommit);
  const index = await get('/');
  const html = await index.text();
  if (!/text\/html/i.test(index.headers.get('content-type') ?? '')) throw new Error('The site root did not return an application HTML document.');
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)].map(match => match[1]);
  if (!scripts.length || scripts.some(source => {
    try { const url = new URL(source, origin); return url.origin !== origin.origin || !!url.search || !!url.hash || !release.assets.includes(url.pathname.slice(1)); }
    catch { return true; }
  })) throw new Error('Application HTML does not reference this release entry asset; a stale shell or sign-in page may be served.');
  // Check emitted JS/CSS chunks, including lazily loaded views, not only the entry script.
  for (const asset of release.assets) {
    const assetResponse = await get(`/${asset}`);
    const type = assetResponse.headers.get('content-type') ?? '';
    const expectedType = asset.endsWith('.css') ? /text\/css/i : /(?:application|text)\/(?:javascript|ecmascript)/i;
    if (!expectedType.test(type)) throw new Error(`Asset ${asset} returned an unexpected content type (possibly HTML fallback).`);
    const body = await assetResponse.text();
    if (!body.trim() || /^\s*(?:<!doctype\s+html|<html)\b/i.test(body)) throw new Error(`Asset ${asset} returned empty content or HTML fallback.`);
  }
  return { ...release, assetsChecked: release.assets.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [origin, expectedCommit, ...extra] = process.argv.slice(2);
  if (!origin || !expectedCommit || extra.length) { console.error('Usage: node --import tsx scripts/release-check.ts SITE_ORIGIN FULL_EXPECTED_COMMIT'); process.exitCode = 1; }
  else {
    try { const result = await checkRelease(origin, expectedCommit); console.log(JSON.stringify({ ok: true, origin, ...result }, null, 2)); }
    catch (error) { console.error(`Release check failed: ${(error as Error).message}`); process.exitCode = 1; }
  }
}

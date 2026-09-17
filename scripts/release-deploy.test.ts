import { describe, expect, it } from 'vitest';
import { namedTraffic, parseReleaseCommand, assertSameTraffic, validateReceipt } from './release-deploy';

describe('explicit deployment operations', () => {
  it('refuses immediate promotion and requires a saved candidate receipt', () => {
    expect(parseReleaseCommand([])).toEqual({ action: 'preview' });
    expect(() => parseReleaseCommand(['--promote'])).toThrow(/receipt/i);
    expect(parseReleaseCommand(['--promote', 'tmp/releases/one.json'])).toEqual({ action: 'promote', receipt: 'tmp/releases/one.json' });
    expect(parseReleaseCommand(['--rollback', 'tmp/releases/one.json'])).toEqual({ action: 'rollback', receipt: 'tmp/releases/one.json' });
    expect(() => parseReleaseCommand(['--promote', 'one.json', '--to-latest'])).toThrow();
  });
  it('records the actual serving revisions and preserves traffic splits', () => {
    expect(namedTraffic({ status: { traffic: [{ revisionName: 'app-old', percent: 30 }, { revisionName: 'app-older', percent: 70 }, { revisionName: 'app-preview', tag: 'preview', url: 'https://preview.example' }] } })).toEqual({ 'app-old': 30, 'app-older': 70 });
  });
  it('refuses unresolved latest-revision and incomplete traffic state', () => {
    expect(() => namedTraffic({ status: { traffic: [{ latestRevision: true, percent: 100 }] } })).toThrow(/named/i);
    expect(() => namedTraffic({ status: { traffic: [{ revisionName: 'app-old', percent: 90 }] } })).toThrow(/100/);
  });
  it('blocks a stale receipt if serving traffic changed after preview creation', () => {
    expect(() => assertSameTraffic({ 'app-other': 100 }, { 'app-old': 100 })).toThrow(/changed/i);
    expect(() => assertSameTraffic({ 'app-a': 60, 'app-b': 40 }, { 'app-b': 40, 'app-a': 60 })).not.toThrow();
  });
  it('refuses malformed or ambiguous deployment receipts', () => {
    expect(() => validateReceipt({})).toThrow(/receipt/i);
    expect(() => validateReceipt({ schemaVersion: 1, project: 'project', region: 'us-west1', service: 'app', commit: 'a'.repeat(40), candidateRevision: 'app-candidate', previousTraffic: { LATEST: 100 }, status: 'preview_ready', origin: 'https://app.example', previewUrl: 'https://preview.example', tag: 'preview' })).toThrow(/named|receipt/i);
  });
});

// The external Cloud Run CLI is replaced at the process boundary. Git staging,
// receipt persistence, HTTP response validation and command sequencing are real.
import { afterEach, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runReleaseCommand } from './release-deploy';
const fixtures: string[] = [];
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); fixtures.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'release-workflow-')); fixtures.push(root);
  const repo = join(root, 'repo'); mkdirSync(repo);
  writeFileSync(join(repo, '.gitignore'), 'tmp/\n.env.local\n');
  writeFileSync(join(repo, 'package.json'), '{"version":"1.2.3"}');
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['add', '.'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=Release Test', '-c', 'user.email=release@example.invalid', 'commit', '-qm', 'fixture'], { cwd: repo });
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  const state = join(root, 'state.json');
  writeFileSync(state, JSON.stringify({ calls: [], traffic: [{ revisionName: 'fixture-app-old', percent: 100 }] }));
  const cli = join(root, 'gcloud');
  writeFileSync(cli, `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const file = process.env.RELEASE_TEST_STATE;
const state = JSON.parse(fs.readFileSync(file, 'utf8'));
const args = process.argv.slice(2);
state.calls.push(args);
const value = key => args[args.indexOf(key) + 1];
if (args[0] !== 'run') process.exit(2);
if (args[1] === 'deploy') {
  if (!args.includes('--no-traffic') || args.includes('--to-latest') || args.includes('--allow-unauthenticated')) process.exit(3);
  const source = value('--source');
  if (fs.existsSync(path.join(source, '.git'))) process.exit(4);
  state.identity = JSON.parse(fs.readFileSync(path.join(source, '.release-source.json'), 'utf8'));
  state.source = source;
  state.preview = { revisionName: 'fixture-app-' + value('--revision-suffix'), tag: value('--tag'), url: 'https://preview.example' };
}
if (args[2] === 'update-traffic') {
  if (process.env.RELEASE_TEST_FAIL_BEFORE_APPLY === '1') { fs.writeFileSync(file, JSON.stringify(state)); process.exit(7); }
  if (args.includes('--to-latest') || !args.includes('--to-revisions')) process.exit(5);
  state.traffic = value('--to-revisions').split(',').map(value => { const [revisionName, percent] = value.split('='); return { revisionName, percent: Number(percent) }; });
}
fs.writeFileSync(file, JSON.stringify(state));
if (args[2] === 'update-traffic' && process.env.RELEASE_TEST_LOSE_RESPONSE === '1') process.exit(6);
console.log(JSON.stringify({ status: { url: 'https://public.example', traffic: [...state.traffic, ...(state.preview ? [state.preview] : [])] } }));
`);
  chmodSync(cli, 0o755);
  vi.stubEnv('PATH', `${root}:${process.env.PATH}`);
  vi.stubEnv('RELEASE_TEST_STATE', state);
  vi.stubEnv('CLOUD_RUN_SERVICE', 'fixture-app');
  vi.stubEnv('DEPLOY_TAG', 'fixture-preview');
  vi.spyOn(console, 'log').mockImplementation(() => {});
  function receiptFile() { return join(repo, 'tmp', 'releases', readdirSync(join(repo, 'tmp', 'releases'))[0]); }
  function readState() { return JSON.parse(readFileSync(state, 'utf8')); }
  function updateState(change: (state: any) => void) { const current = readState(); change(current); writeFileSync(state, JSON.stringify(current)); }
  function respond(expected = commit, onFetch?: (url: URL) => void) {
    vi.stubGlobal('fetch', async (url: URL) => {
      onFetch?.(url);
      if (url.pathname === '/release.json') return new Response(JSON.stringify({ schemaVersion: 1, commit: expected, dirty: false, builtAt: '2026-09-17T00:00:00.000Z', version: '1.2.3', assets: ['assets/app.js'] }), { headers: { 'Content-Type': 'application/json' } });
      if (url.pathname === '/') return new Response('<script src="/assets/app.js"></script>', { headers: { 'Content-Type': 'text/html' } });
      return new Response('console.log("fixture")', { headers: { 'Content-Type': 'application/javascript' } });
    });
  }
  return { repo, commit, receiptFile, readState, updateState, respond };
}
it('stages a clean preview, promotes only that revision, and restores the prior revision', async () => {
  const f = fixture();
  await runReleaseCommand([], f.repo);
  const preview = JSON.parse(readFileSync(f.receiptFile(), 'utf8'));
  expect(preview).toMatchObject({ commit: f.commit, status: 'preview_ready', previousTraffic: { 'fixture-app-old': 100 }, previewUrl: 'https://preview.example' });
  expect(f.readState().identity).toMatchObject({ commit: f.commit, dirty: false });
  expect(f.readState().traffic).toEqual([{ revisionName: 'fixture-app-old', percent: 100 }]);
  expect(existsSync(f.readState().source)).toBe(false);
  f.respond();
  await runReleaseCommand(['--promote', f.receiptFile()], f.repo);
  expect(f.readState().traffic).toEqual([{ revisionName: preview.candidateRevision, percent: 100 }]);
  expect(JSON.parse(readFileSync(f.receiptFile(), 'utf8')).publicVerifiedAt).toBeTruthy();
  await runReleaseCommand(['--rollback', f.receiptFile()], f.repo);
  expect(f.readState().traffic).toEqual([{ revisionName: 'fixture-app-old', percent: 100 }]);
  expect(JSON.parse(readFileSync(f.receiptFile(), 'utf8')).status).toBe('rolled_back');
});
it('never mutates traffic when candidate identity fails verification', async () => {
  const f = fixture();
  await runReleaseCommand([], f.repo);
  f.respond('b'.repeat(40));
  await expect(runReleaseCommand(['--promote', f.receiptFile()], f.repo)).rejects.toThrow(/mismatch/i);
  expect(f.readState().calls.some((args: string[]) => args.includes('update-traffic'))).toBe(false);
});
it('retains a usable rollback receipt when promotion succeeds but its response is lost', async () => {
  const f = fixture();
  await runReleaseCommand([], f.repo);
  f.respond();
  vi.stubEnv('RELEASE_TEST_LOSE_RESPONSE', '1');
  await expect(runReleaseCommand(['--promote', f.receiptFile()], f.repo)).rejects.toThrow(/gcloud/);
  expect(JSON.parse(readFileSync(f.receiptFile(), 'utf8')).status).toBe('promoting');
  vi.stubEnv('RELEASE_TEST_LOSE_RESPONSE', '0');
  await runReleaseCommand(['--rollback', f.receiptFile()], f.repo);
  expect(f.readState().traffic).toEqual([{ revisionName: 'fixture-app-old', percent: 100 }]);
});
it('finishes an interrupted rollback by verifying the already-restored revisions', async () => {
  const f = fixture();
  await runReleaseCommand([], f.repo);
  f.respond();
  await runReleaseCommand(['--promote', f.receiptFile()], f.repo);
  vi.stubEnv('RELEASE_TEST_LOSE_RESPONSE', '1');
  await expect(runReleaseCommand(['--rollback', f.receiptFile()], f.repo)).rejects.toThrow(/gcloud/);
  expect(JSON.parse(readFileSync(f.receiptFile(), 'utf8')).status).toBe('rolling_back');
  const writesBeforeRetry = f.readState().calls.filter((args: string[]) => args.includes('update-traffic')).length;
  vi.stubEnv('RELEASE_TEST_LOSE_RESPONSE', '0');
  await runReleaseCommand(['--rollback', f.receiptFile()], f.repo);
  expect(f.readState().calls.filter((args: string[]) => args.includes('update-traffic')).length).toBe(writesBeforeRetry);
  expect(JSON.parse(readFileSync(f.receiptFile(), 'utf8')).status).toBe('rolled_back');
});

it('refuses promotion when serving traffic changes during candidate asset checks', async () => {
  const f = fixture();
  await runReleaseCommand([], f.repo);
  f.respond(f.commit, url => {
    if (url.hostname === 'preview.example' && url.pathname === '/assets/app.js') f.updateState(state => { state.traffic = [{ revisionName: 'fixture-app-other', percent: 100 }]; });
  });
  await expect(runReleaseCommand(['--promote', f.receiptFile()], f.repo)).rejects.toThrow(/traffic changed/i);
  expect(f.readState().calls.some((args: string[]) => args.includes('update-traffic'))).toBe(false);
  expect(f.readState().traffic).toEqual([{ revisionName: 'fixture-app-other', percent: 100 }]);
  expect(JSON.parse(readFileSync(f.receiptFile(), 'utf8')).status).toBe('preview_ready');
});
it.each(['revision', 'url'])('refuses promotion when preview %s binding changes during asset checks', async binding => {
  const f = fixture();
  await runReleaseCommand([], f.repo);
  f.respond(f.commit, url => {
    if (url.hostname === 'preview.example' && url.pathname === '/assets/app.js') f.updateState(state => {
      if (binding === 'revision') state.preview.revisionName = 'fixture-app-other';
      else state.preview.url = 'https://another-preview.example';
    });
  });
  await expect(runReleaseCommand(['--promote', f.receiptFile()], f.repo)).rejects.toThrow(/preview/i);
  expect(f.readState().calls.some((args: string[]) => args.includes('update-traffic'))).toBe(false);
  expect(JSON.parse(readFileSync(f.receiptFile(), 'utf8')).status).toBe('preview_ready');
});
it('verifies rollback without a write when promotion failed before applying traffic', async () => {
  const f = fixture();
  await runReleaseCommand([], f.repo);
  f.respond();
  vi.stubEnv('RELEASE_TEST_FAIL_BEFORE_APPLY', '1');
  await expect(runReleaseCommand(['--promote', f.receiptFile()], f.repo)).rejects.toThrow(/gcloud/);
  expect(JSON.parse(readFileSync(f.receiptFile(), 'utf8')).status).toBe('promoting');
  expect(f.readState().traffic).toEqual([{ revisionName: 'fixture-app-old', percent: 100 }]);
  const writesBeforeRollback = f.readState().calls.filter((args: string[]) => args.includes('update-traffic')).length;
  await runReleaseCommand(['--rollback', f.receiptFile()], f.repo);
  expect(f.readState().calls.filter((args: string[]) => args.includes('update-traffic')).length).toBe(writesBeforeRollback);
  expect(JSON.parse(readFileSync(f.receiptFile(), 'utf8')).status).toBe('rolled_back');
});
it('refuses rollback when an interrupted promotion is followed by unrelated serving traffic', async () => {
  const f = fixture();
  await runReleaseCommand([], f.repo);
  f.respond();
  vi.stubEnv('RELEASE_TEST_FAIL_BEFORE_APPLY', '1');
  await expect(runReleaseCommand(['--promote', f.receiptFile()], f.repo)).rejects.toThrow(/gcloud/);
  f.updateState(state => { state.traffic = [{ revisionName: 'fixture-app-other', percent: 100 }]; });
  const writesBeforeRollback = f.readState().calls.filter((args: string[]) => args.includes('update-traffic')).length;
  await expect(runReleaseCommand(['--rollback', f.receiptFile()], f.repo)).rejects.toThrow(/traffic changed/i);
  expect(f.readState().calls.filter((args: string[]) => args.includes('update-traffic')).length).toBe(writesBeforeRollback);
  expect(JSON.parse(readFileSync(f.receiptFile(), 'utf8')).status).toBe('promoting');
});

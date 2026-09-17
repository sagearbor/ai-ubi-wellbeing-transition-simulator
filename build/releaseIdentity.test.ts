import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { prepareReleaseSource, readSourceIdentity, createReleaseIdentity } from './releaseIdentity';

const roots: string[] = [];
function temporary() { const root = mkdtempSync(join(tmpdir(), 'release-test-')); roots.push(root); return root; }
function git(root: string, ...args: string[]) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function repository() {
  const root = temporary();
  git(root, 'init', '-q');
  writeFileSync(join(root, '.gitignore'), '.env.local\n');
  writeFileSync(join(root, 'package.json'), '{"version":"1.2.3"}');
  writeFileSync(join(root, 'index.html'), '<html>Release fixture</html>');
  git(root, 'add', '.');
  git(root, '-c', 'user.name=Release Test', '-c', 'user.email=release@example.invalid', 'commit', '-qm', 'fixture');
  return root;
}
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));

describe('source identity', () => {
  it('reports unknown for an unpackaged directory instead of inventing a commit', () => {
    const root = temporary();
    writeFileSync(join(root, 'package.json'), '{"version":"1.2.3"}');
    expect(createReleaseIdentity(root)).toMatchObject({ commit: 'unknown', dirty: null, version: '1.2.3' });
  });
  it('marks both tracked edits and untracked source as dirty', () => {
    const root = repository();
    const commit = git(root, 'rev-parse', 'HEAD');
    expect(readSourceIdentity(root)).toEqual({ commit, dirty: false });
    writeFileSync(join(root, 'index.html'), 'edited');
    expect(readSourceIdentity(root)).toEqual({ commit, dirty: true });
    git(root, 'checkout', '--', 'index.html');
    writeFileSync(join(root, 'new.ts'), '// uncommitted source');
    expect(readSourceIdentity(root)).toEqual({ commit, dirty: true });
  });
  it('stages the exact committed source and carries identity without .git', () => {
    const root = repository(), destination = temporary();
    writeFileSync(join(root, '.env.local'), 'GEMINI_API_KEY=fixture-only-not-a-key');
    const commit = git(root, 'rev-parse', 'HEAD');
    prepareReleaseSource(root, destination);
    expect(existsSync(join(destination, '.git'))).toBe(false);
    expect(readSourceIdentity(destination)).toEqual({ commit, dirty: false });
    expect(readFileSync(join(destination, 'index.html'), 'utf8')).toBe('<html>Release fixture</html>');
    expect(readFileSync(join(destination, '.env.local'), 'utf8')).toContain('fixture-only');
    expect(readFileSync(join(destination, '.release-source.json'), 'utf8')).not.toContain('GEMINI');
  });
  it('refuses dirty deployment packaging before creating source files', () => {
    const root = repository(), destination = temporary();
    writeFileSync(join(root, 'new.ts'), 'uncommitted');
    expect(() => prepareReleaseSource(root, destination)).toThrow(/dirty|uncommitted/i);
    expect(existsSync(join(destination, 'package.json'))).toBe(false);
  });
  it('does not let a stale package marker override a dirty Git checkout', () => {
    const root = repository();
    writeFileSync(join(root, '.release-source.json'), JSON.stringify({ schemaVersion: 1, commit: 'a'.repeat(40), dirty: false }));
    expect(readSourceIdentity(root)).toEqual({ commit: git(root, 'rev-parse', 'HEAD'), dirty: true });
  });
  it('rejects a malformed package marker', () => {
    const root = temporary();
    writeFileSync(join(root, '.release-source.json'), '<html>not a release</html>');
    expect(() => readSourceIdentity(root)).toThrow(/identity|marker/i);
  });
});

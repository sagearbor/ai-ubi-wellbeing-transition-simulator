import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export interface SourceIdentity { commit: string; dirty: boolean | null }
export interface ReleaseIdentity extends SourceIdentity { schemaVersion: 1; builtAt: string; version: string }
export interface ReleaseManifest extends ReleaseIdentity { assets: string[] }
export const COMMIT_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const MARKER = '.release-source.json';
function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function isGitRoot(root: string): boolean {
  try { return realpathSync(git(root, 'rev-parse', '--show-toplevel')) === realpathSync(root); }
  catch { return false; }
}

/** Only a checkout at this root may supply Git identity; never inherit a parent repository. */
export function readSourceIdentity(root: string): SourceIdentity {
  if (isGitRoot(root)) {
    try { return { commit: git(root, 'rev-parse', 'HEAD'), dirty: git(root, 'status', '--porcelain', '--untracked-files=normal') !== '' }; }
    catch { return { commit: 'unknown', dirty: null }; }
  }
  if (!existsSync(join(root, MARKER))) return { commit: 'unknown', dirty: null };
  try {
    const marker = JSON.parse(readFileSync(join(root, MARKER), 'utf8'));
    if (marker.schemaVersion !== 1 || !COMMIT_PATTERN.test(marker.commit) || marker.dirty !== false) throw new Error('invalid marker');
    return { commit: marker.commit, dirty: false };
  } catch { throw new Error('Invalid staged release identity marker; recreate the source package.'); }
}

export function createReleaseIdentity(root: string): ReleaseIdentity {
  let version = 'unknown';
  try { const value = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version; if (typeof value === 'string' && value.length) version = value; } catch { /* A plain source folder has an explicitly unknown version. */ }
  return { schemaVersion: 1, ...readSourceIdentity(root), builtAt: new Date().toISOString(), version };
}

/** Snapshot committed bytes before upload; .git is unnecessary on the build server. */
export function prepareReleaseSource(root: string, destination: string): SourceIdentity {
  if (!isGitRoot(root)) throw new Error('Release packaging requires the root of a Git checkout.');
  const identity = readSourceIdentity(root);
  if (!COMMIT_PATTERN.test(identity.commit) || identity.dirty !== false) throw new Error('Release packaging refuses a dirty or uncommitted checkout. Commit all intended source changes first.');
  if (readdirSync(destination).length !== 0) throw new Error('Release staging directory must be empty.');
  const scratch = mkdtempSync(join(tmpdir(), 'release-archive-'));
  try {
    const archive = join(scratch, 'source.tar');
    git(root, 'archive', '--format=tar', `--output=${archive}`, identity.commit);
    execFileSync('tar', ['-xf', archive, '-C', resolve(destination)], { stdio: ['ignore', 'pipe', 'pipe'] });
    // Existing deployment contract: Vite consumes this ignored, browser-side key file.
    // Its contents are never included in release metadata or printed by this tooling.
    if (existsSync(join(root, '.env.local'))) copyFileSync(join(root, '.env.local'), join(destination, '.env.local'));
    writeFileSync(join(destination, MARKER), JSON.stringify({ schemaVersion: 1, ...identity }, null, 2) + '\n');
    return identity;
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

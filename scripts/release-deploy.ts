import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COMMIT_PATTERN, prepareReleaseSource } from '../build/releaseIdentity';
import { checkRelease } from './release-check';

type Traffic = Record<string, number>;
interface Target { project: string; region: string; service: string }
interface Receipt extends Target {
  schemaVersion: 1;
  commit: string;
  candidateRevision: string;
  previousTraffic: Traffic;
  origin: string;
  tag: string;
  previewUrl: string | null;
  createdAt: string;
  status: 'prepared' | 'preview_ready' | 'promoting' | 'promoted' | 'rolling_back' | 'rolled_back';
  publicVerifiedAt?: string;
}
type Command = { action: 'preview' } | { action: 'help' } | { action: 'promote' | 'rollback'; receipt: string };
const NAME = /^[a-z][a-z0-9-]{0,61}[a-z0-9]$/;

export function parseReleaseCommand(args: string[]): Command {
  if (args.length === 0) return { action: 'preview' };
  if (args.length === 1 && args[0] === '--help') return { action: 'help' };
  if (args.length === 2 && ['--promote', '--rollback'].includes(args[0]) && !args[1].startsWith('-')) return { action: args[0] === '--promote' ? 'promote' : 'rollback', receipt: args[1] };
  throw new Error('Use no arguments for preview, or --promote RECEIPT.json / --rollback RECEIPT.json. A saved receipt is required; immediate promotion is disabled.');
}

export function namedTraffic(service: any): Traffic {
  const traffic: Traffic = {};
  for (const item of service.status?.traffic ?? []) {
    if (!item.percent) continue;
    if (!NAME.test(item.revisionName ?? '') || !Number.isInteger(item.percent) || item.percent < 1 || item.percent > 100) throw new Error('Cloud Run traffic must resolve to explicit named revisions.');
    traffic[item.revisionName] = (traffic[item.revisionName] ?? 0) + item.percent;
  }
  if (Object.values(traffic).reduce((sum, value) => sum + value, 0) !== 100) throw new Error('Cannot capture rollback: serving revision traffic must total 100 percent.');
  return traffic;
}

function sameTraffic(actual: Traffic, expected: Traffic): boolean {
  const sorted = (traffic: Traffic) => Object.entries(traffic).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(sorted(actual)) === JSON.stringify(sorted(expected));
}
export function assertSameTraffic(actual: Traffic, expected: Traffic): void {
  if (!sameTraffic(actual, expected)) throw new Error('Serving traffic changed since this release receipt was created. Inspect current revisions before proceeding.');
}
function safeOrigin(value: unknown): boolean {
  try { const url = new URL(String(value)); return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/'; } catch { return false; }
}
export function validateReceipt(value: unknown): Receipt {
  const receipt = value as Receipt;
  if (!receipt || receipt.schemaVersion !== 1 || !/^[a-z0-9-]+$/.test(receipt.project ?? '') || !NAME.test(receipt.region ?? '') || !NAME.test(receipt.service ?? '') || !COMMIT_PATTERN.test(receipt.commit ?? '') || !NAME.test(receipt.candidateRevision ?? '') || !receipt.candidateRevision.startsWith(`${receipt.service}-`) || !NAME.test(receipt.tag ?? '') || !safeOrigin(receipt.origin) || !safeOrigin(receipt.previewUrl) || !['preview_ready', 'promoting', 'promoted', 'rolling_back', 'rolled_back'].includes(receipt.status) || !receipt.previousTraffic || typeof receipt.previousTraffic !== 'object' || Array.isArray(receipt.previousTraffic)) throw new Error('Invalid deployment receipt; use the JSON file saved by a completed preview deployment.');
  const traffic = Object.entries(receipt.previousTraffic).map(([revisionName, percent]) => ({ revisionName, percent }));
  if (traffic.some(item => !item.revisionName.startsWith(`${receipt.service}-`))) throw new Error('Deployment receipt must name previous revisions of this service.');
  namedTraffic({ status: { traffic } });
  return receipt;
}
function cloud(args: string[], target: Target): any {
  let output: string;
  try { output = execFileSync('gcloud', [...args, '--project', target.project, '--region', target.region, '--quiet', '--format=json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 8 * 1024 * 1024 }); }
  catch { throw new Error('gcloud command failed; no successful release operation is claimed. Inspect the diagnostic above and the saved receipt.'); }
  try { return JSON.parse(output); } catch { throw new Error('gcloud returned no parseable service state. Inspect Cloud Run before retrying.'); }
}
function describe(target: Target): any { return cloud(['run', 'services', 'describe', target.service], target); }
function saveReceipt(file: string, receipt: Receipt): void {
  writeFileSync(`${file}.tmp`, JSON.stringify(receipt, null, 2) + '\n');
  renameSync(`${file}.tmp`, file);
}
function previewTarget(service: any, receipt: Receipt): string {
  const entry = (service.status?.traffic ?? []).find((item: any) => item.tag === receipt.tag && item.revisionName === receipt.candidateRevision);
  if (!entry || !safeOrigin(entry.url)) throw new Error('The expected tagged preview revision was not returned by Cloud Run. Inspect the saved candidate revision.');
  return entry.url;
}

async function preview(root: string): Promise<void> {
  const target = { project: process.env.GCP_PROJECT || 'gen-lang-client-0281141814', region: process.env.GCP_REGION || 'us-west1', service: process.env.CLOUD_RUN_SERVICE || 'wellbeing-transition-simulator' };
  const stage = mkdtempSync(join(tmpdir(), 'alignment-release-source-'));
  try {
    const identity = prepareReleaseSource(root, stage);
    const before = describe(target); // Existing service only; no implicit creation or access-policy edits.
    const previousTraffic = namedTraffic(before);
    if (!safeOrigin(before.status?.url)) throw new Error('Cloud Run did not return a usable public service origin.');
    const stamp = Date.now().toString(36);
    const suffix = `r-${identity.commit.slice(0, 12)}-${stamp}`;
    const candidateRevision = `${target.service}-${suffix}`;
    const tag = process.env.DEPLOY_TAG || `preview-${identity.commit.slice(0, 8)}-${stamp}`;
    if (!NAME.test(candidateRevision) || !NAME.test(tag)) throw new Error('Generated revision or preview tag is invalid or exceeds 63 characters.');
    const directory = join(root, 'tmp', 'releases');
    mkdirSync(directory, { recursive: true });
    const file = join(directory, `${candidateRevision}.json`);
    const receipt: Receipt = { schemaVersion: 1, ...target, commit: identity.commit, candidateRevision, previousTraffic, origin: before.status.url, tag, previewUrl: null, createdAt: new Date().toISOString(), status: 'prepared' };
    saveReceipt(file, receipt);
    console.log(`Saved rollback state and candidate identity: ${file}`);
    cloud(['run', 'deploy', target.service, '--source', stage, '--no-traffic', '--tag', tag, '--revision-suffix', suffix], target);
    const after = describe(target);
    assertSameTraffic(namedTraffic(after), previousTraffic);
    receipt.previewUrl = previewTarget(after, receipt);
    receipt.status = 'preview_ready';
    saveReceipt(file, receipt);
    console.log(`Preview ready: ${receipt.previewUrl}\nCandidate revision: ${candidateRevision}\nExpected commit: ${identity.commit}\nReceipt: ${file}`);
    console.log('Check the preview identity and complete browser/policy checks before promoting this receipt.');
  } finally { rmSync(stage, { recursive: true, force: true }); }
}

async function changeTraffic(action: 'promote' | 'rollback', file: string): Promise<void> {
  const receipt = validateReceipt(JSON.parse(readFileSync(file, 'utf8')));
  const before = describe(receipt);
  if (action === 'promote') {
    if (receipt.status !== 'preview_ready') throw new Error('Only a preview_ready receipt can be promoted.');
    assertSameTraffic(namedTraffic(before), receipt.previousTraffic);
    if (previewTarget(before, receipt) !== receipt.previewUrl) throw new Error('The preview URL changed; inspect the saved candidate revision.');
    await checkRelease(receipt.previewUrl!, receipt.commit);
    // HTTP verification can take time: do not overwrite traffic or a tag changed meanwhile.
    const verified = describe(receipt);
    assertSameTraffic(namedTraffic(verified), receipt.previousTraffic);
    if (previewTarget(verified, receipt) !== receipt.previewUrl) throw new Error('The preview URL changed during verification; inspect the saved candidate revision.');
  } else {
    if (!['promoting', 'promoted', 'rolling_back'].includes(receipt.status)) throw new Error('Only a promoted or interrupted promotion receipt can be rolled back.');
    if (['promoting', 'rolling_back'].includes(receipt.status) && sameTraffic(namedTraffic(before), receipt.previousTraffic)) {
      receipt.status = 'rolled_back';
      saveReceipt(file, receipt);
      console.log(`Verified previous named revisions are already serving at ${receipt.origin}`);
      return;
    }
    assertSameTraffic(namedTraffic(before), { [receipt.candidateRevision]: 100 });
  }
  const traffic = action === 'promote' ? { [receipt.candidateRevision]: 100 } : receipt.previousTraffic;
  const destination = Object.entries(traffic).map(([revision, percent]) => `${revision}=${percent}`).join(',');
  // Preserve enough state to roll back even if the command succeeds but its response is lost.
  receipt.status = action === 'promote' ? 'promoting' : 'rolling_back';
  saveReceipt(file, receipt);
  cloud(['run', 'services', 'update-traffic', receipt.service, '--to-revisions', destination], receipt);
  assertSameTraffic(namedTraffic(describe(receipt)), traffic);
  receipt.status = action === 'promote' ? 'promoted' : 'rolled_back';
  saveReceipt(file, receipt);
  if (action === 'promote') {
    // Save the successful traffic change before checking public routing so rollback remains usable.
    await checkRelease(receipt.origin, receipt.commit);
    receipt.publicVerifiedAt = new Date().toISOString();
    saveReceipt(file, receipt);
    console.log(`Promoted and verified ${receipt.candidateRevision} at ${receipt.origin}`);
  } else console.log(`Restored serving traffic: ${destination}. Check the restored public experience at ${receipt.origin}`);
}

export async function runReleaseCommand(args: string[], root = process.cwd()): Promise<void> {
  const command = parseReleaseCommand(args);
  if (command.action === 'help') console.log('Usage: npm run deploy\n       npm run deploy:promote -- RECEIPT.json\n       npm run deploy -- --rollback RECEIPT.json\nPreview requires a clean checkout. Promotion verifies the exact candidate. Rollback restores named previous revisions.');
  else if (command.action === 'preview') await preview(root);
  else await changeTraffic(command.action, resolve(root, command.receipt));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await runReleaseCommand(process.argv.slice(2)); }
  catch (error) { console.error(`Release operation failed: ${(error as Error).message}`); process.exitCode = 1; }
}

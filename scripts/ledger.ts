#!/usr/bin/env tsx
/**
 * Reference-target ledger CLI (validation/ledger.ts).
 *
 * Usage:
 *   npm run ledger              # recompute, print the markdown report, write docs/design/reference-ledger.md
 *   npm run ledger -- --check   # verify the recorded ledger; exit 1 on a rule failure (part of npm run check)
 *   npm run ledger -- --write   # recompute and RECORD values and statuses in data/ledger/reference-targets.json
 *   npm run ledger -- --json    # computed results as JSON
 *
 * --check fails when (a) a target disappears without a retirement reason (against git HEAD and the
 * merge-base with main, and against the targets the harnesses declare), (b) a computed status
 * differs from the recorded one or a computation breaks, or (c) a test file that pins a known miss
 * has no ledger entry. Value drift with an unchanged status, and a stale markdown report, are warnings.
 *
 * Hindcast entries need data/hindcast/*.json; without them they are skipped with a warning.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HindcastActuals, HindcastSeriesFile } from '../validation/hindcast';
import {
  checkLedger,
  computeLedger,
  discoverTargetKeys,
  deriveStatus,
  fmt,
  recordComputed,
  renderLedgerMarkdown,
  summarise,
  type ComputeContext,
  type Ledger,
} from '../validation/ledger';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER_PATH = 'data/ledger/reference-targets.json';
const DOC_PATH = 'docs/design/reference-ledger.md';

const args = new Set(process.argv.slice(2));
const CHECK = args.has('--check');
const WRITE = args.has('--write');
const JSON_OUT = args.has('--json');

const readLedger = (text: string) => JSON.parse(text) as Ledger;
const ledger = readLedger(readFileSync(join(ROOT, LEDGER_PATH), 'utf8'));

function hindcastContext(): ComputeContext['hindcast'] {
  const dir = join(ROOT, 'data', 'hindcast');
  const load = (f: string) => (existsSync(join(dir, f)) ? (JSON.parse(readFileSync(join(dir, f), 'utf8')) as HindcastSeriesFile) : undefined);
  const ladder = load('wellbeing-ladder.json');
  const gdp = load('gdp-per-capita.json');
  if (!ladder || !gdp) return undefined;
  const actuals: HindcastActuals = { wellbeingLadder: ladder.data, gdpPerCapita: gdp.data, unemployment: load('unemployment.json')?.data };
  return { actuals };
}

function walkTests(dir: string, out: Record<string, string>) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', 'dist', 'tmp', '.claude', 'coverage'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkTests(p, out);
    else if (/\.test\.tsx?$/.test(name)) out[relative(ROOT, p).split('\\').join('/')] = readFileSync(p, 'utf8');
  }
}

/** The ledger as committed at git HEAD and at the merge-base with main (either may be absent). */
function previousLedgers(): Ledger[] {
  const git = (...a: string[]) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const refs = new Set<string>();
  try { refs.add(git('rev-parse', 'HEAD')); } catch { /* not a git checkout */ }
  for (const main of ['main', 'origin/main']) {
    try { refs.add(git('merge-base', 'HEAD', main)); break; } catch { /* no such branch (e.g. shallow CI checkout) */ }
  }
  const out: Ledger[] = [];
  for (const ref of refs) {
    try { out.push(readLedger(git('show', `${ref}:${LEDGER_PATH}`))); } catch { /* the ledger did not exist at that commit */ }
  }
  return out;
}

const hindcast = hindcastContext();
const computed = computeLedger(ledger.entries, { hindcast });

if (JSON_OUT) {
  console.log(JSON.stringify(Object.fromEntries([...computed].map(([id, r]) => [id, r])), null, 2));
  process.exit(0);
}

if (WRITE) {
  const errors = [...computed].filter(([, r]) => r.error);
  if (errors.length) {
    console.error('Not writing: some computations failed.');
    for (const [id, r] of errors) console.error(`  ${id}: ${r.error}`);
    process.exit(1);
  }
  const { ledger: next, changes } = recordComputed(ledger, computed);
  writeFileSync(join(ROOT, LEDGER_PATH), JSON.stringify(next, null, 2) + '\n');
  writeFileSync(join(ROOT, DOC_PATH), renderLedgerMarkdown(next));
  for (const [id, r] of computed) if (r.skipped) console.warn(`skipped ${id}: ${r.skipped} (recorded value kept)`);
  if (changes.length) {
    console.log(`STATUS CHANGES RECORDED (${changes.length}) - review before committing:`);
    for (const c of changes) console.log(`  ${c}`);
  } else console.log('No status changes.');
  const s = summarise(next.entries);
  console.log(`Wrote ${LEDGER_PATH} and ${DOC_PATH}: ${s.live} live targets; ${Object.entries(s.totals).map(([k, v]) => `${k} ${v}`).join(', ')}.`);
  process.exit(0);
}

if (CHECK) {
  const testFiles: Record<string, string> = {};
  walkTests(ROOT, testFiles);
  const referencedFiles = new Set(ledger.entries.flatMap((e) => e.checkedBy.map((c) => c.split(':')[0])));
  const existingFiles = new Set([...referencedFiles].filter((f) => existsSync(join(ROOT, f))));
  const targetKeys = [...discoverTargetKeys(), ...(existsSync(join(ROOT, 'validation/hindcastTests.ts')) ? ['hindcast:HC-1', 'hindcast:HC-2'] : [])];
  const report = checkLedger({ current: ledger, previous: previousLedgers(), computed, testFiles, targetKeys, existingFiles });
  const docPath = join(ROOT, DOC_PATH);
  if (!existsSync(docPath) || readFileSync(docPath, 'utf8') !== renderLedgerMarkdown(ledger)) report.warnings.push(`${DOC_PATH} is not the rendering of the recorded ledger; run npm run ledger -- --write`);
  for (const w of report.warnings) console.warn(`warning: ${w}`);
  const s = summarise(ledger.entries);
  console.log(`Reference ledger: ${s.live} live targets (${Object.entries(s.totals).map(([k, v]) => `${k} ${v}`).join(', ')}); ${computed.size} computed.`);
  if (report.failures.length) {
    console.error(`\nLEDGER CHECK FAILED (${report.failures.length}):`);
    for (const f of report.failures) console.error(`  [rule ${f.rule}]${f.id ? ` ${f.id}:` : ''} ${f.message}`);
    process.exit(1);
  }
  console.log('Ledger check OK.');
  process.exit(0);
}

// Default: report from computed values; mark rows whose computed status differs from the record.
const { ledger: current } = recordComputed(ledger, computed);
const md = renderLedgerMarkdown(current);
writeFileSync(join(ROOT, DOC_PATH), md);
console.log(md);
const diffs = ledger.entries.filter((e) => !e.retired).flatMap((e) => {
  const d = deriveStatus(e, computed.get(e.id));
  return d && d !== e.status ? [`${e.id}: recorded ${e.status}, computed ${d} (model ${fmt(computed.get(e.id)?.value ?? null)})`] : [];
});
for (const [id, r] of computed) if (r.error) console.error(`computation failed: ${id}: ${r.error}`);
if (diffs.length) console.error(`\n${diffs.length} computed status(es) differ from the record (npm run ledger -- --write to record):\n  ${diffs.join('\n  ')}`);

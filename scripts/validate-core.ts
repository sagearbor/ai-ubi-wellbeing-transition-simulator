#!/usr/bin/env tsx
/**
 * Authoring core — validation CLI.
 *
 * Loads every model in data/core/ and every overlay in data/core/overlays/, and for each one:
 *   - validateCoreModel / validateOverlay (schema + engine diagnostics + evidence checks)
 *   - runs the model's own reproduction `tests` (an overlay's own tests run with the overlay
 *     applied to the base model that src/core/fixtures.ts pairs it with; the base's tests are not
 *     re-run, because an overlay is meant to change the base's numbers)
 * then prints a table and the evidence summary: how many parameters each model guesses.
 *
 * Two kinds of file, per data/core/README.md:
 *   registered in src/core/fixtures.ts   must validate and pass its own tests   [PASS]/[WARN]
 *   not registered (adversarial fixture) must fail, explicitly                  [XFAIL]
 * so market-no-root.json failing with solve-no-root is a pass, and an adversarial fixture that
 * quietly starts validating is a failure worth knowing about.
 *
 * Exits 1 if any registered model or overlay has an error or a failing test, or if an adversarial
 * fixture did not fail. Warnings are printed and do not fail the run — a wide band or a
 * disconnected variable is something the author has to answer for, not a reason to refuse the file.
 *
 * Usage:
 *   npx tsx scripts/validate-core.ts          # human-readable report
 *   npx tsx scripts/validate-core.ts --json   # machine-readable JSON
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runTests } from '../src/core/engine';
import { CORE_FIXTURES } from '../src/core/fixtures';
import type { EvidenceSummary, ValidationResult } from '../src/core/validate';
import { validateCoreModel, validateOverlay } from '../src/core/validate';
import type { CoreModel, EvidenceKind, Overlay, TestOutcome } from '../src/core/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODEL_DIR = resolve(HERE, '../data/core');
const OVERLAY_DIR = join(MODEL_DIR, 'overlays');

const jsonOut = process.argv.includes('--json');

function loadJsonFiles(dir: string): Array<{ file: string; json: unknown }> {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((file) => ({ file, json: JSON.parse(readFileSync(join(dir, file), 'utf8')) as unknown }));
}

interface Report {
  file: string;
  id: string;
  kind: 'model' | 'overlay';
  /**
   * Registered in src/core/fixtures.ts. An unregistered model file is an adversarial fixture
   * (data/core/README.md): it is expected to fail, and this run fails if it does not.
   */
  registered: boolean;
  expected: 'pass' | 'fail';
  /** For an overlay: the base model its tests were run against. */
  base?: string;
  validation: { ok: boolean; errors: string[]; warnings: string[] };
  tests: TestOutcome[];
  testsPassed: number;
  testsTotal: number;
  evidence: EvidenceSummary;
  /** True when nothing here should block a merge. */
  ok: boolean;
  notes: string[];
}

function strip(v: ValidationResult): Report['validation'] {
  return { ok: v.ok, errors: v.errors, warnings: v.warnings };
}

const reports: Report[] = [];

// --- models ---------------------------------------------------------------

const modelFiles = loadJsonFiles(MODEL_DIR);
const modelsById = new Map<string, CoreModel>();

const registeredModelIds = new Set(CORE_FIXTURES.map((f) => f.model.id));

for (const { file, json } of modelFiles) {
  const v = validateCoreModel(json);
  const id = (json as { id?: string }).id ?? file;
  const registered = registeredModelIds.has(id);
  const expected: 'pass' | 'fail' = registered ? 'pass' : 'fail';
  let tests: TestOutcome[] = [];
  if (v.ok && v.model) {
    modelsById.set(v.model.id, v.model);
    tests = runTests(v.model);
  }
  const testsPassed = tests.filter((t) => t.passed).length;
  const notes: string[] = [];
  let ok: boolean;
  if (registered) {
    ok = v.ok && testsPassed === tests.length;
    if (v.ok && tests.length === 0) notes.push('no reproduction tests: this model makes no checkable claim');
  } else {
    // data/core/README.md: an unregistered model is adversarial and must fail explicitly.
    ok = !v.ok;
    notes.push(
      ok
        ? `not registered in src/core/fixtures.ts, so it is treated as an adversarial fixture; it failed as expected (${v.diagnostics.filter((d) => d.level === 'error').map((d) => d.code).join(', ')})`
        : 'not registered in src/core/fixtures.ts but it validates cleanly: either register it as a bundled model or document why it is expected to fail',
    );
  }
  reports.push({
    file: `data/core/${file}`,
    id,
    kind: 'model',
    registered,
    expected,
    validation: strip(v),
    tests,
    testsPassed,
    testsTotal: tests.length,
    evidence: v.evidence,
    ok,
    notes,
  });
}

// --- overlays -------------------------------------------------------------

/** overlay id -> base model id, from the pairing src/core/fixtures.ts already declares. */
const baseOf = new Map<string, string>();
for (const f of CORE_FIXTURES) for (const o of f.overlays) baseOf.set(o.id, f.model.id);

for (const { file, json } of loadJsonFiles(OVERLAY_DIR)) {
  const id = (json as { id?: string }).id ?? file;
  const notes: string[] = [];
  const baseId = baseOf.get(id);
  const base = baseId ? modelsById.get(baseId) : undefined;
  if (!base) {
    notes.push(
      baseId
        ? `its base model "${baseId}" did not validate, so the overlay could not be checked`
        : 'no base model pairs with this overlay in src/core/fixtures.ts, so it could not be checked',
    );
    reports.push({
      file: `data/core/overlays/${file}`,
      id,
      kind: 'overlay',
      registered: false,
      expected: 'pass',
      base: baseId,
      validation: { ok: false, errors: notes.slice(), warnings: [] },
      tests: [],
      testsPassed: 0,
      testsTotal: 0,
      evidence: { total: 0, byKind: {} as Record<EvidenceKind, number>, assumptions: [], assumptionCount: 0, ranged: 0, unrangedAssumptions: [] },
      ok: false,
      notes,
    });
    continue;
  }
  const v = validateOverlay(base, json);
  // Only the overlay's own tests: an overlay legitimately changes the base's numbers, so the base's
  // tests are not expected to survive it (minimal.json's "income compounds" does not, under tutoring).
  let tests: TestOutcome[] = [];
  if (v.ok) tests = runTests({ ...base, tests: [] }, { overlays: [json as Overlay] });
  const testsPassed = tests.filter((t) => t.passed).length;
  reports.push({
    file: `data/core/overlays/${file}`,
    id,
    kind: 'overlay',
    registered: true,
    expected: 'pass',
    base: baseId,
    validation: strip(v),
    tests,
    testsPassed,
    testsTotal: tests.length,
    evidence: v.evidence,
    ok: v.ok && testsPassed === tests.length,
    notes,
  });
}

const failed = reports.length === 0 || reports.some((r) => !r.ok);

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

if (jsonOut) {
  console.log(JSON.stringify({ reports, failed }, null, 2));
} else {
  console.log('Authoring core validation\n');

  const w = {
    status: 8,
    file: Math.max(34, ...reports.map((r) => r.file.length + 2)),
    kind: 9,
    tests: 9,
    warn: 10,
  };
  console.log(`${pad('', w.status)}${pad('FILE', w.file)}${pad('KIND', w.kind)}${pad('TESTS', w.tests)}${pad('WARNINGS', w.warn)}ASSUMPTIONS`);
  for (const r of reports) {
    const status = !r.ok ? '[FAIL]' : r.expected === 'fail' ? '[XFAIL]' : r.validation.warnings.length ? '[WARN]' : '[PASS]';
    const tests = r.testsTotal === 0 ? '-' : `${r.testsPassed}/${r.testsTotal}`;
    console.log(
      `${pad(status, w.status)}${pad(r.file, w.file)}${pad(r.kind, w.kind)}${pad(tests, w.tests)}` +
        `${pad(String(r.validation.warnings.length), w.warn)}${r.evidence.assumptionCount} of ${r.evidence.total}`,
    );
  }

  for (const r of reports) {
    const label = r.expected === 'fail' ? 'EXPECTED' : 'ERROR   ';
    const lines = [
      ...r.validation.errors.map((e) => `       ${label} ${e}`),
      ...r.validation.warnings.map((x) => `       WARNING ${x}`),
      ...r.tests.filter((t) => !t.passed).map((t) => `       TEST    ${t.name}: ${t.message}`),
      ...r.notes.map((n) => `       NOTE    ${n}`),
    ];
    if (lines.length === 0) continue;
    console.log(`\n${r.file}`);
    for (const l of lines) console.log(l);
  }

  console.log('\nEvidence summary (what the numbers in each file are)');
  for (const r of reports) {
    const kinds = Object.entries(r.evidence.byKind)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${k} ${n}`)
      .join(', ');
    console.log(`  ${pad(r.id, 24)} ${r.evidence.assumptionCount} of ${r.evidence.total} parameters guessed or assumed${kinds ? ` (${kinds})` : ''}`);
    if (r.evidence.assumptions.length) {
      console.log(`  ${' '.repeat(24)} ${r.evidence.assumptions.map((a) => `${a.id} [${a.kind}]`).join(', ')}`);
    }
    if (r.evidence.unrangedAssumptions.length) {
      console.log(`  ${' '.repeat(24)} no range declared on: ${r.evidence.unrangedAssumptions.join(', ')} (a guess shown as an exact number)`);
    }
  }

  console.log(`\n${failed ? 'FAILED' : 'OK'}`);
}

process.exit(failed ? 1 : 0);

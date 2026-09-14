#!/usr/bin/env tsx
/**
 * Policy-effect cases report (v3 evaluation category 4).
 *
 * Runs every data/cases/*.json through validation/policyCases.ts and prints the signed
 * discrepancies, structural checks and outside-model outcomes. No grade.
 *
 * Usage:
 *   npm run validate:cases            # markdown
 *   npm run validate:cases -- --json
 *
 * Exit 1 only when an outcome is unaccounted for or a mapping cannot run.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPolicyCase, renderCaseMarkdown, type PolicyCase } from '../validation/policyCases';

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../data/cases');
const cases = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()
  .map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as PolicyCase);
const reports = cases.map((c) => ({ record: c, report: runPolicyCase(c) }));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(reports.map((r) => r.report), null, 2));
} else {
  for (const { record, report } of reports) console.log(renderCaseMarkdown(record, report), '\n');
}
const bad = reports.filter((r) => r.report.unaccounted.length || r.report.errors.length);
process.exit(bad.length ? 1 : 0);

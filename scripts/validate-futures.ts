#!/usr/bin/env tsx
/**
 * AI Futures Map — validation CLI.
 *
 * Runs validateGraph on data/futures/graph.json, validateIntervention on every file in
 * data/futures/interventions/, checkGolden against src/futures/golden.json, and prints
 * sensitivityReport. Exits non-zero on any validation failure (golden mismatch and
 * sensitivity-report findings do not fail the run; see data/futures/README.md).
 *
 * Usage:
 *   npx tsx scripts/validate-futures.ts                 # human-readable report
 *   npx tsx scripts/validate-futures.ts --json           # machine-readable JSON
 *   npx tsx scripts/validate-futures.ts --update-golden   # rewrite src/futures/golden.json
 */

import { writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'node:url';

import graph from '../data/futures/graph.json';
import aiDividendFund from '../data/futures/interventions/ai-dividend-fund.json';
import computeTreaty from '../data/futures/interventions/compute-treaty.json';
import resilienceEnclaves from '../data/futures/interventions/resilience-enclaves.json';
import frontierEvalsMandate from '../data/futures/interventions/frontier-evals-mandate.json';
import golden from '../src/futures/golden.json';
import { FuturesGraph } from '../src/futures/types';
import { checkGolden, computeGolden, sensitivityReport, validateGraph, validateIntervention } from '../src/futures/validateGraph';

const HERE = dirname(fileURLToPath(import.meta.url));

const jsonOut = process.argv.includes('--json');
const updateGolden = process.argv.includes('--update-golden');

const g = graph as unknown as FuturesGraph;

const interventions = [
  { file: 'ai-dividend-fund.json', data: aiDividendFund },
  { file: 'compute-treaty.json', data: computeTreaty },
  { file: 'resilience-enclaves.json', data: resilienceEnclaves },
  { file: 'frontier-evals-mandate.json', data: frontierEvalsMandate },
];

const graphResult = validateGraph(graph);
const interventionResults = interventions.map((iv) => ({
  file: iv.file,
  result: validateIntervention(iv.data, g),
}));

let goldenResult: { ok: boolean; errors: string[] } = { ok: true, errors: [] };
if (updateGolden) {
  const fresh = computeGolden(g);
  writeFileSync(resolve(HERE, '../src/futures/golden.json'), JSON.stringify(fresh, null, 2) + '\n');
} else {
  goldenResult = checkGolden(g, golden);
}

const sensitivity = sensitivityReport(g);

const failed =
  !graphResult.ok || interventionResults.some((r) => !r.result.ok) || (!updateGolden && !goldenResult.ok);

if (jsonOut) {
  console.log(
    JSON.stringify(
      {
        graph: graphResult,
        interventions: interventionResults,
        golden: updateGolden ? { updated: true } : goldenResult,
        sensitivity,
        failed,
      },
      null,
      2,
    ),
  );
} else {
  console.log('AI Futures Map validation\n');

  console.log(`[${graphResult.ok ? 'PASS' : 'FAIL'}] data/futures/graph.json`);
  for (const e of graphResult.errors) console.log(`       ERROR   ${e}`);
  for (const w of graphResult.warnings) console.log(`       WARNING ${w}`);

  for (const { file, result } of interventionResults) {
    console.log(`[${result.ok ? 'PASS' : 'FAIL'}] data/futures/interventions/${file}`);
    for (const e of result.errors) console.log(`       ERROR   ${e}`);
    for (const w of result.warnings) console.log(`       WARNING ${w}`);
  }

  if (updateGolden) {
    console.log('[DONE] src/futures/golden.json rewritten from the current graph');
  } else {
    console.log(`[${goldenResult.ok ? 'PASS' : 'FAIL'}] src/futures/golden.json`);
    for (const e of goldenResult.errors) console.log(`       ERROR   ${e}`);
  }

  console.log(`\nSensitivity report (edges whose removal shifts an endYear state marginal by > 0.05 under a +1 probe on the parent):`);
  if (sensitivity.length === 0) {
    console.log('  (none above threshold)');
  } else {
    for (const f of sensitivity) {
      console.log(
        `  ${f.from} -> ${f.to} (${f.kind}, strength ${f.strength}): ${f.mostShiftedState} shifts by ${f.maxAbsShift.toFixed(4)}`,
      );
    }
  }

  console.log(`\n${failed ? 'FAILED' : 'OK'}`);
}

process.exit(failed ? 1 : 0);

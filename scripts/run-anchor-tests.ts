#!/usr/bin/env tsx
/**
 * Anchor Test CLI
 *
 * Runs the six anchor tests (causal invariants) against the pure simulation
 * engine and exits non-zero if the engine is not eligible (fewer than 4/6 pass).
 *
 * Usage:
 *   npm run validate            # human-readable report
 *   npm run validate -- --json  # machine-readable JSON
 */

import { runAllAnchorTests } from '../validation/anchorTests';

const json = process.argv.includes('--json');
const suite = runAllAnchorTests();

if (json) {
  console.log(JSON.stringify(suite, null, 2));
} else {
  console.log('Anchor tests against simulation/pure.ts\n');
  for (const r of suite.results) {
    const mark = r.passed ? 'PASS' : 'FAIL';
    console.log(`[${mark}] ${r.testId} ${r.testName} (${r.category})`);
    console.log(`       ${r.reason}`);
    if (r.details) {
      console.log(`       expected: ${r.details.expected}`);
      console.log(`       actual:   ${r.details.actual}`);
    }
  }
  console.log(`\n${suite.passed}/${suite.total} passed; tier-2 eligible (>=4): ${suite.tier2Passed}`);
}

process.exit(suite.tier2Passed ? 0 : 1);

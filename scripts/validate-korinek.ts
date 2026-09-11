#!/usr/bin/env tsx
/**
 * Korinek et al. (2026) reproduction CLI.
 *
 * Usage:
 *   npm run validate:korinek            # human-readable report
 *   npm run validate:korinek -- --json  # machine-readable JSON
 * Exits non-zero unless all three scenarios reproduce within tolerance.
 */

import { runKorinekSuite } from '../validation/korinekTests';

const json = process.argv.includes('--json');
const suite = runKorinekSuite();

if (json) {
  console.log(JSON.stringify(suite, null, 2));
} else {
  console.log('Korinek, Jones, Sacher, Cotter & McCrory (2026) "Economic Scenarios for Transformative AI" — US 2030 reproduction\n');
  for (const r of suite.results) {
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.testId} ${r.testName}`);
    console.log(`       ${r.reason}`);
  }
  console.log('\n scenario     adoption  GDP boost  growth/yr  labour share  unemp  cognitive unemp');
  for (const o of suite.outcomes) {
    console.log(
      ` ${o.scenarioId.padEnd(12)} ${o.adoptionEnd.toFixed(3).padStart(8)}  ${(o.gdpBoostPct.toFixed(1) + '%').padStart(9)}  ${(o.growthPctPerYear.toFixed(1) + '%').padStart(9)}  ${(o.laborSharePct.toFixed(1) + '%').padStart(12)}  ${(o.unemploymentPct.toFixed(1) + '%').padStart(5)}  ${(o.cognitiveUnemploymentPct.toFixed(1) + '%').padStart(15)}`,
    );
  }
  console.log(`\n${suite.passed}/${suite.total} reproduced within tolerance`);
}

process.exit(suite.passed === suite.total ? 0 : 1);

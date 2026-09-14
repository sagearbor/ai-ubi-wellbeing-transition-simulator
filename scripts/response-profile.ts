#!/usr/bin/env tsx
/**
 * Response profile of the default world model (v3 stage 3, "response review").
 *
 * Usage:
 *   npm run profile:default             # markdown tables for the model card
 *   npm run profile:default -- --json   # machine-readable
 *   npm run profile:default -- --model=evidence-anchored
 *
 * Reporting only: exit code is always 0. A surprising number belongs in
 * docs/design/model-card-default.md, not in a threshold.
 */

import { runResponseProfile, renderMarkdown, defaultScenario } from '../validation/responseProfile';
import { PRESET_MODELS } from '../constants';

const json = process.argv.includes('--json');
const modelArg = process.argv.find((a) => a.startsWith('--model='))?.slice('--model='.length);
const model = modelArg ? PRESET_MODELS.find((m) => m.id === modelArg) : undefined;
if (modelArg && !model) {
  console.error(`unknown model "${modelArg}"; known: ${PRESET_MODELS.map((m) => m.id).join(', ')}`);
  process.exit(2);
}
const t0 = Date.now();
const profile = runResponseProfile(model ? { scenario: { ...defaultScenario(), model: { ...model } } } : {});
if (json) {
  console.log(JSON.stringify(profile, null, 2));
} else {
  console.log(renderMarkdown(profile));
  console.log(`\n_${profile.levers.length} levers x 13 runs + ${profile.switches.reduce((a, s) => a + s.alternatives.length, 0)} switches, ${((Date.now() - t0) / 1000).toFixed(1)} s._`);
}

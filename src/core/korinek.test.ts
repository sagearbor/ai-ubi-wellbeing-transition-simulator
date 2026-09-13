/**
 * data/core/korinek-2026.json — the published-model port.
 *
 * fixtures.test.ts already checks that every registered fixture runs and passes its own tests, so
 * this file checks the two things that are specific to this model and that its in-file `tests`
 * cannot say on their own:
 *
 *   1. All THREE scenarios reproduce the published US 2030 outputs at the tolerances
 *      validation/korinekTests.ts declares (KJ_TOLERANCE). A ModelTest asserts one scalar at one
 *      step, so "all three scenarios" is spread over the base file plus two overlays; this test
 *      re-states the claim in one place, using the tolerance constant rather than a literal.
 *   2. The core model is the same model as this repo's TypeScript macro block
 *      (simulation/pure.ts::applyMacroDynamics, driven by validation/korinek.ts). It is not
 *      byte-identical by design — see MAX_DIVERGENCE_PP below — so the check is that the two agree
 *      to well inside the tolerance band, not that they agree exactly.
 */
import { describe, expect, it } from 'vitest';

import { KORINEK_SCENARIOS } from '../../constants';
import korinekModel from '../../data/core/korinek-2026.json';
import korinekExtreme from '../../data/core/overlays/korinek-extreme.json';
import korinekModest from '../../data/core/overlays/korinek-modest.json';
import { runKorinekScenario } from '../../validation/korinek';
import { KJ_TOLERANCE } from '../../validation/korinekTests';
import { runModel, runTests } from './engine';
import { CORE_FIXTURES } from './fixtures';
import type { CoreModel, Overlay } from './types';

const model = korinekModel as unknown as CoreModel;
const modest = korinekModest as unknown as Overlay;
const extreme = korinekExtreme as unknown as Overlay;

/** Calendar step the published 2030 numbers are read at: mid-2026 + 54 months. */
const END = 2031;

/**
 * How far the core model may sit from the TypeScript engine it was ported from, in percentage
 * points, on any of the four published quantities. Two deliberate differences account for it:
 * cognitiveShare is the paper's published 0.624 here vs the engine's rounded rich-democracy
 * archetype bucket 0.62, and the core model reads the adoption path at the step it applies it
 * where the TS harness applies the previous month's value. The largest gap is the extreme
 * scenario's cognitive unemployment (17.24 core vs 17.77 TS), about a fifth of that quantity's
 * 2.5pp reproduction tolerance.
 */
const MAX_DIVERGENCE_PP = 0.6;

const SCENARIOS = [
  { id: 'modest', overlays: [modest] as Overlay[] },
  { id: 'substantial', overlays: [] as Overlay[] },
  { id: 'extreme', overlays: [extreme] as Overlay[] },
] as const;

function coreOutcome(overlays: Overlay[]) {
  const r = runModel(model, { overlays });
  expect(r.ok, r.diagnostics.map((d) => `${d.code}: ${d.message}`).join('; ')).toBe(true);
  const t = r.years.findIndex((y) => Math.abs(y - END) < 1e-9);
  expect(t, `year ${END} is a step of the model`).toBeGreaterThan(0);
  const at = (id: string) => r.series['_'][id][t];
  return {
    gdpBoostPct: at('gdp_boost_pct'),
    laborSharePct: at('labor_share_pct'),
    unemploymentPct: at('unemployment_pct'),
    cognitiveUnemploymentPct: at('cognitive_unemployment_pct'),
    adoption: at('ai_adoption'),
  };
}

describe('korinek-2026.json: a published model in the authoring format', () => {
  it('is registered as a Lab fixture with both scenario overlays', () => {
    const entry = CORE_FIXTURES.find((f) => f.model.id === 'korinek-2026');
    expect(entry, 'korinek-2026 is registered in fixtures.ts').toBeDefined();
    expect(entry!.overlays.map((o) => o.id).sort()).toEqual(['korinek-extreme', 'korinek-modest']);
  });

  for (const { id, overlays } of SCENARIOS) {
    describe(`${id} scenario`, () => {
      const published = KORINEK_SCENARIOS.find((s) => s.id === id)!;

      it('reproduces the published US 2030 outputs within korinekTests.ts tolerances', () => {
        const core = coreOutcome(overlays);
        expect(Math.abs(core.gdpBoostPct - published.targets.gdpBoostPct)).toBeLessThanOrEqual(KJ_TOLERANCE.gdpBoostPct);
        expect(Math.abs(core.laborSharePct - published.targets.laborSharePct)).toBeLessThanOrEqual(KJ_TOLERANCE.laborSharePct);
        expect(Math.abs(core.cognitiveUnemploymentPct - published.targets.cognitiveUnemploymentPct)).toBeLessThanOrEqual(
          KJ_TOLERANCE.cognitiveUnemploymentPct,
        );
      });

      it('drives adoption exogenously to the scenario end point', () => {
        expect(coreOutcome(overlays).adoption).toBeCloseTo(published.adoption2030, 9);
      });

      it('agrees with the TypeScript macro block it was ported from', () => {
        const core = coreOutcome(overlays);
        const ts = runKorinekScenario(published);
        for (const k of ['gdpBoostPct', 'laborSharePct', 'unemploymentPct', 'cognitiveUnemploymentPct'] as const) {
          expect(Math.abs(core[k] - ts[k]), `${id}.${k}: core ${core[k]} vs TS engine ${ts[k]}`).toBeLessThanOrEqual(MAX_DIVERGENCE_PP);
        }
      });
    });
  }

  it('states in its scope that it is US-only, reduced-form and adoption-exogenous', () => {
    const text = `${model.description ?? ''} ${model.scope ?? ''}`.toLowerCase();
    expect(text).toContain('us only');
    expect(text).toContain('reduced-form');
    expect(text).toContain('adoption is an input');
  });

  it('applies each overlay without a structural-change diagnostic (scenarios differ only in inputs and two coefficients)', () => {
    for (const o of [modest, extreme]) {
      const r = runModel(model, { overlays: [o] });
      expect(r.diagnostics.filter((d) => d.level === 'error')).toEqual([]);
      expect(o.variables ?? [], `${o.id} adds no variables`).toEqual([]);
    }
  });

  it("passes every in-file test, base and overlays", () => {
    const base = runTests(model);
    expect(base.filter((o) => !o.passed), JSON.stringify(base.filter((o) => !o.passed), null, 2)).toEqual([]);
    for (const o of [modest, extreme]) {
      const own = runTests({ ...model, tests: [] }, { overlays: [o] });
      expect(own.length).toBeGreaterThan(0);
      expect(own.filter((x) => !x.passed), JSON.stringify(own.filter((x) => !x.passed), null, 2)).toEqual([]);
    }
  });
});

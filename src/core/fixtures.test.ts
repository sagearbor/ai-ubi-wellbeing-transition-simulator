import { describe, it, expect } from 'vitest';
import { runModel, runTests } from './engine';
import { CORE_FIXTURES } from './fixtures';
import type { CoreModel, Overlay } from './types';
import marketNoRoot from '../../data/core/market-no-root.json';

/**
 * Every fixture registered in fixtures.ts must run cleanly on its own, and every overlay it is
 * paired with must run cleanly on top of it. Numeric expectations for a specific model+overlay
 * combination live in that model's own `tests` (data/core/*.json); an overlay's effects can
 * legitimately change what the base model's own tests were written for (see the minimal +
 * tutoring pair, where the income figure the base test was tuned to shifts once tutoring's
 * effect applies) — so here we check the overlay's *own* declared tests pass when it is applied,
 * not that the base model's unmodified-numbers tests still hold under the overlay.
 */
describe('registered core fixtures', () => {
  for (const entry of CORE_FIXTURES) {
    describe(`${entry.model.id} — ${entry.label}`, () => {
      it('runs with no error diagnostics', () => {
        const r = runModel(entry.model);
        expect(r.ok, r.diagnostics.map((d) => `${d.code}: ${d.message}`).join('; ')).toBe(true);
        expect(r.diagnostics.filter((d) => d.level === 'error')).toEqual([]);
      });

      it('passes its own reproduction tests', () => {
        const outcomes = runTests(entry.model);
        expect(outcomes.length).toBeGreaterThan(0);
        const failed = outcomes.filter((o) => !o.passed);
        expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
      });

      for (const overlay of entry.overlays) {
        describe(`overlay: ${overlay.id}`, () => {
          it('applies to the base model with no error diagnostics', () => {
            const r = runModel(entry.model, { overlays: [overlay] });
            expect(r.ok, r.diagnostics.map((d) => `${d.code}: ${d.message}`).join('; ')).toBe(true);
            expect(r.diagnostics.filter((d) => d.level === 'error')).toEqual([]);
          });

          it("passes the overlay's own declared tests once applied (if it declares any)", () => {
            const ownCount = overlay.tests?.length ?? 0;
            if (ownCount === 0) return; // older fixtures may predate per-overlay tests; ok-with-no-errors is checked above
            const combined = runTests(entry.model, { overlays: [overlay] });
            // resolveModel appends overlay tests after the base model's tests, in overlay order.
            const own = combined.slice(combined.length - ownCount);
            const failed = own.filter((o) => !o.passed);
            expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
          });
        });
      }
    });
  }
});

describe('adversarial fixture: market-no-root.json', () => {
  it('is not registered in fixtures.ts', () => {
    expect(CORE_FIXTURES.some((f) => f.model.id === (marketNoRoot as unknown as CoreModel).id)).toBe(false);
  });

  it('fails explicitly with solve-no-root instead of returning a wrong price', () => {
    const r = runModel(marketNoRoot as unknown as CoreModel);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => d.code === 'solve-no-root')).toBe(true);
  });
});

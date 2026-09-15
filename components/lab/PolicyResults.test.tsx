import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import PolicyResults from './PolicyResults';
import { findFixture } from '../../src/core/fixtures';
import type { PairedRunResult, Quantiles } from '../../src/policy/types';

const quantiles = (values: number[]): Quantiles => ({
  p5: values, p25: values, p50: values, p75: values, p95: values, mean: values,
});
const result = (differences: number[]): PairedRunResult => ({
  ok: true, errors: [], years: [2026, 2029], entities: ['displayed-country'], outputs: ['training_budget'],
  baseline: { 'displayed-country': { training_budget: quantiles([10, 10]) } },
  policy: { 'displayed-country': { training_budget: quantiles(differences.map(d => 10 + d)) } },
  difference: { 'displayed-country': { training_budget: quantiles(differences) } },
  binding: { baseline: {}, policy: {} }, runs: 1, seed: 1, deterministic: true,
} as unknown as PairedRunResult);

describe('selected draft zero-change notice', () => {
  it('scopes A’s zero result while B visibly differs in the selected year', () => {
    const html = renderToStaticMarkup(<PolicyResults
      model={findFixture('training-budget')!.model}
      entries={[
        { label: 'A', stale: false, result: result([1, 0]) },
        { label: 'B', stale: false, result: result([1, 7]) },
      ]}
      active={0} year={2029} onYear={vi.fn()}
    />);
    expect(html).toContain('For selected draft A and displayed entity displayed-country, the shown differences are zero in 2029');
    expect(html).toContain('+7 [+7, +7]');
    expect(html).toContain('Show first changed year: 2026');
    expect(html).not.toContain('For the displayed entity, the shown differences are zero');
  });
});

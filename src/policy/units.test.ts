import { describe, expect, it } from 'vitest';
import { describeConversion, isDimensionless, parseUnit, unitFactor } from './units';

const factor = (from: string, to: string, ctx = {}) => {
  const c = unitFactor(from, to, 'target', ctx);
  return c.ok ? c.factor : c.message;
};

describe('parseUnit', () => {
  it('reads currency with scale words, letters and symbols', () => {
    expect(parseUnit('usd')).toMatchObject({ dimension: 'currency', scale: 1 });
    expect(parseUnit('$')).toMatchObject({ dimension: 'currency', scale: 1 });
    expect(parseUnit('million usd')).toMatchObject({ dimension: 'currency', scale: 1e6 });
    expect(parseUnit('USD million')).toMatchObject({ dimension: 'currency', scale: 1e6 });
    expect(parseUnit('$M')).toMatchObject({ dimension: 'currency', scale: 1e6 });
    expect(parseUnit('k usd')).toMatchObject({ dimension: 'currency', scale: 1e3 });
    expect(parseUnit('bn dollars')).toMatchObject({ dimension: 'currency', scale: 1e9 });
    expect(parseUnit('US dollars')).toMatchObject({ dimension: 'currency', scale: 1 });
  });

  it('reads time bases, per-person denominators, shares and counts', () => {
    expect(parseUnit('usd per year')).toMatchObject({ dimension: 'currency', time: 'year' });
    expect(parseUnit('usd/yr')).toMatchObject({ time: 'year' });
    expect(parseUnit('annual usd')).toMatchObject({ time: 'year' });
    expect(parseUnit('usd a month')).toMatchObject({ time: 'month' });
    expect(parseUnit('one-off usd')).toMatchObject({ time: 'one-off' });
    expect(parseUnit('usd_per_person_per_year')).toMatchObject({ dimension: 'currency', perPerson: true, time: 'year' });
    expect(parseUnit('usd_per_capita')).toMatchObject({ perPerson: true });
    expect(parseUnit('percent')).toMatchObject({ dimension: 'share', scale: 0.01 });
    expect(parseUnit('%')).toMatchObject({ dimension: 'share', scale: 0.01 });
    expect(parseUnit('share_of_L')).toMatchObject({ dimension: 'share', kind: 'l' });
    expect(parseUnit('share_per_month')).toMatchObject({ dimension: 'share', time: 'month' });
    expect(parseUnit('thousand workers')).toMatchObject({ dimension: 'count', kind: 'worker', scale: 1e3 });
    expect(parseUnit('jobs')).toMatchObject({ dimension: 'count', kind: 'jobs' });
    expect(parseUnit('per_year')).toMatchObject({ dimension: 'dimensionless', time: 'year' });
    expect(parseUnit('log_gap')).toMatchObject({ dimension: 'opaque' });
    expect(parseUnit('')).toMatchObject({ dimension: 'dimensionless' });
  });
});

describe('unitFactor', () => {
  it('converts currency scales and per-time rates', () => {
    expect(factor('million usd', 'usd')).toBe(1e6);
    expect(factor('usd', 'thousand usd')).toBe(1e-3);
    expect(factor('usd per month', 'usd per year')).toBe(12);
    expect(factor('usd per year', 'usd_per_month')).toBeCloseTo(1 / 12, 15);
    expect(factor('usd per person per year', 'usd_per_person_per_year')).toBe(1);
  });

  it('converts percent to share, and keeps qualifiers apart', () => {
    expect(factor('percent', 'share')).toBe(0.01);
    expect(factor('share', 'pct')).toBe(100);
    expect(factor('percent', 'share_of_L')).toBe(0.01);
    expect(factor('share of workforce', 'share_of_L')).toContain('incompatible');
  });

  it('refuses what does not convert, with a readable reason', () => {
    expect(factor('people', 'usd')).toBe('people → target (usd): incompatible units (count is not currency)');
    expect(factor('jobs', 'people')).toContain('incompatible');
    expect(factor('usd', 'usd_per_capita')).toContain('a total is not a per-person amount');
    expect(factor('usd_per_capita', 'usd')).toContain('a per-person amount is not a total');
    expect(factor('one-off usd', 'usd per year')).toContain('one-off');
    expect(factor('eur', 'usd')).toContain('cannot convert');
    expect(factor('log_gap', 'log_gap')).toBe(1);
    expect(factor('log gap', 'log_points')).toContain('cannot convert');
    expect(factor('years', 'months')).toBe(12);
  });

  it('a per-time value into a target with no time basis: only at the model step, for per-step targets, with a warning', () => {
    const atStep = unitFactor('usd per year', 'usd', 'training_budget', { step: 'year', perStepTarget: true });
    expect(atStep).toMatchObject({ ok: true, factor: 1 });
    expect(atStep.ok && atStep.warning).toContain('taken as per model step (per year)');
    expect(unitFactor('usd per month', 'usd', 'training_budget', { step: 'year', perStepTarget: true }).ok).toBe(false);
    expect(unitFactor('usd per year', 'usd', 'cost_per_completion', { step: 'year', perStepTarget: false }).ok).toBe(false);
  });

  it('describes conversions in words', () => {
    expect(describeConversion(20, 'million usd', 'usd', 'training_budget', 1e6)).toBe('20 million usd → training_budget (usd): converted to 20,000,000');
    expect(isDimensionless('ratio')).toBe(true);
    expect(isDimensionless('usd')).toBe(false);
    expect(isDimensionless('per_year')).toBe(false);
  });
});

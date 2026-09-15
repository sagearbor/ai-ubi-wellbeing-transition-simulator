import { describe, expect, it } from 'vitest';
import { financialRecord, financialRecords } from './catalog';
import { recipientCohort, recipientCohorts } from './cohorts';
import { createFinancialModel, defaultFinancialScenario } from './model';
import type { FinancialScenario } from './types';
import { executeSync } from '../workers/execute';
import type { LabPointResult } from '../workers/protocol';
import { runModel } from '../core/engine';
import { validateCoreModel } from '../core/validate';

function run(overrides: Partial<FinancialScenario> = {}) {
  const model = createFinancialModel(financialRecord('apple-fy2025'), { ...defaultFinancialScenario, ...overrides });
  const outcome = executeSync<LabPointResult>({ kind: 'lab-point', model, overlays: [], hypotheticalOverlays: null });
  expect(outcome.status).toBe('done');
  if (outcome.status !== 'done') throw Error(outcome.message);
  expect(outcome.result.plain.ok, JSON.stringify(outcome.result.plain.diagnostics)).toBe(true);
  return outcome.result.plain;
}

describe('reported financial allocation through the existing worker runner', () => {
  it('converts Apple millions once and divides the annual payment by12 and exact residents', () => {
    const r = run({ policyShare: .1, trainingShare: 0 });
    expect(r.years).toEqual([2025]);
    expect(r.series._.source_cash_flow[0]).toBe(98767e6);
    expect(r.series._.allocatable_base[0]).toBe(98767e6);
    expect(r.series._.dividend_spend[0]).toBe(9876.7e6);
    expect(recipientCohort('USA').population).toBe(340003797);
    expect(r.series._.monthly_dividend_per_person[0]).toBeCloseTo(9876.7e6 / 12 / 340003797, 10);
  });
  it('zero policy yields zero outputs except the source and ceiling', () => {
    const r = run({ policyShare: 0, trainingShare: .7 });
    for (const id of ['policy_budget', 'dividend_spend', 'training_budget', 'completions', 'placements', 'monthly_dividend_per_person']) expect(r.series._[id][0]).toBe(0);
  });
  it('capacity binds and unused training money is visible, never sent to dividends', () => {
    const r = run({ trainingShare: 1, instructorCapacity: 2 });
    expect(r.series._.completions[0]).toBe(2);
    expect(r.series._.actual_training_spend[0]).toBe(10000);
    expect(r.series._.unspent_training[0]).toBe(9876.7e6 - 10000);
    expect(r.series._.dividend_spend[0]).toBe(0);
  });
  it('zero openings means zero gross placements', () => expect(run({ trainingShare: 1, suitableOpenings: 0 }).series._.placements[0]).toBe(0));
  it('eligible trainees and residents cap completions', () => {
    expect(run({ trainingShare: 1, instructorCapacity: 1e12, eligibleTrainees: 3 }).series._.completions[0]).toBe(3);
    expect(run({ trainingShare: 1, instructorCapacity: 1e12, eligibleTrainees: 1e12, costPerCompletion: 1 }).series._.completions[0]).toBe(340003797);
  });
  it.each([
    { placementRate: 1.01 }, { policyShare: -1 }, { trainingShare: Infinity },
    { recipientCountry: 'unknown' }, { recipientCountry: 'TWN' },
    { costPerCompletion: -1 }, { costPerCompletion: 0 }, { costPerCompletion: NaN },
    { instructorCapacity: -1 }, { eligibleTrainees: Infinity }, { suitableOpenings: -1 },
  ])('rejects invalid scenario %j', overrides => expect(() => run(overrides)).toThrow());
  it('preserves raw negative cash flow and assigns zero ceiling', () => {
    const record = { ...financialRecord('apple-fy2025'), operatingCashFlow: -10 };
    const r = runModel(createFinancialModel(record, defaultFinancialScenario));
    expect(r.ok).toBe(true);
    expect(r.series._.source_cash_flow[0]).toBe((-10 - 12715) * 1e6);
    expect(r.series._.allocatable_base[0]).toBe(0);
    expect(r.series._.policy_budget[0]).toBe(0);
  });
  it.each([null, undefined, NaN, Infinity])('rejects missing/nonfinite necessary statement values: %s', value => {
    for (const field of ['operatingCashFlow', 'cashCapitalInvestment']) {
      const record = { ...financialRecord('apple-fy2025'), [field]: value };
      expect(() => createFinancialModel(record, defaultFinancialScenario)).toThrow();
    }
  });
  it('rejects nonfinite intermediate arithmetic without arbitrary input clamps', () => expect(() => run({ costPerCompletion: Number.MIN_VALUE, trainingShare: 1 })).toThrow());
  it('preserves cash identities at extreme shares', () => {
    const r = run({ policyShare: 1, trainingShare: .9999999999, instructorCapacity: 1e12, eligibleTrainees: 1e12, suitableOpenings: 1e12 });
    const s = r.series._;
    expect(s.policy_budget[0]).toBeCloseTo(s.dividend_spend[0] + s.actual_training_spend[0] + s.unspent_training[0], 3);
    expect(s.placements[0]).toBeLessThanOrEqual(s.completions[0]);
  });
  it('rejects Lab parameter overrides outside limits with real invariant errors', () => {
    const m = createFinancialModel(financialRecord('apple-fy2025'), defaultFinancialScenario);
    const r = runModel(m, { overlays: [{ id: 'invalid-share', parameters: [{ id: 'policy_share', value: 2 }] }] });
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some(d => d.code === 'invariant-violated')).toBe(true);
  });
  it('rejects attempts to attach policy effects after hard accounting limits', () => {
    const m = createFinancialModel(financialRecord('apple-fy2025'), defaultFinancialScenario);
    const r = runModel(m, { overlays: [{ id: 'overspend', effects: [{ id: 'fake-money', target: 'dividend_spend', op: 'add', expr: '1e12', source: { label: 'test' } }] }] });
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some(d => d.code === 'no-hook' || d.code === 'effect-after-constraint')).toBe(true);
  });
  it('all six records compile into valid single-year runnable models', () => {
    expect(financialRecords).toHaveLength(6);
    for (const record of financialRecords) {
      const m = createFinancialModel(record, defaultFinancialScenario);
      expect(validateCoreModel(m).ok).toBe(true);
      expect(runModel(m).ok).toBe(true);
    }
    expect(() => financialRecord('missing')).toThrow();
    expect(recipientCohorts).toHaveLength(127);
  });
});

describe('published observation identity in Lab', () => {
  it.each(['reported_operating_cash_flow', 'reported_cash_investment', 'recipient_population'])('rejects edits to pinned observation %s', id => {
    const m = createFinancialModel(financialRecord('apple-fy2025'), defaultFinancialScenario);
    const r = runModel(m, { overlays: [{ id: 'rewrite-observation', parameters: [{ id, value: 1 }] }] });
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some(d => d.code === 'invariant-violated')).toBe(true);
  });
});

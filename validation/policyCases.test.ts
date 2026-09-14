import { describe, it, expect } from 'vitest';
import alaska from '../data/cases/alaska-pfd.json';
import { runPolicyCase, renderCaseMarkdown, type PolicyCase, type MappedResult, type StructuralResult } from './policyCases';

const record = alaska as unknown as PolicyCase;

describe('policy-effect case: Alaska PFD (Jones & Marinescu 2022)', () => {
  const report = runPolicyCase(record);

  it('accounts for every outcome and every mapping runs', () => {
    expect(report.unaccounted).toEqual([]);
    expect(report.errors).toEqual([]);
  });

  it('reproduces the authors\' calibration and reports the signed discrepancy in original units', () => {
    const r = report.results.find((x): x is MappedResult => x.status === 'mapped' && x.outcome === 'employment_rate')!;
    expect(r.modelValue).toBeCloseTo(-0.007, 3); // AEJ p.335
    expect(r.studyEstimate).toBe(0.001);         // AEJ Table 2
    expect(r.discrepancy).toBeCloseTo(r.modelValue - 0.001, 12);
    expect(r.studyCi95).toEqual([-0.030, 0.033]);
    // Model-side spread is the two editions, kept apart from the study interval.
    expect(r.modelAlternatives.map((a) => a.label)).toEqual(['default', 'NBER w24312 (Jan 2020) calibration']);
    expect(r.modelSpread[1]).toBeCloseTo(-0.0015, 3);
    expect(r.fittedToOutcome).toBe(false);
  });

  it('runs the world engine to show the transfer→employment mechanism is absent, not zero by prediction', () => {
    const r = report.results.find((x): x is StructuralResult => x.status === 'mechanism-absent' || x.status === 'mechanism-present')!;
    expect(r.status).toBe('mechanism-absent');
    expect(r.detail.unemploymentTransfer).toBe(r.detail.unemploymentNoTransfer);
    expect(r.detail.transferShareOfLabourIncome).toBeGreaterThan(0);
    expect(r.detail.caseTransferShare).toBe(0.0725);
  });

  it('flags an outcome with no mapping and a mapping that cannot run', () => {
    const broken: PolicyCase = {
      ...record,
      mappings: [
        ...record.mappings.filter((m) => m.outcome !== 'hours_last_week'),
        { outcome: 'employment_rate', target: 'core-model', model: 'no-such-model', expr: 'x', at: 1990, classification: 'x', fittedToOutcome: false },
      ],
    };
    const bad = runPolicyCase(broken);
    expect(bad.unaccounted).toEqual(['hours_last_week']);
    expect(bad.errors.join()).toMatch(/no-such-model/);
    expect(renderCaseMarkdown(broken, bad)).toContain('UNACCOUNTED');
  });

  it('has no pass/fail grade anywhere in the report', () => {
    expect(JSON.stringify(report)).not.toMatch(/"passed"|"grade"|"withinInterval"/);
  });
});

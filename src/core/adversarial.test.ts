/**
 * Authoring core — the adversarial list from v3 section 10, one case per test.
 *
 * Each case asserts the SPECIFIC diagnostic or classification the harness is supposed to produce,
 * never just "something was reported". The list deliberately mixes faults with legitimate model
 * behaviour that looks like a fault:
 *
 *   fault                  expected finding
 *   a disconnected variable      warning  disconnected
 *   a unit error                 error    unit-mismatch
 *   a double-applied effect      error    duplicate-id
 *   a solver branch change       error    solve-no-root (no root), or shape 'threshold' (branch flip)
 *   a huge uncertainty band      warning  wide-range, and a Monte Carlo p95/p5 the caller can print
 *   a missing difficult case     a failing TestOutcome, reported rather than dropped
 *   a fabricated post-processing cap  warning literal-bound
 *
 *   legitimate                   expected finding
 *   a capacity plateau           shape 'saturating', with the binding constraint named
 *   a threshold jump             shape 'threshold'
 *   a calm proportional curve    shape 'linear' and nothing else
 *
 * The last three are the point of the exercise: a harness that rewarded smooth curves would pass
 * the fabricated cap and fail the real plateau. This one distinguishes them by naming what it saw.
 */

import { describe, it, expect } from 'vitest';

import { compileModel, runMonteCarlo, runTests } from './engine';
import { sweep } from './sensitivity';
import { validateCoreModel, validateOverlay } from './validate';
import type { CoreModel, Overlay } from './types';
import trainingBudgetJson from '../../data/core/training-budget.json';
import minimalJson from '../../data/core/minimal.json';

const guess = (label: string) => ({ label, kind: 'guess' as const });
const training = trainingBudgetJson as unknown as CoreModel;
const minimal = minimalJson as unknown as CoreModel;

const codesOf = (r: { diagnostics: Array<{ code: string }> }) => r.diagnostics.map((d) => d.code);

// ---------------------------------------------------------------------------
// Faults
// ---------------------------------------------------------------------------

describe('a disconnected variable', () => {
  it('is reported as a "disconnected" warning naming the variable, and does not block the run', () => {
    const m: CoreModel = {
      schemaVersion: 1,
      id: 'disconnected',
      name: 'A variable nothing reads',
      time: { start: 2026, end: 2028, step: 'year' },
      parameters: [{ id: 'rate', value: 0.2, source: guess('illustrative') }],
      variables: [
        { id: 'used', equation: 'rate * 10' },
        { id: 'headline_risk', equation: 'rate * 1000', description: 'computed, charted nowhere, read by nothing' },
      ],
      outputs: ['used'],
    };
    const r = validateCoreModel(m);
    expect(codesOf(r)).toContain('disconnected');
    const w = r.warnings.find((x) => x.startsWith('disconnected'))!;
    expect(w).toContain('headline_risk');
    expect(w).toContain('nothing reads it');
    // It is a warning: the model still runs, it just does not mean what its variable list implies.
    expect(r.ok).toBe(true);
  });
});

describe('a unit error', () => {
  it('is reported as "unit-mismatch" when an effect adds one unit to a variable in another', () => {
    const m: CoreModel = {
      schemaVersion: 1,
      id: 'unit-error',
      name: 'Dollars added to a ladder score',
      time: { start: 2026, end: 2028, step: 'year' },
      parameters: [{ id: 'transfer', value: 1200, unit: 'usd', source: guess('illustrative') }],
      variables: [{ id: 'wellbeing', unit: 'ladder', equation: '6.5' }],
      effects: [{ id: 'transfer-boost', target: 'wellbeing', op: 'add', unit: 'usd', expr: 'transfer', source: guess('illustrative') }],
      outputs: ['wellbeing'],
    };
    const r = validateCoreModel(m);
    expect(codesOf(r)).toContain('unit-mismatch');
    expect(r.errors.join(' ')).toContain('adds usd to "wellbeing" which is in ladder');
    expect(r.ok).toBe(false);
  });

  it('warns when a multiplier carries a dimension it cannot have', () => {
    const m: CoreModel = {
      schemaVersion: 1,
      id: 'unit-error-2',
      name: 'A multiplier in dollars',
      time: { start: 2026, end: 2027, step: 'year' },
      parameters: [{ id: 'k', value: 1.1, source: guess('illustrative') }],
      variables: [{ id: 'wellbeing', unit: 'ladder', equation: '6.5' }],
      effects: [{ id: 'scale', target: 'wellbeing', op: 'multiply', unit: 'usd', expr: 'k', source: guess('illustrative') }],
      outputs: ['wellbeing'],
    };
    const r = validateCoreModel(m);
    expect(r.warnings.join(' ')).toContain('unit-mismatch');
    expect(r.warnings.join(' ')).toContain('should be dimensionless');
  });
});

describe('a double-applied effect', () => {
  const base: CoreModel = {
    schemaVersion: 1,
    id: 'double-apply',
    name: 'One transfer, counted twice',
    time: { start: 2026, end: 2028, step: 'year' },
    parameters: [{ id: 'transfer', value: 0.5, unit: 'ladder', source: guess('illustrative') }],
    variables: [{ id: 'wellbeing', unit: 'ladder', equation: '6.5' }],
    effects: [{ id: 'transfer-boost', target: 'wellbeing', op: 'add', unit: 'ladder', expr: 'transfer', source: guess('illustrative') }],
    outputs: ['wellbeing'],
  };

  it('is reported as "duplicate-id" when an overlay re-adds an effect the base already has', () => {
    const overlay: Overlay = {
      id: 'transfer-again',
      effects: [{ id: 'transfer-boost', target: 'wellbeing', op: 'add', unit: 'ladder', expr: 'transfer', source: guess('illustrative') }],
    };
    const r = validateOverlay(base, overlay);
    expect(codesOf(r)).toContain('duplicate-id');
    expect(r.errors.join(' ')).toContain('double count');
    expect(r.ok).toBe(false);
  });

  it('is reported as "duplicate-id" when one file declares the same effect twice', () => {
    const m: CoreModel = { ...base, effects: [...base.effects!, { ...base.effects![0] }] };
    const r = validateCoreModel(m);
    expect(codesOf(r)).toContain('duplicate-id');
    expect(r.errors.join(' ')).toContain('counted twice');
    expect(r.ok).toBe(false);
  });

  // ENGINE GAP: compileModel claims parameter, input, variable and solve-unknown ids but never
  // effect ids, so within one file both copies apply and wellbeing silently comes out at 7.5
  // instead of 7.0. resolveModel catches it across an overlay boundary only. The check therefore
  // lives in validate.ts (duplicateIdFindings); this test documents what the engine itself should
  // do. Delete the `.fails` when compileModel claims effect and solve-block ids.
  it('is caught by compileModel itself, not only by the validator', () => {
    const m: CoreModel = { ...base, effects: [...base.effects!, { ...base.effects![0] }] };
    expect(compileModel(m).diagnostics.map((d) => d.code)).toContain('duplicate-id');
  });
});

describe('a solver that changes branch', () => {
  const noRoot: CoreModel = {
    schemaVersion: 1,
    id: 'solve-no-root',
    name: 'A bracket with no root in it',
    time: { start: 2026, end: 2027, step: 'year' },
    parameters: [{ id: 'floor', value: 1, source: guess('illustrative') }],
    solves: [{ id: 'clearing', unknown: 'price', residual: 'price * price + floor', bracket: [0, 1] }],
    variables: [{ id: 'demand', equation: 'price * 2' }],
    outputs: ['demand'],
  };

  it('is reported as "solve-no-root" with the bracket and both end residuals', () => {
    const r = validateCoreModel(noRoot);
    expect(codesOf(r)).toContain('solve-no-root');
    expect(r.errors.join(' ')).toContain('same sign at both ends of the bracket [0, 1]');
    expect(r.ok).toBe(false);
  });

  it('shows up as a "threshold", not a calm curve, when bisection flips between two roots', () => {
    // residual p^3 - 3p - shift has three roots inside [-3, 3]. Bisection tests the midpoint first,
    // so the sign of `shift` decides which half it descends into: the answer jumps from about -1.75
    // to about +1.75 as shift crosses zero, with no warning from the run itself.
    const branchy: CoreModel = {
      schemaVersion: 1,
      id: 'solve-branch',
      name: 'Three roots, one bracket',
      time: { start: 2026, end: 2027, step: 'year' },
      parameters: [{ id: 'shift', value: 0.2, source: guess('illustrative') }],
      solves: [{ id: 'root', unknown: 'p', residual: 'p^3 - 3 * p - shift', bracket: [-3, 3] }],
      variables: [{ id: 'out', equation: 'p' }],
      outputs: ['out'],
    };
    expect(validateCoreModel(branchy).ok).toBe(true);
    const s = sweep(branchy, { parameter: 'shift', output: 'out', at: 2027, grid: [-0.4, -0.2, -0.1, 0.1, 0.2, 0.4] });
    expect(s.ok, s.errors.join('; ')).toBe(true);
    expect(s.shape).toBe('threshold');
    expect(s.points[2].output).toBeLessThan(0);
    expect(s.points[3].output).toBeGreaterThan(0);
    expect(s.detail.reason).toContain('carries');
  });
});

describe('a huge uncertainty band', () => {
  const wide: CoreModel = {
    schemaVersion: 1,
    id: 'wide-band',
    name: 'A hundredfold band on the only parameter that matters',
    time: { start: 2026, end: 2027, step: 'year' },
    parameters: [{
      id: 'effect_size',
      value: 0.1,
      range: { dist: 'lognormal', p5: 0.01, p95: 1 },
      source: guess('no study, an opinion with percentiles'),
    }],
    variables: [{ id: 'out', equation: '100 * effect_size' }],
    outputs: ['out'],
  };

  it('is reported as a "wide-range" warning that says the number is not an estimate', () => {
    const r = validateCoreModel(wide);
    expect(codesOf(r)).toContain('wide-range');
    const w = r.warnings.find((x) => x.startsWith('wide-range'))!;
    expect(w).toContain('100x');
    expect(w).toContain('the value is unknown, not an estimate');
    // A wide band is honest, not invalid: the model still runs.
    expect(r.ok).toBe(true);
  });

  it('shows up in the Monte Carlo as a p95/p5 the caller can print beside the result', () => {
    const mc = runMonteCarlo(wide, { runs: 400, seed: 11 });
    expect(mc.ok).toBe(true);
    const q = mc.quantiles._.out;
    const last = mc.years.length - 1;
    const ratio = q.p95[last] / q.p5[last];
    expect(ratio).toBeGreaterThan(20);
    // The band is the answer here: the median is a point inside two orders of magnitude.
    expect(q.p50[last]).toBeGreaterThan(q.p5[last]);
    expect(q.p95[last]).toBeGreaterThan(q.p50[last]);
  });
});

describe('a fabricated post-processing cap', () => {
  it('is reported as "literal-bound": a numeric limit with no parameter and no source', () => {
    const m: CoreModel = {
      schemaVersion: 1,
      id: 'fabricated-cap',
      name: 'A cap nobody has to justify',
      time: { start: 2026, end: 2030, step: 'year' },
      parameters: [{ id: 'growth', value: 0.5, source: guess('illustrative') }],
      variables: [
        { id: 'raw', initial: 100, equation: 'raw[t-1] * (1 + growth)' },
        { id: 'reported', equation: 'min(raw, 1000)', description: 'the number the chart shows' },
      ],
      outputs: ['reported'],
    };
    const r = validateCoreModel(m);
    expect(codesOf(r)).toContain('literal-bound');
    const w = r.warnings.find((x) => x.startsWith('literal-bound'))!;
    expect(w).toContain('a numeric limit with no parameter and no source');
    expect(w).toContain('1000');
    expect(w).toContain('reported');

    // And it is invisible to a sweep: the cap has no id, so no sweep can move it. Growth drives the
    // output to the ceiling and then nothing further happens, which looks exactly like a plateau.
    const s = sweep(m, { parameter: 'growth', output: 'reported', at: 2030, grid: [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6] });
    expect(s.shape).toBe('saturating');
    expect(s.points.slice(3).every((p) => p.output === 1000)).toBe(true);
    // The difference from a real capacity limit: the thing that binds is a bare number.
    expect(s.bindingSummary).toContain('reported is limited by 1000');
  });

  it('says nothing about a structural limit like a share that cannot leave [0, 1]', () => {
    const m: CoreModel = {
      schemaVersion: 1,
      id: 'structural-cap',
      name: 'A share stays a share',
      time: { start: 2026, end: 2027, step: 'year' },
      parameters: [{ id: 'take_up', value: 0.4, source: guess('illustrative') }],
      variables: [{ id: 'share', equation: 'clamp(take_up * 3, 0, 1)' }],
      outputs: ['share'],
    };
    expect(validateCoreModel(m).warnings.join(' ')).not.toContain('literal-bound');
  });
});

describe('a missing difficult case', () => {
  it('is reported as a failing TestOutcome, not silently dropped', () => {
    // The model reproduces the easy year and quietly gets the hard one wrong.
    const m: CoreModel = {
      ...training,
      tests: [
        ...(training.tests ?? []),
        { name: 'the year the openings constraint bites hardest', at: 2029, expr: 'placements', expected: 1500, tol: 0 },
      ],
    };
    const outcomes = runTests(m);
    expect(outcomes).toHaveLength(3);
    const failed = outcomes.filter((o) => !o.passed);
    expect(failed).toHaveLength(1);
    expect(failed[0].name).toBe('the year the openings constraint bites hardest');
    expect(failed[0].actual).toBe(1000);
    expect(failed[0].expected).toBe(1500);
    expect(failed[0].message).toContain('got 1000, expected 1500');
    // The passing tests are still reported, so a reader sees 2 of 3, not "tests: ok".
    expect(outcomes.filter((o) => o.passed)).toHaveLength(2);
  });

  it('reports a test that cannot even be evaluated rather than skipping it', () => {
    const m: CoreModel = { ...training, tests: [{ name: 'a year this model does not reach', at: 2040, expr: 'placements', expected: 1000, tol: 0 }] };
    const outcomes = runTests(m);
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].passed).toBe(false);
    expect(outcomes[0].message).toContain('not a step of this model');
  });
});

// ---------------------------------------------------------------------------
// Legitimate behaviour that must not be reported as a fault
// ---------------------------------------------------------------------------

describe('a legitimate capacity plateau', () => {
  it('classifies as "saturating" and names suitable_openings as the constraint that binds', () => {
    const s = sweep(training, {
      parameter: 'training_budget',
      output: 'placements',
      at: 2029,
      grid: [1e6, 3e6, 5e6, 7e6, 9e6, 11e6, 13e6, 15e6],
    });
    expect(s.ok, s.errors.join('; ')).toBe(true);
    expect(s.shape).toBe('saturating');
    expect(s.points.map((p) => p.output)).toEqual([100, 300, 500, 700, 900, 1000, 1000, 1000]);
    expect(s.points.at(-1)!.binding).toEqual(['placements is limited by suitable_openings']);
    expect(s.bindingSummary).toEqual([
      'placements is limited by potential_placements',
      'placements is limited by suitable_openings',
    ]);
    expect(s.detail.closeSlope).toBe(0);
    // The plateau is legitimate: nothing about the model is invalid.
    expect(validateCoreModel(trainingBudgetJson).ok).toBe(true);
    expect(validateCoreModel(trainingBudgetJson).warnings).toEqual([]);
  });
});

describe('a legitimate threshold jump', () => {
  const cliff: CoreModel = {
    schemaVersion: 1,
    id: 'eligibility-cliff',
    name: 'A benefit with an income cut-off',
    scope: 'The cliff is the policy, not an artefact: the benefit really does stop at the cut-off.',
    time: { start: 2026, end: 2027, step: 'year' },
    parameters: [
      { id: 'income', value: 28000, unit: 'usd', source: guess('illustrative household income') },
      { id: 'cutoff', value: 30000, unit: 'usd', source: { label: 'the eligibility threshold in the scheme rules', kind: 'assumed' } },
      { id: 'award', value: 500, unit: 'usd', source: { label: 'the award in the scheme rules', kind: 'assumed' } },
    ],
    variables: [{ id: 'benefit', unit: 'usd', equation: 'income < cutoff ? award : 0' }],
    outputs: ['benefit'],
  };

  it('validates cleanly: a cliff written with sourced parameters is not a fault', () => {
    const r = validateCoreModel(cliff);
    expect(r.errors).toEqual([]);
    expect(r.warnings.join(' ')).not.toContain('literal-bound');
    expect(r.ok).toBe(true);
  });

  it('classifies as "threshold" and locates the grid interval the jump sits in', () => {
    const s = sweep(cliff, { parameter: 'income', output: 'benefit', at: 2027, grid: [26000, 28000, 29000, 31000, 32000, 34000] });
    expect(s.ok).toBe(true);
    expect(s.points.map((p) => p.output)).toEqual([500, 500, 500, 0, 0, 0]);
    expect(s.shape).toBe('threshold');
    expect(s.detail.jumpAt).toBe(2);
    expect(s.detail.maxStepShare).toBe(1);
  });

  it('classifies the same way when the cliff is written arithmetically rather than with a ternary', () => {
    const arithmetic: CoreModel = { ...cliff, id: 'eligibility-cliff-2', variables: [{ id: 'benefit', unit: 'usd', equation: '(income < cutoff) * award' }] };
    const s = sweep(arithmetic, { parameter: 'income', output: 'benefit', at: 2027, grid: [26000, 28000, 29000, 31000, 32000, 34000] });
    expect(s.shape).toBe('threshold');
    expect(s.points.map((p) => p.output)).toEqual([500, 500, 500, 0, 0, 0]);
  });
});

describe('a calm monotone curve', () => {
  it('is classified "linear" and nothing more interesting than that', () => {
    const s = sweep(minimal, { parameter: 'growth', output: 'income', at: 2035, steps: 11 });
    expect(s.ok).toBe(true);
    expect(s.shape).toBe('linear');
    expect(s.detail.monotone).toBe('up');
    expect(s.detail.maxStepShare).toBeLessThan(0.6);
    expect(s.detail.closeSlope).toBeGreaterThan(0.1 * s.detail.openSlope);
    expect(s.bindingSummary).toEqual([]);
  });

  it('is still "linear" through a mildly concave transform, not "saturating"', () => {
    const s = sweep(minimal, { parameter: 'growth', output: 'wellbeing', at: 2035, steps: 11 });
    expect(s.shape).toBe('linear');
    expect(s.detail.reason).toContain('no plateau and no jump');
  });

  it('is not mistaken for a fault: the calm model validates with no warnings', () => {
    const r = validateCoreModel(minimalJson);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import { compileModel, explainBinding, resolveModel, runModel, runMonteCarlo, runTests } from './engine';
import type { CoreModel, Overlay } from './types';

const guess = (label: string) => ({ label, kind: 'guess' as const });

/** The v3 worked example: training funding meets a jobs constraint. Numbers from the design note. */
const training: CoreModel = {
  schemaVersion: 1,
  id: 'training-budget',
  name: 'Training funding meets a jobs constraint',
  time: { start: 2026, end: 2029, step: 'year' },
  parameters: [
    { id: 'cost_per_completion', value: 5000, unit: 'usd', source: guess('illustrative') },
    { id: 'instructor_capacity', value: 3000, unit: 'people', source: guess('illustrative') },
    { id: 'eligible_people', value: 10000, unit: 'people', source: guess('illustrative') },
    { id: 'placement_rate', value: 0.5, unit: 'share', source: guess('illustrative') },
    { id: 'suitable_openings', value: 1000, unit: 'people', source: guess('illustrative') },
  ],
  inputs: [{ id: 'training_budget', unit: 'usd', interp: 'step', curve: { '2026': 6e6, '2027': 10e6, '2028': 11e6, '2029': 20e6 } }],
  variables: [
    { id: 'completions', unit: 'people', equation: 'min(training_budget / cost_per_completion, instructor_capacity, eligible_people)' },
    { id: 'actual_training_spend', unit: 'usd', equation: 'completions * cost_per_completion' },
    { id: 'unspent_budget', unit: 'usd', equation: 'training_budget - actual_training_spend' },
    { id: 'placements', unit: 'people', equation: 'min(completions * placement_rate, suitable_openings)' },
  ],
  outputs: ['completions', 'actual_training_spend', 'unspent_budget', 'placements'],
  tests: [
    { name: '$11M: openings bind, 1000 placements', at: 2028, expr: 'placements', expected: 1000, tol: 0 },
    { name: '$20M: capacity binds, $5M unspent', at: 2029, expr: 'unspent_budget', expected: 5e6, tol: 0 },
  ],
};

describe('training-budget worked example (v3 section 5)', () => {
  it('reconciles with the published table', () => {
    const r = runModel(training);
    expect(r.ok, r.diagnostics.map((d) => d.message).join('; ')).toBe(true);
    const s = r.series._;
    expect(s.completions).toEqual([1200, 2000, 2200, 3000]);
    expect(s.actual_training_spend).toEqual([6e6, 10e6, 11e6, 15e6]);
    expect(s.placements).toEqual([600, 1000, 1000, 1000]);
    expect(s.unspent_budget).toEqual([0, 0, 0, 5e6]);
  });

  it('explains which constraint binds', () => {
    const r = runModel(training);
    expect(explainBinding(r, '_', 'placements', 0)).toEqual(['placements is limited by completions * placement_rate']);
    expect(explainBinding(r, '_', 'placements', 2)).toEqual(['placements is limited by suitable_openings']);
    expect(explainBinding(r, '_', 'completions', 3)).toEqual(['completions is limited by instructor_capacity']);
  });

  it('passes its own tests', () => {
    const outcomes = runTests(training);
    expect(outcomes.every((o) => o.passed), JSON.stringify(outcomes)).toBe(true);
  });
});

const minimal: CoreModel = {
  schemaVersion: 1,
  id: 'minimal',
  name: 'Income and wellbeing',
  time: { start: 2026, end: 2030, step: 'year' },
  parameters: [
    { id: 'growth', value: 0.02, unit: 'share', range: { dist: 'normal', p5: 0.0, p95: 0.04 }, source: guess('illustrative') },
    { id: 'incomeElasticity', value: 0.349, source: { label: 'WHR 2024 Table 2.1 log-GDP coefficient', kind: 'associational' } },
  ],
  variables: [
    { id: 'income', unit: 'usd', initial: 50000, equation: 'income[t-1] * (1 + growth)' },
    { id: 'incomeMultiple', equation: 'income / 50000' },
    { id: 'wellbeing', unit: 'ladder', equation: '6.5 + incomeElasticity * log(incomeMultiple)' },
  ],
  outputs: ['income', 'incomeMultiple', 'wellbeing'],
};

const tutoring: Overlay = {
  id: 'tutoring',
  inputs: [{ id: 'aiTutoringAccess', unit: 'share', curve: { '2026': 0, '2030': 0.6 } }],
  parameters: [
    { id: 'tutoringIncomeEffect', value: 0.04, unit: 'share', source: guess('author guess') },
    { id: 'tutoringWellbeingEffect', value: 0.12, unit: 'ladder', source: guess('author guess') },
  ],
  effects: [
    { id: 'tutoring-income', target: 'income', op: 'multiply', expr: '1 + tutoringIncomeEffect * aiTutoringAccess', source: guess('author guess') },
    { id: 'tutoring-wellbeing', target: 'wellbeing', op: 'add', unit: 'ladder', expr: 'tutoringWellbeingEffect * aiTutoringAccess', source: guess('author guess') },
  ],
};

describe('minimal model, stocks and overlays', () => {
  it('a stock starts at initial and compounds', () => {
    const r = runModel(minimal);
    expect(r.ok).toBe(true);
    expect(r.series._.income[0]).toBe(50000);
    expect(r.series._.income[1]).toBeCloseTo(51000, 6);
    expect(r.series._.wellbeing[0]).toBeCloseTo(6.5, 9);
  });

  it('an overlay reaches two equations through effects without rewriting them', () => {
    const base = runModel(minimal);
    const withOverlay = runModel(minimal, { overlays: [tutoring] });
    expect(withOverlay.ok, withOverlay.diagnostics.map((d) => d.message).join('; ')).toBe(true);
    expect(withOverlay.series._.income[0]).toBe(base.series._.income[0]); // no access in 2026
    expect(withOverlay.series._.income[4]).toBeGreaterThan(base.series._.income[4]);
    expect(withOverlay.series._.wellbeing[4] - base.series._.wellbeing[4]).toBeGreaterThan(0.12 * 0.6 - 1e-9);
  });

  it('an overlay that redefines an equation is rejected as a structural change', () => {
    const fork: Overlay = { id: 'fork', variables: [{ id: 'income', equation: 'income[t-1] * 2' }] };
    const r = runModel(minimal, { overlays: [fork] });
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => d.code === 'structural-change')).toBe(true);
  });

  it('the same effect applied twice is a double count and is rejected', () => {
    const r = runModel(minimal, { overlays: [tutoring, tutoring] });
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => d.code === 'duplicate-id')).toBe(true);
  });

  it('a unit mismatch on an additive effect is an error', () => {
    const bad: Overlay = { id: 'bad', effects: [{ id: 'x', target: 'wellbeing', op: 'add', unit: 'usd', expr: '1', source: guess('g') }] };
    const r = runModel(minimal, { overlays: [bad] });
    expect(r.diagnostics.some((d) => d.code === 'unit-mismatch' && d.level === 'error')).toBe(true);
  });
});

describe('diagnostics', () => {
  it('reports a same-step cycle with a trace', () => {
    const m: CoreModel = { ...minimal, id: 'cycle', variables: [{ id: 'a', equation: 'b + 1' }, { id: 'b', equation: 'a * 2' }], outputs: ['a'] };
    const cm = compileModel(m);
    const cyc = cm.diagnostics.find((d) => d.code === 'cycle');
    expect(cyc?.message).toMatch(/_:a -> _:b -> _:a|_:b -> _:a -> _:b/);
  });

  it('reports unknown symbols, missing sources, disconnected variables and missing history', () => {
    const m: CoreModel = {
      ...minimal, id: 'diag',
      parameters: [{ id: 'k', value: 1, source: { label: '' } as any }],
      variables: [{ id: 'x', equation: 'k * nope' }, { id: 'orphan', equation: '1' }, { id: 'lagged', equation: 'lagged[t-2] + 1', initial: 0 }],
      outputs: ['x', 'lagged'],
    };
    const r = runModel(m);
    const codes = r.diagnostics.map((d) => d.code);
    expect(codes).toContain('unknown-symbol');
    expect(codes).toContain('missing-source');
    expect(codes).toContain('disconnected');
    const fixed: CoreModel = { ...m, parameters: [{ id: 'k', value: 1, source: guess('g') }], variables: [{ id: 'lagged', equation: 'lagged[t-2] + 1', initial: 0 }], outputs: ['lagged'] };
    const r2 = runModel(fixed);
    expect(r2.ok).toBe(false);
    expect(r2.diagnostics.some((d) => d.code === 'missing-history')).toBe(true);
    const r3 = runModel({ ...fixed, variables: [{ id: 'lagged', equation: 'lagged[t-2] + 1', initial: 0, history: [0, 0] }] });
    expect(r3.ok).toBe(true);
    expect(r3.series._.lagged).toEqual([0, 1, 1, 2, 2]);
  });

  it('disallows arbitrary functions and assignments', () => {
    const m: CoreModel = { ...minimal, id: 'unsafe', variables: [{ id: 'x', equation: 'random()' }], outputs: ['x'] };
    expect(compileModel(m).diagnostics.some((d) => d.code === 'parse')).toBe(true);
  });
});

describe('scalar equilibrium block', () => {
  const market: CoreModel = {
    schemaVersion: 1, id: 'market', name: 'Supply meets demand', time: { start: 2026, end: 2027, step: 'year' },
    parameters: [
      { id: 'a', value: 10, source: guess('g') }, { id: 'b', value: 2, source: guess('g') },
      { id: 'c', value: 100, source: guess('g') }, { id: 'd', value: 3, source: guess('g') },
    ],
    variables: [
      { id: 'supply', equation: 'a + b * price' },
      { id: 'demand', equation: 'c - d * price' },
    ],
    solves: [{ id: 'clear', unknown: 'price', residual: '(c - d * price) - (a + b * price)', bracket: [0, 1000], tol: 1e-10 }],
    outputs: ['price', 'supply', 'demand'],
  };
  it('finds the clearing price and the market clears', () => {
    const r = runModel(market);
    expect(r.ok, r.diagnostics.map((d) => d.message).join('; ')).toBe(true);
    expect(r.series._.price[0]).toBeCloseTo((100 - 10) / (2 + 3), 8);
    expect(r.series._.supply[0]).toBeCloseTo(r.series._.demand[0], 6);
    expect(r.solves.clear._.status).toBe('ok');
  });
  it('fails explicitly when there is no root in the bracket', () => {
    const r = runModel({ ...market, solves: [{ ...market.solves![0], bracket: [500, 1000] }] });
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => d.code === 'solve-no-root')).toBe(true);
  });
});

describe('entities and aggregates', () => {
  const pool: CoreModel = {
    schemaVersion: 1, id: 'pool', name: 'Contributions to a shared pool', time: { start: 2026, end: 2026, step: 'year' },
    entities: { kind: 'country', ids: ['A', 'B', 'C'] },
    parameters: [
      { id: 'income', value: 100, byEntity: { A: 100, B: 200, C: 300 }, source: guess('g') },
      { id: 'rate', value: 0.1, source: guess('g') },
      { id: 'share', value: 1 / 3, byEntity: { A: 0.5, B: 0.3, C: 0.2 }, source: guess('g') },
    ],
    variables: [
      { id: 'contribution', equation: 'rate * income' },
      { id: 'pool', equation: 'sum(contribution)' },
      { id: 'transfer', equation: 'pool * share' },
    ],
    outputs: ['contribution', 'pool', 'transfer'],
  };
  it('evaluates aggregates after every entity and before their consumers', () => {
    const r = runModel(pool);
    expect(r.ok, r.diagnostics.map((d) => d.message).join('; ')).toBe(true);
    expect(r.aggregates['__agg_sum_contribution'][0]).toBeCloseTo(60, 9);
    expect(r.series.A.transfer[0]).toBeCloseTo(30, 9);
    expect(r.series.C.transfer[0]).toBeCloseTo(12, 9);
  });
});

describe('Monte Carlo with paired draws', () => {
  it('baseline and overlay use identical parameter draws for the same seed', () => {
    const a = runModel(minimal, { seed: 7, run: 3 });
    const b = runModel(minimal, { seed: 7, run: 3, overlays: [tutoring] });
    expect(a.parameters._.growth).toBe(b.parameters._.growth);
    expect(a.parameters._.growth).not.toBe(0.02);
    const mc = runMonteCarlo(minimal, { runs: 50, seed: 7 });
    expect(mc.ok).toBe(true);
    expect(mc.quantiles._.income.p95[4]).toBeGreaterThan(mc.quantiles._.income.p5[4]);
    expect(runMonteCarlo(minimal, { runs: 50, seed: 7 }).quantiles._.income.p50[4]).toBe(mc.quantiles._.income.p50[4]);
  });
});

describe('resolveModel', () => {
  it('leaves the base untouched and records overlay ids in the manifest', () => {
    const before = JSON.stringify(minimal);
    const r = runModel(minimal, { overlays: [tutoring] });
    expect(JSON.stringify(minimal)).toBe(before);
    expect(r.manifest.overlayIds).toEqual(['tutoring']);
    expect(resolveModel(minimal, [tutoring]).model.effects?.length).toBe(2);
  });
});

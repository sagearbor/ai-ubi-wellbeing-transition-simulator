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

  describe('through: effects enter the equilibrium (v3 section 7)', () => {
    const viaVars: CoreModel = { ...market, solves: [{ id: 'clear', unknown: 'price', residual: 'demand - supply', through: ['supply', 'demand'], bracket: [0, 1000], tol: 1e-10 }] };
    const subsidy = { id: 'subsidy', target: 'supply', op: 'add' as const, expr: '15', unit: undefined, source: guess('g') };

    it('a residual written over through variables finds the same root as the inline residual', () => {
      const r = runModel(viaVars);
      expect(r.ok, r.diagnostics.map((d) => d.message).join('; ')).toBe(true);
      expect(r.series._.price[0]).toBeCloseTo(18, 8);
      expect(r.diagnostics).toEqual([]);
    });

    it('an effect on a through variable moves the equilibrium, and reported values clear at the root', () => {
      const r = runModel(viaVars, { overlays: [{ id: 'subsidy', effects: [subsidy] }] });
      expect(r.ok).toBe(true);
      // (100 - 3p) = (10 + 2p + 15) -> p = 15
      expect(r.series._.price[0]).toBeCloseTo(15, 8);
      expect(r.series._.supply[0]).toBeCloseTo(r.series._.demand[0], 6);
      expect(r.series._.supply[0]).toBeCloseTo(55, 6);
    });

    it('without through the same effect is applied after the solve and a warning says so', () => {
      const r = runModel(market, { overlays: [{ id: 'subsidy', effects: [subsidy] }] });
      expect(r.ok).toBe(true);
      expect(r.series._.price[0]).toBeCloseTo(18, 8); // equilibrium ignores the subsidy
      expect(r.diagnostics.filter((d) => d.code === 'effect-after-solve')).toHaveLength(1);
    });

    it('through variables may read each other in any listed order; unknown ids and stocks are errors', () => {
      const chained: CoreModel = {
        ...market,
        variables: [...market.variables, { id: 'excess', equation: 'demand - supply' }],
        solves: [{ id: 'clear', unknown: 'price', residual: 'excess', through: ['excess', 'demand', 'supply'], bracket: [0, 1000], tol: 1e-10 }],
      };
      const r = runModel(chained);
      expect(r.ok, r.diagnostics.map((d) => d.message).join('; ')).toBe(true);
      expect(r.series._.price[0]).toBeCloseTo(18, 8);
      expect(compileModel({ ...market, solves: [{ ...viaVars.solves![0], through: ['nope', 'supply', 'demand'] }] }).diagnostics.some((d) => d.code === 'unknown-symbol')).toBe(true);
      const stock: CoreModel = { ...market, variables: [{ id: 'supply', equation: 'a + b * price', initial: 1 }, market.variables[1]] };
      expect(compileModel({ ...stock, solves: viaVars.solves }).diagnostics.some((d) => /is a stock/.test(d.message))).toBe(true);
    });

    it('a residual reading a variable that depends on the unknown without through is still a cycle', () => {
      const r = runModel({ ...market, solves: [{ id: 'clear', unknown: 'price', residual: 'demand - supply', bracket: [0, 1000] }] });
      expect(r.ok).toBe(false);
      expect(r.diagnostics.some((d) => d.code === 'cycle')).toBe(true);
    });
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

// ---------------------------------------------------------------------------
// Review 2026-09-14 (docs/design/reviews/2026-09-14-v3-implementation-review-97f751d.md)
// ---------------------------------------------------------------------------

const one = (extra: Partial<CoreModel>): CoreModel => ({
  schemaVersion: 1, id: 'probe', name: 'probe', time: { start: 0, end: 0, step: 'year' },
  parameters: [{ id: 'a', value: 1, source: guess('g') }],
  variables: [{ id: 'v', equation: 'a + u' }],
  outputs: ['v'],
  ...extra,
});
const solveOnly = (residual: string, bracket: [number, number], more: Record<string, unknown> = {}) =>
  runModel(one({ solves: [{ id: 's', unknown: 'u', residual, bracket, ...more }] }));

describe('review finding 1: the solver accepts roots on the residual, never on bracket width', () => {
  it('finds a root at the lower end of the bracket (u on [0, 1] is 0, not 1)', () => {
    const r = solveOnly('u', [0, 1]);
    expect(r.ok).toBe(true);
    expect(r.series._.u[0]).toBe(0);
    expect(r.solves.s._.residual[0]).toBe(0);
  });

  it('rejects an endpoint-scaled jump without a zero', () => {
    expect(solveOnly('(1e12*(u-0.5)^2 + 1) * (u < 0.5 ? -1 : 1)', [0, 1]).ok).toBe(false);
  });
  it('reaches a steep root very close to zero', () => {
    const r = solveOnly('1e12*(u-1e-15)', [0, 1], { residualTol: 1e-9 });
    expect(r.ok).toBe(true);
    expect(Math.abs(r.solves.s._.residual[0])).toBeLessThanOrEqual(1e-9);
  });

  it('finds a root at the upper end', () => {
    const r = solveOnly('u - 1', [0, 1]);
    expect(r.ok).toBe(true);
    expect(r.series._.u[0]).toBe(1);
  });

  it('a jump that changes sign without a root fails explicitly (floor(u) - 0.5 on [0, 2])', () => {
    const r = solveOnly('floor(u) - 0.5', [0, 2]);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.map((d) => d.code)).toEqual(['solve-no-convergence']);
  });

  it('a pole that changes sign fails explicitly (1 / (u - 0.3) on [0, 1])', () => {
    const r = solveOnly('1 / (u - 0.3)', [0, 1]);
    expect(r.ok).toBe(false);
    expect(['solve-discontinuity', 'solve-no-convergence']).toContain(r.diagnostics[0].code);
  });

  it('a non-finite residual inside the bracket is a failure, not a sign', () => {
    const r = solveOnly('u < 0.5 ? -1 : (u == 0.5 ? 1/0 : 1)', [0, 1]);
    expect(r.ok).toBe(false);
  });

  it('every reported root satisfies |residual| <= residualTol, including steep smooth residuals', () => {
    for (const [res, br] of [['1e6 * (u - 0.123456789)', [0, 1]], ['exp(u) - 2', [0, 5]], ['u^3 - 1e-9', [0, 1]]] as const) {
      const r = solveOnly(res, br as [number, number], { residualTol: 1e-6 });
      expect(r.ok, `${res}: ${r.diagnostics.map((d) => d.message).join('; ')}`).toBe(true);
      expect(Math.abs(r.solves.s._.residual[0])).toBeLessThanOrEqual(1e-6);
    }
  });

  it('non-convergence within maxIter is still explicit', () => {
    const r = solveOnly('u - 0.3', [0, 1], { maxIter: 3, tol: 1e-12 });
    expect(r.ok).toBe(false);
    expect(r.diagnostics.map((d) => d.code)).toEqual(['solve-no-convergence']);
  });
});

describe('review finding 11: dependency order includes effects and initial expressions', () => {
  it('through variables are ordered by what their effects read, not only their equations', () => {
    const m: CoreModel = {
      schemaVersion: 1, id: 'p', name: 'p', time: { start: 0, end: 0, step: 'year' }, parameters: [],
      variables: [{ id: 'x', equation: 'u' }, { id: 'y', equation: 'u' }],
      effects: [{ id: 'e', target: 'x', op: 'add', expr: 'y', source: guess('g') }],
      outputs: ['x'],
      solves: [{ id: 's', unknown: 'u', residual: 'x - 1', through: ['x', 'y'], bracket: [0, 1] }],
    };
    const r = runModel(m);
    expect(r.ok, r.diagnostics.map((d) => d.message).join('; ')).toBe(true);
    expect(r.series._.u[0]).toBeCloseTo(0.5, 8);
    // Order invariance: listing y first gives the same root.
    const r2 = runModel({ ...m, solves: [{ ...m.solves![0], through: ['y', 'x'] }] });
    expect(r2.series._.u[0]).toBeCloseTo(0.5, 8);
  });

  it('a stock initialised from a variable listed after it runs, in either declaration order', () => {
    const vars = [{ id: 'stock', equation: 'stock[t-1] + 1', initial: 'c * 3' }, { id: 'c', equation: 'k' }];
    const base = { schemaVersion: 1 as const, id: 'p', name: 'p', time: { start: 0, end: 2, step: 'year' as const }, parameters: [{ id: 'k', value: 2, source: guess('g') }], outputs: ['stock'] };
    for (const variables of [vars, [...vars].reverse()]) {
      const r = runModel({ ...base, variables });
      expect(r.ok, r.diagnostics.map((d) => d.message).join('; ')).toBe(true);
      expect(r.series._.stock).toEqual([6, 7, 8]);
    }
  });
});

describe('review finding 3: limits hold on final values', () => {
  const boosted: Overlay = { id: 'boost', effects: [{ id: 'boost', target: 'completions', op: 'multiply', expr: '1.025', source: guess('g') }] };

  it('an effect applied after a min() limit warns (effect-after-constraint)', () => {
    const r = runModel(training, { overlays: [boosted] });
    expect(r.diagnostics.filter((d) => d.code === 'effect-after-constraint')).toHaveLength(1);
  });

  it('an invariant fails the run when the effect pushes the limited value past its limit', () => {
    const guarded: CoreModel = { ...training, invariants: [{ id: 'capacity', expr: 'completions <= instructor_capacity' }] };
    expect(runModel(guarded).ok).toBe(true);
    const r = runModel(guarded, { overlays: [boosted] });
    expect(r.ok).toBe(false);
    const d = r.diagnostics.find((x) => x.code === 'invariant-violated')!;
    expect(d.message).toMatch(/capacity.*2029.*completions = 307[45]/);
  });

  it('an overlay cannot replace or relax an invariant', () => {
    const guarded: CoreModel = { ...training, invariants: [{ id: 'capacity', expr: 'completions <= instructor_capacity' }] };
    const relax: Overlay = { id: 'relax', invariants: [{ id: 'capacity', expr: 'completions <= 1e12' }] };
    const r = runModel(guarded, { overlays: [relax] });
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => d.code === 'duplicate-id')).toBe(true);
  });
});

describe('review finding 12: run identity', () => {
  const ranged: CoreModel = {
    ...training,
    parameters: training.parameters.map((p) => (p.id === 'instructor_capacity' ? { ...p, range: { dist: 'uniform' as const, p5: 2000, p95: 4000 } } : p)),
  };
  it('different draws of the same seed have different hashes and record the draw index', () => {
    const d0 = runModel(ranged, { seed: 1, run: 0 });
    const d1 = runModel(ranged, { seed: 1, run: 1 });
    expect(d0.parameters._.instructor_capacity).not.toBe(d1.parameters._.instructor_capacity);
    expect(d0.manifest.hash).not.toBe(d1.manifest.hash);
    expect([d0.manifest.run, d1.manifest.run]).toEqual([0, 1]);
  });
  it('the manifest names the numerical engine version', () => {
    expect(runModel(training).manifest.engineVersion).toBe('core-0.3.0');
  });
});

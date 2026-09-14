/**
 * data/core/gasteiger-prettner-2020.json — generality test: a published model chosen by an
 * independent reviewer and ported through model data only (no evaluator or chart changes).
 *
 * fixtures.test.ts already checks that the model and its two overlays run and pass their own
 * `tests`. The in-file tests can only locate optima on the model's coarse entity grid (the engine
 * has no argmax), so this file re-runs the SAME model file on fine tau grids — by rewriting the
 * entity list and the tau/isBaseline byEntity maps, never an equation — and states:
 *
 *   1. The welfare-maximising robot tax for mu = 0.5, 0.4, 0.6 against the published 0.55, 0.57,
 *      0.54 (p.24), tolerance ±0.01, plus their ordering.
 *   2. Figure 4/5 turning points (CV zero crossing, output / revenue / c1 peaks) on a fine grid.
 *   3. The one published reading this port misses at the reviewer's tolerance (Fig. 3(a)), recorded
 *      as a pinned discrepancy rather than hidden by a wider tolerance.
 *   4. The qualitative transition shape (Section 4.3 of the reviewer memo).
 *   5. Capability probes: small synthetic models that pin the engine behaviours this port had to
 *      work around (docs/design/capability-requests/gasteiger-prettner.md). If one of these starts
 *      failing, the engine has changed and the capability request should be revisited.
 */
import { describe, expect, it } from 'vitest';

import gpModel from '../../data/core/gasteiger-prettner-2020.json';
import gpMu04 from '../../data/core/overlays/gasteiger-prettner-mu04.json';
import gpMu06 from '../../data/core/overlays/gasteiger-prettner-mu06.json';
import { runModel } from './engine';
import type { CoreModel, Overlay, RunResult } from './types';
import { validateCoreModel } from './validate';

const model = gpModel as unknown as CoreModel;
const mu04 = gpMu04 as unknown as Overlay;
const mu06 = gpMu06 as unknown as Overlay;

const round = (x: number) => Math.round(x * 1e6) / 1e6;

/** The same model file with a different tau grid. Only entity ids and byEntity maps change. */
function onGrid(taus: number[]): { m: CoreModel; ids: string[] } {
  const all = [0, ...taus.filter((x) => x !== 0)].map(round);
  const ids = all.map((x) => `tau=${x}`);
  const m: CoreModel = JSON.parse(JSON.stringify(model));
  m.entities = { ...m.entities!, ids };
  m.tests = [];
  for (const p of m.parameters) {
    if (p.id === 'tau') p.byEntity = Object.fromEntries(all.map((x, i) => [ids[i], x]));
    if (p.id === 'isBaseline') p.byEntity = { [ids[0]]: 1 };
  }
  return { m, ids };
}

function range(lo: number, hi: number, step: number): number[] {
  const out: number[] = [];
  for (let i = 0; lo + i * step <= hi + 1e-12; i++) out.push(round(lo + i * step));
  return out;
}

interface Point { tau: number; [k: string]: number }

/** Steady-state (last step) values per grid point, baseline excluded unless tau = 0 is on the grid. */
function steady(r: RunResult, taus: number[], keys: string[]): Point[] {
  expect(r.ok, r.diagnostics.map((d) => d.message).join('; ')).toBe(true);
  const T = r.years.length - 1;
  return taus.map((tau) => {
    const e = `tau=${round(tau)}`;
    const pt: Point = { tau };
    for (const k of keys) pt[k] = r.series[e][k][T];
    for (const rec of Object.values(r.solves)) expect(rec[e].status).toBe('ok');
    return pt;
  });
}

const argBest = (pts: Point[], key: string, dir: 'min' | 'max') =>
  pts.reduce((best, p) => ((dir === 'min' ? p[key] < best[key] : p[key] > best[key]) ? p : best)).tau;

describe('gasteiger-prettner-2020: welfare-maximising robot tax on a 0.001 grid (p.24)', () => {
  const taus = range(0.5, 0.62, 0.001);
  // `measured` = this port's values, recorded so a drift is visible. "Welfare-maximising" is read as
  // the tau with the highest steady-state lifetime utility (p.24 "tau = 0.55 maximizes welfare").
  // Minimising the Figure 5 CV shares is NOT exactly the same criterion (c1, c2 and y all move with
  // tau), and at mu = 0.4 the CV1-share minimiser sits 0.011 from the published 0.57.
  const cases: Array<{ label: string; overlays: Overlay[]; published: number; measured: { u: number; cv1: number; cv2: number } }> = [
    { label: 'mu = 0.5 (baseline)', overlays: [], published: 0.55, measured: { u: 0.553, cv1: 0.554, cv2: 0.552 } },
    { label: 'mu = 0.4', overlays: [mu04], published: 0.57, measured: { u: 0.579, cv1: 0.581, cv2: 0.575 } },
    { label: 'mu = 0.6', overlays: [mu06], published: 0.54, measured: { u: 0.546, cv1: 0.546, cv2: 0.546 } },
  ];
  const found: Record<string, number> = {};

  for (const c of cases) {
    it(`${c.label}: utility-maximising tau* within 0.01 of the published ${c.published}; CV minimisers within 0.005 of it`, () => {
      const { m } = onGrid(taus);
      const r = runModel(m, { overlays: c.overlays });
      const pts = steady(r, taus, ['utility_prev', 'cv1_pct', 'cv2_pct']);
      const tu = argBest(pts, 'utility_prev', 'max');
      const t1 = argBest(pts, 'cv1_pct', 'min');
      const t2 = argBest(pts, 'cv2_pct', 'min');
      found[c.label] = tu;
      expect(Math.abs(tu - c.published)).toBeLessThanOrEqual(0.01 + 1e-9);
      expect(Math.abs(t1 - tu)).toBeLessThanOrEqual(0.005);
      expect(Math.abs(t2 - tu)).toBeLessThanOrEqual(0.005);
      expect({ u: tu, cv1: t1, cv2: t2 }).toEqual(c.measured);
      // Interior optimum: both ends of the fine grid are worse.
      const best = Math.max(...pts.map((p) => p.utility_prev));
      expect(pts[0].utility_prev).toBeLessThan(best);
      expect(pts[pts.length - 1].utility_prev).toBeLessThan(best);
    }, 30_000);
  }

  it('ordering from p.24: tau*(mu 0.4) > tau*(mu 0.5) > tau*(mu 0.6)', () => {
    // Relies on the three cases above having run first (vitest runs a file's tests in order).
    expect(found['mu = 0.4']).toBeGreaterThan(found['mu = 0.5 (baseline)']);
    expect(found['mu = 0.5 (baseline)']).toBeGreaterThan(found['mu = 0.6']);
  });
});

describe('gasteiger-prettner-2020: Figure 4 and 5 turning points on fine grids', () => {
  const taus = [...range(0.8, 1.6, 0.005), ...range(2.3, 2.6, 0.005)];
  let pts: Point[] = [];

  it('runs', () => {
    const { m } = onGrid(taus);
    pts = steady(runModel(m), taus, ['cv1_pct', 'cv2_pct', 'y', 'transfer', 'c1_prev']);
  }, 30_000);

  const crossing = (key: string) => {
    const seg = pts.filter((p) => p.tau >= 2.3);
    for (let i = 1; i < seg.length; i++) {
      const a = seg[i - 1];
      const b = seg[i];
      if (a[key] < 0 && b[key] >= 0) return a.tau + ((b.tau - a.tau) * -a[key]) / (b[key] - a[key]);
    }
    return NaN;
  };

  it('Fig. 5: CV1 and CV2 cross zero at tau ≈ 2.4-2.5 (± 0.15); both at the same tau', () => {
    const x1 = crossing('cv1_pct');
    const x2 = crossing('cv2_pct');
    // Measured: 2.46 for both.
    expect(x1).toBeGreaterThan(2.4 - 0.15);
    expect(x1).toBeLessThan(2.5 + 0.15);
    expect(Math.abs(x1 - x2)).toBeLessThan(0.005);
  });

  it('Fig. 4(a): steady-state p falls monotonically in tau over the model grid [0, 4] (min(p) is not expressible in-file)', () => {
    const r = runModel(model);
    const T = r.years.length - 1;
    const ps = model.entities!.ids.map((e) => r.series[e].p[T]);
    expect(ps.every((x, i) => i === 0 || x < ps[i - 1])).toBe(true);
  });

  it('Fig. 4(c): output peaks at tau ≈ 1.2 ± 0.15', () => {
    const peak = argBest(pts.filter((p) => p.tau <= 1.6), 'y', 'max');
    expect(Math.abs(peak - 1.2)).toBeLessThanOrEqual(0.15); // measured 1.185
  });

  it('Fig. 4(f): robot-tax revenue peaks at tau ≈ 1.0 ± 0.15', () => {
    const peak = argBest(pts.filter((p) => p.tau <= 1.6), 'transfer', 'max');
    expect(Math.abs(peak - 1.0)).toBeLessThanOrEqual(0.15); // measured 1.005
  });

  it('Fig. 4(h): c1 peaks at tau ≈ 1.3 ± 0.2', () => {
    const peak = argBest(pts.filter((p) => p.tau <= 1.6), 'c1_prev', 'max');
    expect(Math.abs(peak - 1.3)).toBeLessThanOrEqual(0.2); // measured 1.365
  });
});

describe('gasteiger-prettner-2020: published readings this port does not match', () => {
  it('Fig. 3(a) p.21: p×100 at tau = 0.5 is 0.01143, 3.9% above the 0.011 reading (reviewer tolerance ±3%)', () => {
    // The reviewer memo reads the Fig. 3(a) plateau as 0.011 and allows ±3%, but its own independent
    // recomputation gives 0.0114, which is outside that tolerance too. The axis ticks are 0.025 apart,
    // so a two-digit reading carries more than 3% of reading error. Not tuned away: pinned here so a
    // change in either direction is noticed.
    const r = runModel(model);
    const v = r.series['tau=0.5'].p[r.years.length - 1] * 100;
    const miss = v / 0.011 - 1;
    expect(miss).toBeGreaterThan(0.03);
    expect(miss).toBeLessThan(0.045);
  });
});

describe('gasteiger-prettner-2020: transition shape (qualitative only)', () => {
  const r = runModel(model);
  const T = r.years.length - 1;

  for (const e of ['tau=0.0', 'tau=0.5', 'tau=4.0']) {
    it(`${e}: from an income below the steady state, k, p, w, y rise and R falls monotonically`, () => {
      expect(r.ok).toBe(true);
      const s = r.series[e];
      const mono = (xs: number[], dir: 1 | -1) => xs.every((x, i) => i === 0 || dir * (x - xs[i - 1]) >= -1e-12 * Math.abs(x));
      for (const k of ['k', 'p', 'w', 'y']) expect(mono(s[k], 1), k).toBe(true);
      expect(mono(s.R, -1), 'R').toBe(true);
      expect(Math.abs(s.k[8] - s.k[T]) / s.k[T]).toBeLessThan(0.01);
      // Converged by the last step: the final two generations agree to 1e-9.
      expect(Math.abs(s.k[T] - s.k[T - 1]) / s.k[T]).toBeLessThan(1e-9);
    });
  }
});

describe('capability probes (engine behaviour this port works around)', () => {
  const src = { label: 'probe', kind: 'guess' as const };
  const tiny = (extra: Partial<CoreModel>): CoreModel => ({
    schemaVersion: 1,
    id: 'probe',
    name: 'probe',
    time: { start: 0, end: 3, step: 'year' },
    parameters: [{ id: 'a', value: 2, source: src }],
    variables: [{ id: 'x', equation: 'a * u' }],
    outputs: ['x'],
    ...extra,
  });

  it('a solve residual cannot read a variable that depends on the unknown (same-step cycle)', () => {
    const r = runModel(tiny({ solves: [{ id: 's', unknown: 'u', residual: 'x - 4', bracket: [0, 10] }] }));
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => d.code === 'cycle')).toBe(true);
  });

  it('an effect on a variable downstream of the unknown is applied after the solve, and now says so (effect-after-solve)', () => {
    // Found by this port (gap 2); closed after the port by SolveBlock.through (engine.test.ts). The
    // port itself was built on the frozen engine and does not use through.
    const r = runModel(tiny({
      effects: [{ id: 'double', target: 'x', op: 'multiply', expr: '2', source: src }],
      solves: [{ id: 's', unknown: 'u', residual: 'a * u - 4', bracket: [0, 10], tol: 1e-12 }],
    }));
    expect(r.ok).toBe(true);
    expect(r.diagnostics.map((d) => d.code)).toEqual(['effect-after-solve']);
    expect(r.series._.u[0]).toBeCloseTo(2, 9); // the solve used x = a u = 4
    expect(r.series._.x[0]).toBeCloseTo(8, 8); // x is reported with the effect applied
  });

  it('with through: the effect enters the equilibrium', () => {
    const r = runModel(tiny({
      effects: [{ id: 'double', target: 'x', op: 'multiply', expr: '2', source: src }],
      solves: [{ id: 's', unknown: 'u', residual: 'x - 4', through: ['x'], bracket: [0, 10], tol: 1e-12 }],
    }));
    expect(r.ok).toBe(true);
    expect(r.diagnostics).toEqual([]);
    expect(r.series._.u[0]).toBeCloseTo(1, 9); // 2 * (a u) = 4 with a = 2
    expect(r.series._.x[0]).toBeCloseTo(4, 9);
  });

  it('lags in a residual and history on a non-stock variable both work', () => {
    const r = runModel(tiny({
      variables: [{ id: 'x', equation: 'a * u', history: [3] }],
      solves: [{ id: 's', unknown: 'u', residual: 'u - x[t-1] - 1', bracket: [0, 1000], tol: 1e-12 }],
    }));
    expect(r.ok).toBe(true);
    expect(r.series._.u[0]).toBeCloseTo(4, 8);
    expect(r.series._.u[1]).toBeCloseTo(9, 8);
  });

  it('an aggregate cannot range over a solve unknown (only variables and inputs)', () => {
    const r = runModel(tiny({
      solves: [{ id: 's', unknown: 'u', residual: 'u - 1', bracket: [0, 10] }],
      tests: [{ name: 'min over unknown', at: 3, expr: 'min(u)', expected: 1, tol: 1e-6 }],
    }));
    expect(r.diagnostics.some((d) => d.code === 'unknown-symbol' && d.message.includes('aggregate over unknown "u"'))).toBe(true);
  });

  it('entity roles are not an expression symbol (no way to name the baseline entity)', () => {
    const r = runModel(tiny({
      entities: { kind: 'k', ids: ['base', 'other'], roles: { baseline: 'base' } },
      variables: [{ id: 'x', equation: 'a' }, { id: 'y', equation: 'baseline' }],
      outputs: ['x', 'y'],
    }));
    expect(r.diagnostics.some((d) => d.code === 'unknown-symbol' && d.message.includes('"baseline"'))).toBe(true);
  });

  it('a generation-length step is rejected by the validator schema (only year | month)', () => {
    const m = tiny({ solves: [{ id: 's', unknown: 'u', residual: 'u - 1', bracket: [0, 10] }] }) as unknown as Record<string, unknown>;
    m.time = { start: 0, end: 3, step: 'generation' };
    const v = validateCoreModel(m);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes('/time/step'))).toBe(true);
  });
});

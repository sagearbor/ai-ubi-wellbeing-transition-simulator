import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fit, originAt, predict, transitions, solve, scoreInternal, summarizeErrors, validate, LAMBDAS } from './model.mjs';

function fixture(): any {
  const countries = Array.from({ length: 8 }, (_, i) => ({ id: `X${i}`, name: `Country ${i}`, governance: .3 + .05 * i,
    gini: { year: 2015, value: 25 + i * 3 }, population: { year: 2015, value: 100000 },
    ge: { year: 2015, value: 0 }, rl: { year: 2015, value: 0 }, cc: { year: 2015, value: 0 } }));
  const ladder: any = {}, gdp: any = {};
  for (const [i, c] of countries.entries()) {
    ladder[c.id] = {}; gdp[c.id] = {};
    for (let y = 2015; y <= 2018; y++) {
      ladder[c.id][y] = 4 + i * .2 + (y - 2015) * (.03 + .01 * i);
      gdp[c.id][y] = (1000 + 300 * i) * Math.exp((y - 2015) * (.01 + .002 * i));
    }
  }
  return { countries, ladder, gdp, years: [2015, 2016, 2017, 2018], excluded: [] };
}
const historical = (name: string) => JSON.parse(fs.readFileSync(fileURLToPath(new URL(`../../../../data/evaluation/level-holdout-2018/${name}.json`, import.meta.url)), 'utf8'));

describe('registered changes model: train-only integrity', () => {
  it('solves a known positive definite system', () => {
    const result = solve([[4, 1], [1, 3]], [9, 7]);
    expect(result[0]).toBeCloseTo(20 / 11, 12); expect(result[1]).toBeCloseTo(19 / 11, 12);
  });
  it('penalizes the intercept and handles zero variance features without singularity', () => {
    const t = fixture();
    for (const c of t.countries) {
      c.governance = .5; c.gini.value = 40;
      for (let y = 2015; y <= 2018; y++) { t.gdp[c.id][y] = 1000; t.ladder[c.id][y] = 4 + .2 * (y - 2015); }
    }
    const f = fit(t, 2018, 1);
    expect(f.coefficients[0]).toBeCloseTo(.1, 12);
    f.coefficients.slice(1).forEach(b => expect(b).toBeCloseTo(0, 12));
    expect(f.normalizer.zeroVarianceColumns).toHaveLength(4);
  });
  it('cannot use later-year GDP, ladder, imputation, or normalization in an earlier fold', () => {
    const t = fixture(), changed = structuredClone(t);
    for (const c of changed.countries) for (const y of [2017, 2018, 2019, 2025]) {
      changed.ladder[c.id][y] = 0; changed.gdp[c.id][y] = 1e10;
    }
    const originalFit = fit(t, 2016, .1), changedFit = fit(changed, 2016, .1);
    expect(changedFit).toEqual(originalFit);
    const first = predict(originAt(t, 2016), originalFit, 2);
    const second = predict(originAt(changed, 2016), changedFit, 2);
    expect(second).toEqual(first);
    // Targets may change scores, but cannot become prediction covariates.
    expect(scoreInternal(first.rows, changed)).not.toEqual(scoreInternal(first.rows, t));
  });
  it('fits the 2017 fold independently of 2018, even with missing historical features', () => {
    const t = fixture(); t.countries[0].governance = null; t.countries[0].gini.value = null;
    const changed = structuredClone(t); changed.gdp.X1[2018] = 1e15; changed.ladder.X1[2018] = 10;
    const f = fit(t, 2017, 10);
    expect(fit(changed, 2017, 10)).toEqual(f);
    expect(f.normalizer.imputed.slice(2)).toEqual([2, 2]);
    expect(predict(originAt(t, 2017), f, 1).rows).toHaveLength(8);
  });
  it('never bridges missing years and retains a country lacking historical transitions', () => {
    const t = fixture(); delete t.ladder.X0[2016]; delete t.gdp.X0[2016];
    t.gdp.X1 = { 2018: 2000 }; t.ladder.X1 = { 2018: 5 };
    const tr = transitions(t, 2018);
    expect(tr.ladder.filter(r => r.id === 'X0').map(r => r.year)).toEqual([2018]);
    const f = fit(t, 2018, 1), p = predict(originAt(t, 2018), f, 7);
    expect(f.gdp.rates.X1.count).toBe(0);
    expect(f.gdp.rates.X1.rate).toBeCloseTo(f.gdp.pooledGrowth, 12);
    expect(p.rows.filter(r => r.id === 'X1')).toHaveLength(7);
    expect(p.diagnostics.gdpFallbacks).toContain('X1');
  });
  it('uses zero-growth and zero-change when there are no historical transitions', () => {
    const t = fixture();
    for (const c of t.countries) { t.ladder[c.id] = { 2018: 5 }; t.gdp[c.id] = { 2018: 2000 }; c.governance = null; c.gini.value = null; }
    const f = fit(t, 2018, 100), p = predict(originAt(t, 2018), f, 7);
    expect(f.emptyLadderFallback).toBe(true); expect(f.emptyGdpFallback).toBe(true);
    expect(p.rows.every(r => r.gdp === 2000 && r.ladder === 5)).toBe(true);
    expect(f.normalizer.medians.slice(2)).toEqual([.5, .5]);
  });
  it('reports fixed GDP and recursive ladder clamps explicitly', () => {
    const t = fixture();
    for (const c of t.countries) for (let y = 2015; y <= 2018; y++) t.gdp[c.id][y] = 1000 * Math.exp((y - 2015) * .5);
    const f = fit(t, 2018, 1);
    expect(f.gdp.growthClamps).toHaveLength(8);
    Object.values(f.gdp.rates).forEach((r: any) => expect(r.rate).toBe(.1));
    f.coefficients = [20, 0, 0, 0, 0];
    const p = predict(originAt(t, 2018), f, 7);
    expect(p.diagnostics.ladderClamps).toHaveLength(56);
    expect(p.rows.every(r => r.ladder === 10 && r.gdp > 0)).toBe(true);
  });
  it('forecasts with independently shrunk GDP rates and recursively updated starting income', () => {
    const t = fixture(), f = fit(t, 2018, 1), o = originAt(t, 2018);
    const expectedPool = .017;
    expect(f.gdp.pooledGrowth).toBeCloseTo(expectedPool, 12);
    expect(f.gdp.rates.X0.rate).toBeCloseTo((3 * .01 + 2 * expectedPool) / 5, 12);
    // Replace the learned coefficients with a known equation to verify recurrence itself.
    f.normalizer.means = [0, 0, 0, 0]; f.normalizer.scales = [1, 1, 1, 1];
    f.coefficients = [.01, .2, .001, 0, 0];
    const p = predict(o, f, 2), c = o.countries[0], rate = f.gdp.rates.X0.rate;
    const h1 = p.rows.find(r => r.id === c.id && r.horizon === 1)!;
    const h2 = p.rows.find(r => r.id === c.id && r.horizon === 2)!;
    const d1 = .01 + .2 * rate + .001 * Math.log(c.gdp);
    expect(h1.ladder).toBeCloseTo(c.ladder + d1, 12);
    expect(h2.ladder).toBeCloseTo(c.ladder + 2 * d1 + .001 * rate, 12);
    expect(h2.gdp).toBeCloseTo(c.gdp * Math.exp(2 * rate), 10);
  });
  it('rejects future-dated background and invalid origins', () => {
    const t = fixture(); t.countries[0].gini.year = 2019;
    expect(() => fit(t, 2018, 1)).toThrow('Future/out-of-window');
    const clean = fixture(), f = fit(clean, 2018, 1), o = originAt(clean, 2018);
    o.countries[0].gdp = -1;
    expect(() => predict(o, f, 7)).toThrow('Invalid origin');
    expect(() => fit(clean, 2018, .2)).toThrow('Unregistered');
  });
  it('scores missing targets with identical model and persistence masks', () => {
    const t = fixture(), f = fit(t, 2016, .1), p = predict(originAt(t, 2016), f, 2);
    delete t.ladder.X0[2017]; delete t.gdp.X1[2018];
    const scored = scoreInternal(p.rows, t), metrics: any = summarizeErrors(scored.errors);
    expect(metrics.ladder.model.n).toBe(15); expect(metrics.ladder.persistence.n).toBe(15);
    expect(metrics.gdp.model.n).toBe(15); expect(metrics.gdp.persistence.n).toBe(15);
    expect(scored.missingTargets).toHaveLength(2);
    expect(() => scoreInternal([{ ...p.rows[0], year: 2019 }], t)).toThrow('Only 2017/2018');
  });
  it('uses the declared grid and favors strongest penalty on ties', () => {
    const t = fixture();
    for (const c of t.countries) for (let y = 2015; y <= 2018; y++) t.ladder[c.id][y] = 5;
    const v = validate(t);
    expect(v.candidates.map(c => c.lambda)).toEqual(LAMBDAS); expect(v.selection.lambda).toBe(100);
    expect(v.candidates[0].folds.map(f => [f.originYear, f.validationYears])).toEqual([[2016, [2017, 2018]], [2017, [2018]]]);
  });
  it('creates exactly 700 deterministic historical-input forecasts with original row shape', () => {
    const t = historical('train'), o = historical('origin');
    const v = validate(t), f = fit(t, 2018, v.selection.lambda), p = predict(o, f, 7);
    expect(t.countries).toHaveLength(101); expect(o.countries).toHaveLength(100); expect(o.excluded).toHaveLength(28);
    expect(p.rows).toHaveLength(700); expect(new Set(p.rows.map(r => `${r.id}/${r.year}`)).size).toBe(700);
    expect(predict(o, fit(t, 2018, validate(t).selection.lambda), 7)).toEqual(p);
    for (const r of p.rows) {
      expect(Object.keys(r)).toEqual(['id', 'name', 'year', 'horizon', 'ladder', 'gdp', 'originLadder', 'originGdp']);
      expect(r.ladder).toBeGreaterThanOrEqual(0); expect(r.ladder).toBeLessThanOrEqual(10);
      expect(Number.isFinite(r.gdp) && r.gdp > 0).toBe(true); expect(r.year).toBe(2018 + r.horizon);
    }
  });
});

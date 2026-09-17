import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fitOffsetDecay, predictOffset } from './model';

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const frozen = 'data/evaluation/level-holdout-2018/';
const here = 'data/evaluation/offset-2018/';
const train = read(frozen + 'train.json');
const origin = read(frozen + 'origin.json');
const coefficients = read(frozen + 'frozen-fit.json').coefficients;
const fit = read(here + 'fit.json');

describe('country-offset holdout variant (registered protocol level-country-offset-2018-v1)', () => {
  it('reproduces the recorded decay from training transitions alone', () => {
    const again = fitOffsetDecay(train, coefficients);
    expect(again.rho).toBeCloseTo(fit.decay.rho, 12);
    expect(again.rho).toBeGreaterThan(0);
    expect(again.rho).toBeLessThanOrEqual(1);
    expect(again.byLag.map((l: { lag: number }) => l.lag)).toEqual([1, 2, 3]);
  });

  it('reproduces every stored prediction for both declared variants', () => {
    for (const variant of ['fitted', 'retained'] as const) {
      const stored = read(`${here}predictions-${variant}.json`);
      const rebuilt = predictOffset(origin, coefficients, stored.rho);
      expect(rebuilt.length).toBe(stored.predictions.length);
      let worst = 0;
      rebuilt.forEach((r, i) => {
        const s = stored.predictions[i];
        expect([r.id, r.year, r.horizon]).toEqual([s.id, s.year, s.horizon]);
        worst = Math.max(worst, Math.abs(r.ladder - s.ladder), Math.abs(r.gdp - s.gdp));
      });
      expect(worst).toBeLessThan(1e-9);
    }
  });

  it('refuses training data that is not the registered window, and invalid decay or origin', () => {
    expect(() => fitOffsetDecay({ ...train, years: [2015, 2016, 2017] }, coefficients)).toThrow(/Training years/);
    expect(() => predictOffset(origin, coefficients, 1.2)).toThrow(/Invalid decay/);
    expect(() => predictOffset({ ...origin, originYear: 2019 }, coefficients, 0.9)).toThrow(/Origin year/);
  });

  it('keeps the published entry untouched: GDP predictions are identical to the frozen run', () => {
    const published = read(frozen + 'predictions.json');
    const rows = published.rows;
    const mine = predictOffset(origin, coefficients, fit.decay.rho);
    const byKey = new Map(mine.map((r) => [`${r.id}/${r.year}`, r]));
    let worst = 0;
    for (const p of rows) {
      const m = byKey.get(`${p.id}/${p.year}`);
      if (m) worst = Math.max(worst, Math.abs(m.gdp - p.gdp));
    }
    expect(worst).toBeLessThan(1e-6);
  });
});

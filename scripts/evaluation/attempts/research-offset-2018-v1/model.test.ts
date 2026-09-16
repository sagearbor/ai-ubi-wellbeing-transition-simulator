import { describe, expect, it } from 'vitest';
import { fitTraining, foldOrigin, forecast, internalValidation, trainingThrough, validateTraining,
  type Setting, type Training } from './model';

function synthetic(): Training {
  const countries = [
    { id: 'AAA', name: 'Alpha', governance: .1 }, { id: 'BBB', name: 'Beta', governance: .7 },
    { id: 'CCC', name: 'Gamma', governance: .3 }, { id: 'DDD', name: 'Delta', governance: .9 }
  ];
  const train: Training = { countries, years: [2015, 2016, 2017, 2018], ladder: {}, gdp: {} };
  countries.forEach((c, i) => {
    train.ladder[c.id] = {}; train.gdp[c.id] = {};
    for (const year of train.years) {
      const growth = (year - 2015) * (.01 + .005 * i);
      train.gdp[c.id][year] = (1000 + 1800 * i) * Math.exp(growth);
      train.ladder[c.id][year] = 3 + i * .6 + 2 * growth;
    }
  });
  return train;
}
const retained: Setting = { gdpMode: 'local', offsetWeight: 1, annualAdjustment: 1 };

describe('registered offset forecast', () => {
  it('recovers a within-country change slope independently of stable country intercepts', () => {
    const train = synthetic(), before = fitTraining(train);
    for (const year of train.years) train.ladder.BBB[year] += .7;
    const after = fitTraining(train);
    expect(before.coefficients.withinLnGdp).toBeCloseTo(2, 10);
    expect(after.coefficients.withinLnGdp).toBeCloseTo(2, 10);
    expect(after.coefficients.lnGdp).not.toBeCloseTo(before.coefficients.lnGdp, 5);
  });

  it('zero adjustment gives exact ladder persistence regardless of the anchor', () => {
    const train = synthetic(), origin = foldOrigin(train, 2018), fit = fitTraining(train);
    const result = forecast(origin, fit, { ...retained, offsetWeight: 0, annualAdjustment: 0 }, 7);
    expect(result.rows).toHaveLength(28);
    for (const row of result.rows) expect(row.ladder).toBe(row.originLadder);
    expect(result.diagnostics.ladderHighCaps + result.diagnostics.ladderLowCaps).toBe(0);
  });

  it('full offset retention removes an arbitrary static anchor error', () => {
    const train = synthetic(), fit = fitTraining(train), origin = foldOrigin(train, 2018);
    const original = forecast(origin, fit, retained, 7);
    const shifted = structuredClone(fit);
    shifted.coefficients.intercept += 7;
    const after = forecast(origin, shifted, retained, 7);
    original.rows.forEach((row, i) => expect(after.rows[i].ladder).toBeCloseTo(row.ladder, 12));
  });

  it('uses damped forecast GDP, and never a later observed GDP, for ladder change', () => {
    const train = synthetic(), sliced = trainingThrough(train, 2016), fit = fitTraining(sliced), origin = foldOrigin(sliced, 2016);
    const first = forecast(origin, fit, retained, 2);
    for (const id of Object.keys(train.gdp)) { train.gdp[id][2018] *= 100; train.ladder[id][2018] = 9; }
    const other = trainingThrough(train, 2016);
    expect(fitTraining(other)).toEqual(fit);
    expect(forecast(foldOrigin(other, 2016), fitTraining(other), retained, 2)).toEqual(first);
    expect(first.rows.find(r => r.id === 'AAA' && r.horizon === 2)!.gdp / origin.countries[0].gdp)
      .toBeCloseTo(Math.exp(.01 * 1.9), 12);
  });

  it('rejects future-dated data and a fit after the forecast origin', () => {
    const train = synthetic(); train.gdp.AAA[2019] = 1234;
    expect(() => validateTraining(train)).toThrow(/future/);
    const clean = synthetic(), fit = fitTraining(clean);
    expect(() => forecast(foldOrigin(trainingThrough(clean, 2016), 2016), fit, retained, 2)).toThrow(/Future fit/);
  });

  it('rejects future-dated historical background', () => {
    const train = synthetic(); train.countries[0].ge = { year: 2020, value: .1 };
    expect(() => validateTraining(train)).toThrow(/future historical background/);
  });

  it('counts all rate and ladder range interventions', () => {
    const train = synthetic(), fit = fitTraining(train), origin = foldOrigin(train, 2018);
    for (const id of Object.keys(fit.localRates)) fit.localRates[id] = .2;
    fit.coefficients.intercept = 100; fit.coefficients.lnGdp = 0; fit.coefficients.governance = 0;
    const high = forecast(origin, fit, { ...retained, offsetWeight: 0 }, 7);
    expect(high.diagnostics.rateCaps).toBe(4);
    expect(high.diagnostics.ladderHighCaps).toBe(28);
    expect(high.rows.every(r => r.ladder === 10 && r.gdp > 0 && Number.isFinite(r.gdp))).toBe(true);
    fit.coefficients.intercept = -100;
    expect(forecast(origin, fit, { ...retained, offsetWeight: 0 }, 7).diagnostics.ladderLowCaps).toBe(28);
  });

  it('uses pooled fallback for a country with no adjacent training pairs', () => {
    const train = synthetic(); delete train.ladder.AAA[2016]; delete train.gdp.AAA[2016];
    delete train.ladder.AAA[2017]; delete train.gdp.AAA[2017];
    const fit = fitTraining(train), result = forecast(foldOrigin(train, 2018), fit, retained, 7);
    expect(fit.localRates.AAA).toBeNull();
    expect(result.rates.AAA).toEqual({ raw: fit.pooledRate, used: fit.pooledRate, localFallback: true });
    expect(result.rows.filter(r => r.id === 'AAA')).toHaveLength(7);
  });

  it('records a singular anchor fallback and zero within-variation fallback', () => {
    const train = synthetic();
    for (const c of train.countries) for (const year of train.years) { c.governance = .5; train.gdp[c.id][year] = 1000; }
    const fit = fitTraining(train);
    expect(fit.pooledAnchorFallback).toBe(true); expect(fit.withinSlopeFallback).toBe(true);
    expect(fit.coefficients.withinLnGdp).toBe(0);
  });

  it('publishes all registered candidates and overlapping temporal-fold denominators', () => {
    const result = internalValidation(synthetic());
    expect(result.gdpCandidates).toHaveLength(4); expect(result.ladderCandidates).toHaveLength(12);
    expect(result.folds.map(f => f.trainingYears)).toEqual([[2015, 2016], [2015, 2016, 2017]]);
    for (const row of result.ladderCandidates) expect(row.byHorizon.map(h => h.n)).toEqual([8, 4]);
    expect(result.folds.flatMap(f => f.matchedLadder).every(r => r.year <= 2018)).toBe(true);
  });

  it('tie-breaking retains origin offset and persistence when every candidate ties', () => {
    const train = synthetic();
    for (const c of train.countries) for (const year of train.years) { train.gdp[c.id][year] = 1000; train.ladder[c.id][year] = 5; }
    expect(internalValidation(train).selectedSetting).toEqual({ gdpMode: 'persistence', offsetWeight: 1, annualAdjustment: 0 });
  });
});

/**
 * Review 2026-09-14, finding 13: the map's Dividend stat divided billions of USD by
 * population_in_millions x 10 (10,000x too small). The row now reads headlineStats, which uses
 * the engine's own conversion.
 */
import { describe, it, expect } from 'vitest';
import { formatBillionsUsd, formatUsdPerPerson, usdPerPerson } from './units';
import { headlineStats, WORLD_POPULATION_MILLIONS } from './appState';
import { initialRun, runMonths } from './run';
import { INITIAL_COUNTRIES, PRESET_MODELS } from '../constants';

describe('unit conversion shared by engine and UI', () => {
  it('billions of USD over millions of people is thousands of USD per person', () => {
    expect(usdPerPerson(1, 1)).toBe(1000);
    expect(usdPerPerson(0.331, 331)).toBeCloseTo(1, 12);
    expect(usdPerPerson(5, 0)).toBe(0);
  });

  it('formats billions and per-person amounts with their units', () => {
    expect(formatBillionsUsd(2.2795)).toBe('$2.28B');
    expect(formatBillionsUsd(0.41)).toBe('$410M');
    expect(formatBillionsUsd(1500)).toBe('$1.50T');
    expect(formatBillionsUsd(0)).toBe('$0');
    expect(formatUsdPerPerson(0.3204)).toBe('$0.32');
    expect(formatUsdPerPerson(42.4)).toBe('$42');
  });
});

describe('map headline stats (finding 13)', () => {
  const run = runMonths(initialRun(), 6, { model: PRESET_MODELS[0] })[6];
  const stats = headlineStats(run.state);

  it('the displayed dividend equals the ledger per-capita amount the engine paid', () => {
    expect(run.ledger.totalFunds).toBeGreaterThan(0);
    // ledger.fundsPerCapita is billions per million people; x1000 = USD per person.
    expect(stats.globalDividendUsd).toBe(run.ledger.fundsPerCapita * 1000);
    // ...and what a country actually received per person from the global pool.
    const usa = run.state.countryData.USA;
    expect(stats.globalDividendUsd).toBeCloseTo(usdPerPerson(usa.ubiReceivedGlobal, usa.population), 9);
    // The old formula's value is 10,000 times smaller.
    const old = run.state.globalFund / (WORLD_POPULATION_MILLIONS * 10);
    expect(stats.globalDividendUsd / old).toBeCloseTo(10000, 6);
  });

  it('the pool is this month\'s global contributions, and wellbeing/adoption are unweighted country means', () => {
    expect(stats.globalPoolBillions).toBe(run.ledger.totalFunds);
    const countries = Object.values(run.state.countryData);
    expect(countries.length).toBe(INITIAL_COUNTRIES.length);
    const mean = countries.reduce((a, c) => a + c.wellbeing, 0) / countries.length;
    expect(stats.meanCountryWellbeing).toBeCloseTo(mean, 9);
    expect(stats.meanCountryAdoption).toBeCloseTo(countries.reduce((a, c) => a + c.aiAdoption, 0) / countries.length, 12);
    // Not accumulated: the next month's pool is not this month's plus new contributions.
    const next = runMonths(run, 1, { model: PRESET_MODELS[0] })[1];
    expect(next.state.globalFund).toBe(next.ledger.totalFunds);
    expect(next.state.globalFund).toBeLessThan(run.state.globalFund + next.ledger.monthlyInflow);
  });
});

describe('global displacement gap units', () => {
  it('is USD/person/month x millions of people, i.e. millions of USD; the display shows billions', async () => {
    const { millionsToBillionsUsd } = await import('./units');
    const anchored = PRESET_MODELS[0];
    const runs = runMonths(initialRun(), 60, { model: anchored });
    const s = runs[runs.length - 1].state;
    const manual = Object.values(s.countryData).reduce((a, c) => a + (c.displacementGap ?? 0) * c.population, 0);
    expect(s.globalDisplacementGap).toBeCloseTo(manual, 6);
    // e.g. a 1 USD/person/month gap over 1,000 million people is 1,000 million = 1 billion USD.
    expect(millionsToBillionsUsd(1 * 1000)).toBe(1);
    expect(formatBillionsUsd(millionsToBillionsUsd(s.globalDisplacementGap))).not.toBe('$0');
  });
});

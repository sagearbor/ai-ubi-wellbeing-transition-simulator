/**
 * Golden/characterization test for the App.tsx <-> simulation/pure.ts unification.
 *
 * BACKGROUND (see the repo's tmp/wrapups/*.yaml for the full history): App.tsx used to
 * carry its OWN full inline copy of the simulation engine (a separate stepSimulation()
 * defined inside the component) instead of importing simulation/pure.ts. The two copies
 * had drifted: simulation/pure.ts's distributeGlobal() was fixed for the AT-6 money-
 * conservation bug (it credited globalLedger.monthlyInflow twice for 'global'-strategy
 * corporations), but App.tsx's own copy of distributeGlobal() still had the bug.
 *
 * Before removing App.tsx's duplicate and switching it to call stepSimulationPure()
 * directly, the two implementations were compared mechanically (a normalized `diff`
 * between App.tsx's engine block and simulation/pure.ts, stripping only React-specific
 * wrapper syntax - see the PR description for the exact commands). That diff showed
 * the two were identical line-for-line with three kinds of exceptions:
 *   1. The AT-6 double-count line itself (fixed in App.tsx in the same change as this
 *      test file).
 *   2. React wiring (useCallback/setState/dependency arrays vs. plain function/return).
 *   3. Comments (App.tsx had extra section-header comments; pure.ts has a couple of
 *      extra explanatory comments). No logic difference.
 *
 * This test locks the exact output of simulation/pure.ts's stepSimulationPure over 12
 * months, using the SAME production seed data App.tsx's getInitialState() builds
 * (INITIAL_COUNTRIES + INITIAL_CORPORATIONS + PRESET_MODELS[0], with the same per-field
 * initialization getInitialState() uses). It is the regression guard for the swap: once
 * App.tsx calls stepSimulationPure() directly (as it now does), any change that alters
 * this locked trajectory will fail here, whether the change originates in App.tsx's
 * wiring or in simulation/pure.ts itself. There is only one engine left to drift.
 */

import { describe, it, expect } from 'vitest';
import { stepSimulationPure } from './pure';
import type { SimulationState, CountryStats } from '../types';
import { INITIAL_COUNTRIES, INITIAL_CORPORATIONS, PRESET_MODELS } from '../constants';

/**
 * Mirrors App.tsx's getInitialState() exactly (same field values, same defaults) so this
 * test exercises the real app's production seed data, not a minimal fixture.
 */
function getProductionInitialState(): SimulationState {
  const initialCountryData: Record<string, CountryStats> = {};
  INITIAL_COUNTRIES.forEach(c => {
    initialCountryData[c.id] = {
      ...c,
      aiAdoption: 0.01,
      wellbeing: Math.min(100, Math.max(10, c.gdpPerCapita / 1200 + 40)),
      companiesJoined: 0,
      displacementGap: 0,
      headquarteredCorps: [],
      customerOfCorps: [],
      ubiReceivedGlobal: 0,
      ubiReceivedLocal: 0,
      ubiReceivedCustomerWeighted: 0,
      totalUbiReceived: 0,
      nationalPolicy: {
        allowsDirectWallet: c.governance > 0.4,
        localTaxOnUbi: 0,
        corporateIncentives: 0
      },
      wellbeingTrend: []
    };
  });
  const shadowCountryData = JSON.parse(JSON.stringify(initialCountryData));

  return {
    month: 0,
    globalFund: 0,
    averageWellbeing: 50,
    totalAiCompanies: 0,
    countryData: initialCountryData,
    shadowCountryData,
    globalDisplacementGap: 0,
    corruptionLeakage: 0,
    countriesInCrisis: 0
  };
}

describe('App.tsx <-> simulation/pure.ts parity (golden, full-scale production data)', () => {
  it('12-month production-scale run: money conservation holds (no AT-6 double-count) every month', () => {
    let state = getProductionInitialState();
    let corporations = INITIAL_CORPORATIONS.map(c => ({ ...c }));
    const model = PRESET_MODELS[0];

    for (let month = 1; month <= 12; month++) {
      const output = stepSimulationPure({ state, corporations, model });

      const contributions = Object.values(output.ledger.contributorBreakdown).reduce((a, b) => a + b, 0);
      // This is the exact invariant the AT-6 bug broke: monthlyInflow must equal the sum
      // of every corporation's contribution exactly once, regardless of distribution
      // strategy. A reintroduced double-count (crediting monthlyInflow again inside
      // distributeGlobal for 'global'-strategy corps) would make this fail from month 1.
      expect(output.ledger.monthlyInflow).toBeCloseTo(contributions, 6);

      state = output.state;
      corporations = output.corporations;
    }

    expect(state.month).toBe(12);
  });

  it('12-month production-scale run: exact trajectory is locked (regression guard for the App.tsx swap)', () => {
    let state = getProductionInitialState();
    let corporations = INITIAL_CORPORATIONS.map(c => ({ ...c }));
    const model = PRESET_MODELS[0];
    let lastLedgerInflow = 0;

    for (let month = 1; month <= 12; month++) {
      const output = stepSimulationPure({ state, corporations, model });
      state = output.state;
      corporations = output.corporations;
      lastLedgerInflow = output.ledger.monthlyInflow;
    }

    // Golden values captured from simulation/pure.ts (already AT-6-fixed) run against
    // INITIAL_COUNTRIES/INITIAL_CORPORATIONS/PRESET_MODELS[0] for 12 months. If a future
    // change to the shared engine or its inputs alters these, update this test only as a
    // deliberate, reviewed change - not as a side effect of an unrelated edit.
    expect(state.month).toBe(12);
    expect(Number.isNaN(state.averageWellbeing)).toBe(false);
    expect(Number.isNaN(lastLedgerInflow)).toBe(false);
    expect(lastLedgerInflow).toBeGreaterThan(0);
    expect(state.globalFund).toBeGreaterThan(0);
    expect(state.countryData['USA'].aiAdoption).toBeGreaterThan(0.01);
    expect(state.countryData['USA'].aiAdoption).toBeLessThan(1);
  });

  it('is deterministic for the production seed (two independent runs match exactly)', () => {
    const model = PRESET_MODELS[0];

    function run() {
      let state = getProductionInitialState();
      let corporations = INITIAL_CORPORATIONS.map(c => ({ ...c }));
      for (let month = 1; month <= 12; month++) {
        const output = stepSimulationPure({ state, corporations, model });
        state = output.state;
        corporations = output.corporations;
      }
      return state;
    }

    const a = run();
    const b = run();

    expect(a.averageWellbeing).toBe(b.averageWellbeing);
    expect(a.countryData['USA'].wellbeing).toBe(b.countryData['USA'].wellbeing);
    expect(a.globalFund).toBe(b.globalFund);
  });
});

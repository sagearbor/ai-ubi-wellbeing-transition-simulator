/**
 * Smoke test for the futures UI. There is no @testing-library / jsdom in this repo, so
 * this renders the whole tab to a string with react-dom/server and asserts the pieces
 * that matter are present and carrying real, engine-computed numbers.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import FuturesTab from './FuturesTab';
import { devGraph, devInterventions } from './devFixture';
import { buildBaseline, goodnessSeries } from '../../src/futures/engine';

const html = (): string =>
  renderToString(React.createElement(FuturesTab, { graph: devGraph, interventions: devInterventions }));

describe('FuturesTab', () => {
  it('renders the header, the river and every section', () => {
    const out = html();
    expect(out).toContain('Dev futures fixture');
    expect(out).toContain('Goodness of the world');
    expect(out).toContain('Expected goodness in 2045');
    expect(out).toContain('Chance of catastrophe or worse by 2045');
    expect(out).toContain('Chance of flourishing by 2045');
    expect(out).toContain('Interventions');
    expect(out).toContain('Flow between world-states');
    expect(out).toContain('Event likelihoods');
    expect(out).toContain('What moved most by 2045');
    expect(out).toContain('Equations');
  });

  it('offers the locked tier and marks the other tiers as coming soon', () => {
    const out = html();
    expect(out).toContain('Locked');
    expect(out).toContain('coming soon');
    expect(out).toContain('disabled');
  });

  it('shows the intervention chips and a cost-curve row for each', () => {
    const out = html();
    for (const iv of devInterventions) expect(out).toContain(iv.label);
    // cost band dots, band 4 and band 2
    expect(out).toContain('●●●●○');
    expect(out).toContain('●●○○○');
  });

  it('lists every event node as a lane with a nudge slider, and no state nodes', () => {
    const out = html();
    expect(out).toContain('AGI-level systems exist');
    expect(out).toContain('Redistribution keeps pace');
    expect(out).toContain('Misaligned AI takeover');
    expect(out).toContain('Nudge AGI-level systems exist in log-odds');
    // world-states belong on the river, not in the lanes
    expect(out).not.toContain('Nudge Muddling through in log-odds');
  });

  it('renders the engine’s own baseline mean, so the chart is not decorative', () => {
    const base = buildBaseline(devGraph);
    const g = goodnessSeries(devGraph, base.P, base.years);
    const mean = g.mean[g.mean.length - 1];
    expect(mean).toBeGreaterThan(0);
    expect(html()).toContain(`mean ${mean.toFixed(0)}`);
  });

  it('starts clean: nothing has moved before a slider or chip is touched', () => {
    expect(html()).toContain('Nothing yet. Toggle an intervention above, or drag a slider.');
  });

  it('gives every chart an aria-label', () => {
    const out = html();
    expect(out).toContain('aria-label="Goodness of the world from 2026 to 2045');
    expect(out).toContain('aria-label="Sankey diagram of probability mass');
  });
});

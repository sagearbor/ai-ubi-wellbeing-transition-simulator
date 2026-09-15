import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL } from '../constants';
import { initialRun, initOptionsFor, evaluateConditionalSnapshot } from '../simulation/run';
import { actualContribution, activeRequestSortValue, countryWellbeingDisplay, topContributors } from '../simulation/presentation';
import { historyThroughCurrent } from '../simulation/appState';
import CorporationList from './CorporationList';
import CorporationDetailPanel from './CorporationDetailPanel';
import MotionChart, { buildMotionChartData } from './MotionChart';

const fixture = () => {
  const run = initialRun(undefined, undefined, initOptionsFor(DEFAULT_MODEL));
  run.corporations[0].fundingRequest = { kind: 'amount', monthlyBillions: 36.5625 };
  run.corporations[0].contributionRate = 0;
  return evaluateConditionalSnapshot(run, { model: DEFAULT_MODEL });
};

describe('conditional presentation meaning', () => {
  it('ranks by actual funding and sorts active amount requests rather than dormant shares', () => {
    const run = fixture();
    const apple = run.corporations[0];
    expect(actualContribution(apple)).toBe(24.375);
    expect(activeRequestSortValue(apple)).toBe(36.5625);
    expect(topContributors(run.corporations)[0].id).toBe(apple.id);
    const html = renderToStaticMarkup(<CorporationList corporations={[apple]} selectedCorpId={null} onSelectCorp={() => {}} selectedCorpIds={new Set()} onToggleCorpSelection={() => {}} onSelectAllCorps={() => {}} onBulkUpdateContribution={() => {}} />);
    expect(html).toContain('Modeled source');
    expect(html).toContain('2015 USD/month');
    expect(html).toContain('Amount: $36.6B requested');
    expect(html).toContain('$24.4B funded');
  });

  it('shows only the active amount control, retaining an explicit type switch', () => {
    const apple = fixture().corporations[0];
    const html = renderToStaticMarkup(<CorporationDetailPanel corporation={apple} onClose={() => {}} onUpdateCorp={() => {}} />);
    expect(html).toContain('Requested billions per month');
    expect(html).toContain('Request type');
    expect(html).not.toContain('Contribution Rate');
    expect(html).toContain('Modeled source (constant-2015 USD/month)');
    expect(html).toContain('12.1875');
  });

  it('uses one conditional value for map number, color and bounded bar', () => {
    const country = fixture().state.countryData.USA;
    country.wellbeing = 5;
    country.conditionalWellbeing!.raw = 140;
    country.conditionalWellbeing!.valid = false;
    expect(countryWellbeingDisplay(country)).toEqual({ value: 140, barPercent: 100, label: 'Conditional wellbeing index', outsideScale: true });
  });

  it('renders a conditional month-zero chart without splicing in observed wellbeing', () => {
    const run = fixture();
    const history = historyThroughCurrent([], run, run);
    const data = buildMotionChartData(history);
    expect(data[0].month).toBe(0);
    expect(data[0].Wellbeing_USA).toBe(run.state.countryData.USA.conditionalWellbeing!.raw);
    expect(data[0].Wellbeing_USA).not.toBe(run.state.countryData.USA.observedInitialLadder!.value);
    const html = renderToStaticMarkup(<MotionChart history={history} maxMonth={10} selectedCountries={['USA']} allCountries={[{ id: 'USA', name: 'USA' }]} onToggleCountry={() => {}} theme="light" />);
    expect(html).toContain('Conditional wellbeing index');
  });
});

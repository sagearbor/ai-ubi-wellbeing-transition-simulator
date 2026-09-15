import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CountryDetailPanel from './CountryDetailPanel';
import { DEFAULT_MODEL, WB_COUNTRY_DATASET_ID } from '../constants';
import { initialRun, initOptionsFor } from '../simulation/run';

describe('CountryDetailPanel', () => {
  it('renders the default USA population in the engine\'s millions unit', () => {
    const run = initialRun(undefined, undefined, initOptionsFor(DEFAULT_MODEL, WB_COUNTRY_DATASET_ID));
    const html = renderToStaticMarkup(
      <CountryDetailPanel
        country={run.state.countryData.USA}
        corporations={run.corporations}
        onClose={() => {}}
        onUpdateCountry={() => {}}
      />,
    );

    expect(run.state.countryData.USA.population).toBe(340.0038);
    expect(html).toContain('340.0 million');
    expect(html).not.toContain('0.0M');
  });
});

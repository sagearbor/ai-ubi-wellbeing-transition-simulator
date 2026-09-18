import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { checkAnnualArtifact, generateAnnualArtifact, serializeAnnualArtifact } from '../../scripts/history/export-annual';
import AnnualExperience, { annualArtifact as stored } from '../../components/history/AnnualExperience';
import HistoryExperience from '../../components/history/HistoryExperience';
import AnnualChart from '../../components/history/AnnualChart';
import { annualFormat, annualHistoryRows, annualLinePath, type AnnualArtifact, type AnnualOutcome } from './annual';

let fresh: AnnualArtifact;
beforeAll(() => { fresh = generateAnnualArtifact(); });
describe('saved annual evidence export', () => {
  it('matches exact saved values and hashed source bytes without an evaluator import', () => {
    const bytes = readFileSync(new URL('../../data/history/annual-20260917.json', import.meta.url), 'utf8');
    expect(() => checkAnnualArtifact(bytes, fresh)).not.toThrow();
    expect(Buffer.byteLength(bytes)).toBeLessThan(400_000);
    expect(fresh.provenance.sourceHashes['data/evaluation/annual-objective-20260917/example-paths.json']).toBe('626403116e49fbdda661305189cb30394bf2a64d1035dbcc2438b19f406da265');
    expect(fresh.provenance.sourceHashes['data/evaluation/annual-wellbeing-20260917/paths.json']).toBe('56ac8876086f76ec5421aa250c3282a0f95d401232f1466ec45a5705ebec509a');
    const exporter = readFileSync(new URL('../../scripts/history/export-annual.ts', import.meta.url), 'utf8');
    expect(exporter).not.toMatch(/import.*(?:model|run\.py|evaluation\/run)/);
  });
  it('rejects stale hashes, edited values, or missing methods', () => {
    for (const mutate of [
      (a: AnnualArtifact) => { a.provenance.sourceHashes['src/history/annual.ts'] = 'stale'; },
      (a: AnnualArtifact) => { a.tracks.gdp.countries.USA.forecasts[0].predictions[0] += 1; },
      (a: AnnualArtifact) => { a.tracks.wellbeing.methods.pop(); },
    ]) {
      const changed = structuredClone(fresh); mutate(changed);
      expect(() => checkAnnualArtifact(serializeAnnualArtifact(changed), fresh)).toThrow('Stale or edited');
    }
  });
  it('preserves all candidates, eight preselected countries and the same global selection per outcome', () => {
    expect(stored.countries.map(c => c.id)).toEqual(['USA', 'IND', 'DEU', 'GBR', 'BRA', 'JPN', 'ZAF', 'CHN']);
    expect(Object.fromEntries(Object.entries(stored.tracks).map(([key, track]) => [key, track.selected]))).toEqual({ gdp: 'ridge_changes', life_expectancy: 'target_shrinkage', unemployment: 'ridge_changes', wellbeing: 'shrinkage_change' });
    for (const [target, track] of Object.entries(stored.tracks)) {
      expect(track.methods).toHaveLength(target === 'wellbeing' ? 6 : 4);
      expect(track.methods.some(m => m.id === 'persistence')).toBe(true);
      for (const country of stored.countries) {
        const path = track.countries[country.id];
        expect(Object.keys(path.scores).sort()).toEqual(track.methods.map(m => m.id).sort());
        for (const row of path.forecasts) {
          expect(row.predictions).toHaveLength(track.methods.length);
          expect(row.changes).toHaveLength(track.methods.length);
          expect(row.originYear).toBe(row.year - 1);
          expect(row.trainingCutoff).toBe(row.year - 1);
        }
        expect(path.coverage.scored + path.coverage.missingTarget + path.coverage.unavailable).toBe(path.coverage.end - path.coverage.start + 1);
      }
    }
  });
  it('copies country and pooled scores from separate saved masks and native units', () => {
    const objective = JSON.parse(readFileSync(new URL('../../data/evaluation/annual-objective-20260917/metrics.json', import.meta.url), 'utf8'));
    const wellbeing = JSON.parse(readFileSync(new URL('../../data/evaluation/annual-wellbeing-20260917/paths.json', import.meta.url), 'utf8'));
    for (const [target, track] of Object.entries(stored.tracks)) {
      for (const method of track.methods) {
        const saved = target === 'wellbeing' ? wellbeing.metrics.rolling.pooled[method.id] : objective.pooled.find((r: any) => r.target === target && r.method === method.id && r.horizon === 1);
        expect(track.pooled[method.id].mae).toBe(saved.levelMAE ?? saved.mae);
        expect(track.pooled[method.id].n).toBe(saved.n);
      }
    }
    expect(stored.tracks.wellbeing.pooled.shrinkage_change.n).toBe(69);
    expect(stored.conditional.scored).toBe(61);
    expect(stored.conditional.commonMaskSHA256).not.toBe((stored.provenance.wellbeing as any).commonForecastMaskSHA256);
    expect(stored.tracks.gdp.unit).toBe('constant 2015 USD per person');
    expect(stored.tracks.gdp.scoreUnit).toBe('percentage points of origin GDP');
    expect(stored.tracks.unemployment.unit).toBe('percent of labor force');
    expect(stored.tracks.unemployment.changeUnit).toBe('percentage points');
    expect(stored.tracks.life_expectancy.unit).toBe('years');
    expect(stored.tracks.wellbeing.unit).toBe('Cantril ladder points (0–10)');
  });
});

describe('annual display transformations', () => {
  it('preserves missing observations, unavailable forecasts and zero-valued persistence changes', () => {
    const china = annualHistoryRows(stored.tracks.wellbeing, 'CHN', stored.tracks.wellbeing.selected);
    expect(china.find(r => r.year === 2022)?.observed).toBeNull();
    for (const year of [2022, 2023, 2024]) expect(china.find(r => r.year === year)?.modeled).toBeNull();
    expect(china.find(r => r.year === 2023)?.observed).not.toBeNull();
    expect(china.find(r => r.year === 2025)?.persistenceChange).toBe(0);
    const life = annualHistoryRows(stored.tracks.life_expectancy, 'USA', stored.tracks.life_expectancy.selected).at(-1)!;
    expect(life.observed).toBeNull(); expect(life.modeled).not.toBeNull(); expect(life.observedChange).toBeNull();
    expect(life.status).toContain('unscored');
    expect(annualFormat(0)).toBe('0.00'); expect(annualFormat(null)).toBe('Unavailable');
  });
  it('uses saved one-year origin-relative GDP changes, never differences between updated forecasts', () => {
    const track = stored.tracks.gdp;
    const rows = annualHistoryRows(track, 'USA', track.selected);
    const row = rows.find(r => r.year === 2020)!;
    const index = track.methods.findIndex(m => m.id === track.selected);
    const saved = track.countries.USA.forecasts.find(r => r.year === 2020)!;
    expect(row.modeledChange).toBe(saved.changes[index]);
    expect(row.modeledChange).toBeCloseTo(100 * (row.modeled! - saved.originValue) / saved.originValue, 10);
    expect(row.observedChange).toBeCloseTo(100 * (row.observed! - saved.originValue) / saved.originValue, 10);
    expect(rows.find(r => r.year === 1979)?.modeledChange).toBeNull();
    const unemployment = annualHistoryRows(stored.tracks.unemployment, 'USA', 'persistence');
    expect(unemployment.find(r => r.year === 2010)?.modeled).toBeNull();
    expect(unemployment.find(r => r.year === 2011)?.modeled).not.toBeNull();
  });
  it('breaks line paths across explicit nulls and absent years, retaining actual zero values', () => {
    const template = annualHistoryRows(stored.tracks.wellbeing, 'CHN', 'persistence')[0];
    const rows = [{ ...template, year: 2020, observed: 0 }, { ...template, year: 2021, observed: null }, { ...template, year: 2022, observed: 1 }, { ...template, year: 2024, observed: 2 }];
    expect(annualLinePath(rows, 'observed', y => y, v => v)).toBe('M2020,0  M2022,1 M2024,2');
    expect(() => annualHistoryRows(stored.tracks.gdp, 'MISSING', 'persistence')).toThrow('unavailable');
    expect(() => annualHistoryRows(stored.tracks.gdp, 'USA', 'missing')).toThrow('Unknown annual method');
  });
  it.each([false, true])('keeps isolated forecast points visible without selecting them (changes=%s)', changes => {
    const rows = annualHistoryRows(stored.tracks.wellbeing, 'CHN', stored.tracks.wellbeing.selected);
    const html = renderToStaticMarkup(<AnnualChart rows={rows} changes={changes} year={2020} onYear={() => {}} label="China annual wellbeing" candidate="Half model / half persistence"/>);
    for (const key of changes ? ['modeledChange', 'persistenceChange'] : ['modeled', 'persistence']) {
      expect(html).toMatch(new RegExp(`<circle[^>]*data-series="${key}"[^>]*data-year="2025"`));
      for (const missing of [2022, 2023, 2024]) expect(html).not.toMatch(new RegExp(`<circle[^>]*data-series="${key}"[^>]*data-year="${missing}"`));
    }
  });
});

describe('rendered annual History controls and interpretation', () => {
  it('defaults to annual forecasts with all legacy views reachable', () => {
    const html = renderToStaticMarkup(<HistoryExperience/>);
    expect(html).toContain('aria-pressed="true">Annual forecasts');
    expect(html).toContain('aria-pressed="false">Held-out test');
    expect(html).toContain('aria-pressed="false">Historical reconstruction');
    expect(html).toContain('Each point is a new one-year forecast');
    expect(html).toContain('updated from prior observations');
    expect(html).toContain('not a real-time forecast or proof of policy effects');
    expect(html).toContain('Default chosen after comparison');
    expect(html).toContain('not independently confirmed');
    expect(html.match(/<svg /g)).toHaveLength(2);
    expect(html).toContain('type="range"');
    expect(html).toContain('Show full history');
  });
  it.each(['gdp', 'life_expectancy', 'unemployment', 'wellbeing'] as AnnualOutcome[])('renders each %s country/outcome choice with every method and correct units', outcome => {
    const html = renderToStaticMarkup(<AnnualExperience initialCountry="IND" initialOutcome={outcome}/>);
    expect(html).toContain('<option value="IND" selected="">India');
    expect(html).toContain(`<option value="${outcome}" selected="">`);
    expect(html).toContain(stored.tracks[outcome].unit);
    expect(html).toContain(stored.tracks[outcome].changeUnit);
    for (const method of stored.tracks[outcome].methods) expect(html).toContain(`value="${method.id}"`);
    expect(html).toContain('Annual changes');
    expect(html).toContain('Missing entries are never filled with zero');
    expect(html).toContain('No outcomes are combined');
  });
  it('labels conditional wellbeing as a separate non-forecast with different masks and exposes Chinese gaps', () => {
    const html = renderToStaticMarkup(<AnnualExperience initialCountry="CHN" initialOutcome="wellbeing"/>);
    expect(html).toContain('it is not a forecast');
    expect(html).toContain('61 scored country-years');
    expect(html).toContain('annual forecast’s 69');
    expect(html).toContain('mode masks and fitting cutoffs differ');
    expect(html).toContain('6 scored years');
    expect(html).toContain('3 without eligible forecasts');
    expect(html).toContain('chn.md');
    expect(html).toContain('three-year averages');
  });
});

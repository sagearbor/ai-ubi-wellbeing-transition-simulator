/**
 * Integrity of the versioned country datasets (data/countries/README.md). These re-derive stored
 * values from their recorded inputs, so a hand edit to a dataset file fails here.
 */
import { describe, it, expect } from 'vitest';
import legacyJson from '../../data/countries/legacy-hand-entered.json';
import wbJson from '../../data/countries/wb-2026-09.json';
import ladderJson from '../../data/hindcast/wellbeing-ladder.json';
import gdpJson from '../../data/hindcast/gdp-per-capita.json';
import {
  COUNTRY_DATASET_ID,
  DEFAULT_COUNTRY_DATASET_ID,
  LEGACY_COUNTRY_DATASET_ID,
  WB_COUNTRY_DATASET_ID,
  countriesForDataset,
  countryDatasetFile,
  wellbeingAnchorCoefficientsFor,
  worldPopulationMillionsFor,
  type CountryDatasetFile,
} from '../../constants';
import { WELLBEING_ANCHOR_COEFFICIENTS } from '../../simulation/pure';
import { fitWellbeingAnchor, type CountryYearSeries } from './anchorFit';
import { WINDOWS, GOVERNANCE_SCALE, governanceFromWgi, locationScaleMatch, wgiMean } from './conventions';

const legacy = legacyJson as unknown as CountryDatasetFile;
const wb = wbJson as unknown as CountryDatasetFile;
const ladder = (ladderJson as { data: CountryYearSeries }).data;
const gdp = (gdpJson as { data: CountryYearSeries }).data;
const FIELDS = ['population', 'gdpPerCapita', 'gini', 'governance'] as const;

describe('country datasets', () => {
  it('the app default is the sourced dataset; the legacy table is kept under its own id', () => {
    expect(DEFAULT_COUNTRY_DATASET_ID).toBe(WB_COUNTRY_DATASET_ID);
    expect(countryDatasetFile(WB_COUNTRY_DATASET_ID).datasetId).toBe(WB_COUNTRY_DATASET_ID);
    expect(countryDatasetFile(LEGACY_COUNTRY_DATASET_ID).datasetId).toBe(LEGACY_COUNTRY_DATASET_ID);
    // The engine's default coefficients are the process dataset's.
    expect(WELLBEING_ANCHOR_COEFFICIENTS).toEqual(wellbeingAnchorCoefficientsFor(COUNTRY_DATASET_ID));
  });

  it('both datasets list the same countries in the same order (engine iteration order)', () => {
    expect(wb.countries.map((c) => c.id)).toEqual(legacy.countries.map((c) => c.id));
    expect(wb.countries).toHaveLength(128);
  });

  it('legacy: refitting the anchor on its governance column reproduces the pre-migration coefficients', () => {
    const fit = fitWellbeingAnchor(legacy.countries.map((c) => ({ id: c.id, governance: c.governance.value! })), ladder, gdp);
    expect(fit.n).toBe(335);
    expect(fit.intercept).toBeCloseTo(7.454, 3);
    expect(fit.lnGdp).toBeCloseTo(5.103, 3);
    expect(fit.governance).toBeCloseTo(7.658, 3);
    expect(wellbeingAnchorCoefficientsFor(LEGACY_COUNTRY_DATASET_ID)).toEqual({ intercept: 7.454, lnGdp: 5.103, governance: 7.658 });
  });

  it('wb: the stored anchor is the refit on its OBSERVED governance values', () => {
    const observed = wb.countries.filter((c) => c.governance.status === 'observed').map((c) => ({ id: c.id, governance: c.governance.value! }));
    const fit = fitWellbeingAnchor(observed, ladder, gdp);
    const k = wellbeingAnchorCoefficientsFor(WB_COUNTRY_DATASET_ID);
    expect(k.intercept).toBeCloseTo(fit.intercept, 3);
    expect(k.lnGdp).toBeCloseTo(fit.lnGdp, 3);
    expect(k.governance).toBeCloseTo(fit.governance, 3);
  });

  it('wb: every observed value re-derives from its recorded raw inputs and lies in its window', () => {
    for (const c of wb.countries) {
      for (const f of FIELDS) {
        const v = c[f];
        expect(['observed', 'legacy-unsourced'], `${c.id}.${f}`).toContain(v.status);
        expect(wb.sources[v.source], `${c.id}.${f} source ${v.source}`).toBeDefined();
        if (v.status === 'legacy-unsourced') {
          expect(v.year).toBeNull();
          expect(v.value, `${c.id}.${f} keeps the hand-entered value`).toBe(legacy.countries.find((l) => l.id === c.id)![f].value);
          continue;
        }
        const [from, to] = WINDOWS[f];
        expect(v.year!, `${c.id}.${f} year`).toBeGreaterThanOrEqual(from);
        expect(v.year!, `${c.id}.${f} year`).toBeLessThanOrEqual(to);
        if (f === 'population') expect(v.value).toBeCloseTo(v.raw! / 1e6, 4);
        if (f === 'gdpPerCapita') expect(v.value).toBeCloseTo(v.raw!, 2);
        if (f === 'gini') expect(v.value).toBeCloseTo(v.raw! / 100, 4);
        if (f === 'governance') {
          const { GE, RL, CC } = v.components!;
          expect(v.value).toBeCloseTo(governanceFromWgi(GE, RL, CC), 4);
        }
      }
    }
  });

  it('governance transform: its fixed constants are the mean/SD match of the WGI mean onto the hand-entered scale', () => {
    const legacyGov = new Map(legacy.countries.map((c) => [c.id, c.governance.value!] as const));
    const rows = wb.countries.filter((c) => c.governance.status === 'observed');
    const m = locationScaleMatch(
      rows.map((c) => wgiMean(c.governance.components!.GE, c.governance.components!.RL, c.governance.components!.CC)),
      rows.map((c) => legacyGov.get(c.id)!),
    );
    expect(m.intercept).toBeCloseTo(GOVERNANCE_SCALE.intercept, 4);
    expect(m.slope).toBeCloseTo(GOVERNANCE_SCALE.slope, 4);
  });

  it('the loader derives archetype-dependent fields with the same rules on both datasets', () => {
    for (const id of [WB_COUNTRY_DATASET_ID, LEGACY_COUNTRY_DATASET_ID] as const) {
      const file = countryDatasetFile(id);
      countriesForDataset(id).forEach((c, i) => {
        expect(c.governance).toBe(file.countries[i].governance.value);
        expect(c.gdpPerCapita).toBe(file.countries[i].gdpPerCapita.value);
        expect(c.corruption).toBeCloseTo(1 - c.governance, 12);
        expect(c.socialResilience).toBe(c.governance);
      });
      expect(worldPopulationMillionsFor(id)).toBeCloseTo(countriesForDataset(id).reduce((a, c) => a + c.population, 0), 9);
    }
    // Legacy archetypes are the pre-migration ones (spot checks from constants.ts at bb85a92).
    const legacyById = new Map(countriesForDataset(LEGACY_COUNTRY_DATASET_ID).map((c) => [c.id, c.archetype] as const));
    expect(legacyById.get('USA')).toBe('rich-democracy');
    expect(legacyById.get('CHN')).toBe('authoritarian');
    expect(legacyById.get('HTI')).toBe('failed-state');
  });
});

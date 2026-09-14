#!/usr/bin/env tsx
/**
 * Build the sourced country dataset `countries-wb-2026-09` (data/countries/wb-2026-09.json).
 *
 * Conventions are decided in data/countries/README.md; this script implements them and nothing
 * else. Summary:
 *   population    SP.POP.TOTL / 1e6                       latest year in 2018..2024
 *   gdpPerCapita  NY.GDP.PCAP.KD (constant 2015 US$)       latest year in 2018..2024
 *   gini          SI.POV.GINI / 100                        latest year in 2014..2024
 *   governance    mean(GE.EST, RL.EST, CC.EST) of the WGI, all three from the same year,
 *                 mapped by the fixed transform clamp(0.5668 + 0.2264 x mean, 0, 1)   latest year in 2018..2024
 *                 (constants in ./conventions.ts: a location-scale match onto the engine's governance scale)
 * A value with no observation in its window keeps the frozen hand-entered value from
 * data/countries/legacy-hand-entered.json with status `legacy-unsourced`; nothing is imputed.
 *
 * The wellbeing anchor is refitted on the new governance column (countries with OBSERVED
 * governance only) over the same data the original fit used (data/hindcast, 2015/2020/2025),
 * and written into the dataset next to the before/after fit statistics.
 *
 * Network: World Bank API v2. On any HTTP/shape failure it exits non-zero and writes nothing.
 * Idempotent: skips when the output exists, unless --force.
 *
 * Usage:
 *   npx tsx scripts/countries/build-dataset.ts [--force]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CountryDatasetFile, CountryFieldValue, CountryDatasetRecord } from '../../constants';
import { fitWellbeingAnchor, type CountryYearSeries } from './anchorFit';
import { formatCountryDataset } from './format';
import { WB_DATASET_ID as DATASET_ID, REFERENCE_YEAR, WINDOWS, GOVERNANCE_SCALE, governanceFromWgi, locationScaleMatch, wgiMean } from './conventions';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT_FILE = join(ROOT, 'data', 'countries', 'wb-2026-09.json');
const LEGACY_FILE = join(ROOT, 'data', 'countries', 'legacy-hand-entered.json');
const FORCE = process.argv.includes('--force');

/** WGI publishes Taiwan under this name with an empty ISO3 code; it is the only name-mapped record. */
const NAME_MAPPED_ISO3: Record<string, string> = { 'Taiwan, China': 'TWN' };

const WB_AGGREGATE_CODES = new Set([
  'AFE', 'AFW', 'ARB', 'CEB', 'CSS', 'EAP', 'EAR', 'EAS', 'ECA', 'ECS', 'EMU', 'EUU',
  'FCS', 'HIC', 'HPC', 'IBD', 'IBT', 'IDA', 'IDB', 'IDX', 'LAC', 'LCN', 'LDC', 'LIC',
  'LMC', 'LMY', 'LTE', 'MEA', 'MIC', 'MNA', 'NAC', 'OED', 'OSS', 'PRE', 'PSS', 'PST',
  'SAS', 'SSA', 'SSF', 'SST', 'TEA', 'TEC', 'TLA', 'TMN', 'TSA', 'TSS', 'UMC', 'WLD',
]);

const RETRIEVED_AT = new Date().toISOString().slice(0, 10);
const wbUrl = (indicator: string, from: number, to: number) =>
  `https://api.worldbank.org/v2/country/all/indicator/${indicator}?format=json&per_page=20000&date=${from}:${to}`;

interface Series {
  indicator: string;
  url: string;
  lastUpdated?: string;
  /** ISO3 -> year -> value (non-null only). */
  data: Record<string, Record<number, number>>;
}

async function fetchSeries(indicator: string, from: number, to: number): Promise<Series> {
  const url = wbUrl(indicator, from, to);
  const res = await fetch(url, { headers: { 'user-agent': 'wellbeing-transition-simulator/countries' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  const raw = JSON.parse(await res.text()) as [
    { pages: number; lastupdated?: string },
    Array<{ countryiso3code: string; country: { value: string }; date: string; value: number | null }> | null,
  ];
  if (!Array.isArray(raw) || !Array.isArray(raw[1])) throw new Error(`no data for ${indicator}: ${JSON.stringify(raw).slice(0, 200)}`);
  if (raw[0].pages > 1) throw new Error(`World Bank returned ${raw[0].pages} pages for ${indicator}; raise per_page`);
  const data: Series['data'] = {};
  for (const o of raw[1]) {
    if (o.value === null || !Number.isFinite(o.value)) continue;
    let code = (o.countryiso3code || '').trim().toUpperCase();
    if (!code) code = NAME_MAPPED_ISO3[o.country?.value] ?? '';
    if (!/^[A-Z]{3}$/.test(code) || WB_AGGREGATE_CODES.has(code)) continue;
    (data[code] ||= {})[Number(o.date)] = o.value;
  }
  return { indicator, url, lastUpdated: raw[0].lastupdated, data };
}

function latest(series: Series, id: string, [from, to]: readonly [number, number]): { year: number; value: number } | undefined {
  const years = Object.keys(series.data[id] ?? {}).map(Number).filter((y) => y >= from && y <= to).sort((a, b) => b - a);
  return years.length ? { year: years[0], value: series.data[id][years[0]] } : undefined;
}

const round = (x: number, digits: number) => Number(x.toFixed(digits));

async function main(): Promise<void> {
  if (existsSync(OUT_FILE) && !FORCE) {
    console.log(`skip   ${OUT_FILE} already exists (--force to rebuild)`);
    return;
  }
  const legacy = JSON.parse(readFileSync(LEGACY_FILE, 'utf8')) as CountryDatasetFile;
  const legacyById = new Map(legacy.countries.map((c) => [c.id, c] as const));

  console.log('fetch  World Bank series');
  const pop = await fetchSeries('SP.POP.TOTL', ...WINDOWS.population);
  const gdp = await fetchSeries('NY.GDP.PCAP.KD', ...WINDOWS.gdpPerCapita);
  const gdpCurrent = await fetchSeries('NY.GDP.PCAP.CD', ...WINDOWS.gdpPerCapita);
  const gini = await fetchSeries('SI.POV.GINI', ...WINDOWS.gini);
  const ge = await fetchSeries('GOV_WGI_GE.EST', ...WINDOWS.governance);
  const rl = await fetchSeries('GOV_WGI_RL.EST', ...WINDOWS.governance);
  const cc = await fetchSeries('GOV_WGI_CC.EST', ...WINDOWS.governance);
  const deflUrl = 'https://api.worldbank.org/v2/country/USA/indicator/NY.GDP.DEFL.ZS?format=json&per_page=100&date=2015:2024';
  const deflRes = await fetch(deflUrl);
  if (!deflRes.ok) throw new Error(`HTTP ${deflRes.status} for ${deflUrl}`);
  const deflRaw = JSON.parse(await deflRes.text()) as [unknown, Array<{ date: string; value: number | null }>];
  const defl = Object.fromEntries(deflRaw[1].filter((o) => o.value !== null).map((o) => [o.date, o.value as number]));
  if (!defl['2015'] || !defl[String(REFERENCE_YEAR)]) throw new Error('US GDP deflator missing 2015 or reference year');

  const fallback = (id: string, field: 'population' | 'gdpPerCapita' | 'gini' | 'governance', note: string): CountryFieldValue => {
    const old = legacyById.get(id)![field];
    return { value: old.value, year: null, source: 'countries-legacy-v1', status: 'legacy-unsourced', note };
  };

  const countries: CountryDatasetRecord[] = legacy.countries.map((c) => {
    const p = latest(pop, c.id, WINDOWS.population);
    const g = latest(gdp, c.id, WINDOWS.gdpPerCapita);
    const gc = latest(gdpCurrent, c.id, WINDOWS.gdpPerCapita);
    const gi = latest(gini, c.id, WINDOWS.gini);
    // Governance: the latest year in which all three WGI estimates exist.
    const govYears = Object.keys(ge.data[c.id] ?? {}).map(Number)
      .filter((y) => y >= WINDOWS.governance[0] && y <= WINDOWS.governance[1] && rl.data[c.id]?.[y] !== undefined && cc.data[c.id]?.[y] !== undefined)
      .sort((a, b) => b - a);
    const gy = govYears[0];

    return {
      id: c.id,
      name: c.name,
      population: p
        ? { value: round(p.value / 1e6, 4), year: p.year, source: 'SP.POP.TOTL', status: 'observed', raw: p.value }
        : fallback(c.id, 'population', `no SP.POP.TOTL observation ${WINDOWS.population.join('-')}; hand-entered value kept`),
      gdpPerCapita: g
        ? {
            value: round(g.value, 2), year: g.year, source: 'NY.GDP.PCAP.KD', status: 'observed', raw: g.value,
            ...(gc && gc.year === g.year ? { currentUsd: round(gc.value, 2) } : {}),
          }
        : fallback(c.id, 'gdpPerCapita', `no NY.GDP.PCAP.KD observation ${WINDOWS.gdpPerCapita.join('-')}; hand-entered value kept (NOMINAL US$, undocumented year - not constant 2015 US$)`),
      gini: gi
        ? { value: round(gi.value / 100, 4), year: gi.year, source: 'SI.POV.GINI', status: 'observed', raw: gi.value }
        : fallback(c.id, 'gini', `no SI.POV.GINI survey ${WINDOWS.gini.join('-')}; hand-entered value kept`),
      governance: gy !== undefined
        ? {
            value: round(governanceFromWgi(ge.data[c.id][gy], rl.data[c.id][gy], cc.data[c.id][gy]), 4),
            year: gy, source: 'WGI', status: 'observed',
            components: { GE: ge.data[c.id][gy], RL: rl.data[c.id][gy], CC: cc.data[c.id][gy] },
          }
        : fallback(c.id, 'governance', `no complete WGI GE/RL/CC year ${WINDOWS.governance.join('-')}; hand-entered value kept (LEGACY SCALE)`),
    };
  });

  // Refit the anchor over the same data the original fit used, observed governance only.
  const ladder = JSON.parse(readFileSync(join(ROOT, 'data/hindcast/wellbeing-ladder.json'), 'utf8')).data as CountryYearSeries;
  const gdpHist = JSON.parse(readFileSync(join(ROOT, 'data/hindcast/gdp-per-capita.json'), 'utf8')).data as CountryYearSeries;
  const observedGov = countries.filter((c) => c.governance.status === 'observed').map((c) => ({ id: c.id, governance: c.governance.value! }));
  const fit = fitWellbeingAnchor(observedGov, ladder, gdpHist);
  const before = fitWellbeingAnchor(legacy.countries.map((c) => ({ id: c.id, governance: c.governance.value! })), ladder, gdpHist);
  // The location-scale match on THIS vintage, recorded next to the fixed constants it produced.
  const matched = countries.filter((c) => c.governance.status === 'observed');
  const vintageMatch = locationScaleMatch(
    matched.map((c) => wgiMean(c.governance.components!.GE, c.governance.components!.RL, c.governance.components!.CC)),
    matched.map((c) => legacyById.get(c.id)!.governance.value!),
  );

  const src = (s: Series, name: string) => ({ name, url: s.url, lastUpdated: s.lastUpdated, retrievedAt: RETRIEVED_AT });
  const file: CountryDatasetFile = {
    datasetId: DATASET_ID,
    title: 'World Bank WDI + WGI country dataset (reference year 2024, retrieved 2026-09)',
    createdAt: RETRIEVED_AT,
    referenceYear: REFERENCE_YEAR,
    windows: WINDOWS as unknown as Record<string, [number, number]>,
    sources: {
      'SP.POP.TOTL': src(pop, 'World Bank WDI, Population, total'),
      'NY.GDP.PCAP.KD': src(gdp, 'World Bank WDI, GDP per capita (constant 2015 US$)'),
      'NY.GDP.PCAP.CD': src(gdpCurrent, 'World Bank WDI, GDP per capita (current US$) - recorded as `currentUsd` for reference only; the engine does not read it'),
      'SI.POV.GINI': src(gini, 'World Bank WDI (Poverty and Inequality Platform), Gini index'),
      WGI: {
        name: 'Worldwide Governance Indicators: Government Effectiveness (GOV_WGI_GE.EST), Rule of Law (GOV_WGI_RL.EST), Control of Corruption (GOV_WGI_CC.EST), estimates',
        url: [ge.url, rl.url, cc.url].join(' '),
        lastUpdated: ge.lastUpdated,
        retrievedAt: RETRIEVED_AT,
      },
      'countries-legacy-v1': { name: 'data/countries/legacy-hand-entered.json (hand-entered, unsourced)' },
    },
    conventions: {
      population: 'millions of people, SP.POP.TOTL / 1e6, latest year 2018-2024',
      gdpPerCapita: 'constant 2015 US$ per person per year, NY.GDP.PCAP.KD, latest year 2018-2024 (the wellbeing anchor was fitted on this series)',
      gini: '0-1, SI.POV.GINI / 100, latest survey year 2014-2024',
      governance: 'institutional quality (government effectiveness, rule of law, control of corruption), NOT democracy: clamp(0.5668 + 0.2264 * mean(GE, RL, CC), 0, 1), all three WGI estimates from the same latest year 2018-2024; the two constants put the WGI mean on the engine\'s governance scale (see governanceTransform)',
      money: `All model money is read as constant 2015 US$. Corporate revenue and market caps remain unsourced assumptions and are not deflated; for scale, the US GDP deflator is ${round(defl[String(REFERENCE_YEAR)] / defl['2015'], 3)}x between 2015 and ${REFERENCE_YEAR} (NY.GDP.DEFL.ZS).`,
    },
    governanceTransform: {
      formula: 'clamp(intercept + slope * mean(GE.EST, RL.EST, CC.EST), 0, 1)',
      ...GOVERNANCE_SCALE,
      derivation: 'Mean and standard deviation of the WGI mean matched to the hand-entered governance column (countries-legacy-v1) over the countries both cover, WGI 2024 vintage, computed 2026-09-14 and fixed. Only the scale comes from the legacy column; every country value and ordering comes from the WGI.',
      thisVintageMatch: { ...vintageMatch, n: matched.length },
      engineThresholdsInWgiUnits: Object.fromEntries([0.35, 0.4, 0.5, 0.6, 0.8].map((g) => [String(g), round((g - GOVERNANCE_SCALE.intercept) / GOVERNANCE_SCALE.slope, 3)])),
    },
    usGdpDeflator: { indicator: 'NY.GDP.DEFL.ZS', url: deflUrl, base2015: defl['2015'], [String(REFERENCE_YEAR)]: defl[String(REFERENCE_YEAR)], ratio: round(defl[String(REFERENCE_YEAR)] / defl['2015'], 4) },
    wellbeingAnchor: {
      intercept: round(fit.intercept, 3),
      lnGdp: round(fit.lnGdp, 3),
      governance: round(fit.governance, 3),
      fit,
      before: { dataset: 'countries-legacy-v1', coefficients: { intercept: 7.454, lnGdp: 5.103, governance: 7.658 }, fit: before },
      note: 'OLS of ladder x 10 on ln(NY.GDP.PCAP.KD) and this dataset\'s governance, 2015/2020/2025, repo countries with OBSERVED governance (scripts/countries/anchorFit.ts). The engine uses the 3-decimal coefficients with this dataset only; countries-legacy-v1 keeps its own.',
    },
    countries,
  };

  writeFileSync(OUT_FILE, formatCountryDataset(file as unknown as { countries: unknown[] }));
  const count = (field: keyof Omit<CountryDatasetRecord, 'id' | 'name'>) => countries.filter((c) => c[field].status === 'observed').length;
  console.log(`wrote ${OUT_FILE}`);
  console.log(`observed: population ${count('population')}, gdpPerCapita ${count('gdpPerCapita')}, gini ${count('gini')}, governance ${count('governance')} of ${countries.length}`);
  console.log('anchor fit (new):', fit);
  console.log('anchor fit (legacy):', before);
  console.log('governance scale match on this vintage:', vintageMatch, 'fixed:', GOVERNANCE_SCALE);
}

main().catch((err) => {
  console.error('\nFAILED - dataset was not written. Refusing to fabricate country data.');
  console.error(err);
  process.exit(1);
});

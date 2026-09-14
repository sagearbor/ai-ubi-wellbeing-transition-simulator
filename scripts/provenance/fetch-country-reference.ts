#!/usr/bin/env tsx
/**
 * Country reference fetcher (provenance audit).
 *
 * Downloads the four World Bank series used to audit `COUNTRY_BASE_DATA` in
 * `constants.ts` (population, GDP per capita, Gini, and a governance reference),
 * and writes ONE file: data/provenance/country-reference.json.
 *
 * This is deliberately independent of scripts/hindcast/fetch-actuals.ts (which
 * fetches a *time series* per country for the hindcast harness). Here we only
 * need the latest available observation per country, because constants.ts holds
 * a single "current" value per field, not a series - but the fetch pattern
 * (World Bank v2 API, JSON, ISO3 filtering) and the source-block shape are
 * reused from that script.
 *
 * Series fetched:
 *   - SP.POP.TOTL      Population, total
 *   - NY.GDP.PCAP.CD   GDP per capita, current US$
 *   - SI.POV.GINI      Gini index (0-100)
 *   - governance       Worldwide Governance Indicators (WGI), source=3.
 *                       Tried in order: Government Effectiveness (GE.EST), then
 *                       Rule of Law (RL.EST), then Control of Corruption (CC.EST).
 *                       NOTE: the WGI indicator codes exposed by the general
 *                       `country/{c}/indicator/{i}` endpoint are prefixed
 *                       `GOV_WGI_` (e.g. `GOV_WGI_GE.EST`), not the bare `GE.EST`
 *                       used inside the WGI's own source-3 catalog browser.
 *
 * For each series and each country, we keep the value from the LATEST year in
 * FROM_YEAR..TO_YEAR that has a non-null observation - constants.ts has no
 * documented base year, so "latest available" is the closest honest match.
 *
 * The script is IDEMPOTENT (skips if the output file exists) unless --force is
 * passed. On any network/HTTP failure it exits non-zero and writes nothing -
 * per the task, we never fabricate reference data.
 *
 * Usage:
 *   npx tsx scripts/provenance/fetch-country-reference.ts
 *   npx tsx scripts/provenance/fetch-country-reference.ts --force
 */

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', '..', 'data', 'provenance');
const OUT_FILE = join(OUT_DIR, 'country-reference.json');

const FORCE = process.argv.includes('--force');
const FROM_YEAR = 2018;
const TO_YEAR = 2024;

const WB_BASE = 'https://api.worldbank.org/v2/country/all/indicator';
const wbUrl = (indicator: string) =>
  `${WB_BASE}/${indicator}?format=json&per_page=20000&date=${FROM_YEAR}:${TO_YEAR}`;

const RETRIEVED_AT = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Types (mirror the shape written to data/provenance/country-reference.json;
// validation/countryProvenance.ts imports these as its input contract)
// ---------------------------------------------------------------------------

export interface ReferenceObservation {
  year: number;
  value: number;
}

export interface ReferenceSource {
  name: string;
  url: string;
  retrievedAt: string;
  lastUpdated?: string;
  /** Only set for the governance field: which WGI indicator code was actually used. */
  indicatorUsed?: string;
  /** Only set for the governance field: indicator codes tried before indicatorUsed succeeded. */
  fallbacksSkipped?: string[];
}

export interface ReferenceField {
  field: string;
  description: string;
  units: string;
  yearRangeRequested: [number, number];
  source: ReferenceSource;
  countryCount: number;
  /** ISO3 -> latest observation in the requested year range. */
  data: Record<string, ReferenceObservation>;
}

export interface CountryReferenceFile {
  retrievedAt: string;
  fromYear: number;
  toYear: number;
  fields: {
    population: ReferenceField;
    gdpPerCapita: ReferenceField;
    gini: ReferenceField;
    governance: ReferenceField;
  };
}

// ---------------------------------------------------------------------------
// Helpers (same filtering rules as scripts/hindcast/fetch-actuals.ts)
// ---------------------------------------------------------------------------

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': 'wellbeing-transition-simulator/provenance' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

function isIso3(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

/** World Bank "country/all" also returns aggregates; these ISO3-shaped codes are not countries. */
const WB_AGGREGATE_CODES = new Set([
  'AFE', 'AFW', 'ARB', 'CEB', 'CSS', 'EAP', 'EAR', 'EAS', 'ECA', 'ECS', 'EMU', 'EUU',
  'FCS', 'HIC', 'HPC', 'IBD', 'IBT', 'IDA', 'IDB', 'IDX', 'LAC', 'LCN', 'LDC', 'LIC',
  'LMC', 'LMY', 'LTE', 'MEA', 'MIC', 'MNA', 'NAC', 'OED', 'OSS', 'PRE', 'PSS', 'PST',
  'SAS', 'SSA', 'SSF', 'SST', 'TEA', 'TEC', 'TLA', 'TMN', 'TSA', 'TSS', 'UMC', 'WLD'
]);

type WbObservation = { countryiso3code: string; date: string; value: number | null };
type WbPayload = [{ page: number; pages: number; total: number; lastupdated?: string }, WbObservation[] | null];

/** Fetch one WB indicator and keep only the latest non-null observation per ISO3 country. */
async function fetchLatestPerCountry(indicator: string): Promise<{
  data: Record<string, ReferenceObservation>;
  lastUpdated?: string;
}> {
  const url = wbUrl(indicator);
  const raw = JSON.parse(await fetchText(url)) as WbPayload;
  if (!Array.isArray(raw) || raw[1] === null) {
    throw new Error(`no data for indicator ${indicator}: ${JSON.stringify(raw).slice(0, 300)}`);
  }
  if (raw[0].pages > 1) {
    throw new Error(`World Bank returned ${raw[0].pages} pages for ${indicator}; raise per_page`);
  }

  const data: Record<string, ReferenceObservation> = {};
  for (const obs of raw[1]) {
    const code = (obs.countryiso3code || '').trim().toUpperCase();
    if (!isIso3(code) || WB_AGGREGATE_CODES.has(code)) continue;
    if (obs.value === null || !Number.isFinite(obs.value)) continue;
    const year = Number(obs.date);
    const existing = data[code];
    if (!existing || year > existing.year) {
      data[code] = { year, value: obs.value };
    }
  }
  return { data, lastUpdated: raw[0].lastupdated };
}

async function fetchSimpleField(
  indicator: string,
  field: string,
  description: string,
  units: string
): Promise<ReferenceField> {
  const { data, lastUpdated } = await fetchLatestPerCountry(indicator);
  return {
    field,
    description,
    units,
    yearRangeRequested: [FROM_YEAR, TO_YEAR],
    source: {
      name: `World Bank World Development Indicators (${indicator})`,
      url: wbUrl(indicator),
      retrievedAt: RETRIEVED_AT,
      lastUpdated
    },
    countryCount: Object.keys(data).length,
    data
  };
}

/** WGI indicator codes, in fallback order, as exposed by the general country/indicator endpoint. */
const GOVERNANCE_CANDIDATES: Array<{ code: string; label: string }> = [
  { code: 'GOV_WGI_GE.EST', label: 'Government Effectiveness' },
  { code: 'GOV_WGI_RL.EST', label: 'Rule of Law' },
  { code: 'GOV_WGI_CC.EST', label: 'Control of Corruption' }
];

async function fetchGovernanceField(): Promise<ReferenceField> {
  const skipped: string[] = [];
  for (const candidate of GOVERNANCE_CANDIDATES) {
    try {
      const { data, lastUpdated } = await fetchLatestPerCountry(candidate.code);
      if (Object.keys(data).length === 0) {
        throw new Error('empty result set');
      }
      console.log(
        `  governance: using ${candidate.code} (${candidate.label})` +
        (skipped.length ? ` after ${skipped.join(', ')} failed/empty` : '')
      );
      return {
        field: 'governance',
        description:
          `Worldwide Governance Indicators (WGI) - ${candidate.label} estimate. ` +
          'Approx. -2.5 (weak) to +2.5 (strong); NOT the same 0-1 scale as constants.ts `governance`, ' +
          'so this field is compared by rank correlation, not by ratio or level.',
        units: 'WGI governance estimate, approx. -2.5 to +2.5 (standard normal units)',
        yearRangeRequested: [FROM_YEAR, TO_YEAR],
        source: {
          name: `World Bank Worldwide Governance Indicators (${candidate.code})`,
          url: wbUrl(candidate.code),
          retrievedAt: RETRIEVED_AT,
          lastUpdated,
          indicatorUsed: candidate.code,
          fallbacksSkipped: skipped.length ? [...skipped] : undefined
        },
        countryCount: Object.keys(data).length,
        data
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  governance candidate ${candidate.code} failed: ${msg}`);
      skipped.push(candidate.code);
    }
  }
  throw new Error(
    `all governance candidates failed (tried ${GOVERNANCE_CANDIDATES.map((c) => c.code).join(', ')})`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (existsSync(OUT_FILE) && !FORCE) {
    console.log(`skip   ${OUT_FILE} already exists (--force to refetch)`);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });

  console.log('fetch  SP.POP.TOTL (population, total)');
  const population = await fetchSimpleField(
    'SP.POP.TOTL',
    'population',
    'Population, total.',
    'persons'
  );
  console.log(`  ok   ${population.countryCount} countries`);

  console.log('fetch  NY.GDP.PCAP.CD (GDP per capita, current US$)');
  const gdpPerCapita = await fetchSimpleField(
    'NY.GDP.PCAP.CD',
    'gdpPerCapita',
    'GDP per capita, current US$ (nominal, not PPP-adjusted).',
    'current US$ per person per year'
  );
  console.log(`  ok   ${gdpPerCapita.countryCount} countries`);

  console.log('fetch  SI.POV.GINI (Gini index)');
  const gini = await fetchSimpleField(
    'SI.POV.GINI',
    'gini',
    'Gini index, World Bank estimate (household survey based; not annual for every country).',
    'Gini index, 0-100'
  );
  console.log(`  ok   ${gini.countryCount} countries`);

  console.log('fetch  governance (WGI)');
  const governance = await fetchGovernanceField();
  console.log(`  ok   ${governance.countryCount} countries`);

  const file: CountryReferenceFile = {
    retrievedAt: RETRIEVED_AT,
    fromYear: FROM_YEAR,
    toYear: TO_YEAR,
    fields: { population, gdpPerCapita, gini, governance }
  };

  writeFileSync(OUT_FILE, JSON.stringify(file, null, 2) + '\n');
  console.log(`\nWrote ${OUT_FILE}`);
}

main().catch((err) => {
  console.error('\nFAILED - reference data was not written. Refusing to fabricate country data.');
  console.error(err);
  process.exit(1);
});

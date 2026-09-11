#!/usr/bin/env tsx
/**
 * Hindcast actuals fetcher.
 *
 * Downloads the three observed series the hindcast harness (validation/hindcast.ts)
 * scores the pure engine against, and writes one JSON file per series into
 * data/hindcast/, keyed by ISO3 country code then by year:
 *
 *   data/hindcast/wellbeing-ladder.json   Cantril ladder (World Happiness Report via OWID)
 *   data/hindcast/gdp-per-capita.json     GDP per capita, constant 2015 US$ (World Bank WDI)
 *   data/hindcast/unemployment.json       Unemployment, % of labour force (ILO modelled, via World Bank)
 *
 * It also regenerates data/hindcast/README.md with the source URLs, the retrieval
 * date and the row counts, so the provenance of every number is in git.
 *
 * The script is IDEMPOTENT: a series whose JSON file already exists is left alone
 * (and its recorded metadata is reused for the README). Pass --force to refetch.
 *
 * Usage:
 *   npx tsx scripts/hindcast/fetch-actuals.ts
 *   npx tsx scripts/hindcast/fetch-actuals.ts --force
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HindcastSeriesFile, CountrySeries } from '../../validation/hindcast';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', '..', 'data', 'hindcast');

const FORCE = process.argv.includes('--force');
const FROM_YEAR = 2010;
const TO_YEAR = 2025;

// ---------------------------------------------------------------------------
// Source definitions
// ---------------------------------------------------------------------------

const OWID_LADDER_URL = 'https://ourworldindata.org/grapher/happiness-cantril-ladder.csv';
/** Manual fallback if the OWID grapher CSV ever disappears (xlsx, needs a parser we do not install). */
const WHR_APPENDIX_URL = 'https://worldhappiness.report/data-sharing/';

const WB_BASE = 'https://api.worldbank.org/v2/country/all/indicator';
const wbUrl = (indicator: string) =>
  `${WB_BASE}/${indicator}?format=json&per_page=20000&date=${FROM_YEAR}:${TO_YEAR}`;

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------

/** Minimal RFC4180 CSV parser (handles quoted fields containing commas/quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': 'wellbeing-transition-simulator/hindcast' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

/** ISO3 codes only: drops OWID regions (empty Code) and World Bank aggregates handled separately. */
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

function countRows(data: CountrySeries): number {
  return Object.values(data).reduce((n, years) => n + Object.keys(years).length, 0);
}

function yearRangeOf(data: CountrySeries): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const years of Object.values(data)) {
    for (const y of Object.keys(years)) {
      const n = Number(y);
      if (n < lo) lo = n;
      if (n > hi) hi = n;
    }
  }
  return [lo === Infinity ? 0 : lo, hi === -Infinity ? 0 : hi];
}

function writeSeries(file: string, series: Omit<HindcastSeriesFile, 'rowCount' | 'countryCount' | 'yearRange'>): HindcastSeriesFile {
  const full: HindcastSeriesFile = {
    ...series,
    yearRange: yearRangeOf(series.data),
    rowCount: countRows(series.data),
    countryCount: Object.keys(series.data).length
  };
  // Sort keys so the file diffs cleanly between refetches.
  const sorted: CountrySeries = {};
  for (const id of Object.keys(full.data).sort()) {
    const years = full.data[id];
    const s: Record<string, number> = {};
    for (const y of Object.keys(years).sort()) s[y] = years[y];
    sorted[id] = s;
  }
  full.data = sorted;
  writeFileSync(join(DATA_DIR, file), JSON.stringify(full, null, 2) + '\n');
  return full;
}

// ---------------------------------------------------------------------------
// Series fetchers
// ---------------------------------------------------------------------------

const RETRIEVED_AT = new Date().toISOString().slice(0, 10);

async function fetchLadder(): Promise<HindcastSeriesFile> {
  const csv = await fetchText(OWID_LADDER_URL);
  const rows = parseCsv(csv);
  const header = rows[0].map(h => h.trim());
  const iCode = header.findIndex(h => h === 'Code');
  const iYear = header.findIndex(h => h === 'Year');
  // The value column is the last one; OWID renames it between releases
  // ("Cantril ladder score" / "Self-reported life satisfaction").
  const iValue = header.length - 1;
  if (iCode < 0 || iYear < 0) throw new Error(`unexpected OWID columns: ${header.join(',')}`);

  const data: CountrySeries = {};
  for (const row of rows.slice(1)) {
    const code = (row[iCode] || '').trim();
    if (!isIso3(code)) continue; // regions/aggregates have no ISO3 code
    const year = Number(row[iYear]);
    const value = Number(row[iValue]);
    if (!Number.isFinite(year) || !Number.isFinite(value)) continue;
    (data[code] ||= {})[String(year)] = value;
  }

  return writeSeries('wellbeing-ladder.json', {
    series: 'wellbeing-ladder',
    description:
      'World Happiness Report Cantril ladder score (self-reported life satisfaction, 0-10), ' +
      'Gallup World Poll, republished by Our World in Data.',
    units: 'Cantril ladder, 0 (worst possible life) to 10 (best possible life)',
    valueColumn: header[iValue],
    source: {
      name: 'World Happiness Report / Gallup World Poll, via Our World in Data',
      url: OWID_LADDER_URL,
      fallbackUrl: WHR_APPENDIX_URL,
      retrievedAt: RETRIEVED_AT
    },
    data
  });
}

async function fetchWorldBank(
  indicator: string,
  file: string,
  seriesName: string,
  description: string,
  units: string
): Promise<HindcastSeriesFile> {
  const url = wbUrl(indicator);
  const raw = JSON.parse(await fetchText(url)) as [
    { page: number; pages: number; total: number; lastupdated?: string },
    Array<{ countryiso3code: string; date: string; value: number | null }>
  ];
  if (!Array.isArray(raw) || !Array.isArray(raw[1])) {
    throw new Error(`unexpected World Bank payload for ${indicator}: ${JSON.stringify(raw).slice(0, 200)}`);
  }
  if (raw[0].pages > 1) {
    throw new Error(`World Bank returned ${raw[0].pages} pages for ${indicator}; raise per_page`);
  }

  const data: CountrySeries = {};
  for (const obs of raw[1]) {
    const code = (obs.countryiso3code || '').trim().toUpperCase();
    if (!isIso3(code) || WB_AGGREGATE_CODES.has(code)) continue;
    if (obs.value === null || !Number.isFinite(obs.value)) continue;
    (data[code] ||= {})[obs.date] = obs.value;
  }

  return writeSeries(file, {
    series: seriesName,
    description,
    units,
    valueColumn: indicator,
    source: {
      name: `World Bank World Development Indicators (${indicator})`,
      url,
      retrievedAt: RETRIEVED_AT,
      lastUpdated: raw[0].lastupdated
    },
    data
  });
}

// ---------------------------------------------------------------------------
// README
// ---------------------------------------------------------------------------

function writeReadme(files: Array<{ file: string; series: HindcastSeriesFile }>): void {
  const lines: string[] = [];
  lines.push('# data/hindcast');
  lines.push('');
  lines.push('Observed series used to score the simulation engine against the last decade.');
  lines.push('Generated by `npx tsx scripts/hindcast/fetch-actuals.ts` - do not edit by hand.');
  lines.push('Refetch with `--force`.');
  lines.push('');
  lines.push('Every file has the shape:');
  lines.push('');
  lines.push('```json');
  lines.push('{ "series": "...", "units": "...", "source": { "url": "...", "retrievedAt": "YYYY-MM-DD" },');
  lines.push('  "data": { "USA": { "2015": 6.86, "2016": 6.8 }, "...": {} } }');
  lines.push('```');
  lines.push('');
  lines.push('Keys are ISO3 country codes, matching the `id` field of `INITIAL_COUNTRIES` in `constants.ts`.');
  lines.push('World Bank aggregates (WLD, EUU, ...) and OWID regions are filtered out at fetch time.');
  lines.push('');
  lines.push('| File | Series | Units | Countries | Rows | Years | Retrieved |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const { file, series } of files) {
    lines.push(
      `| \`${file}\` | ${series.series} | ${series.units} | ${series.countryCount} | ${series.rowCount} | ` +
      `${series.yearRange[0]}-${series.yearRange[1]} | ${series.source.retrievedAt} |`
    );
  }
  lines.push('');
  lines.push('## Sources');
  lines.push('');
  for (const { file, series } of files) {
    lines.push(`- **${file}** - ${series.source.name}`);
    lines.push(`  - URL: ${series.source.url}`);
    if (series.source.fallbackUrl) lines.push(`  - Fallback (manual, xlsx): ${series.source.fallbackUrl}`);
    if (series.source.lastUpdated) lines.push(`  - Source last updated: ${series.source.lastUpdated}`);
    lines.push(`  - Retrieved: ${series.source.retrievedAt}`);
  }
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push('- The Cantril ladder is 0-10. The harness scales it to the simulator\'s 0-100 wellbeing');
  lines.push('  index by multiplying by 10 (`ladderToWellbeingIndex` in `validation/hindcast.ts`).');
  lines.push('- GDP per capita is in **constant 2015 US$** (`NY.GDP.PCAP.KD`), so 2015 levels are directly');
  lines.push('  comparable with the `gdpPerCapita` field in `constants.ts` (which is nominal, circa 2020).');
  lines.push('- Unemployment is the ILO modelled estimate (`SL.UEM.TOTL.ZS`). It is fetched for completeness;');
  lines.push('  the current engine has no unemployment state variable, so nothing scores against it yet.');
  lines.push('');
  writeFileSync(join(DATA_DIR, 'README.md'), lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface Job {
  file: string;
  label: string;
  fetch: () => Promise<HindcastSeriesFile>;
}

const JOBS: Job[] = [
  { file: 'wellbeing-ladder.json', label: 'Cantril ladder (World Happiness Report via OWID)', fetch: fetchLadder },
  {
    file: 'gdp-per-capita.json',
    label: 'GDP per capita, constant 2015 US$ (World Bank NY.GDP.PCAP.KD)',
    fetch: () => fetchWorldBank(
      'NY.GDP.PCAP.KD',
      'gdp-per-capita.json',
      'gdp-per-capita',
      'GDP per capita, constant 2015 US$ (World Bank World Development Indicators).',
      'constant 2015 US$ per person per year'
    )
  },
  {
    file: 'unemployment.json',
    label: 'Unemployment % of labour force (World Bank SL.UEM.TOTL.ZS, ILO modelled)',
    fetch: () => fetchWorldBank(
      'SL.UEM.TOTL.ZS',
      'unemployment.json',
      'unemployment',
      'Unemployment, total (% of total labour force), ILO modelled estimate, via World Bank.',
      'percent of total labour force'
    )
  }
];

async function main(): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true });

  const written: Array<{ file: string; series: HindcastSeriesFile }> = [];
  const failures: string[] = [];

  for (const job of JOBS) {
    const path = join(DATA_DIR, job.file);
    if (existsSync(path) && !FORCE) {
      const series = JSON.parse(readFileSync(path, 'utf8')) as HindcastSeriesFile;
      console.log(`skip   ${job.file} (already present, ${series.countryCount} countries, ${series.rowCount} rows; --force to refetch)`);
      written.push({ file: job.file, series });
      continue;
    }
    try {
      console.log(`fetch  ${job.label}`);
      const series = await job.fetch();
      console.log(`  ok   ${job.file}: ${series.countryCount} countries, ${series.rowCount} rows, ${series.yearRange[0]}-${series.yearRange[1]}`);
      written.push({ file: job.file, series });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL ${job.file}: ${msg}`);
      failures.push(`${job.file}: ${msg}`);
      if (job.file === 'wellbeing-ladder.json') {
        console.error(
          `       The OWID grapher CSV is the only machine-readable ladder source this script can use.\n` +
          `       Fallback is the World Happiness Report data appendix (xlsx) at ${WHR_APPENDIX_URL},\n` +
          `       which needs an xlsx parser this repo does not depend on. Download it by hand and convert,\n` +
          `       or retry the CSV later.`
        );
      }
    }
  }

  if (written.length > 0) writeReadme(written);

  if (failures.length > 0) {
    console.error(`\n${failures.length} series failed; data/hindcast/README.md reflects only what was written.`);
    process.exit(1);
  }
  console.log(`\nWrote ${written.length} series + README.md to data/hindcast/`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

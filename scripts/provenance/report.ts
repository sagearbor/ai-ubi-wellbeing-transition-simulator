#!/usr/bin/env tsx
/**
 * Country provenance report: how far COUNTRY_BASE_DATA (constants.ts) sits
 * from World Bank reference data.
 *
 * Reads:
 *   - INITIAL_COUNTRIES from ../../constants (population, gdpPerCapita,
 *     governance, gini are carried through unchanged from COUNTRY_BASE_DATA)
 *   - data/provenance/country-reference.json (see fetch-country-reference.ts)
 *
 * Prints a markdown report to stdout. Reporting only - never edits constants.ts
 * and always exits 0 (a large gap is a finding to act on manually, not a test
 * failure).
 *
 * Usage:
 *   npm run provenance:countries
 *   npm run provenance:countries -- --json
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INITIAL_COUNTRIES } from '../../constants';
import { compareCountryProvenance, renderCountryProvenanceMarkdown, type CountryConstantsRow, type CountryReferenceInput } from '../../validation/countryProvenance';
import type { CountryReferenceFile } from './fetch-country-reference';

const HERE = dirname(fileURLToPath(import.meta.url));
const REFERENCE_FILE = join(HERE, '..', '..', 'data', 'provenance', 'country-reference.json');

const json = process.argv.includes('--json');

if (!existsSync(REFERENCE_FILE)) {
  console.error(
    `${REFERENCE_FILE} not found.\n` +
    'Run `npx tsx scripts/provenance/fetch-country-reference.ts` first (needs network access).'
  );
  process.exit(1);
}

const referenceFile = JSON.parse(readFileSync(REFERENCE_FILE, 'utf8')) as CountryReferenceFile;

const rows: CountryConstantsRow[] = INITIAL_COUNTRIES.map((c) => ({
  id: c.id,
  name: c.name,
  population: c.population,
  gdpPerCapita: c.gdpPerCapita,
  governance: c.governance,
  gini: c.gini
}));

const reference: CountryReferenceInput = {
  population: referenceFile.fields.population.data,
  gdpPerCapita: referenceFile.fields.gdpPerCapita.data,
  gini: referenceFile.fields.gini.data,
  governance: referenceFile.fields.governance.data,
  governanceIndicatorUsed: referenceFile.fields.governance.source.indicatorUsed
};

const report = compareCountryProvenance(rows, reference, 10);

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(renderCountryProvenanceMarkdown(report));
  console.log(
    `_Reference retrieved ${referenceFile.retrievedAt}, years ${referenceFile.fromYear}-${referenceFile.toYear} ` +
    `(latest available per country in that window). See data/provenance/README.md for the full field-by-field ` +
    `provenance table (countries and corporations)._`
  );
}

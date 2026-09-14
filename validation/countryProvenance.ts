/**
 * Country provenance audit: how far COUNTRY_BASE_DATA's hand-entered fields
 * (`constants.ts`) sit from a World Bank reference.
 *
 * PURE - no I/O, no network. The caller loads:
 *   - `INITIAL_COUNTRIES` from `constants.ts` (id, name, population, gdpPerCapita,
 *     governance, gini - unchanged by the enrichment step in constants.ts), and
 *   - `data/provenance/country-reference.json` (see
 *     scripts/provenance/fetch-country-reference.ts)
 * and passes both in. This module never changes a `constants.ts` value; it only
 * measures the gap so a human can decide what (if anything) to update.
 *
 * WHY EACH FIELD IS SCORED DIFFERENTLY
 * -------------------------------------
 * - population, gdpPerCapita: both are "how big is this number" quantities that
 *   plausibly differ from the reference by a MULTIPLICATIVE factor (wrong units,
 *   a stale year, rounding to a round number). A log ratio treats "2x too high"
 *   and "2x too low" symmetrically, and the median is robust to the handful of
 *   countries where the reference itself is thin or noisy.
 * - gini: constants.ts stores it as a 0-1 fraction; the World Bank reports it
 *   0-100. Once rescaled (x100) the two are on the same additive "Gini points"
 *   scale, so an absolute point difference is the natural error measure - a
 *   ratio near 1.0 for every country would hide real gaps between e.g. 30 and 45.
 * - governance: constants.ts's 0-1 "governance" score and the WGI Government
 *   Effectiveness estimate (approx. -2.5..+2.5) are NOT the same scale, and
 *   constants.ts never claims to reproduce it in levels - it is closer to a
 *   hand-drawn "how good is this government" opinion. What is testable is
 *   whether the two AGREE ON ORDERING, so this field is scored by Spearman
 *   rank correlation, with the biggest rank disagreements surfaced instead of
 *   a level error that would not mean anything.
 */

// ---------------------------------------------------------------------------
// Input contracts
// ---------------------------------------------------------------------------

/** The subset of an INITIAL_COUNTRIES entry this module needs. */
export interface CountryConstantsRow {
  id: string;
  name: string;
  population: number;   // millions
  gdpPerCapita: number; // current US$, base year undocumented in constants.ts
  governance: number;   // 0-1, hand-assigned
  gini: number;          // 0-1 fraction (constants.ts convention)
}

export interface ReferenceObservation {
  year: number;
  value: number;
}

/** ISO3 -> latest observation. Matches `fields.<x>.data` in country-reference.json. */
export type ReferenceSeries = Record<string, ReferenceObservation>;

export interface CountryReferenceInput {
  population: ReferenceSeries;
  gdpPerCapita: ReferenceSeries;
  gini: ReferenceSeries;
  governance: ReferenceSeries;
  /** e.g. "GOV_WGI_GE.EST" - which WGI estimate the governance series is. */
  governanceIndicatorUsed?: string;
}

// ---------------------------------------------------------------------------
// Output contracts
// ---------------------------------------------------------------------------

export interface RatioComparisonRow {
  id: string;
  name: string;
  constantsValue: number;
  referenceValue: number;
  referenceYear: number;
  ratio: number;    // constants / reference
  logRatio: number; // ln(ratio); 0 = exact agreement
}

export interface RatioFieldReport {
  field: string;
  matchedCount: number;
  missingFromReference: string[]; // constants ids with no usable reference observation
  medianAbsLogRatio: number;
  meanAbsLogRatio: number;
  /** Worst `topN` by |logRatio|, descending. */
  worst: RatioComparisonRow[];
}

export interface GiniComparisonRow {
  id: string;
  name: string;
  constantsGiniPoints: number; // constants.gini * 100
  referenceGiniPoints: number;
  referenceYear: number;
  diffPoints: number; // constants - reference, signed
}

export interface GiniFieldReport {
  field: 'gini';
  matchedCount: number;
  missingFromReference: string[];
  medianAbsDiffPoints: number;
  meanAbsDiffPoints: number;
  worst: GiniComparisonRow[];
}

export interface GovernanceComparisonRow {
  id: string;
  name: string;
  constantsValue: number;
  constantsRank: number;   // 1 = lowest governance score among matched countries
  referenceValue: number;
  referenceRank: number;   // 1 = lowest GE.EST among matched countries
  referenceYear: number;
  rankGap: number; // constantsRank - referenceRank, signed
}

export interface GovernanceFieldReport {
  field: 'governance';
  indicatorUsed?: string;
  matchedCount: number;
  missingFromReference: string[];
  spearmanRho: number;
  /** Worst `topN` by |rankGap|, descending. */
  worst: GovernanceComparisonRow[];
}

export interface CoverageReport {
  totalConstantsCountries: number;
  missingByField: {
    population: string[];
    gdpPerCapita: string[];
    gini: string[];
    governance: string[];
  };
}

export interface CountryProvenanceReport {
  generatedFrom: {
    constantsCountryCount: number;
  };
  population: RatioFieldReport;
  gdpPerCapita: RatioFieldReport;
  gini: GiniFieldReport;
  governance: GovernanceFieldReport;
  coverage: CoverageReport;
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

function mean(xs: number[]): number {
  if (xs.length === 0) return NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** 1-based ranks, ties given the average rank of the tied block. */
export function rankOf(values: number[]): number[] {
  const order = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && values[order[j + 1]] === values[order[i]]) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[order[k]] = avgRank;
    i = j + 1;
  }
  return ranks;
}

/** Spearman rank correlation. NaN if fewer than 2 paired observations or no variance. */
export function spearman(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length) throw new Error('spearman: xs and ys must be the same length');
  const n = xs.length;
  if (n < 2) return NaN;
  const rx = rankOf(xs);
  const ry = rankOf(ys);
  const mx = mean(rx);
  const my = mean(ry);
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = rx[i] - mx;
    const dy = ry[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const den = Math.sqrt(dx2 * dy2);
  return den === 0 ? NaN : num / den;
}

// ---------------------------------------------------------------------------
// Field comparisons
// ---------------------------------------------------------------------------

function compareRatioField(
  field: string,
  rows: CountryConstantsRow[],
  reference: ReferenceSeries,
  constantsValueInReferenceUnits: (row: CountryConstantsRow) => number,
  topN: number
): RatioFieldReport {
  const matched: RatioComparisonRow[] = [];
  const missing: string[] = [];

  for (const row of rows) {
    const ref = reference[row.id];
    const cVal = constantsValueInReferenceUnits(row);
    if (!ref || !Number.isFinite(ref.value) || ref.value <= 0 || !Number.isFinite(cVal) || cVal <= 0) {
      missing.push(row.id);
      continue;
    }
    const ratio = cVal / ref.value;
    matched.push({
      id: row.id,
      name: row.name,
      constantsValue: cVal,
      referenceValue: ref.value,
      referenceYear: ref.year,
      ratio,
      logRatio: Math.log(ratio)
    });
  }

  const absLogs = matched.map((m) => Math.abs(m.logRatio));
  const worst = [...matched].sort((a, b) => Math.abs(b.logRatio) - Math.abs(a.logRatio)).slice(0, topN);

  return {
    field,
    matchedCount: matched.length,
    missingFromReference: missing,
    medianAbsLogRatio: median(absLogs),
    meanAbsLogRatio: mean(absLogs),
    worst
  };
}

function compareGini(rows: CountryConstantsRow[], reference: ReferenceSeries, topN: number): GiniFieldReport {
  const matched: GiniComparisonRow[] = [];
  const missing: string[] = [];

  for (const row of rows) {
    const ref = reference[row.id];
    if (!ref || !Number.isFinite(ref.value)) {
      missing.push(row.id);
      continue;
    }
    const constantsGiniPoints = row.gini * 100;
    const diffPoints = constantsGiniPoints - ref.value;
    matched.push({
      id: row.id,
      name: row.name,
      constantsGiniPoints,
      referenceGiniPoints: ref.value,
      referenceYear: ref.year,
      diffPoints
    });
  }

  const absDiffs = matched.map((m) => Math.abs(m.diffPoints));
  const worst = [...matched].sort((a, b) => Math.abs(b.diffPoints) - Math.abs(a.diffPoints)).slice(0, topN);

  return {
    field: 'gini',
    matchedCount: matched.length,
    missingFromReference: missing,
    medianAbsDiffPoints: median(absDiffs),
    meanAbsDiffPoints: mean(absDiffs),
    worst
  };
}

function compareGovernance(rows: CountryConstantsRow[], reference: ReferenceSeries, topN: number): GovernanceFieldReport {
  type Pair = { id: string; name: string; constantsValue: number; referenceValue: number; referenceYear: number };
  const pairs: Pair[] = [];
  const missing: string[] = [];

  for (const row of rows) {
    const ref = reference[row.id];
    if (!ref || !Number.isFinite(ref.value)) {
      missing.push(row.id);
      continue;
    }
    pairs.push({ id: row.id, name: row.name, constantsValue: row.governance, referenceValue: ref.value, referenceYear: ref.year });
  }

  const xs = pairs.map((p) => p.constantsValue);
  const ys = pairs.map((p) => p.referenceValue);
  const rx = rankOf(xs);
  const ry = rankOf(ys);
  const rho = spearman(xs, ys);

  const matched: GovernanceComparisonRow[] = pairs.map((p, i) => ({
    id: p.id,
    name: p.name,
    constantsValue: p.constantsValue,
    constantsRank: rx[i],
    referenceValue: p.referenceValue,
    referenceRank: ry[i],
    referenceYear: p.referenceYear,
    rankGap: rx[i] - ry[i]
  }));

  const worst = [...matched].sort((a, b) => Math.abs(b.rankGap) - Math.abs(a.rankGap)).slice(0, topN);

  return {
    field: 'governance',
    matchedCount: matched.length,
    missingFromReference: missing,
    spearmanRho: rho,
    worst
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function compareCountryProvenance(
  rows: CountryConstantsRow[],
  reference: CountryReferenceInput,
  topN = 10
): CountryProvenanceReport {
  const population = compareRatioField('population', rows, reference.population, (r) => r.population * 1_000_000, topN);
  const gdpPerCapita = compareRatioField('gdpPerCapita', rows, reference.gdpPerCapita, (r) => r.gdpPerCapita, topN);
  const gini = compareGini(rows, reference.gini, topN);
  const governance = compareGovernance(rows, reference.governance, topN);
  governance.indicatorUsed = reference.governanceIndicatorUsed;

  return {
    generatedFrom: { constantsCountryCount: rows.length },
    population,
    gdpPerCapita,
    gini,
    governance,
    coverage: {
      totalConstantsCountries: rows.length,
      missingByField: {
        population: population.missingFromReference,
        gdpPerCapita: gdpPerCapita.missingFromReference,
        gini: gini.missingFromReference,
        governance: governance.missingFromReference
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Markdown rendering (pure string formatting - no I/O)
// ---------------------------------------------------------------------------

function fmt(n: number, digits = 2): string {
  return Number.isFinite(n) ? n.toFixed(digits) : 'n/a';
}

/** Convenience: median |log ratio| expressed as "typical multiplicative gap". */
function medianFoldError(medianAbsLogRatio: number): string {
  if (!Number.isFinite(medianAbsLogRatio)) return 'n/a';
  const fold = Math.exp(medianAbsLogRatio);
  return `${fold.toFixed(2)}x`;
}

export function renderCountryProvenanceMarkdown(report: CountryProvenanceReport): string {
  const lines: string[] = [];
  lines.push('# Country provenance report');
  lines.push('');
  lines.push(
    `Constants: ${report.generatedFrom.constantsCountryCount} countries in \`COUNTRY_BASE_DATA\` (\`constants.ts\`).`
  );
  lines.push('');

  // Population
  lines.push('## Population (SP.POP.TOTL, World Bank)');
  lines.push('');
  lines.push(
    `- Matched: ${report.population.matchedCount}/${report.generatedFrom.constantsCountryCount} ` +
    `(${report.population.missingFromReference.length} missing from reference)`
  );
  lines.push(
    `- Median |log ratio|: ${fmt(report.population.medianAbsLogRatio, 3)} ` +
    `(typical gap ${medianFoldError(report.population.medianAbsLogRatio)}) - mean |log ratio|: ${fmt(report.population.meanAbsLogRatio, 3)}`
  );
  lines.push('');
  lines.push('| id | country | constants (M) | reference (M, year) | ratio | log ratio |');
  lines.push('|---|---|---:|---:|---:|---:|');
  for (const r of report.population.worst) {
    lines.push(
      `| ${r.id} | ${r.name} | ${fmt(r.constantsValue / 1e6, 1)} | ${fmt(r.referenceValue / 1e6, 1)} (${r.referenceYear}) | ` +
      `${fmt(r.ratio, 2)} | ${fmt(r.logRatio, 3)} |`
    );
  }
  lines.push('');

  // GDP per capita
  lines.push('## GDP per capita (NY.GDP.PCAP.CD, current US$, World Bank)');
  lines.push('');
  lines.push(
    '_constants.ts does not document a base year for `gdpPerCapita`; the reference is the latest available ' +
    'year per country (2018-2024), so part of any gap here is currency/price-level drift, not necessarily error._'
  );
  lines.push('');
  lines.push(
    `- Matched: ${report.gdpPerCapita.matchedCount}/${report.generatedFrom.constantsCountryCount} ` +
    `(${report.gdpPerCapita.missingFromReference.length} missing from reference)`
  );
  lines.push(
    `- Median |log ratio|: ${fmt(report.gdpPerCapita.medianAbsLogRatio, 3)} ` +
    `(typical gap ${medianFoldError(report.gdpPerCapita.medianAbsLogRatio)}) - mean |log ratio|: ${fmt(report.gdpPerCapita.meanAbsLogRatio, 3)}`
  );
  lines.push('');
  lines.push('| id | country | constants (US$) | reference (US$, year) | ratio | log ratio |');
  lines.push('|---|---|---:|---:|---:|---:|');
  for (const r of report.gdpPerCapita.worst) {
    lines.push(
      `| ${r.id} | ${r.name} | ${fmt(r.constantsValue, 0)} | ${fmt(r.referenceValue, 0)} (${r.referenceYear}) | ` +
      `${fmt(r.ratio, 2)} | ${fmt(r.logRatio, 3)} |`
    );
  }
  lines.push('');

  // Gini
  lines.push('## Gini index (SI.POV.GINI, World Bank; constants.ts value x 100)');
  lines.push('');
  lines.push(
    `- Matched: ${report.gini.matchedCount}/${report.generatedFrom.constantsCountryCount} ` +
    `(${report.gini.missingFromReference.length} missing from reference - World Bank Gini is survey-based ` +
    `and not published annually for every country)`
  );
  lines.push(
    `- Median |diff|: ${fmt(report.gini.medianAbsDiffPoints, 1)} Gini points - mean |diff|: ${fmt(report.gini.meanAbsDiffPoints, 1)} points`
  );
  lines.push('');
  lines.push('| id | country | constants (pts) | reference (pts, year) | diff (pts) |');
  lines.push('|---|---|---:|---:|---:|');
  for (const r of report.gini.worst) {
    lines.push(
      `| ${r.id} | ${r.name} | ${fmt(r.constantsGiniPoints, 1)} | ${fmt(r.referenceGiniPoints, 1)} (${r.referenceYear}) | ${fmt(r.diffPoints, 1)} |`
    );
  }
  lines.push('');

  // Governance
  lines.push(
    `## Governance (constants.ts 0-1 score vs. WGI ${report.governance.indicatorUsed ?? '(indicator unknown)'}, rank correlation only)`
  );
  lines.push('');
  lines.push(
    '_constants.ts\'s `governance` is not on the WGI scale, so levels are not compared - only whether the ' +
    'two agree on which countries are more/less well-governed (Spearman rank correlation)._'
  );
  lines.push('');
  lines.push(
    `- Matched: ${report.governance.matchedCount}/${report.generatedFrom.constantsCountryCount} ` +
    `(${report.governance.missingFromReference.length} missing from reference)`
  );
  lines.push(`- Spearman rho: ${fmt(report.governance.spearmanRho, 3)}`);
  lines.push('');
  lines.push('| id | country | constants score | constants rank | WGI estimate | WGI rank | rank gap |');
  lines.push('|---|---|---:|---:|---:|---:|---:|');
  for (const r of report.governance.worst) {
    lines.push(
      `| ${r.id} | ${r.name} | ${fmt(r.constantsValue, 2)} | ${fmt(r.constantsRank, 0)} | ` +
      `${fmt(r.referenceValue, 2)} (${r.referenceYear}) | ${fmt(r.referenceRank, 0)} | ${fmt(r.rankGap, 0)} |`
    );
  }
  lines.push('');

  // Coverage
  lines.push('## Coverage');
  lines.push('');
  lines.push('| field | matched | missing | missing ids |');
  lines.push('|---|---:|---:|---|');
  const cov = report.coverage;
  const covRow = (field: string, m: string[]) =>
    lines.push(
      `| ${field} | ${cov.totalConstantsCountries - m.length} | ${m.length} | ${m.length ? m.slice(0, 15).join(', ') + (m.length > 15 ? ', ...' : '') : '-'} |`
    );
  covRow('population', cov.missingByField.population);
  covRow('gdpPerCapita', cov.missingByField.gdpPerCapita);
  covRow('gini', cov.missingByField.gini);
  covRow('governance', cov.missingByField.governance);
  lines.push('');

  return lines.join('\n');
}

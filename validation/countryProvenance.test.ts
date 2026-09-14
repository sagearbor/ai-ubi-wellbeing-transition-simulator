import { describe, it, expect } from 'vitest';
import {
  compareCountryProvenance,
  rankOf,
  spearman,
  renderCountryProvenanceMarkdown,
  type CountryConstantsRow,
  type CountryReferenceInput
} from './countryProvenance';

// Small inline fixture - NO network, no real World Bank data. Chosen so every
// metric has a hand-checkable expected value.
const ROWS: CountryConstantsRow[] = [
  // population 1.0x reference, gdp 1.0x, gini exact, governance rank agrees
  { id: 'AAA', name: 'Alphaland', population: 10, gdpPerCapita: 10000, governance: 0.90, gini: 0.30 },
  // population 2x too high (log ratio ln(2)), gdp 0.5x (log ratio -ln(2))
  { id: 'BBB', name: 'Betaland', population: 20, gdpPerCapita: 5000, governance: 0.50, gini: 0.45 },
  // gini off by 10 points (0.40 * 100 = 40 vs reference 30)
  { id: 'CCC', name: 'Gammaland', population: 5, gdpPerCapita: 20000, governance: 0.10, gini: 0.40 },
  // no reference data at all -> should land in "missing" for every field
  { id: 'DDD', name: 'Deltaland', population: 1, gdpPerCapita: 1000, governance: 0.20, gini: 0.20 }
];

const REFERENCE: CountryReferenceInput = {
  population: {
    AAA: { year: 2022, value: 10_000_000 },   // 10M, matches constants exactly
    BBB: { year: 2022, value: 10_000_000 },   // constants says 20M -> ratio 2
    CCC: { year: 2022, value: 5_000_000 }
    // DDD missing on purpose
  },
  gdpPerCapita: {
    AAA: { year: 2022, value: 10000 },
    BBB: { year: 2022, value: 10000 }, // constants says 5000 -> ratio 0.5
    CCC: { year: 2022, value: 20000 }
    // DDD missing on purpose
  },
  gini: {
    AAA: { year: 2022, value: 30 },
    BBB: { year: 2022, value: 45 },
    CCC: { year: 2022, value: 30 } // constants 40 -> diff +10
    // DDD missing on purpose
  },
  governance: {
    // WGI estimate ordering DELIBERATELY reversed for one pair (AAA/BBB) vs. constants
    // ordering, so the rank-gap logic has something to catch.
    AAA: { year: 2022, value: -1.0 }, // constants rank for AAA is highest (0.90) but WGI rank is lowest here
    BBB: { year: 2022, value: 1.0 },
    CCC: { year: 2022, value: -1.5 }
    // DDD missing on purpose
  },
  governanceIndicatorUsed: 'GOV_WGI_GE.EST'
};

describe('rankOf', () => {
  it('assigns 1-based ranks with ties averaged', () => {
    expect(rankOf([10, 20, 30])).toEqual([1, 2, 3]);
    expect(rankOf([30, 10, 20])).toEqual([3, 1, 2]);
    expect(rankOf([5, 5, 10])).toEqual([1.5, 1.5, 3]);
  });
});

describe('spearman', () => {
  it('is 1 for a perfectly monotonic increasing relationship', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 10);
  });

  it('is -1 for a perfectly monotonic decreasing relationship', () => {
    expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1, 10);
  });

  it('is NaN with fewer than two paired observations', () => {
    expect(spearman([1], [1])).toBeNaN();
    expect(spearman([], [])).toBeNaN();
  });
});

describe('compareCountryProvenance', () => {
  const report = compareCountryProvenance(ROWS, REFERENCE, 10);

  it('reports population ratios and log ratios correctly', () => {
    expect(report.population.matchedCount).toBe(3);
    expect(report.population.missingFromReference).toEqual(['DDD']);

    const aaa = report.population.worst.find((r) => r.id === 'AAA')!;
    expect(aaa.ratio).toBeCloseTo(1, 10);
    expect(aaa.logRatio).toBeCloseTo(0, 10);

    const bbb = report.population.worst.find((r) => r.id === 'BBB')!;
    expect(bbb.ratio).toBeCloseTo(2, 10);
    expect(bbb.logRatio).toBeCloseTo(Math.log(2), 10);

    // worst-first ordering by |logRatio|
    expect(report.population.worst[0].id).toBe('BBB');

    // median of |0, ln2, 0| = 0
    expect(report.population.medianAbsLogRatio).toBeCloseTo(0, 10);
  });

  it('reports GDP per capita ratios correctly, independent of population', () => {
    expect(report.gdpPerCapita.matchedCount).toBe(3);
    const bbb = report.gdpPerCapita.worst.find((r) => r.id === 'BBB')!;
    expect(bbb.ratio).toBeCloseTo(0.5, 10);
    expect(bbb.logRatio).toBeCloseTo(-Math.log(2), 10);
  });

  it('reports Gini as a signed point difference on the 0-100 scale', () => {
    expect(report.gini.matchedCount).toBe(3);
    const ccc = report.gini.worst.find((r) => r.id === 'CCC')!;
    expect(ccc.constantsGiniPoints).toBeCloseTo(40, 10);
    expect(ccc.referenceGiniPoints).toBeCloseTo(30, 10);
    expect(ccc.diffPoints).toBeCloseTo(10, 10);
    expect(report.gini.worst[0].id).toBe('CCC'); // largest |diff|
  });

  it('reports governance as rank correlation, not a level comparison, and surfaces rank gaps', () => {
    expect(report.governance.matchedCount).toBe(3);
    expect(report.governance.indicatorUsed).toBe('GOV_WGI_GE.EST');
    // constants ranks (governance asc): CCC(0.10)=1, BBB(0.50)=2, AAA(0.90)=3
    // reference ranks (WGI asc): CCC(-1.5)=1, AAA(-1.0)=2, BBB(1.0)=3
    // => AAA and BBB disagree in order (rank gap magnitude 1 each), CCC agrees.
    expect(Number.isFinite(report.governance.spearmanRho)).toBe(true);
    expect(report.governance.spearmanRho).toBeLessThan(1); // not perfect agreement
    const aaa = report.governance.worst.find((r) => r.id === 'AAA')!;
    expect(aaa.constantsRank).toBe(3);
    expect(aaa.referenceRank).toBe(2);
    expect(aaa.rankGap).toBe(1);
  });

  it('flags a country missing from every reference series in coverage', () => {
    expect(report.coverage.totalConstantsCountries).toBe(4);
    expect(report.coverage.missingByField.population).toContain('DDD');
    expect(report.coverage.missingByField.gdpPerCapita).toContain('DDD');
    expect(report.coverage.missingByField.gini).toContain('DDD');
    expect(report.coverage.missingByField.governance).toContain('DDD');
  });

  it('renders a markdown report that mentions every field and the worst offenders', () => {
    const md = renderCountryProvenanceMarkdown(report);
    expect(md).toContain('# Country provenance report');
    expect(md).toContain('Population');
    expect(md).toContain('GDP per capita');
    expect(md).toContain('Gini index');
    expect(md).toContain('Governance');
    expect(md).toContain('BBB');
    expect(md).toContain('CCC');
    expect(md).toContain('Coverage');
  });
});

describe('compareCountryProvenance edge cases', () => {
  it('handles an empty reference gracefully (everything missing, NaN aggregates)', () => {
    const empty: CountryReferenceInput = { population: {}, gdpPerCapita: {}, gini: {}, governance: {} };
    const report = compareCountryProvenance(ROWS, empty, 10);
    expect(report.population.matchedCount).toBe(0);
    expect(report.population.missingFromReference).toHaveLength(4);
    expect(report.population.medianAbsLogRatio).toBeNaN();
    expect(report.governance.spearmanRho).toBeNaN();
    // Should still render without throwing.
    expect(() => renderCountryProvenanceMarkdown(report)).not.toThrow();
  });
});

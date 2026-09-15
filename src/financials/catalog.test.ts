import { describe, expect, it } from 'vitest';
import { financialRecords } from './catalog';
import { recipientCohorts, unavailableRecipientCohorts } from './cohorts';
import countries from '../../data/countries/wb-2026-09.json';

describe('pinned official financial collection', () => {
  it('retains independently checked annual statement values and cash signs', () => {
    const checked = [
      ['apple', 416161, 112010, 111482, 12715, 15421, 90711],
      ['microsoft', 281724, 101832, 136162, 64551, 24082, 18420],
      ['alphabet', 402836, 132170, 164713, 91447, 10049, 45709],
      ['amazon', 716924, 77670, 139514, 131819, null, null],
      ['meta', 200966, 60458, 115800, 69691, 5324, 26248],
      ['nvidia', 130497, 72880, 64089, 3236, 834, 33706],
    ];
    expect(financialRecords.map(r => [r.companyId, r.revenue, r.netIncome, r.operatingCashFlow, r.cashCapitalInvestment, r.dividends, r.repurchases])).toEqual(checked);
    for (const r of financialRecords) {
      expect(new Set(r.evidence.map(e => e.field)).size).toBe(6);
      for (const e of r.evidence) {
        const outflow = ['cashCapitalInvestment', 'dividends', 'repurchases'].includes(e.field);
        const raw = r[e.field];
        expect(e.reportedValue).toBe(raw === null ? null : outflow ? -raw : raw);
        expect(e.locator.length).toBeGreaterThan(10);
      }
      expect(r.currency).toBe('USD'); expect(r.unit).toBe('million-USD');
      expect(Date.parse(r.periodEnd)).toBeGreaterThan(Date.parse(r.periodStart));
      expect(Date.parse(r.reportDate)).toBeGreaterThan(Date.parse(r.periodEnd));
      expect(new URL(r.sourceUrl).hostname).toMatch(/^(www\.(apple|microsoft|sec)\.(com|gov))$/);
    }
  });
  it('keeps incompatible investment definitions visible', () => {
    expect(financialRecords.find(r => r.companyId === 'nvidia')!.cashCapitalInvestmentLabel).toContain('intangible');
    expect(financialRecords.find(r => r.companyId === 'amazon')!.cashCapitalInvestmentNote).toContain('Gross');
    expect(financialRecords.find(r => r.companyId === 'apple')!.sourceTitle).toContain('unaudited');
  });
  it('reproduces every sourced resident count, year and conversion; no invented countries', () => {
    for (const cohort of recipientCohorts) {
      const country = countries.countries.find(c => c.id === cohort.id)!;
      expect(country.population.status).toBe('observed');
      expect(cohort.population).toBe(country.population.raw);
      expect(cohort.year).toBe(country.population.year);
      expect(cohort.populationMillions * 1e6).toBeCloseTo(cohort.population, 4);
    }
    expect(unavailableRecipientCohorts.map(c => c.id)).toEqual(['TWN']);
  });
});

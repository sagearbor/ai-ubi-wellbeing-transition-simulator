import type { Corporation, CountryStats } from '../../types';
import { allocateConditional } from '../../simulation/conditionalWorld';
import { usdPerPerson } from '../../simulation/units';

/** View adapter only: all funding/allocation comes from the production allocator.
 * Eligibility is explicit even for a zero request; positive receipts are not an eligibility test.
 * Populations are millions of residents from this actual run, never the initial dataset.
 */
export function selectedFunding(countries: Record<string, CountryStats>, corporation: Corporation) {
  const allocation = allocateConditional(countries, [corporation]);
  const ids = corporation.distributionStrategy === 'global' ? Object.keys(countries)
    : corporation.distributionStrategy === 'hq-local' ? [corporation.headquartersCountry] : corporation.operatingCountries;
  const recipients = ids.map(id => {
    const r = allocation.receipts[id];
    const amount = r.global + r.local + r.customer;
    return { id, name: countries[id].name, population: countries[id].population, amount,
      perPerson: usdPerPerson(amount, countries[id].population) };
  });
  const population = recipients.reduce((sum, r) => sum + r.population, 0);
  const budget = allocation.budgets[corporation.id];
  return { budget, recipients, population, perPerson: usdPerPerson(budget.actual, population) };
}
export type FundingView = ReturnType<typeof selectedFunding>;
export const allocationNames = { global: 'All modeled residents', 'customer-weighted': 'Operating-country residents', 'hq-local': 'Headquarters-country residents' } as const;

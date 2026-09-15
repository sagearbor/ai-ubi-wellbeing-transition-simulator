import type { Corporation, CountryStats } from '../types';

/** One source of truth for funded amounts in rankings, rows and totals. */
export function actualContribution(corporation: Corporation): number {
  return corporation.sourceBudget?.actual ?? corporation.aiRevenue * corporation.contributionRate;
}

/** Conditional request sorting uses the active monetary request, never a dormant share. */
export function activeRequestSortValue(corporation: Corporation): number {
  return corporation.sourceBudget?.requested ?? corporation.contributionRate;
}

export function topContributors(corporations: Corporation[], count = 5): Corporation[] {
  return [...corporations].sort((a, b) => actualContribution(b) - actualContribution(a)).slice(0, count);
}

/** The bar is bounded for display only. Raw conditional values remain visible as numbers. */
export function countryWellbeingDisplay(country: CountryStats) {
  const value = country.conditionalWellbeing?.raw ?? country.wellbeing;
  return {
    value,
    barPercent: Math.max(0, Math.min(100, value)),
    label: country.conditionalWellbeing ? 'Conditional wellbeing index' : 'Wellbeing',
    outsideScale: !!country.conditionalWellbeing && !country.conditionalWellbeing.valid,
  };
}

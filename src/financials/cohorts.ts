import countries from '../../data/countries/wb-2026-09.json';
import type { RecipientCohort } from './types';
const populationSource = countries.sources['SP.POP.TOTL'];
/** Only sourced residents: the existing dataset's unsourced Taiwan row is unavailable. */
export const recipientCohorts: RecipientCohort[] = countries.countries.flatMap(country => {
  const p = country.population;
  if (p.status !== 'observed' || p.year === null || !('raw' in p) || typeof p.raw !== 'number') return [];
  if (!Number.isSafeInteger(p.raw) || p.raw <= 0) throw new Error(`Invalid sourced population: ${country.id}`);
  // Use the stored source count, not the rounded engine display in millions.
  return [{ id: country.id, name: country.name, population: p.raw, populationMillions: p.raw / 1e6,
    year: p.year, sourceUrl: populationSource.url, sourceTitle: populationSource.name,
    retrievedAt: populationSource.retrievedAt, datasetId: countries.datasetId,
    conversion: 'Raw SP.POP.TOTL people; millions = raw / 1,000,000. Rounded legacy engine millions are not used.' }];
});
export const unavailableRecipientCohorts = countries.countries.filter(c => !recipientCohorts.some(r => r.id === c.id))
  .map(c => ({ id: c.id, name: c.name, reason: 'No sourced resident count in this pinned dataset; its legacy unsourced value is not used.' }));
export function recipientCohort(id: string): RecipientCohort {
  const cohort = recipientCohorts.find(c => c.id === id);
  if (!cohort) throw new Error(`Unknown or unsourced recipient country: ${id}`);
  return cohort;
}

import legacy from '../../data/financials/fy2025-v1.json';
import current from '../../data/financials/fy2025-v2.json';
import type { FinancialRecord } from './types';
const catalog = [legacy, current].map(collection => ({
  id: collection.collectionId, title: collection.title, coverage: collection.coverage,
  convention: collection.convention, retrievedAt: collection.retrievedAt,
  records: collection.records as FinancialRecord[],
}));
export const financialCollections = catalog;
/** Only new experiments default to the current revision; saved ones supply their own id. */
export const financialCollection = catalog[1];
export const financialRecords = financialCollection.records;
export function getFinancialCollection(id: string = financialCollection.id) {
  const collection = catalog.find(c => c.id === id);
  if (!collection) throw new Error(`Unknown financial collectionId: ${id}`);
  return collection;
}
export function financialRecord(id: string, collectionId = financialCollection.id): FinancialRecord {
  const record = getFinancialCollection(collectionId).records.find(r => r.id === id);
  if (!record) throw new Error(`Unknown financial record: ${id}`);
  return record;
}

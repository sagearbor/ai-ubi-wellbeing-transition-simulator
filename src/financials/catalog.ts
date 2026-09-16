import collection from '../../data/financials/fy2025-v1.json';
import type { FinancialRecord } from './types';
export const financialRecords: FinancialRecord[] = collection.records as FinancialRecord[];
export const financialCollection = {
  id: collection.collectionId, title: collection.title, coverage: collection.coverage,
  convention: collection.convention, retrievedAt: collection.retrievedAt,
};
export function financialRecord(id: string): FinancialRecord {
  const record = financialRecords.find(r => r.id === id);
  if (!record) throw new Error(`Unknown financial record: ${id}`);
  return record;
}

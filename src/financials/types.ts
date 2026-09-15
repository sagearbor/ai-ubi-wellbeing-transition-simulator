/** Pinned observations are nominal USD millions; scenario assumptions are separate. */
export type FinancialField = 'revenue' | 'netIncome' | 'operatingCashFlow' | 'cashCapitalInvestment' | 'dividends' | 'repurchases';
export interface FinancialEvidence {
  field: FinancialField;
  statement: string;
  lineItem: string;
  locator: string;
  reportedValue: number | null;
  /** Inference from the cited statements, never a separately printed reported value. */
  derivedValue?: number;
  /** Cash outflows retain their negative sign here, but use positive magnitudes in the record. */
  note?: string;
}
export interface FinancialRecord {
  id: string;
  companyId: string;
  companyName: string;
  fiscalYear: number;
  periodStart: string;
  periodEnd: string;
  currency: 'USD';
  unit: 'million-USD';
  revenue: number | null;
  netIncome: number | null;
  operatingCashFlow: number;
  cashCapitalInvestment: number;
  cashCapitalInvestmentLabel: string;
  cashCapitalInvestmentNote: string;
  dividends: number | null;
  repurchases: number | null;
  sourceUrl: string;
  sourceTitle: string;
  reportDate: string;
  retrievedAt: string;
  sourceExcerpt: string;
  consolidation: string;
  evidence: FinancialEvidence[];
}
export interface FinancialScenario {
  policyShare: number;
  trainingShare: number;
  recipientCountry: string;
  costPerCompletion: number;
  instructorCapacity: number;
  eligibleTrainees: number;
  placementRate: number;
  suitableOpenings: number;
}
export interface RecipientCohort {
  id: string;
  name: string;
  population: number;
  populationMillions: number;
  year: number;
  sourceUrl: string;
  sourceTitle: string;
  retrievedAt: string;
  datasetId: string;
  conversion: string;
}

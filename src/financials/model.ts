import type { CoreModel, Parameter, Source, Variable } from '../core/types';
import { recipientCohort } from './cohorts';
import type { FinancialRecord, FinancialScenario } from './types';

export const defaultFinancialScenario: FinancialScenario = {
  policyShare: .1, trainingShare: 0, recipientCountry: 'USA', costPerCompletion: 5000,
  instructorCapacity: 100000, eligibleTrainees: 1000000, placementRate: .5, suitableOpenings: 50000,
};
export const financialModelMetadata = {
  boundary: 'A proposed allocation of one company’s reported annual cash flow, before dividends and buybacks. It may redirect existing uses. This is not idle cash or measured AI-generated cash.',
  timeBasis: 'One fiscal year; monthly payment = annual resident allocation divided by 12 and resident count. Not a forecast or observed monthly cash flow.',
  allocationConvention: 'Raw source cash flow = operating cash flow minus the reported cash investment item. Allocation ceiling = max(0, raw source cash flow).',
  trainingBoundary: 'Training cost, capacity, eligibility, placement rate and openings are scenario assumptions. Gross placements do not estimate net jobs or causal wellbeing effects. Unspent training money stays unspent.',
};

function finite(name: string, value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
}
export function validateFinancialScenario(scenario: FinancialScenario): void {
  if (!scenario || typeof scenario !== 'object') throw new Error('Missing financial scenario');
  for (const key of ['policyShare', 'trainingShare', 'placementRate'] as const) {
    finite(key, scenario[key]);
    if (scenario[key] < 0 || scenario[key] > 1) throw new Error(`${key} must be between 0 and 1`);
  }
  for (const key of ['costPerCompletion', 'instructorCapacity', 'eligibleTrainees', 'suitableOpenings'] as const) {
    finite(key, scenario[key]);
    if (scenario[key] < 0 || (key === 'costPerCompletion' && scenario[key] === 0)) throw new Error(`${key} is outside its allowed range`);
  }
  recipientCohort(scenario.recipientCountry);
}
export function createFinancialModel(record: FinancialRecord, scenario: FinancialScenario): CoreModel {
  validateFinancialScenario(scenario);
  if (!record || record.currency !== 'USD' || record.unit !== 'million-USD') throw new Error('Financial record requires USD millions');
  finite('operatingCashFlow', record.operatingCashFlow);
  finite('cashCapitalInvestment', record.cashCapitalInvestment);
  if (record.cashCapitalInvestment < 0) throw new Error('Cash investment must be a nonnegative outflow magnitude');
  if (!Number.isInteger(record.fiscalYear)) throw new Error('Missing fiscal year');
  const operating = record.operatingCashFlow * 1e6;
  const investment = record.cashCapitalInvestment * 1e6;
  // Validate representability, not an arbitrary policy ceiling. Engine checks all results too.
  for (const [name, value] of Object.entries({ operating, investment, difference: operating - investment,
    fundedCompletions: Math.max(0, operating - investment) * scenario.policyShare * scenario.trainingShare / scenario.costPerCompletion })) finite(name, value);
  const cohort = recipientCohort(scenario.recipientCountry);
  const reported: Source = { label: `${record.companyName} FY${record.fiscalYear}: reported observation`, url: record.sourceUrl,
    note: `${record.periodStart}–${record.periodEnd}; source USD millions converted once to nominal dollars; report ${record.reportDate}, retrieved ${record.retrievedAt}. ${record.cashCapitalInvestmentLabel}. ${record.cashCapitalInvestmentNote}` };
  const assumed: Source = { label: 'Editable policy scenario assumption', kind: 'assumed' };
  const parameter = (id: string, value: number, unit: string, source = assumed): Parameter => ({ id, value, unit, source });
  const variables: Variable[] = [
    { id: 'source_cash_flow', equation: 'reported_operating_cash_flow - reported_cash_investment', unit: 'usd', description: 'Raw annual difference; negative values remain visible.' },
    { id: 'allocatable_base', equation: 'max(0, source_cash_flow)', unit: 'usd', description: 'Explicit nonnegative allocation ceiling, before existing shareholder distributions.' },
    { id: 'policy_budget', equation: 'allocatable_base * policy_share', unit: 'usd' },
    { id: 'training_budget', equation: 'policy_budget * training_share', unit: 'usd' },
    { id: 'dividend_spend', equation: 'policy_budget - training_budget', unit: 'usd', description: 'Proposed resident payments, distinct from reported shareholder dividends.' },
    { id: 'completions', equation: 'min(training_budget / cost_per_completion, instructor_capacity, eligible_trainees, recipient_population)', unit: 'people', description: 'Continuous expected completion count; budget, capacity, eligibility and residents all constrain it.' },
    { id: 'actual_training_spend', equation: 'completions * cost_per_completion', unit: 'usd' },
    { id: 'unspent_training', equation: 'training_budget - actual_training_spend', unit: 'usd', description: 'Unused training money; never automatically diverted to residents.' },
    { id: 'placements', equation: 'min(completions * placement_rate, suitable_openings)', unit: 'people', description: 'Gross expected placements, not net jobs or causal impact.' },
    { id: 'monthly_dividend_per_person', equation: 'dividend_spend / 12 / recipient_population', unit: 'usd/person/month' },
  ].map(v => ({ ...v, hook: false }));
  return {
    schemaVersion: 1, id: `reported-allocation-${record.id}`, name: `${record.companyName} FY${record.fiscalYear}: cash-flow allocation`,
    description: `${financialModelMetadata.allocationConvention} ${record.cashCapitalInvestmentLabel}. ${record.cashCapitalInvestmentNote}`,
    scope: `${financialModelMetadata.boundary} ${financialModelMetadata.timeBasis} ${financialModelMetadata.trainingBoundary}`,
    sources: [reported, { label: `${cohort.sourceTitle}, ${cohort.year} residents, ${cohort.name}`, url: cohort.sourceUrl, note: `${cohort.datasetId}; retrieved ${cohort.retrievedAt}; ${cohort.conversion}` }, assumed],
    time: { start: record.fiscalYear, end: record.fiscalYear, step: 'year' },
    parameters: [
      parameter('reported_operating_cash_flow', operating, 'usd', reported),
      parameter('reported_cash_investment', investment, 'usd', { ...reported, label: record.cashCapitalInvestmentLabel }),
      parameter('recipient_population', cohort.population, 'people', { label: `${cohort.name}, sourced ${cohort.year} residents`, url: cohort.sourceUrl, note: cohort.conversion }),
      parameter('policy_share', scenario.policyShare, 'share'), parameter('training_share', scenario.trainingShare, 'share'),
      parameter('cost_per_completion', scenario.costPerCompletion, 'usd/person'), parameter('instructor_capacity', scenario.instructorCapacity, 'people'),
      parameter('eligible_trainees', scenario.eligibleTrainees, 'people'), parameter('placement_rate', scenario.placementRate, 'share'), parameter('suitable_openings', scenario.suitableOpenings, 'people'),
    ], variables, outputs: variables.map(v => v.id),
    invariants: [
      { id: 'pinned-observations', expr: `reported_operating_cash_flow == ${operating} and reported_cash_investment == ${investment} and recipient_population == ${cohort.population}`, description: 'Reported observations stay pinned; changing observations requires an explicit model fork and revised provenance.' },
      { id: 'valid-shares', expr: 'policy_share >= 0 and policy_share <= 1 and training_share >= 0 and training_share <= 1 and placement_rate >= 0 and placement_rate <= 1' },
      { id: 'valid-inputs', expr: 'cost_per_completion > 0 and instructor_capacity >= 0 and eligible_trainees >= 0 and suitable_openings >= 0 and recipient_population > 0 and reported_cash_investment >= 0' },
      { id: 'within-source-ceiling', expr: 'policy_budget >= 0 and policy_budget <= allocatable_base' },
      { id: 'conserve-policy-budget', expr: 'abs(policy_budget - dividend_spend - training_budget) <= max(0.000001, abs(policy_budget) * 1e-12)' },
      { id: 'conserve-training-budget', expr: 'abs(training_budget - actual_training_spend - unspent_training) <= max(0.000001, abs(training_budget) * 1e-12)' },
      { id: 'nonnegative-spending', expr: 'dividend_spend >= 0 and training_budget >= 0 and actual_training_spend >= 0 and unspent_training >= -max(0.000001, training_budget * 1e-12)' },
      { id: 'training-spend-limit', expr: 'actual_training_spend <= training_budget + max(0.000001, training_budget * 1e-12)' },
      { id: 'completion-limits', expr: 'completions >= 0 and completions <= instructor_capacity and completions <= eligible_trainees and completions <= recipient_population' },
      { id: 'placement-limits', expr: 'placements >= 0 and placements <= completions and placements <= suitable_openings and placements <= recipient_population' },
      { id: 'resident-accounting', expr: 'abs(monthly_dividend_per_person * 12 * recipient_population - dividend_spend) <= max(0.000001, abs(dividend_spend) * 1e-12)' },
    ],
  };
}

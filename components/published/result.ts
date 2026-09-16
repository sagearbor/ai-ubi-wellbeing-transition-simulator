import type { JobState } from '../lab/useRunnerJob';
import type { LabPointResult } from '../../src/workers/protocol';
export function currentFinancialResult(state: JobState<LabPointResult>, key: string) {
  if (state.status !== 'done' || state.resultKey !== key || !state.result) return null;
  const plain = state.result.plain;
  if (!plain.ok || plain.diagnostics.some(d => d.level === 'error')) return null;
  const required = ['source_cash_flow','allocatable_base','policy_budget','training_budget','dividend_spend','completions','actual_training_spend','unspent_training','placements','monthly_dividend_per_person'];
  if (required.some(id => plain.series._?.[id]?.length !== 1)) return null;
  if (!plain.series._ || Object.values(plain.series._).some(s => s.some(v => !Number.isFinite(v)))) return null;
  return plain;
}

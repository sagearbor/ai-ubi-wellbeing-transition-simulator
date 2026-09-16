import type { CoreModel } from '../core/types';
import { resolveModel } from '../core/engine';
import { modelHash } from '../policy/hash';
import { financialRecords } from './catalog';
import { recipientCohorts } from './cohorts';
import { createFinancialModel } from './model';

/** Presentation-only recognition. A familiar ID or a URL alone is never evidence.
 * Reconstruct the complete authored model from pinned observations and require exact
 * normalized content equality, including sources, invariants and equations.
 */
export function reportedFinancialParameters(model: CoreModel, displayedValues?: Record<string, number>): Set<string> {
  const none = new Set<string>();
  const record = financialRecords.find(r => model.id === `reported-allocation-${r.id}`);
  if (!record) return none;
  const parameters = Object.fromEntries(model.parameters.map(p => [p.id, p.value]));
  const cohort = recipientCohorts.find(c => c.population === parameters.recipient_population);
  if (!cohort) return none;
  try {
    const authored = createFinancialModel(record, {
      recipientCountry: cohort.id,
      policyShare: parameters.policy_share, trainingShare: parameters.training_share,
      costPerCompletion: parameters.cost_per_completion, instructorCapacity: parameters.instructor_capacity,
      eligibleTrainees: parameters.eligible_trainees, placementRate: parameters.placement_rate,
      suitableOpenings: parameters.suitable_openings,
    });
    if (modelHash(resolveModel(model, []).model) !== modelHash(resolveModel(authored, []).model)) return none;
    return new Set(['reported_operating_cash_flow', 'reported_cash_investment', 'recipient_population']
      .filter(id => (displayedValues?.[id] ?? parameters[id]) === parameters[id]));
  } catch { return none; }
}

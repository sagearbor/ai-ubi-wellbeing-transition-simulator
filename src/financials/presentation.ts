import type { CoreModel } from '../core/types';
import { resolveModel } from '../core/engine';
import { modelHash } from '../policy/hash';
import { financialCollections, getFinancialCollection } from './catalog';
import { recipientCohorts } from './cohorts';
import { createFinancialModel } from './model';

/** Presentation-only recognition. A familiar ID or a URL alone is never evidence.
 * Reconstruct the complete authored model from pinned observations and require exact
 * normalized content equality, including sources, invariants and equations.
 */
export function financialRecordForModel(model: CoreModel, collectionId?: string) {
  try {
    const collections = collectionId === undefined ? financialCollections : [getFinancialCollection(collectionId)];
    const records = collections.flatMap(collection => collection.records).filter(r => model.id === `reported-allocation-${r.id}`);
    if (!records.length) return undefined;
    const parameters = Object.fromEntries(model.parameters.map(p => [p.id, p.value]));
    const cohort = recipientCohorts.find(c => c.population === parameters.recipient_population);
    if (!cohort) return undefined;
    const actualHash = modelHash(resolveModel(model, []).model);
    return records.find(record => {
      const authored = createFinancialModel(record, {
        recipientCountry: cohort.id,
        policyShare: parameters.policy_share, trainingShare: parameters.training_share,
        costPerCompletion: parameters.cost_per_completion, instructorCapacity: parameters.instructor_capacity,
        eligibleTrainees: parameters.eligible_trainees, placementRate: parameters.placement_rate,
        suitableOpenings: parameters.suitable_openings,
      });
      return actualHash === modelHash(resolveModel(authored, []).model);
    });
  } catch { return undefined; }
}
export function reportedFinancialParameters(model: CoreModel, displayedValues?: Record<string, number>): Set<string> {
  if (!financialRecordForModel(model)) return new Set();
  const parameters = Object.fromEntries(model.parameters.map(p => [p.id, p.value]));
  return new Set(['reported_operating_cash_flow', 'reported_cash_investment', 'recipient_population']
    .filter(id => (displayedValues?.[id] ?? parameters[id]) === parameters[id]));
}

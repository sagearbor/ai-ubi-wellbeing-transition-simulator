/**
 * Registry of bundled core models and overlays (data/core/). Add a model here after its own
 * `tests` pass under `npm run validate:core`. The Lab tab lists these as "Start from".
 */
import type { CoreModel, Overlay } from './types';
import trainingBudget from '../../data/core/training-budget.json';
import minimal from '../../data/core/minimal.json';
import tutoring from '../../data/core/overlays/tutoring.json';
import poolAllocation from '../../data/core/pool-allocation.json';
import marketClearing from '../../data/core/market-clearing.json';
import cohortFlow from '../../data/core/cohort-flow.json';
import retraining from '../../data/core/overlays/retraining.json';

export interface FixtureEntry {
  model: CoreModel;
  /** Overlays that apply to this model, offered as toggles. */
  overlays: Overlay[];
  /** Short label for the picker. */
  label: string;
}

export const CORE_FIXTURES: FixtureEntry[] = [
  { model: trainingBudget as unknown as CoreModel, overlays: [], label: 'Training funding meets a jobs constraint' },
  { model: minimal as unknown as CoreModel, overlays: [tutoring as unknown as Overlay], label: 'Income and wellbeing (three variables)' },
  { model: poolAllocation as unknown as CoreModel, overlays: [], label: 'A shared pool with absorptive-capacity limits' },
  { model: marketClearing as unknown as CoreModel, overlays: [], label: 'Linear supply and demand with a demand shift' },
  { model: cohortFlow as unknown as CoreModel, overlays: [retraining as unknown as Overlay], label: 'Displaced-worker cohort pool (monthly inflow/outflow)' },
];

export function findFixture(id: string): FixtureEntry | undefined {
  return CORE_FIXTURES.find((f) => f.model.id === id);
}

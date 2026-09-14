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
import korinek2026 from '../../data/core/korinek-2026.json';
import korinekModest from '../../data/core/overlays/korinek-modest.json';
import korinekExtreme from '../../data/core/overlays/korinek-extreme.json';
import korinekFaithful from '../../data/core/korinek-2026-faithful.json';
import korinekFaithfulModest from '../../data/core/overlays/korinek-faithful-modest.json';
import korinekFaithfulExtreme from '../../data/core/overlays/korinek-faithful-extreme.json';
import korinekFaithfulPegged from '../../data/core/overlays/korinek-faithful-pegged-rental.json';
import korinekFaithfulRigid from '../../data/core/overlays/korinek-faithful-rigid-wage.json';
import alaskaPfd from '../../data/core/alaska-pfd-calibration.json';
import alaskaPfdWp from '../../data/core/overlays/alaska-pfd-wp2020.json';
import gasteigerPrettner from '../../data/core/gasteiger-prettner-2020.json';
import gasteigerPrettnerMu04 from '../../data/core/overlays/gasteiger-prettner-mu04.json';
import gasteigerPrettnerMu06 from '../../data/core/overlays/gasteiger-prettner-mu06.json';

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
  {
    model: korinek2026 as unknown as CoreModel,
    overlays: [korinekModest as unknown as Overlay, korinekExtreme as unknown as Overlay],
    label: 'Korinek et al. 2026, reduced-form approximation (illustrative legacy; use the faithful port)',
  },
  {
    model: korinekFaithful as unknown as CoreModel,
    overlays: [
      korinekFaithfulModest as unknown as Overlay,
      korinekFaithfulExtreme as unknown as Overlay,
      korinekFaithfulPegged as unknown as Overlay,
      korinekFaithfulRigid as unknown as Overlay,
    ],
    label: 'Korinek et al. 2026, faithful port (paper equations), US 2024-2030',
  },
  {
    model: alaskaPfd as unknown as CoreModel,
    overlays: [alaskaPfdWp as unknown as Overlay],
    label: 'Alaska Permanent Fund Dividend: income effect vs spending effect on jobs (Jones and Marinescu 2022)',
  },
  {
    model: gasteigerPrettner as unknown as CoreModel,
    overlays: [gasteigerPrettnerMu04 as unknown as Overlay, gasteigerPrettnerMu06 as unknown as Overlay],
    label: 'Gasteiger and Prettner 2020: robots, stagnation and a robot tax paid to workers (OLG, one step = one generation)',
  },
];

export function findFixture(id: string): FixtureEntry | undefined {
  return CORE_FIXTURES.find((f) => f.model.id === id);
}

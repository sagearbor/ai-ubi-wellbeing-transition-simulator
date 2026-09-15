import React from 'react';
import type { ModelParameters, SimulationState } from '../../types';
import { resolveRunCapabilities } from '../../simulation/capabilities';
import type { QualificationResult } from '../../simulation/qualification';

interface Props {
  model: ModelParameters;
  state: SimulationState;
  qualification: QualificationResult;
  uploadedModelName?: string;
  equationIssue?: string;
}

/** Describe the actual output family; qualification authority is conditional-only. */
export default function ScenarioContext({ model, state, qualification, uploadedModelName, equationIssue }: Props) {
  const capabilities = resolveRunCapabilities(model);
  const conditional = capabilities.conditional && state.executionMode === 'world-conditional-v1'
    && state.outputDefinition?.flowConvention === 'monthly-flow-at-month' && !uploadedModelName && !equationIssue;
  const anchored = model.macro?.wellbeingMode === 'anchored';
  let status: string;
  let description: string;

  if (equationIssue || (uploadedModelName && capabilities.conditional)) {
    status = 'Uploaded equations · unsupported calculation';
    description = 'The selected uploaded equations do not provide a supported calculation for this model. The retained snapshot is not a result from those hooks.';
  } else if (conditional) {
    status = qualification.accounting === 'reviewed-conditional'
      ? 'Accounting reviewed for these inputs'
      : 'Your scenario · accounting unreviewed';
    description = 'Monthly-flow snapshot, not elapsed payments. Macro paths and the conditional wellbeing index are illustrative.';
  } else if (anchored) {
    status = 'Provisional level model · illustrative';
    description = 'The active output is a provisional wellbeing level under macro assumptions. Its wellbeing mapping is not independently reviewed.';
  } else if (!capabilities.conditional) {
    status = uploadedModelName ? 'Uploaded world equations · unreviewed' : 'Legacy world flow · illustrative';
    description = 'The active output is the legacy world wellbeing index. Interpret it using this model’s own equations, sources and limitations.';
  } else {
    status = 'Output definition unavailable';
    description = 'This snapshot has no compatible conditional output definition. No accounting review is asserted for it.';
  }

  return (
    <div className="guided-context" data-testid="active-model">
      <div>
        <strong>{uploadedModelName ?? model.name}</strong>
        <span className="guided-status">{status}</span>
      </div>
      <p>Month {state.month} · {description}</p>
      {model.macro?.usReference && (
        <p>The United States macro reference ends in January 2030. Other countries and the wellbeing bridge retain this model’s assumptions.</p>
      )}
    </div>
  );
}

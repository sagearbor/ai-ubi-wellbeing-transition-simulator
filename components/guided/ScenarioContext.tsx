import React from 'react';
import type { QualificationResult } from '../../simulation/qualification';
export default function ScenarioContext({ name, month, qualification }: {name: string; month:number; qualification:QualificationResult}) {
  return <div className="guided-context" data-testid="active-model"><div><strong>{name}</strong><span className="guided-status">{qualification.accounting === 'reviewed-conditional' ? 'Accounting reviewed for these inputs' : 'Your scenario · accounting unreviewed'}</span></div><p>Month {month} · monthly-flow snapshot, not elapsed payments. Macro paths and the conditional wellbeing index are illustrative.</p></div>;
}

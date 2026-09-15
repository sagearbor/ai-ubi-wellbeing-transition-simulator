import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { reportedFinancialParameters } from './presentation';
import { financialRecords } from './catalog';
import { createFinancialModel, defaultFinancialScenario } from './model';
import { resolveModel } from '../core/engine';
import { countAssumptions } from '../../components/lab/labState';
import AssumptionsPanel from '../../components/lab/AssumptionsPanel';
const authored = () => createFinancialModel(financialRecords[0], defaultFinancialScenario);
function render(model = authored(), values: Record<string,number> = {}) {
  return renderToString(<AssumptionsPanel model={model} values={values} edited={new Set()} onEdit={()=>{}} onResetAll={()=>{}} inputSeries={{}} years={[2025]}/>).replace(/<!-- -->/g,'');
}
describe('narrow reported observation presentation', () => {
  it.each(financialRecords)('recognizes exact $companyName authored and resolved models', record => {
    const model = createFinancialModel(record, {...defaultFinancialScenario,policyShare:.37,trainingShare:.81,recipientCountry:'GBR'});
    for (const candidate of [model,resolveModel(model,[]).model]) {
      const observed = reportedFinancialParameters(candidate);
      expect([...observed]).toEqual(['reported_operating_cash_flow','reported_cash_investment','recipient_population']);
      expect(countAssumptions(candidate.parameters,observed).text).toBe('7 of 10 parameters are assumptions');
    }
  });
  it('renders three readonly observations with sources and seven editable assumptions', () => {
    const html=render();expect(html).toContain('7 of 10 parameters are assumptions');
    for(const id of reportedFinancialParameters(authored())) {
      expect(html.match(new RegExp(`<input[^>]+id="lab-param-${id}"[^>]*>`))?.[0]).toContain('readOnly=""');
    }
    expect((html.match(/readOnly=""/g)||[])).toHaveLength(3);
    expect(html).toContain('Reported observation');expect(html).toContain(`href="${financialRecords[0].sourceUrl.replace(/&/g,'&amp;')}"`);
    expect(html.match(/<input[^>]+id="lab-param-policy_share"[^>]*>/)?.[0]).not.toContain('readOnly');
  });
  it.each(['id','value','source','equation','invariant'])('does not reward a finance-looking model with altered %s', change => {
    const model=authored();
    if(change==='id')model.id='another-import';
    if(change==='value')model.parameters[0].value+=1;
    if(change==='source')model.parameters[0].source!.url='https://example.org';
    if(change==='equation')model.variables[0].equation='1';
    if(change==='invariant')model.invariants=[];
    expect(reportedFinancialParameters(model).size).toBe(0);
    const html=render(model);expect(html).toContain('10 of 10 parameters are assumptions');expect(html).not.toContain('Reported observation');expect(html).not.toContain('readOnly=""');expect(html).toContain('Nothing measured it');
  });
  it('does not label an overridden displayed observation as reported',()=>{
    const model=authored();const values={reported_operating_cash_flow:1};
    expect(reportedFinancialParameters(model,values).has('reported_operating_cash_flow')).toBe(false);
    expect(render(model,values).match(/<input[^>]+id="lab-param-reported_operating_cash_flow"[^>]*>/)?.[0]).not.toContain('readOnly');
  });
  it('preserves generic absent-kind fallback even with a source URL',()=>{
    const model=authored();model.id='unrelated';expect(countAssumptions(model.parameters).assumptions).toBe(10);expect(render(model)).not.toContain('Reported observation');
  });
});

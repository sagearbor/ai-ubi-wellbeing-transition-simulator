import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PublishedExperience from './PublishedExperience';
import { currentFinancialResult } from './result';
import { buildExperiment, exactModel } from '../../src/financials/share';
import { createSyncRunner } from '../../src/workers/client';
import type { JobState } from '../lab/useRunnerJob';
import type { LabPointResult } from '../../src/workers/protocol';
const runner = createSyncRunner();
function html(mode: 'explore'|'compare' = 'explore', error?: string) { return renderToString(<PublishedExperience mode={mode} error={error} runner={runner} onMode={()=>{}} onLab={()=>{}} onWorld={()=>{}} onHistory={()=>{}} onRisk={()=>{}}/>).replace(/<!-- -->/g,''); }
describe('published source and outcome view', () => {
  it('renders real Apple worker outputs, adjacent sources and competing uses', () => {
    const view=html();expect(view).toContain('$2.42');expect(view).toContain('$98.77 billion');expect(view).toContain('340,003,797');expect(view).toContain('Share repurchases');expect(view).toContain('Reported');expect(view).toContain('not measured AI-generated cash');expect(view).toContain('target="_blank"');
  });
  it('provides two editable panels, friendly constraints and the required authoring paths', () => {
    const view=html('compare');expect((view.match(/role="group" aria-label="Allocation of proposed policy budget"/g)||[])).toHaveLength(2);for(const label of ['Policy share A percent','Policy share B percent','Training share B percent','Instructor capacity limits','training equations B','Paste a policy','Add a variable','Explore uncertainty','Explore change over time','AI risk','Open saved experiment']) expect(view).toContain(label);
  });
  it('does not replace an invalid shared experiment with default results',()=>{const view=html('explore','Stale dataHash');expect(view).toContain('Stale dataHash');expect(view).not.toContain('$2.42');expect(view).not.toContain('Scenario A');});
  it('only publishes successful current semantic results, never pending, stale or failed output', () => {
    const model=exactModel(buildExperiment(),'A');const outcome=runner.runSync({kind:'lab-point',model,overlays:[],hypotheticalOverlays:null});if(outcome.status!=='done')throw new Error('Run failed');
    const state: JobState<LabPointResult>={status:'done',result:outcome.result,resultKey:'current',progress:null,message:null,problems:[],elapsedMs:0};
    expect(currentFinancialResult(state,'current')).toBe(outcome.result.plain);
    expect(currentFinancialResult(state,'changed')).toBeNull();expect(currentFinancialResult({...state,status:'running'},'current')).toBeNull();expect(currentFinancialResult({...state,status:'error'},'current')).toBeNull();
    expect(currentFinancialResult({...state,result:{...outcome.result,plain:{...outcome.result.plain,ok:false}}},'current')).toBeNull();
    expect(currentFinancialResult({...state,result:{...outcome.result,plain:{...outcome.result.plain,diagnostics:[{level:'error',code:'invariant-violated',message:'Broken accounting'}]}}},'current')).toBeNull();
  });
});

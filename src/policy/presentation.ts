import type { CoreModel } from '../core/types';
import { steadyStateOf } from '../core/calendar';
import type { PairedRunResult, PolicyDraft } from './types';
/** Inventory, not an inferred causal dependency graph or acceptance of source.kind. */
export function policyEvidenceInventory(model: CoreModel, draft: PolicyDraft) {
  return {
    settings: draft.provisions.filter(p=>p.status==='mapped' && p.role!=='coefficient' && p.mapping?.kind!=='effect'),
    responses: draft.provisions.filter(p=>p.status==='mapped' && (p.role==='coefficient'||p.mapping?.kind==='effect')),
    unsupported: draft.provisions.filter(p=>p.status!=='mapped'),
    declarations: [
      ...model.parameters.map(p=>({id:p.id, type:'Parameter', value:`${p.value} ${p.unit??''}`, source:p.source})),
      ...(model.inputs??[]).map(p=>({id:p.id,type:'Input path',value:`${JSON.stringify(p.curve)} ${p.unit??''}`,source:p.source})),
      ...model.variables.map(p=>({id:p.id,type:'Equation',value:p.equation,source:undefined})),
      ...(model.effects??[]).map(p=>({id:p.id,type:'Model effect',value:`${p.target} ${p.op} ${p.expr}`,source:p.source})),
    ],
  };
}
/** Differences refer only to the displayed first entity, across all displayed quantiles.
 * Steady-state outputs retain their fixed displayed index at every selected time. */
export function firstChangedDisplayYear(model: CoreModel, result: PairedRunResult, selectedIndex: number): number | null {
  const entity=result.entities[0]; const steady=steadyStateOf(model);
  const fixed=steady?result.years.findIndex(y=>Math.abs(y-steady.at)<1e-9):-1;
  const changed=(i:number)=>result.outputs.some(o=>{
    const index=steady?.outputs.has(o)&&fixed>=0?fixed:i;
    const q=result.difference[entity]?.[o];
    return q && (['p5','p50','p95'] as const).some(k=>Number.isFinite(q[k][index]) && q[k][index]!==0);
  });
  const complete=result.outputs.length>0 && result.outputs.every(o=>{
    const index=steady?.outputs.has(o)&&fixed>=0?fixed:selectedIndex;
    const q=result.difference[entity]?.[o];
    return q && (['p5','p50','p95'] as const).every(k=>Number.isFinite(q[k][index]));
  });
  if(!complete || changed(selectedIndex))return null;
  return result.years.map((year,index)=>({year,index})).sort((a,b)=>a.year-b.year).find(({index})=>changed(index))?.year??null;
}

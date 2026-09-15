import { describe, expect, it } from 'vitest';
import { firstChangedDisplayYear, policyEvidenceInventory } from './presentation';
import { findFixture } from '../core/fixtures';
import { findPolicyExample } from './examples';
import type { PairedRunResult, Quantiles } from './types';
const model=findFixture('training-budget')!.model;
const q=(values:number[]):Quantiles=>Object.fromEntries(['p5','p25','p50','p75','p95','mean'].map(k=>[k,values])) as Quantiles;
const result={years:[2029,2027,2026],entities:['x'],outputs:['output'],difference:{x:{output:q([0,20,1])}}} as unknown as PairedRunResult;
describe('policy presentation boundaries',()=>{
 it('selects the first chronological change, not largest or array order',()=>expect(firstChangedDisplayYear(model,result,0)).toBe(2026));
 it('does not call a zero median unchanged when spread differs',()=>expect(firstChangedDisplayYear(model,{...result,difference:{x:{output:{...q([0,20,1]),p95:[1,20,1]}}}},0)).toBeNull());
 it('does not describe missing displayed results as zero',()=>expect(firstChangedDisplayYear(model,{...result,difference:{x:{output:q([NaN,20,1])}}},0)).toBeNull());
 it('retains steady-state display semantics',()=>{const m={...model,limitations:{steadyStateOnly:{outputs:['output'],at:2027,reason:'steady only'}}};expect(firstChangedDisplayYear(m,result,0)).toBeNull();});
 it('does not use a source kind or model id as evidence acceptance',()=>{const draft=findPolicyExample('s3877-itwa-2026')!.draft;const spoof={...model,id:'reported-financial',parameters:model.parameters.map(p=>({...p,source:{label:'Invented',kind:'causal' as const,url:'https://example.org'}}))};const inventory=policyEvidenceInventory(spoof,draft);expect(inventory.declarations[0].source?.kind).toBe('causal');expect(inventory).not.toHaveProperty('accepted');expect(inventory.unsupported).toEqual(draft.provisions.filter(p=>p.status!=='mapped'));expect(inventory.settings.every(p=>p.role!=='coefficient'&&p.mapping?.kind!=='effect')).toBe(true);});
});

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { initialGuidedMode } from './navigation';
import { selectedFunding } from './fundingView';
import FundingFlow from './FundingFlow';
import { DEFAULT_MODEL } from '../../constants';
import { initialRun, initOptionsFor } from '../../simulation/run';
import { allocateConditional } from '../../simulation/conditionalWorld';
import { usdPerPerson } from '../../simulation/units';
import LabTab from '../lab/LabTab';

const run = initialRun(undefined,undefined,initOptionsFor(DEFAULT_MODEL));
describe('guided route precedence',()=>{
 it.each(['#lab=bad','#scenario=bad','#share=bad','#futures=bad'])('leaves %s to the existing validation owner',hash=>expect(initialGuidedMode('?tab=explore',hash)).toBe(null));
 it.each(['lab','map','charts','corporations','models','futures','equations','analysis','guide','leaderboard','modelcard','overview'])('preserves old ?tab=%s destinations',tab=>expect(initialGuidedMode(`?tab=${tab}`,'')).toBe(null));
 it('offers the journey only for a new visit or explicit guided destination',()=>{expect(initialGuidedMode('','')).toBe('explore');expect(initialGuidedMode('?tab=compare','')).toBe('compare');});
});
describe('funding view uses actual allocator, units and recipient eligibility',()=>{
 it.each(['global','customer-weighted','hq-local'] as const)('%s reconciles selected-corporation receipts',route=>{
  const c={...run.corporations[0],distributionStrategy:route};
  const view=selectedFunding(run.state.countryData,c);
  const core=allocateConditional(run.state.countryData,[c]);
  expect(view.budget).toEqual(core.budgets[c.id]);
  expect(view.recipients.reduce((n,r)=>n+r.amount,0)).toBeCloseTo(view.budget.actual,10);
  expect(view.perPerson).toBe(usdPerPerson(view.budget.actual,view.population));
 });
 it('uses edited population and retains eligible countries at zero request',()=>{
  const c={...run.corporations[0],distributionStrategy:'hq-local' as const,contributionRate:0};
  const countries=structuredClone(run.state.countryData);countries[c.headquartersCountry].population=123;
  const view=selectedFunding(countries,c);expect(view.population).toBe(123);expect(view.recipients).toHaveLength(1);expect(view.perPerson).toBe(0);
 });
 it('renders reserved, unused and unfunded explicitly from a constrained request',()=>{
  const c={...run.corporations[0],availableShare:.25,fundingRequest:{kind:'amount' as const,monthlyBillions:100}};
  const view=selectedFunding(run.state.countryData,c);const html=renderToString(<FundingFlow view={view} corporation={c.name}/>);
  expect(view.budget.reservedForOtherUses).toBeGreaterThan(0);expect(view.budget.unfunded).toBeGreaterThan(0);
  expect(html).toContain('Reserved');expect(html).toContain('Unfunded');expect(html).toContain('Request exceeds');expect(html).toContain('Recipient breakdown and accounting table');expect(html).toContain('Other corporations');
 });
 it('fails closed on unresolved recipients rather than inventing a denominator',()=>expect(()=>selectedFunding({},run.corporations[0])).toThrow());
});
describe('Lab tools remain directly discoverable',()=>{
 it('keeps authoring, imports, policy and files in the mounted workspace and avoids nested help buttons',()=>{
  const html=renderToString(<LabTab initialModelId="training-budget"/>);
  for(const id of ['import','assumptions','author','policy','files','uncertainty'])expect(html).toContain(`id="lab-jump-${id}"`);
  const summaries=html.match(/<summary[\s\S]*?<\/summary>/g)??[];
  expect(summaries.some(s=>s.includes('<button'))).toBe(false);
 });
});

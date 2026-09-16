import React, { useMemo, useState } from 'react';
import type { Corporation, ModelParameters } from '../../types';
import type { SimulationRun } from '../../simulation/run';
import type { QualificationResult } from '../../simulation/qualification';
import { formatBillionsUsd, formatUsdPerPerson } from '../../simulation/units';
import type { AppTab } from '../lab/navigation';
import ExploreIntro from './ExploreIntro';
import ExploreControls from './ExploreControls';
import FundingFlow from './FundingFlow';
import ScenarioContext from './ScenarioContext';
import { selectedFunding } from './fundingView';

export type LabEntry = 'policy' | 'training' | 'import' | 'author' | 'uncertainty';
interface Props {
  mode:'explore'|'compare'; model:ModelParameters; run:SimulationRun; paired:SimulationRun; qualification:QualificationResult;
  needsDividendReference?:boolean; uploadedModelName?:string; equationIssue?:string; error?:string|null; activePolicy:boolean;
  onUpdate:(id:string,patch:Partial<Corporation>)=>void; onModel:(model:ModelParameters)=>void;
  onLab:(entry?:LabEntry)=>void; onView:(tab:AppTab)=>void; onDividend:()=>void; onCompare:()=>void;
  onMapCompare:()=>void; onPolicyCompare:()=>void; onShare:()=>void; onSave:()=>void;
}

function SourceAssumptions({c,onUpdate}:{c:Corporation;onUpdate:(patch:Partial<Corporation>)=>void}) {
  return <form className="guided-assumption-form" key={`${c.id}-${c.availableShare}-${c.marketCap}-${c.aiAdoptionLevel}`} onSubmit={e => {e.preventDefault(); const data=new FormData(e.currentTarget); onUpdate({availableShare:Number(data.get('available'))/100,marketCap:Number(data.get('stock')),aiAdoptionLevel:Number(data.get('adoption'))/100});}}>
    <p>These are authored scenario assumptions for {c.name}, not a real pledge or measured available cash. Expenses, ownership incidence and competing uses are unestimated.</p>
    <label>Source available for contribution (%)<input name="available" type="number" required min="0" max="100" step="any" defaultValue={(c.availableShare??1)*100}/></label>
    <label>Assumed corporate stock (constant-2015 USD billions)<input name="stock" type="number" required min="0" step="any" defaultValue={c.marketCap}/></label>
    <label>Assumed corporate AI adoption (%)<input name="adoption" type="number" required min="0" max="100" step="any" defaultValue={c.aiAdoptionLevel*100}/></label>
    <button type="submit">Apply source assumptions</button>
  </form>;
}
function MappingAssumptions({model,onModel}:{model:ModelParameters;onModel:(m:ModelParameters)=>void}) {
  return <form className="guided-assumption-form" onSubmit={e => {e.preventDefault(); const data=new FormData(e.currentTarget);onModel({...model,conditional:{...model.conditional!,transferEffectPerDoubling:Number(data.get('transfer')),nonIncomeLossPerAdditionalUnemployedPerson:Number(data.get('unemployment')),incomeDenominatorMultiplier:Number(data.get('denominator'))}});}}>
    <p>This illustrative recipient-side index is not observed wellbeing or net welfare. Coefficients express assumptions; they do not establish a causal policy effect.</p>
    <label>Transfer effect per doubling<input name="transfer" type="number" required min="0" step="any" defaultValue={model.conditional?.transferEffectPerDoubling}/></label>
    <label>Non-income loss per additional unemployed person<input name="unemployment" type="number" required min="0" step="any" defaultValue={model.conditional?.nonIncomeLossPerAdditionalUnemployedPerson}/></label>
    <label>Income denominator multiplier<input name="denominator" type="number" required min="0.000001" step="any" defaultValue={model.conditional?.incomeDenominatorMultiplier}/></label>
    <button type="submit">Apply index assumptions</button>
  </form>;
}
export default function GuidedExperience(p:Props) {
  const [selected,setSelected] = useState(p.run.corporations[0]?.id ?? '');
  const c = p.run.corporations.find(c => c.id === selected) ?? p.run.corporations[0];
  const allocation = useMemo(() => {
    if (!c || p.model.executionMode !== 'world-conditional-v1' || p.equationIssue) return null;
    try {return {value:selectedFunding(p.run.state.countryData,c),error:null};} catch(e) {return {value:null,error:String(e)};}
  },[c,p.run.state.countryData,p.model.executionMode,p.equationIssue]);
  const a=p.run.state.sourceAccounting, b=p.paired.state.sourceAccounting;
  return <div className="guided-page">
    {p.mode === 'explore' ? <ExploreIntro startsReference={p.needsDividendReference} onDividend={p.onDividend} onPolicy={()=>p.onLab('policy')} onTraining={()=>p.onLab('training')} onBuild={()=>p.onLab('import')} onRisk={()=>p.onView('futures')}/> : <section className="guided-intro"><h1>What changes between<br className="guided-desktop-break"/> two scenarios?</h1><p>Compare like with like, with the assumptions and limits in view.</p></section>}
    {p.error && <p role="alert" className="guided-warning">{p.error}</p>}
    {p.activePolicy ? <section className="guided-context"><h2>Your active result is a Lab policy comparison</h2><p>It has its own model, assumptions and calendar. Reopen its results or authoring draft below.</p><div className="guided-actions"><button className="guided-primary" onClick={p.onPolicyCompare}>View policy comparison</button><button onClick={()=>p.onLab('policy')}>Edit policy draft</button><button onClick={p.onDividend}>{p.needsDividendReference ? 'Start conditional dividend reference' : 'Explore world dividend instead'}</button></div></section> : <>
      <ScenarioContext model={p.model} state={p.run.state} qualification={p.qualification} uploadedModelName={p.uploadedModelName} equationIssue={p.equationIssue}/>
      {p.mode === 'explore' && allocation?.value && c && <div className="guided-mobile-payment" aria-live="polite"><strong>{formatUsdPerPerson(allocation.value.perPerson)}</strong><div><span>per modeled recipient / month</span><p>From {c.name} alone under these assumptions; {allocation.value.population.toLocaleString('en-US',{maximumFractionDigits:2})} million residents in {allocation.value.recipients.length} countries. Constant-2015 USD.</p></div></div>}
      {p.mode === 'compare' ? <section className="guided-compare">
        <h2>World contributions versus zero contributions</h2><p>The paired world run keeps the same model and corporate assumptions, with every corporate contribution set to zero.</p>
        {a && b ? <div className="guided-table-scroll"><table><caption>All corporations · month {p.run.state.month} · constant-2015 USD per month</caption><thead><tr><th>Accounting flow</th><th>Current contributions</th><th>Zero contributions</th></tr></thead><tbody><tr><th scope="row">Funded transfers</th><td>{formatBillionsUsd(a.actual)}</td><td>{formatBillionsUsd(b.actual)}</td></tr><tr><th scope="row">Unfunded requests</th><td>{formatBillionsUsd(a.unfunded)}</td><td>{formatBillionsUsd(b.unfunded)}</td></tr><tr><th scope="row">Recipient receipts</th><td>{formatBillionsUsd(a.receipts)}</td><td>{formatBillionsUsd(b.receipts)}</td></tr></tbody></table></div> : <p>Conditional accounting is unavailable for this model. Its supported legacy comparison remains available below.</p>}
        <p>{p.model.executionMode === 'world-conditional-v1'
          ? 'Transfer-to-macro feedback is unestimated. Equal macro curves do not measure zero economic effect. An index difference is a conditional model result, not a forecast.'
          : 'The paired charts use the active world model and its zero-contribution run. Interpret the legacy wellbeing index using that model’s own equations, sources and limitations.'}</p><div className="guided-actions"><button className="guided-primary" onClick={p.onMapCompare}>Compare world maps</button><button onClick={()=>p.onView('charts')}>Paired world charts</button><button onClick={()=>p.onLab('policy')}>Build a policy A/B comparison</button></div><p className="guided-small">Map comparison uses compatible world scenarios. Arbitrary cross-model chart overlays are not supported; the Policy panel compares within its selected model.</p>
      </section> : allocation?.value && c ? <>
        <p className="guided-assumption-note">Named corporate sources and contributions below are scenario assumptions, not real pledges.</p>
        <div className="guided-workbench"><div className="guided-choice"><label htmlFor="guided-corporation">Whose contribution?</label><select id="guided-corporation" value={c.id} onChange={e=>setSelected(e.target.value)}>{p.run.corporations.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><ExploreControls key={`${c.id}-${c.contributionRate}-${c.fundingRequest?.kind}-${c.fundingRequest?.kind==='amount'?c.fundingRequest.monthlyBillions:''}-${c.distributionStrategy}`} corporation={c} onUpdate={patch=>p.onUpdate(c.id,patch)}/></div><FundingFlow view={allocation.value} corporation={c.name}/></div>
        <div className="guided-actions"><button className="guided-primary" onClick={p.onCompare}>Compare with zero contributions</button><button onClick={p.onShare}>Share this scenario</button><button onClick={p.onSave}>Save complete scenario</button></div>
        <div className="guided-disclosures"><details className="guided-details"><summary>Source assumptions</summary><SourceAssumptions c={c} onUpdate={patch=>p.onUpdate(c.id,patch)}/></details><details className="guided-details"><summary>Conditional index assumptions</summary><MappingAssumptions model={p.model} onModel={p.onModel}/></details><details className="guided-details"><summary>What is outside scope?</summary><ul>{p.qualification.limitations.map((x,i)=><li key={i}>{x}</li>)}</ul><p>AI risk belongs to a separate model. None of its interventions change these transfer results.</p></details></div>
        <details className="guided-details guided-inspect"><summary>Inspect this calculation</summary><p>Source = reserved + available. Available = funded + unused. Requested = funded + unfunded. The flow graphic uses the production allocator for this corporation and the complete current country roster.</p><p>Receipt denominator: eligible modeled residents, using this run’s population values in millions. Every eligible person receives an equal amount through the chosen route. Operating-country residents are not measured customers.</p><p>Model: {p.model.id}. Money basis: {c.monetaryBasis?.source}. Flow convention: {p.run.state.outputDefinition?.flowConvention}.</p><p>Accounting: {p.qualification.accounting}. Macro: {p.qualification.macro}. Wellbeing: {p.qualification.wellbeing}.</p>{p.qualification.reasons.map((r,i)=><p key={i}>{r}</p>)}<p className="guided-hash">Active input identity: {p.qualification.identity??'unavailable'}</p><p>Qualification version: {p.qualification.version}. Structure: {p.qualification.structureVersion}.</p>{a&&<p data-testid="source-accounting">All corporations, USD billions/month: source {a.source.toFixed(6)}; funded {a.actual.toFixed(6)}; receipts {a.receipts.toFixed(6)}; unused {a.unused.toFixed(6)}; reserved {a.reserved.toFixed(6)}; unfunded {a.unfunded.toFixed(6)}.</p>}<button onClick={()=>p.onView('modelcard')}>Read the model card</button></details>
      </> : <section className="guided-context"><h2>Open the supported model views</h2><p role={allocation?.error || p.equationIssue ? 'alert' : undefined}>{allocation?.error ?? p.equationIssue ?? (!c ? 'This scenario has no corporations. A contribution and recipient payment cannot be shown.' : 'The funding-flow journey requires the conditional world model. Your active model and inputs have been preserved.')}</p><div className="guided-actions"><button onClick={()=>p.onView('map')}>View active world model</button><button onClick={p.onSave}>Save current scenario</button>{p.needsDividendReference && <button className="guided-primary" onClick={p.onDividend}>Start conditional dividend reference</button>}</div>{p.needsDividendReference && <p>Starts a new month-zero reference scenario and removes uploaded world equations. Ordinary Explore navigation preserves the current scenario.</p>}</section>}
      <section className="guided-deeper"><h2>Look more closely</h2><p>Explore geography, the paired timeline, and every corporation. World settings and playback are available in these views.</p><div className="guided-actions">{(['map','charts','corporations'] as const).map(tab=><button key={tab} onClick={()=>p.onView(tab)}>{tab==='map'?'Map':tab==='charts'?'Charts':'Corporations'}</button>)}<button onClick={()=>p.onView('models')}>World equations and imports</button></div></section>
    </>}
    <section className="guided-paths"><div><h2>Build or import a model</h2><p>Model Lab exposes equations, assumptions, uncertainty, constraints and reproducible files.</p><div className="guided-actions"><button onClick={()=>p.onLab('import')}>Import a model</button><button onClick={()=>p.onLab('author')}>Add a variable</button><button onClick={()=>p.onLab('uncertainty')}>Explore uncertainty</button></div></div><div><h2>Explore AI risks</h2><p>A separate influence model with its own assumptions and interventions. These results do not change the dividend model.</p><button onClick={()=>p.onView('futures')}>Open AI Futures Map</button></div></section>
  </div>;
}

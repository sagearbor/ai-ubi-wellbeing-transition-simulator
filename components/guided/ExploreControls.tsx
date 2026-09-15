import React, { useState } from 'react';
import type { Corporation } from '../../types';
import { allocationNames } from './fundingView';

const ExploreControls: React.FC<{corporation:Corporation; onUpdate:(patch:Partial<Corporation>)=>void}> = ({ corporation: c, onUpdate }) => {
  const [kind,setKind] = useState(c.fundingRequest?.kind ?? 'share');
  const [rate,setRate] = useState(String(c.contributionRate * 100));
  const [amount,setAmount] = useState(String(c.fundingRequest?.kind === 'amount' ? c.fundingRequest.monthlyBillions : c.sourceBudget?.requested ?? 0));
  const [route,setRoute] = useState(c.distributionStrategy);
  const dirty = kind !== (c.fundingRequest?.kind ?? 'share') || route !== c.distributionStrategy || (kind === 'share' ? Number(rate) !== c.contributionRate * 100 : Number(amount) !== (c.fundingRequest?.kind === 'amount' ? c.fundingRequest.monthlyBillions : c.sourceBudget?.requested));
  return <form className="guided-controls" onSubmit={e => { e.preventDefault(); onUpdate({ contributionRate: kind === 'share' ? Number(rate)/100 : c.contributionRate, fundingRequest:kind === 'amount' ? {kind:'amount',monthlyBillions:Number(amount)} : {kind:'share'}, distributionStrategy:route }); }}>
    <fieldset><legend>Choose the contribution</legend><label htmlFor="guided-request-kind">Request as</label><select id="guided-request-kind" value={kind} onChange={e => setKind(e.target.value as 'share'|'amount')}><option value="share">Share of assumed source</option><option value="amount">Monthly amount</option></select>
      {kind === 'share' ? <><label htmlFor="guided-rate">Requested share (%)</label><input id="guided-rate" type="number" min="0" max="100" step="any" required value={rate} onChange={e => setRate(e.target.value)} /></> : <><label htmlFor="guided-amount">Requested amount (USD billions/month)</label><input id="guided-amount" type="number" min="0" step="any" required value={amount} onChange={e => setAmount(e.target.value)} /></>}
      <label htmlFor="guided-route">Who receives it?</label><select id="guided-route" value={route} onChange={e => setRoute(e.target.value as Corporation['distributionStrategy'])}>{Object.entries(allocationNames).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select>
      <button className="guided-primary" type="submit">Recalculate contribution</button><p className="guided-draft" role="status">{dirty ? 'Changes not applied. Recalculate to update the result.' : 'Result reflects these contribution choices.'}</p>
    </fieldset>
  </form>;
}

export default ExploreControls;

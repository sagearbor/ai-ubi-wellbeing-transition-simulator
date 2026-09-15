import React from 'react';
import type { FundingView } from './fundingView';
import { formatBillionsUsd, formatUsdPerPerson } from '../../simulation/units';

export default function FundingFlow({ view, corporation }: { view: FundingView; corporation: string }) {
  const { budget: b } = view;
  // Geometry only: same-unit monetary flows share one width scale. No economic formula lives here.
  const width = (v: number) => b.source > 0 ? 70 * v / b.source : 0;
  const fundedWidth = width(b.actual), unusedWidth = width(b.slack), reservedWidth = width(b.reservedForOtherUses);
  return <section className="guided-flow" aria-labelledby="funding-heading">
    <div className="guided-flow-heading"><div><h2 id="funding-heading">Follow the funds</h2><span>Monthly flow · constant-2015 USD</span></div><div className="guided-receipt-head" aria-live="polite"><strong>{formatUsdPerPerson(view.perPerson)}</strong><span>per modeled recipient / month</span></div></div>
    <div className="guided-flow-labels"><div><span>Assumed source</span><strong>{formatBillionsUsd(b.source)}</strong></div><div><span>Available for contribution</span><strong>{formatBillionsUsd(b.available)}</strong></div><div><span>Funded transfer</span><strong className="guided-funded-text">{formatBillionsUsd(b.actual)}</strong></div></div>
    <svg className="guided-ribbons" viewBox="0 0 720 235" preserveAspectRatio="none" role="img" aria-label={`Of ${formatBillionsUsd(b.source)} assumed source, ${formatBillionsUsd(b.actual)} is funded, ${formatBillionsUsd(b.slack)} unused and ${formatBillionsUsd(b.reservedForOtherUses)} reserved. Detailed figures follow.`}>
      <path d="M 22 54 H 174" stroke="var(--guided-muted-flow)" strokeWidth={b.source > 0 ? 70 : 2} fill="none" />
      {b.available > 0 && <path d={`M 174 ${19 + width(b.available)/2} C 235 ${19 + width(b.available)/2}, 242 54, 310 54 H 354`} stroke="var(--guided-available)" strokeWidth={width(b.available)} fill="none" />}
      {b.actual > 0 && <path d={`M 354 ${54-width(b.available)/2+fundedWidth/2} C 474 ${54-width(b.available)/2+fundedWidth/2}, 482 48, 694 48`} stroke="var(--guided-accent)" strokeWidth={fundedWidth} fill="none" />}
      {b.slack > 0 && <path d={`M 354 ${54+fundedWidth/2} C 464 ${54+fundedWidth/2}, 468 136, 694 136`} stroke="var(--guided-muted-flow)" strokeWidth={unusedWidth} fill="none" />}
      {b.reservedForOtherUses > 0 && <path d={`M 174 ${89-reservedWidth/2} C 288 ${89-reservedWidth/2}, 254 199, 694 199`} stroke="var(--guided-reserved)" strokeWidth={reservedWidth} fill="none" />}


      {b.source === 0 && <text x="22" y="125" fill="var(--guided-ink)" fontSize="17">No modeled source at these assumptions.</text>}
    </svg>
    <div className="guided-branch-labels"><span>Unused <strong>{formatBillionsUsd(b.slack)}</strong></span>{b.reservedForOtherUses > 0 && <span>Reserved <strong>{formatBillionsUsd(b.reservedForOtherUses)}</strong></span>}</div>
    <div className="guided-request-status" aria-live="polite"><span>Requested <strong>{formatBillionsUsd(b.requested)}</strong></span><span className={b.unfunded > 0 ? 'guided-warning guided-unfunded' : ''}>Unfunded <strong>{formatBillionsUsd(b.unfunded)}</strong></span><span>{b.unfunded > 0 ? 'Request exceeds the available source.' : 'Funding request fully covered.'}</span></div>
    <div className="guided-receipts" aria-live="polite"><p>From {corporation} alone, shared equally among <strong>{view.population.toLocaleString('en-US', {maximumFractionDigits: 2})} million residents</strong> in {view.recipients.length} {view.recipients.length === 1 ? 'country' : 'countries'}. Other corporations’ payments are additional.</p><p className="guided-recipient-names">{view.recipients.length <= 5 ? view.recipients.map(r => r.name).join(', ') : 'All eligible countries and receipts are listed below.'}</p></div>
    <details className="guided-details"><summary>Recipient breakdown and accounting table</summary><div className="guided-table-scroll"><table><caption>Monthly flows from {corporation}; constant-2015 USD billions</caption><tbody>{[['Assumed source',b.source],['Reserved for other uses',b.reservedForOtherUses],['Available',b.available],['Requested',b.requested],['Funded',b.actual],['Unused available source',b.slack],['Unfunded request',b.unfunded]].map(([label,value]) => <tr key={label}><th scope="row">{label}</th><td>{Number(value).toPrecision(8)}</td></tr>)}</tbody></table><table><caption>Eligible residents and receipts from this corporation only</caption><thead><tr><th>Country</th><th>Residents (millions)</th><th>USD/person/month</th></tr></thead><tbody>{view.recipients.map(r => <tr key={r.id}><th scope="row">{r.name} ({r.id})</th><td>{r.population.toLocaleString()}</td><td>{r.perPerson.toFixed(4)}</td></tr>)}</tbody></table></div></details>
  </section>;
}

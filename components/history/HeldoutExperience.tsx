import React, { useId, useState } from 'react';
import raw from '../../data/evaluation/level-holdout-2018/experience.json';
import ladderSource from '../../data/hindcast/wellbeing-ladder.json';
import gdpSource from '../../data/hindcast/gdp-per-capita.json';
import { holdoutFormat as fmt, holdoutRows, holdoutValues, type HoldoutArtifact, type HoldoutOutcome, type HoldoutRow } from '../../src/history/holdout';
const artifact: HoldoutArtifact = raw as HoldoutArtifact;
const units = { ladder: 'Wellbeing ladder points (0–10)', gdp: 'GDP per person (constant-2015 US dollars)' };
function download() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(raw, null, 2)], {type:'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = 'level-holdout-2018-evaluation-and-provenance.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function DataTable({rows, label}: {rows: HoldoutRow[]; label: string}) {
  return <div className="history-table-scroll" tabIndex={0} role="region" aria-label={label}><table><caption>All selected country-years; missing outcomes remain unscored. GDP errors are growth percentage points from the 2018 origin; GDP levels are constant-2015 US dollars.</caption><thead><tr>{['Country','Year','Measure','Observed level','Model level','Persistence level','Model error','Persistence error','Missing reason'].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.map(r=>{const v=holdoutValues(r);return <tr key={`${r.id}-${r.year}-${r.outcome}`}><th scope="row">{r.name} ({r.id})</th><td>{r.year}</td><td>{r.outcome==='ladder'?'Wellbeing (0–10)':'GDP'}</td><td>{fmt(v.observed,3)}</td><td>{fmt(v.modeled,3)}</td><td>{fmt(v.persistence,3)}</td><td>{fmt(r.error)}</td><td>{fmt(r.persistenceError)}</td><td>{r.reason??'—'}</td></tr>;})}</tbody></table></div>;
}
export default function HeldoutExperience() {
  const id=useId(); const [country,setCountry]=useState(artifact.origin.countries[0].id); const [outcome,setOutcome]=useState<HoldoutOutcome>('ladder');
  const rows=holdoutRows(artifact,country,outcome); const name=artifact.origin.countries.find(c=>c.id===country)!.name;
  const primary=artifact.scores.outcomes.ladder.overall; const secondary=artifact.scores.outcomes.gdp.overall;
  const p=artifact.protocol; const source=outcome==='ladder'?ladderSource.source:gdpSource.source;
  const allValues=rows.flatMap(r=>Object.values(holdoutValues(r))).filter((v):v is number=>v!==null);
  const min=Math.min(...allValues), max=Math.max(...allValues), pad=(max-min||1)*.12;
  const low=Math.max(0,min-pad), high=max+pad;
  const x=(i:number)=>100+i*100; const y=(v:number)=>270-(v-low)/(high-low||1)*220;
  const path=(key:keyof ReturnType<typeof holdoutValues>)=>{let connected=false; return rows.map((r,i)=>{const v=holdoutValues(r)[key];if(v===null){connected=false;return '';}const segment=`${connected?'L':'M'}${x(i)},${y(v)}`;connected=true;return segment;}).join(' ');};
  return <section className="history-experience holdout-experience" aria-labelledby={`${id}-title`}>
    <header><h1 id={`${id}-title`}>Does the model beat predicting no change?</h1>
      <p className="history-boundary"><strong>The first, untuned wellbeing result is worse than persistence.</strong> Across {artifact.origin.countries.length} origin countries, model mean absolute error is <strong>{fmt(primary.model.mae,3)}</strong> ladder points; persistence is <strong>{fmt(primary.persistence.mae,3)}</strong>. The model misses by <strong>{fmt(primary.modelMinusPersistenceMae,3)} more ladder points</strong> on average.</p>
      <p>Fit {p.trainingYears[0]}–{p.trainingYears.at(-1)}. Start {p.originYear}. Test {p.testYears[0]}–{p.testYears.at(-1)}. Coefficients stay frozen: no refit and no later observations injected into predictions.</p>
      <p>Retrospective test: revised data and a model chosen after the test period, not a blind or archived 2018 forecast. Existing anchored level model, artificial intelligence (AI) and transfers off; does not test the conditional-world default, financial allocation, training or policy effects.</p>
    </header>
    <div className="history-controls"><label htmlFor={`${id}-country`}>Inspect country<select id={`${id}-country`} value={country} onChange={e=>setCountry(e.target.value)}>{[...artifact.origin.countries].sort((a,b)=>a.name.localeCompare(b.name)).map(c=><option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}</select></label><label htmlFor={`${id}-outcome`}>Observed measure<select id={`${id}-outcome`} value={outcome} onChange={e=>setOutcome(e.target.value as HoldoutOutcome)}><option value="ladder">Wellbeing ladder (0–10)</option><option value="gdp">GDP per person</option></select></label></div>
    <figure className="history-figure"><figcaption><h2>{name}: {units[outcome]}</h2><p><a href={source.url} target="_blank" rel="noreferrer">{source.name}</a>; retrieved {source.retrievedAt}. Annual test observations {p.testYears[0]}–{p.testYears.at(-1)}.</p></figcaption>
      <ul className="history-legend"><li className="history-observed">● Observed</li><li className="history-modeled">━ Frozen model</li><li className="history-persistence">┄ 2018 persistence</li></ul>
      <svg viewBox="0 0 790 330" role="img" aria-labelledby={`${id}-chart-title ${id}-chart-desc`}><title id={`${id}-chart-title`}>{`${name}: ${units[outcome]}`}</title><desc id={`${id}-chart-desc`}>Observed, model and persistence use the same units. Missing observations break the line, never become zero. The axis spans all three series. Exact values and missing reasons are in the annual table.</desc>
        {[0,1,2,3,4].map(t=>{const v=low+(high-low)*t/4;return <g key={t}><line x1="100" x2="700" y1={y(v)} y2={y(v)} className="history-grid"/><text x="90" y={y(v)+5} textAnchor="end">{fmt(v,outcome==='ladder'?2:0)}</text></g>;})}
        {rows.map((r,i)=><text key={r.year} x={x(i)} y="310" textAnchor="middle">{r.year}</text>)}
        <path d={path('persistence')} className="history-line history-persistence" strokeDasharray="8 6"/><path d={path('modeled')} className="history-line history-modeled"/><path d={path('observed')} className="history-line history-observed"/>
        {rows.map((r,i)=>r.actual!==null&&<circle key={r.year} cx={x(i)} cy={y(r.actual)} r="4" className="history-point"><title>{`${r.year}: ${fmt(r.actual,3)}`}</title></circle>)}
      </svg><p>{rows.filter(r=>r.actual!==null).length} of {rows.length} observations available. Persistence holds each country's 2018 value. Wellbeing here is the original 0–10 ladder; historical reconstruction uses a rescaled 0–100 index.</p>
    </figure>
    <section aria-label="Aggregate held-out comparison"><h2>Aggregate comparison: the whole origin cohort</h2><p>{artifact.origin.countries.length} countries fixed at the origin; {artifact.origin.excluded.length} excluded before test outcomes were read. Scores weight observed country-years equally, with independent outcome masks shared by model and persistence.</p>
      <div className="history-table-scroll" tabIndex={0} role="region" aria-label="Aggregate held-out comparison table"><table><caption>Mean absolute error (MAE), all test years pooled. Lower is better.</caption><thead><tr><th scope="col">Outcome</th><th scope="col">Model MAE</th><th scope="col">Persistence MAE</th><th scope="col">Model minus persistence</th><th scope="col">Observed / eligible</th></tr></thead><tbody>{([['Wellbeing ladder points (0–10)',primary],['GDP growth percentage points',secondary]] as const).map(([label,s])=><tr key={label}><th scope="row">{label}</th><td>{fmt(s.model.mae,3)}</td><td>{fmt(s.persistence.mae,3)}</td><td>{fmt(s.modelMinusPersistenceMae,3)} ({s.modelMinusPersistenceMae===null?'not scored':s.modelMinusPersistenceMae>0?'worse':'lower error'})</td><td>{s.observed} / {s.expected}; {s.unscored} missing</td></tr>)}</tbody></table></div>
      <p>Existing evidence-anchored level engine, with artificial intelligence (AI) and transfers off. This does not test the conditional-world default, financial allocation, training or policy effects. Passing data-integrity checks is not an accuracy verdict.</p>
    </section>

    <details><summary>Annual values and errors: {name}</summary><DataTable rows={rows} label={`Annual values and errors for ${name}`}/></details>
    <details><summary>All country-year scores, both outcomes</summary><DataTable rows={artifact.scores.rows} label="All country-year scores, both outcomes"/></details>
    <details><summary>Exclusions and missing observations</summary><p>{p.cohort} {p.missingness}</p><h3>Origin exclusions</h3><ul>{artifact.origin.excluded.map(r=><li key={r.id}>{r.id}: {r.reason}</li>)}</ul><h3>Missing test outcomes</h3><ul>{artifact.scores.rows.filter(r=>r.actual===null).map(r=><li key={`${r.id}-${r.year}-${r.outcome}`}>{r.name} ({r.id}), {r.year}, {r.outcome}: {r.reason}</li>)}</ul><h3>Training exclusions</h3><ul>{artifact.trainingExclusions.map(r=><li key={`${r.id}-${r.year}`}>{r.id}, {r.year}: {r.reason}</li>)}</ul></details>
    <details><summary>Scope, source dates and reproduce this evaluation</summary><p>{p.scope}</p><ul>{artifact.limitations.map(l=><li key={l}>{l}</li>)}</ul><p>{p.vintageLimit}</p><ul>{[ladderSource.source,gdpSource.source,...Object.values(artifact.backgroundSources)].map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{'name' in s?s.name:s.url}</a> — retrieved {s.retrievedAt}</li>)}</ul><p>Run in the repository terminal to reproduce every stage from pinned sources:</p><pre>node --import tsx scripts/evaluation/run.ts all</pre><p>Protocol identity: <code>{artifact.protocolHash}</code>. Frozen calibration: <code>{artifact.calibrationIdentity}</code>.</p><p>The download contains all predictions, scores, exclusions, protocol, calibration, and source/artifact hashes. The separately hashed raw inputs remain in data/evaluation/level-holdout-2018/ and data/hindcast/ in the repository.</p></details>
    <button type="button" onClick={download}>Download entire evaluation and provenance (JSON)</button>
  </section>;
}

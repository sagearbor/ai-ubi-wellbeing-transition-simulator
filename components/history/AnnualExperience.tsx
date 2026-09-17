import React, { useId, useMemo, useState } from 'react';
import raw from '../../data/history/annual-20260917.json';
import { annualFormat as fmt, annualHistoryRows, type AnnualArtifact, type AnnualOutcome } from '../../src/history/annual';
import AnnualChart from './AnnualChart';

export const annualArtifact = raw as unknown as AnnualArtifact;
const gallery = 'https://github.com/sagearbor/ai-ubi-wellbeing-transition-simulator/blob/main/docs/design/reviews/annual-history-20260917';
const skillLabel = (value: number | null) => value === null ? 'Not scored' : value === 0 ? 'Same error as persistence' : `${fmt(Math.abs(value), 1)}% ${value > 0 ? 'less' : 'more'} error`;
function download() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(annualArtifact)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'annual-history-20260917-and-provenance.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AnnualExperience({ initialCountry = 'USA', initialOutcome = 'gdp' }: { initialCountry?: string; initialOutcome?: AnnualOutcome }) {
  const id = useId();
  const [country, setCountry] = useState(initialCountry);
  const [outcome, setOutcome] = useState<AnnualOutcome>(initialOutcome);
  const [methodChoice, setMethodChoice] = useState<string | null>(null);
  const [fullHistory, setFullHistory] = useState(false);
  const [year, setYear] = useState(2020);
  const track = annualArtifact.tracks[outcome];
  const method = methodChoice ?? track.selected;
  const methodLabel = track.methods.find(m => m.id === method)!.label;
  const name = annualArtifact.countries.find(c => c.id === country)!.name;
  const countryPath = track.countries[country];
  const allRows = useMemo(() => annualHistoryRows(track, country, method), [track, country, method]);
  const rows = fullHistory ? allRows : allRows.filter(row => row.year >= (outcome === 'wellbeing' ? 2005 : 2000));
  const inspectedYear = Math.max(rows[0].year, Math.min(rows.at(-1)!.year, year));
  const inspected = rows.find(row => row.year === inspectedYear)!;
  const score = countryPath.scores[method];
  const pooled = track.pooled[method];
  const coverage = countryPath.coverage;
  const positive = score.improvementPercent !== null && score.improvementPercent > 0;
  const tableDigits = outcome === 'gdp' ? 2 : 3;
  return <section className="history-experience annual-experience" aria-labelledby={`${id}-title`}>
    <header>
      <h1 id={`${id}-title`}>Forecasts against history</h1>
      <p className="annual-intro">Compare annual observations with predictions from earlier data and with repeating last year.</p>
      <p className="history-boundary"><strong>Each point is a new one-year forecast</strong>, updated from prior observations. Revised-data retrospective test, not a real-time forecast or proof of policy effects.</p>
    </header>
    <div className="history-controls annual-controls">
      <label htmlFor={`${id}-country`}>Country<select id={`${id}-country`} value={country} onChange={e => setCountry(e.target.value)}>{annualArtifact.countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label htmlFor={`${id}-outcome`}>Outcome<select id={`${id}-outcome`} value={outcome} onChange={e => { setOutcome(e.target.value as AnnualOutcome); setMethodChoice(null); }}>{Object.entries(annualArtifact.tracks).map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}</select></label>
      <label htmlFor={`${id}-method`}>Compare a method<select id={`${id}-method`} value={method} onChange={e => setMethodChoice(e.target.value)}>{track.methods.map(m => <option key={m.id} value={m.id}>{m.label}{m.id === track.selected ? ' · global default' : ''}</option>)}</select></label>
    </div>
    <p className="annual-selection"><strong>Default chosen after comparison:</strong> lowest pooled candidate error; same method for every country, not independently confirmed. All candidates remain available.</p>
    <div className="annual-scorecards" aria-label="Selected method results">
      <div className={`annual-scorecard ${positive ? 'annual-better' : score.improvementPercent !== null && score.improvementPercent < 0 ? 'annual-worse' : ''}`}><span>{name} · versus persistence</span><strong>{skillLabel(score.improvementPercent)}</strong><small>{fmt(score.mae, 3)} versus {fmt(score.baselineMAE, 3)} {track.scoreUnit} mean absolute error</small></div>
      <div className="annual-scorecard"><span>Matched forecast years · {name}</span><strong>{score.n} scored years</strong><small>{coverage.start}–{coverage.end}: {coverage.missingTarget} forecasts with missing targets; {coverage.unavailable} without eligible forecasts</small></div>
      <div className="annual-scorecard"><span>Across the whole scored cohort</span><strong>{skillLabel(pooled.improvementPercent)}</strong><small>{pooled.n.toLocaleString('en-US')} country-years · {pooled.countries} {outcome === 'wellbeing' ? 'preselected countries; 3 of 72 calendar country-years excluded' : `economies; ${pooled.missingOutcomes} predicted targets missing and unscored`}</small></div>
    </div>
    <figure className="history-figure annual-figure">
      <figcaption><div className="annual-chart-heading"><div><h2>{name} · {track.label}</h2><p>{methodLabel} against the observed history</p></div>{outcome !== 'wellbeing' && <button type="button" className="annual-range" aria-pressed={fullHistory} onClick={() => setFullHistory(v => !v)}>{fullHistory ? 'Show recent years' : 'Show full history'}</button>}</div></figcaption>
      <ul className="history-legend"><li className="history-observed">● Observed / source estimate</li><li className="history-modeled">━ Selected method</li><li className="history-persistence">┄ Persistence</li></ul>
      <div className="annual-panel-title"><h3>Levels</h3><span>{track.unit}</span></div>
      <AnnualChart rows={rows} year={inspectedYear} onYear={setYear} label={`${name}: observed and forecast ${track.unit}`} candidate={methodLabel}/>
      <div className="annual-panel-title"><h3>Annual changes</h3><span>{track.changeUnit}</span></div>
      <p className="annual-chart-note">Close levels can hide missed falls and rebounds. Changes are measured from each forecast’s observed prior-year value, on the same eligible origins; gaps stay empty.</p>
      <AnnualChart rows={rows} changes year={inspectedYear} onYear={setYear} label={`${name}: observed and predicted annual changes in ${track.changeUnit}`} candidate={methodLabel}/>
      <div className="annual-inspector">
        <label htmlFor={`${id}-year`}>Inspect year <strong>{inspectedYear}</strong><input id={`${id}-year`} type="range" min={rows[0].year} max={rows.at(-1)!.year} step={1} value={inspectedYear} onChange={e => setYear(Number(e.target.value))}/></label>
        <div className="annual-inspector-values" aria-live="polite" aria-atomic="true"><span>Observed <strong>{fmt(inspected.observed, tableDigits)}</strong></span><span>Selected method <strong>{fmt(inspected.modeled, tableDigits)}</strong></span><span>Persistence <strong>{fmt(inspected.persistence, tableDigits)}</strong></span><span>Observed / predicted change <strong>{fmt(inspected.observedChange, 3)} / {fmt(inspected.modeledChange, 3)}</strong></span></div>
        <p>{inspected.status}{inspected.forecast ? `. Origin ${inspected.forecast.originYear}; fitting stops at ${inspected.forecast.trainingCutoff}.` : '.'}</p>
      </div>
      <p className="history-note">Axes fit this country and selected method. “k” means thousand. Hover or touch the charts, use the year slider with arrow keys, or open the exact values below.</p>
    </figure>
    <p className="annual-source"><a href={outcome === 'wellbeing' ? `https://data.worldhappiness.report/country/${country}` : track.source.url} target="_blank" rel="noreferrer">{track.source.label}</a> · retrieved {track.source.retrievedAt.slice(0, 10)}. {track.source.note}</p>
    {outcome === 'wellbeing' && <aside className="history-boundary"><strong>Annual wellbeing swings remain unsolved.</strong> The globally selected blend improves pooled error by only 1.21%, and loses in five of eight countries. The separate <a href={`${gallery}/${country.toLowerCase()}.md`} target="_blank" rel="noreferrer">conditional wellbeing replay gallery</a> uses actual target-year drivers: <strong>it is not a forecast</strong>. Its {annualArtifact.conditional.scored} scored country-years ({annualArtifact.conditional.start}–{annualArtifact.conditional.end}) differ from the annual forecast’s 69 ({2017}–{2025}); the mode masks and fitting cutoffs differ, so pooled errors cannot isolate input quality.</aside>}
    {outcome === 'unemployment' && <p className="history-boundary">The globally selected candidate’s one-year gain is small; it loses in 113 of 187 economies. All registered candidates lose to persistence at five years. These one-year charts do not establish longer-term prediction skill.</p>}
    <details><summary>Every method’s result · {name}</summary><div className="history-table-scroll" tabIndex={0} role="region" aria-label="All annual methods"><table><caption>Saved one-year mean absolute error (MAE); lower is better. Each method uses the same {score.n} scored years for {name}. All-country results use a separate {pooled.n.toLocaleString('en-US')}-row pooled cohort. Units: {track.scoreUnit}. No outcomes are combined.</caption><thead><tr>{['Method', 'Country MAE', 'Country vs persistence', 'Pooled MAE', 'Pooled vs persistence'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{track.methods.map(m => <tr key={m.id}><th scope="row">{m.label}{m.id === track.selected ? ' (global default)' : ''}</th><td>{fmt(countryPath.scores[m.id].mae, 3)}</td><td>{skillLabel(countryPath.scores[m.id].improvementPercent)}</td><td>{fmt(track.pooled[m.id].mae, 3)}</td><td>{skillLabel(track.pooled[m.id].improvementPercent)}</td></tr>)}</tbody></table></div></details>
    <details><summary>Exact annual values, gaps and forecast origins</summary><div className="history-table-scroll" tabIndex={0} role="region" aria-label="Exact annual forecast values"><table><caption>{name}; level units: {track.unit}. Change units: {track.changeUnit}. Missing entries are never filled with zero. GDP score errors divide the dollar miss by that forecast’s origin GDP and multiply by 100.</caption><thead><tr>{['Year', 'Observed', 'Selected method', 'Persistence', 'Observed change', 'Predicted change', 'Fit cutoff', 'Availability'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{allRows.map(r => <tr key={r.year}><th scope="row">{r.year}</th><td>{fmt(r.observed, tableDigits)}</td><td>{fmt(r.modeled, tableDigits)}</td><td>{fmt(r.persistence, tableDigits)}</td><td>{fmt(r.observedChange, 3)}</td><td>{fmt(r.modeledChange, 3)}</td><td>{r.forecast?.trainingCutoff ?? '—'}</td><td>{r.status}</td></tr>)}</tbody></table></div></details>
    <details><summary>What this comparison can and cannot establish</summary><p>{outcome === 'wellbeing' ? 'Wellbeing fits expand from 2005 through the prior year; initial training ends in 2016. Forecast drivers are projected from prior dated values. Each scored year needs complete prior-year and two-years-prior outcomes and drivers; no target-year drivers are used. Missing target years and missing lagged inputs exclude rows from the common method mask.' : 'Objective forecasts require exactly 20 complete prior annual values at each origin. Missing history excludes that origin for all methods; missing target observations keep the forecast visible but unscored. Scores cover all eligible origins, including years outside the displayed recent range.'}</p><p>{coverage.scored} scored + {coverage.missingTarget} forecast targets missing + {coverage.unavailable} unavailable forecasts = {coverage.end - coverage.start + 1} calendar target years, {coverage.start}–{coverage.end}. Counts are for this country and outcome. A missing target can also prevent later forecasts by removing a required lag.</p><p>The eight illustrated countries were specified before comparison. Objective pooled scores include the wider World Bank cohort; wellbeing pooled scores include only these eight countries. Rows share the same method mask within each outcome; outcome and replay-mode masks differ.</p><p>At a common one-year origin, change error equals level error algebraically. The two panels are not two independent successes. Source revisions and modeled estimates can contain later information; dates do not establish historical publication availability. No calibrated uncertainty interval, independent winner confirmation, or causal policy validity follows.</p><p>The earlier Held-out test starts in 2018 and predicts multiple years without new observations. Its wellbeing target uses three-year averages. The Historical reconstruction also uses observations from its fitting period. Their scores are not comparable to these annual tests.</p><p><a href={`${gallery}/${country.toLowerCase()}.md`} target="_blank" rel="noreferrer">Read this country’s complete research gallery and five-year comparisons</a>.</p></details>
    <details><summary>Saved evidence, source rights and reproducibility</summary><p>{annualArtifact.provenance.operation} This view does not replace simulator defaults.</p><p>World Bank attribution and source metadata are retained under its <a href="https://datacatalog.worldbank.org/int/public-licenses#cc-by" target="_blank" rel="noreferrer">CC BY 4.0 terms</a>. World Happiness Report / Gallup public-chart transcriptions have separate source terms; a redistribution license was not independently verified and is not supplied by the repository’s code license.</p><p>Run from the repository terminal to check this presentation against the saved evaluation files:</p><pre>node --import tsx scripts/history/export-annual.ts --check</pre><p>SHA-256 hashes identify the exact saved inputs and exporter. The download includes source attribution, collection caveats, receipts and original evaluation hashes.</p><div className="history-table-scroll" tabIndex={0} role="region" aria-label="Annual source hashes"><table><thead><tr><th scope="col">Saved source</th><th scope="col">SHA-256</th></tr></thead><tbody>{Object.entries(annualArtifact.provenance.sourceHashes).map(([path, hash]) => <tr key={path}><th scope="row">{path}</th><td><code>{hash}</code></td></tr>)}</tbody></table></div></details>
    <button type="button" onClick={download}>Download annual evidence and provenance (JSON)</button>
  </section>;
}

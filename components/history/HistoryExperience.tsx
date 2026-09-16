import React, { useId, useMemo, useState } from 'react';
import rawArtifact from '../../data/hindcast/experience.json';
import { annualRows, type HistoryArtifact, type HistoryMetric } from '../../src/history/types';
import './history.css';
import HeldoutExperience from './HeldoutExperience';

const artifact = rawArtifact as unknown as HistoryArtifact;
const labels: Record<string, string> = {
  'ai-off': 'Headline · AI off, UBI off',
  'ai-off-ubi-on': 'Sensitivity · AI off, UBI on',
  'ai-on': 'Sensitivity · AI on, UBI on',
  'anchored-ai-off': 'Sensitivity · Evidence-anchored, AI off, UBI off',
  'anchored-ai-on': 'Sensitivity · Evidence-anchored, AI on, UBI on',
};
const format = (value: number | null, digits = 2) => value === null ? 'Missing observation' : value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const signed = (value: number) => `${value > 0 ? '+' : ''}${format(value)}`;

function downloadData() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(artifact)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'historical-reconstruction-v1.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Static, lazy-loadable experience; never invokes or qualifies the financial experiment. */
function ReconstructionExperience(): React.ReactElement {
  const [runId, setRunId] = useState('ai-off');
  const [countryId, setCountryId] = useState('USA');
  const [metric, setMetric] = useState<HistoryMetric>('wellbeing');
  const id = useId();
  const report = artifact.report;
  const run = report.runs[runId];
  const country = run.countries.find(c => c.id === countryId)!;
  const rows = useMemo(() => annualRows(run, countryId, metric), [run, countryId, metric]);
  const isWellbeing = metric === 'wellbeing';
  const units = isWellbeing ? 'Wellbeing index points (0–100)' : 'GDP per person (constant-2015 US dollars)';
  const values = rows.flatMap(row => [row.modeled, row.observed, row.persistence]).filter((value): value is number => value !== null);
  const low = isWellbeing ? Math.max(0, Math.min(...values) - 3) : Math.max(0, Math.min(...values) * 0.92);
  const high = isWellbeing ? Math.min(100, Math.max(...values) + 3) : Math.max(...values) * 1.08;
  const x = (index: number) => 85 + index * 65;
  const y = (value: number) => 280 - (value - low) / (high - low || 1) * 235;
  const path = (key: 'modeled' | 'observed' | 'persistence') => {
    let connected = false;
    return rows.map((row, index) => {
      const value = row[key];
      if (value === null) { connected = false; return ''; }
      const segment = `${connected ? 'L' : 'M'}${x(index)},${y(value)}`;
      connected = true;
      return segment;
    }).join(' ');
  };
  const endpoint = rows[rows.length - 1];
  const error = endpoint.modeled - endpoint.observed!;
  const persistenceGdpMae = run.countries.reduce((sum, c) => sum + Math.abs(c.actualGdpGrowthPct), 0) / run.countries.length;

  return <section className="history-experience" aria-labelledby={`${id}-title`}>
    <header>
      <p className="history-eyebrow">Check against history · 2015–2025</p>
      <h1 id={`${id}-title`}>How closely does the model reconstruct the past?</h1>
      <p className="history-boundary"><strong>Historical reconstruction, not an out-of-sample forecast.</strong> The 2015 starting point copies observed values, and the wellbeing anchor was fitted using 2015–2025. This is the legacy world model, not the new financial allocation model.</p>
      <p>The headline switches off both artificial intelligence (AI) displacement and corporate universal basic income (UBI). Its average 2025 wellbeing miss is <strong>{format(report.runs['ai-off'].score.maeWellbeing)} points</strong>, beside <strong>{format(report.baselines.persistence.mae)} points</strong> for predicting no change. That small improvement does not establish predictive or causal validity.</p>
    </header>

    <div className="history-controls">
      <label htmlFor={`${id}-run`}>Model run<select id={`${id}-run`} value={runId} onChange={e => setRunId(e.target.value)}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label htmlFor={`${id}-country`}>Country<select id={`${id}-country`} value={countryId} onChange={e => setCountryId(e.target.value)}>{[...run.countries].sort((a, b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}</select></label>
      <label htmlFor={`${id}-metric`}>Observed measure<select id={`${id}-metric`} value={metric} onChange={e => setMetric(e.target.value as HistoryMetric)}><option value="wellbeing">Wellbeing index</option><option value="gdp">Constant-2015 GDP per person</option></select></label>
    </div>

    <figure className="history-figure">
      <figcaption><h2>{country.name} · {isWellbeing ? 'Wellbeing' : 'GDP per person'}</h2><p>{units} · annual 2015–2025. <a href={report.sources[isWellbeing ? 'wellbeingLadder' : 'gdpPerCapita'].url} target="_blank" rel="noreferrer">Observation source</a></p></figcaption>
      <ul className="history-legend" aria-label="Chart legend"><li className="history-observed">● Observed</li><li className="history-modeled">━ Model reconstruction</li><li className="history-persistence">┄ Persistence baseline</li></ul>
      <svg viewBox="0 0 790 330" role="img" aria-labelledby={`${id}-chart-title ${id}-chart-desc`}>
        <title id={`${id}-chart-title`}>{country.name}, {units}, 2015 to 2025</title>
        <desc id={`${id}-chart-desc`}>{labels[runId]}. Observed teal points, modeled blue line, dashed copper persistence baseline. Missing observations break the line. Values are available in the annual data table below. The vertical axis is scaled to the selected country.</desc>
        {[0, 1, 2, 3, 4].map(tick => { const value = low + (high - low) * tick / 4; return <g key={tick}><line x1="85" x2="735" y1={y(value)} y2={y(value)} className="history-grid"/><text x="76" y={y(value) + 5} textAnchor="end">{format(value, isWellbeing ? 1 : 0)}</text></g>; })}
        {rows.map((row, index) => index % 2 === 0 && <text key={row.year} x={x(index)} y="310" textAnchor="middle">{row.year}</text>)}
        <path d={path('persistence')} className="history-line history-persistence" strokeDasharray="8 6"/>
        <path d={path('modeled')} className="history-line history-modeled"/>
        <path d={path('observed')} className="history-line history-observed"/>
        {rows.map((row, index) => row.observed !== null && <circle key={row.year} cx={x(index)} cy={y(row.observed)} r="4" className="history-point"><title>{row.year}: observed {format(row.observed)}</title></circle>)}
      </svg>
      <p>2025 observed <strong>{format(endpoint.observed)}</strong>; modeled <strong>{format(endpoint.modeled)}</strong>; error (model minus observed) <strong>{signed(error)} {isWellbeing ? 'index points' : 'constant-2015 US dollars'}</strong>.</p>
      <p className="history-note">{rows.filter(row => row.observed !== null).length} of {rows.length} annual observations available for this country and measure. Persistence holds the available 2015 observation constant. Missing annual observations remain gaps; they are never filled. The model maps each annual observation to January; the axis is scaled to this country.</p>
    </figure>

    <section className="history-cohort" aria-labelledby={`${id}-cohort`}>
      <h2 id={`${id}-cohort`}>The full cohort, including the misses</h2>
      <p>{labels[runId]} · <strong>{report.coverage.scored} of {report.coverage.repoCountries} countries</strong> have both measures at both endpoints. {report.coverage.unmatched.length} excluded countries do not enter these scores. Each included country has equal weight.</p>
      <dl className="history-scores"><div><dt>Model wellbeing mean absolute error</dt><dd>{format(run.score.maeWellbeing)} <small>index points</small></dd></div><div><dt>Persistence wellbeing mean absolute error</dt><dd>{format(report.baselines.persistence.mae)} <small>index points</small></dd></div><div><dt>Model GDP growth mean absolute error</dt><dd>{format(run.score.maeGdpGrowthPct)} <small>percentage points</small></dd></div><div><dt>Persistence GDP growth mean absolute error</dt><dd>{format(persistenceGdpMae)} <small>percentage points</small></dd></div></dl>
      <p>Scores compare 2015–2025 changes or the 2025 endpoint, not all annual points pooled. GDP growth means the total percentage change across this decade. {run.aiOff ? 'Cross-country GDP growth correlation is not meaningful for this AI-off run: modeled growth is effectively common across countries.' : 'This AI-on sensitivity reconstruction does not establish predictive or causal validity.'} This page omits GDP growth correlation from its accuracy evidence.</p>
    </section>

    <details><summary>Annual data table · {country.name} · {units}</summary><div className="history-table-scroll"><table><caption>Annual values for {country.name} — {units}</caption><thead><tr><th scope="col">Year</th><th scope="col">Observed</th><th scope="col">Modeled</th><th scope="col">Persistence</th><th scope="col">Model minus observed</th></tr></thead><tbody>{rows.map(row => <tr key={row.year}><th scope="row">{row.year}</th><td>{format(row.observed)}</td><td>{format(row.modeled)}</td><td>{format(row.persistence)}</td><td>{row.observed === null ? 'Not scored' : signed(row.modeled - row.observed)}</td></tr>)}</tbody></table></div></details>
    <details><summary>All {run.countries.length} countries · 2025 endpoints and errors</summary><div className="history-table-scroll"><table><caption>{labels[runId]} — wellbeing index points and GDP growth percentage-point errors</caption><thead><tr><th scope="col">Country</th><th scope="col">Observed wellbeing</th><th scope="col">Modeled wellbeing</th><th scope="col">Wellbeing error</th><th scope="col">GDP growth error</th></tr></thead><tbody>{[...run.countries].sort((a, b) => Math.abs(b.wellbeingError) - Math.abs(a.wellbeingError)).map(c => <tr key={c.id}><th scope="row">{c.name} ({c.id})</th><td>{format(c.actualWellbeingEnd)}</td><td>{format(c.predictedWellbeingEnd)}</td><td>{signed(c.wellbeingError)}</td><td>{signed(c.gdpGrowthErrorPct)}</td></tr>)}</tbody></table></div></details>
    <details><summary>Excluded countries and missing endpoints</summary><p>The same endpoint requirements apply to every run. An interior missing observation does not exclude a country with both endpoints.</p><ul>{[...run.dropped, ...run.droppedAtEnd].map(c => <li key={c.id}>{c.name} ({c.id}): {c.reason}</li>)}</ul></details>
    <details><summary>What this reconstruction cannot establish</summary><p>The observations were retrieved after the reconstruction period. Revised or later-published values are not the information a forecaster had in 2015. Population, governance and other background attributes come from the legacy model constants, rather than a complete historical panel.</p><p>Observed wellbeing is the Cantril ladder, rescaled from 0–10 to 0–100 by multiplying by ten; matching scales does not establish identical constructs. COVID, war, inflation and other omitted shocks can dominate these changes. No causal validation follows. A separate Held-out test now freezes calibration before scoring 2019–2025. It uses revised vintages and does not turn this reconstruction into an independent forecast.</p><p>All five existing runs are offered in the selector. The sensitivity cases explore channels, and are not evidence that corporate UBI actually occurred during this decade.</p></details>
    <details><summary>Model identity, source vintages and reproducibility</summary><p>{artifact.model}</p><p>{artifact.fitScope}</p><p>{artifact.calendar}</p><ul>{Object.entries(report.sources).map(([key, source]) => <li key={key}><a href={source.url} target="_blank" rel="noreferrer">{source.name}</a> · retrieved {source.retrievedAt}{key === 'unemployment' ? ' · fetched but not scored' : ''}</li>)}</ul><p>Artifact version {artifact.version}. Recreate and check from the repository terminal:</p><pre>{`${artifact.producingCommand}\n${artifact.checkingCommand}`}</pre><p>Run model identifier: <code>{run.params.id}</code>. SHA-256 source hashes:</p><div className="history-table-scroll"><table><thead><tr><th scope="col">Source</th><th scope="col">SHA-256</th></tr></thead><tbody>{Object.entries(artifact.sourceHashes).map(([source, hash]) => <tr key={source}><th scope="row">{source}</th><td><code>{hash}</code></td></tr>)}</tbody></table></div></details>
    <button type="button" onClick={downloadData}>Download all countries, years, runs and provenance (JSON)</button>
  </section>;
}

export default function HistoryExperience(): React.ReactElement {
  const [view, setView] = useState<'holdout' | 'reconstruction'>('holdout');
  return <><nav className="history-experience history-view-nav" aria-label="History evidence views">
    <button type="button" aria-pressed={view === 'holdout'} onClick={() => setView('holdout')}>Held-out test</button>
    <button type="button" aria-pressed={view === 'reconstruction'} onClick={() => setView('reconstruction')}>Historical reconstruction</button>
  </nav>{view === 'holdout' ? <HeldoutExperience/> : <ReconstructionExperience/>}</>;
}

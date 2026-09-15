import React, { useMemo, useState } from 'react';
import { financialRecord, getFinancialCollection } from '../../src/financials/catalog';
import { recipientCohorts, recipientCohort } from '../../src/financials/cohorts';
import { createFinancialModel, financialModelMetadata } from '../../src/financials/model';
import {
  buildExperiment,
  experimentUrl,
  parseExperiment,
  MAX_FINANCE_BYTES,
  type FinancialExperiment,
} from '../../src/financials/share';
import type { FinancialField, FinancialRecord, FinancialScenario } from '../../src/financials/types';
import { modelHash } from '../../src/policy/hash';
import { getDefaultRunner, type Runner } from '../../src/workers/client';
import { useRunnerJob } from '../lab/useRunnerJob';
import { currentFinancialResult } from './result';
import { buildModelExport } from '../lab/importState';
import type { LabEntry } from '../guided/GuidedExperience';
import './published.css';

const currentUrl = () => (typeof window === 'undefined' ? 'http://localhost/' : window.location.href);
const number = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 0 });
const expectedPeople = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 2 });
const dollars = (v: number) =>
  '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (v: number) =>
  Math.abs(v) >= 1e9
    ? `${dollars(v / 1e9)} billion`
    : Math.abs(v) >= 1e6
      ? `${dollars(v / 1e6)} million`
      : dollars(v);
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export interface PublishedProps {
  mode: 'explore' | 'compare';
  initial?: FinancialExperiment;
  error?: string;
  onMode: (mode: 'explore' | 'compare') => void;
  onLab: (kind?: LabEntry) => void;
  onWorld: () => void;
  onHistory: () => void;
  onRisk: () => void;
  runner?: Runner;
}
function ShareInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="pub-share-control">
      <span>
        {label} <small>Assumption</small>
      </span>
      <div>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={value * 100}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
        />
        <input
          type="number"
          aria-label={`${label} percent`}
          min="0"
          max="100"
          step="any"
          value={Number((value * 100).toFixed(8))}
          onChange={(e) => {
            if (e.target.value !== '' && e.target.validity.valid) onChange(Number(e.target.value) / 100);
          }}
        />
        <span>%</span>
      </div>
    </label>
  );
}
function Scenario({
  side,
  record,
  scenario,
  update,
  experiment,
  runner,
}: {
  side: 'A' | 'B';
  record: FinancialRecord;
  scenario: FinancialScenario;
  update: (patch: Partial<FinancialScenario>) => void;
  experiment: FinancialExperiment;
  runner: Runner;
}) {
  const built = useMemo(() => {
    try {
      return { model: createFinancialModel(record, scenario), error: null };
    } catch (e) {
      return { model: null, error: String(e) };
    }
  }, [record, scenario]);
  const key = built.model ? modelHash(built.model) : JSON.stringify(scenario);
  const job = built.model
    ? { kind: 'lab-point' as const, model: built.model, overlays: [], hypotheticalOverlays: null }
    : null;
  const state = useRunnerJob(runner, `financial-experience-${side}`, job, key);
  const result = currentFinancialResult(state, key);
  const value = (id: string) => result!.series._[id][0];
  const cohort = recipientCohort(scenario.recipientCountry);
  const fields = [
    ['costPerCompletion', 'Cost per completion (USD)', 1],
    ['instructorCapacity', 'Instructor capacity (people/year)', 0],
    ['eligibleTrainees', 'Eligible trainees (people/year)', 0],
    ['suitableOpenings', 'Suitable openings (jobs/year)', 0],
  ] as const;
  const diagnostic =
    built.error ||
    state.message ||
    (state.resultKey === key && state.status === 'done' && !result
      ? state.result?.plain.diagnostics.map((d) => d.message).join(' ') ||
        'The model returned incomplete or invalid results. Check the assumptions and try again.'
      : null);
  let constraints: string[] = [];
  if (result && scenario.trainingShare > 0) {
    const completion = value('completions');
    if (completion >= scenario.instructorCapacity)
      constraints.push(
        'Instructor capacity limits completions. Extra funding cannot create more teaching places under this assumption.',
      );
    if (completion >= scenario.eligibleTrainees)
      constraints.push(
        'Eligibility limits completions. More money does not expand the assumed eligible group.',
      );
    if (completion >= cohort.population) constraints.push('The resident population limits completions.');
    if (completion >= value('training_budget') / scenario.costPerCompletion - 1e-8)
      constraints.push('Training funding limits completions at the assumed cost.');
    if (value('placements') >= scenario.suitableOpenings)
      constraints.push(
        'Suitable job openings limit gross placements. Training funds alone do not create openings.',
      );
    if (scenario.placementRate < 1)
      constraints.push(
        `The assumed ${number(scenario.placementRate * 100)}% placement rate also limits the transition from completions to jobs.`,
      );
  }
  return (
    <section className={`pub-scenario pub-side-${side}`} aria-label={`Scenario ${side}`}>
      <header>
        <h2>Scenario {side}</h2>
        <span>{scenario.trainingShare === 0 ? 'Resident payments' : 'Payments + training'}</span>
      </header>
      <div className="pub-scenario-grid">
        <div className="pub-controls" id={`pub-controls-${side}`} tabIndex={-1}>
          <ShareInput
            label={`Policy share ${side}`}
            value={scenario.policyShare}
            onChange={(policyShare) => update({ policyShare })}
          />
          <p className="pub-hint">Share of the derived annual cash-flow ceiling redirected to this policy.</p>
          <ShareInput
            label={`Training share ${side}`}
            value={scenario.trainingShare}
            onChange={(trainingShare) => update({ trainingShare })}
          />
          <p className="pub-hint">
            {number((1 - scenario.trainingShare) * 100)}% goes to residents;{' '}
            {number(scenario.trainingShare * 100)}% is reserved for training.
          </p>
          <details className="pub-training">
            <summary>Training assumptions</summary>
            <p>These are editable scenario choices, not company observations or measured program effects.</p>
            {fields.map(([field, label, min]) => (
              <label key={field}>
                {label}
                <input
                  type="number"
                  min={min}
                  step="any"
                  aria-label={`${label} ${side}`}
                  value={scenario[field]}
                  onChange={(e) => {
                    if (e.target.value !== '' && e.target.validity.valid)
                      update({ [field]: Number(e.target.value) });
                  }}
                />
              </label>
            ))}
            <ShareInput
              label={`Placement rate ${side}`}
              value={scenario.placementRate}
              onChange={(placementRate) => update({ placementRate })}
            />
          </details>
        </div>
        <div className="pub-results" aria-live="polite">
          {!result ? (
            <div className="pub-run-message" role={diagnostic ? 'alert' : 'status'}>
              <h3>{diagnostic ? 'This scenario could not be calculated' : 'Calculating this scenario…'}</h3>
              <p>{diagnostic || 'Waiting for the current inputs. Previous results are hidden.'}</p>
              {diagnostic && <button onClick={state.rerun}>Try calculation again</button>}
            </div>
          ) : (
            <>
              <div className="pub-payment">
                <span>Modeled resident payment</span>
                <strong>{dollars(value('monthly_dividend_per_person'))}</strong>
                <span>per person / month</span>
                <p>{dollars(value('monthly_dividend_per_person') * 12)} per person / fiscal year</p>
              </div>
              <p className="pub-hint">
                Annual resident allocation ÷ 12 ÷ {number(cohort.population)} residents. Monthly equivalent,
                not a forecast.
              </p>
              <div className="pub-allocation" role="group" aria-label="Allocation of proposed policy budget">
                {[
                  ['dividend_spend', 'Resident payments'],
                  ['actual_training_spend', 'Training spent'],
                  ['unspent_training', 'Training unspent'],
                ].map(([id, label]) => (
                  <div key={id}>
                    <div>
                      <span>{label}</span>
                      <strong>{money(value(id))}</strong>
                    </div>
                    <div className="pub-track">
                      <span
                        style={{
                          width: `${value('policy_budget') > 0 ? Math.max(0, (value(id) / value('policy_budget')) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <dl className="pub-totals">
                <div>
                  <dt>Proposed annual budget</dt>
                  <dd>{money(value('policy_budget'))}</dd>
                </div>
                <div>
                  <dt>Expected completions</dt>
                  <dd>{expectedPeople(value('completions'))} people</dd>
                </div>
                <div>
                  <dt>Gross expected placements</dt>
                  <dd>{expectedPeople(value('placements'))} people</dd>
                </div>
              </dl>
              {constraints.length > 0 && (
                <aside className="pub-limits">
                  <h3>What limits this scenario?</h3>
                  {constraints.map((c) => (
                    <p key={c}>{c}</p>
                  ))}
                  {value('unspent_training') > 0.01 && (
                    <p>
                      {money(value('unspent_training'))} stays unspent; it is not automatically added to
                      resident payments.
                    </p>
                  )}
                </aside>
              )}
            </>
          )}
        </div>
      </div>
      <footer>
        <a
          className="pub-action"
          target="_blank"
          rel="noopener noreferrer"
          href={experimentUrl(experiment, currentUrl(), side)}
        >
          Open {scenario.trainingShare > 0 ? 'training equations' : 'exact model'} {side} in Model Lab
        </a>
        <button
          disabled={!built.model}
          onClick={() =>
            built.model &&
            download(`${record.id}-${side}.model.json`, buildModelExport(built.model, [], 'imported'))
          }
        >
          Download exact model {side}
        </button>
      </footer>
    </section>
  );
}
export default function PublishedExperience({
  mode,
  initial,
  error,
  onMode,
  onLab,
  onWorld,
  onHistory,
  onRisk,
  runner = getDefaultRunner(),
}: PublishedProps) {
  const [saved, setSaved] = useState(() => initial ?? buildExperiment());
  const [fileError, setFileError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const collection = getFinancialCollection(saved.collectionId);
  const record = financialRecord(saved.recordId, saved.collectionId);
  const cohort = recipientCohort(saved.scenarios.A.recipientCountry);
  const experiment = buildExperiment(saved.recordId, saved.scenarios, mode, saved.collectionId);
  function update(side: 'A' | 'B', patch: Partial<FinancialScenario>) {
    try {
      const next = buildExperiment(
        saved.recordId,
        { ...saved.scenarios, [side]: { ...saved.scenarios[side], ...patch } },
        mode,
        saved.collectionId,
      );
      setSaved(next);
      setFileError(null);
    } catch (e) {
      setFileError(`Inputs were not applied: ${String(e)}`);
    }
  }
  if (error)
    return (
      <div className="published pub-invalid" role="alert">
        <h1>This experiment could not be reopened</h1>
        <p>{error}</p>
        <p>No shared results have been calculated.</p>
        <a href="?tab=explore">Start a new experiment</a>
      </div>
    );
  return (
    <div className={`published ${mode === 'compare' ? 'pub-compare' : ''}`}>
      <header className="pub-intro">
        <h1>
          Understand the choices
          <br className="pub-desktop-break" /> in an AI transition.
        </h1>
        <p>
          Start with a real company’s cash flow. Explore what a policy share could fund, then inspect the
          assumptions, compare alternatives and check the world model against history.
        </p>
        <button
          className="pub-start"
          onClick={() => {
            const target = document.getElementById('pub-controls-A');
            target?.scrollIntoView({ block: 'start' });
            target?.focus({ preventScroll: true });
          }}
        >
          Try an allocation
        </button>
      </header>
      <section className="pub-source" aria-label="Published financial source">
        <div>
          <label htmlFor="pub-company">What could a share of this company’s cash flow fund?</label>
          <select
            id="pub-company"
            value={record.id}
            onChange={(e) => setSaved(buildExperiment(e.target.value, saved.scenarios, mode, saved.collectionId))}
          >
            {collection.records.map((r) => (
              <option key={r.id} value={r.id}>
                {r.companyName} · FY{r.fiscalYear} (ended {r.periodEnd})
              </option>
            ))}
          </select>
          <p>
            {record.periodStart} to {record.periodEnd} · Nominal USD
          </p>
        </div>
        <div>
          <label htmlFor="pub-cohort">Resident recipients</label>
          <select
            id="pub-cohort"
            value={cohort.id}
            onChange={(e) =>
              setSaved(
                buildExperiment(
                  record.id,
                  {
                    A: { ...saved.scenarios.A, recipientCountry: e.target.value },
                    B: { ...saved.scenarios.B, recipientCountry: e.target.value },
                  },
                  mode,
                  saved.collectionId,
                ),
              )
            }
          >
            {recipientCohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p>
            <a href={cohort.sourceUrl} target="_blank" rel="noreferrer">
              {number(cohort.population)} residents, {cohort.year}
            </a>
          </p>
        </div>
      </section>
      <section className="pub-bridge" aria-label="Financial statement bridge">
        <div className="pub-bridge-heading">
          <h2>From reported cash flow to a policy choice</h2>
          <a href={record.sourceUrl} target="_blank" rel="noreferrer">
            Read {record.companyName}’s source report
          </a>
        </div>
        <div className="pub-waterfall">
          <div>
            <span>
              Operating cash flow <small>Reported</small>
            </span>
            <strong>{money(record.operatingCashFlow * 1e6)}</strong>
            <div className="pub-flow-bar" />
          </div>
          <span className="pub-operator">−</span>
          <div>
            <span>
              {record.cashCapitalInvestmentLabel} <small>Reported</small>
            </span>
            <strong>{money(record.cashCapitalInvestment * 1e6)}</strong>
            <div
              className="pub-flow-bar pub-deduction"
              style={{ width: `${(record.cashCapitalInvestment / record.operatingCashFlow) * 100}%` }}
            />
          </div>
          <span className="pub-operator">=</span>
          <div>
            <span>
              Annual cash-flow difference <small>Derived</small>
            </span>
            <strong>{money((record.operatingCashFlow - record.cashCapitalInvestment) * 1e6)}</strong>
            <div
              className="pub-flow-bar"
              style={{
                width: `${Math.max(0, 1 - record.cashCapitalInvestment / record.operatingCashFlow) * 100}%`,
              }}
            />
          </div>
        </div>
        <p>{record.cashCapitalInvestmentNote}</p>
        <p className="pub-boundary">
          Before shareholder dividends and buybacks. A proposed policy would redirect resources; effects on
          owners, investment and taxes are not estimated. This is not measured AI-generated cash.
        </p>
        <details>
          <summary>Source definitions and competing uses</summary>
          <p>
            {record.sourceTitle}. Report dated {record.reportDate}; retrieved {record.retrievedAt}.{' '}
            {record.consolidation}
          </p>
          <p>Saved collection: {collection.id}.</p>
          <p>
            Allocation ceiling is the greater of zero and the annual cash-flow difference. A negative
            difference remains visible and funds no allocation.
          </p>
          <dl className="pub-totals">
            {([
              ['Revenue', 'revenue'],
              ['Net income', 'netIncome'],
              ['Shareholder dividends', 'dividends'],
              ['Share repurchases', 'repurchases'],
            ] satisfies [string, FinancialField][]).map(([label, field]) => (
              <div key={field}>
                <dt>{label} ({record.evidence.find(e => e.field === field)?.derivedValue !== undefined ? 'derived' : record[field] === null ? 'not collected' : 'reported'})</dt>
                <dd>{record[field] === null ? 'Not collected; not assumed zero' : money(record[field] * 1e6)}</dd>
              </div>
            ))}
          </dl>
          <p>
            Dividends and repurchases are competing historical uses, never extra money added to the source.{' '}
            {collection.coverage}
          </p>
          {record.evidence.map((e) => (
            <p key={e.field}>
              <strong>{e.lineItem}</strong>:{' '}
              {e.derivedValue !== undefined ? `${number(e.derivedValue)} million USD (derived)` : e.reportedValue === null ? 'not collected' : `${number(e.reportedValue)} million USD`}.{' '}
              {e.locator} {e.note}
            </p>
          ))}
        </details>
      </section>
      {mode === 'compare' && (
        <p className="pub-comparison-note">
          Edit both alternatives independently. A and B share the same company report and resident cohort.
          Budgets can differ with each policy share; training inputs are assumptions in both.
        </p>
      )}
      <div className="pub-scenarios">
        <Scenario
          side="A"
          record={record}
          scenario={saved.scenarios.A}
          update={(patch) => update('A', patch)}
          experiment={experiment}
          runner={runner}
        />
        {mode === 'compare' && (
          <Scenario
            side="B"
            record={record}
            scenario={saved.scenarios.B}
            update={(patch) => update('B', patch)}
            experiment={experiment}
            runner={runner}
          />
        )}
      </div>
      <p className="pub-boundary">
        {financialModelMetadata.trainingBoundary} This single-period experiment does not estimate economy-wide
        outcomes.
      </p>
      <section className="pub-save" aria-label="Save and reopen experiment">
        <h2>Keep this experiment</h2>
        <div>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(experimentUrl(experiment, currentUrl()));
                setNotice('Experiment link copied. Both scenarios and the selected view are saved.');
              } catch {
                setNotice('Clipboard unavailable. Copy the link below.');
              }
            }}
          >
            Copy experiment link
          </button>
          <button onClick={() => download(`${record.id}.experiment.json`, experiment)}>
            Download experiment
          </button>
          <label className="pub-file">
            Open saved experiment
            <input
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  if (f.size > MAX_FINANCE_BYTES) throw new Error('Saved experiment is too large.');
                  const next = parseExperiment(await f.text());
                  setSaved(next);
                  onMode(next.view);
                  setFileError(null);
                  setNotice('Saved experiment opened; all source and model versions match.');
                } catch (err) {
                  setFileError(String(err));
                }
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {notice && (
          <p role="status">
            {notice} <a href={experimentUrl(experiment, currentUrl())}>Reopen this exact experiment</a>
          </p>
        )}
        {fileError && <p role="alert">Import failed: {fileError} The current experiment was not replaced.</p>}
      </section>
      <section className="pub-paths">
        <h2>Follow the question further</h2>
        <div>
          <button onClick={() => onMode(mode === 'compare' ? 'explore' : 'compare')}>
            {mode === 'compare' ? 'Return to Explore' : 'Compare two editable scenarios'}
          </button>
          <button onClick={onHistory}>Check against history</button>
          <a
            className="pub-action"
            target="_blank"
            rel="noopener noreferrer"
            href={experimentUrl(experiment, currentUrl(), 'A', 'policy')}
          >
            Paste a policy
          </a>
          <button onClick={() => onLab('import')}>Import a model</button>
          <a
            className="pub-action"
            target="_blank"
            rel="noopener noreferrer"
            href={experimentUrl(experiment, currentUrl(), 'A', 'author')}
          >
            Add a variable
          </a>
          <a
            className="pub-action"
            target="_blank"
            rel="noopener noreferrer"
            href={experimentUrl(experiment, currentUrl(), 'A', 'uncertainty')}
          >
            Inspect uncertainty
          </a>
          <button onClick={onWorld}>Explore change over time</button>
          <button onClick={onRisk}>AI risk</button>
        </div>
        <p>
          This financial model has no uncertainty ranges; add ranges in a model file to compare uncertainty.
        </p>
        <p>
          Policy, variable and uncertainty tools open exact scenario A in a new tab, keeping this experiment
          and any existing Lab work available. World scenarios use a separate illustrative model with assumed
          corporate inputs. AI risk opens its own model family. Neither inherits this financial allocation
          result.
        </p>
      </section>
    </div>
  );
}

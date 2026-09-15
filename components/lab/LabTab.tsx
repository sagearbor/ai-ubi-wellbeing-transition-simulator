/**
 * LabTab — the Model Lab (v3 stage 2, "authoring core" made visible).
 *
 * One screen, progressive disclosure, and a strict rule: nothing here edits a model file. Picking a
 * fixture, toggling an overlay, editing a parameter, relaxing a constraint and adding a variable all
 * become *overlays* layered on the loaded model, so the base stays reproducible and every change is
 * reversible and inspectable as JSON at the bottom of the page.
 *
 * Order on the page follows the order an honest reading needs:
 *   scope and limits -> assumptions and where they came from -> results -> what limited them ->
 *   what failed -> add your own variable -> the files themselves.
 *
 * Runs go through the model runner (src/workers/client.ts): in the browser a Web Worker, so a large
 * model or 200 Monte Carlo draws never freeze the page; each change supersedes the run in progress,
 * progress and Cancel are on the run bar, and hard limits (src/core/limits.ts) refuse oversized runs
 * with an explicit diagnostic. In tests and SSR the same jobs run synchronously.
 *
 * Models come from the bundled fixtures (curated) or from a file imported here (experimental — not
 * curated, and labelled so everywhere). Time is labelled in the model's own unit: a generation model
 * says "Generation 3", never a calendar year, and outputs it declares steady-state-only get no
 * transition chart.
 *
 * Mount it with no props: <LabTab />. The optional props exist so tests (and a future deep link)
 * can start it somewhere other than the first fixture.
 */

import React, { useMemo, useState } from 'react';
import { FlaskConical, RotateCcw, Square, Timer, Waves } from 'lucide-react';
import { calendarNote, steadyStateOf, timeLabel } from '../../src/core/calendar';
import { isDeterministic, resolveModel } from '../../src/core/engine';
import { CORE_FIXTURES, findFixture } from '../../src/core/fixtures';
import { checkRunSettings, RUN_LIMITS } from '../../src/core/limits';
import type { CoreModel, Overlay, RunResult } from '../../src/core/types';
import { openLabLink, parseLabHash, type OpenedScenario } from '../../src/policy/bundle';
import type { PolicyDraft } from '../../src/policy/types';
import { getDefaultRunner, type Runner } from '../../src/workers/client';
import type { LabPointJob, MonteCarloJob } from '../../src/workers/protocol';
import { Hint } from '../futures/Hint';
import AddVariableForm from './AddVariableForm';
import AssumptionsPanel from './AssumptionsPanel';
import BindingPanel from './BindingPanel';
import DiagnosticsPanel, { TestsPanel } from './DiagnosticsPanel';
import ModelFilePanel from './ModelFilePanel';
import ModelImportPanel from './ModelImportPanel';
import PolicyPanel from './PolicyPanel';
import { splitScenarioOverlays } from './policyState';
import OutputChart from './OutputChart';
import { EXPERIMENTAL_LABEL, curatedMatch, importKey, isImportKey, type ImportedModel, type ModelStatus } from './importState';
import {
  describeOf,
  hypotheticalOverlay,
  makeHypothetical,
  parameterOverlay,
  unitOf,
  type Hypothetical,
} from './labState';
import { useRunnerJob } from './useRunnerJob';

export interface LabTabProps {
  /** Fixture to open on. Defaults to the first entry of CORE_FIXTURES. */
  initialModelId?: string;
  /** Ids of that fixture's overlays to switch on at mount. */
  initialOverlayIds?: string[];
  /** Overlays to start with, as if the "add a variable" form had produced them. */
  initialCustomOverlays?: Overlay[];
  /** Start with the Monte Carlo band on. */
  initialUncertainty?: boolean;
  /**
   * A `#lab=` hash to open. Defaults to window.location.hash in the browser. A link that cannot be
   * opened shows why, and the Lab stays on its default model instead of guessing a baseline.
   */
  initialHash?: string;
  /** Start the Policy panel with these drafts (tests, and the worked example). */
  initialPolicy?: { drafts: PolicyDraft[]; source?: { title?: string; url?: string; text?: string }; runs?: number; seed?: number; run?: boolean };
  /** Models already imported (as if loaded from files); the first is opened unless initialModelId says otherwise. */
  initialImports?: Array<{ model: CoreModel; overlays?: Overlay[] }>;
  /** The runner to use; defaults to a Web Worker in the browser and synchronous execution elsewhere. */
  runner?: Runner;
}

const MC_RUNS = 200;
const MC_SEED = 1;

/** Stable identity for a job object (useMemo keeps the object while its inputs are unchanged). */
const jobIds = new WeakMap<object, string>();
let jobSeq = 0;
function keyOf(job: object | null): string {
  if (!job) return 'none';
  let k = jobIds.get(job);
  if (!k) {
    k = `job-${++jobSeq}`;
    jobIds.set(job, k);
  }
  return k;
}

const LabTab: React.FC<LabTabProps> = ({
  initialModelId,
  initialOverlayIds = [],
  initialCustomOverlays = [],
  initialUncertainty = false,
  initialHash,
  initialPolicy,
  initialImports = [],
  runner: runnerProp,
}) => {
  const runner = useMemo(() => runnerProp ?? getDefaultRunner(), [runnerProp]);

  // A shared link, read once at mount. It decides the starting model and scenario. Its run settings
  // are checked against the limits before anything is run from it.
  const [link] = useState<{ opened: OpenedScenario | null; error: string | null; limits: string | null }>(() => {
    const hash = initialHash ?? (typeof window !== 'undefined' ? window.location.hash : '');
    const decoded = parseLabHash(hash);
    if (!decoded) return { opened: null, error: null, limits: null };
    if (decoded.ok === false) return { opened: null, error: (decoded as { reason: string }).reason, limits: null };
    const opened = openLabLink(decoded.value!, (id): CoreModel | undefined => findFixture(id)?.model);
    if (opened.ok === false) return { opened: null, error: (opened as { reason: string }).reason, limits: null };
    const o = opened.value!;
    const problems = checkRunSettings({ runs: o.runs, seed: o.seed, model: resolveModel(o.model, o.overlays).model });
    return { opened: o, error: null, limits: problems.length ? problems.map((p) => p.message).join('; ') : null };
  });
  const linkSplit = link.opened ? splitScenarioOverlays(findFixture(link.opened.model.id)!, link.opened.overlays) : null;

  const [imports, setImports] = useState<ImportedModel[]>(() =>
    initialImports.map(({ model, overlays = [] }) => ({ key: importKey(model), model, overlays, warnings: [] })),
  );
  const [selection, setSelection] = useState<string>(
    link.opened?.model.id ?? initialModelId ?? (initialImports[0] ? importKey(initialImports[0].model) : CORE_FIXTURES[0]?.model.id ?? ''),
  );
  const [overlayIds, setOverlayIds] = useState<string[]>(linkSplit?.overlayIds ?? initialOverlayIds);
  const [customOverlays, setCustomOverlays] = useState<Overlay[]>(linkSplit?.custom ?? initialCustomOverlays);
  const [importedOverlayIds, setImportedOverlayIds] = useState<string[]>([]);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [hypothetical, setHypothetical] = useState<Hypothetical | null>(null);
  const [uncertainty, setUncertainty] = useState<boolean>(initialUncertainty);
  const [outputChoice, setOutputChoice] = useState<string | null>(null);
  const [stepChoice, setStepChoice] = useState<number | null>(null);
  const [entityChoice, setEntityChoice] = useState<string | null>(null);

  const importedEntry = isImportKey(selection) ? imports.find((i) => i.key === selection) : undefined;
  const fixture = importedEntry ? null : findFixture(selection) ?? CORE_FIXTURES[0];
  const model: CoreModel = importedEntry ? importedEntry.model : fixture!.model;
  const offeredOverlays: Overlay[] = importedEntry ? importedEntry.overlays : fixture!.overlays;
  const status: ModelStatus = importedEntry ? 'imported' : 'curated';
  const experimental = status === 'imported' || importedOverlayIds.some((id) => customOverlays.some((o) => o.id === id));

  // -- overlays -------------------------------------------------------------

  const fixtureOverlays = useMemo(() => offeredOverlays.filter((o) => overlayIds.includes(o.id)), [offeredOverlays, overlayIds]);
  // Resolved without the user's parameter edits, so the assumptions panel can list what exists and
  // the edit overlay can be built only from ids that are actually in force.
  const resolved = useMemo(() => resolveModel(model, [...fixtureOverlays, ...customOverlays]), [model, fixtureOverlays, customOverlays]);
  const resolvedModel = resolved.model;

  const overlays = useMemo(() => {
    const baseValues = new Map<string, number>(resolvedModel.parameters.map((p) => [p.id, p.value]));
    const edit = parameterOverlay(edits, baseValues);
    return [...fixtureOverlays, ...customOverlays, ...(edit ? [edit] : [])];
  }, [fixtureOverlays, customOverlays, edits, resolvedModel]);

  const runOverlays = useMemo(() => (hypothetical ? [...overlays, hypotheticalOverlay(hypothetical)] : overlays), [overlays, hypothetical]);

  // -- runs -----------------------------------------------------------------

  const pointJob = useMemo<LabPointJob>(
    () => ({ kind: 'lab-point', model, overlays, hypotheticalOverlays: hypothetical ? runOverlays : null }),
    [model, overlays, runOverlays, hypothetical],
  );
  const point = useRunnerJob(runner, 'lab-point', pointJob, keyOf(pointJob));
  // A result for another model (the run for a newly picked one is still going) is not shown.
  const pr = point.result && point.result.plain.manifest.modelId === model.id ? point.result : null;

  const deterministic = useMemo(() => isDeterministic(resolveModel(model, runOverlays).model), [model, runOverlays]);
  const mcJob = useMemo<MonteCarloJob | null>(
    () => (uncertainty && !deterministic ? { kind: 'monte-carlo', model, overlays: runOverlays, runs: MC_RUNS, seed: MC_SEED } : null),
    [uncertainty, deterministic, model, runOverlays],
  );
  const mcRun = useRunnerJob(runner, 'lab-mc', mcJob, keyOf(mcJob));
  const mc = mcJob && mcRun.result && !mcRun.stale && mcRun.result.manifest.modelId === model.id ? mcRun.result : null;

  const result: RunResult | null = pr ? pr.hyp ?? pr.plain : null;
  const plainResult = pr?.plain ?? null;
  const baseline = pr?.baseline ?? null;
  const elapsedMs = pr ? (pr.hyp ? pr.hypMs : pr.plainMs) : 0;

  // -- selections -----------------------------------------------------------

  const entities = resolvedModel.entities?.ids?.length ? resolvedModel.entities.ids : ['_'];
  const entity = entityChoice && entities.includes(entityChoice) ? entityChoice : entities[0];
  const outputs = resolvedModel.outputs;
  const selectedOutput = outputChoice && outputs.includes(outputChoice) ? outputChoice : outputs[0];
  const years = result?.years ?? [];
  const step = stepChoice === null ? Math.max(0, years.length - 1) : Math.min(stepChoice, Math.max(0, years.length - 1));
  const steady = steadyStateOf(resolvedModel);
  const steadyIndex = steady ? years.findIndex((y) => Math.abs(y - steady.at) < 1e-9) : -1;
  const note = calendarNote(model.time);

  const changed = overlays.length > 0 || hypothetical !== null;
  const editedIds = useMemo(() => {
    const baseValues = new Map<string, number>(resolvedModel.parameters.map((p) => [p.id, p.value]));
    return new Set(Object.keys(edits).filter((id) => baseValues.has(id) && edits[id] !== baseValues.get(id)));
  }, [edits, resolvedModel]);

  const hypotheticalDelta = useMemo(() => {
    if (!hypothetical || !result?.ok || !plainResult?.ok) return null;
    const a = result.series[entity]?.[selectedOutput]?.[step];
    const b = plainResult.series[entity]?.[selectedOutput]?.[step];
    return Number.isFinite(a) && Number.isFinite(b) ? a - b : null;
  }, [hypothetical, result, plainResult, entity, selectedOutput, step]);

  const paramValues =
    result?.parameters?.[entity] ?? plainResult?.parameters?.[entity] ?? Object.fromEntries(resolvedModel.parameters.map((p) => [p.id, p.value]));

  // -- handlers -------------------------------------------------------------

  const pickModel = (id: string) => {
    setSelection(id);
    setOverlayIds([]);
    setCustomOverlays([]);
    setImportedOverlayIds([]);
    setEdits({});
    setHypothetical(null);
    setOutputChoice(null);
    setStepChoice(null);
    setEntityChoice(null);
  };

  const addImport = (m: CoreModel, withOverlays: Overlay[], warnings: string[]): string => {
    const key = importKey(m);
    setImports((list) => [...list.filter((x) => x.key !== key), { key, model: m, overlays: withOverlays, warnings }]);
    return key;
  };

  /** Open a model with exactly these scenario overlays (from a bundle). */
  const applyScenario = (m: CoreModel, scenario: Overlay[], st: ModelStatus, warnings: string[] = []) => {
    const curated = curatedMatch(m);
    if (st === 'curated' && curated) {
      const split = splitScenarioOverlays(curated, scenario);
      pickModel(curated.model.id);
      setOverlayIds(split.overlayIds);
      setCustomOverlays(split.custom);
      return;
    }
    const key = addImport(m, [], warnings);
    pickModel(key);
    setCustomOverlays(scenario);
  };

  const toggleOverlay = (id: string) => setOverlayIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const chipBase =
    'inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';
  const smallBtn =
    'inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';

  const pointRunning = point.status === 'running';
  const mcRunning = !!mcJob && mcRun.status === 'running';
  const unitWord = model.time?.stepLabel ?? 'step';

  return (
    <div className="mx-auto w-full max-w-6xl overflow-x-hidden p-3 sm:p-4 space-y-4 text-slate-800 dark:text-slate-100">
      {/* 1. What this is, and what the chosen model can and cannot say. */}
      <header className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
          <FlaskConical size={20} className="text-sky-600 dark:text-sky-400" aria-hidden="true" />
          Model Lab
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
          Open a small model, see every assumption it rests on, change one, and watch what the result does — and what stops it
          moving.
        </p>

        {(link.error || link.opened) && (
          <p
            role="status"
            className={`mt-2 rounded-lg px-3 py-2 text-xs ${
              link.error || link.limits
                ? 'border border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
                : 'border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
            }`}
          >
            {link.error
              ? `Cannot open this lab link: ${link.error} The Lab opened on its default model instead; nothing from the link was applied.`
              : link.limits
                ? `Opened a shared policy scenario, but did not run it: ${link.limits}. The model, scenario and drafts are loaded for inspection.`
                : 'Opened a shared policy scenario. The pinned model and scenario are loaded; see the Policy panel below for the drafts and the re-run comparison.'}
          </p>
        )}

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-0.5" htmlFor="lab-fixture">
              Start from
            </label>
            <select
              id="lab-fixture"
              className="h-11 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              value={selection}
              onChange={(e) => pickModel(e.target.value)}
            >
              {CORE_FIXTURES.map((f) => (
                <option key={f.model.id} value={f.model.id}>
                  {f.label}
                </option>
              ))}
              {imports.length > 0 && (
                <optgroup label={`Imported (${EXPERIMENTAL_LABEL})`}>
                  {imports.map((i) => (
                    <option key={i.key} value={i.key}>
                      {`${i.model.name} — ${EXPERIMENTAL_LABEL}`}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          {entities.length > 1 && (
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-0.5" htmlFor="lab-entity">
                {resolvedModel.entities?.kind ?? 'entity'}
              </label>
              <select
                id="lab-entity"
                className="h-11 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm"
                value={entity}
                onChange={(e) => setEntityChoice(e.target.value)}
              >
                {entities.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <ModelImportPanel
          runner={runner}
          currentModel={model}
          onImportModel={(m, withOverlays, warnings) => pickModel(addImport(m, withOverlays, warnings))}
          onImportOverlay={(o) => {
            setCustomOverlays((list) => [...list.filter((x) => x.id !== o.id), o]);
            setImportedOverlayIds((ids) => [...ids.filter((x) => x !== o.id), o.id]);
          }}
          onSelectCurated={pickModel}
        />

        {status === 'imported' && (
          <div role="note" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            <p className="font-semibold">{`Imported model: ${EXPERIMENTAL_LABEL}.`}</p>
            <p className="mt-0.5">
              Loaded from a file on this device and validated, but not reviewed for this app. Its sources, scope and results are the file author's claims.
            </p>
            {importedEntry && importedEntry.warnings.length > 0 && (
              <details className="mt-1">
                <summary className="min-h-11 cursor-pointer py-2 font-medium">{`${importedEntry.warnings.length} validation warning${importedEntry.warnings.length === 1 ? '' : 's'}`}</summary>
                <ul className="list-disc pl-4 space-y-0.5 break-words">
                  {importedEntry.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <div className="mt-3 rounded-lg bg-slate-100 dark:bg-slate-800/60 px-3 py-2">
          <p className="text-xs text-slate-700 dark:text-slate-200">{model.description ?? 'This model carries no description.'}</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-semibold">Scope and limits:</span>{' '}
            {model.scope ?? 'This model declares no scope. Treat every result as illustrative.'}
          </p>
          {note && (
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300" data-testid="lab-calendar-note">
              <span className="font-semibold">Time:</span> {note}
            </p>
          )}
        </div>

        {(offeredOverlays.length > 0 || customOverlays.length > 0) && (
          <div className="mt-3">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Overlays
              <Hint
                label="Overlays"
                text="An overlay adds to a model: new inputs, parameters and effects that attach to existing equations. It never rewrites an equation — that would be a different model, so the engine rejects it."
              />
            </h3>
            <div className="mt-1 flex flex-wrap gap-2">
              {offeredOverlays.map((o) => {
                const on = overlayIds.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleOverlay(o.id)}
                    className={`${chipBase} ${
                      on
                        ? 'border-sky-500 bg-sky-50 text-sky-800 dark:border-sky-600 dark:bg-sky-950/50 dark:text-sky-200'
                        : 'border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                    title={o.description}
                  >
                    <span className="min-w-0 text-left break-words">
                      {o.name ?? o.id}
                      <span className="block text-[11px] font-normal opacity-80">{o.description ?? o.id}</span>
                    </span>
                    <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 text-[11px] font-semibold">overlay</span>
                  </button>
                );
              })}
              {customOverlays.map((o) => {
                const fromFile = importedOverlayIds.includes(o.id);
                return (
                  <span
                    key={o.id}
                    className={`${chipBase} ${
                      fromFile
                        ? 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200'
                        : 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
                    }`}
                  >
                    <span className="min-w-0 text-left break-words">
                      {o.name ?? o.id}
                      <span className="block text-[11px] font-normal opacity-80">{o.description ?? o.id}</span>
                    </span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${fromFile ? 'bg-amber-200 dark:bg-amber-800' : 'bg-emerald-200 dark:bg-emerald-800'}`}>
                      {fromFile ? `imported · ${EXPERIMENTAL_LABEL}` : 'yours'}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* 3. The run bar: it re-runs, in the background, the moment anything above changes. */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
        <span className="inline-flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums text-slate-600 dark:text-slate-300" role="status" aria-live="polite">
          <Timer size={14} aria-hidden="true" />
          {pointRunning && !pr
            ? 'Running the model…'
            : result
              ? `ran in ${elapsedMs.toFixed(1)} ms · ${years.length} ${years.length === 1 ? unitWord : `${unitWord}s`} · hash ${result.manifest.hash}${point.stale || pointRunning ? ' · updating…' : ''}`
              : point.status === 'idle'
                ? 'Not run yet'
                : ''}
          <Hint
            label="run cost"
            text={`The model re-runs in the background on every change; a newer change replaces a run in progress. A run is deterministic: same model, same overlays, same seed, same numbers. Hard limits: ${RUN_LIMITS.maxSteps.toLocaleString('en-US')} steps, ${RUN_LIMITS.maxEntities} entities, ${RUN_LIMITS.maxDraws.toLocaleString('en-US')} draws, ${RUN_LIMITS.maxSolverIterations} solver iterations per solve, ${RUN_LIMITS.maxWallClockMs / 1000} s per run.`}
          />
        </span>
        {pointRunning && (
          <button type="button" className={smallBtn} onClick={point.cancel}>
            <Square size={12} aria-hidden="true" />
            Cancel
          </button>
        )}
        {(point.status === 'cancelled' || point.status === 'limit-exceeded' || point.status === 'error') && (
          <span className="inline-flex flex-wrap items-center gap-2 text-[11px] text-rose-700 dark:text-rose-300">
            {`Model run ${point.status === 'cancelled' ? 'cancelled' : point.status === 'limit-exceeded' ? 'stopped at a limit' : 'failed'}: ${point.message ?? ''}`}
            <button type="button" className={smallBtn} onClick={point.rerun}>
              <RotateCcw size={12} aria-hidden="true" />
              Run again
            </button>
          </span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {mcRunning && (
            <span className="inline-flex items-center gap-2 text-[11px] tabular-nums text-slate-600 dark:text-slate-300" data-testid="lab-mc-progress">
              <progress className="h-2 w-28 accent-sky-600" max={mcRun.progress?.total ?? MC_RUNS} value={mcRun.progress?.done ?? 0} aria-label="uncertainty draws progress" />
              {`${(mcRun.progress?.done ?? 0).toLocaleString('en-US')} / ${(mcRun.progress?.total ?? MC_RUNS).toLocaleString('en-US')} draws`}
              <button type="button" className={smallBtn} onClick={mcRun.cancel}>
                <Square size={12} aria-hidden="true" />
                Cancel
              </button>
            </span>
          )}
          {mcJob && (mcRun.status === 'cancelled' || mcRun.status === 'limit-exceeded' || mcRun.status === 'error') && (
            <span className="inline-flex flex-wrap items-center gap-2 text-[11px] text-rose-700 dark:text-rose-300">
              {`Uncertainty ${mcRun.status === 'cancelled' ? 'cancelled' : mcRun.status === 'limit-exceeded' ? 'stopped at a limit' : 'failed'}: ${mcRun.message ?? ''}`}
              <button type="button" className={smallBtn} onClick={mcRun.rerun}>
                <RotateCcw size={12} aria-hidden="true" />
                Run again
              </button>
            </span>
          )}
          {mc && !mc.ok && <span className="text-[11px] text-rose-700 dark:text-rose-300">{`Uncertainty run failed: ${mc.diagnostics.filter((d) => d.level === 'error').map((d) => `[${d.code}] ${d.message}`).join('; ')}`}</span>}
          <button
            type="button"
            aria-pressed={uncertainty && !deterministic}
            disabled={deterministic}
            title={deterministic ? 'No parameter declares a range, so every draw would be identical: the model runs once.' : undefined}
            onClick={() => setUncertainty((v) => !v)}
            className={`${chipBase} disabled:cursor-not-allowed ${
              uncertainty && !deterministic
                ? 'border-sky-500 bg-sky-50 text-sky-800 dark:border-sky-600 dark:bg-sky-950/50 dark:text-sky-200'
                : 'border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200'
            }`}
          >
            <Waves size={14} aria-hidden="true" />
            {deterministic ? 'Uncertainty' : `Uncertainty ${uncertainty ? 'on' : 'off'}`}
            <span className="font-normal opacity-80">{deterministic ? 'deterministic: uncertainty off' : `${MC_RUNS} runs, seed ${MC_SEED}`}</span>
          </button>
          <Hint
            label="Uncertainty"
            text="Draws every parameter that declares a range, 200 times, in the background, and shades p5–p95. It is a spread from declared ranges only — not a forecast interval. Parameters with no range contribute nothing to it, and a ranged parameter you edited by hand is redrawn from its range for the band. A model with no ranged parameter is deterministic: it is run once, not 200 identical times."
            align="right"
          />
        </div>
      </div>

      {/* 2. Assumptions, before results. */}
      <AssumptionsPanel
        model={resolvedModel}
        values={paramValues}
        edited={editedIds}
        onEdit={(id, value) => setEdits((e) => ({ ...e, [id]: value }))}
        onResetAll={() => {
          setEdits({});
          setHypothetical(null);
        }}
        inputSeries={result?.series?.[entity] ?? {}}
        years={years}
      />

      {/* 4. Results. */}
      {result?.ok ? (
        <section>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
            Results
            {experimental && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-700">
                {EXPERIMENTAL_LABEL}
              </span>
            )}
            <Hint
              label="Results"
              text="One chart per declared output. The dashed line is the model exactly as loaded; the solid line is your version of it. Outputs the model declares steady-state-only show their steady-state values instead of a path."
            />
          </h3>
          {note && <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{note}</p>}
          <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-3">
            {outputs.map((id) => (
              <OutputChart
                key={id}
                id={id}
                time={model.time}
                steadyState={
                  steady?.outputs.has(id) && steadyIndex >= 0
                    ? {
                        reason: steady.reason,
                        index: steadyIndex,
                        entityKind: resolvedModel.entities?.kind,
                        entities: entities.length > 1 ? entities.map((e) => ({ entity: e, value: result.series[e]?.[id]?.[steadyIndex] ?? NaN, selected: e === entity })) : undefined,
                      }
                    : undefined
                }
                unit={unitOf(resolvedModel, id)}
                description={describeOf(resolvedModel, id)}
                years={years}
                current={result.series[entity]?.[id] ?? []}
                baseline={baseline?.ok ? baseline.series[entity]?.[id] : undefined}
                showBaseline={changed && !!baseline?.ok}
                band={mc?.ok && mc.quantiles[entity]?.[id] ? { p5: mc.quantiles[entity][id].p5, p95: mc.quantiles[entity][id].p95 } : undefined}
                markYear={years[step]}
                selected={id === selectedOutput}
                onSelect={setOutputChoice}
              />
            ))}
          </div>
        </section>
      ) : result ? (
        <p className="rounded-xl border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 px-3 py-2 text-xs text-rose-800 dark:text-rose-200">
          This run did not complete, so there is nothing to chart. Every reason is listed under Diagnostics below.
        </p>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
          {pointRunning ? 'Running the model in the background…' : point.message ?? 'No result yet.'}
        </p>
      )}

      {/* 5. What limited it. */}
      {result?.ok && (
        <BindingPanel
          model={resolvedModel}
          result={result}
          entity={entity}
          selectedOutput={selectedOutput}
          step={step}
          onStep={setStepChoice}
          paramValues={paramValues}
          hypothetical={hypothetical}
          hypotheticalDelta={hypotheticalDelta}
          onRelax={(parameter, current) => setHypothetical(makeHypothetical(parameter, current, 0.25))}
          onClearHypothetical={() => setHypothetical(null)}
        />
      )}
      {result?.ok && steady && steadyIndex >= 0 && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {`Steady-state outputs (${[...steady.outputs].join(', ')}) are read at ${timeLabel(model.time, years[steadyIndex])} only.`}
        </p>
      )}

      {/* 6. What failed. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DiagnosticsPanel diagnostics={result?.diagnostics ?? []} />
        <TestsPanel outcomes={pr?.outcomes ?? []} />
      </div>

      {/* 7. Author something of your own. */}
      <AddVariableForm
        key={`${selection}-${overlayIds.join(',')}`}
        model={resolvedModel}
        applied={customOverlays}
        onApply={(o) => setCustomOverlays((list) => [...list.filter((x) => x.id !== o.id), o])}
        onRemove={(id) => setCustomOverlays((list) => list.filter((x) => x.id !== id))}
      />

      {/* 8. Read a policy text against this model: paired run, share, reopen, memo. */}
      <PolicyPanel
        model={model}
        overlays={overlays}
        runner={runner}
        modelStatus={status}
        importWarnings={importedEntry?.warnings}
        extraModels={imports.map((i) => i.model)}
        initialDrafts={link.opened?.drafts ?? initialPolicy?.drafts ?? []}
        initialSource={initialPolicy?.source}
        initialRuns={link.opened?.runs ?? initialPolicy?.runs}
        initialSeed={link.opened?.seed ?? initialPolicy?.seed}
        runOnMount={(!!link.opened && !link.limits) || !!initialPolicy?.run}
        initialNotice={
          link.error
            ? { tone: 'error', text: `Cannot open this lab link: ${link.error}` }
            : link.opened
              ? {
                  tone: link.limits ? 'error' : 'ok',
                  text: `Opened from a shared link: ${link.opened.model.id} (version ${link.opened.drafts[0]?.modelHash}), ${link.opened.drafts.length} draft${link.opened.drafts.length === 1 ? '' : 's'} (${link.opened.drafts.map((d) => d.reviewStatus).join(', ')}), ${link.opened.runs} draws, seed ${link.opened.seed}. The source text is not in links, so quotes are not re-checked here.${link.limits ? ` Not run automatically: ${link.limits}.` : ''}`,
                }
              : null
        }
        onRequestModel={pickModel}
        onOpenScenario={applyScenario}
      />

      {/* 9. The files themselves. */}
      <ModelFilePanel model={model} overlays={runOverlays} status={status} importWarnings={importedEntry?.warnings} />
    </div>
  );
};

export default LabTab;

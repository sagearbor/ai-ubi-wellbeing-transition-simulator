/**
 * LabTab — the Model Lab (v3 stage 2, "authoring core" made visible).
 *
 * One screen, progressive disclosure, and a strict rule: nothing here edits a model file. Picking a
 * fixture, toggling an overlay, editing a parameter, relaxing a constraint and adding a variable all
 * become *overlays* layered on the bundled model, so the base stays reproducible and every change is
 * reversible and inspectable as JSON at the bottom of the page.
 *
 * Order on the page follows the order an honest reading needs:
 *   scope and limits -> assumptions and where they came from -> results -> what limited them ->
 *   what failed -> add your own variable -> the files themselves.
 *
 * Mount it with no props: <LabTab />. The optional props exist so tests (and a future deep link)
 * can start it somewhere other than the first fixture.
 */

import React, { useMemo, useState } from 'react';
import { FlaskConical, Timer, Waves } from 'lucide-react';
import { resolveModel, runModel, runMonteCarlo, runTests } from '../../src/core/engine';
import { CORE_FIXTURES, findFixture } from '../../src/core/fixtures';
import type { Overlay } from '../../src/core/types';
import { Hint } from '../futures/Hint';
import AddVariableForm from './AddVariableForm';
import AssumptionsPanel from './AssumptionsPanel';
import BindingPanel from './BindingPanel';
import DiagnosticsPanel, { TestsPanel } from './DiagnosticsPanel';
import ModelFilePanel from './ModelFilePanel';
import OutputChart from './OutputChart';
import {
  describeOf,
  hypotheticalOverlay,
  makeHypothetical,
  parameterOverlay,
  unitOf,
  type Hypothetical,
} from './labState';

export interface LabTabProps {
  /** Fixture to open on. Defaults to the first entry of CORE_FIXTURES. */
  initialModelId?: string;
  /** Ids of that fixture's overlays to switch on at mount. */
  initialOverlayIds?: string[];
  /** Overlays to start with, as if the "add a variable" form had produced them. */
  initialCustomOverlays?: Overlay[];
  /** Start with the Monte Carlo band on. */
  initialUncertainty?: boolean;
}

const MC_RUNS = 200;
const MC_SEED = 1;

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Run something and report how long it took, so the page can show the cost of a run. */
function timed<T>(fn: () => T): { result: T; elapsedMs: number } {
  const t0 = now();
  const result = fn();
  return { result, elapsedMs: now() - t0 };
}

const LabTab: React.FC<LabTabProps> = ({
  initialModelId,
  initialOverlayIds = [],
  initialCustomOverlays = [],
  initialUncertainty = false,
}) => {
  const [modelId, setModelId] = useState<string>(initialModelId ?? CORE_FIXTURES[0]?.model.id ?? '');
  const [overlayIds, setOverlayIds] = useState<string[]>(initialOverlayIds);
  const [customOverlays, setCustomOverlays] = useState<Overlay[]>(initialCustomOverlays);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [hypothetical, setHypothetical] = useState<Hypothetical | null>(null);
  const [uncertainty, setUncertainty] = useState<boolean>(initialUncertainty);
  const [outputChoice, setOutputChoice] = useState<string | null>(null);
  const [stepChoice, setStepChoice] = useState<number | null>(null);
  const [entityChoice, setEntityChoice] = useState<string | null>(null);

  const fixture = findFixture(modelId) ?? CORE_FIXTURES[0];
  const model = fixture.model;

  // -- overlays -------------------------------------------------------------

  const fixtureOverlays = useMemo(
    () => fixture.overlays.filter((o) => overlayIds.includes(o.id)),
    [fixture, overlayIds],
  );
  // Resolved without the user's parameter edits, so the assumptions panel can list what exists and
  // the edit overlay can be built only from ids that are actually in force.
  const resolved = useMemo(
    () => resolveModel(model, [...fixtureOverlays, ...customOverlays]),
    [model, fixtureOverlays, customOverlays],
  );
  const resolvedModel = resolved.model;

  const overlays = useMemo(() => {
    const baseValues = new Map<string, number>(resolvedModel.parameters.map((p) => [p.id, p.value]));
    const edit = parameterOverlay(edits, baseValues);
    return [...fixtureOverlays, ...customOverlays, ...(edit ? [edit] : [])];
  }, [fixtureOverlays, customOverlays, edits, resolvedModel]);

  const runOverlays = useMemo(
    () => (hypothetical ? [...overlays, hypotheticalOverlay(hypothetical)] : overlays),
    [overlays, hypothetical],
  );

  // -- runs -----------------------------------------------------------------

  const baseline = useMemo(() => runModel(model), [model]);
  // Auto-run: no Run button, because a run of a model this size costs a fraction of a frame.
  const plain = useMemo(() => timed(() => runModel(model, { overlays })), [model, overlays]);
  // With a hypothetical on, the shown run is the bumped one and `plain` stays as the comparison.
  const hyp = useMemo(
    () => (hypothetical ? timed(() => runModel(model, { overlays: runOverlays })) : null),
    [model, runOverlays, hypothetical],
  );

  const mc = useMemo(
    () => (uncertainty ? runMonteCarlo(model, { overlays: runOverlays, runs: MC_RUNS, seed: MC_SEED }) : null),
    [uncertainty, model, runOverlays],
  );
  const outcomes = useMemo(() => runTests(model, { overlays: runOverlays }), [model, runOverlays]);

  const result = hyp ? hyp.result : plain.result;
  const elapsedMs = hyp ? hyp.elapsedMs : plain.elapsedMs;

  // -- selections -----------------------------------------------------------

  const entities = resolvedModel.entities?.ids?.length ? resolvedModel.entities.ids : ['_'];
  const entity = entityChoice && entities.includes(entityChoice) ? entityChoice : entities[0];
  const outputs = resolvedModel.outputs;
  const selectedOutput = outputChoice && outputs.includes(outputChoice) ? outputChoice : outputs[0];
  const years = result.years;
  const step = stepChoice === null ? Math.max(0, years.length - 1) : Math.min(stepChoice, years.length - 1);

  const changed = overlays.length > 0 || hypothetical !== null;
  const editedIds = useMemo(() => {
    const baseValues = new Map<string, number>(resolvedModel.parameters.map((p) => [p.id, p.value]));
    return new Set(Object.keys(edits).filter((id) => baseValues.has(id) && edits[id] !== baseValues.get(id)));
  }, [edits, resolvedModel]);

  const hypotheticalDelta = useMemo(() => {
    if (!hypothetical || !result.ok || !plain.result.ok) return null;
    const a = result.series[entity]?.[selectedOutput]?.[step];
    const b = plain.result.series[entity]?.[selectedOutput]?.[step];
    return Number.isFinite(a) && Number.isFinite(b) ? a - b : null;
  }, [hypothetical, result, plain, entity, selectedOutput, step]);

  const paramValues =
    result.parameters?.[entity] ??
    plain.result.parameters?.[entity] ??
    Object.fromEntries(resolvedModel.parameters.map((p) => [p.id, p.value]));

  // -- handlers -------------------------------------------------------------

  const pickModel = (id: string) => {
    setModelId(id);
    setOverlayIds([]);
    setCustomOverlays([]);
    setEdits({});
    setHypothetical(null);
    setOutputChoice(null);
    setStepChoice(null);
    setEntityChoice(null);
  };

  const toggleOverlay = (id: string) =>
    setOverlayIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const chipBase =
    'inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';

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

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-0.5" htmlFor="lab-fixture">
              Start from
            </label>
            <select
              id="lab-fixture"
              className="h-11 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              value={modelId}
              onChange={(e) => pickModel(e.target.value)}
            >
              {CORE_FIXTURES.map((f) => (
                <option key={f.model.id} value={f.model.id}>
                  {f.label}
                </option>
              ))}
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

        <div className="mt-3 rounded-lg bg-slate-100 dark:bg-slate-800/60 px-3 py-2">
          <p className="text-xs text-slate-700 dark:text-slate-200">{model.description ?? 'This model carries no description.'}</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-semibold">Scope and limits:</span>{' '}
            {model.scope ?? 'This model declares no scope. Treat every result as illustrative.'}
          </p>
        </div>

        {(fixture.overlays.length > 0 || customOverlays.length > 0) && (
          <div className="mt-3">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Overlays
              <Hint
                label="Overlays"
                text="An overlay adds to a model: new inputs, parameters and effects that attach to existing equations. It never rewrites an equation — that would be a different model, so the engine rejects it."
              />
            </h3>
            <div className="mt-1 flex flex-wrap gap-2">
              {fixture.overlays.map((o) => {
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
              {customOverlays.map((o) => (
                <span key={o.id} className={`${chipBase} border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200`}>
                  <span className="min-w-0 text-left break-words">
                    {o.name ?? o.id}
                    <span className="block text-[11px] font-normal opacity-80">{o.description ?? o.id}</span>
                  </span>
                  <span className="rounded-full bg-emerald-200 dark:bg-emerald-800 px-1.5 py-0.5 text-[11px] font-semibold">yours</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* 3. The run bar: it re-ran the moment anything above changed. */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] tabular-nums text-slate-600 dark:text-slate-300">
          <Timer size={14} aria-hidden="true" />
          ran in {elapsedMs.toFixed(1)} ms · {years.length} steps · hash {result.manifest.hash}
          <Hint
            label="run cost"
            text="The whole model re-runs on every change — that is why there is no Run button. A run is deterministic: same model, same overlays, same seed, same numbers."
          />
        </span>
        <button
          type="button"
          aria-pressed={uncertainty}
          onClick={() => setUncertainty((v) => !v)}
          className={`${chipBase} ml-auto ${
            uncertainty
              ? 'border-sky-500 bg-sky-50 text-sky-800 dark:border-sky-600 dark:bg-sky-950/50 dark:text-sky-200'
              : 'border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200'
          }`}
        >
          <Waves size={14} aria-hidden="true" />
          {`Uncertainty ${uncertainty ? 'on' : 'off'}`}
          <span className="font-normal opacity-80">{`${MC_RUNS} runs, seed ${MC_SEED}`}</span>
        </button>
        <Hint
          label="Uncertainty"
          text="Draws every parameter that declares a range, 200 times, and shades p5–p95. It is a spread from declared ranges only — not a forecast interval. Parameters with no range contribute nothing to it, and a ranged parameter you edited by hand is redrawn from its range for the band."
          align="right"
        />
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
        inputSeries={result.series?.[entity] ?? {}}
        years={years}
      />

      {/* 4. Results. */}
      {result.ok ? (
        <section>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
            Results
            <Hint
              label="Results"
              text="One chart per declared output. The dashed line is the model exactly as bundled; the solid line is your version of it."
            />
          </h3>
          <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-3">
            {outputs.map((id) => (
              <OutputChart
                key={id}
                id={id}
                unit={unitOf(resolvedModel, id)}
                description={describeOf(resolvedModel, id)}
                years={years}
                current={result.series[entity]?.[id] ?? []}
                baseline={baseline.ok ? baseline.series[entity]?.[id] : undefined}
                showBaseline={changed && baseline.ok}
                band={
                  mc?.ok && mc.quantiles[entity]?.[id]
                    ? { p5: mc.quantiles[entity][id].p5, p95: mc.quantiles[entity][id].p95 }
                    : undefined
                }
                markYear={years[step]}
                selected={id === selectedOutput}
                onSelect={setOutputChoice}
              />
            ))}
          </div>
        </section>
      ) : (
        <p className="rounded-xl border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 px-3 py-2 text-xs text-rose-800 dark:text-rose-200">
          This run did not complete, so there is nothing to chart. Every reason is listed under Diagnostics below.
        </p>
      )}

      {/* 5. What limited it. */}
      {result.ok && (
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

      {/* 6. What failed. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DiagnosticsPanel diagnostics={result.diagnostics} />
        <TestsPanel outcomes={outcomes} />
      </div>

      {/* 7. Author something of your own. */}
      <AddVariableForm
        key={`${model.id}-${overlayIds.join(',')}`}
        model={resolvedModel}
        applied={customOverlays}
        onApply={(o) => setCustomOverlays((list) => [...list.filter((x) => x.id !== o.id), o])}
        onRemove={(id) => setCustomOverlays((list) => list.filter((x) => x.id !== id))}
      />

      {/* 8. The files themselves. */}
      <ModelFilePanel model={model} overlays={runOverlays} />
    </div>
  );
};

export default LabTab;

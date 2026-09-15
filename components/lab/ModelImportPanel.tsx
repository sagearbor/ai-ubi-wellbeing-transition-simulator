/**
 * ModelImportPanel — load a local core model, an exported model + overlays, or an overlay.
 *
 * Paste JSON or choose a file; it is validated with validateCoreModel / validateOverlay through the
 * model runner (off the main thread in the browser) and, if it validates, runs in the Lab like a
 * bundled model — labelled "experimental — not curated" wherever it appears. Validation errors are
 * listed, with fields the format does not support called out as unsupported capabilities.
 */

import type { ScenarioProvenance } from '../../src/policy/provenance';
import React, { useRef, useState } from 'react';
import { ChevronRight, FileUp } from 'lucide-react';
import type { CoreModel, Overlay } from '../../src/core/types';
import type { OverlayValidationResult, ValidationResult } from '../../src/core/validate';
import type { Runner } from '../../src/workers/client';
import type { RunOutcome } from '../../src/workers/protocol';
import { Hint } from '../futures/Hint';
import { EXPERIMENTAL_LABEL, classifyImport, curatedMatch, explainValidationErrors, parseImportText } from './importState';

export interface ModelImportPanelProps {
  runner: Runner;
  /** The model an imported overlay is applied to. */
  currentModel: CoreModel;
  onImportModel: (model: CoreModel, overlays: Overlay[], warnings: string[], provenance?: ScenarioProvenance) => void;
  onImportOverlay: (overlay: Overlay, warnings: string[]) => void;
  /** The file is an exact copy of a bundled model: open that instead. */
  onSelectCurated: (id: string) => void;
}

const btn =
  'inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50';

async function validated<T extends ValidationResult>(p: Promise<RunOutcome<T>>): Promise<{ ok: boolean; value?: T; errors: string[] }> {
  const o = await p;
  if (o.status !== 'done') return { ok: false, errors: [`validation did not complete (${o.status}): ${(o as { message: string }).message}`] };
  return { ok: true, value: (o as { result: T }).result, errors: [] };
}

const ModelImportPanel: React.FC<ModelImportPanelProps> = ({ runner, currentModel, onImportModel, onImportOverlay, onSelectCurated }) => {
  const [text, setText] = useState('');
  const [sourceImport, setSourceImport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (source: string) => {
    setErrors([]);
    setNotice(null);
    const parsed = parseImportText(source);
    if (parsed.ok === false) {
      setErrors([(parsed as { reason: string }).reason]);
      return;
    }
    const c = classifyImport(parsed.json);
    if (c.kind === 'unknown') {
      setErrors([c.reason]);
      return;
    }
    if (c.kind === 'policy-bundle') {
      setErrors(['This is a policy bundle, not a model file. Open it with "Open a bundle" in the Policy panel below; a bundle that carries its model opens that model too.']);
      return;
    }
    if (c.kind === 'incompatible-package' && !sourceImport) {
      setErrors([`This package cannot replay: ${c.reason}. Choose explicit source import below to start a NEW experimental run.`]); return;
    }
    setBusy(true);
    try {
      if (c.kind === 'overlay') {
        const v = await validated<OverlayValidationResult>(runner.run('import', { kind: 'validate-overlay', base: currentModel, json: c.overlay }).promise);
        if (!v.ok) return setErrors(v.errors);
        if (!v.value.ok || !v.value.overlay) return setErrors(explainValidationErrors(v.value.errors));
        onImportOverlay(v.value.overlay, v.value.warnings);
        setNotice(`Overlay "${v.value.overlay.id}" validated against ${currentModel.id} and switched on (${EXPERIMENTAL_LABEL}).`);
        setText('');
        return;
      }
      const vm = await validated<ValidationResult>(runner.run('import', { kind: 'validate-model', json: c.model }).promise);
      if (!vm.ok) return setErrors(vm.errors);
      if (!vm.value.ok || !vm.value.model) return setErrors(explainValidationErrors(vm.value.errors));
      const model = vm.value.model;
      const overlays: Overlay[] = [];
      const warnings = [...vm.value.warnings, ...('warnings' in c ? c.warnings ?? [] : []), ...(c.kind === 'incompatible-package' ? [`NEW experimental source import; not replay: ${c.reason}`] : [])];
      if (c.kind === 'package' || c.kind === 'incompatible-package') {
        const problems: string[] = [];
        for (const [i, o] of c.overlays.entries()) {
          const vo = await validated<OverlayValidationResult>(runner.run('import', { kind: 'validate-overlay', base: model, json: o }).promise);
          if (!vo.ok) problems.push(...vo.errors);
          else if (!vo.value.ok || !vo.value.overlay) problems.push(...explainValidationErrors(vo.value.errors).map((e) => `overlay ${i + 1}: ${e}`));
          else {
            overlays.push(vo.value.overlay);
            warnings.push(...vo.value.warnings.map((w) => `overlay ${vo.value.overlay!.id}: ${w}`));
          }
        }
        if (problems.length) return setErrors(problems);
      }
      const provenance: ScenarioProvenance | undefined = c.kind === 'incompatible-package' ? {kind: 'source-import', reason: c.reason} : c.kind === 'package' ? c.provenance : undefined;
      const curated = curatedMatch(model);
      if (curated && overlays.length === 0 && c.kind !== 'incompatible-package' && (!provenance || provenance.kind === 'fixture')) {
        onSelectCurated(curated.model.id);
        setNotice(`This file is the bundled model "${curated.model.id}" exactly (same version), so the curated copy is open.`);
      } else {
        onImportModel(model, overlays, warnings, provenance);
        setNotice(`Loaded "${model.name}" (${EXPERIMENTAL_LABEL})${overlays.length ? ` with ${overlays.length} overlay${overlays.length === 1 ? '' : 's'}` : ''}. ${warnings.length} validation warning${warnings.length === 1 ? '' : 's'}.`);
      }
      setText('');
    } finally {
      setBusy(false);
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) { setErrors(['The file exceeds the 5 MB import limit.']); e.target.value = ''; return; }
    file.text().then(
      (t) => {
        setText(t);
        void load(t);
      },
      (err: Error) => setErrors([`Could not read the file: ${err.message}`]),
    );
    e.target.value = '';
  };

  return (
    <details className="group mt-2 rounded-lg border border-slate-200 dark:border-slate-800 px-2">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
        <ChevronRight size={14} className="transition-transform group-open:rotate-90" aria-hidden="true" />
        Import a model or overlay (JSON)
        <Hint
          label="Import"
          text="Load a core model file (docs/core-authoring.md), a model exported from this Lab, or an overlay for the model above. It is validated first and runs on this device only. Imported models are experimental — not curated: nobody has reviewed them for this app."
        />
      </summary>
      <div className="space-y-2 pb-2">
        <textarea
          aria-label="Model or overlay JSON"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='{"schemaVersion": 1, "id": "my-model", "time": {...}, ...}'
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2 font-mono text-[11px] text-slate-800 dark:text-slate-100"
        />
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={sourceImport} onChange={(e) => setSourceImport(e.target.checked)} />Import incompatible package as source for a NEW experimental run (not replay)</label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={`${btn} border-sky-600 bg-sky-600 text-white hover:bg-sky-700`} disabled={busy || !text.trim()} onClick={() => void load(text)}>
            {busy ? 'Validating…' : 'Validate and load'}
          </button>
          <button type="button" className={`${btn} border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200`} disabled={busy} onClick={() => fileRef.current?.click()}>
            <FileUp size={14} aria-hidden="true" />
            Choose a file
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} aria-label="Import a model file" />
        </div>
        {notice && <p role="status" className="text-[11px] text-emerald-700 dark:text-emerald-300">{notice}</p>}
        {errors.length > 0 && (
          <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 px-3 py-2 text-[11px] text-rose-800 dark:text-rose-200">
            <p className="font-semibold">Not loaded: {errors.length} problem{errors.length === 1 ? '' : 's'}.</p>
            <ul className="mt-1 list-disc pl-4 space-y-0.5 break-words">
              {errors.slice(0, 30).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            {errors.length > 30 && <p className="mt-1">…and {errors.length - 30} more.</p>}
          </div>
        )}
      </div>
    </details>
  );
};

export default ModelImportPanel;

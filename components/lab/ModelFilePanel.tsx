/**
 * ModelFilePanel — "Advanced: model file".
 *
 * The lab's whole claim is that a model is data, so the data is on the page: the base model exactly
 * as it is loaded, and every overlay this session has built, as JSON. Read-only, with copy buttons
 * and an export of model + overlays that "Import a model" (top of the Lab) loads again — as an
 * experimental, not curated, model. Becoming a curated fixture is a separate, reviewed step.
 */

import type { ScenarioProvenance } from '../../src/policy/provenance';
import React, { useState } from 'react';
import { ChevronRight, Copy, Download } from 'lucide-react';
import type { CoreModel, Overlay } from '../../src/core/types';
import { Hint } from '../futures/Hint';
import { EXPERIMENTAL_LABEL, buildModelExport, exportFileName, type ModelStatus } from './importState';

export interface ModelFilePanelProps {
  model: CoreModel;
  overlays: Overlay[];
  status?: ModelStatus;
  importWarnings?: string[];
  provenance?: ScenarioProvenance;
}

function download(filename: string, text: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const JsonBlock: React.FC<{ title: string; note?: string; value: unknown; rows: number }> = ({ title, note, value, rows }) => {
  const text = JSON.stringify(value, null, 2);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    if (!clip) return;
    clip.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => setCopied(false),
    );
  };
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 break-all">{title}</span>
      <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <Copy size={13} aria-hidden="true" />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {note && <p className="text-[11px] text-slate-500 dark:text-slate-400">{note}</p>}
      <textarea
        readOnly
        aria-label={title}
        rows={rows}
        value={text}
        className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 font-mono text-[11px] leading-snug text-slate-700 dark:text-slate-200"
      />
    </div>
  );
};

const ModelFilePanel: React.FC<ModelFilePanelProps> = ({ model, overlays, status = 'curated', importWarnings = [], provenance }) => {
  const [error, setError] = React.useState<string | null>(null);
  return (
  <details className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4">
    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-white">
      <ChevronRight size={16} className="transition-transform group-open:rotate-90" aria-hidden="true" />
      Advanced: model file

    </summary>
      <Hint
        label="Model file"
        text="The model and your overlays as data. Export them as one JSON file and load it again with Import (top of the Lab) — it then runs as experimental, not curated. Making it a bundled option still needs a code change: registering the file in src/core/fixtures.ts after its own tests pass under npm run validate:core, and review."
      />
    {error && <p role="alert">{error}</p>}
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => { try { download(exportFileName(model), JSON.stringify(buildModelExport(model, overlays, status as ModelStatus, undefined, importWarnings, provenance), null, 2)); setError(null); } catch (e) { setError((e as Error).message); } }}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        <Download size={13} aria-hidden="true" />
        Export model + overlays (JSON)
      </button>
      <span className="text-[11px] text-slate-500 dark:text-slate-400">
        {provenance && provenance.kind !== 'fixture' ? 'Exports preserve experimental scenario provenance independently of the base model.' : status === 'imported' ? `Exports carry the status "${EXPERIMENTAL_LABEL}".` : 'Re-importing an unchanged bundled model opens the curated copy; any change makes it experimental.'}
      </span>
    </div>
    <JsonBlock
      title={`${model.id} — ${status === 'imported' ? `imported model (${EXPERIMENTAL_LABEL})` : 'base model'} (unchanged by anything above)`}
      value={model}
      rows={14}
    />
    {overlays.length === 0 ? (
      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">No overlays active. Toggle one, edit a value, or add a variable.</p>
    ) : (
      overlays.map((o) => (
        <JsonBlock key={o.id} title={`${o.id} — overlay`} note={o.description} value={o} rows={12} />
      ))
    )}
  </details>
);
};

export default ModelFilePanel;

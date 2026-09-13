/**
 * ModelFilePanel — "Advanced: model file".
 *
 * The lab's whole claim is that a model is data, so the data is on the page: the base model exactly
 * as it is bundled, and every overlay this session has built, as the JSON you could save next to it
 * under data/core/ and load again. Read-only, with a copy button; editing happens through the form.
 */

import React, { useState } from 'react';
import { ChevronRight, Copy } from 'lucide-react';
import type { CoreModel, Overlay } from '../../src/core/types';
import { Hint } from '../futures/Hint';

export interface ModelFilePanelProps {
  model: CoreModel;
  overlays: Overlay[];
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

const ModelFilePanel: React.FC<ModelFilePanelProps> = ({ model, overlays }) => (
  <details className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4">
    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-white">
      <ChevronRight size={16} className="transition-transform group-open:rotate-90" aria-hidden="true" />
      Advanced: model file
      <Hint
        label="Model file"
        text="The model and your overlays as data. Saving an overlay's JSON under data/core/overlays/ and registering it makes it a permanent option — no app code changes."
      />
    </summary>
    <JsonBlock
      title={`${model.id} — base model (unchanged by anything above)`}
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

export default ModelFilePanel;

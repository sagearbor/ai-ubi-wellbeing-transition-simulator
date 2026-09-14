/**
 * ProvisionEditor — one provision of a policy draft: the quote, what it does, its status and role,
 * and (when mapped) exactly what it sets in the model and on what evidence.
 *
 * Collapsed, it is one line: status chip, role, id, the start of the quote. Everything a reviewer
 * edits is inside. Nothing here runs the model; the panel does that on request.
 */

import React, { useState } from 'react';
import { ChevronRight, Trash2 } from 'lucide-react';
import type { CoreModel, EvidenceKind, Overlay } from '../../src/core/types';
import { normaliseWhitespace } from '../../src/policy/draft';
import {
  PROVISION_ROLES,
  PROVISION_STATUSES,
  type DraftDiagnostic,
  type Provision,
  type ProvisionMapping,
  type ProvisionStatus,
} from '../../src/policy/types';
import { Hint } from '../futures/Hint';
import { ALL_KINDS, sourceStyle } from './labState';
import { STATUS_STYLE, curveToText, parseCurveText, targetOptions } from './policyState';

export interface ProvisionEditorProps {
  provision: Provision;
  index: number;
  model: CoreModel;
  overlays: Overlay[];
  diagnostics: DraftDiagnostic[];
  /** Ids of the draft's other provisions (for stacksOn and interprets). */
  otherIds?: string[];
  onPatch: (patch: Partial<Provision>) => void;
  onStatus: (status: ProvisionStatus) => void;
  onMapping: (patch: Partial<ProvisionMapping>) => void;
  onRemove: () => void;
}

const field =
  'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';
const label = 'block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-0.5';

const ROLE_HINT =
  'control: something the text sets (a rate, an eligibility rule, a date). funding: a budget or cap. constraint: a limit the text imposes. coefficient: how the world responds — the text can never supply its size. definition: decides how other provisions read (link them under "interprets").';
const UNIT_HINT =
  'The unit the value is written in. It is converted to the target\'s unit — "20 million usd" becomes 20,000,000 for a target in usd; "percent" becomes a share — or the draft cannot run ("20 people" into usd is an error). Required when the target has a unit.';
const STATUS_HINT =
  'mapped: sets something the model already has. unresolved: could matter but has no honest mapping (no number, or a missing response coefficient). outside-model: the model has no mechanism for it.';

export const EvidenceChip: React.FC<{ kind?: EvidenceKind; label?: string }> = ({ kind, label: text }) => {
  const style = sourceStyle({ label: text ?? '', kind });
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${style.chip}`}>
        {style.label}
        {style.assumption ? ' · assumption' : ''}
      </span>
      <Hint label={style.label} text={`${style.meaning}${text ? ` Source given: ${text}.` : ''}`} align="right" />
    </span>
  );
};

const CurveField: React.FC<{ id: string; curve?: Record<string, number>; time: CoreModel['time']; onCurve: (c: Record<string, number> | undefined) => void }> = ({ id, curve, time, onCurve }) => {
  const unit = time?.stepLabel ?? 'year';
  const [text, setText] = useState(curveToText(curve));
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <label className={label} htmlFor={id}>
        {`or a curve (${unit}: value, …)`}
      </label>
      <input
        id={id}
        className={`${field} h-11 font-mono`}
        value={text}
        placeholder={time?.stepLabel ? `${time.start}: 0, ${time.end}: 1` : '2026: 0, 2027: 12000000'}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (!text.trim()) {
            setError(null);
            onCurve(undefined);
            return;
          }
          const parsed = parseCurveText(text, { calendar: !time?.stepLabel });
          setError(parsed.error);
          if (parsed.curve) onCurve(parsed.curve);
        }}
      />
      {error && <p className="text-[11px] text-rose-700 dark:text-rose-300">{error}</p>}
    </div>
  );
};

const ProvisionEditor: React.FC<ProvisionEditorProps> = ({ provision: p, index, model, overlays, diagnostics, otherIds = [], onPatch, onStatus, onMapping, onRemove }) => {
  const idBase = `policy-prov-${index}`;
  const m = p.mapping;
  const errors = diagnostics.filter((d) => d.level === 'error').length;
  const warnings = diagnostics.filter((d) => d.level === 'warning').length;
  const quote = normaliseWhitespace(p.quote);
  const statusStyle = STATUS_STYLE[p.status] ?? STATUS_STYLE.unresolved;
  const targets = m ? targetOptions(model, overlays, m.kind) : [];

  return (
    <details className="group rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-2 py-1.5">
        <ChevronRight size={14} className="shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" />
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${statusStyle}`}>{p.status || 'no status'}</span>
        {p.role && <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">{p.role}</span>}
        <span className="min-w-0 flex-1 truncate text-xs text-slate-700 dark:text-slate-200">
          <span className="font-mono">{p.id}</span> — “{quote.slice(0, 90)}
          {quote.length > 90 ? '…' : ''}”
        </span>
        {(errors > 0 || warnings > 0) && (
          <span className={`shrink-0 text-[11px] font-semibold ${errors ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'}`}>
            {errors ? `${errors} error${errors === 1 ? '' : 's'}` : `${warnings} warning${warnings === 1 ? '' : 's'}`}
          </span>
        )}
      </summary>

      <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 p-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className={label} htmlFor={`${idBase}-id`}>
              id
            </label>
            <input id={`${idBase}-id`} className={`${field} h-11 font-mono`} value={p.id} onChange={(e) => onPatch({ id: e.target.value.replace(/\s+/g, '-') })} />
          </div>
          <div>
            <label className={label} htmlFor={`${idBase}-status`}>
              status
              <Hint label="status" text={STATUS_HINT} />
            </label>
            <select id={`${idBase}-status`} className={`${field} h-11`} value={p.status} onChange={(e) => onStatus(e.target.value as ProvisionStatus)}>
              {PROVISION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor={`${idBase}-role`}>
              role
              <Hint label="role" text={ROLE_HINT} align="right" />
            </label>
            <select id={`${idBase}-role`} className={`${field} h-11`} value={p.role ?? ''} onChange={(e) => onPatch({ role: (e.target.value || undefined) as Provision['role'] })}>
              <option value="">(none)</option>
              {PROVISION_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={label} htmlFor={`${idBase}-quote`}>
            quote (verbatim from the source)
          </label>
          <textarea id={`${idBase}-quote`} rows={3} className={`${field} py-1.5 font-serif`} value={p.quote} onChange={(e) => onPatch({ quote: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className={label} htmlFor={`${idBase}-summary`}>
              what it does
            </label>
            <textarea id={`${idBase}-summary`} rows={2} className={`${field} py-1.5`} value={p.summary} onChange={(e) => onPatch({ summary: e.target.value })} />
          </div>
          <div>
            <label className={label} htmlFor={`${idBase}-reason`}>
              {p.status === 'mapped' ? 'why this mapping' : 'why it is not mapped (required)'}
            </label>
            <textarea id={`${idBase}-reason`} rows={2} className={`${field} py-1.5`} value={p.reason ?? ''} onChange={(e) => onPatch({ reason: e.target.value })} />
          </div>
        </div>

        {p.role === 'definition' && (
          <div>
            <label className={label} htmlFor={`${idBase}-interprets`}>
              interprets (ids of the provisions this definition decides, comma-separated)
            </label>
            <input
              id={`${idBase}-interprets`}
              className={`${field} h-11 font-mono`}
              value={(p.interprets ?? []).join(', ')}
              placeholder={otherIds.slice(0, 2).join(', ')}
              onChange={(e) => {
                const ids = e.target.value.split(/[,\s]+/).filter(Boolean);
                onPatch({ interprets: ids.length ? ids : undefined });
              }}
            />
          </div>
        )}

        {p.status === 'mapped' && m && (
          <fieldset className="rounded-lg border border-sky-200 dark:border-sky-900 bg-sky-50/50 dark:bg-sky-950/20 p-2 space-y-2">
            <legend className="px-1 text-[11px] font-semibold text-sky-800 dark:text-sky-200">
              What it sets in the model
              <Hint
                label="mapping"
                text="A mapping only adds to the model: it sets a parameter, sets or adds to an input curve, or attaches an effect to a variable. It never rewrites an equation — that would be a different model."
              />
            </legend>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className={label} htmlFor={`${idBase}-kind`}>
                  kind
                </label>
                <select id={`${idBase}-kind`} className={`${field} h-11`} value={m.kind} onChange={(e) => onMapping({ kind: e.target.value as ProvisionMapping['kind'] })}>
                  <option value="parameter">parameter</option>
                  <option value="input">input</option>
                  <option value="effect">effect</option>
                </select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={label} htmlFor={`${idBase}-target`}>
                  target
                </label>
                <select id={`${idBase}-target`} className={`${field} h-11 font-mono`} value={m.target} onChange={(e) => onMapping({ target: e.target.value })}>
                  {!targets.some((t) => t.id === m.target) && <option value={m.target}>{m.target || '(choose)'} — not in this model</option>}
                  {targets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label} htmlFor={`${idBase}-op`}>
                  op
                </label>
                <select id={`${idBase}-op`} className={`${field} h-11`} value={m.op} onChange={(e) => onMapping({ op: e.target.value as ProvisionMapping['op'] })}>
                  {(m.kind === 'parameter' ? ['set'] : m.kind === 'input' ? ['set', 'add'] : ['add', 'multiply']).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label} htmlFor={`${idBase}-unit`}>
                  unit
                  <Hint label="unit" text={UNIT_HINT} align="right" />
                </label>
                <input id={`${idBase}-unit`} className={`${field} h-11`} value={m.unit ?? ''} onChange={(e) => onMapping({ unit: e.target.value || undefined })} />
              </div>
            </div>
            {m.kind === 'effect' ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className={label} htmlFor={`${idBase}-expr`}>
                    expression (a response: its size is a coefficient)
                  </label>
                  <input id={`${idBase}-expr`} className={`${field} h-11 font-mono`} value={m.expr ?? ''} onChange={(e) => onMapping({ expr: e.target.value })} />
                </div>
                <div>
                  <label className={label} htmlFor={`${idBase}-from`}>
                    {`from ${model.time?.stepLabel ?? 'year'} (optional)`}
                  </label>
                  <input
                    id={`${idBase}-from`}
                    type="number"
                    className={`${field} h-11`}
                    value={m.from ?? ''}
                    onChange={(e) => onMapping({ from: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className={label} htmlFor={`${idBase}-value`}>
                    {m.op === 'add' ? 'amount added at every point of the curve' : 'value'}
                  </label>
                  <input
                    id={`${idBase}-value`}
                    type="number"
                    step="any"
                    className={`${field} h-11 tabular-nums`}
                    value={m.value ?? ''}
                    onChange={(e) => onMapping({ value: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </div>
                {m.kind === 'input' && m.op === 'set' && <CurveField id={`${idBase}-curve`} curve={m.curve} time={model.time} onCurve={(curve) => onMapping({ curve })} />}
                {m.kind === 'input' && m.op === 'add' && (
                  <div>
                    <label className={label} htmlFor={`${idBase}-stacks`}>
                      on top of a provision that sets it (required if one does)
                    </label>
                    <select
                      id={`${idBase}-stacks`}
                      className={`${field} h-11 font-mono`}
                      value={m.stacksOn ?? ''}
                      onChange={(e) => onMapping({ stacksOn: e.target.value || undefined })}
                    >
                      <option value="">(the scenario's own curve)</option>
                      {otherIds.map((id) => (
                        <option key={id} value={id}>
                          {id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <label className={label} htmlFor={`${idBase}-ev-label`}>
                  evidence: where the number comes from, and what choice the mapping makes
                </label>
                <input
                  id={`${idBase}-ev-label`}
                  className={`${field} h-11`}
                  value={m.evidence?.label ?? ''}
                  onChange={(e) => onMapping({ evidence: { ...m.evidence, label: e.target.value } })}
                />
              </div>
              <div>
                <label className={label} htmlFor={`${idBase}-ev-kind`}>
                  evidence kind
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id={`${idBase}-ev-kind`}
                    className={`${field} h-11`}
                    value={m.evidence?.kind ?? 'assumed'}
                    onChange={(e) => onMapping({ evidence: { ...m.evidence, kind: e.target.value as EvidenceKind } })}
                  >
                    {ALL_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                  <EvidenceChip kind={m.evidence?.kind} label={m.evidence?.label} />
                </div>
              </div>
            </div>
            {m.evidence?.note && <p className="text-[11px] text-slate-600 dark:text-slate-300">{m.evidence.note}</p>}
          </fieldset>
        )}

        {diagnostics.length > 0 && (
          <ul className="space-y-0.5">
            {diagnostics.map((d, i) => (
              <li
                key={i}
                className={`text-[11px] ${d.level === 'error' ? 'text-rose-700 dark:text-rose-300' : d.level === 'warning' ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}
              >
                <span className="font-semibold">{d.level}</span> <span className="font-mono">{d.code}</span>: {d.message}
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onRemove}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 text-xs text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/30"
        >
          <Trash2 size={13} aria-hidden="true" />
          Remove provision
        </button>
      </div>
    </details>
  );
};

export default ProvisionEditor;

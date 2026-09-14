/**
 * PolicyPanel — "read a policy text against this model" (v3 stage 5).
 *
 * Paste a text (or load the worked example), list its provisions — by AI extraction when a key is
 * configured, or by hand — review each one's status, role, mapping and evidence, then run policy
 * against baseline on the same model, scenario overlays and draws. Two drafts can sit side by side
 * on that baseline. The result can be shared as a link, downloaded as a bundle that reopens and
 * checks it reproduces, and written up as a decision memo.
 *
 * The baseline is the Lab's current scenario: the model, the overlays toggled above, and any value
 * edits or added variables. The "try relaxing it" hypothetical is not part of it.
 */

import React, { useMemo, useRef, useState } from 'react';
import { Copy, Download, FileText, Link2, Play, Plus, ScrollText, Sparkles, Upload } from 'lucide-react';
import { resolveModel } from '../../src/core/engine';
import { CORE_FIXTURES, findFixture } from '../../src/core/fixtures';
import type { CoreModel, Overlay } from '../../src/core/types';
import {
  MAX_LINK_PAYLOAD_CHARS,
  buildBundle,
  buildLabShareUrl,
  bundleFileName,
  encodeLabLink,
  parseBundleJson,
  reopenBundle,
  type ReopenReport,
} from '../../src/policy/bundle';
import { DEFAULT_RUNS, DEFAULT_SEED, blankDraft, coverage, pairedRun, validateDraft } from '../../src/policy/draft';
import { POLICY_EXAMPLES, findPolicyExample } from '../../src/policy/examples';
import { memoFileName, renderMemo } from '../../src/policy/memo';
import { REVIEW_STATUSES, type PairedRunResult, type PolicyDraft, type ReviewStatus } from '../../src/policy/types';
import { extractPolicyDraft, hasPolicyApiKey } from '../../services/policyExtract';
import { Hint } from '../futures/Hint';
import PolicyResults from './PolicyResults';
import ProvisionEditor from './ProvisionEditor';
import {
  addProvision,
  copyAsDraftB,
  linkStateFor,
  removeProvision,
  repin,
  runKey,
  setProvisionStatus,
  updateMapping,
  updateProvision,
  withEdit,
} from './policyState';

export interface PolicyPanelProps {
  /** The Lab's base model. */
  model: CoreModel;
  /** Scenario overlays shared by both sides (the Lab's overlays and edits, no hypothetical). */
  overlays: Overlay[];
  initialDrafts?: PolicyDraft[];
  initialSource?: { title?: string; url?: string; text?: string };
  initialRuns?: number;
  initialSeed?: number;
  /** Run the paired comparison while mounting (used when a link opens the panel). */
  runOnMount?: boolean;
  /** A message to show at the top (e.g. "Opened from a shared link"). */
  initialNotice?: { tone: 'ok' | 'error'; text: string } | null;
  /** Switch the Lab to another bundled model (with no overlays). */
  onRequestModel: (modelId: string) => void;
  /** Switch the Lab to a model and a scenario (from a bundle). */
  onOpenScenario: (modelId: string, overlays: Overlay[]) => void;
}

interface StoredResult {
  key: string;
  result: PairedRunResult;
}

const registry = (id: string): CoreModel | undefined => findFixture(id)?.model;
const btn =
  'inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50';
const btnPlain = `${btn} border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800`;
const btnPrimary = `${btn} border-sky-600 bg-sky-600 text-white hover:bg-sky-700 dark:border-sky-500 dark:bg-sky-600`;
const field =
  'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';
const labelCls = 'block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-0.5';

function download(filename: string, text: string, mime: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(text: string): Promise<boolean> {
  const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (!clip) return false;
  try {
    await clip.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function runAll(model: CoreModel, overlays: Overlay[], drafts: PolicyDraft[], runs: number, seed: number): Array<StoredResult | null> {
  return drafts.map((d) => (d.modelId === model.id ? { key: runKey(model, overlays, d, runs, seed), result: pairedRun(model, overlays, d, { runs, seed }) } : null));
}

const PolicyPanel: React.FC<PolicyPanelProps> = ({
  model,
  overlays,
  initialDrafts = [],
  initialSource,
  initialRuns = DEFAULT_RUNS,
  initialSeed = DEFAULT_SEED,
  runOnMount = false,
  initialNotice = null,
  onRequestModel,
  onOpenScenario,
}) => {
  const [sourceTitle, setSourceTitle] = useState(initialSource?.title ?? '');
  const [sourceUrl, setSourceUrl] = useState(initialSource?.url ?? '');
  const [sourceText, setSourceText] = useState(initialSource?.text ?? '');
  const [drafts, setDrafts] = useState<PolicyDraft[]>(initialDrafts.slice(0, 2));
  const [active, setActive] = useState(0);
  const [runs, setRuns] = useState(initialRuns);
  const [seed, setSeed] = useState(initialSeed);
  const [results, setResults] = useState<Array<StoredResult | null>>(() => (runOnMount ? runAll(model, overlays, initialDrafts.slice(0, 2), initialRuns, initialSeed) : []));
  const [year, setYear] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(initialNotice);
  const [extracting, setExtracting] = useState(false);
  const [linkText, setLinkText] = useState<string | null>(null);
  const [report, setReport] = useState<ReopenReport | null>(null);
  const [memoCopied, setMemoCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const apiKey = hasPolicyApiKey();
  const scenarioModel = useMemo(() => resolveModel(model, overlays).model, [model, overlays]);
  const draft = drafts[active] ?? null;

  const diagnostics = useMemo(
    () => drafts.map((d) => (d.modelId === model.id ? validateDraft(d, model, { overlays, sourceText: sourceText.trim() ? sourceText : undefined }) : [])),
    [drafts, model, overlays, sourceText],
  );

  const entries = useMemo(
    () =>
      drafts
        .map((d, i) => {
          const r = results[i];
          if (!r || d.modelId !== model.id) return null;
          return { label: i === 0 ? 'A' : 'B', result: r.result, stale: r.key !== runKey(model, overlays, d, runs, seed) };
        })
        .filter((e): e is { label: string; result: PairedRunResult; stale: boolean } => e !== null),
    [drafts, results, model, overlays, runs, seed],
  );

  const activeResult = results[active];
  const activeFresh = useMemo(
    () => !!(draft && activeResult && activeResult.result.ok && activeResult.key === runKey(model, overlays, draft, runs, seed)),
    [draft, activeResult, model, overlays, runs, seed],
  );
  const memo = useMemo(
    () => (draft && activeResult && activeFresh ? renderMemo({ model, overlays, draft, result: activeResult.result, diagnostics: diagnostics[active] }) : ''),
    [draft, activeResult, activeFresh, model, overlays, diagnostics, active],
  );

  // -- draft edits ----------------------------------------------------------

  const setDraft = (i: number, next: PolicyDraft) => setDrafts((ds) => ds.map((d, j) => (j === i ? next : d)));
  const edit = (fn: (d: PolicyDraft) => PolicyDraft) => draft && setDraft(active, fn(draft));

  const startManual = () => {
    const d = blankDraft(model, { title: sourceTitle, url: sourceUrl || undefined, text: sourceText }, { kind: 'person', name: '' });
    setDrafts([d]);
    setActive(0);
    setResults([]);
    setReport(null);
    setNotice({ tone: 'ok', text: 'Blank manual draft started. Add a provision for each operative part of the text, quoting it verbatim.' });
  };

  const loadExample = (id: string) => {
    const ex = findPolicyExample(id);
    if (!ex) return;
    if (ex.modelId !== model.id) onRequestModel(ex.modelId);
    setSourceTitle(ex.source.title);
    setSourceUrl(ex.source.url);
    setSourceText(ex.source.text);
    setDrafts([ex.draft]);
    setActive(0);
    setResults([]);
    setReport(null);
    setNotice({ tone: 'ok', text: `Loaded the worked example (${ex.draft.reviewStatus}, drafted by ${ex.draft.draftedBy?.name ?? 'unknown'}). Run it to see the paired comparison.` });
  };

  const extract = async () => {
    if (!sourceText.trim()) {
      setNotice({ tone: 'error', text: 'Paste the policy text first.' });
      return;
    }
    setExtracting(true);
    setNotice(null);
    try {
      const out = await extractPolicyDraft(model, sourceText, { title: sourceTitle || undefined, url: sourceUrl || undefined, overlays });
      if (!out.draft) {
        setNotice({ tone: 'error', text: `The extraction could not be used: ${out.errors.join('; ')}` });
      } else {
        setDrafts([out.draft]);
        setActive(0);
        setResults([]);
        setReport(null);
        setNotice({
          tone: 'ok',
          text: `AI draft ready: ${coverage(out.draft).text}. It is unreviewed — check every quote and mapping against the text.${
            out.demoted.length ? ` ${out.demoted.length} mapping${out.demoted.length === 1 ? ' was' : 's were'} demoted to unresolved (quote not verbatim or target not in the model).` : ''
          }`,
        });
      }
    } catch (e) {
      setNotice({ tone: 'error', text: (e as Error).message });
    } finally {
      setExtracting(false);
    }
  };

  const run = () => {
    setResults(runAll(model, overlays, drafts, runs, seed));
    setReport(null);
    setNotice(null);
  };

  // -- sharing ----------------------------------------------------------------

  const copyLink = async () => {
    if (!drafts.length) return;
    const state = linkStateFor(model, overlays, drafts.filter((d) => d.modelId === model.id), runs, seed);
    const payload = encodeLabLink(state);
    if (payload.length > MAX_LINK_PAYLOAD_CHARS) {
      setLinkText(null);
      setNotice({ tone: 'error', text: `This scenario is too large for a link (${payload.length.toLocaleString('en-US')} characters). Download a bundle instead.` });
      return;
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const path = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '/';
    const url = buildLabShareUrl(state, origin, path);
    setLinkText(url);
    const ok = await copyText(url);
    setNotice({ tone: 'ok', text: ok ? 'Link copied. It pins the model version, the scenario and the drafts; opening it re-runs the comparison.' : 'Copy the link below.' });
  };

  const downloadBundle = () => {
    if (!draft || !activeResult || !activeFresh) return;
    const bundle = buildBundle(model, overlays, draft, activeResult.result, { sourceText: sourceText.trim() ? sourceText : undefined });
    download(bundleFileName(bundle), JSON.stringify(bundle, null, 2), 'application/json');
  };

  const openBundleText = (text: string) => {
    const parsed = parseBundleJson(text);
    if (!parsed.ok) {
      setReport(null);
      setNotice({ tone: 'error', text: `Cannot open this bundle: ${parsed.reason}` });
      return;
    }
    const rep = reopenBundle(parsed.value, registry);
    setReport(rep);
    if (rep.model && rep.draft && rep.overlays) {
      onOpenScenario(rep.model.id, rep.overlays);
      setDrafts([rep.draft]);
      setActive(0);
      setSourceTitle(rep.draft.source?.title ?? '');
      setSourceUrl(rep.draft.source?.url ?? '');
      setSourceText(parsed.value.sourceText ?? '');
      setRuns(parsed.value.manifest.runs);
      setSeed(parsed.value.manifest.seed);
      setResults(rep.rerun ? [{ key: runKey(rep.model, rep.overlays, rep.draft, parsed.value.manifest.runs, parsed.value.manifest.seed), result: rep.rerun }] : []);
      setNotice(null);
    } else {
      setNotice({ tone: 'error', text: rep.errors.join(' ') });
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then(openBundleText, (err: Error) => setNotice({ tone: 'error', text: `Could not read the file: ${err.message}` }));
    e.target.value = '';
  };

  // -- view -------------------------------------------------------------------

  const cov = draft ? coverage(draft) : null;
  const d = draft ? diagnostics[active] ?? [] : [];
  const errors = d.filter((x) => x.level === 'error');
  const draftWarnings = d.filter((x) => x.level === 'warning' && !x.provisionId);
  const draftInfos = d.filter((x) => x.level === 'info' && !x.provisionId);
  const draftErrors = errors.filter((x) => !x.provisionId);
  const wrongModel = draft && draft.modelId !== model.id;
  const wrongVersion = draft && !wrongModel && d.some((x) => x.code === 'model-hash-mismatch');

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-3" aria-labelledby="policy-heading">
      <header>
        <h3 id="policy-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
          <ScrollText size={16} className="text-sky-600 dark:text-sky-400" aria-hidden="true" />
          Policy: read a text against this model
        </h3>
        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
          Paste a bill or proposal, list its provisions, map what this model can represent, and compare policy against baseline on the same model and the
          same draws. An extraction is a draft to check. Results are this model's arithmetic under its assumptions — not a prediction of what the policy
          would do.
        </p>
      </header>

      {notice && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-xs ${
            notice.tone === 'error'
              ? 'border border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
              : 'border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
          }`}
        >
          {notice.text}
        </p>
      )}

      {/* 1. Source */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className={labelCls} htmlFor="policy-source-title">
            Source title
          </label>
          <input id="policy-source-title" className={`${field} h-11`} value={sourceTitle} onChange={(e) => setSourceTitle(e.target.value)} placeholder="e.g. S. 1234, section 5" />
        </div>
        <div>
          <label className={labelCls} htmlFor="policy-source-url">
            Source URL
          </label>
          <input id="policy-source-url" className={`${field} h-11`} value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" />
        </div>
      </div>
      <div>
        <label className={labelCls} htmlFor="policy-source-text">
          Policy text
          <Hint label="Policy text" text="Quotes are checked against exactly this text (ignoring line breaks and spacing). Editing it after drafting shows a hash mismatch until the quotes are re-checked." />
        </label>
        <textarea
          id="policy-source-text"
          rows={5}
          className={`${field} py-2 font-serif text-xs`}
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          placeholder="Paste the operative sections here."
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{sourceText.length.toLocaleString('en-US')} characters</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btnPlain} onClick={extract} disabled={!apiKey || extracting}>
          <Sparkles size={14} aria-hidden="true" />
          {extracting ? 'Extracting…' : 'Extract provisions with AI'}
        </button>
        <button type="button" className={btnPlain} onClick={startManual}>
          <Plus size={14} aria-hidden="true" />
          Start a manual draft
        </button>
        {POLICY_EXAMPLES.map((ex) => (
          <button key={ex.id} type="button" className={btnPlain} onClick={() => loadExample(ex.id)}>
            <FileText size={14} aria-hidden="true" />
            {`Load worked example: ${ex.label}`}
          </button>
        ))}
      </div>
      {!apiKey && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          AI extraction is off: this build has no Gemini API key. A manual draft does the same job, offline.
        </p>
      )}

      {/* 2. Drafts */}
      {drafts.length > 0 && draft && (
        <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Drafts">
            {drafts.map((x, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === active}
                onClick={() => setActive(i)}
                className={`${btn} ${i === active ? 'border-sky-500 bg-sky-50 text-sky-800 dark:border-sky-600 dark:bg-sky-950/50 dark:text-sky-200' : 'border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200'}`}
              >
                {`Draft ${i === 0 ? 'A' : 'B'}`}
                <span className="font-normal opacity-80 max-w-[12rem] truncate">{x.title}</span>
              </button>
            ))}
            {drafts.length === 1 ? (
              <button type="button" className={btnPlain} onClick={() => { setDrafts([drafts[0], copyAsDraftB(drafts[0])]); setActive(1); }}>
                <Plus size={14} aria-hidden="true" />
                Add draft B (a copy of A to vary)
              </button>
            ) : (
              <button type="button" className={btnPlain} onClick={() => { setDrafts([drafts[0]]); setResults((r) => r.slice(0, 1)); setActive(0); }}>
                Remove draft B
              </button>
            )}
          </div>

          {wrongModel && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              This draft was written for model “{draft.modelId}”, not “{model.id}”. It cannot run here.
              {findFixture(draft.modelId) && (
                <button type="button" className={`${btnPlain} ml-2`} onClick={() => onRequestModel(draft.modelId)}>
                  Switch the Lab to that model
                </button>
              )}
            </div>
          )}
          {wrongVersion && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              This draft pins a different version of “{model.id}”. Check every mapping against the current model, then re-pin.
              <button type="button" className={`${btnPlain} ml-2`} onClick={() => edit((x) => repin(x, model))}>
                Re-pin to this version
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-3">
              <label className={labelCls} htmlFor="policy-draft-title">
                Draft title
              </label>
              <input id="policy-draft-title" className={`${field} h-11`} value={draft.title} onChange={(e) => edit((x) => withEdit(x, { ...x, title: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls} htmlFor="policy-review">
                Review status
                <Hint
                  label="Review status"
                  text="ai-drafted: an extraction nobody has checked. author-drafted: written by the named author, not independently checked. human-reviewed: a named person other than the drafter checked every provision against the text. Editing a reviewed draft sets it back to author-drafted."
                />
              </label>
              <select
                id="policy-review"
                className={`${field} h-11`}
                value={draft.reviewStatus}
                onChange={(e) => {
                  const next = e.target.value as ReviewStatus;
                  setDraft(active, { ...draft, reviewStatus: next, ...(next === 'human-reviewed' ? {} : { reviewedBy: undefined }) });
                }}
              >
                {REVIEW_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="policy-drafted-by">
                Drafted by
              </label>
              <input
                id="policy-drafted-by"
                className={`${field} h-11`}
                value={draft.draftedBy?.name ?? ''}
                onChange={(e) => edit((x) => withEdit(x, { ...x, draftedBy: { kind: x.draftedBy?.kind ?? 'person', name: e.target.value, date: x.draftedBy?.date } }))}
              />
            </div>
            {draft.reviewStatus === 'human-reviewed' && (
              <div>
                <label className={labelCls} htmlFor="policy-reviewed-by">
                  Reviewed by (not the drafter)
                </label>
                <input
                  id="policy-reviewed-by"
                  className={`${field} h-11`}
                  value={draft.reviewedBy?.name ?? ''}
                  onChange={(e) => setDraft(active, { ...draft, reviewedBy: { name: e.target.value, date: new Date().toISOString().slice(0, 10) } })}
                />
              </div>
            )}
          </div>

          {cov && (
            <p className={`text-xs font-semibold ${cov.allAccountedFor ? 'text-slate-700 dark:text-slate-200' : 'text-amber-700 dark:text-amber-300'}`}>
              {cov.text}
              {cov.allAccountedFor ? ' — every provision accounted for' : ' — not every provision is accounted for yet'}
              <Hint
                label="coverage"
                text="Every provision must be mapped, unresolved or outside the model. Unresolved and outside-model provisions change nothing in the run; they are listed so the missing mechanisms stay visible."
              />
            </p>
          )}
          {(draftErrors.length > 0 || draftWarnings.length > 0 || draftInfos.length > 0) && (
            <ul className="space-y-0.5 text-[11px]">
              {[...draftErrors, ...draftWarnings, ...draftInfos].map((x, i) => (
                <li key={i} className={x.level === 'error' ? 'text-rose-700 dark:text-rose-300' : x.level === 'warning' ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}>
                  <span className="font-semibold">{x.level}</span> <span className="font-mono">{x.code}</span>: {x.message}
                </li>
              ))}
            </ul>
          )}
          {errors.length > 0 && (
            <p className="text-[11px] text-rose-700 dark:text-rose-300">
              {errors.length} validation error{errors.length === 1 ? '' : 's'} in this draft. It can still run, but the memo lists them as open issues.
            </p>
          )}

          <div className="space-y-1.5">
            {draft.provisions.map((p, i) => (
              <ProvisionEditor
                key={i}
                provision={p}
                index={i}
                model={model}
                overlays={overlays}
                diagnostics={d.filter((x) => x.provisionId === p.id)}
                onPatch={(patch) => edit((x) => updateProvision(x, i, patch))}
                onStatus={(s) => edit((x) => setProvisionStatus(x, i, s, model, overlays))}
                onMapping={(patch) => edit((x) => updateMapping(x, i, patch, model, overlays))}
                onRemove={() => edit((x) => removeProvision(x, i))}
              />
            ))}
            <button type="button" className={btnPlain} onClick={() => edit((x) => addProvision(x))}>
              <Plus size={14} aria-hidden="true" />
              Add a provision
            </button>
          </div>

          {/* 3. Run */}
          <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
            <div>
              <label className={labelCls} htmlFor="policy-runs">
                Draws
              </label>
              <input id="policy-runs" type="number" min={1} max={2000} className={`${field} h-11 w-24`} value={runs} onChange={(e) => setRuns(Math.max(1, Math.min(2000, Math.floor(Number(e.target.value) || 1))))} />
            </div>
            <div>
              <label className={labelCls} htmlFor="policy-seed">
                Seed
              </label>
              <input id="policy-seed" type="number" className={`${field} h-11 w-24`} value={seed} onChange={(e) => setSeed(Math.floor(Number(e.target.value) || 0))} />
            </div>
            <button type="button" className={btnPrimary} onClick={run} disabled={!drafts.some((x) => x.modelId === model.id)}>
              <Play size={14} aria-hidden="true" />
              {drafts.length > 1 ? 'Run paired comparison (A and B)' : 'Run paired comparison'}
            </button>
            <p className="basis-full text-[11px] text-slate-500 dark:text-slate-400">
              Baseline: {model.id}
              {overlays.length ? ` with ${overlays.map((o) => o.id).join(', ')}` : ' as bundled'}. The relax-it hypothetical is not included.
            </p>
          </div>

          {entries.length > 0 && <PolicyResults model={scenarioModel} entries={entries} active={Math.min(active, entries.length - 1)} year={year} onYear={setYear} />}

          {draft && (
            <details className="rounded-lg bg-slate-100 dark:bg-slate-800/60 px-3 py-2 text-xs">
              <summary className="min-h-11 cursor-pointer list-none py-2 font-semibold text-slate-700 dark:text-slate-200">What this model cannot say about this text</summary>
              <p className="text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Scope:</span> {model.scope ?? 'no scope declared — treat every result as illustrative.'}
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-600 dark:text-slate-300">
                {draft.provisions
                  .filter((p) => p.status !== 'mapped')
                  .map((p, i) => (
                    <li key={i}>
                      <span className="font-mono">{p.id}</span> ({p.status}): {p.reason || 'no reason given'}
                    </li>
                  ))}
              </ul>
            </details>
          )}

          {/* 4. Share, reopen, memo */}
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
            <button type="button" className={btnPlain} onClick={copyLink} disabled={!drafts.some((x) => x.modelId === model.id)}>
              <Link2 size={14} aria-hidden="true" />
              Copy share link
            </button>
            <button type="button" className={btnPlain} onClick={downloadBundle} disabled={!activeFresh}>
              <Download size={14} aria-hidden="true" />
              Download bundle
            </button>
            <button type="button" className={btnPlain} onClick={() => fileRef.current?.click()}>
              <Upload size={14} aria-hidden="true" />
              Open a bundle
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} aria-label="Open a bundle file" />
            <button
              type="button"
              className={btnPlain}
              disabled={!memo}
              onClick={async () => {
                const ok = await copyText(memo);
                setMemoCopied(ok);
                if (ok) setTimeout(() => setMemoCopied(false), 1500);
              }}
            >
              <Copy size={14} aria-hidden="true" />
              {memoCopied ? 'Memo copied' : 'Copy memo'}
            </button>
            <button type="button" className={btnPlain} disabled={!memo} onClick={() => draft && download(memoFileName(draft), memo, 'text/markdown')}>
              <Download size={14} aria-hidden="true" />
              Download memo
            </button>
            {!activeFresh && <span className="text-[11px] text-slate-500 dark:text-slate-400">Run the comparison to enable the bundle and memo.</span>}
          </div>
        </div>
      )}

      {drafts.length === 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btnPlain} onClick={() => fileRef.current?.click()}>
            <Upload size={14} aria-hidden="true" />
            Open a bundle
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} aria-label="Open a bundle file" />
        </div>
      )}

      {linkText && (
        <input readOnly aria-label="Share link" value={linkText} className={`${field} h-11 font-mono text-[11px]`} onFocus={(e) => e.currentTarget.select()} />
      )}

      {report && (
        <div
          className={`rounded-lg px-3 py-2 text-xs ${
            report.status === 'reproduced'
              ? 'border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
          }`}
        >
          <p className="font-semibold">
            {report.status === 'reproduced'
              ? `Bundle reopened: all ${report.compared.toLocaleString('en-US')} stored values reproduced within the declared tolerance (largest deviation ${report.maxAbsDiff}).`
              : report.status === 'not-reproduced'
                ? 'Bundle reopened, but the results did NOT reproduce within the declared tolerance.'
                : 'Cannot open this bundle.'}
          </p>
          {report.tolerance && (
            <p className="mt-0.5">
              Tolerance: absolute {report.tolerance.absolute}, relative {report.tolerance.relative}. {report.tolerance.note}
            </p>
          )}
          {[...report.errors, ...report.warnings].map((x, i) => (
            <p key={i} className="mt-0.5">
              {x}
            </p>
          ))}
        </div>
      )}

      {memo && (
        <details className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2">
          <summary className="min-h-11 cursor-pointer list-none py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">Decision memo (Markdown)</summary>
          <textarea readOnly aria-label="Decision memo" rows={14} value={memo} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 font-mono text-[11px] leading-snug text-slate-700 dark:text-slate-200" />
        </details>
      )}

      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Bundled models available to open links and bundles: {CORE_FIXTURES.map((f) => f.model.id).join(', ')}.
      </p>
    </section>
  );
};

export default PolicyPanel;

import { attestationBinding } from '../../src/policy/draft';
/**
 * PolicyPanel — "read a policy text against this model" (v3 stage 5).
 *
 * Paste a text (or load the worked example), list its provisions — by AI extraction when a key is
 * configured, or by hand — review each one's status, role, mapping and evidence, account for every
 * clause of the source (a provision quote or an explicit exclusion), then run policy against
 * baseline on the same model, scenario overlays and draws. Run is disabled while the draft has
 * validation errors, and the errors are listed next to it. Two drafts can sit side by side
 * on that baseline. The result can be shared as a link, downloaded as a bundle that reopens and
 * checks it reproduces, and written up as a decision memo.
 *
 * The baseline is the Lab's current scenario: the model, the overlays toggled above, and any value
 * edits or added variables. The "try relaxing it" hypothetical is not part of it.
 *
 * Paired runs and bundle re-runs go through the model runner (src/workers/client.ts): off the main
 * thread in the browser, with progress and Cancel, and refused before they start when the draws,
 * seed or model size are over RUN_LIMITS. A model imported into the Lab cannot travel in a link (a
 * link names a model the app ships); its bundle carries the model and says it is experimental.
 */

import { scenarioProvenance, type ScenarioProvenance } from '../../src/policy/provenance';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, FileText, Link2, Play, Plus, ScrollText, Sparkles, Square, Upload } from 'lucide-react';
import { resolveModel } from '../../src/core/engine';
import { RUN_LIMITS, checkRunSettings } from '../../src/core/limits';
import type { ValidationResult } from '../../src/core/validate';
import type { Runner } from '../../src/workers/client';
import type { PairedJob, Progress, RunOutcome, RunJob } from '../../src/workers/protocol';
import { CORE_FIXTURES, findFixture } from '../../src/core/fixtures';
import type { CoreModel, Overlay } from '../../src/core/types';
import {
  MAX_LINK_PAYLOAD_CHARS,
  buildBundle,
  buildLabShareUrl,
  bundleFileName,
  encodeLabLink,
  parseBundleJson,
  type ReopenReport,
} from '../../src/policy/bundle';
import { buildClauseInventory, sourceCoverage } from '../../src/policy/clauses';
import { DEFAULT_RUNS, DEFAULT_SEED, blankDraft, blockingErrors, coverage, validateDraft } from '../../src/policy/draft';
import { modelHash, sha256Hex } from '../../src/policy/hash';
import { POLICY_EXAMPLES, findPolicyExample } from '../../src/policy/examples';
import { memoFileName, renderMemo } from '../../src/policy/memo';
import { EXCLUSION_KINDS, REVIEW_STATUSES, type ExclusionKind, type PairedRunResult, type PolicyDraft, type ReviewStatus } from '../../src/policy/types';
import { extractPolicyDraft, hasPolicyApiKey } from '../../services/policyExtract';
import { Hint } from '../futures/Hint';
import PolicyResults from './PolicyResults';
import { createAttemptGate, observeAttempt, ownsContext, POLICY_VIEW_CAPABILITIES, type ActiveRunView, type AttemptStatus } from './activeRunView';
import ProvisionEditor from './ProvisionEditor';
import { EXPERIMENTAL_LABEL, curatedMatch, explainValidationErrors, type ModelStatus } from './importState';
import {
  addExclusion,
  addProvision,
  copyAsDraftB,
  linkStateFor,
  removeExclusion,
  removeProvision,
  repin,
  repinSource,
  runKey,
  updateExclusion,
  setProvisionStatus,
  updateMapping,
  updateProvision,
  withEdit,
} from './policyState';

export interface PolicyPanelProps {
  onActiveRunChange?: (view: ActiveRunView) => void;
  onOpenResultView?: () => void;
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
  /** Switch the Lab to a model and a scenario (from a bundle). The model may be one the bundle carried. */
  onOpenScenario: (model: CoreModel, overlays: Overlay[], status: ModelStatus, warnings?: string[], provenance?: ScenarioProvenance) => void;
  /** Runs paired comparisons and bundle re-runs (a worker in the browser, synchronous in tests). */
  runner: Runner;
  /** 'imported' when the Lab's model was loaded from a file: experimental — not curated. */
  modelStatus?: ModelStatus;
  importWarnings?: string[];
  provenance?: ScenarioProvenance;
  /** Models imported this session, so bundles made on them reopen. */
  extraModels?: CoreModel[];
}

interface StoredResult {
  key: string;
  result: PairedRunResult;
}

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

/** The runner job for a paired comparison. pairedRun validates each draft and refuses to run one with errors. */
function pairedJob(model: CoreModel, overlays: Overlay[], drafts: PolicyDraft[], runs: number, seed: number, sourceText: string): PairedJob {
  return { kind: 'paired', model, overlays, drafts, runs, seed, sourceText };
}

function storedResults(job: PairedJob, results: Array<PairedRunResult | null>): Array<StoredResult | null> {
  return job.drafts.map((d, i) => (results[i] ? { key: runKey(job.model, job.overlays, d, job.runs, job.seed, job.sourceText), result: results[i]! } : null));
}

const stateChip: Record<string, string> = {
  covered: 'bg-sky-100 text-sky-800 ring-sky-300 dark:bg-sky-900/40 dark:text-sky-200 dark:ring-sky-700',
  'covered-and-excluded': 'bg-sky-100 text-sky-800 ring-sky-300 dark:bg-sky-900/40 dark:text-sky-200 dark:ring-sky-700',
  excluded: 'bg-slate-200 text-slate-700 ring-slate-300 dark:bg-slate-700/60 dark:text-slate-200 dark:ring-slate-600',
  uncovered: 'bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-700',
};

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
  runner,
  modelStatus = 'curated',
  importWarnings = [],
  provenance,
  extraModels = [],
  onActiveRunChange,
  onOpenResultView,
}) => {
  const [sourceCandidate, setSourceCandidate] = useState<{ model: CoreModel; overlays: Overlay[]; draft: PolicyDraft; sourceText?: string; reason: string } | null>(null);
  const [sourceTitle, setSourceTitle] = useState(initialSource?.title ?? '');
  const [sourceUrl, setSourceUrl] = useState(initialSource?.url ?? '');
  const [sourceText, setSourceText] = useState(initialSource?.text ?? '');
  const [drafts, setDrafts] = useState<PolicyDraft[]>(initialDrafts.slice(0, 2));
  const [active, setActive] = useState(() => typeof window !== 'undefined' && window.location.hash.startsWith('#lab=') && new URLSearchParams(window.location.search).get('policyDraft') === 'B' && initialDrafts.length > 1 ? 1 : 0);
  const [runs, setRuns] = useState(initialRuns);
  const [seed, setSeed] = useState(initialSeed);
  // A synchronous runner (tests, SSR) runs a link's comparison while mounting; a worker runs it in an effect.
  const [results, setResults] = useState<Array<StoredResult | null>>(() => {
    if (!runOnMount || runner.mode !== 'sync') return [];
    const job = pairedJob(model, overlays, initialDrafts.slice(0, 2), initialRuns, initialSeed, initialSource?.text ?? '');
    if (checkRunSettings({ runs: job.runs, seed: job.seed, model: resolveModel(job.model, job.overlays).model }).length) return [];
    const o = runner.runSync(job);
    return o.status === 'done' ? storedResults(job, o.result) : [];
  });
  const [running, setRunning] = useState<{ progress: Progress | null; cancel: () => void; what: string } | null>(null);
  const gate = useRef(createAttemptGate());
  const [attempt, setAttempt] = useState<AttemptStatus>(results.length ? results.some(r => r?.result.ok) ? 'ready' : 'failed' : 'empty');
  useEffect(() => () => gate.current.revoke(), []);
  const [attestName, setAttestName] = useState('');
  const [attestStatement, setAttestStatement] = useState('I reviewed every operative clause, its mapping or unresolved/outside-model disposition, and all exclusions. This is my content-bound review, not independent legal certification.');
  const [year, setYear] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(initialNotice);
  const [extracting, setExtracting] = useState(false);
  const [linkText, setLinkText] = useState<string | null>(null);
  const [report, setReport] = useState<ReopenReport | null>(null);
  const [memoCopied, setMemoCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const operationContext = useRef('');
  operationContext.current = JSON.stringify([model, overlays, drafts, sourceText, sourceTitle, sourceUrl, runs, seed]);
  const extractionGate = useRef(createAttemptGate());
  useEffect(() => () => extractionGate.current.revoke(), []);

  const imported = modelStatus === 'imported' || provenance?.kind === 'source-import';
  const registryModels = useMemo(() => (imported ? [model, ...extraModels] : extraModels), [imported, model, extraModels]);
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
          return { slot: i, label: i === 0 ? 'A' : 'B', result: r.result, stale: r.key !== runKey(model, overlays, d, runs, seed, sourceText) };
        })
        .filter((e): e is { slot: number; label: string; result: PairedRunResult; stale: boolean } => e !== null),
    [drafts, results, model, overlays, runs, seed, sourceText],
  );

  const activeResult = results[active];
  const activeFresh = useMemo(
    () => !!(attempt === 'ready' && draft && activeResult && activeResult.result.ok && activeResult.key === runKey(model, overlays, draft, runs, seed, sourceText)),
    [attempt, draft, activeResult, model, overlays, runs, seed, sourceText],
  );
  const memo = useMemo(
    () =>
      draft && activeResult && activeFresh
        ? renderMemo({ model, overlays, draft, result: activeResult.result, diagnostics: diagnostics[active], sourceText: sourceText.trim() ? sourceText : undefined, modelStatus: modelStatus as ModelStatus })
        : '',
    [draft, activeResult, activeFresh, model, overlays, diagnostics, active, sourceText, modelStatus],
  );
  /** Blocking validation errors per draft on this model. */
  const blocking = useMemo(() => drafts.map((d, i) => (d.modelId === model.id ? blockingErrors(diagnostics[i] ?? []) : [])), [drafts, diagnostics, model]);
  const runnable = drafts.some((x) => x.modelId === model.id);
  const blocked = blocking.some((b) => b.length > 0);
  const clauseDetail = useMemo(() => (draft && sourceText.trim() ? sourceCoverage(draft, sourceText) : null), [draft, sourceText]);
  const clauseText = useMemo(() => new Map(sourceText.trim() ? buildClauseInventory(sourceText).clauses.map((c) => [c.id, c.text] as const) : []), [sourceText]);

  const activeKey = draft ? runKey(model, overlays, draft, runs, seed, sourceText) : '';
  const viewStatus = activeFresh ? 'ready' : attempt === 'ready' && activeResult && !activeResult.result.ok ? 'failed' : attempt === 'running' || attempt === 'failed' || attempt === 'cancelled' ? attempt : activeResult ? 'stale' : 'empty';
  const cov = draft ? coverage(draft, sourceText.trim() ? sourceText : undefined) : null;
  const coverageText = cov ? `${cov.text}; Source text quoted or excluded: ${cov.source.text}; Clause handling coverage: ${cov.operative.text}; ${cov.completeness.text}` : 'No policy draft selected.';
  const noMapped = !draft?.provisions.some(p => p.status === 'mapped' && p.mapping);
  const origin = `${provenance?.kind ?? modelStatus}${provenance?.reason ? `: ${provenance.reason}` : ''}${importWarnings.length ? `; ${importWarnings.join('; ')}` : ''}`;
  useEffect(() => {
    onActiveRunChange?.({ capabilities: POLICY_VIEW_CAPABILITIES, origin, family: 'lab-policy', key: activeKey, slot: active, status: viewStatus,
      model: scenarioModel, modelStatus, source: draft?.source ?? null, review: draft?.reviewStatus ?? 'unreviewed',
      scope: scenarioModel.scope ?? 'No scope declared; illustrative only.', coverage: coverageText, entries,
      limitations: [
        ...(activeResult && !activeResult.result.ok ? activeResult.result.errors : []),
        'Bundled examples are not universally independently reviewed models. These outputs depend on the stated equations and assumptions.',
        ...(noMapped ? ['Nothing from this proposal is represented in the calculation. Identical curves are a structural baseline comparison, not an estimated zero policy effect.'] : []),
        'Partial coverage: unresolved and outside-model provisions do not affect these curves. Outcome differences cannot establish net welfare winners.',
      ],
    });
  }, [onActiveRunChange, activeKey, active, viewStatus, scenarioModel, modelStatus, draft, coverageText, entries, noMapped, activeResult, origin]);

  // -- draft edits ----------------------------------------------------------

  const setDraft = (i: number, next: PolicyDraft) => setDrafts((ds) => ds.map((d, j) => (j === i ? next : d)));
  const edit = (fn: (d: PolicyDraft) => PolicyDraft) => draft && setDraft(active, fn(draft));

  const startManual = () => {
    const d = blankDraft(model, { title: sourceTitle, url: sourceUrl || undefined, text: sourceText }, { kind: 'person', name: '' });
    setDrafts([d]);
    setActive(0);
    gate.current.revoke();
    setRunning(null);
    setAttempt('empty');
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
    gate.current.revoke();
    setRunning(null);
    setAttempt('empty');
    setResults([]);
    setReport(null);
    setNotice({ tone: 'ok', text: `Loaded the worked example (${ex.draft.reviewStatus}, drafted by ${ex.draft.draftedBy?.name ?? 'unknown'}). Run it to see the paired comparison.` });
  };

  const extract = async () => {
    if (!sourceText.trim()) {
      setNotice({ tone: 'error', text: 'Paste the policy text first.' });
      return;
    }
    const token = extractionGate.current.begin();
    const context = operationContext.current;
    const current = () => ownsContext(extractionGate.current, token, context, operationContext.current);
    setExtracting(true);
    setNotice(null);
    try {
      const out = await extractPolicyDraft(model, sourceText, { title: sourceTitle || undefined, url: sourceUrl || undefined, overlays });
      if (!current()) return;
      if (!out.draft) {
        setNotice({ tone: 'error', text: `The extraction could not be used: ${out.errors.join('; ')}` });
      } else {
        setDrafts([out.draft]);
        setActive(0);
        gate.current.revoke();
    setRunning(null);
    setAttempt('empty');
    setResults([]);
        setReport(null);
        setNotice({
          tone: 'ok',
          text: `AI draft ready: ${coverage(out.draft).text}; ${coverage(out.draft, sourceText).source.text}. It is unreviewed and its completeness is not attested — check every quote, mapping and exclusion against the text.${
            out.demoted.length ? ` ${out.demoted.length} mapping${out.demoted.length === 1 ? ' was' : 's were'} demoted to unresolved (quote not verbatim or target not in the model).` : ''
          }${
            out.droppedExclusions.length
              ? ` ${out.droppedExclusions.length} proposed exclusion${out.droppedExclusions.length === 1 ? ' was' : 's were'} dropped (${out.droppedExclusions.map((x) => `${x.clauseId}: ${x.why}`).join('; ')}).`
              : ''
          }`,
        });
      }
    } catch (e) {
      if (current()) setNotice({ tone: 'error', text: (e as Error).message });
    } finally {
      if (extractionGate.current.owns(token)) setExtracting(false);
    }
  };

  /** Start a paired run. Settings over the limits are refused before anything runs. */
  const startRun = (job: PairedJob, onDone?: () => void) => {
    const token = gate.current.begin();
    setAttempt('running');
    setRunning(null);
    const problems = checkRunSettings({ runs: job.runs, seed: job.seed, model: resolveModel(job.model, job.overlays).model });
    if (problems.length) {
      setAttempt('failed');
      setNotice({ tone: 'error', text: `Not run: ${problems.map((p) => p.message).join('; ')}.` });
      return;
    }
    const apply = (o: RunOutcome<Array<PairedRunResult | null>>) => {
      if (!gate.current.owns(token)) return;
      setRunning(null);
      setAttempt(o.status === 'done' ? 'ready' : o.status === 'cancelled' ? 'cancelled' : 'failed');
      if (o.status === 'done') {
        setResults(storedResults(job, o.result));
        onDone?.();
      } else if (o.status !== 'superseded') {
        setNotice({ tone: 'error', text: o.status === 'cancelled' ? 'The paired run was cancelled; nothing new is shown.' : `The paired run stopped (${o.status}): ${o.message}` });
      }
    };
    if (runner.mode === 'sync') {
      apply(runner.runSync(job));
      return;
    }
    observeAttempt(gate.current, token,
      progress => runner.run('policy', job, { onProgress: progress }), {
        progress: value => setRunning(r => r ? { ...r, progress: value as Progress } : r),
        complete: apply,
        error: error => { setRunning(null); setAttempt('failed'); setNotice({ tone: 'error', text: `The paired run failed: ${String(error)}` }); },
      });
    setRunning({ progress: null, cancel: () => { gate.current.revoke(); setRunning(null); setAttempt('cancelled'); }, what: 'paired comparison' });
  };

  // A link opened in the browser: run its comparison once, in the worker.
  const mountRun = useRef(runOnMount && runner.mode !== 'sync');
  useEffect(() => {
    if (!mountRun.current) return;
    mountRun.current = false;
    startRun(pairedJob(model, overlays, initialDrafts.slice(0, 2), initialRuns, initialSeed, initialSource?.text ?? ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = () => {
    if (blocked) return;
    setReport(null);
    setNotice(null);
    startRun(pairedJob(model, overlays, drafts, runs, seed, sourceText));
  };

  // -- sharing ----------------------------------------------------------------

  const copyLink = async () => {
    if (!drafts.length || imported) return;
    const state = linkStateFor(model, overlays, drafts.filter((d) => d.modelId === model.id), runs, seed, provenance);
    const payload = encodeLabLink(state);
    if (payload.length > MAX_LINK_PAYLOAD_CHARS) {
      setLinkText(null);
      setNotice({ tone: 'error', text: `This scenario is too large for a link (${payload.length.toLocaleString('en-US')} characters). Download a bundle instead.` });
      return;
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const query = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    query.set('policyDraft', active === 1 ? 'B' : 'A');
    const path = `${typeof window !== 'undefined' ? window.location.pathname : '/'}?${query.toString()}`;
    const url = buildLabShareUrl(state, origin, path);
    setLinkText(url);
    const ok = await copyText(url);
    setNotice({
      tone: 'ok',
      text: `${ok ? 'Link copied.' : 'Copy the link below.'} It pins the model and engine versions, the scenario, the drafts, the draws and the seed; opening it re-runs the comparison. It does not carry the source text, so whoever opens it sees "source unavailable — coverage unknown". Download a bundle to share the text too.`,
    });
  };

  const downloadBundle = () => {
    if (!draft || !activeResult || !activeFresh) return;
    // The source text travels only when it is the text the draft pins, so quotes can be re-checked on reopening.
    const pinned = sourceText.trim() && (!draft.source.textSha256 || sha256Hex(sourceText) === draft.source.textSha256);
    try {
      const bundle = buildBundle(model, overlays, draft, activeResult.result, { sourceText: pinned ? sourceText : undefined, embedModel: imported, importWarnings, provenance });
      download(bundleFileName(bundle), JSON.stringify(bundle, null, 2), 'application/json');
    } catch (e) { setNotice({ tone: 'error', text: (e as Error).message }); }
  };

  const sourceDraftSupported = (draft: PolicyDraft, model: CoreModel, overlays: Overlay[]) => {
    try { return !validateDraft(draft, model, {overlays}).some((d) => d.code === 'schema'); }
    catch { return false; }
  };

  const openBundleText = async (text: string, current: () => boolean, token: number) => {
    if (!current()) return;
    const runOwned = <J extends RunJob>(job: J) => {
      if (runner.mode === 'sync') return Promise.resolve(runner.runSync(job));
      const handle = runner.run('bundle', job);
      gate.current.attach(token, handle.cancel);
      return handle.promise;
    };
    setRunning(null);
    setAttempt('failed');
    setSourceCandidate(null);
    const parsed = parseBundleJson(text);
    if (parsed.ok === false) {
      setReport(null);
      setNotice({ tone: 'error', text: `Cannot open this bundle: ${(parsed as { reason: string }).reason}` });
      // Unknown schema has no replay contract. A bounded, validated embedded source can
      // still be offered explicitly; no recorded results or certification are adopted.
      if (text.length <= 5_000_000) {
        try {
          const source = JSON.parse(text);
          if (typeof source?.schema === 'string' && source.schema.startsWith('policy-bundle/') && source.model && source.draft?.source && Array.isArray(source.draft.provisions) && Array.isArray(source.overlays)) {
            const checked = await runOwned({kind: 'validate-model', json: source.model});
            if (!current()) return;
            if (checked.status === 'done' && (checked.result as ValidationResult).ok && sourceDraftSupported(source.draft, (checked.result as ValidationResult).model!, source.overlays)) {
              setSourceCandidate({model: (checked.result as ValidationResult).model!, overlays: source.overlays, draft: source.draft, sourceText: typeof source.sourceText === 'string' ? source.sourceText : undefined, reason: parsed.reason});
            }
          }
        } catch { /* The original parse error remains visible. */ }
      }
      return;
    }
    const bundle = parsed.value!;
    let models = registryModels;
    let status: ModelStatus = 'curated';
    if (bundle.model) {
      // A carried model is validated like any import before anything runs, and is never curated.
      const v = await runOwned({ kind: 'validate-model', json: bundle.model });
      if (!current()) return;
      const vr = v.status === 'done' ? (v.result as ValidationResult) : null;
      if (!vr || !vr.ok || !vr.model) {
        setReport(null);
        setNotice({ tone: 'error', text: `Cannot open this bundle: the model it carries does not validate. ${vr ? explainValidationErrors(vr.errors).join(' ') : (v as { message: string }).message}` });
        return;
      }
      status = curatedMatch(vr.model) ? 'curated' : 'imported';
      models = [vr.model, ...registryModels];
    } else if (!findFixture(bundle.manifest.modelId) && registryModels.some((m) => m.id === bundle.manifest.modelId)) {
      status = 'imported';
    }
    setNotice({ tone: 'ok', text: 'Re-running the bundle to check it reproduces…' });
    const outcome = await runOwned({ kind: 'reopen-bundle', bundle, models });
    if (!current()) return;
    if (outcome.status !== 'done') {
      setReport(null);
      setNotice({ tone: 'error', text: `Cannot open this bundle: ${(outcome as { message: string }).message}` });
      return;
    }
    const rep = outcome.result as ReopenReport;
    setReport(rep);
    if (rep.status !== 'reproduced' && bundle.model && sourceDraftSupported(bundle.draft, bundle.model, bundle.overlays)) setSourceCandidate({model: bundle.model, overlays: bundle.overlays, draft: bundle.draft, sourceText: bundle.sourceText, reason: rep.errors.join(' ')});
    if (rep.status === 'reproduced' && rep.model && rep.draft && rep.overlays) {
      onOpenScenario(rep.model, rep.overlays, status, bundle.importWarnings, scenarioProvenance(rep.model, rep.overlays, bundle.provenance));
      setDrafts([rep.draft]);
      setActive(0);
      setSourceTitle(rep.draft.source?.title ?? '');
      setSourceUrl(rep.draft.source?.url ?? '');
      setSourceText(parsed.value.sourceText ?? '');
      setRuns(parsed.value.manifest.runs);
      setSeed(parsed.value.manifest.seed);
      setResults(rep.rerun ? [{ key: runKey(rep.model, rep.overlays, rep.draft, parsed.value.manifest.runs, parsed.value.manifest.seed, parsed.value.sourceText ?? ''), result: rep.rerun }] : []);
      setAttempt(rep.rerun ? 'ready' : 'empty');
      setNotice(null);
    } else {
      setAttempt('failed');
      setNotice({ tone: 'error', text: rep.errors.join(' ') });
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = gate.current.begin();
    const context = operationContext.current;
    const current = () => ownsContext(gate.current, token, context, operationContext.current);
    setRunning(null);
    setAttempt('failed');
    setSourceCandidate(null);
    e.target.value = '';
    if (file.size > 5_000_000) { setNotice({tone: 'error', text: 'The bundle exceeds the 5 MB reopen limit.'}); return; }
    void (async () => {
      try {
        const text = await file.text();
        if (!current()) return;
        await openBundleText(text, current, token);
      } catch (error) {
        if (current()) { setReport(null); setAttempt('failed'); setNotice({tone:'error',text:`Cannot open this bundle: ${error instanceof Error ? error.message : String(error)}`}); }
      }
    })();
  };

  // -- view -------------------------------------------------------------------

  const d = draft ? diagnostics[active] ?? [] : [];
  const errors = d.filter((x) => x.level === 'error');
  const draftWarnings = d.filter((x) => x.level === 'warning' && !x.provisionId);
  const draftInfos = d.filter((x) => x.level === 'info' && !x.provisionId);
  const draftErrors = errors.filter((x) => !x.provisionId);
  const wrongModel = draft && draft.modelId !== model.id;
  const wrongVersion = draft && !wrongModel && d.some((x) => x.code === 'model-hash-mismatch');
  const wrongText = draft && d.some((x) => x.code === 'text-hash-mismatch');
  const today = () => new Date().toISOString().slice(0, 10);

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

      {provenance && provenance.kind !== 'fixture' && <p role="note" className="text-xs text-amber-700 dark:text-amber-300">Experimental scenario — not curated. Base model: {modelStatus === 'curated' ? 'known fixture' : 'imported'}.{provenance.reason ? ` Source import reason: ${provenance.reason}` : ''}</p>}
      {sourceCandidate && <button type="button" className={btnPlain} onClick={() => {
        const c = sourceCandidate;
        const importedDraft: PolicyDraft = { ...c.draft, modelId: c.model.id, modelHash: modelHash(c.model), reviewStatus: 'author-drafted', reviewedBy: undefined, completeness: undefined };
        onOpenScenario(c.model, c.overlays, curatedMatch(c.model) ? 'curated' : 'imported', [`NEW experimental source import; not replay: ${c.reason}`], {kind: 'source-import', reason: c.reason});
        setDrafts([importedDraft]); setActive(0); setResults([]); setReport(null);
        setSourceTitle(importedDraft.source?.title ?? ''); setSourceUrl(importedDraft.source?.url ?? ''); setSourceText(c.sourceText ?? '');
        setSourceCandidate(null); setNotice({tone: 'ok', text: `Source imported for a NEW experimental run. Recorded results were not reproduced: ${c.reason}. Inspect the draft and run explicitly.`});
      }}>Import bundle source for a NEW experimental run (not replay)</button>}
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

          {wrongText && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              The policy text above is not the text this draft pins, so its quotes and coverage cannot be checked, and it cannot run.
              <button type="button" className={`${btnPlain} ml-2`} onClick={() => edit((x) => repinSource(x, sourceText))}>
                Re-pin the draft to this text
              </button>
            </div>
          )}

          {cov && (
            <div className="space-y-0.5 text-xs" data-testid="policy-coverage">
              <p className={`font-semibold ${cov.allHaveStatus ? 'text-slate-700 dark:text-slate-200' : 'text-amber-700 dark:text-amber-300'}`}>
                {`${cov.text} — ${cov.statusText}`}
                <Hint
                  label="provision statuses"
                  text="Counts only the provisions this draft lists. Unresolved and outside-model provisions change nothing in the run; they are listed so the missing mechanisms stay visible. Whether the list is complete is the next line's question."
                />
              </p>
              <p className={`font-semibold ${cov.source.status === 'complete' ? 'text-slate-700 dark:text-slate-200' : 'text-amber-700 dark:text-amber-300'}`}>
                {`Source text quoted or excluded: ${cov.source.text}`}
                <Hint
                  label="source coverage"
                  text="The source text is split into clauses by its own structure (sections and (a)/(1)/(A)/(i) subdivisions, or paragraphs and sentences), so the denominator does not depend on the draft. A clause counts when a provision quotes it or it is excluded with a kind and a reason."
                />
              </p>
              <p className="text-amber-700 dark:text-amber-300">{cov.operative.text}</p>
              <p className={cov.completeness.attested ? 'text-slate-700 dark:text-slate-200' : 'text-amber-700 dark:text-amber-300'}>{`Completeness: ${cov.completeness.text}`}</p>
            </div>
          )}

          {clauseDetail && clauseDetail.clauses > 0 && (
            <details className="rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1 text-xs">
              <summary className="min-h-11 cursor-pointer list-none py-2 font-semibold text-slate-700 dark:text-slate-200">
                {`Source clauses (${clauseDetail.clauses}; ${clauseDetail.uncovered.length} neither quoted nor excluded)`}
              </summary>
              <ul className="space-y-1 pb-2">
                {clauseDetail.detail.map((c) => (
                  <li key={c.id} className="rounded border border-slate-100 dark:border-slate-800 p-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${stateChip[c.state]}`}>{c.state}</span>
                      <span className="font-mono">{c.id}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-500 dark:text-slate-400">{(clauseText.get(c.id) ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)}</span>
                    </div>
                    {c.provisions.length > 0 && <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">quoted by {c.provisions.join(', ')}</p>}
                    <div className="mt-2 space-y-1">
                      <p>{clauseText.get(c.id)}</p>
                      <label>How this clause is handled
                        <select aria-label={`operative disposition for ${c.id}`} className={`${field} h-11`} value={draft?.clauseDispositions?.find(d => d.clauseId === c.id)?.status ?? 'unresolved'} onChange={e => edit(x => ({ ...x, clauseDispositions: [...(x.clauseDispositions ?? []).filter(d => d.clauseId !== c.id), { ...(x.clauseDispositions?.find(d => d.clauseId === c.id) ?? { clauseId: c.id, reason: '' }), status: e.target.value as 'linked' | 'unresolved' | 'outside-model' | 'not-operative' }] }))}>
                          {['unresolved', 'linked', 'outside-model', 'not-operative'].map(s => <option key={s}>{s}</option>)}
                        </select>
                      </label>
                      <input aria-label={`operative reason for ${c.id}`} className={field} placeholder="Explain all mechanisms and restrictions in this clause" value={draft?.clauseDispositions?.find(d => d.clauseId === c.id)?.reason ?? ''} onChange={e => edit(x => ({ ...x, clauseDispositions: [...(x.clauseDispositions ?? []).filter(d => d.clauseId !== c.id), { ...(x.clauseDispositions?.find(d => d.clauseId === c.id) ?? { clauseId: c.id, status: 'unresolved' as const }), reason: e.target.value }] }))} />
                      <label>Linked provisions (select every applicable mechanism)
                        <select multiple aria-label={`operative provision ids for ${c.id}`} className={field} value={draft?.clauseDispositions?.find(d => d.clauseId === c.id)?.provisionIds ?? []} onChange={e => { const provisionIds = Array.from(e.currentTarget.selectedOptions as HTMLCollectionOf<HTMLOptionElement>, option => option.value); edit(x => ({ ...x, clauseDispositions: [...(x.clauseDispositions ?? []).filter(d => d.clauseId !== c.id), { ...(x.clauseDispositions?.find(d => d.clauseId === c.id) ?? { clauseId: c.id, status: 'unresolved' as const, reason: '' }), provisionIds }] })); }}>
                          {draft?.provisions.map(p => <option key={p.id} value={p.id}>{p.id} — {p.summary}</option>)}
                        </select>
                      </label>
                    </div>
                    {c.exclusion ? (
                      <div className="mt-1 grid grid-cols-1 sm:grid-cols-4 gap-1">
                        <select
                          aria-label={`exclusion kind for ${c.id}`}
                          className={`${field} h-11`}
                          value={c.exclusion.kind}
                          onChange={(e) => edit((x) => updateExclusion(x, c.id, { kind: e.target.value as ExclusionKind }))}
                        >
                          {EXCLUSION_KINDS.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </select>
                        <input
                          aria-label={`why ${c.id} is excluded`}
                          className={`${field} h-11 sm:col-span-2`}
                          value={c.exclusion.reason}
                          placeholder="why this clause has no provision (required)"
                          onChange={(e) => edit((x) => updateExclusion(x, c.id, { reason: e.target.value }))}
                        />
                        <button type="button" className={btnPlain} onClick={() => edit((x) => removeExclusion(x, c.id))}>
                          Remove exclusion
                        </button>
                        {c.exclusion.interprets?.length ? <p className="sm:col-span-4 text-[11px] text-slate-600 dark:text-slate-300">interprets {c.exclusion.interprets.join(', ')}</p> : null}
                      </div>
                    ) : c.state === 'uncovered' ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        <button type="button" className={btnPlain} onClick={() => edit((x) => addProvision(x, (clauseText.get(c.id) ?? '').replace(/\s+/g, ' ').trim()))}>
                          Add a provision quoting it
                        </button>
                        <button type="button" className={btnPlain} onClick={() => edit((x) => addExclusion(x, c.id))}>
                          Exclude it, with a reason
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {draft && (
            <div className="flex flex-wrap items-end gap-2 text-xs">
              {draft.completeness ? (
                <>
                  <p className="text-slate-600 dark:text-slate-300">{`Attestation on file: ${draft.completeness.name} (${draft.completeness.kind}), ${draft.completeness.date} — "${draft.completeness.statement}"`}</p>
                  <button type="button" className={btnPlain} onClick={() => setDraft(active, { ...draft, completeness: undefined })}>
                    Withdraw attestation
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className={labelCls} htmlFor="policy-attest-name">
                      Attest completeness: your name
                      <Hint
                        label="completeness attestation"
                        text="A named person reviews every operative clause, including its mapping or unresolved/outside-model disposition and exclusions. The statement binds the source and current draft content, expires on edits, and is not independent legal certification. Quotation coverage alone is insufficient."
                      />
                    </label>
                    <input id="policy-attest-name" className={`${field} h-11 w-48`} value={attestName} onChange={(e) => setAttestName(e.target.value)} />
                  </div>
                  <div className="min-w-[12rem] flex-1">
                    <label className={labelCls} htmlFor="policy-attest-statement">
                      Statement
                    </label>
                    <input id="policy-attest-statement" className={`${field} h-11`} value={attestStatement} onChange={(e) => setAttestStatement(e.target.value)} />
                  </div>
                  <button
                    type="button"
                    className={btnPlain}
                    disabled={!attestName.trim() || !attestStatement.trim() || !sourceText.trim() || !!wrongText}
                    onClick={() =>
                      setDraft(active, {
                        ...draft,
                        completeness: { name: attestName.trim(), kind: 'person', date: today(), statement: attestStatement.trim(), textSha256: sha256Hex(sourceText), contentBinding: attestationBinding(draft) },
                      })
                    }
                  >
                    Attest (as a person)
                  </button>
                </>
              )}
            </div>
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
              {errors.length} validation error{errors.length === 1 ? '' : 's'} in this draft. It cannot run until they are fixed; unresolved and outside-model provisions are not errors.
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
                otherIds={draft.provisions.filter((o) => o.id !== p.id).map((o) => o.id)}
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
              <input id="policy-runs" type="number" min={1} max={RUN_LIMITS.maxDraws} className={`${field} h-11 w-24`} value={runs} onChange={(e) => setRuns(Math.max(1, Math.min(RUN_LIMITS.maxDraws, Math.floor(Number(e.target.value) || 1))))} />
            </div>
            <div>
              <label className={labelCls} htmlFor="policy-seed">
                Seed
              </label>
              <input id="policy-seed" type="number" className={`${field} h-11 w-24`} value={seed} onChange={(e) => setSeed(Math.floor(Number(e.target.value) || 0))} />
            </div>
            <button type="button" className={btnPrimary} onClick={run} disabled={!runnable || blocked || !!running} aria-describedby={blocked ? 'policy-run-blocked' : undefined}>
              <Play size={14} aria-hidden="true" />
              {drafts.length > 1 ? 'Run paired comparison (A and B)' : 'Run paired comparison'}
            </button>
            {running && (
              <div className="flex flex-wrap items-center gap-2" role="status" aria-live="polite">
                <progress
                  className="h-2 w-32 accent-sky-600"
                  max={running.progress?.total ?? 1}
                  value={running.progress?.done ?? 0}
                  aria-label="paired run progress"
                />
                <span className="text-[11px] tabular-nums text-slate-600 dark:text-slate-300">
                  {running.progress ? `${running.progress.done.toLocaleString('en-US')} / ${running.progress.total.toLocaleString('en-US')} draws` : `Running the ${running.what}…`}
                </span>
                <button type="button" className={btnPlain} onClick={() => { running.cancel(); setRunning(null); setNotice({ tone: 'error', text: 'The paired run was cancelled; nothing new is shown.' }); }}>
                  <Square size={12} aria-hidden="true" />
                  Cancel
                </button>
              </div>
            )}
            {blocked && (
              <div id="policy-run-blocked" role="alert" className="basis-full rounded-lg border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 px-3 py-2 text-[11px] text-rose-800 dark:text-rose-200">
                <p className="font-semibold">Run is disabled: fix these validation errors first.</p>
                {blocking.map((errs, i) =>
                  errs.length ? (
                    <div key={i} className="mt-1">
                      {drafts.length > 1 && <p className="font-semibold">{`Draft ${i === 0 ? 'A' : 'B'}`}</p>}
                      <ul className="list-disc pl-4">
                        {errs.map((x, j) => (
                          <li key={j}>
                            <span className="font-mono">{x.code}</span>: {x.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null,
                )}
              </div>
            )}
            <p className="basis-full text-[11px] text-slate-500 dark:text-slate-400">
              Baseline: {model.id}
              {imported ? ` (${EXPERIMENTAL_LABEL})` : ''}
              {overlays.length ? ` with ${overlays.map((o) => o.id).join(', ')}` : ' as loaded'}. The relax-it hypothetical is not included. At most {RUN_LIMITS.maxDraws.toLocaleString('en-US')} draws per run.
            </p>
          </div>

          <p className="text-xs">{coverageText}</p>
          {noMapped && <p role="note" className="text-sm font-semibold">Nothing from this proposal is represented in the calculation. Identical curves are a structural baseline comparison, not an estimated zero policy effect.</p>}
          <p className="text-xs">Unresolved and outside-model provisions do not affect these curves. This is a partial model comparison, not a net welfare ranking.</p>
          {onOpenResultView && <button className={btnPlain} onClick={onOpenResultView}>Open policy comparison in Charts</button>}
          {activeFresh ? <PolicyResults model={scenarioModel} entries={entries} active={entries.findIndex(e => e.slot === active)} year={year} onYear={setYear} modelStatus={modelStatus} /> : results.length > 0 && <p role="status">Current comparison: {viewStatus}. {activeResult?.result.errors.join("; ")} Run again to display current results.</p>}

          {draft && (
            <details className="rounded-lg bg-slate-100 dark:bg-slate-800/60 px-3 py-2 text-xs">
              <summary className="min-h-11 cursor-pointer list-none py-2 font-semibold text-slate-700 dark:text-slate-200">What this model cannot say about this text</summary>
              <p className="text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Scope:</span> {model.scope ?? 'no scope declared — treat every result as illustrative.'}
              </p>
              <p className="mt-1 text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Omitted from the run</span> (listed, not mapped — they change nothing):
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
            <button type="button" className={btnPlain} onClick={copyLink} disabled={!runnable || blocked || imported} title={imported ? 'A link names a model the app ships; download a bundle, which carries the imported model' : blocked ? 'A link to a draft with validation errors would not open' : undefined}>
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
            {imported && <span className="text-[11px] text-amber-700 dark:text-amber-300">{`Imported model (${EXPERIMENTAL_LABEL}): links are off; the bundle carries the model.`}</span>}
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
        {extraModels.length > 0 && ` Imported this session (${EXPERIMENTAL_LABEL}): ${extraModels.map((m) => m.id).join(', ')}.`}
      </p>
    </section>
  );
};

export default PolicyPanel;

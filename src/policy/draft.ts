/**
 * Policy drafts — validate, turn into an overlay, and run paired against the baseline. Pure.
 *
 *   validateDraft(draft, model, { sourceText, overlays }) -> diagnostics
 *   coverage(draft)                                      -> counts per status, "all accounted for"
 *   draftToOverlay(draft, model, overlays)               -> Overlay (mapped provisions only)
 *   pairedRun(model, overlays, draft, { runs, seed })    -> baseline vs policy, per-draw differences
 *
 * Honesty rules enforced here (spec section 8):
 *   - every provision has a status; unresolved and outside-model carry a reason;
 *   - quotes are verbatim (after whitespace normalisation) when the source text is available;
 *   - a mapping may only target things the model already has; it never rewrites an equation;
 *   - a 'coefficient' (how the world responds) is never supported by the policy's own text, and a
 *     coefficient without a real source is flagged so it is shown as an assumption;
 *   - "human-reviewed" names a reviewer who is not the drafter.
 */

import { ENGINE_VERSION, explainBinding, resolveModel, runModel } from '../core/engine';
import type { CoreModel, EvidenceKind, Input, Overlay, RunResult } from '../core/types';
import { contentHash, modelHash, sha256Hex } from './hash';
import {
  PROVISION_ROLES,
  PROVISION_STATUSES,
  REVIEW_STATUSES,
  type Coverage,
  type DraftDiagnostic,
  type PairedRunResult,
  type PolicyDraft,
  type PolicyRunManifest,
  type Provision,
  type QuantileKey,
  type Quantiles,
} from './types';

export const DEFAULT_RUNS = 200;
export const DEFAULT_SEED = 1;
const SINGLE = '_';

/** Collapse every run of whitespace to one space. Quotes are compared in this form. */
export function normaliseWhitespace(text: string): string {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

/** True when `quote` occurs in `source` once whitespace is normalised on both sides. */
export function quoteInSource(quote: string, source: string): boolean {
  const q = normaliseWhitespace(quote);
  return q.length > 0 && normaliseWhitespace(source).includes(q);
}

export function policyOverlayId(draft: Pick<PolicyDraft, 'id'>): string {
  return `policy-${draft.id}`;
}

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------

export function coverage(draft: Pick<PolicyDraft, 'provisions'>): Coverage {
  const provisions = Array.isArray(draft?.provisions) ? draft.provisions : [];
  const total = provisions.length;
  const count = (s: string) => provisions.filter((p) => p?.status === s).length;
  const mapped = count('mapped');
  const unresolved = count('unresolved');
  const outsideModel = count('outside-model');
  const unaccounted = total - mapped - unresolved - outsideModel;
  const parts = [`${mapped} of ${total} provision${total === 1 ? '' : 's'} mapped`, `${unresolved} unresolved`, `${outsideModel} outside model`];
  if (unaccounted > 0) parts.push(`${unaccounted} with no status`);
  return {
    total,
    mapped,
    unresolved,
    outsideModel,
    unaccounted,
    allAccountedFor: total > 0 && unaccounted === 0,
    text: total === 0 ? 'No provisions yet' : parts.join(', '),
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const STRONG_KINDS: EvidenceKind[] = ['causal', 'associational', 'calibrated', 'elicited'];
const FUNCTION_NAMES = new Set(['min', 'max', 'abs', 'exp', 'log', 'log10', 'sqrt', 'pow', 'floor', 'ceil', 'round', 'logit', 'sigmoid', 'clamp', 'sum', 'mean']);
const RESERVED = new Set(['t', 'year', 'pi', 'e', 'true', 'false']);

/** Bare identifiers an expression reads (function names, lags' `t` and reserved words excluded). */
export function expressionSymbols(expr: string): string[] {
  const out = new Set<string>();
  const re = /[A-Za-z_]\w*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr)) !== null) {
    const word = m[0];
    const rest = expr.slice(m.index + word.length);
    if (/^\s*\(/.test(rest) && FUNCTION_NAMES.has(word)) continue;
    // skip exponent parts of numeric literals like 1e-6
    const before = expr.slice(0, m.index);
    if (/\d$/.test(before) && /^e\d*$/i.test(word)) continue;
    if (RESERVED.has(word)) continue;
    out.add(word);
  }
  return [...out];
}

export interface ValidateOptions {
  /** The text the quotes should be found in. Without it, quotes are reported as unchecked. */
  sourceText?: string;
  /** Scenario overlays the draft is applied on top of (mapping targets may come from them). */
  overlays?: Overlay[];
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function validateDraft(draft: PolicyDraft, model: CoreModel, opts: ValidateOptions = {}): DraftDiagnostic[] {
  const out: DraftDiagnostic[] = [];
  const push = (d: DraftDiagnostic) => out.push(d);

  if (!isObject(draft)) return [{ level: 'error', code: 'schema', message: 'A draft must be a JSON object.' }];
  if (draft.schemaVersion !== 1) push({ level: 'error', code: 'schema', message: `Unsupported draft schemaVersion ${String(draft.schemaVersion)}; this app reads version 1.` });
  if (typeof draft.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(draft.id)) push({ level: 'error', code: 'schema', message: 'The draft needs an id made of letters, digits, - and _.' });
  if (typeof draft.title !== 'string' || !draft.title.trim()) push({ level: 'error', code: 'schema', message: 'The draft needs a title.' });
  if (!isObject(draft.source) || typeof draft.source.title !== 'string') push({ level: 'error', code: 'schema', message: 'The draft needs a source with a title.' });
  if (!Array.isArray(draft.provisions)) {
    push({ level: 'error', code: 'schema', message: 'The draft needs a provisions list.' });
    return out;
  }

  // -- model identity -------------------------------------------------------
  if (draft.modelId !== model.id) {
    push({ level: 'error', code: 'model-mismatch', message: `This draft was written against model "${draft.modelId}", not "${model.id}".` });
  } else if (draft.modelHash !== modelHash(model)) {
    push({
      level: 'error',
      code: 'model-hash-mismatch',
      message: `This draft pins model version ${draft.modelHash}; the loaded "${model.id}" is version ${modelHash(model)}. Re-check every mapping before re-pinning.`,
    });
  }

  // -- review status ----------------------------------------------------------
  if (!REVIEW_STATUSES.includes(draft.reviewStatus)) {
    push({ level: 'error', code: 'review-status', message: `Unknown review status "${String(draft.reviewStatus)}".` });
  } else if (draft.reviewStatus === 'human-reviewed') {
    const reviewer = draft.reviewedBy?.name?.trim();
    if (!reviewer) push({ level: 'error', code: 'review-status', message: '"human-reviewed" needs the name of the person who reviewed it (reviewedBy).' });
    else if (draft.draftedBy && reviewer.toLowerCase() === draft.draftedBy.name.trim().toLowerCase())
      push({ level: 'error', code: 'review-status', message: 'A draft cannot be marked human-reviewed by the person or agent who drafted it.' });
    else if (draft.draftedBy?.kind === 'ai' && reviewer.toLowerCase() === draft.draftedBy.name.toLowerCase())
      push({ level: 'error', code: 'review-status', message: 'An AI extraction cannot review itself.' });
  } else if (draft.reviewStatus === 'author-drafted' && !draft.draftedBy?.name) {
    push({ level: 'warning', code: 'review-status', message: '"author-drafted" should say who drafted it (draftedBy).' });
  }

  // -- source text --------------------------------------------------------------
  const sourceText = opts.sourceText;
  if (typeof sourceText === 'string') {
    if (draft.source?.textSha256 && sha256Hex(sourceText) !== draft.source.textSha256) {
      push({ level: 'error', code: 'text-hash-mismatch', message: 'The source text supplied is not the text this draft was checked against (SHA-256 differs).' });
    }
  } else if (draft.provisions.length > 0) {
    push({ level: 'info', code: 'quote-unchecked', message: 'Source text not available here, so quotes were not re-checked against it.' });
  }

  // -- provisions ---------------------------------------------------------------
  const { model: resolved } = resolveModel(model, opts.overlays ?? []);
  const params = new Map(resolved.parameters.map((p) => [p.id, p]));
  const inputs = new Map((resolved.inputs ?? []).map((i) => [i.id, i]));
  const variables = new Map(resolved.variables.map((v) => [v.id, v]));
  const unknowns = new Set((resolved.solves ?? []).map((s) => s.unknown));
  const known = new Set<string>([...params.keys(), ...inputs.keys(), ...variables.keys(), ...unknowns]);

  const seenIds = new Set<string>();
  const targets = new Map<string, Provision[]>();

  for (const [index, p] of draft.provisions.entries()) {
    const pid = isObject(p) && typeof p.id === 'string' && p.id ? p.id : `#${index + 1}`;
    const at = (level: DraftDiagnostic['level'], code: DraftDiagnostic['code'], message: string) =>
      push({ level, code, message: `${pid}: ${message}`, provisionId: pid });
    if (!isObject(p)) { at('error', 'schema', 'provision is not an object'); continue; }
    if (seenIds.has(pid)) at('error', 'duplicate-provision-id', 'provision id is used twice');
    seenIds.add(pid);

    if (!PROVISION_STATUSES.includes(p.status)) {
      at('error', 'missing-status', 'every provision must be mapped, unresolved or outside-model');
    }
    if (p.role !== undefined && !PROVISION_ROLES.includes(p.role)) at('error', 'schema', `unknown role "${String(p.role)}"`);

    if (typeof p.quote !== 'string' || !normaliseWhitespace(p.quote)) at('error', 'empty-quote', 'every provision needs a verbatim quote from the source');
    else if (typeof sourceText === 'string' && !quoteInSource(p.quote, sourceText)) at('error', 'quote-not-found', 'the quote is not found verbatim in the source text');

    if ((p.status === 'unresolved' || p.status === 'outside-model') && !p.reason?.trim()) {
      at('error', 'missing-reason', `a ${p.status} provision must say why, so the missing mechanism stays visible`);
    }
    if (p.status !== 'mapped') {
      if (p.mapping) at('info', 'mapping-ignored', 'has a mapping, but only mapped provisions change the run');
      continue;
    }

    // mapped
    if (!p.role) at('error', 'schema', 'a mapped provision needs a role (control, funding, constraint or coefficient)');
    const m = p.mapping;
    if (!isObject(m)) { at('error', 'missing-mapping', 'mapped, but says nothing about what it sets'); continue; }
    if (!m.evidence?.label?.trim()) at('error', 'missing-source', 'the mapping needs an evidence label — "assumed: ..." is a valid one');

    const key = `${m.kind}:${m.target}`;
    if (!targets.has(key)) targets.set(key, []);
    targets.get(key)!.push(p);

    let targetUnit: string | undefined;
    if (m.kind === 'parameter') {
      const param = params.get(m.target);
      if (!param) at('error', 'unknown-target', `"${m.target}" is not a parameter of ${model.id}`);
      targetUnit = param?.unit;
      if (m.op !== 'set') at('error', 'bad-op', 'a parameter mapping can only set a value');
      if (typeof m.value !== 'number' || !Number.isFinite(m.value)) at('error', 'bad-value', 'a parameter mapping needs a finite value');
    } else if (m.kind === 'input') {
      const input = inputs.get(m.target);
      if (!input) at('error', 'unknown-target', `"${m.target}" is not an input of ${model.id}`);
      targetUnit = input?.unit;
      if (m.op === 'set') {
        const curveOk = isObject(m.curve) && Object.keys(m.curve).length > 0 && Object.entries(m.curve).every(([k, v]) => Number.isFinite(Number(k)) && typeof v === 'number' && Number.isFinite(v));
        const valueOk = typeof m.value === 'number' && Number.isFinite(m.value);
        if (!curveOk && !valueOk) at('error', 'bad-value', 'setting an input needs a curve {year: value} or a constant value');
      } else if (m.op === 'add') {
        if (typeof m.value !== 'number' || !Number.isFinite(m.value)) at('error', 'bad-value', 'adding to an input needs a finite value');
        if (input?.interp === 'logodds') at('warning', 'bad-op', `"${m.target}" interpolates in log-odds, so adding a constant at its keys is not a constant shift between them`);
      } else at('error', 'bad-op', 'an input mapping can set or add');
    } else if (m.kind === 'effect') {
      const v = variables.get(m.target);
      if (!v) at('error', 'unknown-target', `"${m.target}" is not a variable of ${model.id}`);
      else if (v.hook === false) at('error', 'no-hook', `"${m.target}" does not accept effects`);
      targetUnit = m.op === 'add' ? v?.unit : undefined;
      if (m.op !== 'add' && m.op !== 'multiply') at('error', 'bad-op', 'an effect adds or multiplies');
      if (typeof m.expr !== 'string' || !m.expr.trim()) at('error', 'bad-value', 'an effect needs an expression');
      else for (const s of expressionSymbols(m.expr)) if (!known.has(s)) at('error', 'unknown-target', `the effect reads "${s}", which the model does not have`);
      if (p.role && p.role !== 'coefficient') at('warning', 'effect-not-coefficient', 'an effect changes how the model responds; its size is a coefficient, so mark the role "coefficient" and source it');
    } else {
      at('error', 'schema', `unknown mapping kind "${String((m as { kind?: unknown }).kind)}"`);
    }
    if (m.unit && targetUnit && m.unit !== targetUnit) at('warning', 'unit-mismatch', `mapping is in ${m.unit} but "${m.target}" is in ${targetUnit}`);

    // Controls versus coefficients.
    // An effect is a response by construction, so the coefficient rules apply to it whatever its role.
    const isCoefficient = p.role === 'coefficient' || m.kind === 'effect';
    if (isCoefficient) {
      const kind = m.evidence?.kind;
      const cites = (() => {
        const e = m.evidence ?? { label: '' };
        const src: Partial<PolicyDraft['source']> = draft.source ?? {};
        if (src.url && e.url && e.url.trim() === src.url.trim()) return true;
        return !!src.title && typeof e.label === 'string' && e.label.toLowerCase().includes(src.title.toLowerCase());
      })();
      if (kind && STRONG_KINDS.includes(kind) && cites) {
        at('error', 'coefficient-from-source-text', `cites the policy text as ${kind} evidence for a response coefficient; the text supports what the policy sets, not how much the world responds`);
      } else if (!kind || kind === 'guess') {
        at('warning', 'coefficient-unsupported', 'a response coefficient with no real source: it will be shown as a guess, and every result that depends on it is illustrative. Mark it unresolved, use an existing model parameter, or label it "assumed"');
      } else if (kind === 'assumed') {
        at('info', 'coefficient-unsupported', 'response coefficient labelled as an assumption; it is listed under assumptions the result depends on');
      }
    }
  }

  // -- duplicate targets ----------------------------------------------------------
  for (const [key, list] of targets) {
    if (list.length < 2) continue;
    const ids = list.map((p) => p.id).join(', ');
    const [kind, target] = key.split(':');
    const hasSet = list.some((p) => p.mapping?.op === 'set');
    if (kind === 'effect') push({ level: 'warning', code: 'duplicate-target', message: `${ids} all attach effects to "${target}"; they compose — check nothing is counted twice` });
    else if (hasSet) push({ level: 'error', code: 'duplicate-target', message: `${ids} all change ${kind} "${target}" and at least one replaces it; only one provision may set a target` });
    else push({ level: 'warning', code: 'duplicate-target', message: `${ids} all add to "${target}"; they are summed — check nothing is counted twice` });
  }

  if (!draft.provisions.some((p) => p?.status === 'mapped')) {
    push({ level: 'info', code: 'nothing-mapped', message: 'No provision is mapped, so the policy run is identical to the baseline.' });
  }
  return out;
}

export function hasErrors(diagnostics: DraftDiagnostic[]): boolean {
  return diagnostics.some((d) => d.level === 'error');
}

// ---------------------------------------------------------------------------
// Draft -> overlay
// ---------------------------------------------------------------------------

/**
 * The overlay a draft's mapped provisions describe, on top of `overlays` (the scenario). Mappings
 * that cannot be applied (unknown target, bad value) are skipped — validateDraft reports them.
 */
export function draftToOverlay(draft: PolicyDraft, model: CoreModel, overlays: Overlay[] = []): Overlay {
  const { model: resolved } = resolveModel(model, overlays);
  const params = new Set(resolved.parameters.map((p) => p.id));
  const inputs = new Map((resolved.inputs ?? []).map((i) => [i.id, i]));
  const variables = new Map(resolved.variables.map((v) => [v.id, v]));
  const overlay: Overlay = {
    id: policyOverlayId(draft),
    name: `Policy: ${draft.title}`,
    description: `Mapped provisions of "${draft.source?.title ?? draft.title}" (${draft.reviewStatus}). Only what the draft maps is here; unresolved and outside-model provisions change nothing.`,
    parameters: [],
    inputs: [],
    effects: [],
  };
  const newInputs = new Map<string, Input>();

  for (const p of draft.provisions ?? []) {
    if (p?.status !== 'mapped' || !p.mapping) continue;
    const m = p.mapping;
    const source = { ...m.evidence, note: [m.evidence?.note, `policy provision ${p.id}: "${normaliseWhitespace(p.quote).slice(0, 160)}"`].filter(Boolean).join(' — ') };
    if (m.kind === 'parameter' && m.op === 'set' && params.has(m.target) && Number.isFinite(m.value)) {
      overlay.parameters!.push({ id: m.target, value: m.value as number, range: undefined, source });
    } else if (m.kind === 'input' && inputs.has(m.target)) {
      const current = newInputs.get(m.target) ?? JSON.parse(JSON.stringify(inputs.get(m.target))) as Input;
      if (m.op === 'set') {
        const curve = m.curve && Object.keys(m.curve).length ? { ...m.curve } : Number.isFinite(m.value) ? { [String(resolved.time.start)]: m.value as number } : null;
        if (!curve) continue;
        newInputs.set(m.target, { ...current, curve, byEntity: undefined, source });
      } else if (m.op === 'add' && Number.isFinite(m.value)) {
        const add = m.value as number;
        const shift = (c: Record<string, number>) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v + add]));
        newInputs.set(m.target, {
          ...current,
          curve: shift(current.curve),
          byEntity: current.byEntity ? Object.fromEntries(Object.entries(current.byEntity).map(([e, c]) => [e, shift(c)])) : undefined,
          source: { ...source, note: `${source.note} — added to the scenario's own curve (${current.source?.label ?? 'no source'})` },
        });
      }
    } else if (m.kind === 'effect' && variables.has(m.target) && (m.op === 'add' || m.op === 'multiply') && m.expr?.trim()) {
      overlay.effects!.push({
        id: `${policyOverlayId(draft)}-${p.id}`,
        target: m.target,
        op: m.op,
        expr: m.expr.trim(),
        unit: m.unit || undefined,
        source,
        from: Number.isFinite(m.from) ? m.from : undefined,
      });
    }
  }
  overlay.inputs = [...newInputs.values()];
  return overlay;
}

// ---------------------------------------------------------------------------
// Paired run
// ---------------------------------------------------------------------------

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Quantiles per step across draws. `draws[r][t]`. */
export function quantilesOf(draws: number[][], nSteps: number): Quantiles {
  const q: Quantiles = { p5: [], p25: [], p50: [], p75: [], p95: [], mean: [] };
  for (let t = 0; t < nSteps; t++) {
    const col = draws.map((d) => d[t]).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    q.p5.push(quantile(col, 0.05));
    q.p25.push(quantile(col, 0.25));
    q.p50.push(quantile(col, 0.5));
    q.p75.push(quantile(col, 0.75));
    q.p95.push(quantile(col, 0.95));
    q.mean.push(col.length ? col.reduce((a, b) => a + b, 0) / col.length : NaN);
  }
  return q;
}

export const QUANTILE_KEYS: QuantileKey[] = ['p5', 'p25', 'p50', 'p75', 'p95', 'mean'];

function bindingByStep(result: RunResult): Record<string, string[][]> {
  const out: Record<string, string[][]> = {};
  for (const entity of Object.keys(result.binding ?? {})) {
    out[entity] = result.years.map((_, t) => Object.keys(result.binding[entity]).flatMap((v) => explainBinding(result, entity, v, t)));
  }
  return out;
}

export interface PairedRunOptions {
  runs?: number;
  seed?: number;
  /** Clock for the manifest; tests pin it. */
  now?: () => string;
}

export function evidenceOf(draft: PolicyDraft): PolicyRunManifest['evidence'] {
  return (draft.provisions ?? [])
    .filter((p) => p?.status === 'mapped' && p.mapping)
    .map((p) => ({
      provisionId: p.id,
      role: p.role,
      target: `${p.mapping!.kind}:${p.mapping!.target}`,
      kind: p.mapping!.evidence?.kind ?? 'assumed',
      label: p.mapping!.evidence?.label ?? '',
      ...(p.mapping!.evidence?.url ? { url: p.mapping!.evidence.url } : {}),
    }));
}

/**
 * Policy versus baseline on the same model, same scenario overlays, same seed and the same draw
 * indices; only the draft's overlay differs. Differences are taken inside each draw and then
 * summarised, so correlated uncertainty cancels the way it should.
 */
export function pairedRun(model: CoreModel, overlays: Overlay[], draft: PolicyDraft, opts: PairedRunOptions = {}): PairedRunResult {
  const runs = Math.max(1, Math.floor(opts.runs ?? DEFAULT_RUNS));
  const seed = Math.floor(opts.seed ?? DEFAULT_SEED);
  const policyOverlay = draftToOverlay(draft, model, overlays);
  const policyOverlays = [...overlays, policyOverlay];
  const cov = coverage(draft);

  const pointB = runModel(model, { overlays });
  const pointP = runModel(model, { overlays: policyOverlays });

  const manifest: PolicyRunManifest = {
    schema: 'policy-run/1',
    modelId: model.id,
    modelName: model.name,
    modelHash: modelHash(model),
    engineVersion: ENGINE_VERSION,
    baselineOverlays: overlays.map((o) => ({ id: o.id, hash: contentHash(o) })),
    policyOverlayId: policyOverlay.id,
    policyOverlayHash: contentHash(policyOverlay),
    draftId: draft.id,
    draftHash: contentHash(draft),
    reviewStatus: draft.reviewStatus,
    ...(draft.draftedBy ? { draftedBy: draft.draftedBy } : {}),
    ...(draft.reviewedBy ? { reviewedBy: draft.reviewedBy } : {}),
    coverage: { total: cov.total, mapped: cov.mapped, unresolved: cov.unresolved, outsideModel: cov.outsideModel, allAccountedFor: cov.allAccountedFor },
    evidence: evidenceOf(draft),
    runs,
    seed,
    baselineRunHash: pointB.manifest.hash,
    policyRunHash: pointP.manifest.hash,
    createdAt: (opts.now ?? (() => new Date().toISOString()))(),
  };

  const empty: PairedRunResult = {
    ok: false,
    errors: [],
    years: pointB.years,
    entities: [],
    outputs: [],
    policyOnlyOutputs: [],
    runs: 0,
    seed,
    point: { baseline: {}, policy: {} },
    baseline: {},
    policy: {},
    difference: {},
    binding: { baseline: {}, policy: {} },
    manifest,
  };
  const failures = (side: string, r: RunResult) =>
    r.diagnostics.filter((d) => d.level === 'error').map((d) => `${side}: [${d.code}] ${d.message}`);
  if (!pointB.ok || !pointP.ok) {
    return { ...empty, errors: [...(pointB.ok ? [] : failures('baseline', pointB)), ...(pointP.ok ? [] : failures('policy', pointP))] };
  }

  const baseOutputs = resolveModel(model, overlays).model.outputs;
  const polOutputs = resolveModel(model, policyOverlays).model.outputs;
  const outputs = baseOutputs.filter((o) => polOutputs.includes(o));
  const policyOnlyOutputs = polOutputs.filter((o) => !baseOutputs.includes(o));
  const entities = Object.keys(pointB.series);
  const nY = pointB.years.length;

  // draws[side][entity][output][run][t]
  type Draws = Record<string, Record<string, number[][]>>;
  const mk = (keys: string[]): Draws => Object.fromEntries(entities.map((e) => [e, Object.fromEntries(keys.map((k) => [k, [] as number[][]]))]));
  const drawsB = mk(outputs);
  const drawsP = mk(polOutputs);
  const drawsD = mk(outputs);

  for (let r = 0; r < runs; r++) {
    const b = runModel(model, { overlays, seed, run: r });
    const p = runModel(model, { overlays: policyOverlays, seed, run: r });
    if (!b.ok || !p.ok) {
      return { ...empty, errors: [`draw ${r} failed`, ...(b.ok ? [] : failures('baseline', b)), ...(p.ok ? [] : failures('policy', p))] };
    }
    for (const e of entities) {
      for (const o of outputs) {
        const bs = b.series[e]?.[o] ?? new Array(nY).fill(NaN);
        const ps = p.series[e]?.[o] ?? new Array(nY).fill(NaN);
        drawsB[e][o].push(bs);
        drawsD[e][o].push(ps.map((v, t) => v - bs[t]));
      }
      for (const o of polOutputs) drawsP[e][o].push(p.series[e]?.[o] ?? new Array(nY).fill(NaN));
    }
  }

  const summarise = (d: Draws) =>
    Object.fromEntries(Object.entries(d).map(([e, byOut]) => [e, Object.fromEntries(Object.entries(byOut).map(([o, rows]) => [o, quantilesOf(rows, nY)]))]));
  const pick = (r: RunResult, keys: string[]) =>
    Object.fromEntries(entities.map((e) => [e, Object.fromEntries(keys.map((k) => [k, r.series[e]?.[k] ?? []]))]));

  return {
    ok: true,
    errors: [],
    years: pointB.years,
    entities: entities.length ? entities : [SINGLE],
    outputs,
    policyOnlyOutputs,
    runs,
    seed,
    point: { baseline: pick(pointB, outputs), policy: pick(pointP, polOutputs) },
    baseline: summarise(drawsB),
    policy: summarise(drawsP),
    difference: summarise(drawsD),
    binding: { baseline: bindingByStep(pointB), policy: bindingByStep(pointP) },
    manifest,
  };
}

/** A blank manual draft for a model: no AI, works offline. */
export function blankDraft(model: CoreModel, source: { title?: string; url?: string; text?: string } = {}, draftedBy?: PolicyDraft['draftedBy']): PolicyDraft {
  const text = source.text ?? '';
  return {
    schemaVersion: 1,
    id: 'manual-draft',
    title: source.title?.trim() || 'Manual policy draft',
    source: {
      title: source.title?.trim() || 'Pasted text',
      ...(source.url ? { url: source.url } : {}),
      ...(text ? { textSha256: sha256Hex(text) } : {}),
      excerptChars: text.length,
    },
    modelId: model.id,
    modelHash: modelHash(model),
    provisions: [],
    reviewStatus: 'author-drafted',
    ...(draftedBy ? { draftedBy } : {}),
  };
}

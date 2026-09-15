/**
 * Policy drafts — validate, turn into an overlay, and run paired against the baseline. Pure.
 *
 *   validateDraft(draft, model, { sourceText, overlays }) -> diagnostics
 *   coverage(draft, sourceText?)                          -> provision statuses, source-clause coverage,
 *                                                            completeness attestation
 *   draftToOverlay(draft, model, overlays)                -> Overlay (mapped provisions only, units converted)
 *   pairedRun(model, overlays, draft, { runs, seed, sourceText })
 *                                                         -> baseline vs policy, per-draw differences;
 *                                                            refuses to run a draft with validation errors
 *   pairedRunSteps(...)                                   -> the same, as a generator that yields after
 *                                                            each draw (the worker runner drives it)
 *
 * Draws are bounded by RUN_LIMITS.maxDraws (src/core/limits.ts): a request over it is refused with
 * `limit-exceeded` before anything runs. When neither side samples anything (no parameter declares a
 * range), the model is run once instead of N identical times and the result says `deterministic`.
 *
 * Validation governs execution: every diagnostic at level 'error' blocks pairedRun (and so the
 * panel's Run button, bundle reopening and link opening). Unresolved and outside-model provisions
 * are NOT errors — they run, and change nothing, and are listed as omitted.
 *
 * Honesty rules enforced here (spec section 8, review 2026-09-14 findings 4 and 5):
 *   - every provision has a status; unresolved and outside-model carry a reason;
 *   - quotes are verbatim (after whitespace normalisation) when the source text is available;
 *   - a mapping may only target things the model already has; it never rewrites an equation;
 *   - a mapped value's unit converts to the target's declared unit (src/policy/units.ts) or the
 *     draft does not run — "20 million usd" becomes 20,000,000, "20 people" into usd is an error;
 *   - setters do not contradict each other: two sets of one target must agree (after conversion); a
 *     set and an add on one input need the add to name the set it stacks on (`stacksOn`), and then
 *     sets apply first and adds on top, whatever the list order;
 *   - a 'coefficient' (how the world responds) is never supported by the policy's own text, and a
 *     coefficient without a real source is flagged so it is shown as an assumption;
 *   - "human-reviewed" names a reviewer who is not the drafter;
 *   - coverage is measured against the source text's own clause inventory (src/policy/clauses.ts),
 *     not against the draft's list, and completeness is claimed only by a named person's attestation.
 */

import { ENGINE_VERSION, budgetFor, currentBudget, drain, explainBinding, isDeterministic, resolveModel, runModel, type DrawProgress } from '../core/engine';
import { checkRunSettings, effectiveLimits } from '../core/limits';
import type { CoreModel, EvidenceKind, Input, Overlay, RunResult } from '../core/types';
import { sourceCoverage, type SourceCoverage } from './clauses';
import { contentHash, modelHash, sha256Hex } from './hash';
import {
  EXCLUSION_KINDS,
  PROVISION_ROLES,
  PROVISION_STATUSES,
  REVIEW_STATUSES,
  type CompletenessSummary,
  type Coverage,
  type DraftDiagnostic,
  type PairedRunResult,
  type PolicyDraft,
  type PolicyRunManifest,
  type Provision,
  type ProvisionMapping,
  type QuantileKey,
  type Quantiles,
} from './types';
import { describeConversion, isDimensionless, unitFactor } from './units';

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

/** Why an attestation does not count, or null when it does. */
export function attestationProblem(draft: Pick<PolicyDraft, 'completeness' | 'source'>): string | null {
  const a = draft.completeness;
  if (!a) return 'no attestation';
  if (a.kind !== 'person') return `only a named person can attest completeness; this attestation is by ${a.kind === 'ai' ? 'an AI' : 'a coding agent'} ("${a.name}")`;
  if (!a.name?.trim()) return 'the attestation does not name who made it';
  if (!a.date?.trim()) return 'the attestation has no date';
  if (!a.statement?.trim()) return 'the attestation has no statement';
  if (a.textSha256 && draft.source?.textSha256 && a.textSha256 !== draft.source.textSha256) return 'the attestation is of a different source text (SHA-256 differs)';
  return null;
}

export function completenessOf(draft: Pick<PolicyDraft, 'completeness' | 'source'>): CompletenessSummary {
  const problem = attestationProblem(draft);
  if (!problem) {
    const a = draft.completeness!;
    return { attested: true, text: `completeness attested by ${a.name} on ${a.date}`, attestation: a };
  }
  return {
    attested: false,
    text: draft.completeness ? `completeness not attested (the attestation on file does not count: ${problem})` : 'completeness not attested',
    ...(draft.completeness ? { attestation: draft.completeness } : {}),
  };
}

/**
 * Two separate claims, never merged:
 *   - every LISTED provision has a status (the draft's own list, which a drafter controls);
 *   - N of M source clauses are covered or explicitly excluded (M comes from the source text).
 * Without the source text, the second is "source unavailable — coverage unknown".
 */
export function coverage(draft: Pick<PolicyDraft, 'provisions'> & Partial<Pick<PolicyDraft, 'exclusions' | 'source' | 'completeness'>>, sourceText?: string): Coverage {
  const provisions = Array.isArray(draft?.provisions) ? draft.provisions : [];
  const total = provisions.length;
  const count = (s: string) => provisions.filter((p) => p?.status === s).length;
  const mapped = count('mapped');
  const unresolved = count('unresolved');
  const outsideModel = count('outside-model');
  const unaccounted = total - mapped - unresolved - outsideModel;
  const parts = [`${mapped} of ${total} provision${total === 1 ? '' : 's'} mapped`, `${unresolved} unresolved`, `${outsideModel} outside model`];
  if (unaccounted > 0) parts.push(`${unaccounted} with no status`);
  const allHaveStatus = total > 0 && unaccounted === 0;
  const src: SourceCoverage = sourceCoverage({ provisions, exclusions: draft.exclusions, source: draft.source as PolicyDraft['source'] }, sourceText);
  return {
    total,
    mapped,
    unresolved,
    outsideModel,
    unaccounted,
    allHaveStatus,
    text: total === 0 ? 'No provisions yet' : parts.join(', '),
    statusText:
      total === 0 ? 'no provisions listed' : allHaveStatus ? 'every listed provision has a status' : `${unaccounted} listed provision${unaccounted === 1 ? ' has' : 's have'} no status`,
    source: { status: src.status, inventoryVersion: src.inventoryVersion, clauses: src.clauses, covered: src.covered, excluded: src.excluded, uncovered: src.uncovered, text: src.text },
    completeness: completenessOf({ completeness: draft.completeness, source: draft.source as PolicyDraft['source'] }),
  };
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

export interface MappingUnits {
  ok: boolean;
  /** Multiply the mapping's value / curve / expression by this to get the target's unit. */
  factor: number;
  targetUnit?: string;
  /** "20 million usd → training_budget (usd): converted to 20,000,000" when a conversion happens. */
  conversion?: string;
  error?: { code: DraftDiagnostic['code']; message: string };
  warning?: string;
}

/**
 * The unit rule for one mapping against the scenario model:
 *   - multiply effects are dimensionless (a unit other than "", "1", "ratio", "factor" is an error);
 *   - when the target declares a unit, the mapping must say its unit, and it must convert;
 *   - when the target declares none, the mapping's unit (if any) must be dimensionless.
 */
export function mappingUnits(m: ProvisionMapping, resolved: CoreModel): MappingUnits {
  let targetUnit: string | undefined;
  if (m.kind === 'parameter') targetUnit = resolved.parameters.find((p) => p.id === m.target)?.unit;
  else if (m.kind === 'input') targetUnit = (resolved.inputs ?? []).find((i) => i.id === m.target)?.unit;
  else if (m.kind === 'effect') targetUnit = resolved.variables.find((v) => v.id === m.target)?.unit;
  const unit = typeof m.unit === 'string' ? m.unit.trim() : '';
  const tu = (targetUnit ?? '').trim();

  if (m.kind === 'effect' && m.op === 'multiply') {
    if (unit && !isDimensionless(unit)) return { ok: false, factor: 1, targetUnit, error: { code: 'unit-mismatch', message: `a multiplier is dimensionless, but the mapping says "${unit}"` } };
    return { ok: true, factor: 1, targetUnit };
  }
  if (!tu) {
    if (unit && !isDimensionless(unit)) return { ok: false, factor: 1, targetUnit, error: { code: 'unit-mismatch', message: `"${m.target}" declares no unit, so a value in "${unit}" cannot be checked or converted` } };
    return { ok: true, factor: 1, targetUnit };
  }
  if (!unit) return { ok: false, factor: 1, targetUnit, error: { code: 'unit-missing', message: `"${m.target}" is in ${tu}; the mapping must say what unit its value is in (it is converted, never assumed)` } };
  const conv = unitFactor(unit, tu, m.target, { step: resolved.time?.step, perStepTarget: m.kind !== 'parameter' });
  if (!conv.ok) {
    const lead = typeof m.value === 'number' && Number.isFinite(m.value) ? `${fmt(m.value)} ` : '';
    return { ok: false, factor: 1, targetUnit, error: { code: 'unit-mismatch', message: `${lead}${conv.message}` } };
  }
  let conversion: string | undefined;
  if (conv.factor !== 1) {
    if (m.kind === 'effect') conversion = `effect expression in ${unit} → ${m.target} (${tu}): multiplied by ${conv.factor}`;
    else if (typeof m.value === 'number' && Number.isFinite(m.value)) conversion = describeConversion(m.value, unit, tu, m.target, conv.factor);
    else conversion = `${unit} → ${m.target} (${tu}): every curve value multiplied by ${conv.factor}`;
  }
  return { ok: true, factor: conv.factor, targetUnit, ...(conversion ? { conversion } : {}), ...(conv.warning ? { warning: conv.warning } : {}) };
}

/** The curve an input 'set' mapping describes, in the target's unit. */
function setCurve(m: ProvisionMapping, factor: number, start: number): Record<string, number> | null {
  if (m.curve && typeof m.curve === 'object' && Object.keys(m.curve).length) return Object.fromEntries(Object.entries(m.curve).map(([k, v]) => [k, v * factor]));
  if (typeof m.value === 'number' && Number.isFinite(m.value)) return { [String(start)]: m.value * factor };
  return null;
}

const sameNumber = (a: number, b: number) => a === b || Math.abs(a - b) <= 1e-12 * Math.max(Math.abs(a), Math.abs(b));
const fmt = (x: number) => (Number.isFinite(x) ? x.toLocaleString('en-US', { maximumFractionDigits: 10 }) : String(x));

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
  if (draft.exclusions !== undefined && !Array.isArray(draft.exclusions)) push({ level: 'error', code: 'schema', message: 'exclusions must be a list.' });

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
  const sourceText = typeof opts.sourceText === 'string' && opts.sourceText.trim() ? opts.sourceText : undefined;
  let textMatches = false;
  if (sourceText !== undefined) {
    if (draft.source?.textSha256 && sha256Hex(sourceText) !== draft.source.textSha256) {
      push({ level: 'error', code: 'text-hash-mismatch', message: 'The source text supplied is not the text this draft was checked against (SHA-256 differs). Re-pin the draft to this text so its quotes are re-checked.' });
    } else textMatches = true;
  } else if (draft.provisions.length > 0) {
    push({ level: 'info', code: 'quote-unchecked', message: 'Source text not available here, so quotes were not re-checked and source coverage is unknown.' });
  }

  // -- provisions ---------------------------------------------------------------
  const { model: resolved } = resolveModel(model, opts.overlays ?? []);
  const params = new Map(resolved.parameters.map((p) => [p.id, p]));
  const inputs = new Map((resolved.inputs ?? []).map((i) => [i.id, i]));
  const variables = new Map(resolved.variables.map((v) => [v.id, v]));
  const unknowns = new Set((resolved.solves ?? []).map((s) => s.unknown));
  const known = new Set<string>([...params.keys(), ...inputs.keys(), ...variables.keys(), ...unknowns]);

  const seenIds = new Set<string>();
  const provisionIds = new Set(draft.provisions.filter(isObject).map((p) => String(p.id)));
  const targets = new Map<string, Array<{ p: Provision; factor: number; unitsOk: boolean }>>();

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
    else if (textMatches && !quoteInSource(p.quote, sourceText!)) at('error', 'quote-not-found', 'the quote is not found verbatim in the source text');

    if ((p.status === 'unresolved' || p.status === 'outside-model') && !p.reason?.trim()) {
      at('error', 'missing-reason', `a ${p.status} provision must say why, so the missing mechanism stays visible`);
    }

    // definitions and what they interpret
    if (p.interprets !== undefined) {
      if (!Array.isArray(p.interprets)) at('error', 'schema', 'interprets must be a list of provision ids');
      else for (const id of p.interprets) if (!provisionIds.has(String(id)) || id === pid) at('error', 'unknown-interprets', `interprets "${String(id)}", which is not another provision of this draft`);
    }
    if (p.role === 'definition' && !(Array.isArray(p.interprets) && p.interprets.length)) {
      at('warning', 'definition-unlinked', 'a definition should list the provisions whose reading it decides (interprets)');
    }

    if (p.status !== 'mapped') {
      if (p.mapping) at('info', 'mapping-ignored', 'has a mapping, but only mapped provisions change the run');
      continue;
    }

    // mapped
    if (!p.role) at('error', 'schema', 'a mapped provision needs a role (control, funding, constraint or coefficient)');
    if (p.role === 'definition') at('error', 'schema', 'a definition does not set anything itself; map the provisions it interprets instead');
    const m = p.mapping;
    if (!isObject(m)) { at('error', 'missing-mapping', 'mapped, but says nothing about what it sets'); continue; }
    if (!m.evidence?.label?.trim()) at('error', 'missing-source', 'the mapping needs an evidence label — "assumed: ..." is a valid one');

    let targetExists = false;
    if (m.kind === 'parameter') {
      targetExists = params.has(m.target);
      if (!targetExists) at('error', 'unknown-target', `"${m.target}" is not a parameter of ${model.id}`);
      if (m.op !== 'set') at('error', 'bad-op', 'a parameter mapping can only set a value');
      if (typeof m.value !== 'number' || !Number.isFinite(m.value)) at('error', 'bad-value', 'a parameter mapping needs a finite value');
    } else if (m.kind === 'input') {
      const input = inputs.get(m.target);
      targetExists = !!input;
      if (!input) at('error', 'unknown-target', `"${m.target}" is not an input of ${model.id}`);
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
      targetExists = !!v;
      if (!v) at('error', 'unknown-target', `"${m.target}" is not a variable of ${model.id}`);
      else if (v.hook === false) at('error', 'no-hook', `"${m.target}" does not accept effects`);
      if (m.op !== 'add' && m.op !== 'multiply') at('error', 'bad-op', 'an effect adds or multiplies');
      if (typeof m.expr !== 'string' || !m.expr.trim()) at('error', 'bad-value', 'an effect needs an expression');
      else for (const s of expressionSymbols(m.expr)) if (!known.has(s)) at('error', 'unknown-target', `the effect reads "${s}", which the model does not have`);
      if (p.role && p.role !== 'coefficient') at('warning', 'effect-not-coefficient', 'an effect changes how the model responds; its size is a coefficient, so mark the role "coefficient" and source it');
    } else {
      at('error', 'schema', `unknown mapping kind "${String((m as { kind?: unknown }).kind)}"`);
    }

    // units: convert or block
    let unitsOk = false;
    let factor = 1;
    if (targetExists) {
      const u = mappingUnits(m, resolved);
      unitsOk = u.ok;
      factor = u.factor;
      if (u.error) at('error', u.error.code, u.error.message);
      if (u.conversion) at('info', 'unit-converted', u.conversion);
      if (u.warning) at('warning', 'unit-assumed', u.warning);
    }

    // stacking
    if (m.stacksOn !== undefined) {
      const base = draft.provisions.find((x) => isObject(x) && x.id === m.stacksOn);
      if (m.kind !== 'input' || m.op !== 'add') at('error', 'bad-stack', 'only an input "add" can stack on another provision');
      else if (!base || base.status !== 'mapped' || base.mapping?.kind !== 'input' || base.mapping.op !== 'set' || base.mapping.target !== m.target) {
        at('error', 'bad-stack', `stacksOn "${String(m.stacksOn)}" must name a mapped provision that sets input "${m.target}"`);
      }
    }

    const key = `${m.kind}:${m.target}`;
    if (!targets.has(key)) targets.set(key, []);
    targets.get(key)!.push({ p, factor, unitsOk });

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

  // -- setters on one target --------------------------------------------------------
  for (const [key, list] of targets) {
    if (list.length < 2) continue;
    const ids = list.map((x) => x.p.id).join(', ');
    const [kind, target] = key.split(':');
    if (kind === 'effect') {
      push({ level: 'warning', code: 'duplicate-target', message: `${ids} all attach effects to "${target}"; they compose — check nothing is counted twice` });
      continue;
    }
    const sets = list.filter((x) => x.p.mapping?.op === 'set');
    const adds = list.filter((x) => x.p.mapping?.op === 'add');
    if (sets.length > 1 && sets.every((x) => x.unitsOk)) {
      const start = resolved.time.start;
      const shape = (x: (typeof sets)[number]) => (kind === 'parameter' ? { [String(start)]: (x.p.mapping!.value ?? NaN) * x.factor } : setCurve(x.p.mapping!, x.factor, start) ?? {});
      const first = shape(sets[0]);
      let conflict: string | null = null;
      for (const other of sets.slice(1)) {
        const c = shape(other);
        const years = [...new Set([...Object.keys(first), ...Object.keys(c)])].sort((a, b) => Number(a) - Number(b));
        const differs = years.find((y) => !(y in first) || !(y in c) || !sameNumber(first[y], c[y]));
        if (differs !== undefined) {
          const a = first[differs];
          const b = c[differs];
          conflict =
            kind === 'parameter'
              ? `${sets[0].p.id} sets ${fmt(a)} and ${other.p.id} sets ${fmt(b)}`
              : `in ${differs}, ${sets[0].p.id} sets ${a === undefined ? 'no value' : fmt(a)} and ${other.p.id} sets ${b === undefined ? 'no value' : fmt(b)}`;
          break;
        }
      }
      if (conflict) {
        push({ level: 'error', code: 'conflicting-setters', message: `${ids} set ${kind} "${target}" to different values (${conflict}, after unit conversion). Only one reading can run: mark the others unresolved and say why.` });
      } else {
        push({ level: 'warning', code: 'duplicate-target', message: `${sets.map((x) => x.p.id).join(', ')} set ${kind} "${target}" to the same value; it is applied once` });
      }
    }
    if (sets.length >= 1 && adds.length >= 1) {
      const setIds = new Set(sets.map((x) => x.p.id));
      const loose = adds.filter((x) => !setIds.has(String(x.p.mapping?.stacksOn)));
      if (loose.length) {
        push({
          level: 'error',
          code: 'set-add-ambiguous',
          message: `${loose.map((x) => x.p.id).join(', ')} add${loose.length === 1 ? 's' : ''} to input "${target}", which ${sets.map((x) => x.p.id).join(', ')} also set${sets.length === 1 ? 's' : ''}. Say whether the add is on top of that set: give it stacksOn "${sets[0].p.id}" (sets apply first, then adds), or mark one of them unresolved.`,
        });
      }
    }
    if (adds.length > 1) push({ level: 'warning', code: 'duplicate-target', message: `${adds.map((x) => x.p.id).join(', ')} all add to "${target}"; they are summed — check nothing is counted twice` });
  }

  // -- exclusions, coverage and completeness ---------------------------------------------
  const exclusions = Array.isArray(draft.exclusions) ? draft.exclusions : [];
  const seenClauses = new Set<string>();
  for (const [i, x] of exclusions.entries()) {
    const where = isObject(x) && typeof x.clauseId === 'string' && x.clauseId ? `exclusion ${x.clauseId}` : `exclusion #${i + 1}`;
    if (!isObject(x) || typeof x.clauseId !== 'string' || !x.clauseId.trim()) { push({ level: 'error', code: 'bad-exclusion', message: `${where}: needs the id of a source clause` }); continue; }
    if (seenClauses.has(x.clauseId)) push({ level: 'error', code: 'duplicate-exclusion', message: `${where}: the clause is excluded twice` });
    seenClauses.add(x.clauseId);
    if (!EXCLUSION_KINDS.includes(x.kind)) push({ level: 'error', code: 'bad-exclusion', message: `${where}: kind must be one of ${EXCLUSION_KINDS.join(', ')}` });
    if (typeof x.reason !== 'string' || !x.reason.trim()) push({ level: 'error', code: 'bad-exclusion', message: `${where}: an exclusion must say why` });
    if (x.interprets !== undefined) {
      if (!Array.isArray(x.interprets)) push({ level: 'error', code: 'schema', message: `${where}: interprets must be a list of provision ids` });
      else for (const id of x.interprets) if (!provisionIds.has(String(id))) push({ level: 'error', code: 'unknown-interprets', message: `${where}: interprets "${String(id)}", which is not a provision of this draft` });
    }
    if (x.kind === 'definition' && !(Array.isArray(x.interprets) && x.interprets.length)) {
      push({ level: 'warning', code: 'definition-unlinked', message: `${where}: a definition should list the provisions whose reading it decides (interprets)` });
    }
    if (x.duplicateOf !== undefined && !provisionIds.has(String(x.duplicateOf))) push({ level: 'error', code: 'unknown-interprets', message: `${where}: duplicateOf "${String(x.duplicateOf)}" is not a provision of this draft` });
    if (x.kind === 'duplicate' && x.duplicateOf === undefined) push({ level: 'warning', code: 'bad-exclusion', message: `${where}: a duplicate should name the provision that carries the content (duplicateOf)` });
  }

  if (textMatches) {
    const src = sourceCoverage(draft, sourceText);
    for (const id of src.unknownExclusions) push({ level: 'error', code: 'unknown-clause', message: `exclusion ${id}: the source text has no clause with that id (inventory ${src.inventoryVersion})` });
    for (const id of src.ambiguousQuotes) push({ level: 'warning', code: 'quote-ambiguous', message: `${id}: the quote occurs more than once in the source, so it cannot show which clause it covers — lengthen it`, provisionId: id });
    for (const d of src.detail.filter((c) => c.state === 'covered-and-excluded')) {
      push({ level: 'info', code: 'duplicate-exclusion', message: `exclusion ${d.id}: the clause is also quoted by ${d.provisions.join(', ')}` });
    }
    if (src.uncovered.length) {
      push({
        level: 'warning',
        code: 'coverage-incomplete',
        message: `${src.uncovered.length} of ${src.clauses} source clauses are neither quoted by a provision nor explicitly excluded: ${src.uncovered.slice(0, 8).join(', ')}${src.uncovered.length > 8 ? ` and ${src.uncovered.length - 8} more` : ''}`,
      });
    }
    if (draft.completeness && !attestationProblem(draft) && src.uncovered.length) {
      push({ level: 'warning', code: 'attestation', message: `completeness is attested, but ${src.uncovered.length} source clauses are uncovered — the attestation and the inventory disagree` });
    }
  }
  if (draft.completeness) {
    const problem = attestationProblem(draft);
    if (problem) push({ level: draft.completeness.kind === 'person' ? 'warning' : 'error', code: 'attestation', message: `completeness attestation: ${problem}` });
  }

  if (!draft.provisions.some((p) => p?.status === 'mapped')) {
    push({ level: 'info', code: 'nothing-mapped', message: 'No provision is mapped, so the policy run is identical to the baseline.' });
  }
  return out;
}

export function hasErrors(diagnostics: DraftDiagnostic[]): boolean {
  return diagnostics.some((d) => d.level === 'error');
}

/** The diagnostics that stop a draft from running. */
export function blockingErrors(diagnostics: DraftDiagnostic[]): DraftDiagnostic[] {
  return diagnostics.filter((d) => d.level === 'error');
}

// ---------------------------------------------------------------------------
// Draft -> overlay
// ---------------------------------------------------------------------------

/**
 * The overlay a draft's mapped provisions describe, on top of `overlays` (the scenario). Values are
 * converted to the target's unit. Sets apply before adds, whatever the list order. Mappings that
 * cannot be applied (unknown target, bad value, unconvertible unit) are skipped — validateDraft
 * reports them, and pairedRun refuses to run a draft with such errors.
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
  const mapped = (draft.provisions ?? []).filter((p) => p?.status === 'mapped' && p.mapping);
  const ordered = [...mapped.filter((p) => p.mapping!.op !== 'add' || p.mapping!.kind !== 'input'), ...mapped.filter((p) => p.mapping!.op === 'add' && p.mapping!.kind === 'input')];

  for (const p of ordered) {
    const m = p.mapping!;
    const units = mappingUnits(m, resolved);
    if (!units.ok) continue;
    const k = units.factor;
    const source = {
      ...m.evidence,
      note: [m.evidence?.note, `policy provision ${p.id}: "${normaliseWhitespace(p.quote).slice(0, 160)}"`, units.conversion].filter(Boolean).join(' — '),
    };
    if (m.kind === 'parameter' && m.op === 'set' && params.has(m.target) && Number.isFinite(m.value)) {
      if (overlay.parameters!.some((x) => x.id === m.target)) continue; // an identical duplicate (validated)
      overlay.parameters!.push({ id: m.target, value: (m.value as number) * k, range: undefined, source });
    } else if (m.kind === 'input' && inputs.has(m.target)) {
      const current = newInputs.get(m.target) ?? (JSON.parse(JSON.stringify(inputs.get(m.target))) as Input);
      if (m.op === 'set') {
        const curve = setCurve(m, k, resolved.time.start);
        if (!curve) continue;
        newInputs.set(m.target, { ...current, curve, byEntity: undefined, source });
      } else if (m.op === 'add' && Number.isFinite(m.value)) {
        const add = (m.value as number) * k;
        const shift = (c: Record<string, number>) => Object.fromEntries(Object.entries(c).map(([key, v]) => [key, v + add]));
        newInputs.set(m.target, {
          ...current,
          curve: shift(current.curve),
          byEntity: current.byEntity ? Object.fromEntries(Object.entries(current.byEntity).map(([e, c]) => [e, shift(c)])) : undefined,
          source: { ...source, note: `${source.note} — added to ${m.stacksOn ? `the curve set by ${m.stacksOn}` : `the scenario's own curve (${current.source?.label ?? 'no source'})`}` },
        });
      }
    } else if (m.kind === 'effect' && variables.has(m.target) && (m.op === 'add' || m.op === 'multiply') && m.expr?.trim()) {
      const expr = m.expr.trim();
      overlay.effects!.push({
        id: `${policyOverlayId(draft)}-${p.id}`,
        target: m.target,
        op: m.op,
        expr: m.op === 'add' && k !== 1 ? `(${expr}) * ${k}` : expr,
        unit: m.op === 'add' ? units.targetUnit || undefined : undefined,
        source,
        from: Number.isFinite(m.from) ? m.from : undefined,
      });
    }
  }
  overlay.inputs = [...newInputs.values()];
  return overlay;
}

/** Every unit conversion the draft's mappings apply, in words. */
export function conversionsOf(draft: PolicyDraft, model: CoreModel, overlays: Overlay[] = []): string[] {
  const { model: resolved } = resolveModel(model, overlays);
  return (draft.provisions ?? [])
    .filter((p) => p?.status === 'mapped' && p.mapping)
    .map((p) => {
      const u = mappingUnits(p.mapping!, resolved);
      return u.conversion ? `${p.id}: ${u.conversion}` : '';
    })
    .filter(Boolean);
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
  /** The source text, when available: quotes are re-checked and source coverage is measured. */
  sourceText?: string;
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
 *
 * A draft with validation errors does not run: the result is ok:false, `blocked` lists the errors,
 * and no engine run happens.
 */
export function pairedRun(model: CoreModel, overlays: Overlay[], draft: PolicyDraft, opts: PairedRunOptions = {}): PairedRunResult {
  return drain(pairedRunSteps(model, overlays, draft, opts));
}

/** pairedRun as a generator: yields { done, total } after each paired draw. */
export function* pairedRunSteps(model: CoreModel, overlays: Overlay[], draft: PolicyDraft, opts: PairedRunOptions = {}): Generator<DrawProgress, PairedRunResult, void> {
  const budget = currentBudget() ?? budgetFor(effectiveLimits().maxWallClockMs);
  const requested = Math.max(1, Math.floor(opts.runs ?? DEFAULT_RUNS));
  const overDraws = requested > effectiveLimits().maxDraws;
  let runs = overDraws ? 0 : requested;
  const seed = Math.floor(opts.seed ?? DEFAULT_SEED);
  const sourceText = typeof opts.sourceText === 'string' && opts.sourceText.trim() ? opts.sourceText : undefined;
  const diagnostics = validateDraft(draft, model, { overlays, sourceText });
  const blocked = blockingErrors(diagnostics);
  const policyOverlay = draftToOverlay(draft, model, overlays);
  const policyOverlays = [...overlays, policyOverlay];
  const cov = coverage(draft, sourceText);

  const manifest: PolicyRunManifest = {
    schema: 'policy-run/2',
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
    coverage: {
      total: cov.total,
      mapped: cov.mapped,
      unresolved: cov.unresolved,
      outsideModel: cov.outsideModel,
      allHaveStatus: cov.allHaveStatus,
      statusText: cov.statusText,
      source: { status: cov.source.status, inventoryVersion: cov.source.inventoryVersion, clauses: cov.source.clauses, covered: cov.source.covered, excluded: cov.source.excluded, uncovered: cov.source.uncovered.length, text: cov.source.text },
      completeness: cov.completeness.text,
    },
    exclusions: (Array.isArray(draft.exclusions) ? draft.exclusions : []).map((x) => ({ clauseId: x.clauseId, kind: x.kind, ...(x.interprets?.length ? { interprets: x.interprets } : {}) })),
    evidence: evidenceOf(draft),
    runs: requested,
    seed,
    draws: { count: runs, seed, firstIndex: 0 },
    conversions: conversionsOf(draft, model, overlays),
    baselineRunHash: '',
    policyRunHash: '',
    createdAt: (opts.now ?? (() => new Date().toISOString()))(),
  };

  const empty: PairedRunResult = {
    ok: false,
    errors: [],
    blocked: [],
    years: [],
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
  if (blocked.length) {
    return { ...empty, blocked, errors: [`the draft has ${blocked.length} validation error${blocked.length === 1 ? '' : 's'} and was not run`, ...blocked.map((d) => `[${d.code}] ${d.message}`)] };
  }
  if (overDraws) {
    return { ...empty, errors: [`[limit-exceeded] ${requested.toLocaleString('en-US')} draws requested; the limit is ${effectiveLimits().maxDraws.toLocaleString('en-US')} draws per run. Nothing was run.`] };
  }
  // Nothing sampled on either side: every draw would equal the point run, so run it once.
  const deterministic = isDeterministic(resolveModel(model, overlays).model) && isDeterministic(resolveModel(model, policyOverlays).model);
  if (deterministic) {
    runs = 1;
    manifest.draws = { count: 1, seed, firstIndex: 0, deterministic: true };
  }

  // Both resolved sides must fit before either point run allocates retained arrays.
  const resourceProblems = [resolveModel(model, overlays).model, resolveModel(model, policyOverlays).model]
    .flatMap(side => checkRunSettings({ model: side, runs, seed, sides: 3, ensemble: true }, currentBudget()?.limits));
  if (resourceProblems.length) return { ...empty, errors: resourceProblems.map(p => `[limit-exceeded] ${p.message}`) };

  const pointB = runModel(model, { overlays, budget });
  const pointP = runModel(model, { overlays: policyOverlays, budget });
  manifest.baselineRunHash = pointB.manifest.hash;
  manifest.policyRunHash = pointP.manifest.hash;
  empty.years = pointB.years;

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
    const b = runModel(model, { overlays, seed, run: r, budget });
    const p = runModel(model, { overlays: policyOverlays, seed, run: r, budget });
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
    yield { done: r + 1, total: runs };
  }

  const summarise = (d: Draws) =>
    Object.fromEntries(Object.entries(d).map(([e, byOut]) => [e, Object.fromEntries(Object.entries(byOut).map(([o, rows]) => [o, quantilesOf(rows, nY)]))]));
  const pick = (r: RunResult, keys: string[]) =>
    Object.fromEntries(entities.map((e) => [e, Object.fromEntries(keys.map((k) => [k, r.series[e]?.[k] ?? []]))]));

  return {
    ok: true,
    errors: [],
    blocked: [],
    years: pointB.years,
    entities: entities.length ? entities : [SINGLE],
    outputs,
    policyOnlyOutputs,
    runs,
    ...(deterministic ? { deterministic: true } : {}),
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

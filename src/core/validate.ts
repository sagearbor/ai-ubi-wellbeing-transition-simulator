/**
 * Authoring core — validation.
 *
 * Three layers, all pure (no I/O):
 *   1. JSON Schema (schemas/coreModel.schema.json, schemas/coreOverlay.schema.json) via ajv —
 *      shape, required fields, enums. `source` is required on every parameter and every effect.
 *   2. Engine diagnostics — compileModel (unknown symbols, cycles, unit mismatches, duplicate ids,
 *      disconnected variables, missing sources) plus one smoke run at point values, which is what
 *      surfaces run-time failures a static check cannot see: solve-no-root, non-finite, missing
 *      history, inputs asked for a year they do not cover.
 *   3. Evidence checks this file adds on top of the engine:
 *        wide-range     a p95/p5 wider than 20x, or a lognormal whose range touches or crosses zero.
 *                       The number is not an estimate, it is an interval spanning the answer.
 *        literal-bound  a numeric limit written into an equation (min(x, 1000)) with no parameter
 *                       and therefore no source, no range and no sweep. The classic fabricated cap.
 *        range-invalid  p5 > p95, or bounds given the wrong way round (error).
 *        out-of-bounds  the point value sits outside the parameter's own bounds (warning).
 *
 * The evidence summary counts parameters by source kind and lists the guessed/assumed ones so the
 * UI can say "N assumptions" before showing any result.
 */

import Ajv, { type ErrorObject } from 'ajv';
import { create, all, type MathNode } from 'mathjs';

import coreModelSchema from '../../schemas/coreModel.schema.json';
import coreOverlaySchema from '../../schemas/coreOverlay.schema.json';
import { compileModel, resolveModel, runModel } from './engine';
import type { CoreModel, Diagnostic, EvidenceKind, Overlay, Parameter, Range } from './types';

// ---------------------------------------------------------------------------
// ajv setup
// ---------------------------------------------------------------------------

const ajv = new Ajv({ allErrors: true, strict: false });

const MODEL_SCHEMA_ID = (coreModelSchema as { $id: string }).$id;
const OVERLAY_SCHEMA_ID = (coreOverlaySchema as { $id: string }).$id;
// addSchema throws if the same $id is registered twice (hot reload under vitest); guard it.
if (!ajv.getSchema(MODEL_SCHEMA_ID)) ajv.addSchema(coreModelSchema, MODEL_SCHEMA_ID);
if (!ajv.getSchema(OVERLAY_SCHEMA_ID)) ajv.addSchema(coreOverlaySchema, OVERLAY_SCHEMA_ID);

const validateModelSchema = ajv.getSchema(MODEL_SCHEMA_ID)!;
const validateOverlaySchema = ajv.getSchema(OVERLAY_SCHEMA_ID)!;

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of errors) {
    const extra = e.params && 'additionalProperty' in e.params ? ` ("${(e.params as { additionalProperty: string }).additionalProperty}")` : '';
    const msg = `schema: ${e.instancePath || '/'} ${e.message ?? 'is invalid'}${extra}`;
    if (!seen.has(msg)) { seen.add(msg); out.push(msg); }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Result shapes
// ---------------------------------------------------------------------------

/** Engine diagnostic codes plus the evidence codes this module adds. */
export type ValidationCode = Diagnostic['code'] | 'schema' | 'wide-range' | 'literal-bound' | 'range-invalid' | 'out-of-bounds';

export interface ValidationDiagnostic {
  level: 'error' | 'warning';
  code: ValidationCode;
  message: string;
  where?: string;
}

export interface EvidenceSummary {
  /** Number of parameters. */
  total: number;
  /** Parameters by source.kind; an omitted kind counts as 'assumed' (types.ts Source.kind default). */
  byKind: Record<EvidenceKind, number>;
  /** The 'guess' and 'assumed' parameters, in declaration order — the "N assumptions" list. */
  assumptions: Array<{ id: string; kind: EvidenceKind; label: string }>;
  /** assumptions.length, hoisted so a caller does not have to compute it. */
  assumptionCount: number;
  /** How many parameters declare a range. */
  ranged: number;
  /** Assumption ids with no range: a guess presented as an exact number. */
  unrangedAssumptions: string[];
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  /** The same findings with their codes, for callers that want to branch on one. */
  diagnostics: ValidationDiagnostic[];
  evidence: EvidenceSummary;
  /** Present when the schema passed, so a caller can keep working with a model that has warnings. */
  model?: CoreModel;
}

export interface OverlayValidationResult extends ValidationResult {
  overlay?: Overlay;
}

const EVIDENCE_KINDS: EvidenceKind[] = ['causal', 'associational', 'calibrated', 'elicited', 'assumed', 'guess'];

function emptyEvidence(): EvidenceSummary {
  const byKind = Object.fromEntries(EVIDENCE_KINDS.map((k) => [k, 0])) as Record<EvidenceKind, number>;
  return { total: 0, byKind, assumptions: [], assumptionCount: 0, ranged: 0, unrangedAssumptions: [] };
}

/** Counts of parameters by evidence kind, and the list of guessed/assumed ones. */
export function summariseEvidence(parameters: Parameter[]): EvidenceSummary {
  const ev = emptyEvidence();
  ev.total = parameters.length;
  for (const p of parameters) {
    const kind: EvidenceKind = p.source?.kind ?? 'assumed';
    if (EVIDENCE_KINDS.includes(kind)) ev.byKind[kind] += 1;
    if (p.range) ev.ranged += 1;
    if (kind === 'guess' || kind === 'assumed') {
      ev.assumptions.push({ id: p.id, kind, label: p.source?.label ?? '(no label)' });
      if (!p.range) ev.unrangedAssumptions.push(p.id);
    }
  }
  ev.assumptionCount = ev.assumptions.length;
  return ev;
}

// ---------------------------------------------------------------------------
// Evidence checks the engine does not make
// ---------------------------------------------------------------------------

/** How many times wider than its low end a range may be before it is called out. */
export const WIDE_RANGE_RATIO = 20;

function rangeFindings(p: Parameter, range: Range): ValidationDiagnostic[] {
  const out: ValidationDiagnostic[] = [];
  if (range.p5 > range.p95) {
    out.push({ level: 'error', code: 'range-invalid', message: `parameter "${p.id}" has p5 (${range.p5}) above p95 (${range.p95})`, where: p.id });
    return out;
  }
  if (range.dist === 'lognormal' && range.p5 <= 0) {
    out.push({
      level: 'warning',
      code: 'wide-range',
      message: `parameter "${p.id}" is lognormal but its range reaches ${range.p5}; a lognormal cannot cross or touch zero, so the drawn values will not be the range you wrote`,
      where: p.id,
    });
    return out;
  }
  // A ratio only means something when both ends sit on the same side of zero.
  if (range.p5 > 0 && range.p95 > 0) {
    const ratio = range.p95 / range.p5;
    if (ratio > WIDE_RANGE_RATIO) {
      out.push({
        level: 'warning',
        code: 'wide-range',
        message: `parameter "${p.id}" has p95/p5 = ${ratio.toPrecision(3)}x (${range.p5} to ${range.p95}); a band that wide is a statement that the value is unknown, not an estimate — say so beside any result that moves with it`,
        where: p.id,
      });
    }
  } else if (range.p5 < 0 && range.p95 < 0) {
    const ratio = range.p5 / range.p95;
    if (ratio > WIDE_RANGE_RATIO) {
      out.push({ level: 'warning', code: 'wide-range', message: `parameter "${p.id}" spans ${ratio.toPrecision(3)}x (${range.p5} to ${range.p95})`, where: p.id });
    }
  }
  return out;
}

function boundsFindings(p: Parameter): ValidationDiagnostic[] {
  if (!p.bounds) return [];
  const [lo, hi] = p.bounds;
  if (lo > hi) return [{ level: 'error', code: 'range-invalid', message: `parameter "${p.id}" has bounds [${lo}, ${hi}] the wrong way round`, where: p.id }];
  if (p.value < lo || p.value > hi) {
    return [{ level: 'warning', code: 'out-of-bounds', message: `parameter "${p.id}" has value ${p.value} outside its own bounds [${lo}, ${hi}]; it will be clamped`, where: p.id }];
  }
  return [];
}

// --- literal bounds -------------------------------------------------------

const literalMath = create(all, {});
const LAG_RE = /\b([A-Za-z_]\w*)\s*\[\s*t\s*-\s*(\d+)\s*\]/g;
/** Limits that are structural rather than empirical: a share cannot leave [0, 1], a count cannot go negative. */
const INNOCENT_LITERALS = new Set([0, 1, -1]);
const CAPPING_FUNCTIONS = new Set(['min', 'max', 'clamp']);

/**
 * Find numeric caps written directly into an expression: `min(x, 1000)`, `clamp(x, 0, 250)`.
 * Such a number has no id, so it has no source, no range, and no sweep can move it — it is
 * invisible to every other check in this file. 0, 1 and -1 are exempt as structural limits.
 */
export function findLiteralBounds(expr: string): Array<{ fn: string; literal: number; text: string }> {
  const rewritten = expr.replace(LAG_RE, (_m, name: string, k: string) => `${name}__lag${k}`);
  let root: MathNode;
  try {
    root = literalMath.parse(rewritten);
  } catch {
    return []; // a parse error is the engine's to report
  }
  const found: Array<{ fn: string; literal: number; text: string }> = [];
  root.traverse((n: MathNode) => {
    if (n.type !== 'FunctionNode') return;
    const fn = (n as unknown as { fn?: { name?: string } }).fn?.name;
    const args = (n as unknown as { args: MathNode[] }).args;
    if (!fn || !CAPPING_FUNCTIONS.has(fn) || !args || args.length < 2) return;
    for (const arg of args) {
      let hasSymbol = false;
      arg.traverse((a: MathNode) => { if (a.type === 'SymbolNode') hasSymbol = true; });
      if (hasSymbol) continue;
      let v: number;
      try { v = Number(arg.evaluate({})); } catch { continue; }
      if (!Number.isFinite(v) || INNOCENT_LITERALS.has(v)) continue;
      found.push({ fn, literal: v, text: arg.toString() });
    }
  });
  return found;
}

/**
 * compileModel claims parameter, input, variable and solve-*unknown* ids, but not effect ids or
 * solve block ids. Two effects sharing an id inside one model therefore both apply and the total
 * is counted twice with nothing said — the double-applied effect from the adversarial list. The
 * engine catches it across an overlay boundary (resolveModel) but not within a single file, so the
 * within-file check lives here. See adversarial.test.ts, "double-applied effect".
 */
function duplicateIdFindings(model: CoreModel): ValidationDiagnostic[] {
  const out: ValidationDiagnostic[] = [];
  const check = (items: Array<{ id: string }>, what: string, consequence: string) => {
    const seen = new Set<string>();
    for (const it of items) {
      if (seen.has(it.id)) out.push({ level: 'error', code: 'duplicate-id', message: `${what} "${it.id}" is declared twice; ${consequence}`, where: it.id });
      seen.add(it.id);
    }
  };
  check(model.effects ?? [], 'effect', 'both copies apply, so its contribution is counted twice');
  check(model.solves ?? [], 'solve block', 'the later block silently shadows the earlier one');
  return out;
}

function literalBoundFindings(model: CoreModel): ValidationDiagnostic[] {
  const out: ValidationDiagnostic[] = [];
  const scan = (where: string, kind: string, expr: string) => {
    for (const hit of findLiteralBounds(expr)) {
      out.push({
        level: 'warning',
        code: 'literal-bound',
        message: `${kind} "${where}" caps its value with ${hit.fn}(..., ${hit.text}): a numeric limit with no parameter and no source. Promote ${hit.literal} to a parameter so it can be sourced, ranged and swept, or say in the model's scope why the limit is structural`,
        where,
      });
    }
  };
  for (const v of model.variables) scan(v.id, 'variable', v.equation);
  for (const e of model.effects ?? []) scan(e.id, 'effect', e.expr);
  for (const s of model.solves ?? []) scan(s.id, 'solve', s.residual);
  return out;
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

function toDiag(d: Diagnostic): ValidationDiagnostic {
  return { level: d.level, code: d.code, message: d.message, where: d.where };
}

function render(d: ValidationDiagnostic): string {
  return `${d.code}: ${d.message}`;
}

/** compileModel diagnostics + a smoke run at point values, deduplicated. */
function engineFindings(model: CoreModel): ValidationDiagnostic[] {
  const compiled = compileModel(model);
  const found = compiled.diagnostics.map(toDiag);
  const hasError = found.some((d) => d.level === 'error');
  if (!hasError) {
    // The run is where solve-no-root, non-finite and missing-history appear; a static check cannot see them.
    const run = runModel(model);
    const seen = new Set(found.map((d) => `${d.code}|${d.message}`));
    for (const d of run.diagnostics) {
      const key = `${d.code}|${d.message}`;
      if (!seen.has(key)) { seen.add(key); found.push(toDiag(d)); }
    }
  }
  return found;
}

function assemble(model: CoreModel | undefined, diagnostics: ValidationDiagnostic[], evidence: EvidenceSummary): Omit<ValidationResult, 'model'> {
  const errors = diagnostics.filter((d) => d.level === 'error').map(render);
  const warnings = diagnostics.filter((d) => d.level === 'warning').map(render);
  return { ok: errors.length === 0 && model !== undefined, errors, warnings, diagnostics, evidence };
}

/**
 * Validate one model file. `ok` means it is safe to run; warnings are evidence problems the author
 * should answer for, not reasons to refuse.
 */
export function validateCoreModel(json: unknown): ValidationResult {
  if (!validateModelSchema(json)) {
    return { ok: false, errors: formatAjvErrors(validateModelSchema.errors), warnings: [], diagnostics: formatAjvErrors(validateModelSchema.errors).map((m) => ({ level: 'error' as const, code: 'schema' as const, message: m })), evidence: emptyEvidence() };
  }
  const model = json as CoreModel;
  const diagnostics: ValidationDiagnostic[] = [...duplicateIdFindings(model), ...engineFindings(model)];
  for (const p of model.parameters) {
    if (p.range) diagnostics.push(...rangeFindings(p, p.range));
    diagnostics.push(...boundsFindings(p));
  }
  diagnostics.push(...literalBoundFindings(model));
  const evidence = summariseEvidence(model.parameters);
  const base = assemble(model, diagnostics, evidence);
  return { ...base, ok: base.errors.length === 0, model };
}

/**
 * Validate an overlay against the base model it is meant to sit on. Checks the overlay's own shape,
 * then resolves it onto the base (which is what rejects an equation rewrite or a doubled effect) and
 * validates the combined model. The evidence summary covers the overlay's own parameters, so the UI
 * can say how many assumptions the overlay itself adds.
 */
export function validateOverlay(base: CoreModel, json: unknown): OverlayValidationResult {
  if (!validateOverlaySchema(json)) {
    const errs = formatAjvErrors(validateOverlaySchema.errors);
    return { ok: false, errors: errs, warnings: [], diagnostics: errs.map((m) => ({ level: 'error' as const, code: 'schema' as const, message: m })), evidence: emptyEvidence() };
  }
  const overlay = json as Overlay;
  const { model, diagnostics: resolveDiags } = resolveModel(base, [overlay]);
  const diagnostics: ValidationDiagnostic[] = resolveDiags.map(toDiag);
  if (!diagnostics.some((d) => d.level === 'error')) {
    diagnostics.push(...duplicateIdFindings(model));
    diagnostics.push(...engineFindings(model));
    for (const p of model.parameters) {
      if (p.range) diagnostics.push(...rangeFindings(p, p.range));
      diagnostics.push(...boundsFindings(p));
    }
    diagnostics.push(...literalBoundFindings(model));
  }
  // Evidence for the overlay's own parameters, resolved against the base so patches count once.
  const ownIds = new Set((overlay.parameters ?? []).map((p) => p.id));
  const evidence = summariseEvidence(model.parameters.filter((p) => ownIds.has(p.id)));
  const assembled = assemble(model, diagnostics, evidence);
  return { ...assembled, ok: assembled.errors.length === 0, model, overlay };
}

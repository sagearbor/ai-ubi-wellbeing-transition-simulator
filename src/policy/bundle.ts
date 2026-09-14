/**
 * Share links and downloadable bundles for policy drafts. Pure; nothing here throws on bad input.
 *
 * Link  (`#lab=<base64url JSON>`): the model id + version hash, the engine version, the scenario
 *        overlays, one or two drafts, the draw count and seed. Results are not in the link — opening
 *        it re-runs them. It never carries the model file itself or the source text: a link made
 *        for a model or engine version this app does not have reports that, instead of silently
 *        opening against a different baseline; and its source coverage is "source unavailable —
 *        coverage unknown".
 * Bundle (downloaded JSON): manifest (engine version, model hash, draws, seed, coverage and
 *        completeness status), draft, optional source text, scenario overlays, the derived policy
 *        overlay, the results and the tolerance they must reproduce within. reopenBundle re-runs it
 *        and says whether it reproduced, and if not, where and by how much. A bundle made on a model
 *        the app does not ship (one imported into the Lab) carries the model itself in `model`, with
 *        `modelStatus: "experimental — not curated"`, so it reopens anywhere; the opener validates
 *        that model and passes it to reopenBundle through the registry.
 *
 * Validation governs both: a draft with validation errors is never run from a link or a bundle —
 * the link does not open and the bundle reports "cannot open", each with the errors.
 */

import { ENGINE_VERSION } from '../core/engine';
import type { CoreModel, Overlay } from '../core/types';
import { contentHash, modelHash } from './hash';
import { blockingErrors, draftToOverlay, pairedRun, QUANTILE_KEYS, validateDraft } from './draft';
import type { DraftDiagnostic, PairedRunResult, PolicyDraft, PolicyRunManifest, Quantiles } from './types';

export const LAB_HASH_PREFIX = '#lab=';
export const LAB_LINK_VERSION = 2;
export const BUNDLE_SCHEMA = 'policy-bundle/2';
export const RUN_MANIFEST_SCHEMA = 'policy-run/2';
/** Links longer than this are refused by the encoder's caller: download a bundle instead. */
export const MAX_LINK_PAYLOAD_CHARS = 120_000;

/** Models the app can open, by id. */
export type ModelRegistry = (id: string) => CoreModel | undefined;

// ---------------------------------------------------------------------------
// base64url, UTF-8 safe (same approach as src/futures/share.ts)
// ---------------------------------------------------------------------------

function utf8ToBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUtf8(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

// ---------------------------------------------------------------------------
// Link
// ---------------------------------------------------------------------------

export interface LabLinkState {
  v: 2;
  modelId: string;
  modelHash: string;
  /** The numerical engine the link was made with (src/core/engine.ts ENGINE_VERSION). */
  engineVersion: string;
  /** Scenario overlays both sides share, in order. */
  overlays: Overlay[];
  /** Draft A, and optionally draft B, both on the same baseline. */
  drafts: PolicyDraft[];
  runs: number;
  seed: number;
}

export type Decoded<T> = { ok: true; value: T; reason?: undefined } | { ok: false; reason: string; value?: undefined };

export function encodeLabLink(state: LabLinkState): string {
  return utf8ToBase64Url(JSON.stringify(state));
}

export function buildLabShareUrl(state: LabLinkState, origin: string, pathname: string): string {
  return `${origin}${pathname}${LAB_HASH_PREFIX}${encodeLabLink(state)}`;
}

/** Decode a `#lab=` payload. Never throws; every failure says what is wrong. */
export function decodeLabLink(payload: string): Decoded<LabLinkState> {
  if (typeof payload !== 'string' || !payload.trim()) return { ok: false, reason: 'the link has no scenario data after #lab=' };
  const text = payload.trim();
  if (text.length > MAX_LINK_PAYLOAD_CHARS * 2) return { ok: false, reason: 'the link is too large to be a lab link' };
  if (!/^[A-Za-z0-9\-_]+$/.test(text)) return { ok: false, reason: 'the link data is not base64url (it may have been cut off or edited)' };
  let json: string;
  try {
    json = base64UrlToUtf8(text);
  } catch {
    return { ok: false, reason: 'the link data does not decode (it may have been cut off)' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'the link data is not valid JSON (it may have been cut off)' };
  }
  if (!isObject(parsed)) return { ok: false, reason: 'the link data is not a scenario object' };
  if (parsed.v === 1) return { ok: false, reason: 'this is a version 1 lab link, made before links recorded the engine version, so its results cannot be reproduced reliably; it was not opened' };
  if (parsed.v !== LAB_LINK_VERSION) return { ok: false, reason: `unsupported lab link version ${JSON.stringify(parsed.v ?? null)}; this app reads version ${LAB_LINK_VERSION}` };
  if (typeof parsed.modelId !== 'string' || !parsed.modelId) return { ok: false, reason: 'the link does not say which model it was made for' };
  if (typeof parsed.modelHash !== 'string' || !parsed.modelHash) return { ok: false, reason: 'the link does not pin a model version' };
  if (typeof parsed.engineVersion !== 'string' || !parsed.engineVersion) return { ok: false, reason: 'the link does not record the engine version it was made with' };
  if (!Array.isArray(parsed.overlays) || !parsed.overlays.every((o) => isObject(o) && typeof o.id === 'string')) return { ok: false, reason: 'the link\'s scenario overlays are malformed' };
  if (!Array.isArray(parsed.drafts) || parsed.drafts.length === 0 || parsed.drafts.length > 2 || !parsed.drafts.every(isObject)) return { ok: false, reason: 'the link must carry one or two policy drafts' };
  const runs = Number(parsed.runs);
  const seed = Number(parsed.seed);
  if (!Number.isInteger(runs) || runs < 1 || runs > 10_000) return { ok: false, reason: 'the link has an invalid number of runs' };
  if (!Number.isInteger(seed)) return { ok: false, reason: 'the link has an invalid seed' };
  return {
    ok: true,
    value: { v: 2, modelId: parsed.modelId, modelHash: parsed.modelHash, engineVersion: parsed.engineVersion, overlays: parsed.overlays as Overlay[], drafts: parsed.drafts as unknown as PolicyDraft[], runs, seed },
  };
}

/** null when the hash is not a lab link at all; otherwise the decode result. Never throws. */
export function parseLabHash(hash: string): Decoded<LabLinkState> | null {
  if (typeof hash !== 'string' || !hash) return null;
  const withHash = hash.startsWith('#') ? hash : `#${hash}`;
  if (!withHash.startsWith(LAB_HASH_PREFIX)) return null;
  return decodeLabLink(withHash.slice(LAB_HASH_PREFIX.length).split('&')[0]);
}

export interface OpenedScenario {
  model: CoreModel;
  overlays: Overlay[];
  drafts: PolicyDraft[];
  runs: number;
  seed: number;
  /** Validation of each draft against the model (quotes unchecked and coverage unknown: links carry no source text). */
  diagnostics: DraftDiagnostic[][];
}

function engineProblem(recorded: unknown): string | null {
  if (recorded === ENGINE_VERSION) return null;
  return `it was made with engine ${JSON.stringify(recorded ?? null)}, but this app runs engine ${ENGINE_VERSION}. The numbers would not be reproducible, so it was not opened (the engine version is part of a run's identity, like the model version).`;
}

function modelProblem(modelId: string, pinned: string, registry: ModelRegistry): { model: CoreModel } | { reason: string } {
  const model = registry(modelId);
  if (!model) return { reason: `it was made for model "${modelId}", which this version of the app does not include` };
  const have = modelHash(model);
  if (have !== pinned) {
    return {
      reason: `it was made for "${modelId}" version ${pinned}, but this app has version ${have}. Opening it would silently use a different baseline, so it was not opened.`,
    };
  }
  return { model };
}

/** Resolve a decoded link against the models this app has. */
export function openLabLink(state: LabLinkState, registry: ModelRegistry): Decoded<OpenedScenario> {
  const engine = engineProblem(state.engineVersion);
  if (engine) return { ok: false, reason: engine };
  const m = modelProblem(state.modelId, state.modelHash, registry);
  if ('reason' in m) return { ok: false, reason: m.reason };
  for (const d of state.drafts) {
    if (d.modelId !== state.modelId || d.modelHash !== state.modelHash) {
      return { ok: false, reason: `draft "${String(d.id)}" pins model ${String(d.modelId)} ${String(d.modelHash)}, not the link's ${state.modelId} ${state.modelHash}` };
    }
  }
  const diagnostics = state.drafts.map((d) => validateDraft(d, m.model, { overlays: state.overlays }));
  const broken = diagnostics.findIndex((ds) => blockingErrors(ds).length > 0);
  if (broken >= 0) {
    const errs = blockingErrors(diagnostics[broken]);
    return {
      ok: false,
      reason: `draft ${broken + 1} ("${String(state.drafts[broken]?.id)}") has ${errs.length} validation error${errs.length === 1 ? '' : 's'}, so it cannot run: ${errs.map((x) => `[${x.code}] ${x.message}`).join('; ')}`,
    };
  }
  return { ok: true, value: { model: m.model, overlays: state.overlays, drafts: state.drafts, runs: state.runs, seed: state.seed, diagnostics } };
}

// ---------------------------------------------------------------------------
// Bundle
// ---------------------------------------------------------------------------

export interface Tolerance {
  /** |expected - actual| <= absolute + relative * max(|expected|, |actual|) */
  absolute: number;
  relative: number;
  note: string;
}

export const DEFAULT_TOLERANCE: Tolerance = {
  absolute: 1e-9,
  relative: 1e-9,
  note: 'The engine is deterministic: same model version, overlays, draft, seed and runs give the same numbers. The tolerance only absorbs floating-point formatting through JSON.',
};

export interface BundleResults {
  years: number[];
  entities: string[];
  outputs: string[];
  policyOnlyOutputs: string[];
  baseline: Record<string, Record<string, Quantiles>>;
  policy: Record<string, Record<string, Quantiles>>;
  difference: Record<string, Record<string, Quantiles>>;
}

export const EXPERIMENTAL_MODEL_STATUS = 'experimental — not curated';

export interface PolicyBundle {
  schema: typeof BUNDLE_SCHEMA;
  manifest: PolicyRunManifest;
  /** The model itself, when it is not one the app ships (an imported model). Its hash is manifest.modelHash. */
  model?: CoreModel;
  /** Present with `model`: an embedded model is never curated. */
  modelStatus?: typeof EXPERIMENTAL_MODEL_STATUS;
  draft: PolicyDraft;
  /** Present when the bundle was made with the source text, so quotes can be re-checked. */
  sourceText?: string;
  overlays: Overlay[];
  policyOverlay: Overlay;
  results: BundleResults;
  tolerance: Tolerance;
}

export function buildBundle(
  model: CoreModel,
  overlays: Overlay[],
  draft: PolicyDraft,
  result: PairedRunResult,
  opts: { sourceText?: string; tolerance?: Tolerance; embedModel?: boolean } = {},
): PolicyBundle {
  return {
    schema: BUNDLE_SCHEMA,
    manifest: result.manifest,
    ...(opts.embedModel ? { model, modelStatus: EXPERIMENTAL_MODEL_STATUS } : {}),
    draft,
    ...(opts.sourceText ? { sourceText: opts.sourceText } : {}),
    overlays,
    policyOverlay: draftToOverlay(draft, model, overlays),
    results: {
      years: result.years,
      entities: result.entities,
      outputs: result.outputs,
      policyOnlyOutputs: result.policyOnlyOutputs,
      baseline: result.baseline,
      policy: result.policy,
      difference: result.difference,
    },
    tolerance: opts.tolerance ?? DEFAULT_TOLERANCE,
  };
}

export function bundleFileName(bundle: Pick<PolicyBundle, 'draft' | 'manifest'>): string {
  const slug = String(bundle.draft?.id ?? 'policy').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'policy';
  return `${slug}-${bundle.manifest?.modelId ?? 'model'}-${bundle.manifest?.modelHash ?? ''}.policy.json`;
}

/** Parse an uploaded bundle file. Never throws. */
export function parseBundleJson(text: string): Decoded<PolicyBundle> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, reason: `not valid JSON: ${(e as Error).message}` };
  }
  if (!isObject(parsed)) return { ok: false, reason: 'the file is not a JSON object' };
  if (parsed.schema !== BUNDLE_SCHEMA) return { ok: false, reason: `unsupported bundle schema ${JSON.stringify(parsed.schema ?? null)}; this app reads ${BUNDLE_SCHEMA}` };
  for (const key of ['manifest', 'draft', 'policyOverlay', 'results', 'tolerance']) {
    if (!isObject(parsed[key])) return { ok: false, reason: `the bundle is missing "${key}"` };
  }
  if (!Array.isArray(parsed.overlays)) return { ok: false, reason: 'the bundle is missing "overlays"' };
  if (parsed.model !== undefined && !isObject(parsed.model)) return { ok: false, reason: 'the bundle\'s embedded "model" is not an object' };
  const tol = parsed.tolerance as Record<string, unknown>;
  if (!(typeof tol.absolute === 'number' && tol.absolute >= 0) || !(typeof tol.relative === 'number' && tol.relative >= 0)) {
    return { ok: false, reason: 'the bundle does not declare a valid tolerance' };
  }
  return { ok: true, value: parsed as unknown as PolicyBundle };
}

export interface ReopenReport {
  status: 'reproduced' | 'not-reproduced' | 'cannot-open';
  /** Why it could not open, or what did not reproduce. */
  errors: string[];
  warnings: string[];
  /** Validation of the bundled draft (with its source text when the bundle carries it). */
  draftDiagnostics: DraftDiagnostic[];
  model?: CoreModel;
  overlays?: Overlay[];
  draft?: PolicyDraft;
  rerun?: PairedRunResult;
  /** Values compared and the largest deviation found. */
  compared: number;
  maxAbsDiff: number;
  worst?: { side: 'baseline' | 'policy' | 'difference'; entity: string; output: string; quantile: string; year: number; expected: number | null; actual: number };
  tolerance?: Tolerance;
}

const asNumber = (x: unknown): number => (typeof x === 'number' ? x : NaN);

/** Re-run a bundle and check it reproduces within its declared tolerance. */
export function reopenBundle(bundle: PolicyBundle, registry: ModelRegistry): ReopenReport {
  const report: ReopenReport = { status: 'cannot-open', errors: [], warnings: [], draftDiagnostics: [], compared: 0, maxAbsDiff: 0 };
  if (!isObject(bundle) || bundle.schema !== BUNDLE_SCHEMA) {
    report.errors.push(`unsupported bundle schema ${JSON.stringify((bundle as { schema?: unknown })?.schema ?? null)}; this app reads ${BUNDLE_SCHEMA}`);
    return report;
  }
  const { manifest, draft } = bundle;
  if (!isObject(manifest) || manifest.schema !== RUN_MANIFEST_SCHEMA) {
    report.errors.push(`unsupported run manifest ${JSON.stringify((manifest as { schema?: unknown })?.schema ?? null)}`);
    return report;
  }
  const m = modelProblem(manifest.modelId, manifest.modelHash, registry);
  if ('reason' in m) {
    report.errors.push(`Cannot open: ${m.reason}`);
    return report;
  }
  const engine = engineProblem(manifest.engineVersion);
  if (engine) {
    report.errors.push(`Cannot open: ${engine}`);
    return report;
  }
  const model = m.model;
  report.model = model;
  report.tolerance = bundle.tolerance;
  if (!isObject(draft) || contentHash(draft) !== manifest.draftHash) {
    report.errors.push('the draft in the bundle is not the draft the results were computed from (its hash differs from the manifest)');
    return report;
  }
  if (draft.modelId !== manifest.modelId || draft.modelHash !== manifest.modelHash) {
    report.errors.push(`the draft pins ${String(draft.modelId)} ${String(draft.modelHash)}, but the manifest says ${manifest.modelId} ${manifest.modelHash}`);
    return report;
  }
  const overlays = Array.isArray(bundle.overlays) ? bundle.overlays : [];
  const hashes = overlays.map((o) => ({ id: o.id, hash: contentHash(o) }));
  if (contentHash(hashes) !== contentHash(manifest.baselineOverlays ?? [])) {
    report.errors.push('the scenario overlays in the bundle are not the ones the manifest records');
    return report;
  }
  const derived = draftToOverlay(draft, model, overlays);
  if (contentHash(derived) !== manifest.policyOverlayHash || contentHash(bundle.policyOverlay) !== manifest.policyOverlayHash) {
    report.errors.push('the policy overlay does not match what this draft produces on this model; the bundle was edited or made by an incompatible version');
    return report;
  }
  report.overlays = overlays;
  report.draft = draft;
  const sourceText = typeof bundle.sourceText === 'string' ? bundle.sourceText : undefined;
  report.draftDiagnostics = validateDraft(draft, model, { overlays, sourceText });
  const blocking = blockingErrors(report.draftDiagnostics);
  if (blocking.length) {
    report.errors.push(`Cannot open: the bundled draft has ${blocking.length} validation error${blocking.length === 1 ? '' : 's'}, so it is not run: ${blocking.map((x) => `[${x.code}] ${x.message}`).join('; ')}`);
    return report;
  }
  if (!sourceText) report.warnings.push('The bundle carries no source text: quotes were not re-checked, and source coverage is unknown.');

  const rerun = pairedRun(model, overlays, draft, { runs: manifest.runs, seed: manifest.seed, sourceText });
  report.rerun = rerun;
  if (!rerun.ok) {
    report.status = 'not-reproduced';
    report.errors.push(...rerun.errors.map((e) => `re-run failed: ${e}`));
    return report;
  }

  const expected = bundle.results;
  const tol = bundle.tolerance;
  const within = (a: number, b: number) => {
    if (!Number.isFinite(a) && !Number.isFinite(b)) return true;
    return Math.abs(a - b) <= tol.absolute + tol.relative * Math.max(Math.abs(a), Math.abs(b));
  };
  if (canonicalYears(expected?.years) !== canonicalYears(rerun.years)) {
    report.status = 'not-reproduced';
    report.errors.push('the time steps differ from the bundled results');
    return report;
  }
  const sides: Array<'baseline' | 'policy' | 'difference'> = ['baseline', 'policy', 'difference'];
  const missing: string[] = [];
  let failures = 0;
  for (const side of sides) {
    const want = expected?.[side] ?? {};
    const got = rerun[side];
    for (const entity of Object.keys(got)) {
      for (const output of Object.keys(got[entity])) {
        const w = want[entity]?.[output];
        if (!w) { missing.push(`${side} ${entity}/${output}`); continue; }
        for (const q of QUANTILE_KEYS) {
          const ws = Array.isArray(w[q]) ? w[q] : [];
          got[entity][output][q].forEach((actual, t) => {
            const exp = asNumber(ws[t]);
            report.compared += 1;
            const dev = Number.isFinite(exp) && Number.isFinite(actual) ? Math.abs(exp - actual) : Number.isFinite(exp) || Number.isFinite(actual) ? Infinity : 0;
            if (dev > report.maxAbsDiff) {
              report.maxAbsDiff = dev;
              report.worst = { side, entity, output, quantile: q, year: rerun.years[t], expected: Number.isFinite(exp) ? exp : null, actual };
            }
            if (!within(exp, actual)) failures += 1;
          });
        }
      }
    }
  }
  if (missing.length) {
    report.status = 'not-reproduced';
    report.errors.push(`the bundle has no stored results for ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` and ${missing.length - 5} more` : ''}`);
    return report;
  }
  if (failures > 0) {
    report.status = 'not-reproduced';
    const w = report.worst!;
    report.errors.push(
      `${failures} of ${report.compared} values are outside the declared tolerance (absolute ${tol.absolute}, relative ${tol.relative}); the largest is ${w.side} ${w.output} ${w.quantile} in ${w.year}: stored ${w.expected}, re-run ${w.actual}`,
    );
    return report;
  }
  if (rerun.manifest.coverage && contentHash(rerun.manifest.coverage) !== contentHash(manifest.coverage)) {
    report.warnings.push(`The coverage recorded in the bundle (${manifest.coverage?.source?.text ?? 'none'}; ${manifest.coverage?.completeness ?? 'none'}) differs from what this app computes (${rerun.manifest.coverage.source.text}; ${rerun.manifest.coverage.completeness}).`);
  }
  report.status = 'reproduced';
  return report;
}

function canonicalYears(years: unknown): string {
  return Array.isArray(years) ? years.map((y) => (typeof y === 'number' ? y.toFixed(6) : 'x')).join(',') : '';
}

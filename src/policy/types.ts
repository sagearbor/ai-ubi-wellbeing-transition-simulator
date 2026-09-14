/**
 * Policy drafts — stage 5 of the v3 plan ("paste, inspect assumptions, run, explain limits, share,
 * reopen").
 *
 * Pipeline (spec section 8):
 *   source text -> actual provisions -> proposed mechanisms -> parameter/input/effect mappings
 *   -> constraints and funding -> reviewed draft -> paired run.
 *
 * A PolicyDraft is data about ONE source text read against ONE model version (id + hash). Every
 * provision carries a verbatim quote and exactly one status:
 *   - mapped         : it sets something the model already has (a parameter, an input curve) or
 *                      attaches a labelled effect to a hookable variable;
 *   - unresolved     : it plausibly matters to the model but cannot be mapped honestly (no number
 *                      in the text, or it needs a response coefficient the model lacks);
 *   - outside-model  : the model has no mechanism for it at all.
 *
 * Roles keep policy controls apart from empirical coefficients. A bill's text supports the
 * extraction of a control (a budget, a rate, a date); it never supports the magnitude of how the
 * world responds. The validator enforces that split (see draft.ts).
 */

import type { EvidenceKind, Source } from '../core/types';

export type ProvisionStatus = 'mapped' | 'unresolved' | 'outside-model';

/**
 * control     : something the text sets (a rate, an eligibility rule, a date).
 * funding     : a budget, appropriation, cap or revenue line.
 * constraint  : a limit the text imposes on the mechanism (a cap on who or how much).
 * coefficient : how the world responds to the policy. Never supported by the bill's own text.
 */
export type ProvisionRole = 'control' | 'coefficient' | 'funding' | 'constraint';

/**
 * ai-drafted     : produced by an extraction model, unreviewed.
 * author-drafted : written by a named author (a person or a coding agent) who has not had it
 *                  independently reviewed. Say who in `draftedBy`.
 * human-reviewed : a named person other than the drafter checked every provision against the
 *                  source. Requires `reviewedBy`.
 */
export type ReviewStatus = 'ai-drafted' | 'author-drafted' | 'human-reviewed';

export const PROVISION_STATUSES: ProvisionStatus[] = ['mapped', 'unresolved', 'outside-model'];
export const PROVISION_ROLES: ProvisionRole[] = ['control', 'funding', 'constraint', 'coefficient'];
export const REVIEW_STATUSES: ReviewStatus[] = ['ai-drafted', 'author-drafted', 'human-reviewed'];

export interface PolicySource {
  title: string;
  url?: string;
  /** SHA-256 (hex) of the exact source text the quotes were checked against. */
  textSha256?: string;
  /** Length of that text in characters. */
  excerptChars: number;
  /** What part of the document the text is (e.g. "sections 4 and 5, as introduced"). */
  excerptNote?: string;
  retrieved?: string;
}

/**
 * What a mapped provision does to the model. Always additive — a draft cannot rewrite an equation
 * (that is a structural fork; the engine rejects it).
 *
 *   parameter / set        : replace an existing parameter's value (its declared range is dropped,
 *                            because a value the policy sets is not drawn from the model's range).
 *   input / set            : replace an existing input's curve (`curve`, or a constant `value`).
 *   input / add            : add a constant `value` at every key of the existing curve (and every
 *                            per-entity curve). Exact for linear and step interpolation.
 *   effect / add|multiply  : attach an effect `expr` to a hookable variable, optionally `from` a year.
 */
export interface ProvisionMapping {
  kind: 'parameter' | 'input' | 'effect';
  target: string;
  op: 'set' | 'add' | 'multiply';
  value?: number;
  curve?: Record<string, number>;
  expr?: string;
  from?: number;
  unit?: string;
  /** Where the mapped number comes from, and what kind of claim it is. */
  evidence: Source;
}

export interface Provision {
  id: string;
  /** Verbatim from the source text (checked after whitespace normalisation). */
  quote: string;
  /** Plain-English reading of what the quote does. */
  summary: string;
  status: ProvisionStatus;
  role?: ProvisionRole;
  mapping?: ProvisionMapping;
  /** Required for unresolved and outside-model; recommended for mapped (why this mapping). */
  reason?: string;
}

export interface DraftedBy {
  kind: 'ai' | 'person' | 'agent';
  name: string;
  date?: string;
}

export interface PolicyDraft {
  schemaVersion: 1;
  id: string;
  title: string;
  source: PolicySource;
  modelId: string;
  modelHash: string;
  provisions: Provision[];
  reviewStatus: ReviewStatus;
  draftedBy?: DraftedBy;
  reviewedBy?: { name: string; date?: string };
  notes?: string;
}

export interface DraftDiagnostic {
  level: 'error' | 'warning' | 'info';
  code:
    | 'schema'
    | 'model-mismatch'
    | 'model-hash-mismatch'
    | 'text-hash-mismatch'
    | 'duplicate-provision-id'
    | 'missing-status'
    | 'empty-quote'
    | 'quote-not-found'
    | 'quote-unchecked'
    | 'missing-reason'
    | 'missing-mapping'
    | 'mapping-ignored'
    | 'unknown-target'
    | 'bad-op'
    | 'bad-value'
    | 'no-hook'
    | 'unit-mismatch'
    | 'duplicate-target'
    | 'coefficient-unsupported'
    | 'coefficient-from-source-text'
    | 'effect-not-coefficient'
    | 'missing-source'
    | 'review-status'
    | 'nothing-mapped';
  message: string;
  provisionId?: string;
}

export interface Coverage {
  total: number;
  mapped: number;
  unresolved: number;
  outsideModel: number;
  /** Provisions with no valid status. */
  unaccounted: number;
  /** True when every provision is mapped, unresolved or outside-model — and there is at least one. */
  allAccountedFor: boolean;
  /** "7 of 9 provisions mapped, 1 unresolved, 1 outside model" */
  text: string;
}

export type QuantileKey = 'p5' | 'p25' | 'p50' | 'p75' | 'p95' | 'mean';
export type Quantiles = Record<QuantileKey, number[]>;

export interface PolicyRunManifest {
  schema: 'policy-run/1';
  modelId: string;
  modelName: string;
  modelHash: string;
  engineVersion: string;
  /** Scenario overlays both sides share (the baseline), in order, with content hashes. */
  baselineOverlays: Array<{ id: string; hash: string }>;
  policyOverlayId: string;
  policyOverlayHash: string;
  draftId: string;
  draftHash: string;
  reviewStatus: ReviewStatus;
  draftedBy?: DraftedBy;
  reviewedBy?: { name: string; date?: string };
  coverage: Pick<Coverage, 'total' | 'mapped' | 'unresolved' | 'outsideModel' | 'allAccountedFor'>;
  /** Evidence behind every mapped number. */
  evidence: Array<{ provisionId: string; role?: ProvisionRole; target: string; kind: EvidenceKind; label: string; url?: string }>;
  runs: number;
  seed: number;
  /** Engine RunManifest.hash of the point (unsampled) runs. */
  baselineRunHash: string;
  policyRunHash: string;
  createdAt: string;
}

export interface PairedRunResult {
  ok: boolean;
  /** Why the run did not complete, from either side. */
  errors: string[];
  years: number[];
  entities: string[];
  /** Outputs present on both sides (paired differences exist for these). */
  outputs: string[];
  /** Outputs that exist only with the policy overlay (no baseline to difference against). */
  policyOnlyOutputs: string[];
  runs: number;
  seed: number;
  /** Point (unsampled) series. entity -> output -> series. */
  point: { baseline: Record<string, Record<string, number[]>>; policy: Record<string, Record<string, number[]>> };
  /** Quantiles across paired draws. */
  baseline: Record<string, Record<string, Quantiles>>;
  policy: Record<string, Record<string, Quantiles>>;
  /** Quantiles of (policy - baseline) computed per draw — not a difference of quantiles. */
  difference: Record<string, Record<string, Quantiles>>;
  /** Plain-English min()/max() binding in the point runs: entity -> step -> sentences. */
  binding: { baseline: Record<string, string[][]>; policy: Record<string, string[][]> };
  manifest: PolicyRunManifest;
}

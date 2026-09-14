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
 * definition  : a definition that decides how other provisions read (who is eligible, what counts).
 *               Link it to the provisions it interprets with `interprets`.
 */
export type ProvisionRole = 'control' | 'coefficient' | 'funding' | 'constraint' | 'definition';

/**
 * ai-drafted     : produced by an extraction model, unreviewed.
 * author-drafted : written by a named author (a person or a coding agent) who has not had it
 *                  independently reviewed. Say who in `draftedBy`.
 * human-reviewed : a named person other than the drafter checked every provision against the
 *                  source. Requires `reviewedBy`.
 */
export type ReviewStatus = 'ai-drafted' | 'author-drafted' | 'human-reviewed';

export const PROVISION_STATUSES: ProvisionStatus[] = ['mapped', 'unresolved', 'outside-model'];
export const PROVISION_ROLES: ProvisionRole[] = ['control', 'funding', 'constraint', 'coefficient', 'definition'];
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
  /**
   * The unit `value` / `curve` / `expr` is written in. Required whenever the target declares a unit;
   * converted to the target's unit (src/policy/units.ts) or the draft does not run.
   */
  unit?: string;
  /**
   * For an input 'add' on a target another provision also 'set's: the id of that set provision. The
   * rule is explicit stacking — sets apply first, then adds that name the set they stack on. A set and
   * an add on one target without this link is a blocking error, because the reading is ambiguous
   * ("in addition to" versus "instead of").
   */
  stacksOn?: string;
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
  /** For role 'definition': the ids of the provisions whose reading this definition decides. */
  interprets?: string[];
}

/**
 * Why a clause of the source text has no provision. Every substantive clause of the source-clause
 * inventory (src/policy/clauses.ts) needs a provision quote inside it or one of these.
 */
export type ExclusionKind = 'not-operative' | 'definition' | 'procedural' | 'duplicate' | 'other';
export const EXCLUSION_KINDS: ExclusionKind[] = ['not-operative', 'definition', 'procedural', 'duplicate', 'other'];

export interface ClauseExclusion {
  /** A clause id from the inventory, e.g. "sec3(4)". */
  clauseId: string;
  kind: ExclusionKind;
  reason: string;
  /** kind 'definition': the provision ids whose reading this definition decides. */
  interprets?: string[];
  /** kind 'duplicate': the provision that already carries this clause's content. */
  duplicateOf?: string;
}

/**
 * A named person's statement that the provisions and exclusions cover the whole source text. Without
 * it, every export says "completeness not attested". An AI or a coding agent cannot attest — least of
 * all its own extraction.
 */
export interface CompletenessAttestation {
  name: string;
  kind: 'person' | 'agent' | 'ai';
  date: string;
  statement: string;
  /** The source text attested (SHA-256); an attestation of different text is void. */
  textSha256?: string;
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
  /** Clauses of the source deliberately not given a provision, each with a kind and a reason. */
  exclusions?: ClauseExclusion[];
  completeness?: CompletenessAttestation;
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
    | 'unit-missing'
    | 'unit-converted'
    | 'unit-assumed'
    | 'duplicate-target'
    | 'conflicting-setters'
    | 'set-add-ambiguous'
    | 'bad-stack'
    | 'unknown-clause'
    | 'bad-exclusion'
    | 'duplicate-exclusion'
    | 'definition-unlinked'
    | 'unknown-interprets'
    | 'quote-ambiguous'
    | 'coverage-incomplete'
    | 'attestation'
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
  /**
   * True when every LISTED provision is mapped, unresolved or outside-model — and there is at least
   * one. Says nothing about provisions the draft does not list: see `source`.
   */
  allHaveStatus: boolean;
  /** "7 of 9 provisions mapped, 1 unresolved, 1 outside model" */
  text: string;
  /** "every listed provision has a status" / "2 listed provisions have no status" */
  statusText: string;
  /** Coverage of the source text's clauses: the denominator comes from the text, not the draft. */
  source: SourceCoverageSummary;
  completeness: CompletenessSummary;
}

export interface SourceCoverageSummary {
  status: 'complete' | 'incomplete' | 'source-unavailable' | 'source-mismatch';
  inventoryVersion: string;
  clauses: number;
  covered: number;
  excluded: number;
  uncovered: string[];
  text: string;
}

export interface CompletenessSummary {
  attested: boolean;
  /** "completeness attested by Jane Doe on 2026-09-20" / "completeness not attested" */
  text: string;
  attestation?: CompletenessAttestation;
}

export type QuantileKey = 'p5' | 'p25' | 'p50' | 'p75' | 'p95' | 'mean';
export type Quantiles = Record<QuantileKey, number[]>;

export interface PolicyRunManifest {
  schema: 'policy-run/2';
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
  coverage: Pick<Coverage, 'total' | 'mapped' | 'unresolved' | 'outsideModel' | 'allHaveStatus' | 'statusText'> & {
    source: Omit<SourceCoverageSummary, 'uncovered'> & { uncovered: number };
    completeness: string;
  };
  /** Exclusions of source clauses, by kind. */
  exclusions: Array<{ clauseId: string; kind: string; interprets?: string[] }>;
  /** Evidence behind every mapped number. */
  evidence: Array<{ provisionId: string; role?: ProvisionRole; target: string; kind: EvidenceKind; label: string; url?: string }>;
  runs: number;
  seed: number;
  /** The draws are run indices 0..runs-1 with this seed, identical on both sides. */
  draws: { count: number; seed: number; firstIndex: 0; deterministic?: true };
  /** Unit conversions applied to mapped values ("20 million usd → training_budget (usd): converted to 20,000,000"). */
  conversions: string[];
  /** Engine RunManifest.hash of the point (unsampled) runs. */
  baselineRunHash: string;
  policyRunHash: string;
  createdAt: string;
}

export interface PairedRunResult {
  ok: boolean;
  /** Why the run did not complete, from either side — or the validation errors that blocked it. */
  errors: string[];
  /** Validation errors that stopped the draft from running at all (empty when it ran). */
  blocked: DraftDiagnostic[];
  years: number[];
  entities: string[];
  /** Outputs present on both sides (paired differences exist for these). */
  outputs: string[];
  /** Outputs that exist only with the policy overlay (no baseline to difference against). */
  policyOnlyOutputs: string[];
  runs: number;
  /** True when nothing is sampled on either side: the model ran once, and the "spread" is the point run. */
  deterministic?: boolean;
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

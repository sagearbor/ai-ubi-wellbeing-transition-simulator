/**
 * policyState — the Policy panel's logic that is not JSX, testable without a DOM.
 *
 * Edits never touch the model: they change a PolicyDraft, which becomes an overlay only when run.
 * Editing a human-reviewed draft downgrades it (the review was of the old text), so a shared link
 * can never carry a "human-reviewed" label over content nobody reviewed. The same edit voids a
 * completeness attestation: it attested the old provisions and exclusions.
 */

import { ENGINE_VERSION, resolveModel } from '../../src/core/engine';
import type { CoreModel, Overlay } from '../../src/core/types';
import type { FixtureEntry } from '../../src/core/fixtures';
import { contentHash, modelHash, sha256Hex } from '../../src/policy/hash';
import type { LabLinkState } from '../../src/policy/bundle';
import type { ClauseExclusion, ExclusionKind, PolicyDraft, Provision, ProvisionMapping, ProvisionStatus } from '../../src/policy/types';

export interface TargetOption {
  id: string;
  unit: string;
  /** Plain text shown in the picker. */
  label: string;
}

/** What a mapping of `kind` may target in the scenario (base model + scenario overlays). */
export function targetOptions(model: CoreModel, overlays: Overlay[], kind: ProvisionMapping['kind']): TargetOption[] {
  const m = resolveModel(model, overlays).model;
  if (kind === 'parameter') return m.parameters.map((p) => ({ id: p.id, unit: p.unit ?? '', label: `${p.id} = ${p.value}${p.unit ? ` ${p.unit}` : ''}` }));
  if (kind === 'input') return (m.inputs ?? []).map((i) => ({ id: i.id, unit: i.unit ?? '', label: `${i.id}${i.unit ? ` (${i.unit})` : ''}` }));
  return m.variables.filter((v) => v.hook !== false).map((v) => ({ id: v.id, unit: v.unit ?? '', label: `${v.id}${v.unit ? ` (${v.unit})` : ''}` }));
}

export function defaultMapping(model: CoreModel, overlays: Overlay[], kind: ProvisionMapping['kind'] = 'input'): ProvisionMapping {
  const first = targetOptions(model, overlays, kind)[0] ?? targetOptions(model, overlays, 'parameter')[0];
  const actualKind = targetOptions(model, overlays, kind).length ? kind : 'parameter';
  return {
    kind: actualKind,
    target: first?.id ?? '',
    op: actualKind === 'effect' ? 'add' : 'set',
    ...(actualKind === 'effect' ? { expr: '0' } : { value: 0 }),
    ...(first?.unit ? { unit: first.unit } : {}),
    evidence: { label: 'assumed: ', kind: 'assumed' },
  };
}

/**
 * Apply an edit. When the content changes (anything but the review and attestation fields), a
 * human-reviewed draft is no longer human-reviewed, and a completeness attestation is dropped.
 */
export function withEdit(before: PolicyDraft, after: PolicyDraft): PolicyDraft {
  if (before.reviewStatus !== 'human-reviewed' && !before.completeness) return after;
  const strip = (d: PolicyDraft) => ({ ...d, reviewStatus: undefined, reviewedBy: undefined, completeness: undefined });
  if (contentHash(strip(before)) === contentHash(strip(after))) return after;
  const { reviewedBy: _dropped, completeness: _void, ...rest } = after;
  return { ...rest, reviewStatus: after.reviewStatus === 'human-reviewed' ? 'author-drafted' : after.reviewStatus };
}

/** Re-pin the draft to the text now in the panel; its quotes and coverage are then checked against it. */
export function repinSource(draft: PolicyDraft, text: string): PolicyDraft {
  return withEdit(draft, { ...draft, source: { ...draft.source, textSha256: sha256Hex(text), excerptChars: text.length } });
}

export function addExclusion(draft: PolicyDraft, clauseId: string, kind: ExclusionKind = 'not-operative', reason = ''): PolicyDraft {
  const exclusions = [...(draft.exclusions ?? []).filter((x) => x.clauseId !== clauseId), { clauseId, kind, reason }];
  return withEdit(draft, { ...draft, exclusions });
}

export function updateExclusion(draft: PolicyDraft, clauseId: string, patch: Partial<ClauseExclusion>): PolicyDraft {
  const exclusions = (draft.exclusions ?? []).map((x) => (x.clauseId === clauseId ? { ...x, ...patch } : x));
  return withEdit(draft, { ...draft, exclusions });
}

export function removeExclusion(draft: PolicyDraft, clauseId: string): PolicyDraft {
  const exclusions = (draft.exclusions ?? []).filter((x) => x.clauseId !== clauseId);
  return withEdit(draft, { ...draft, exclusions: exclusions.length ? exclusions : undefined });
}

export function updateProvision(draft: PolicyDraft, index: number, patch: Partial<Provision>): PolicyDraft {
  const provisions = draft.provisions.map((p, i) => (i === index ? { ...p, ...patch } : p));
  return withEdit(draft, { ...draft, provisions });
}

export function setProvisionStatus(draft: PolicyDraft, index: number, status: ProvisionStatus, model: CoreModel, overlays: Overlay[]): PolicyDraft {
  const p = draft.provisions[index];
  if (!p) return draft;
  const patch: Partial<Provision> = { status };
  if (status === 'mapped' && !p.mapping) patch.mapping = defaultMapping(model, overlays, p.role === 'coefficient' ? 'effect' : 'input');
  return updateProvision(draft, index, patch);
}

export function updateMapping(draft: PolicyDraft, index: number, patch: Partial<ProvisionMapping>, model: CoreModel, overlays: Overlay[]): PolicyDraft {
  const p = draft.provisions[index];
  if (!p) return draft;
  const current = p.mapping ?? defaultMapping(model, overlays);
  let next: ProvisionMapping = { ...current, ...patch };
  if (patch.kind && patch.kind !== current.kind) {
    // switching kind resets the parts that do not carry over, but keeps the evidence
    next = { ...defaultMapping(model, overlays, patch.kind), evidence: current.evidence };
  } else if (patch.target && patch.target !== current.target) {
    const unit = targetOptions(model, overlays, next.kind).find((o) => o.id === patch.target)?.unit;
    next = { ...next, unit: unit || undefined };
  }
  return updateProvision(draft, index, { mapping: next });
}

export function addProvision(draft: PolicyDraft, quote = ''): PolicyDraft {
  const taken = new Set(draft.provisions.map((p) => p.id));
  let n = draft.provisions.length + 1;
  while (taken.has(`provision-${n}`)) n += 1;
  const p: Provision = { id: `provision-${n}`, quote, summary: '', status: 'unresolved', reason: '' };
  return withEdit(draft, { ...draft, provisions: [...draft.provisions, p] });
}

export function removeProvision(draft: PolicyDraft, index: number): PolicyDraft {
  return withEdit(draft, { ...draft, provisions: draft.provisions.filter((_, i) => i !== index) });
}

/** Draft B starts as a copy of A with its own id, on the same baseline. */
export function copyAsDraftB(draft: PolicyDraft): PolicyDraft {
  const { reviewedBy: _r, ...rest } = draft;
  return {
    ...rest,
    id: `${draft.id}-b`.slice(0, 80),
    title: `${draft.title} (variant B)`,
    reviewStatus: draft.reviewStatus === 'human-reviewed' ? 'author-drafted' : draft.reviewStatus,
    provisions: draft.provisions.map((p) => ({ ...p, mapping: p.mapping ? { ...p.mapping, evidence: { ...p.mapping.evidence } } : undefined })),
  };
}

/** Re-pin a draft to the loaded model (after a person has re-checked the mappings). */
export function repin(draft: PolicyDraft, model: CoreModel): PolicyDraft {
  return withEdit(draft, { ...draft, modelId: model.id, modelHash: modelHash(model) });
}

/** Parse "2026: 0, 2027: 12000000" or a JSON object into a curve. */
export function parseCurveText(text: string): { curve: Record<string, number> | null; error: string | null } {
  const t = text.trim();
  if (!t) return { curve: null, error: 'Enter at least one "year: value" pair.' };
  let pairs: Array<[string, unknown]>;
  if (t.startsWith('{')) {
    try {
      const obj = JSON.parse(t);
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { curve: null, error: 'The curve must be an object of year: value.' };
      pairs = Object.entries(obj);
    } catch {
      return { curve: null, error: 'Not valid JSON.' };
    }
  } else {
    pairs = t.split(/[,;\n]+/).filter((s) => s.trim()).map((s) => {
      const [k, v] = s.split(':');
      return [String(k ?? '').trim(), v === undefined ? NaN : Number(String(v).replace(/[_\s]/g, ''))];
    });
  }
  const curve: Record<string, number> = {};
  for (const [k, v] of pairs) {
    if (!/^\d{4}(\.\d+)?$/.test(k)) return { curve: null, error: `"${k}" is not a year.` };
    if (typeof v !== 'number' || !Number.isFinite(v)) return { curve: null, error: `The value for ${k} is not a number.` };
    curve[k] = v;
  }
  return { curve, error: null };
}

export function curveToText(curve?: Record<string, number>): string {
  return curve ? Object.entries(curve).map(([k, v]) => `${k}: ${v}`).join(', ') : '';
}

/**
 * Split a scenario's overlays into the fixture's own toggles (by id AND content) and everything
 * else, which the lab shows as "yours". Order is preserved within each group.
 */
export function splitScenarioOverlays(fixture: FixtureEntry, overlays: Overlay[]): { overlayIds: string[]; custom: Overlay[] } {
  const overlayIds: string[] = [];
  const custom: Overlay[] = [];
  for (const o of overlays) {
    const f = fixture.overlays.find((x) => x.id === o.id);
    if (f && contentHash(f) === contentHash(o)) overlayIds.push(o.id);
    else custom.push(o);
  }
  return { overlayIds, custom };
}

export function linkStateFor(model: CoreModel, overlays: Overlay[], drafts: PolicyDraft[], runs: number, seed: number): LabLinkState {
  return { v: 2, modelId: model.id, modelHash: modelHash(model), engineVersion: ENGINE_VERSION, overlays, drafts, runs, seed };
}

/** Identity of a run's inputs: a result is stale when this changes. */
export function runKey(model: CoreModel, overlays: Overlay[], draft: PolicyDraft, runs: number, seed: number, sourceText = ''): string {
  return contentHash({ m: modelHash(model), e: ENGINE_VERSION, overlays, draft, runs, seed, text: sourceText.trim() ? sha256Hex(sourceText) : '' });
}

/** Tailwind classes for a provision status chip. */
export const STATUS_STYLE: Record<ProvisionStatus, string> = {
  mapped: 'bg-sky-100 text-sky-800 ring-sky-300 dark:bg-sky-900/40 dark:text-sky-200 dark:ring-sky-700',
  unresolved: 'bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-700',
  'outside-model': 'bg-slate-200 text-slate-700 ring-slate-300 dark:bg-slate-700/60 dark:text-slate-200 dark:ring-slate-600',
};

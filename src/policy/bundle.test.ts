import { describe, expect, it } from 'vitest';
import { findFixture } from '../core/fixtures';
import type { CoreModel } from '../core/types';
import {
  LAB_HASH_PREFIX,
  buildBundle,
  buildLabShareUrl,
  bundleFileName,
  decodeLabLink,
  encodeLabLink,
  openLabLink,
  parseBundleJson,
  parseLabHash,
  reopenBundle,
  type LabLinkState,
  type PolicyBundle,
} from './bundle';
import { pairedRun } from './draft';
import { modelHash } from './hash';
import { SOURCE_TEXT, cohort, retraining, threeStatusDraft, training } from './testDrafts';

const registry = (id: string): CoreModel | undefined => findFixture(id)?.model;

const linkState = (over: Partial<LabLinkState> = {}): LabLinkState => ({
  v: 1,
  modelId: training.id,
  modelHash: modelHash(training),
  overlays: [],
  drafts: [threeStatusDraft()],
  runs: 50,
  seed: 4,
  ...over,
});

const roundTrip = (b: PolicyBundle): PolicyBundle => {
  const parsed = parseBundleJson(JSON.stringify(b));
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.value;
};

describe('lab share link', () => {
  it('round-trips a scenario with two drafts, including non-ASCII text', () => {
    const b = { ...threeStatusDraft(), id: 'draft-b', title: 'Variante B — €12 millions' };
    const state = linkState({ drafts: [threeStatusDraft(), b], overlays: [] });
    const url = buildLabShareUrl(state, 'https://sim.example', '/');
    expect(url.startsWith(`https://sim.example/${LAB_HASH_PREFIX}`)).toBe(true);
    const decoded = parseLabHash(url.slice(url.indexOf('#')));
    expect(decoded?.ok).toBe(true);
    if (decoded?.ok) expect(decoded.value).toEqual(state);
    expect(encodeLabLink(state)).not.toMatch(/[+/=]/);
  });

  it('ignores hashes that are not lab links', () => {
    expect(parseLabHash('')).toBeNull();
    expect(parseLabHash('#futures=abc')).toBeNull();
    expect(parseLabHash('#scenario=abc')).toBeNull();
  });

  it('never throws on garbage and says what is wrong', () => {
    const bad = ['', '!!!', 'aGVsbG8', encodeLabLink({ ...linkState(), v: 2 } as unknown as LabLinkState), encodeLabLink({ ...linkState(), drafts: [] })];
    const reasons = bad.map((p) => decodeLabLink(p)).map((r) => (r.ok ? 'ok' : r.reason));
    expect(reasons.every((r) => r !== 'ok')).toBe(true);
    expect(reasons[3]).toContain('unsupported lab link version');
    expect(reasons[4]).toContain('one or two policy drafts');
    // a truncated link
    const full = encodeLabLink(linkState());
    const cut = decodeLabLink(full.slice(0, Math.floor(full.length / 2)));
    expect(cut.ok).toBe(false);
  });

  it('opens against the pinned model, and refuses an unknown model or a different version', () => {
    const opened = openLabLink(linkState(), registry);
    expect(opened.ok).toBe(true);
    if (opened.ok) {
      expect(opened.value.model.id).toBe('training-budget');
      expect(opened.value.diagnostics[0].filter((d) => d.level === 'error')).toEqual([]);
    }
    const unknown = openLabLink(linkState({ modelId: 'no-such-model' }), registry);
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.reason).toContain('does not include');
    const stale = openLabLink(linkState({ modelHash: '0000000000000000' }), registry);
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.reason).toMatch(/version 0000000000000000.*not opened/);
    const mismatched = openLabLink(linkState({ drafts: [{ ...threeStatusDraft(), modelId: 'cohort-flow' }] }), registry);
    expect(mismatched.ok).toBe(false);
  });
});

describe('bundle', () => {
  it('reproduces after a JSON round trip, with quotes re-checked from the bundled source', () => {
    const draft = threeStatusDraft();
    const result = pairedRun(training, [], draft, { runs: 120, seed: 9 });
    const bundle = roundTrip(buildBundle(training, [], draft, result, { sourceText: SOURCE_TEXT }));
    const report = reopenBundle(bundle, registry);
    expect(report.errors).toEqual([]);
    expect(report.status).toBe('reproduced');
    expect(report.compared).toBeGreaterThan(0);
    expect(report.maxAbsDiff).toBe(0);
    expect(report.draftDiagnostics.filter((d) => d.level === 'error')).toEqual([]);
    expect(report.draftDiagnostics.map((d) => d.code)).not.toContain('quote-unchecked');
    expect(bundleFileName(bundle)).toBe(`test-draft-training-budget-${modelHash(training)}.policy.json`);
  });

  it('keeps scenario overlays and review status through the round trip', () => {
    const draft = { ...threeStatusDraft(), modelId: cohort.id, modelHash: modelHash(cohort), provisions: threeStatusDraft().provisions.slice(1) };
    const result = pairedRun(cohort, [retraining], draft, { runs: 4, seed: 2 });
    const bundle = roundTrip(buildBundle(cohort, [retraining], draft, result));
    expect(bundle.manifest.reviewStatus).toBe('author-drafted');
    expect(bundle.manifest.baselineOverlays.map((o) => o.id)).toEqual(['retraining']);
    const report = reopenBundle(bundle, registry);
    expect(report.status).toBe('reproduced');
    expect(report.overlays?.map((o) => o.id)).toEqual(['retraining']);
  });

  it('reports a result that does not reproduce, with where and by how much', () => {
    const draft = threeStatusDraft();
    const result = pairedRun(training, [], draft, { runs: 20, seed: 1 });
    const bundle = roundTrip(buildBundle(training, [], draft, result));
    bundle.results.difference._.placements.p50[2] += 5;
    const report = reopenBundle(bundle, registry);
    expect(report.status).toBe('not-reproduced');
    expect(report.worst).toMatchObject({ side: 'difference', output: 'placements', quantile: 'p50', year: 2028 });
    expect(report.maxAbsDiff).toBeCloseTo(5, 9);
    expect(report.errors[0]).toContain('outside the declared tolerance');

    const loose = roundTrip({ ...bundle, tolerance: { absolute: 10, relative: 0, note: 'loose' } });
    expect(reopenBundle(loose, registry).status).toBe('reproduced');
  });

  it('refuses to open an unknown model, a changed model version, an edited draft or an old schema', () => {
    const draft = threeStatusDraft();
    const result = pairedRun(training, [], draft, { runs: 5, seed: 1 });
    const bundle = roundTrip(buildBundle(training, [], draft, result));

    const unknown = reopenBundle(bundle, () => undefined);
    expect(unknown.status).toBe('cannot-open');
    expect(unknown.errors[0]).toContain('does not include');

    const changedModel = { ...training, parameters: training.parameters.map((p) => (p.id === 'cost_per_completion' ? { ...p, value: 4000 } : p)) };
    const stale = reopenBundle(bundle, (id) => (id === training.id ? changedModel : undefined));
    expect(stale.status).toBe('cannot-open');
    expect(stale.errors[0]).toContain('would silently use a different baseline');

    const edited = roundTrip(bundle);
    edited.draft.provisions[0].mapping!.curve = { '2026': 99 };
    expect(reopenBundle(edited, registry).errors[0]).toContain('not the draft the results were computed from');

    const old = parseBundleJson(JSON.stringify({ ...bundle, schema: 'policy-bundle/0' }));
    expect(old.ok).toBe(false);
    if (!old.ok) expect(old.reason).toContain('unsupported bundle schema');
    expect(parseBundleJson('{not json').ok).toBe(false);
    expect(parseBundleJson(JSON.stringify({ ...bundle, tolerance: { absolute: -1, relative: 0 } })).ok).toBe(false);
  });
});

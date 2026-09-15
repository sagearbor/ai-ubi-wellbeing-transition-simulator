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
import { NUMERICAL_CONVENTIONS, ENGINE_VERSION } from '../core/engine';
import { pairedRun } from './draft';
import { contentHash, modelHash } from './hash';
import { SOURCE_TEXT, cohort, retraining, threeStatusDraft, training } from './testDrafts';

const registry = (id: string): CoreModel | undefined => findFixture(id)?.model;

const linkState = (over: Partial<LabLinkState> = {}): LabLinkState => ({
  v: 2,
  modelId: training.id,
  engineVersion: ENGINE_VERSION, numerical: NUMERICAL_CONVENTIONS,
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
    const bad = [
      '',
      '!!!',
      'aGVsbG8',
      encodeLabLink({ ...linkState(), v: 3 } as unknown as LabLinkState),
      encodeLabLink({ ...linkState(), drafts: [] }),
      encodeLabLink({ ...linkState(), v: 1 } as unknown as LabLinkState),
      encodeLabLink({ ...linkState(), engineVersion: '' }),
    ];
    const reasons = bad.map((p) => decodeLabLink(p)).map((r) => (r.ok ? 'ok' : r.reason));
    expect(reasons.every((r) => r !== 'ok')).toBe(true);
    expect(reasons[3]).toContain('unsupported lab link version');
    expect(reasons[4]).toContain('one or two policy drafts');
    expect(reasons[5]).toContain('before links recorded the engine version');
    expect(reasons[6]).toContain('engine version');
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

  it('records the engine version and refuses a link made with another engine', () => {
    const state = linkState();
    expect(decodeLabLink(encodeLabLink(state)).value?.engineVersion).toBe(ENGINE_VERSION);
    const other = openLabLink(linkState({ engineVersion: `${ENGINE_VERSION}-other` }), registry);
    expect(other.ok).toBe(false);
    if (!other.ok) expect(other.reason).toMatch(/engine .*not opened/);
  });

  it('does not open a link whose draft has validation errors', () => {
    const bad = threeStatusDraft();
    bad.provisions = [bad.provisions[0], { ...bad.provisions[0], id: 'fund-b', mapping: { ...bad.provisions[0].mapping!, curve: { '2026': 1 } } }];
    const opened = openLabLink(linkState({ drafts: [bad] }), registry);
    expect(opened.ok).toBe(false);
    if (!opened.ok) expect(opened.reason).toContain('conflicting-setters');
    // unresolved provisions are not errors
    const omitted = { ...threeStatusDraft(), provisions: threeStatusDraft().provisions.slice(1) };
    expect(openLabLink(linkState({ drafts: [omitted] }), registry).ok).toBe(true);
  });
});

describe('bundle', () => {
  it('reproduces after a JSON round trip, with quotes re-checked from the bundled source', () => {
    const draft = threeStatusDraft();
    const result = pairedRun(training, [], draft, { runs: 120, seed: 9, sourceText: SOURCE_TEXT });
    const bundle = roundTrip(buildBundle(training, [], draft, result, { sourceText: SOURCE_TEXT }));
    expect(bundle.manifest.coverage.source.status).toBe('complete');
    expect(bundle.manifest).toMatchObject({ engineVersion: ENGINE_VERSION, numerical: NUMERICAL_CONVENTIONS, draws: { count: 120, seed: 9, firstIndex: 0 } });
    const report = reopenBundle(bundle, registry);
    expect(report.errors).toEqual([]);
    expect(report.status).toBe('reproduced');
    expect(report.compared).toBeGreaterThan(0);
    expect(report.maxAbsDiff).toBe(0);
    expect(report.draftDiagnostics.filter((d) => d.level === 'error')).toEqual([]);
    expect(report.draftDiagnostics.map((d) => d.code)).not.toContain('quote-unchecked');
    expect(report.warnings.join(' ')).toContain('not independently verified');
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

    const loose = { ...bundle, tolerance: { absolute: 10, relative: 0, note: 'loose' } };
    expect(reopenBundle(loose, registry).status).toBe('cannot-open');
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

    const otherEngine = roundTrip({ ...bundle, manifest: { ...bundle.manifest, engineVersion: 'core-0.0.1' } });
    const eng = reopenBundle(otherEngine, registry);
    expect(eng.status).toBe('cannot-open');
    expect(eng.errors[0]).toMatch(/engine "core-0.0.1".*would not be reproducible/);
    expect(eng.rerun).toBeUndefined();

    const old = parseBundleJson(JSON.stringify({ ...bundle, schema: 'policy-bundle/1' }));
    expect(old.ok).toBe(false);
    if (!old.ok) expect(old.reason).toContain('unsupported bundle schema');
    expect(parseBundleJson('{not json').ok).toBe(false);
  });

  it('refuses a self-consistent bundle recorded under the pre-patch math runtime and never re-runs it (review 2026-09-15)', () => {
    const draft = threeStatusDraft();
    const result = pairedRun(training, [], draft, { runs: 3, seed: 1 });
    const bundle = roundTrip(buildBundle(training, [], draft, result));
    // Rebuild the manifest as the pre-patch build would have written it: its own hash is valid, only the
    // recorded expression runtime differs (mathjs 15.1.0, before the security update).
    const { hash: _hash, createdAt, ...identity } = bundle.manifest;
    const prepatchIdentity = { ...identity, numerical: { ...identity.numerical, expression: 'mathjs/15.1.0' } };
    const prepatch = roundTrip({ ...bundle, manifest: { ...prepatchIdentity, createdAt, hash: contentHash(prepatchIdentity) } });
    expect(prepatch.manifest.numerical.expression).not.toBe(NUMERICAL_CONVENTIONS.expression);
    const report = reopenBundle(prepatch, registry);
    expect(report.status).toBe('cannot-open');
    expect(report.rerun).toBeUndefined();
    expect(report.errors[0]).toMatch(/numerical/i);
  });

  it('does not re-run a bundle whose draft fails validation against its own source text', () => {
    const draft = threeStatusDraft();
    const result = pairedRun(training, [], draft, { runs: 3, seed: 1 });
    // a bundle whose source text is not the text the draft pins (hand-built: the panel would not bundle it)
    const tampered = roundTrip({ ...buildBundle(training, [], draft, result), sourceText: SOURCE_TEXT.replace('stipend', 'grant') });
    const rep = reopenBundle(tampered, registry);
    expect(rep.status).toBe('cannot-open');
    expect(rep.rerun).toBeUndefined();
    expect(rep.errors[0]).toContain('text-hash-mismatch');
    expect(parseBundleJson(JSON.stringify({ ...tampered, tolerance: { absolute: -1, relative: 0 } })).ok).toBe(false);
  });
});

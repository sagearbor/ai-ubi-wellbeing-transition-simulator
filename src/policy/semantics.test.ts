import { buildBundle, reopenBundle } from './bundle';
import { contentHash } from './hash';
import { executeSync } from '../workers/execute';
import { withEdit } from '../../components/lab/policyState';
import type { PairedRunResult } from './types';
import { describe, it, expect } from 'vitest';
import { unitFactor } from './units';
import { coverage, attestationBinding, pairedRun, validateDraft } from './draft';
import { sourceCoverage } from './clauses';
import { training, threeStatusDraft } from './testDrafts';

describe('review semantic regressions', () => {
  it('does not silently equate recipient denominators or supply a time basis', () => {
    expect(unitFactor('usd per worker', 'usd per person', 'grant').ok).toBe(false);
    expect(unitFactor('usd', 'usd per month', 'grant').ok).toBe(false);
  });
  it('whole-source quotation does not account for operative mechanisms', () => {
    const text = 'SEC. 1. PAYMENTS.\n(a) Pay a training grant. Limit eligibility to displaced workers.\n(b) Tax robot profits.';
    const draft = threeStatusDraft();
    draft.source.textSha256 = undefined;
    draft.provisions = [{ ...draft.provisions[0], quote: text }];
    expect(sourceCoverage(draft, text).covered).toBe(2);
    expect(coverage(draft, text).operative.unresolved).toEqual(['sec1(a)', 'sec1(b)']);
    expect(validateDraft(draft, training, { sourceText: text }).some(d => d.code === 'coverage-incomplete')).toBe(true);
  });
});

it('persisted time assumptions convert and invalid assumptions block direct execution', () => {
  expect(unitFactor('usd', 'usd per month', 'grant', { timeAssumption: { basis: 'year', reason: 'Assumed annual appropriation' } })).toMatchObject({ ok: true, factor: 1 / 12 });
  for (const denominator of ['worker', 'participant', 'household']) expect(unitFactor(`usd per ${denominator}`, 'usd per resident', 'grant').ok).toBe(false);
  expect(unitFactor('workers', 'people', 'count').ok).toBe(false);
  expect(unitFactor('usd per resident', 'usd per person', 'grant').ok).toBe(true);
  const d = structuredClone(threeStatusDraft());
  d.provisions[0].mapping!.timeAssumption = { basis: 'year', reason: '' };
  expect(pairedRun(training, [], d, { runs: 1 }).ok).toBe(false);
});
it('attestations are bound across direct JSON mapping, source and disposition edits', () => {
  const d = structuredClone(threeStatusDraft());
  d.completeness = { name: 'Reviewer', kind: 'person', date: '2026-09-15', statement: 'Checked all mechanisms.', contentBinding: attestationBinding(d) };
  expect(coverage(d).completeness.attested).toBe(true);
  for (const edit of [(x: typeof d) => { x.provisions[0].mapping!.unit = 'million usd'; }, (x: typeof d) => { x.source.title = 'Changed'; }, (x: typeof d) => { x.clauseDispositions = [{ clauseId: 'sec1(a)', status: 'not-operative', reason: 'Changed' }]; }]) {
    const changed = structuredClone(d); edit(changed);
    expect(coverage(changed).completeness.attested).toBe(false);
  }
});
it('invalid and omitted operative links cannot certify accounted coverage', () => {
  const d = threeStatusDraft({ clauseDispositions: [{ clauseId: 'sec1(a)', status: 'linked', reason: 'Grant only', provisionIds: ['missing'] }] });
  const source = 'SEC. 1. TRAINING FUND.\n    (a) There is appropriated $12,000,000 for each of\nfiscal years 2027 through 2029 for training.\n    (b) Each participant shall receive a stipend.\n    (c) The Secretary shall report annually.';
  expect(validateDraft(d, training, { sourceText: source }).some(e => e.level === 'error')).toBe(true);
  expect(coverage(d, source).operative.unresolved).toContain('sec1(a)');
  expect(pairedRun(training, [], d, { sourceText: source, runs: 1 }).ok).toBe(false);
});

it('bundle reopening and worker execution both reject invalid time assumptions', () => {
  const draft = structuredClone(threeStatusDraft());
  const good = pairedRun(training, [], draft, { runs: 1 });
  const bundle = buildBundle(training, [], draft, good);
  draft.provisions[0].mapping!.timeAssumption = { basis: 'year', reason: '' };
  bundle.draft = draft;
  bundle.manifest.draftHash = contentHash(draft);
  expect(reopenBundle(bundle, id => id === training.id ? training : undefined).status).not.toBe('reproduced');
  const outcome = executeSync<Array<PairedRunResult>>({ kind: 'paired', model: training, overlays: [], drafts: [draft], runs: 1, seed: 1, sourceText: '' });
  expect(outcome.status).toBe('done');
  if (outcome.status === 'done') expect(outcome.result[0].ok).toBe(false);
});
it('editing operative dispositions in UI state clears the bound attestation', () => {
  const draft = threeStatusDraft();
  draft.completeness = { name: 'Reviewer', kind: 'person', date: '2026-09-15', statement: 'Checked', contentBinding: attestationBinding(draft) };
  const edited = withEdit(draft, { ...draft, clauseDispositions: [{ clauseId: 'sec1(a)', status: 'unresolved', reason: 'Needs eligibility review' }] });
  expect(edited.completeness).toBeUndefined();
});

import { describe, expect, it } from 'vitest';
import { pairedRun, validateDraft } from './draft';
import { cell, fmtNumber, memoFileName, renderMemo } from './memo';
import { SOURCE_TEXT, budgetProvision, draftFor, threeStatusDraft, training } from './testDrafts';
import type { Provision } from './types';

describe('renderMemo', () => {
  const draft = threeStatusDraft();
  const result = pairedRun(training, [], draft, { runs: 40, seed: 1, now: () => '2026-09-13T00:00:00.000Z', sourceText: SOURCE_TEXT });
  const memo = renderMemo({ model: training, overlays: [], draft, result, diagnostics: validateDraft(draft, training, { sourceText: SOURCE_TEXT }), sourceText: SOURCE_TEXT });

  it('says what it is not before anything else', () => {
    expect(memo.indexOf('not a prediction')).toBeGreaterThan(-1);
    expect(memo.indexOf('not a prediction')).toBeLessThan(memo.indexOf('## Provisions'));
  });

  it('carries source, review status, coverage and every provision', () => {
    expect(memo).toContain('https://example.gov/test-act');
    expect(memo).toContain('`author-drafted`');
    expect(memo).toContain('Test Author');
    expect(memo).toContain('1 of 3 provisions mapped, 1 unresolved, 1 outside model; every listed provision has a status.');
    expect(memo).not.toContain('accounted for');
    expect(memo).toContain('**Source coverage:** 3 of 3 source clauses covered or explicitly excluded');
    expect(memo).toContain('**Completeness:** completeness not attested.');
    for (const p of draft.provisions) expect(memo).toContain(p.quote.slice(0, 30));
    expect(memo).toContain('input `training_budget` set');
  });

  it('lists the assumptions, the paired results with spread, and what binds', () => {
    expect(memo).toContain('## Assumptions the result depends on');
    expect(memo).toContain('`placement_rate` = 0.5 share (guess: illustrative)');
    expect(memo).toContain('| Year | Baseline | Policy | Paired difference |');
    expect(memo).toMatch(/\| 2029 \| [\d,.]+ \[[\d,.]+, [\d,.]+\] \|/);
    expect(memo).toContain('computed inside each draw');
    expect(memo).toContain('## Binding constraints');
    expect(memo).toContain('completions is limited by instructor_capacity');
  });

  it('says what the model cannot say, including outside-model and unresolved provisions', () => {
    const limits = memo.slice(memo.indexOf('## What this model cannot say'));
    expect(limits).toContain('Tracks gross placements through one channel');
    expect(limits).toContain('stipend: No participant income in the model.');
    expect(limits).toContain('report: Could inform placement_rate later');
  });

  it('ends with the manifest', () => {
    const json = memo.slice(memo.indexOf('```json') + 7, memo.lastIndexOf('```'));
    expect(JSON.parse(json)).toMatchObject({ schema: 'policy-run/2', modelId: 'training-budget', runs: 40, seed: 1, coverage: { completeness: 'completeness not attested' } });
  });

  it('says when the source is unavailable, and lists exclusions', () => {
    const d = draftFor(training, [budgetProvision], { exclusions: [{ clauseId: 'sec1(b)', kind: 'other', reason: 'No stipend mechanism.' }] });
    const m = renderMemo({ model: training, overlays: [], draft: d, result: pairedRun(training, [], d, { runs: 2 }) });
    expect(m).toContain('**Source coverage:** source unavailable — coverage unknown.');
    expect(m).toContain('| `sec1(b)` | other | No stipend mechanism. |');
  });

  it('lists response coefficients the draft introduced, and escapes table cells', () => {
    const coeff: Provision = { ...budgetProvision, id: 'resp', role: 'coefficient', quote: 'a | b', mapping: { kind: 'effect', target: 'potential_placements', op: 'multiply', expr: '1.1', evidence: { label: 'author guess', kind: 'guess' } } };
    const d = draftFor(training, [coeff]);
    const m = renderMemo({ model: training, overlays: [], draft: d, result: pairedRun(training, [], d, { runs: 2 }) });
    expect(m).toContain('| Year | Baseline');
    expect(m).toContain('Response coefficients introduced by the draft');
    expect(m).toContain('"a \\| b"');
    expect(cell('x|y\nz')).toBe('x\\|y z');
  });

  it('reports a draft that did not run as no results rather than numbers', () => {
    const broken: Provision = { ...budgetProvision, role: 'coefficient', mapping: { kind: 'effect', target: 'potential_placements', op: 'add', expr: 'ghost', unit: 'people', evidence: { label: 'x', kind: 'assumed' } } };
    const d = draftFor(training, [broken]);
    const m = renderMemo({ model: training, overlays: [], draft: d, result: pairedRun(training, [], d, { runs: 2 }) });
    expect(m).toContain('The run did not complete');
    expect(m).not.toContain('| Year | Baseline');
  });

  it('formats numbers and file names', () => {
    expect(fmtNumber(1234567.8)).toBe('1,234,568');
    expect(fmtNumber(0.1234567)).toBe('0.1235');
    expect(fmtNumber(NaN)).toBe('n/a');
    expect(memoFileName({ id: 'S 3877/draft' })).toBe('s-3877-draft-memo.md');
  });
});

/**
 * The worked example: S. 3877 (Investing in Tomorrow's Workforce Act of 2026), sections 1 to 5,
 * read against the training-funding model. The draft is author-drafted (by the implementing coding
 * agent), not human-reviewed, its completeness is not attested, and the tests pin all three.
 */
import { describe, expect, it } from 'vitest';
import { findFixture } from '../core/fixtures';
import type { CoreModel } from '../core/types';
import { buildBundle, parseBundleJson, reopenBundle } from './bundle';
import { buildClauseInventory } from './clauses';
import { coverage, pairedRun, quoteInSource, validateDraft } from './draft';
import { POLICY_EXAMPLES, findPolicyExample } from './examples';
import { modelHash, sha256Hex } from './hash';
import { renderMemo } from './memo';

const example = findPolicyExample('s3877-itwa-2026')!;
const model = findFixture(example.modelId)!.model as CoreModel;

describe('worked example: S. 3877 against training-budget', () => {
  it('is registered, stores a real public source with its URL, and pins the text by hash', () => {
    expect(POLICY_EXAMPLES.map((e) => e.id)).toContain('s3877-itwa-2026');
    expect(example.source.url).toBe('https://www.govinfo.gov/content/pkg/BILLS-119s3877is/html/BILLS-119s3877is.htm');
    expect(example.source.text.startsWith('SECTION 1. SHORT TITLE.')).toBe(true);
    expect(example.source.text).toContain('SEC. 3. DEFINITIONS.');
    expect(example.source.text).toContain('SEC. 4. GRANTS TO IMPROVE TRAINING FOR WORKERS IMPACTED BY AUTOMATION.');
    expect(example.draft.source.textSha256).toBe(sha256Hex(example.source.text));
    expect(example.draft.source.excerptChars).toBe(example.source.text.length);
    expect(example.draft.modelHash).toBe(modelHash(model));
  });

  it('is honest about who drafted it, and does not attest its own completeness', () => {
    expect(example.draft.reviewStatus).toBe('author-drafted');
    expect(example.draft.reviewedBy).toBeUndefined();
    expect(example.draft.draftedBy?.kind).toBe('agent');
    expect(example.draft.completeness).toBeUndefined();
    expect(coverage(example.draft, example.source.text).completeness.text).toBe('completeness not attested');
  });

  it('validates with no errors or warnings, every quote found verbatim', () => {
    const ds = validateDraft(example.draft, model, { sourceText: example.source.text });
    expect(ds.filter((d) => d.level !== 'info')).toEqual([]);
    for (const p of example.draft.provisions) expect(quoteInSource(p.quote, example.source.text)).toBe(true);
  });

  it('covers or explicitly excludes every clause of the source, definitions linked to what they interpret', () => {
    const c = coverage(example.draft, example.source.text);
    expect(c.source).toMatchObject({ status: 'complete', clauses: 79, covered: 23, excluded: 56, uncovered: [] });
    expect(c.source.text).toBe('79 of 79 source clauses covered or explicitly excluded (23 by a provision quote, 56 excluded)');
    // the inventory is the text's, not the draft's
    expect(buildClauseInventory(example.source.text).clauses.filter((x) => !x.heading)).toHaveLength(79);
    // section 3 is not called "not operative": its definitions are definition provisions or definition exclusions
    const defs = example.draft.provisions.filter((p) => p.role === 'definition');
    expect(defs.map((p) => p.id)).toEqual(['sec3-1-automation', 'sec3-4-dislocated-worker', 'sec3-5-eligible-partnership']);
    for (const p of defs) expect(p.interprets?.length).toBeGreaterThan(0);
    const ex = example.draft.exclusions ?? [];
    const sec3 = ex.filter((x) => x.clauseId.startsWith('sec3('));
    expect(sec3.length).toBeGreaterThan(0);
    for (const x of sec3) {
      expect(x.kind).toBe('definition');
      expect(x.interprets?.length).toBeGreaterThan(0);
    }
    // the eligibility provisions are interpreted by the definitions
    expect(defs.flatMap((p) => p.interprets)).toEqual(expect.arrayContaining(['sec4a1-competitive-grants', 'sec5b1-automation-trigger', 'sec5a-wioa-allowable-use']));
    // only the short title, the findings and the definitions lead-in are "not operative"
    expect(ex.filter((x) => x.kind === 'not-operative').map((x) => x.clauseId)).toEqual(['sec1', 'sec2', 'sec2(1)', 'sec2(2)', 'sec2(3)', 'sec2(4)', 'sec2(5)', 'sec2(6)', 'sec2(7)', 'sec3']);
    expect(example.draft.source.excerptNote).not.toMatch(/not operative/);
  });

  it('every listed provision has a status, and all three statuses are used', () => {
    const c = coverage(example.draft);
    expect(c.allHaveStatus).toBe(true);
    expect(c.statusText).toBe('every listed provision has a status');
    expect(c).toMatchObject({ total: 23, mapped: 1, unresolved: 10, outsideModel: 12 });
    // every lettered subsection of sections 4 and 5 is represented
    const ids = example.draft.provisions.map((p) => p.id);
    for (const prefix of ['sec4a', 'sec4b', 'sec4c', 'sec4d', 'sec4e', 'sec4f', 'sec4g', 'sec5a', 'sec5b']) {
      expect(ids.some((id) => id.startsWith(prefix))).toBe(true);
    }
    // no response coefficient is mapped: the capacity- and cost-changing provisions stay unresolved
    expect(example.draft.provisions.filter((p) => p.role === 'coefficient').every((p) => p.status === 'unresolved')).toBe(true);
  });

  it('runs paired: the $40M raises completions until instructor capacity binds, then changes nothing', () => {
    const r = pairedRun(model, [], example.draft, { runs: 200, seed: 1 });
    expect(r.ok).toBe(true);
    const last = r.years.length - 1;
    expect(r.difference._.completions.p50[0]).toBeGreaterThan(0);
    expect(r.difference._.completions.p95[last]).toBe(0);
    expect(r.difference._.placements.p95[last]).toBe(0);
    // most of the money cannot be spent in this model
    expect(r.difference._.unspent_budget.p50[last]).toBe(40_000_000);
    expect(r.binding.policy._[0]).toContain('completions is limited by instructor_capacity');
  });

  it('bundle round-trips and reproduces within its declared tolerance', () => {
    const r = pairedRun(model, [], example.draft, { runs: 200, seed: 1, sourceText: example.source.text });
    expect(r.manifest.coverage.source).toMatchObject({ status: 'complete', clauses: 79, uncovered: 0 });
    expect(r.manifest.coverage.completeness).toBe('completeness not attested');
    const bundle = buildBundle(model, [], example.draft, r, { sourceText: example.source.text });
    const parsed = parseBundleJson(JSON.stringify(bundle));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const report = reopenBundle(parsed.value, (id) => findFixture(id)?.model);
    expect(report.status).toBe('reproduced');
    expect(report.errors).toEqual([]);
    expect(report.draftDiagnostics.filter((d) => d.level === 'error')).toEqual([]);
  });

  it('memo keeps the limits visible', () => {
    const r = pairedRun(model, [], example.draft, { runs: 50, seed: 1, sourceText: example.source.text });
    const memo = renderMemo({ model, overlays: [], draft: example.draft, result: r, sourceText: example.source.text });
    expect(memo).toContain('1 of 23 provisions mapped, 10 unresolved, 12 outside model; every listed provision has a status.');
    expect(memo).toContain('**Source coverage:** 79 of 79 source clauses covered or explicitly excluded');
    expect(memo).toContain('**Completeness:** completeness not attested.');
    expect(memo).toContain('| `sec3(2)` | definition |');
    expect(memo).toContain('Outside the model (12)');
    expect(memo).toContain('Unresolved (10)');
    expect(memo).toContain('not an estimate of what S. 3877 would do');
  });
});

/**
 * The worked example: S. 3877 (Investing in Tomorrow's Workforce Act of 2026), sections 4 and 5,
 * read against the training-funding model. The draft is author-drafted (by the implementing coding
 * agent), not human-reviewed, and the test pins that.
 */
import { describe, expect, it } from 'vitest';
import { findFixture } from '../core/fixtures';
import type { CoreModel } from '../core/types';
import { buildBundle, parseBundleJson, reopenBundle } from './bundle';
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
    expect(example.source.text.startsWith('SEC. 4. GRANTS TO IMPROVE TRAINING FOR WORKERS IMPACTED BY AUTOMATION.')).toBe(true);
    expect(example.draft.source.textSha256).toBe(sha256Hex(example.source.text));
    expect(example.draft.source.excerptChars).toBe(example.source.text.length);
    expect(example.draft.modelHash).toBe(modelHash(model));
  });

  it('is honest about who drafted it', () => {
    expect(example.draft.reviewStatus).toBe('author-drafted');
    expect(example.draft.reviewedBy).toBeUndefined();
    expect(example.draft.draftedBy?.kind).toBe('agent');
  });

  it('validates with no errors or warnings, every quote found verbatim', () => {
    const ds = validateDraft(example.draft, model, { sourceText: example.source.text });
    expect(ds.filter((d) => d.level !== 'info')).toEqual([]);
    for (const p of example.draft.provisions) expect(quoteInSource(p.quote, example.source.text)).toBe(true);
  });

  it('accounts for every provision and uses all three statuses', () => {
    const c = coverage(example.draft);
    expect(c.allAccountedFor).toBe(true);
    expect(c).toMatchObject({ total: 20, mapped: 1, unresolved: 8, outsideModel: 11 });
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
    const r = pairedRun(model, [], example.draft, { runs: 200, seed: 1 });
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
    const r = pairedRun(model, [], example.draft, { runs: 50, seed: 1 });
    const memo = renderMemo({ model, overlays: [], draft: example.draft, result: r });
    expect(memo).toContain('1 of 20 provisions mapped, 8 unresolved, 11 outside model');
    expect(memo).toContain('Outside the model (11)');
    expect(memo).toContain('Unresolved (8)');
    expect(memo).toContain('not an estimate of what S. 3877 would do');
  });
});

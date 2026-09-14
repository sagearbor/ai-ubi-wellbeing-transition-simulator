import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findFixture } from '../src/core/fixtures';
import type { CoreModel } from '../src/core/types';
import { coverage, validateDraft } from '../src/policy/draft';
import { modelHash, sha256Hex } from '../src/policy/hash';
import {
  PolicyNoApiKeyError,
  PolicyRateLimitError,
  PolicySourceTooLongError,
  _resetPolicyExtractionCountForTests,
  _setPolicyClientForTests,
  buildPolicyPrompt,
  extractPolicyDraft,
  hasPolicyApiKey,
  parsePolicyExtraction,
  MAX_POLICY_SOURCE_CHARS,
} from './policyExtract';

const training = findFixture('training-budget')!.model as CoreModel;
const cohort = findFixture('cohort-flow')!.model as CoreModel;
const retraining = findFixture('cohort-flow')!.overlays[0];

const SOURCE = `SEC. 2. FUNDING.
  (a) There is appropriated $15,000,000 for each of fiscal
years 2027 through 2029 to carry out training.
  (b) Participants shall receive child care assistance.
  (c) Training shall reduce unemployment by 30 percent.`;

const payload = (provisions: unknown[], extra: Record<string, unknown> = {}) => JSON.stringify({ title: 'Test Training Act', notes: 'one per subsection', provisions, ...extra });

const fund = {
  id: 'fund',
  quote: 'There is appropriated $15,000,000 for each of fiscal years 2027 through 2029 to carry out training.',
  summary: 'Training money.',
  status: 'mapped',
  role: 'funding',
  mapping: { kind: 'input', target: 'training_budget', op: 'set', curve: { '2026': 0, '2027': 15000000 }, unit: 'usd', evidenceLabel: 'sec. 2(a) amount; assumes it is all spent' },
};
const childCare = { id: 'child-care', quote: 'Participants shall receive child care assistance.', summary: 'Child care.', status: 'outside-model', role: 'control', reason: 'No take-up behaviour.' };

describe('buildPolicyPrompt', () => {
  it('lists only the model ids a mapping may target, with units and sources, and the rules', () => {
    const prompt = buildPolicyPrompt(training, SOURCE, { title: 'Test Training Act' });
    for (const id of ['cost_per_completion', 'instructor_capacity', 'training_budget', 'placements']) expect(prompt).toContain(id);
    expect(prompt).toContain('parameter placement_rate = 0.5 share (guess: illustrative)');
    expect(prompt).toContain('input training_budget [usd]');
    expect(prompt).toContain('verbatim');
    expect(prompt).toMatch(/Never invent a number/);
    expect(prompt).toContain('Separate policy controls from how the world responds');
  });

  it('includes targets from scenario overlays', () => {
    expect(buildPolicyPrompt(cohort, SOURCE)).not.toContain('retrainingParticipation');
    expect(buildPolicyPrompt(cohort, SOURCE, { overlays: [retraining] })).toContain('retrainingParticipation');
  });
});

describe('parsePolicyExtraction', () => {
  it('builds an ai-drafted draft pinned to the model and the exact source text', () => {
    const { draft, errors, demoted } = parsePolicyExtraction(payload([fund, childCare]), training, SOURCE, { url: 'https://example.gov/tta' }, 'test-model', '2026-09-13');
    expect(errors).toEqual([]);
    expect(demoted).toEqual([]);
    expect(draft).toMatchObject({
      reviewStatus: 'ai-drafted',
      draftedBy: { kind: 'ai', name: 'test-model', date: '2026-09-13' },
      modelId: 'training-budget',
      modelHash: modelHash(training),
      source: { title: 'Test Training Act', url: 'https://example.gov/tta', textSha256: sha256Hex(SOURCE), excerptChars: SOURCE.length },
    });
    const m = draft!.provisions[0].mapping!;
    expect(m.evidence.kind).toBe('assumed');
    expect(m.evidence.label).toContain('AI-drafted mapping');
    expect(validateDraft(draft!, training, { sourceText: SOURCE }).filter((d) => d.level === 'error')).toEqual([]);
    expect(coverage(draft!).allAccountedFor).toBe(true);
  });

  it('forces ai-drafted even when the model claims a review', () => {
    const { draft } = parsePolicyExtraction(payload([childCare], { reviewStatus: 'human-reviewed' }), training, SOURCE);
    expect(draft!.reviewStatus).toBe('ai-drafted');
    expect(draft!.reviewedBy).toBeUndefined();
  });

  it('demotes a mapped provision whose quote is not verbatim', () => {
    const paraphrase = { ...fund, quote: 'Congress appropriates fifteen million dollars a year for training.' };
    const { draft, demoted } = parsePolicyExtraction(payload([paraphrase]), training, SOURCE);
    expect(demoted).toHaveLength(1);
    expect(draft!.provisions[0].status).toBe('unresolved');
    expect(draft!.provisions[0].reason).toContain('not found verbatim');
  });

  it('accepts a quote that differs from the source only in whitespace', () => {
    const wrapped = { ...fund, quote: 'There is appropriated $15,000,000 for each of fiscal\n   years 2027 through 2029 to carry out training.' };
    const { demoted } = parsePolicyExtraction(payload([wrapped]), training, SOURCE);
    expect(demoted).toEqual([]);
  });

  it('demotes mappings to ids the model does not have, and effects over unknown symbols', () => {
    const unknownTarget = { ...fund, mapping: { ...fund.mapping, target: 'unemployment' } };
    const effect = {
      id: 'claim',
      quote: 'Training shall reduce unemployment by 30 percent.',
      summary: 'Claims an effect.',
      status: 'mapped',
      role: 'control',
      mapping: { kind: 'effect', target: 'placements', op: 'multiply', expr: '1 + unemployment_cut' },
    };
    const { draft, demoted } = parsePolicyExtraction(payload([unknownTarget, effect]), training, SOURCE);
    expect(demoted.map((d) => d.id)).toEqual(['fund', 'claim']);
    expect(draft!.provisions.every((p) => p.status === 'unresolved')).toBe(true);
    expect(draft!.provisions[1].reason).toContain('unemployment_cut');
  });

  it('marks a valid AI effect as a coefficient with an assumed source, which the validator then labels', () => {
    const effect = {
      id: 'claim',
      quote: 'Training shall reduce unemployment by 30 percent.',
      summary: 'Claims an effect.',
      status: 'mapped',
      role: 'control',
      mapping: { kind: 'effect', target: 'placements', op: 'multiply', expr: '1.3', evidenceLabel: 'the bill says 30 percent' },
    };
    const { draft } = parsePolicyExtraction(payload([effect]), training, SOURCE);
    const p = draft!.provisions[0];
    expect(p.status).toBe('mapped');
    expect(p.role).toBe('coefficient');
    expect(p.mapping!.evidence.kind).toBe('assumed');
    const ds = validateDraft(draft!, training, { sourceText: SOURCE });
    expect(ds.some((d) => d.code === 'coefficient-unsupported')).toBe(true);
  });

  it('fills a missing reason so the gap stays visible, and repairs an invalid status', () => {
    const { draft } = parsePolicyExtraction(payload([{ ...childCare, reason: undefined }, { ...childCare, id: 'x', status: 'sort-of' }]), training, SOURCE);
    expect(draft!.provisions[0].reason).toContain('a reviewer must supply one');
    expect(draft!.provisions[1].status).toBe('unresolved');
    expect(draft!.provisions[1].reason).toContain('no valid status');
  });

  it('rejects unparsable or wrongly shaped output without throwing', () => {
    expect(parsePolicyExtraction('not json', training, SOURCE).errors[0]).toContain('Could not parse JSON');
    expect(parsePolicyExtraction('{"provisions": "none"}', training, SOURCE).draft).toBeNull();
    expect(parsePolicyExtraction('{"provisions": []}', training, SOURCE).errors[0]).toContain('no provisions');
    const fenced = '```json\n' + payload([childCare]) + '\n```';
    expect(parsePolicyExtraction(fenced, training, SOURCE).errors).toEqual([]);
  });
});

describe('extractPolicyDraft with a mocked client', () => {
  const originalApiKey = process.env.API_KEY;
  const originalGeminiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    _resetPolicyExtractionCountForTests();
    _setPolicyClientForTests(null);
    delete process.env.API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    _setPolicyClientForTests(null);
    if (originalApiKey === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = originalApiKey;
    if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGeminiKey;
  });

  it('without a key, reports that extraction is off (manual drafts still work)', async () => {
    expect(hasPolicyApiKey()).toBe(false);
    await expect(extractPolicyDraft(training, SOURCE)).rejects.toBeInstanceOf(PolicyNoApiKeyError);
  });

  it('sends the prompt to the client and parses the response', async () => {
    const generateContent = vi.fn().mockResolvedValue({ text: payload([fund, childCare]) });
    _setPolicyClientForTests({ models: { generateContent } });
    expect(hasPolicyApiKey()).toBe(true);
    const out = await extractPolicyDraft(training, SOURCE, { title: 'Test Training Act' }, { model: 'mock-model' });
    expect(generateContent).toHaveBeenCalledTimes(1);
    const req = generateContent.mock.calls[0][0];
    expect(req.model).toBe('mock-model');
    expect(req.contents).toContain('training_budget');
    expect(out.draft?.reviewStatus).toBe('ai-drafted');
    expect(out.draft?.draftedBy?.name).toBe('mock-model');
    expect(out.draft?.provisions).toHaveLength(2);
  });

  it('refuses over-long text and trips the per-session limit on the 11th call', async () => {
    const generateContent = vi.fn().mockResolvedValue({ text: payload([childCare]) });
    _setPolicyClientForTests({ models: { generateContent } });
    await expect(extractPolicyDraft(training, 'x'.repeat(MAX_POLICY_SOURCE_CHARS + 1))).rejects.toBeInstanceOf(PolicySourceTooLongError);
    for (let i = 0; i < 10; i++) await extractPolicyDraft(training, SOURCE);
    await expect(extractPolicyDraft(training, SOURCE)).rejects.toBeInstanceOf(PolicyRateLimitError);
  });
});

/** Small hand-built drafts shared by the policy tests. Not bundled into the app. */
import { findFixture } from '../core/fixtures';
import type { CoreModel, Overlay } from '../core/types';
import { modelHash, sha256Hex } from './hash';
import type { PolicyDraft, Provision } from './types';

export const training = findFixture('training-budget')!.model as CoreModel;
export const cohort = findFixture('cohort-flow')!.model as CoreModel;
export const retraining = findFixture('cohort-flow')!.overlays[0] as Overlay;

export const SOURCE_TEXT = `SEC. 1. TRAINING FUND.
    (a) There is appropriated $12,000,000 for each of
fiscal years 2027 through 2029 for training.
    (b) Each participant shall receive a stipend.
    (c) The Secretary shall report annually.`;

export function draftFor(model: CoreModel, provisions: Provision[], extra: Partial<PolicyDraft> = {}): PolicyDraft {
  return {
    schemaVersion: 1,
    id: 'test-draft',
    title: 'Test draft',
    source: { title: 'Test Act', url: 'https://example.gov/test-act', textSha256: sha256Hex(SOURCE_TEXT), excerptChars: SOURCE_TEXT.length },
    modelId: model.id,
    modelHash: modelHash(model),
    provisions,
    reviewStatus: 'author-drafted',
    draftedBy: { kind: 'person', name: 'Test Author' },
    ...extra,
  };
}

export const budgetProvision: Provision = {
  id: 'fund',
  quote: 'There is appropriated $12,000,000 for each of fiscal years 2027 through 2029 for training.',
  summary: 'Sets a $12M training budget.',
  status: 'mapped',
  role: 'funding',
  mapping: {
    kind: 'input',
    target: 'training_budget',
    op: 'set',
    curve: { '2026': 0, '2027': 12_000_000 },
    unit: 'usd',
    evidence: { label: 'Test Act sec. 1(a)', kind: 'assumed', url: 'https://example.gov/test-act' },
  },
  reason: 'The only funding input.',
};

export const stipendProvision: Provision = {
  id: 'stipend',
  quote: 'Each participant shall receive a stipend.',
  summary: 'Stipends.',
  status: 'outside-model',
  role: 'control',
  reason: 'No participant income in the model.',
};

export const reportProvision: Provision = {
  id: 'report',
  quote: 'The Secretary shall report annually.',
  summary: 'Reporting.',
  status: 'unresolved',
  role: 'control',
  reason: 'Could inform placement_rate later; sets no number.',
};

export function threeStatusDraft(extra: Partial<PolicyDraft> = {}): PolicyDraft {
  return draftFor(training, [budgetProvision, stipendProvision, reportProvision], extra);
}

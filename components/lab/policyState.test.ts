import { describe, expect, it } from 'vitest';
import { findFixture } from '../../src/core/fixtures';
import type { CoreModel } from '../../src/core/types';
import { decodeLabLink, encodeLabLink, openLabLink } from '../../src/policy/bundle';
import { validateDraft } from '../../src/policy/draft';
import { findPolicyExample } from '../../src/policy/examples';
import { modelHash } from '../../src/policy/hash';
import { SOURCE_TEXT, threeStatusDraft } from '../../src/policy/testDrafts';
import {
  addProvision,
  copyAsDraftB,
  defaultMapping,
  linkStateFor,
  parseCurveText,
  removeProvision,
  repin,
  runKey,
  setProvisionStatus,
  splitScenarioOverlays,
  targetOptions,
  updateMapping,
  updateProvision,
  withEdit,
} from './policyState';

const training = findFixture('training-budget')!.model as CoreModel;
const cohortEntry = findFixture('cohort-flow')!;
const cohort = cohortEntry.model;

describe('policyState', () => {
  it('offers only the scenario ids a mapping may target', () => {
    expect(targetOptions(training, [], 'parameter').map((o) => o.id)).toContain('placement_rate');
    expect(targetOptions(training, [], 'input').map((o) => o.id)).toEqual(['training_budget']);
    expect(targetOptions(cohort, [], 'input').map((o) => o.id)).not.toContain('retrainingParticipation');
    expect(targetOptions(cohort, cohortEntry.overlays, 'input').map((o) => o.id)).toContain('retrainingParticipation');
    expect(defaultMapping(training, [], 'input')).toMatchObject({ kind: 'input', target: 'training_budget', op: 'set', unit: 'usd' });
  });

  it('marking a provision mapped gives it a mapping that validates once its evidence is labelled', () => {
    let d = threeStatusDraft();
    d = setProvisionStatus(d, 1, 'mapped', training, []);
    expect(d.provisions[1].mapping?.target).toBe('training_budget');
    d = updateMapping(d, 1, { kind: 'parameter' }, training, []);
    expect(d.provisions[1].mapping).toMatchObject({ kind: 'parameter', op: 'set' });
    d = updateMapping(d, 1, { target: 'suitable_openings', value: 1200, evidence: { label: 'assumed: author choice', kind: 'assumed' } }, training, []);
    expect(d.provisions[1].mapping?.unit).toBe('people');
    d = updateProvision(d, 1, { reason: 'test' });
    // the first provision already sets training_budget; this one sets a parameter, so no conflict
    const errors = validateDraft(d, training, { sourceText: SOURCE_TEXT }).filter((x) => x.level === 'error');
    expect(errors).toEqual([]);
  });

  it('adds and removes provisions with unique ids', () => {
    let d = addProvision(threeStatusDraft());
    d = addProvision(d);
    expect(d.provisions.map((p) => p.id).slice(-2)).toEqual(['provision-4', 'provision-5']);
    expect(removeProvision(d, 0).provisions).toHaveLength(4);
  });

  it('editing a human-reviewed draft sets it back to author-drafted; changing only the status does not', () => {
    const reviewed = threeStatusDraft({ reviewStatus: 'human-reviewed', reviewedBy: { name: 'Reviewer' } });
    const edited = updateProvision(reviewed, 0, { summary: 'changed' });
    expect(edited.reviewStatus).toBe('author-drafted');
    expect(edited.reviewedBy).toBeUndefined();
    const same = withEdit(reviewed, { ...reviewed });
    expect(same.reviewStatus).toBe('human-reviewed');
  });

  it('draft B is an independent copy on the same model', () => {
    const a = threeStatusDraft({ reviewStatus: 'human-reviewed', reviewedBy: { name: 'R' } });
    const b = copyAsDraftB(a);
    expect(b.id).toBe('test-draft-b');
    expect(b.reviewStatus).toBe('author-drafted');
    expect(b.modelHash).toBe(a.modelHash);
    b.provisions[0].mapping!.evidence.label = 'changed';
    expect(a.provisions[0].mapping!.evidence.label).toBe('Test Act sec. 1(a)');
  });

  it('re-pins a draft to the loaded model version', () => {
    const d = { ...threeStatusDraft(), modelHash: 'old' };
    expect(repin(d, training).modelHash).toBe(modelHash(training));
  });

  it('parses curves typed by hand', () => {
    expect(parseCurveText('2026: 0, 2027: 12_000_000').curve).toEqual({ '2026': 0, '2027': 12000000 });
    expect(parseCurveText('{"2030": 1.5}').curve).toEqual({ '2030': 1.5 });
    expect(parseCurveText('soon: 3').error).toContain('not a year');
    expect(parseCurveText('2026: lots').error).toContain('not a number');
  });

  it('splits a shared scenario into fixture toggles and your own overlays, by content', () => {
    const tampered = { ...cohortEntry.overlays[0], description: 'edited' };
    const custom = { id: 'lab-parameter-edits', parameters: [{ id: 'workforce', value: 1 }] };
    expect(splitScenarioOverlays(cohortEntry, [cohortEntry.overlays[0], custom])).toEqual({ overlayIds: ['retraining'], custom: [custom] });
    expect(splitScenarioOverlays(cohortEntry, [tampered]).custom).toEqual([tampered]);
  });

  it('a link built from the panel state reopens the same drafts, and the run key tracks every input', () => {
    const ex = findPolicyExample('s3877-itwa-2026')!;
    const state = linkStateFor(training, [], [ex.draft], 200, 1);
    const decoded = decodeLabLink(encodeLabLink(state));
    expect(decoded.ok).toBe(true);
    const opened = openLabLink(decoded.value!, (id) => findFixture(id)?.model);
    expect(opened.ok).toBe(true);
    expect(opened.value!.drafts[0]).toEqual(ex.draft);
    const k = runKey(training, [], ex.draft, 200, 1);
    expect(runKey(training, [], ex.draft, 200, 2)).not.toBe(k);
    expect(runKey(training, [], { ...ex.draft, title: 'x' }, 200, 1)).not.toBe(k);
    expect(runKey(training, [], ex.draft, 200, 1)).toBe(k);
  });
});

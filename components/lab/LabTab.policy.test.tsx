/**
 * Model Lab, stage 5: the Policy panel (paste, inspect assumptions, run, explain limits, share,
 * reopen). Rendered to a string like LabTab.test.tsx — there is no jsdom — so clicks are covered by
 * policyState.test.ts and the pure modules under src/policy; this checks what a reader sees.
 */

import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import LabTab from './LabTab';
import { findFixture } from '../../src/core/fixtures';
import { encodeLabLink, LAB_HASH_PREFIX } from '../../src/policy/bundle';
import { findPolicyExample } from '../../src/policy/examples';
import { modelHash } from '../../src/policy/hash';

const html = (props: React.ComponentProps<typeof LabTab> = {}): string => renderToString(React.createElement(LabTab, props)).replace(/<!-- -->/g, '');
const example = findPolicyExample('s3877-itwa-2026')!;

const exampleHtml = () =>
  html({
    initialModelId: 'training-budget',
    initialHash: '',
    initialPolicy: {
      drafts: [example.draft],
      source: { title: example.source.title, url: example.source.url, text: example.source.text },
      runs: 60,
      seed: 1,
      run: true,
    },
  });

describe('LabTab Policy panel (renders)', () => {
  it('is on the page with honest framing, and extraction is optional', () => {
    const out = html({ initialModelId: 'training-budget', initialHash: '' });
    expect(out).toContain('Policy: read a text against this model');
    expect(out).toContain('not a prediction of what the policy');
    expect(out).toContain('Start a manual draft');
    expect(out).toContain('Load worked example');
    // tests run without a Gemini key: the button is disabled and says why
    expect(out).toContain('AI extraction is off');
    // the existing Lab sections are still there, with the policy panel before the files
    expect(out.indexOf('What limits the result')).toBeLessThan(out.indexOf('Policy: read a text against this model'));
    expect(out.indexOf('Policy: read a text against this model')).toBeLessThan(out.indexOf('Advanced: model file'));
  });

  it('shows the worked example: coverage, review status, provisions and evidence', () => {
    const out = exampleHtml();
    expect(out).toContain('1 of 20 provisions mapped, 8 unresolved, 11 outside model');
    expect(out).toContain('every provision accounted for');
    expect(out).toContain('author-drafted');
    expect(out).toContain('sec5b2-ndwg-authorization');
    expect(out).toContain('outside-model');
    expect(out).toContain('assumed · assumption');
    expect(out).not.toContain('quote-not-found');
  });

  it('runs the paired comparison and explains what limits it', () => {
    const out = exampleHtml();
    expect(out).toContain('paired difference A');
    expect(out).toContain('over 60 paired draws, seed 1');
    expect(out).toContain('What limits it in 2029');
    expect(out).toContain('completions is limited by instructor_capacity');
    expect(out).toContain('What this model cannot say about this text');
    expect(out).toContain('Decision memo (Markdown)');
    expect(out).toContain('Download bundle');
  });

  it('opens a #lab= link on its pinned model and scenario, and re-runs it', () => {
    const cohort = findFixture('cohort-flow')!;
    const draft = {
      ...example.draft,
      id: 'cohort-link',
      modelId: 'cohort-flow',
      modelHash: modelHash(cohort.model),
      provisions: example.draft.provisions.filter((p) => p.status !== 'mapped'),
    };
    const hash = `${LAB_HASH_PREFIX}${encodeLabLink({ v: 1, modelId: 'cohort-flow', modelHash: modelHash(cohort.model), overlays: [cohort.overlays[0]], drafts: [draft], runs: 3, seed: 5 })}`;
    const out = html({ initialHash: hash });
    expect(out).toContain('Opened a shared policy scenario');
    expect(out).toContain('value="cohort-flow" selected=""');
    expect(out).toContain('Baseline: cohort-flow with retraining');
    expect(out).toContain('over 3 paired draws, seed 5');
  });

  it('reports a link it cannot open instead of opening a different baseline', () => {
    const stale = `${LAB_HASH_PREFIX}${encodeLabLink({ v: 1, modelId: 'training-budget', modelHash: '0000000000000000', overlays: [], drafts: [example.draft], runs: 3, seed: 1 })}`;
    const out = html({ initialHash: stale });
    expect(out).toContain('Cannot open this lab link');
    expect(out).toContain('would silently use a different baseline');
    expect(out).not.toContain('sec5b2-ndwg-authorization');

    const unknown = `${LAB_HASH_PREFIX}${encodeLabLink({ v: 1, modelId: 'gate-2027', modelHash: 'abc', overlays: [], drafts: [example.draft], runs: 3, seed: 1 })}`;
    expect(html({ initialHash: unknown })).toContain('which this version of the app does not include');
    expect(html({ initialHash: '#lab=not-a-real-payload!!' })).toContain('Cannot open this lab link');
  });
});

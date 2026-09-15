/**
 * Model Lab, stage 5: the Policy panel (paste, inspect assumptions, run, explain limits, share,
 * reopen). Rendered to a string like LabTab.test.tsx — there is no jsdom — so clicks are covered by
 * policyState.test.ts and the pure modules under src/policy; this checks what a reader sees.
 */

import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import LabTab from './LabTab';
import { NUMERICAL_CONVENTIONS, ENGINE_VERSION } from '../../src/core/engine';
import { findFixture } from '../../src/core/fixtures';
import { encodeLabLink, LAB_HASH_PREFIX } from '../../src/policy/bundle';
import { findPolicyExample } from '../../src/policy/examples';
import { modelHash } from '../../src/policy/hash';
import { hasPolicyApiKey } from '../../services/policyExtract';

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
    // Vite's define inlines GEMINI_API_KEY from .env.local when present, so the key state depends on
    // the checkout: without a key the button is disabled and says why; with one, no such notice.
    if (hasPolicyApiKey()) expect(out).not.toContain('AI extraction is off');
    else expect(out).toContain('AI extraction is off');
    // the existing Lab sections are still there, with the policy panel before the files
    expect(out.indexOf('What limits the result')).toBeLessThan(out.indexOf('Policy: read a text against this model'));
    expect(out.indexOf('Policy: read a text against this model')).toBeLessThan(out.indexOf('Advanced: model file'));
  });

  it('shows the worked example: coverage, review status, provisions and evidence', () => {
    const out = exampleHtml();
    expect(out).toContain('1 of 23 provisions mapped, 10 unresolved, 12 outside model — every listed provision has a status');
    expect(out).not.toContain('accounted for');
    expect(out).toContain('Quotation coverage: 79 of 79 source clauses covered or explicitly excluded (23 by a provision quote, 56 excluded)');
    expect(out).toContain('Completeness: completeness not attested');
    expect(out).toContain('Source clauses (79; 0 neither quoted nor excluded)');
    expect(out).not.toContain('Run is disabled');
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
      clauseDispositions: example.draft.clauseDispositions?.map((d) => d.provisionIds?.some((id) => example.draft.provisions.some((p) => p.id === id && p.status === 'mapped')) ? { ...d, status: 'unresolved' as const, provisionIds: undefined, reason: 'Mapped channel omitted in the cohort test scenario.' } : d),
    };
    const hash = `${LAB_HASH_PREFIX}${encodeLabLink({ v: 2, modelId: 'cohort-flow', modelHash: modelHash(cohort.model), engineVersion: ENGINE_VERSION, numerical: NUMERICAL_CONVENTIONS, overlays: [cohort.overlays[0]], drafts: [draft], runs: 3, seed: 5 })}`;
    const out = html({ initialHash: hash });
    expect(out).toContain('Opened a shared policy scenario');
    expect(out).toContain('value="cohort-flow" selected=""');
    expect(out).toContain('Baseline: cohort-flow with retraining');
    // cohort-flow declares no ranges: the comparison runs once, and says so instead of claiming 3 draws
    expect(out).toContain('deterministic: uncertainty off');
    expect(out).not.toContain('over 3 paired draws');
    // a link carries no source text: coverage is unknown, and it says so
    expect(out).toContain('Quotation coverage: source unavailable — coverage unknown');
  });

  it('reports a link it cannot open instead of opening a different baseline', () => {
    const stale = `${LAB_HASH_PREFIX}${encodeLabLink({ v: 2, modelId: 'training-budget', modelHash: '0000000000000000', engineVersion: ENGINE_VERSION, numerical: NUMERICAL_CONVENTIONS, overlays: [], drafts: [example.draft], runs: 3, seed: 1 })}`;
    const out = html({ initialHash: stale });
    expect(out).toContain('Cannot open this lab link');
    expect(out).toContain('would silently use a different baseline');
    expect(out).not.toContain('sec5b2-ndwg-authorization');

    const unknown = `${LAB_HASH_PREFIX}${encodeLabLink({ v: 2, modelId: 'gate-2027', modelHash: 'abc', engineVersion: ENGINE_VERSION, numerical: NUMERICAL_CONVENTIONS, overlays: [], drafts: [example.draft], runs: 3, seed: 1 })}`;
    expect(html({ initialHash: unknown })).toContain('which this version of the app does not include');
    expect(html({ initialHash: '#lab=not-a-real-payload!!' })).toContain('Cannot open this lab link');

    const otherEngine = `${LAB_HASH_PREFIX}${encodeLabLink({ v: 2, modelId: 'training-budget', modelHash: modelHash(findFixture('training-budget')!.model), engineVersion: 'core-0.0.0', overlays: [], drafts: [example.draft], runs: 3, seed: 1 })}`;
    const eng = html({ initialHash: otherEngine });
    expect(eng).toContain('Cannot open this lab link');
    expect(eng).toContain('this app runs engine');
  });

  it('refuses a link whose draft has validation errors, and never runs it', () => {
    const training = findFixture('training-budget')!.model;
    const mapped = example.draft.provisions.find((p) => p.status === 'mapped')!;
    const bad = { ...example.draft, provisions: [...example.draft.provisions, { ...mapped, id: 'second-setter', mapping: { ...mapped.mapping!, op: 'set' as const, value: 1 } }] };
    const hash = `${LAB_HASH_PREFIX}${encodeLabLink({ v: 2, modelId: 'training-budget', modelHash: modelHash(training), engineVersion: ENGINE_VERSION, numerical: NUMERICAL_CONVENTIONS, overlays: [], drafts: [bad], runs: 3, seed: 1 })}`;
    const out = html({ initialHash: hash });
    expect(out).toContain('Cannot open this lab link');
    expect(out).toContain('set-add-ambiguous');
    expect(out).not.toContain('paired difference A');
  });

  it('disables Run and lists the blocking errors when a loaded draft is invalid', () => {
    const mapped = example.draft.provisions.find((p) => p.status === 'mapped')!;
    const twenty = { ...mapped, mapping: { ...mapped.mapping!, value: 20, unit: 'people' } };
    const bad = { ...example.draft, provisions: example.draft.provisions.map((p) => (p.id === mapped.id ? twenty : p)) };
    const out = html({
      initialModelId: 'training-budget',
      initialHash: '',
      initialPolicy: { drafts: [bad], source: { title: example.source.title, url: example.source.url, text: example.source.text }, runs: 5, seed: 1, run: true },
    });
    expect(out).toContain('Run is disabled: fix these validation errors first.');
    expect(out).toContain('unit-mismatch');
    expect(out).toContain('20 people → training_budget (usd)');
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Run paired comparison/);
    expect(out).not.toContain('paired difference A');
    // the run-on-mount attempt was refused too: its result reports the draft was not run
    expect(out).toContain('was not run');
  });
});

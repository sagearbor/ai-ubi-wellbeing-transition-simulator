/**
 * A tiny, self-contained FuturesGraph + two interventions used ONLY by this package's
 * typecheck and smoke test, and handy for rendering FuturesTab in isolation.
 *
 * This is NOT the seed graph. The real one lives in data/futures/graph.json (package B)
 * and is wired in by the integrator. Every number here is editorial and deliberately
 * round so the test assertions stay readable.
 */

import { FuturesGraph, Intervention } from '../../src/futures/types';

const EDITORIAL = 'Editorial fixture value; not a forecast. Used only by the futures UI smoke test.';

export const devGraph: FuturesGraph = {
  schemaVersion: 1,
  graphVersion: '0000-00-00-dev',
  title: 'Dev futures fixture',
  description: 'Three events and three world-states, enough to exercise every futures component.',
  startYear: 2026,
  endYear: 2045,
  horizons: [2030, 2035, 2045],
  axis: {
    id: 'world-state',
    label: 'How is the world doing?',
    states: ['fx-flourishing', 'fx-muddling', 'fx-existential'],
    horizons: [2030, 2035, 2045],
    absorbing: ['fx-existential'],
    floorGoodness: 20,
    ceilingGoodness: 90,
  },
  nodes: [
    {
      id: 'fx-agi',
      kind: 'event',
      label: 'AGI-level systems exist',
      lane: 'capability',
      valence: 'neutral',
      severity: 'none',
      summary: 'Systems that match expert humans across most economically valuable cognitive work.',
      operationalisation: 'A public system passes an expert-panel battery across ten professional domains.',
      seed: { curve: { 2030: 0.45, 2035: 0.7, 2045: 0.85 }, basis: EDITORIAL, confidence: 'low' },
    },
    {
      id: 'fx-redistribution',
      kind: 'event',
      label: 'Redistribution keeps pace',
      lane: 'economy',
      valence: 'good',
      summary: 'Transfers grow fast enough to hold median purchasing power steady through displacement.',
      operationalisation: 'Median real disposable income is flat or rising across G20 members.',
      narrative: 'The boring good ending: the money moves before the anger does.',
      seed: {
        curve: { 2030: 0.1, 2035: 0.3, 2045: 0.5 },
        basis: EDITORIAL,
        confidence: 'low',
        sources: [{ label: 'Fixture placeholder', kind: 'editorial' }],
      },
    },
    {
      id: 'fx-takeover',
      kind: 'event',
      label: 'Misaligned AI takeover',
      lane: 'catastrophe',
      valence: 'bad',
      severity: 'existential',
      summary: 'An unaligned system durably seizes decisive control of critical infrastructure.',
      operationalisation: 'Irreversible loss of human control over a majority of frontier compute.',
      seed: { curve: { 2030: 0.02, 2035: 0.06, 2045: 0.09 }, basis: EDITORIAL, confidence: 'low' },
      parents: [
        {
          from: 'fx-agi',
          kind: 'requires',
          strength: 0.8,
          lag: 1,
          note: 'A takeover needs a system capable of it, so it cannot outrun AGI.',
        },
      ],
    },
    {
      id: 'fx-flourishing',
      kind: 'state',
      label: 'Flourishing',
      shortLabel: 'Flourish',
      valence: 'good',
      goodness: 90,
      summary: 'Broad material abundance with the gains widely shared.',
      seed: { curve: { 2026: 0.01, 2030: 0.05, 2035: 0.15, 2045: 0.28 }, basis: EDITORIAL, confidence: 'low' },
      parents: [
        {
          from: 'fx-redistribution',
          kind: 'amplifies',
          strength: 0.9,
          note: 'Without a transfer institution the upside concentrates instead of spreading.',
        },
      ],
    },
    {
      id: 'fx-muddling',
      kind: 'state',
      label: 'Muddling through',
      shortLabel: 'Muddle',
      valence: 'mixed',
      goodness: 60,
      summary: 'Roughly today, with more automation and the same arguments.',
      seed: { curve: { 2026: 0.97, 2030: 0.73, 2035: 0.6, 2045: 0.53 }, basis: EDITORIAL, confidence: 'low' },
    },
    {
      id: 'fx-existential',
      kind: 'state',
      label: 'Existential',
      shortLabel: 'X-risk',
      valence: 'bad',
      severity: 'existential',
      goodness: 0,
      summary: 'Permanent curtailment of humanity’s long-term potential.',
      seed: { curve: { 2026: 0.002, 2030: 0.02, 2035: 0.05, 2045: 0.08 }, basis: EDITORIAL, confidence: 'low' },
      parents: [
        {
          from: 'fx-takeover',
          kind: 'amplifies',
          strength: 0.9,
          note: 'A successful takeover is the dominant pathway into this state.',
        },
      ],
    },
  ],
  metadata: {
    editors: ['fixture'],
    changelog: [{ graphVersion: '0000-00-00-dev', date: '2026-09-10', note: 'Fixture created for the futures UI tests.' }],
  },
};

export const devInterventions: Intervention[] = [
  {
    schemaVersion: 1,
    id: 'fx-dividend',
    label: 'AI dividend fund',
    summary: 'A statutory levy on AI-attributable revenue paid out as a per-capita dividend.',
    source: { kind: 'editorial', title: 'Fixture' },
    tier: 'locked',
    status: 'locked',
    cost: { band: 4, note: 'Fixture cost band.' },
    startYear: 2028,
    nudges: [{ node: 'fx-redistribution', direction: 'up', magnitude: 'strong', lag: 2 }],
  },
  {
    schemaVersion: 1,
    id: 'fx-evals',
    label: 'Mandatory frontier evals',
    summary: 'Pre-deployment evaluation of frontier models against dangerous-capability thresholds.',
    source: { kind: 'editorial', title: 'Fixture' },
    tier: 'locked',
    status: 'locked',
    cost: { band: 2 },
    startYear: 2027,
    nudges: [{ node: 'fx-takeover', direction: 'down', magnitude: 'moderate', lag: 1 }],
  },
];

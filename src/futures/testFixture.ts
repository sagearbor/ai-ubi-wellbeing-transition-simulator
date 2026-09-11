/**
 * AI Futures Map — a small, self-contained graph + interventions used by the unit tests.
 *
 * Deliberately NOT the real seed graph (`data/futures/graph.json`): these tests are about the
 * engine's algebra, so the fixture is kept small enough to reason about by hand and stable
 * enough that a content edit to the real graph never breaks an engine test.
 *
 * Shape mirrors the real thing: 5 event nodes across four lanes, 4 world-states on one axis
 * with an absorbing worst state, a `requires` edge, a zero-lag chain, and a *lagged* feedback
 * cycle (redistribution <-> oligarchic capture) that must be legal.
 *
 * All numbers here are editorial placeholders for testing only; they carry no basis and must
 * never be copied into the real graph.
 */

import { FuturesGraph, Intervention } from './types';

const editorial = (what: string) => `Editorial test fixture value (${what}); not a real estimate.`;

export const fixtureGraph: FuturesGraph = {
  schemaVersion: 1,
  graphVersion: 'test-0001',
  title: 'Futures test fixture',
  description: 'Synthetic graph used by the src/futures unit tests. Not real content.',
  startYear: 2026,
  endYear: 2045,
  horizons: [2030, 2035, 2045],
  axis: {
    id: 'world-state',
    label: 'World state',
    states: ['flourishing', 'muddling', 'stratified', 'collapse'],
    horizons: [2030, 2035, 2045],
    absorbing: ['collapse'],
    floorGoodness: 20,
    ceilingGoodness: 90,
  },
  nodes: [
    // ----- events -----
    {
      id: 'frontier-agi',
      kind: 'event',
      lane: 'capability',
      label: 'Frontier system matches expert humans on most cognitive work',
      shortLabel: 'Frontier AGI',
      valence: 'mixed',
      severity: 'disruptive',
      summary: 'A deployed system matches or beats expert humans across most remote cognitive tasks.',
      operationalisation: 'Fixture only: resolves true when the fixture says so.',
      seed: {
        curve: { '2026': 0.02, '2030': 0.15, '2035': 0.4, '2045': 0.7 },
        basis: editorial('capability ramp'),
        confidence: 'low',
      },
    },
    {
      id: 'cheap-robotics',
      kind: 'event',
      lane: 'capability',
      label: 'General-purpose robotics cheaper than median manual labour',
      shortLabel: 'Cheap robotics',
      valence: 'mixed',
      summary: 'Physical automation follows the cognitive automation it depends on.',
      operationalisation: 'Fixture only.',
      // NOTE: seeded strictly BELOW its `requires` parent at every horizon, so the baseline
      // already satisfies the clamp and `solve` with no shifts reproduces the seed exactly.
      seed: {
        curve: { '2026': 0.01, '2030': 0.08, '2035': 0.3, '2045': 0.6 },
        basis: editorial('robotics ramp, held under its prerequisite'),
        confidence: 'low',
      },
      parents: [
        {
          from: 'frontier-agi',
          kind: 'requires',
          strength: 0.6,
          lag: 0,
          note: 'Cheap general-purpose robotics presupposes the cognitive capability that plans and controls it.',
        },
      ],
    },
    {
      id: 'frontier-evals',
      kind: 'event',
      lane: 'governance',
      label: 'Mandatory pre-deployment evaluations for frontier models',
      shortLabel: 'Frontier evals',
      valence: 'good',
      summary: 'A binding evaluation regime gates frontier deployments in the major jurisdictions.',
      operationalisation: 'Fixture only.',
      seed: {
        curve: { '2026': 0.2, '2030': 0.35, '2035': 0.5, '2045': 0.6 },
        basis: editorial('governance ramp'),
        confidence: 'low',
      },
    },
    {
      id: 'redistribution',
      kind: 'event',
      lane: 'economy',
      label: 'Broad AI-funded redistribution in force',
      shortLabel: 'Redistribution',
      valence: 'good',
      summary: 'A durable transfer of AI-attributable income reaches most of the population.',
      operationalisation: 'Fixture only.',
      seed: {
        curve: { '2026': 0.05, '2030': 0.12, '2035': 0.25, '2045': 0.4 },
        basis: editorial('policy ramp'),
        confidence: 'low',
      },
      parents: [
        {
          from: 'oligarchic-capture',
          kind: 'dampens',
          strength: -0.5,
          lag: 1,
          note: 'Concentrated ownership lobbies against transfers; the effect shows up a year later.',
        },
      ],
    },
    {
      id: 'oligarchic-capture',
      kind: 'event',
      lane: 'society',
      label: 'Durable concentration of AI rents in a few hands',
      shortLabel: 'Oligarchic capture',
      valence: 'bad',
      summary: 'AI-attributable income concentrates and entrenches itself politically.',
      operationalisation: 'Fixture only.',
      seed: {
        curve: { '2026': 0.1, '2030': 0.2, '2035': 0.35, '2045': 0.5 },
        basis: editorial('concentration ramp'),
        confidence: 'low',
      },
      parents: [
        {
          from: 'cheap-robotics',
          kind: 'amplifies',
          strength: 0.4,
          lag: 0,
          note: 'Physical automation removes the last labour bargaining chip, so rents concentrate faster.',
        },
        {
          from: 'redistribution',
          kind: 'dampens',
          strength: -0.3,
          lag: 2,
          note: 'Transfers erode the concentration that produced them — the lag makes this cycle legal.',
        },
      ],
    },
    // ----- world-states -----
    {
      id: 'flourishing',
      kind: 'state',
      label: 'Broad flourishing',
      valence: 'good',
      goodness: 90,
      summary: 'Abundance is widely shared; wellbeing rises across the distribution.',
      seed: {
        curve: { '2026': 0.01, '2030': 0.05, '2035': 0.12, '2045': 0.25 },
        basis: editorial('state marginal'),
        confidence: 'low',
      },
      parents: [
        { from: 'redistribution', kind: 'enables', strength: 0.6, lag: 0, note: 'Shared gains are what makes this state reachable.' },
        { from: 'frontier-agi', kind: 'amplifies', strength: 0.2, lag: 1, note: 'More capability raises the ceiling once the gains are shared.' },
      ],
    },
    {
      id: 'muddling',
      kind: 'state',
      label: 'Muddling through',
      valence: 'neutral',
      goodness: 60,
      summary: 'Uneven gains, uneven losses, no discontinuity.',
      seed: {
        curve: { '2026': 0.96, '2030': 0.8, '2035': 0.62, '2045': 0.45 },
        basis: editorial('state marginal, 2026 start distribution'),
        confidence: 'low',
      },
    },
    {
      id: 'stratified',
      kind: 'state',
      label: 'Stratified abundance',
      valence: 'bad',
      goodness: 40,
      summary: 'Enormous aggregate output, narrowly held; most people are worse off relatively.',
      seed: {
        curve: { '2026': 0.02, '2030': 0.1, '2035': 0.18, '2045': 0.2 },
        basis: editorial('state marginal'),
        confidence: 'low',
      },
      parents: [
        { from: 'oligarchic-capture', kind: 'amplifies', strength: 0.5, lag: 0, note: 'Capture is the direct route into this state.' },
      ],
    },
    {
      id: 'collapse',
      kind: 'state',
      label: 'Civilisational collapse',
      valence: 'bad',
      goodness: 0,
      severity: 'existential',
      summary: 'An unrecovered catastrophe. Absorbing.',
      seed: {
        curve: { '2026': 0.01, '2030': 0.05, '2035': 0.08, '2045': 0.1 },
        basis: editorial('state marginal'),
        confidence: 'low',
      },
      parents: [
        { from: 'frontier-evals', kind: 'prevents', strength: -0.5, lag: 1, note: 'Catching a dangerous capability before deployment removes one route in.' },
      ],
    },
  ],
  metadata: {
    editors: ['test-fixture'],
    changelog: [{ graphVersion: 'test-0001', date: '2026-09-10', note: 'Fixture created for the engine tests.' }],
  },
};

export const fixtureInterventions: Intervention[] = [
  {
    schemaVersion: 1,
    id: 'dividend-fund',
    label: 'AI dividend fund',
    summary: 'A levy on AI-attributable revenue paid out as a per-capita dividend.',
    source: { kind: 'proposal', title: 'Fixture proposal' },
    tier: 'locked',
    status: 'reviewed',
    cost: { band: 4, note: editorial('cost band') },
    startYear: 2028,
    nudges: [
      { node: 'redistribution', direction: 'up', magnitude: 'strong', lag: 2 },
      { node: 'oligarchic-capture', direction: 'down', magnitude: 'slight', lag: 3 },
    ],
  },
  {
    schemaVersion: 1,
    id: 'compute-treaty',
    label: 'Compute treaty',
    summary: 'A verified cap on frontier training compute, with mandatory evaluations attached.',
    source: { kind: 'proposal', title: 'Fixture proposal' },
    tier: 'locked',
    status: 'reviewed',
    cost: { band: 3, note: editorial('cost band') },
    startYear: 2029,
    nudges: [
      { node: 'frontier-agi', direction: 'down', magnitude: 'moderate', lag: 1 },
      { node: 'frontier-evals', direction: 'up', magnitude: 'moderate' },
    ],
  },
  {
    schemaVersion: 1,
    id: 'resilience-enclaves',
    label: 'Resilience enclaves',
    summary: 'Hardened, self-sufficient regions that survive a catastrophe without moving the median.',
    source: { kind: 'proposal', title: 'Fixture proposal' },
    tier: 'locked',
    status: 'reviewed',
    cost: { band: 2, note: editorial('cost band') },
    startYear: 2027,
    nudges: [{ node: 'collapse', direction: 'down', magnitude: 'moderate' }],
  },
];

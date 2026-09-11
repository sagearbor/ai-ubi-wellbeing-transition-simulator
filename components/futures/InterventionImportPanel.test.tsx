import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { InterventionImportPanel } from './InterventionImportPanel';
import { FuturesGraph } from '../../src/futures/types';

const graph: FuturesGraph = {
  schemaVersion: 1,
  graphVersion: '2026-09-10',
  startYear: 2026,
  endYear: 2045,
  horizons: [2028, 2030, 2035, 2045],
  axis: {
    id: 'world-state',
    label: 'World state',
    states: ['flourishing', 'muddling'],
    horizons: [2030, 2035, 2045],
  },
  nodes: [
    {
      id: 'agi',
      kind: 'event',
      lane: 'capability',
      valence: 'mixed',
      label: 'AGI exists',
      summary: 'AI systems match or exceed human performance on most cognitive tasks.',
      operationalisation: 'A system passes a broad battery of expert-level cognitive benchmarks.',
      seed: { curve: { '2030': 0.2 }, basis: 'editorial', confidence: 'low' },
    },
    {
      id: 'compute-treaty',
      kind: 'event',
      lane: 'governance',
      valence: 'good',
      label: 'Compute treaty ratified',
      summary: 'A binding international treaty caps or monitors frontier compute.',
      operationalisation: 'A treaty with verification provisions is ratified by 3+ major compute powers.',
      seed: { curve: { '2030': 0.1 }, basis: 'editorial', confidence: 'low' },
    },
    {
      id: 'flourishing',
      kind: 'state',
      goodness: 90,
      valence: 'good',
      label: 'Flourishing',
      summary: 'Broad abundance.',
      seed: { curve: { '2030': 0.5 }, basis: 'editorial', confidence: 'low' },
    },
    {
      id: 'muddling',
      kind: 'state',
      goodness: 60,
      valence: 'neutral',
      label: 'Muddling',
      summary: 'Roughly like today.',
      seed: { curve: { '2030': 0.5 }, basis: 'editorial', confidence: 'low' },
    },
  ],
  metadata: { editors: [], changelog: [] },
};

describe('InterventionImportPanel', () => {
  it('renders without crashing (smoke test)', () => {
    const html = renderToString(<InterventionImportPanel graph={graph} onAdd={() => {}} />);
    expect(html).toContain('Paste a bill');
    expect(html).toContain('Extract');
    expect(html).toContain('Start from blank card');
  });

  it('does not render a review card before any extraction happens', () => {
    const html = renderToString(<InterventionImportPanel graph={graph} onAdd={() => {}} />);
    expect(html).not.toContain('AI-drafted, unreviewed');
    expect(html).not.toContain('Review card');
  });
});

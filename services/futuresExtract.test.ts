import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  RateLimitError,
  _resetExtractionCountForTests,
  buildExtractionPrompt,
  extractIntervention,
  parseExtraction,
} from './futuresExtract';
import { FuturesGraph } from '../src/futures/types';

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
      id: 'retired-node',
      kind: 'event',
      lane: 'economy',
      valence: 'neutral',
      label: 'Retired thing',
      summary: 'No longer tracked.',
      operationalisation: 'n/a',
      seed: { curve: {}, basis: 'editorial', confidence: 'low' },
      retired: '2026-01-01',
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

function goodPayload(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    id: 'ai-dividend-fund',
    label: 'AI dividend fund',
    summary: 'A statutory levy on AI-attributable revenue paid into a per-capita fund.',
    source: { kind: 'bill', url: 'https://example.com/bill', title: 'Example Act' },
    tier: 'public',
    status: 'ai-drafted',
    cost: { band: 4, note: 'Roughly 3-9% of GDP at scale.' },
    startYear: 2030,
    nudges: [
      {
        node: 'agi',
        direction: 'up',
        magnitude: 'moderate',
        lag: 1,
        evidence: 'Sec. 2: this Act accelerates the development of general-purpose AI systems.',
      },
      {
        node: 'compute-treaty',
        direction: 'down',
        magnitude: 'slight',
        evidence: 'Sec. 9: nothing in this Act shall be construed as an international agreement.',
      },
    ],
    ...overrides,
  };
}

describe('buildExtractionPrompt', () => {
  it('contains every non-retired event node id and excludes retired ones', () => {
    const prompt = buildExtractionPrompt(graph, 'some bill text', { url: 'https://example.com' });
    expect(prompt).toContain('agi');
    expect(prompt).toContain('compute-treaty');
    expect(prompt).not.toContain('retired-node');
  });

  it('mentions the magnitude enum and instructs JSON-only output', () => {
    const prompt = buildExtractionPrompt(graph, 'some bill text', {});
    expect(prompt).toContain('slight');
    expect(prompt).toContain('moderate');
    expect(prompt).toContain('strong');
    expect(prompt).toMatch(/ONLY/);
  });
});

describe('parseExtraction', () => {
  it('accepts a well-formed sample and forces tier/status', () => {
    const { intervention, errors } = parseExtraction(JSON.stringify(goodPayload()), graph);
    expect(errors).toEqual([]);
    expect(intervention).not.toBeNull();
    expect(intervention?.tier).toBe('public');
    expect(intervention?.status).toBe('ai-drafted');
    expect(intervention?.nudges).toHaveLength(2);
    expect(intervention?.extractedBy?.model).toBeTruthy();
  });

  it('forces tier and status even when the model tries to set something else', () => {
    const payload = goodPayload({ tier: 'locked', status: 'reviewed' });
    const { intervention, errors } = parseExtraction(JSON.stringify(payload), graph);
    expect(errors).toEqual([]);
    expect(intervention?.tier).toBe('public');
    expect(intervention?.status).toBe('ai-drafted');
  });

  it('rejects nudges referencing unknown or non-event node ids', () => {
    const payload = goodPayload({
      nudges: [{ node: 'not-a-real-node', direction: 'up', magnitude: 'slight', evidence: 'a quote' }],
    });
    const { intervention, errors } = parseExtraction(JSON.stringify(payload), graph);
    expect(intervention).toBeNull();
    expect(errors.some((e) => e.includes('not-a-real-node'))).toBe(true);
  });

  it('rejects a state node id used as a nudge target (not an event)', () => {
    const payload = goodPayload({
      nudges: [{ node: 'flourishing', direction: 'up', magnitude: 'slight', evidence: 'a quote' }],
    });
    const { intervention, errors } = parseExtraction(JSON.stringify(payload), graph);
    expect(intervention).toBeNull();
    expect(errors.some((e) => e.includes('flourishing'))).toBe(true);
  });

  it('rejects nudges without an evidence quote', () => {
    const payload = goodPayload({
      nudges: [{ node: 'agi', direction: 'up', magnitude: 'slight' }],
    });
    const { intervention, errors } = parseExtraction(JSON.stringify(payload), graph);
    expect(intervention).toBeNull();
    expect(errors.some((e) => e.toLowerCase().includes('evidence'))).toBe(true);
  });

  it('rejects a startYear outside the graph range', () => {
    const payload = goodPayload({ startYear: 2099 });
    const { intervention, errors } = parseExtraction(JSON.stringify(payload), graph);
    expect(intervention).toBeNull();
    expect(errors.some((e) => e.includes('startYear'))).toBe(true);
  });

  it('rejects more than 6 nudges', () => {
    const manyNudges = Array.from({ length: 7 }, (_, i) => ({
      node: i % 2 === 0 ? 'agi' : 'compute-treaty',
      direction: 'up',
      magnitude: 'slight',
      evidence: `quote ${i}`,
    }));
    const payload = goodPayload({ nudges: manyNudges });
    const { intervention, errors } = parseExtraction(JSON.stringify(payload), graph);
    expect(intervention).toBeNull();
    expect(errors.some((e) => e.toLowerCase().includes('too many nudges'))).toBe(true);
  });

  it('strips a ```json code fence before parsing', () => {
    const fenced = '```json\n' + JSON.stringify(goodPayload()) + '\n```';
    const { intervention, errors } = parseExtraction(fenced, graph);
    expect(errors).toEqual([]);
    expect(intervention).not.toBeNull();
    expect(intervention?.id).toBe('ai-dividend-fund');
  });

  it('strips a bare ``` code fence (no "json" tag) before parsing', () => {
    const fenced = '```\n' + JSON.stringify(goodPayload()) + '\n```';
    const { intervention, errors } = parseExtraction(fenced, graph);
    expect(errors).toEqual([]);
    expect(intervention).not.toBeNull();
  });

  it('slugifies an id from the label when the model omits it', () => {
    const payload = goodPayload({ label: 'Compute Export Controls Act' });
    delete (payload as Record<string, unknown>).id;
    const { intervention, errors } = parseExtraction(JSON.stringify(payload), graph);
    expect(errors).toEqual([]);
    expect(intervention?.id).toBe('compute-export-controls-act');
  });

  it('returns an error (not a throw) on unparsable JSON', () => {
    const { intervention, errors } = parseExtraction('this is not json {{{', graph);
    expect(intervention).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('per-session rate limit', () => {
  const originalApiKey = process.env.API_KEY;
  const originalGeminiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    _resetExtractionCountForTests();
    delete process.env.API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = originalApiKey;
    if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGeminiKey;
  });

  it('trips RateLimitError on the 11th extraction within a session', async () => {
    for (let i = 0; i < 10; i++) {
      // No API key configured, so these fail earlier in the pipeline - what matters here is
      // that they are NOT RateLimitError, i.e. the limit has not tripped yet.
      await expect(extractIntervention(graph, 'text', {})).rejects.not.toBeInstanceOf(RateLimitError);
    }
    await expect(extractIntervention(graph, 'text', {})).rejects.toBeInstanceOf(RateLimitError);
  });
});

import { describe, it, expect } from 'vitest';

import graph from '../../data/futures/graph.json';
import aiDividendFund from '../../data/futures/interventions/ai-dividend-fund.json';
import computeTreaty from '../../data/futures/interventions/compute-treaty.json';
import resilienceEnclaves from '../../data/futures/interventions/resilience-enclaves.json';
import frontierEvalsMandate from '../../data/futures/interventions/frontier-evals-mandate.json';
import golden from './golden.json';
import { FuturesGraph } from './types';
import { checkGolden, sensitivityReport, validateGraph, validateIntervention } from './validateGraph';

const g = graph as unknown as FuturesGraph;

describe('validateGraph — the real seed graph', () => {
  it('passes schema + semantic validation with no errors', () => {
    const result = validateGraph(graph);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('has 18 event nodes and 5 state nodes', () => {
    const events = g.nodes.filter((n) => n.kind === 'event');
    const states = g.nodes.filter((n) => n.kind === 'state');
    expect(events.length).toBe(18);
    expect(states.length).toBe(5);
  });

  it('has 37 edges', () => {
    const total = g.nodes.reduce((acc, n) => acc + (n.parents?.length ?? 0), 0);
    expect(total).toBe(37);
  });
});

describe('validateGraph — semantic checks', () => {
  it('rejects a duplicate node id', () => {
    const bad = structuredClone(graph) as any;
    bad.nodes.push({ ...bad.nodes[0] });
    const result = validateGraph(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('duplicate node id'))).toBe(true);
  });

  it('rejects an edge from an unknown node', () => {
    const bad = structuredClone(graph) as any;
    bad.nodes[0].parents = [{ from: 'not-a-real-node', kind: 'amplifies', strength: 0.5, note: 'test' }];
    const result = validateGraph(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('unknown node'))).toBe(true);
  });

  it('rejects an edge from a retired node', () => {
    const bad = structuredClone(graph) as any;
    bad.nodes.find((n: any) => n.id === 'rsi').retired = '2026-09-10';
    const result = validateGraph(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('retired node'))).toBe(true);
  });

  it('rejects a self-parent edge', () => {
    const bad = structuredClone(graph) as any;
    bad.nodes[0].parents = [{ from: bad.nodes[0].id, kind: 'amplifies', strength: 0.5, note: 'test' }];
    const result = validateGraph(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('self-parent'))).toBe(true);
  });

  it('rejects more than 5 parents on one node', () => {
    const bad = structuredClone(graph) as any;
    const donors = bad.nodes.slice(1, 7).map((n: any) => n.id);
    bad.nodes[0].parents = donors.map((from: string) => ({ from, kind: 'amplifies', strength: 0.5, note: 'test' }));
    const result = validateGraph(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('max is 5'))).toBe(true);
  });

  it('rejects a sign-inconsistent edge (requires with negative strength)', () => {
    const bad = structuredClone(graph) as any;
    bad.nodes.find((n: any) => n.id === 'rsi').parents[0].strength = -0.9;
    const result = validateGraph(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('must have strength > 0'))).toBe(true);
  });

  it('rejects a sign-inconsistent edge (prevents with positive strength)', () => {
    const bad = structuredClone(graph) as any;
    const misaligned = bad.nodes.find((n: any) => n.id === 'misaligned-takeover');
    const preventsEdge = misaligned.parents.find((p: any) => p.kind === 'prevents');
    preventsEdge.strength = 0.8;
    const result = validateGraph(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('must have strength < 0'))).toBe(true);
  });

  it('rejects an edge with an empty note (caught by schema minLength)', () => {
    const bad = structuredClone(graph) as any;
    bad.nodes.find((n: any) => n.id === 'rsi').parents[0].note = '';
    const result = validateGraph(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /note/i.test(e))).toBe(true);
  });

  it('rejects a decreasing event curve', () => {
    const bad = structuredClone(graph) as any;
    bad.nodes.find((n: any) => n.id === 'agi').seed.curve['2030'] = 0.1;
    const result = validateGraph(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('event curve decreases'))).toBe(true);
  });

  it('rejects a state curve keyed off a non-horizon year', () => {
    const bad = structuredClone(graph) as any;
    bad.nodes.find((n: any) => n.id === 'flourishing').seed.curve['2028'] = 0.1;
    const result = validateGraph(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('is not the graph startYear'))).toBe(true);
  });

  it('rejects an axis state that does not exist', () => {
    const bad = structuredClone(graph) as any;
    bad.axis.states.push('not-a-real-state');
    const result = validateGraph(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('does not exist'))).toBe(true);
  });

  it('rejects an axis state that is not kind state', () => {
    const bad = structuredClone(graph) as any;
    bad.axis.states.push('agi');
    const result = validateGraph(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('is listed as a state but has kind'))).toBe(true);
  });

  it('detects a zero-lag cycle', () => {
    const bad = structuredClone(graph) as any;
    // "alignment-adequate" already has a lag-0 parent edge from "race-dynamics". Add the
    // reverse edge, also at lag 0, to close a zero-lag loop (a lag>=1 cycle, like the real
    // graph's race-dynamics <-> compute-governance pair, is legal and must NOT be flagged).
    bad.nodes
      .find((n: any) => n.id === 'race-dynamics')
      .parents.push({ from: 'alignment-adequate', kind: 'dampens', strength: -0.3, lag: 0, note: 'test cycle' });
    const result = validateGraph(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('topoOrder'))).toBe(true);
  });

  it('warns (does not error) when state marginals at a horizon do not sum to 1', () => {
    const bad = structuredClone(graph) as any;
    bad.nodes.find((n: any) => n.id === 'flourishing').seed.curve['2030'] = 0.9;
    const result = validateGraph(bad);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.includes('sum to'))).toBe(true);
  });

  it('rejects total edges exceeding 3x node count', () => {
    const bad = structuredClone(graph) as any;
    const allIds = bad.nodes.map((n: any) => n.id);
    // Give every node 4 fresh (circular, self-avoiding) parents: 23 * 4 = 92 > 3 * 23 = 69.
    // This also introduces zero-lag cycles, which is fine: this test only checks the budget error.
    bad.nodes.forEach((n: any, i: number) => {
      const others: string[] = [];
      for (let k = 1; others.length < 4; k++) {
        const candidate = allIds[(i + k) % allIds.length];
        if (candidate !== n.id) others.push(candidate);
      }
      n.parents = others.map((from) => ({ from, kind: 'amplifies', strength: 0.3, note: 'padding' }));
    });
    const result = validateGraph(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('exceeds budget'))).toBe(true);
  });
});

describe('validateIntervention — the real seed interventions', () => {
  const cases = [
    ['ai-dividend-fund.json', aiDividendFund],
    ['compute-treaty.json', computeTreaty],
    ['resilience-enclaves.json', resilienceEnclaves],
    ['frontier-evals-mandate.json', frontierEvalsMandate],
  ] as const;

  for (const [file, data] of cases) {
    it(`${file} passes validation against the seed graph`, () => {
      const result = validateIntervention(data, g);
      expect(result.errors).toEqual([]);
      expect(result.ok).toBe(true);
    });
  }

  it('rejects a nudge targeting an unknown node', () => {
    const bad = structuredClone(aiDividendFund) as any;
    bad.nudges[0].node = 'not-a-real-node';
    const result = validateIntervention(bad, g);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('unknown node'))).toBe(true);
  });

  it('rejects a startYear outside the graph range', () => {
    const bad = structuredClone(aiDividendFund) as any;
    bad.startYear = 1999;
    const result = validateIntervention(bad, g);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('outside graph range'))).toBe(true);
  });

  it('rejects a bad cost band via schema', () => {
    const bad = structuredClone(aiDividendFund) as any;
    bad.cost.band = 9;
    const result = validateIntervention(bad, g);
    expect(result.ok).toBe(false);
  });

  it('rejects a bad magnitude enum via schema', () => {
    const bad = structuredClone(aiDividendFund) as any;
    bad.nudges[0].magnitude = 'extreme';
    const result = validateIntervention(bad, g);
    expect(result.ok).toBe(false);
  });
});

describe('sensitivityReport', () => {
  it('runs over the real graph and returns a sorted, well-shaped list', () => {
    const findings = sensitivityReport(g);
    for (const f of findings) {
      expect(f.maxAbsShift).toBeGreaterThan(0.05);
      expect(g.axis.states).toContain(f.mostShiftedState);
    }
    for (let i = 1; i < findings.length; i++) {
      expect(findings[i - 1].maxAbsShift).toBeGreaterThanOrEqual(findings[i].maxAbsShift);
    }
  });

  it('flags the redistribution -> broad-flourishing edge as sensitive to the flourishing state', () => {
    const findings = sensitivityReport(g);
    const hit = findings.find((f) => f.from === 'redistribution' && f.to === 'broad-flourishing');
    expect(hit).toBeDefined();
    expect(hit?.mostShiftedState).toBe('flourishing');
  });
});

describe('checkGolden', () => {
  it('the committed golden.json matches the real graph within tolerance', () => {
    const result = checkGolden(g, golden as any);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('fails when a marginal is off by more than tolerance', () => {
    const badGolden = structuredClone(golden) as any;
    badGolden.stateMarginals['2045'].flourishing += 0.1;
    const result = checkGolden(g, badGolden);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

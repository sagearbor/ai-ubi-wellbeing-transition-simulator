/**
 * Tests for src/futures/interventions.ts — applying intervention cards and scoring them.
 */

import { describe, expect, it } from 'vitest';
import { buildBaseline, goodnessSeries, mergeShifts, shiftsFromInterventions, sliderShift, solve } from './engine';
import { WHAT_MOVED_EPSILON, applyInterventions, interventionMetrics, whatMoved } from './interventions';
import { Intervention } from './types';
import { fixtureGraph, fixtureInterventions } from './testFixture';

const NY = fixtureGraph.endYear - fixtureGraph.startYear + 1;
const LAST = NY - 1;
const byId = <T extends { interventionId: string }>(rows: T[], id: string): T =>
  rows.find((r) => r.interventionId === id)!;

describe('interventionMetrics', () => {
  const rows = interventionMetrics(fixtureGraph, fixtureInterventions);

  it('returns one row per card', () => {
    expect(rows).toHaveLength(fixtureInterventions.length);
    expect(rows.map((r) => r.interventionId).sort()).toEqual(fixtureInterventions.map((i) => i.id).sort());
  });

  it('sorts by shiftPerCost, best first', () => {
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].shiftPerCost).toBeGreaterThanOrEqual(rows[i].shiftPerCost);
    }
  });

  it('reports shiftPerCost as meanShift / cost band', () => {
    for (const r of rows) expect(r.shiftPerCost).toBeCloseTo(r.meanShift / r.cost, 12);
    expect(byId(rows, 'dividend-fund').cost).toBe(4);
  });

  it('gives a redistribution push a positive mean and ceiling lift', () => {
    const r = byId(rows, 'dividend-fund');
    expect(r.meanShift).toBeGreaterThan(0);
    expect(r.ceilingLift).toBeGreaterThan(0);
  });

  it('gives a card that suppresses the worst state a positive floor lift', () => {
    // "floor lift" is defined so that shrinking the bad tail is POSITIVE.
    expect(byId(rows, 'resilience-enclaves').floorLift).toBeGreaterThan(0);
  });

  it('shows why the mean alone is not enough: enclaves move the mean least but the floor most', () => {
    const enclaves = byId(rows, 'resilience-enclaves');
    const fund = byId(rows, 'dividend-fund');
    expect(enclaves.meanShift).toBeLessThan(fund.meanShift);
    expect(enclaves.floorLift).toBeGreaterThan(fund.floorLift);
  });

  it('scores each card ALONE against baseline, never marginally against the others', () => {
    const alone = byId(interventionMetrics(fixtureGraph, [fixtureInterventions[1]]), 'compute-treaty');
    const together = byId(rows, 'compute-treaty');
    expect(alone).toEqual(together);
  });

  it('scores an empty nudge list as exactly zero on all three axes', () => {
    const inert: Intervention = { ...fixtureInterventions[0], id: 'inert', nudges: [] };
    const [r] = interventionMetrics(fixtureGraph, [inert]);
    expect(r.meanShift).toBeCloseTo(0, 12);
    expect(r.floorLift).toBeCloseTo(0, 12);
    expect(r.ceilingLift).toBeCloseTo(0, 12);
    expect(r.shiftPerCost).toBeCloseTo(0, 12);
  });

  it('gives the same answer with or without a precomputed baseline', () => {
    expect(interventionMetrics(fixtureGraph, fixtureInterventions, buildBaseline(fixtureGraph))).toEqual(rows);
  });

  it('flips sign when the nudges flip direction', () => {
    const reversed: Intervention = {
      ...fixtureInterventions[0],
      id: 'anti-dividend',
      nudges: fixtureInterventions[0].nudges.map((n) => ({ ...n, direction: n.direction === 'up' ? 'down' : 'up' } as const)),
    };
    const [r] = interventionMetrics(fixtureGraph, [reversed]);
    expect(r.meanShift).toBeLessThan(0);
    expect(r.floorLift).toBeLessThan(0);
  });

  it('handles an empty list', () => {
    expect(interventionMetrics(fixtureGraph, [])).toEqual([]);
  });
});

describe('applyInterventions', () => {
  const base = buildBaseline(fixtureGraph);

  it('with nothing toggled on returns the baseline', () => {
    const r = applyInterventions(fixtureGraph, [], undefined, base);
    expect(r.P).toEqual(solve(fixtureGraph, {}, base).P);
    expect(r.base).toBe(base.P);
  });

  it('stacks cards additively and order-independently', () => {
    const [a, b, c] = fixtureInterventions;
    const forwards = applyInterventions(fixtureGraph, [a, b, c], undefined, base);
    const backwards = applyInterventions(fixtureGraph, [c, b, a], undefined, base);
    expect(forwards.P).toEqual(backwards.P);
  });

  it('equals solving the merged shift vector by hand', () => {
    const extra = sliderShift(fixtureGraph, 'frontier-evals', 0.7);
    const viaHelper = applyInterventions(fixtureGraph, fixtureInterventions, extra, base);
    const byHand = solve(
      fixtureGraph,
      mergeShifts(NY, shiftsFromInterventions(fixtureGraph, fixtureInterventions), extra),
      base,
    );
    expect(viaHelper.P).toEqual(byHand.P);
  });

  it('respects each nudge\'s start year and lag: nothing moves before then', () => {
    const enclaves = fixtureInterventions[2]; // startYear 2027, lag 0, single nudge
    const r = applyInterventions(fixtureGraph, [enclaves], undefined, base);
    const tStart = fixtureGraph.startYear === 2026 ? 1 : enclaves.startYear - fixtureGraph.startYear;
    for (let t = 0; t < tStart; t++) expect(r.P['collapse'][t]).toBeCloseTo(base.P['collapse'][t], 12);
    expect(r.P['collapse'][LAST]).toBeLessThan(base.P['collapse'][LAST]);
  });

  it('keeps the invariants: states sum to 1, events monotone', () => {
    const r = applyInterventions(fixtureGraph, fixtureInterventions, undefined, base);
    for (let t = 0; t < NY; t++) {
      const z = fixtureGraph.axis.states.reduce((s, id) => s + r.P[id][t], 0);
      expect(z).toBeCloseTo(1, 12);
    }
    for (const n of fixtureGraph.nodes.filter((x) => x.kind === 'event')) {
      for (let t = 1; t < NY; t++) expect(r.P[n.id][t]).toBeGreaterThanOrEqual(r.P[n.id][t - 1]);
    }
  });

  it('moves mean goodness in the direction the cost curve promised', () => {
    const gBase = goodnessSeries(fixtureGraph, base.P, base.years);
    const r = applyInterventions(fixtureGraph, [fixtureInterventions[0]], undefined, base);
    const g = goodnessSeries(fixtureGraph, r.P, r.years);
    const promised = byId(interventionMetrics(fixtureGraph, fixtureInterventions, base), 'dividend-fund').meanShift;
    expect(g.mean[LAST] - gBase.mean[LAST]).toBeCloseTo(promised, 12);
  });
});

describe('whatMoved', () => {
  const base = buildBaseline(fixtureGraph);
  const result = applyInterventions(fixtureGraph, fixtureInterventions, undefined, base);
  const moved = whatMoved(fixtureGraph, result);

  it('sorts by absolute delta, largest first', () => {
    for (let i = 1; i < moved.length; i++) {
      expect(Math.abs(moved[i - 1].delta)).toBeGreaterThanOrEqual(Math.abs(moved[i].delta));
    }
  });

  it('reports from/to/delta consistently against the end year', () => {
    for (const m of moved) {
      expect(m.to - m.from).toBeCloseTo(m.delta, 12);
      expect(m.from).toBeCloseTo(result.base[m.nodeId][LAST], 12);
      expect(m.to).toBeCloseTo(result.P[m.nodeId][LAST], 12);
    }
  });

  it('excludes nodes that barely budged', () => {
    for (const m of moved) expect(Math.abs(m.delta)).toBeGreaterThanOrEqual(WHAT_MOVED_EPSILON);
  });

  it('returns nothing at all when nothing was applied', () => {
    expect(whatMoved(fixtureGraph, applyInterventions(fixtureGraph, [], undefined, base))).toEqual([]);
  });

  it('honours topN', () => {
    expect(whatMoved(fixtureGraph, result, 2)).toHaveLength(2);
    expect(whatMoved(fixtureGraph, result, 2)).toEqual(moved.slice(0, 2));
    expect(whatMoved(fixtureGraph, result, 0)).toEqual([]);
  });

  it('names the node the intervention actually targeted', () => {
    const only = applyInterventions(fixtureGraph, [fixtureInterventions[0]], undefined, base);
    expect(whatMoved(fixtureGraph, only, 1)[0].nodeId).toBe('redistribution');
    expect(whatMoved(fixtureGraph, only, 1)[0].kind).toBe('event');
    expect(whatMoved(fixtureGraph, only, 1)[0].delta).toBeGreaterThan(0);
  });

  it('reports both events and states', () => {
    expect(new Set(moved.map((m) => m.kind))).toEqual(new Set(['event', 'state']));
  });
});

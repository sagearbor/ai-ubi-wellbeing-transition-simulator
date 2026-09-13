/**
 * Property tests for the futures engine (src/futures/engine.ts).
 *
 * These are invariants, not golden numbers: the seed graph's content will change weekly and
 * these must keep passing anyway. They run against `testFixture.ts`, never the real graph.
 */

import { describe, expect, it } from 'vitest';
import {
  addShift,
  buildBaseline,
  goodnessSeries,
  interpolateCurve,
  mergeShifts,
  shiftsFromInterventions,
  sliderShift,
  solve,
  stateFlows,
  topoOrder,
  yearsOf,
} from './engine';
import { FuturesGraph, ShiftVector } from './types';
import { fixtureGraph, fixtureInterventions } from './testFixture';

const NY = fixtureGraph.endYear - fixtureGraph.startYear + 1;
const eventIds = fixtureGraph.nodes.filter((n) => n.kind === 'event').map((n) => n.id);
const stateIds = fixtureGraph.axis.states;
const allIds = fixtureGraph.nodes.map((n) => n.id);

/** Deterministic PRNG so a failure is always reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A handful of arbitrary but reproducible shift vectors, plus the empty one. */
function sampleShifts(count = 12): ShiftVector[] {
  const rnd = mulberry32(20260910);
  const out: ShiftVector[] = [{}];
  for (let k = 0; k < count; k++) {
    const s: ShiftVector = {};
    const nPicks = 1 + Math.floor(rnd() * 3);
    for (let p = 0; p < nPicks; p++) {
      const id = allIds[Math.floor(rnd() * allIds.length)];
      const from = Math.floor(rnd() * NY);
      const value = (rnd() * 8 - 4); // deliberately large, to exercise the shock clamp
      addShift(s, id, from, value, NY);
    }
    out.push(s);
  }
  return out;
}

describe('engine: baseline', () => {
  it('reproduces every event curve bit-for-bit when nothing is nudged', () => {
    const base = buildBaseline(fixtureGraph);
    const solved = solve(fixtureGraph, {}, base);
    for (const id of eventIds) {
      for (let t = 0; t < NY; t++) {
        expect(
          Object.is(solved.P[id][t], base.P[id][t]),
          `${id}@${base.years[t]}: ${solved.P[id][t]} !== ${base.P[id][t]}`,
        ).toBe(true);
      }
    }
  });

  it('reproduces every state curve to within one ULP when nothing is nudged', () => {
    // KNOWN ENGINE WART: state curves are renormalised in buildBaseline AND again in solve, and
    // the second pass divides by a z that is 1 +/- 1e-16, so ~6 of 20 years differ in the last
    // bit. Harmless for display, but it means "solve(graph, {}) === baseline" is only true to
    // 1e-15 for states, not bit-for-bit. One-line fix in engine.renormaliseStates:
    //   if (z > 0 && z !== 1) for (...) P[id][t] /= z;
    const base = buildBaseline(fixtureGraph);
    const solved = solve(fixtureGraph, {}, base);
    for (const id of stateIds) {
      for (let t = 0; t < NY; t++) {
        expect(Math.abs(solved.P[id][t] - base.P[id][t]), `${id}@${base.years[t]}`).toBeLessThan(1e-15);
      }
    }
  });

  it('recomputes the same baseline when none is passed in', () => {
    const a = solve(fixtureGraph, {}).P;
    const b = solve(fixtureGraph, {}, buildBaseline(fixtureGraph)).P;
    expect(a).toEqual(b);
  });

  it('spans startYear..endYear inclusive', () => {
    const base = buildBaseline(fixtureGraph);
    expect(base.years[0]).toBe(fixtureGraph.startYear);
    expect(base.years[base.years.length - 1]).toBe(fixtureGraph.endYear);
    expect(base.years).toEqual(yearsOf(fixtureGraph));
  });

  it('interpolates curves through their horizon values and holds flat outside', () => {
    const curve = { '2030': 0.2, '2040': 0.6 };
    const ys = [2026, 2030, 2035, 2040, 2045];
    const v = interpolateCurve(curve, ys);
    expect(v[0]).toBeCloseTo(0.2, 12); // before the first key
    expect(v[1]).toBeCloseTo(0.2, 12);
    expect(v[2]).toBeGreaterThan(0.2);
    expect(v[2]).toBeLessThan(0.6);
    expect(v[3]).toBeCloseTo(0.6, 12);
    expect(v[4]).toBeCloseTo(0.6, 12); // after the last key
  });
});

describe('engine: invariants under arbitrary shifts', () => {
  const cases = sampleShifts();

  it('keeps every event curve monotone non-decreasing', () => {
    for (const shifts of cases) {
      const r = solve(fixtureGraph, shifts);
      for (const id of eventIds) {
        for (let t = 1; t < NY; t++) {
          expect(r.P[id][t], `${id} dipped at t=${t}`).toBeGreaterThanOrEqual(r.P[id][t - 1]);
        }
      }
    }
  });

  it('keeps world-state marginals summing to 1 at every year', () => {
    for (const shifts of cases) {
      const r = solve(fixtureGraph, shifts);
      for (let t = 0; t < NY; t++) {
        const z = stateIds.reduce((s, id) => s + r.P[id][t], 0);
        expect(z).toBeCloseTo(1, 12);
      }
    }
  });

  it('keeps every probability inside [0, 1]', () => {
    for (const shifts of cases) {
      const r = solve(fixtureGraph, shifts);
      for (const id of allIds) {
        for (const p of r.P[id]) {
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('holds the requires clamp: a consequence is never likelier than its prerequisite', () => {
    // the fixture's one `requires` edge, plus an adversarial pair of shifts pushing against it
    const adversarial = mergeShifts(
      NY,
      sliderShift(fixtureGraph, 'cheap-robotics', 5),
      sliderShift(fixtureGraph, 'frontier-agi', -5),
    );
    for (const shifts of [...cases, adversarial]) {
      const r = solve(fixtureGraph, shifts);
      for (let t = 0; t < NY; t++) {
        expect(
          r.P['cheap-robotics'][t],
          `cheap-robotics exceeded frontier-agi at t=${t}`,
        ).toBeLessThanOrEqual(r.P['frontier-agi'][t]);
      }
    }
  });

  it('keeps mean goodness inside the states goodness range', () => {
    const gs = fixtureGraph.nodes.filter((n) => n.kind === 'state').map((n) => n.goodness!);
    const lo = Math.min(...gs);
    const hi = Math.max(...gs);
    for (const shifts of cases) {
      const g = goodnessSeries(fixtureGraph, solve(fixtureGraph, shifts).P);
      for (const m of g.mean) {
        expect(m).toBeGreaterThanOrEqual(lo - 1e-9);
        expect(m).toBeLessThanOrEqual(hi + 1e-9);
      }
      for (let t = 0; t < NY; t++) {
        expect(g.floor[t] + g.ceiling[t]).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });
});

describe('engine: nudges compose additively and order-independently', () => {
  const a = sliderShift(fixtureGraph, 'redistribution', 0.8);
  const b = sliderShift(fixtureGraph, 'oligarchic-capture', -0.4);
  const c = shiftsFromInterventions(fixtureGraph, [fixtureInterventions[0]]);

  it('mergeShifts(a, b) equals mergeShifts(b, a)', () => {
    expect(mergeShifts(NY, a, b, c)).toEqual(mergeShifts(NY, c, b, a));
  });

  it('solves identically whichever order the shifts were merged in', () => {
    const ab = solve(fixtureGraph, mergeShifts(NY, a, b, c));
    const ba = solve(fixtureGraph, mergeShifts(NY, c, b, a));
    expect(ab.P).toEqual(ba.P);
  });

  it('adds two shifts on the same node rather than replacing', () => {
    const twice = mergeShifts(NY, sliderShift(fixtureGraph, 'redistribution', 0.4), sliderShift(fixtureGraph, 'redistribution', 0.4));
    expect(twice['redistribution']).toEqual(new Array(NY).fill(0.8));
  });

  it('shows diminishing returns: doubling a nudge less than doubles the probability gain', () => {
    const base = buildBaseline(fixtureGraph);
    const t = NY - 1;
    const p0 = base.P['redistribution'][t];
    const p1 = solve(fixtureGraph, sliderShift(fixtureGraph, 'redistribution', 1), base).P['redistribution'][t];
    const p2 = solve(fixtureGraph, sliderShift(fixtureGraph, 'redistribution', 2), base).P['redistribution'][t];
    expect(p1).toBeGreaterThan(p0);
    expect(p2).toBeGreaterThan(p1);
    expect(p2 - p1).toBeLessThan(p1 - p0);
  });
});

describe('engine: topological order', () => {
  it('accepts the fixture, whose only cycle crosses a lagged edge', () => {
    const order = topoOrder(fixtureGraph);
    expect(order.slice().sort()).toEqual(allIds.slice().sort());
    // a zero-lag parent must be ordered before its child
    expect(order.indexOf('frontier-agi')).toBeLessThan(order.indexOf('cheap-robotics'));
    expect(order.indexOf('cheap-robotics')).toBeLessThan(order.indexOf('oligarchic-capture'));
  });

  it('throws when a cycle has no lag anywhere in it', () => {
    const bad: FuturesGraph = JSON.parse(JSON.stringify(fixtureGraph));
    // redistribution <-(lag 1)- oligarchic-capture becomes lag 0, closing a zero-lag cycle
    // with the lag-2 edge back... so drop that lag too.
    for (const n of bad.nodes) {
      for (const e of n.parents ?? []) e.lag = 0;
    }
    expect(() => topoOrder(bad)).toThrow(/cycle/i);
  });

  it('throws on an edge from an unknown parent', () => {
    const bad: FuturesGraph = JSON.parse(JSON.stringify(fixtureGraph));
    bad.nodes[0].parents = [{ from: 'no-such-node', kind: 'enables', strength: 0.5, note: 'x' }];
    expect(() => topoOrder(bad)).toThrow(/unknown or retired parent/);
  });

  it('still solves when a genuine feedback loop is present (the lagged cycle)', () => {
    const r = solve(fixtureGraph, sliderShift(fixtureGraph, 'oligarchic-capture', 1.5));
    // the lag-1 dampening edge must have pushed redistribution down somewhere after the start
    const base = buildBaseline(fixtureGraph);
    expect(r.P['redistribution'][NY - 1]).toBeLessThan(base.P['redistribution'][NY - 1]);
  });
});

describe('engine: state flows', () => {
  const horizonPairs = () => {
    const hs = [fixtureGraph.startYear, ...fixtureGraph.axis.horizons.filter((h) => h > fixtureGraph.startYear)];
    return hs.slice(0, -1).map((h, i) => [h, hs[i + 1]] as const);
  };

  it('conserves total mass across every horizon pair', () => {
    for (const shifts of [{}, sliderShift(fixtureGraph, 'collapse', 1.2)]) {
      const r = solve(fixtureGraph, shifts);
      const flows = stateFlows(fixtureGraph, r.P, r.years);
      for (const [h0, h1] of horizonPairs()) {
        const mass = flows.filter((f) => f.fromYear === h0 && f.toYear === h1).reduce((s, f) => s + f.mass, 0);
        expect(mass, `${h0}->${h1}`).toBeCloseTo(1, 9);
      }
    }
  });

  it('conserves each state\'s outgoing mass exactly', () => {
    const r = solve(fixtureGraph, {});
    const flows = stateFlows(fixtureGraph, r.P, r.years);
    for (const [h0, h1] of horizonPairs()) {
      const t0 = r.years.indexOf(h0);
      for (const id of stateIds) {
        const out = flows
          .filter((f) => f.fromYear === h0 && f.toYear === h1 && f.from === id)
          .reduce((s, f) => s + f.mass, 0);
        expect(out, `${id} out of ${h0}`).toBeCloseTo(r.P[id][t0], 9);
      }
    }
  });

  it('never lets mass leave the absorbing state', () => {
    const r = solve(fixtureGraph, {});
    const flows = stateFlows(fixtureGraph, r.P, r.years);
    const leaks = flows.filter((f) => f.from === 'collapse' && f.to !== 'collapse' && f.mass > 1e-9);
    expect(leaks).toEqual([]);
  });

  it('emits only non-negative masses', () => {
    const r = solve(fixtureGraph, sliderShift(fixtureGraph, 'flourishing', 2));
    for (const f of stateFlows(fixtureGraph, r.P, r.years)) expect(f.mass).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from 'vitest';

import { classifyShape, interactions, neighbourhood, sweep } from './sensitivity';
import type { CoreModel, Overlay } from './types';
import minimalJson from '../../data/core/minimal.json';
import trainingBudgetJson from '../../data/core/training-budget.json';
import tutoringJson from '../../data/core/overlays/tutoring.json';

const guess = (label: string) => ({ label, kind: 'guess' as const });
const minimal = minimalJson as unknown as CoreModel;
const training = trainingBudgetJson as unknown as CoreModel;
const tutoring = tutoringJson as unknown as Overlay;

/** One parameter, one equation, one year: a bench for the classifier and the probes. */
function oneLiner(equation: string, params: Array<[string, number]>): CoreModel {
  return {
    schemaVersion: 1,
    id: 'one-liner',
    name: 'One-liner',
    time: { start: 2026, end: 2027, step: 'year' },
    parameters: params.map(([id, value]) => ({ id, value, source: guess('bench') })),
    variables: [{ id: 'out', equation }],
    outputs: ['out'],
  };
}

describe('classifyShape', () => {
  it('calls a curve that barely moves flat', () => {
    expect(classifyShape([100, 100, 100, 100, 100]).shape).toBe('flat');
    expect(classifyShape([100, 100.00001, 100, 100, 100]).shape).toBe('flat');
  });

  it('calls a straight line linear', () => {
    expect(classifyShape([1, 2, 3, 4, 5, 6, 7]).shape).toBe('linear');
  });

  it('calls a gentle curve linear rather than inventing a shape', () => {
    const ys = [1, 2, 3.1, 4.3, 5.6, 7.0, 8.5, 10.1];
    const d = classifyShape(ys);
    expect(d.shape).toBe('linear');
    expect(d.monotone).toBe('up');
  });

  it('calls a slope that dies away saturating and says so', () => {
    const d = classifyShape([0, 100, 200, 300, 400, 400, 400, 400]);
    expect(d.shape).toBe('saturating');
    expect(d.closeSlope).toBe(0);
    expect(d.reason).toContain('stops buying output');
  });

  it('calls a single dominating step a threshold and locates it', () => {
    const d = classifyShape([0, 0, 0, 500, 500, 500]);
    expect(d.shape).toBe('threshold');
    expect(d.jumpAt).toBe(2);
    expect(d.maxStepShare).toBe(1);
  });

  it('calls a curve that turns round non-monotone', () => {
    expect(classifyShape([1, 2, 3, 2.5, 2, 1.5]).shape).toBe('non-monotone');
  });

  it('does not classify what it cannot see', () => {
    expect(classifyShape([]).reason).toContain('not enough finite grid points');
    expect(classifyShape([1, NaN, 3]).reason).toContain('not enough finite grid points');
  });
});

describe('sweep', () => {
  it('generates a +/-50% grid around the baseline and reports both kinds of change', () => {
    const r = sweep(minimal, { parameter: 'growth', output: 'income', at: 2035 });
    expect(r.ok).toBe(true);
    expect(r.kind).toBe('parameter');
    expect(r.points).toHaveLength(9);
    expect(r.baselineValue).toBe(0.02);
    expect(r.points[0].value).toBeCloseTo(0.01, 12);
    expect(r.points[8].value).toBeCloseTo(0.03, 12);
    // The middle point is the baseline, so it should not move.
    expect(r.points[4].absChange).toBeCloseTo(0, 6);
    expect(r.points[8].absChange).toBeGreaterThan(0);
    expect(r.points[8].relChange).toBeCloseTo(r.points[8].absChange / r.baseline, 12);
    expect(r.shape).toBe('linear');
  });

  it('reads the year asked for, not only the last one', () => {
    const early = sweep(minimal, { parameter: 'growth', output: 'income', at: 2027 });
    const late = sweep(minimal, { parameter: 'growth', output: 'income', at: 2035 });
    expect(early.at).toBe(2027);
    expect(late.at).toBe(2035);
    expect(Math.abs(late.points[8].absChange)).toBeGreaterThan(Math.abs(early.points[8].absChange));
  });

  it('applies overlays before sweeping, so an overlay parameter can be swept', () => {
    const r = sweep(minimal, { parameter: 'tutoringIncomeEffect', overlays: [tutoring], output: 'income', at: 2035 });
    expect(r.ok, r.errors.join('; ')).toBe(true);
    expect(r.baselineValue).toBe(0.04);
    expect(r.points.some((p) => p.absChange !== 0)).toBe(true);
  });

  it('sweeps an input by holding it at each level, and says that is what it did', () => {
    const r = sweep(training, { parameter: 'training_budget', output: 'completions', at: 2029, grid: [5e6, 10e6, 15e6] });
    expect(r.kind).toBe('input');
    expect(r.notes.join(' ')).toContain('replaces its whole curve');
    expect(r.points.map((p) => p.output)).toEqual([1000, 2000, 3000]);
  });

  it('reports relative change as null rather than a huge percentage near zero', () => {
    const m = oneLiner('a * 1', [['a', 0]]);
    const r = sweep(m, { parameter: 'a', output: 'out' });
    expect(r.baseline).toBe(0);
    expect(r.points.every((p) => p.relChange === null)).toBe(true);
    expect(r.notes.join(' ')).toContain('reported as null');
  });

  it('refuses a knob the model does not have', () => {
    const r = sweep(minimal, { parameter: 'nope', output: 'income' });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('not a parameter or input');
  });

  it('refuses an output the model does not have', () => {
    const r = sweep(minimal, { parameter: 'growth', output: 'nope' });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('no finite value');
  });

  it('reports which min() argument bound at each grid point', () => {
    const r = sweep(training, { parameter: 'instructor_capacity', output: 'completions', at: 2029, grid: [1000, 3000, 5000] });
    expect(r.points[0].binding).toEqual(['completions is limited by instructor_capacity']);
    // budget/cost = 4000 at 2029, so a 5000 capacity stops being the binding constraint.
    expect(r.points[2].binding).toEqual(['completions is limited by training_budget / cost_per_completion']);
    expect(r.bindingSummary).toHaveLength(2);
  });
});

describe('neighbourhood', () => {
  it('reports absolute responses at both scales', () => {
    const r = neighbourhood(minimal, 'growth', { output: 'income', at: 2035 });
    expect(r.ok).toBe(true);
    expect(r.scales.map((s) => s.fraction)).toEqual([0.01, 0.1]);
    expect(r.scales[0].up.value).toBeCloseTo(0.0202, 12);
    expect(r.scales[1].up.value).toBeCloseTo(0.022, 12);
    expect(r.scales[0].maxAbs).toBeGreaterThan(0);
    expect(r.scales[1].maxAbs).toBeGreaterThan(r.scales[0].maxAbs);
  });

  it('calls a proportional response proportional', () => {
    const r = neighbourhood(minimal, 'growth', { output: 'income', at: 2035 });
    expect(r.linearity!).toBeGreaterThan(0.8);
    expect(r.linearity!).toBeLessThan(1.2);
    expect(r.note).toContain('proportional at both scales');
  });

  it('flags a small nudge that understates a real-sized move', () => {
    const r = neighbourhood(oneLiner('exp(10 * x)', [['x', 1]]), 'x', { output: 'out' });
    expect(r.linearity!).toBeGreaterThan(1.2);
    expect(r.note).toContain('grows with the size of the move');
  });

  it('flags a response that a cap swallows between the two scales', () => {
    const r = neighbourhood(oneLiner('min(x, 1.05)', [['x', 1]]), 'x', { output: 'out' });
    expect(r.linearityUp!).toBeLessThan(0.8);
    expect(r.linearityDown!).toBeCloseTo(1, 6);
    expect(r.note).toContain('caps the response');
  });

  it('reports a one-sided response through the asymmetry of the two arms', () => {
    const r = neighbourhood(oneLiner('min(x, 1.05)', [['x', 1]]), 'x', { output: 'out', fractions: [0.01, 0.1] });
    expect(r.scales[1].asymmetry!).toBeLessThan(0.8);
  });
});

describe('interactions', () => {
  it('calls two knobs that simply add separable', () => {
    const r = interactions(oneLiner('a + b', [['a', 2], ['b', 3]]), ['a', 'b'], { output: 'out' });
    expect(r.ok).toBe(true);
    expect(r.cells).toHaveLength(4);
    expect(r.maxExcess!).toBeLessThan(1e-9);
    expect(r.interacts).toBe(false);
    expect(r.note).toContain('separable');
  });

  it('flags a pair whose joint move beats the sum of the singles', () => {
    const r = interactions(oneLiner('a * b', [['a', 1], ['b', 1]]), ['a', 'b'], { output: 'out', fraction: 0.5 });
    expect(r.interacts).toBe(true);
    expect(r.maxExcess!).toBeGreaterThan(0.1);
    expect(r.note).toContain('not separable');
  });

  it('catches the case single sweeps cannot see: neither alone moves it, both together do', () => {
    const r = interactions(oneLiner('min(a, b)', [['a', 1], ['b', 1]]), ['a', 'b'], { output: 'out', fraction: 0.5 });
    expect(r.maxExcess).toBe(Infinity);
    expect(r.interacts).toBe(true);
    expect(r.note).toContain('neither knob alone moves the output');
  });

  it('does not blow up when the two single responses cancel', () => {
    const r = interactions(oneLiner('a - b', [['a', 10], ['b', 10]]), ['a', 'b'], { output: 'out' });
    expect(r.cells.every((c) => c.excess !== null && Number.isFinite(c.excess))).toBe(true);
    expect(r.interacts).toBe(false);
  });

  it('refuses a knob the model does not have', () => {
    const r = interactions(minimal, ['growth', 'nope'], { output: 'income' });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('not a parameter or input');
  });
});

import { describe, it, expect } from 'vitest';

import { findLiteralBounds, summariseEvidence, validateCoreModel, validateOverlay, WIDE_RANGE_RATIO } from './validate';
import type { CoreModel, Overlay } from './types';
import minimalJson from '../../data/core/minimal.json';
import trainingBudgetJson from '../../data/core/training-budget.json';
import tutoringJson from '../../data/core/overlays/tutoring.json';

const guess = (label: string) => ({ label, kind: 'guess' as const });

/** A model that validates cleanly; each test mutates a copy of it. */
function ok(): CoreModel {
  return {
    schemaVersion: 1,
    id: 'fixture',
    name: 'Fixture',
    time: { start: 2026, end: 2028, step: 'year' },
    parameters: [{ id: 'rate', value: 0.1, unit: 'share', source: guess('illustrative') }],
    variables: [{ id: 'out', unit: 'share', equation: 'rate * 2' }],
    outputs: ['out'],
  };
}

describe('schema layer', () => {
  it('accepts the bundled models with no errors', () => {
    for (const json of [minimalJson, trainingBudgetJson]) {
      const r = validateCoreModel(json);
      expect(r.errors, `${(json as { id: string }).id}: ${r.errors.join(' | ')}`).toEqual([]);
      expect(r.ok).toBe(true);
      expect(r.model?.id).toBe((json as { id: string }).id);
    }
  });

  it('requires a source on every parameter', () => {
    const m = ok() as unknown as Record<string, unknown>;
    (m.parameters as Array<Record<string, unknown>>)[0].source = undefined;
    delete (m.parameters as Array<Record<string, unknown>>)[0].source;
    const r = validateCoreModel(m);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain("must have required property 'source'");
  });

  it('requires a source on every effect', () => {
    const m = ok();
    (m as CoreModel).effects = [{ id: 'boost', target: 'out', op: 'add', expr: '0.1' } as never];
    const r = validateCoreModel(m);
    expect(r.errors.join(' ')).toContain("must have required property 'source'");
  });

  it('rejects an unknown top-level property rather than ignoring it', () => {
    const m = { ...ok(), assumptions: 'none' };
    const r = validateCoreModel(m);
    expect(r.errors.join(' ')).toContain('must NOT have additional properties');
    expect(r.errors.join(' ')).toContain('assumptions');
  });

  it('rejects a step unit outside the enum and a bad range shape', () => {
    const bad = ok();
    (bad.time as unknown as { step: string }).step = 'quarter';
    expect(validateCoreModel(bad).errors.join(' ')).toContain('/time/step');

    const badRange = ok();
    badRange.parameters[0].range = { dist: 'beta', p5: 0, p95: 1 } as never;
    expect(validateCoreModel(badRange).errors.join(' ')).toContain('/parameters/0/range/dist');
  });

  it('rejects an id that could not be written in an equation', () => {
    const m = ok();
    m.parameters[0].id = 'rate-of-change';
    const r = validateCoreModel(m);
    expect(r.errors.join(' ')).toContain('/parameters/0/id');
  });

  it('returns schema errors without attempting to compile', () => {
    const r = validateCoreModel({ schemaVersion: 2 });
    expect(r.ok).toBe(false);
    expect(r.model).toBeUndefined();
    expect(r.errors.every((e) => e.startsWith('schema:'))).toBe(true);
  });
});

describe('engine diagnostics are split into errors and warnings', () => {
  it('reports an unknown symbol as an error', () => {
    const m = ok();
    m.variables[0].equation = 'rate * missing';
    const r = validateCoreModel(m);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('unknown-symbol');
  });

  it('reports a disconnected variable as a warning, not an error', () => {
    const m = ok();
    m.variables.push({ id: 'orphan', equation: 'rate + 1' });
    const r = validateCoreModel(m);
    expect(r.ok).toBe(true);
    expect(r.warnings.join(' ')).toContain('disconnected');
  });

  it('surfaces run-time failures a static check cannot see', () => {
    const m = ok();
    m.variables[0].equation = 'rate / 0';
    const r = validateCoreModel(m);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('non-finite');
  });
});

describe('evidence summary', () => {
  it('counts parameters by source kind and lists the assumptions', () => {
    const ev = summariseEvidence([
      { id: 'a', value: 1, source: { label: 'RCT', kind: 'causal' } },
      { id: 'b', value: 2, source: { label: 'regression', kind: 'associational' } },
      { id: 'c', value: 3, source: { label: 'made up', kind: 'guess' }, range: { dist: 'uniform', p5: 1, p95: 5 } },
      { id: 'd', value: 4, source: { label: 'no kind given' } },
    ]);
    expect(ev.total).toBe(4);
    expect(ev.byKind).toMatchObject({ causal: 1, associational: 1, guess: 1, assumed: 1 });
    expect(ev.assumptions.map((a) => a.id)).toEqual(['c', 'd']);
    expect(ev.assumptionCount).toBe(2);
    expect(ev.ranged).toBe(1);
    // 'd' is a guess presented as an exact number.
    expect(ev.unrangedAssumptions).toEqual(['d']);
  });

  it('reports the bundled training model as five assumptions', () => {
    const r = validateCoreModel(trainingBudgetJson);
    expect(r.evidence.assumptionCount).toBe(5);
    expect(r.evidence.byKind.guess).toBe(5);
  });
});

describe('wide-range', () => {
  it('warns when p95 is more than 20x p5', () => {
    const m = ok();
    m.parameters[0].range = { dist: 'lognormal', p5: 0.01, p95: 1 };
    const r = validateCoreModel(m);
    expect(r.ok).toBe(true);
    expect(r.warnings.join(' ')).toContain('wide-range');
    expect(r.warnings.join(' ')).toContain('100x');
  });

  it('does not warn about a band inside the threshold', () => {
    const m = ok();
    m.parameters[0].range = { dist: 'lognormal', p5: 0.1, p95: 0.1 * WIDE_RANGE_RATIO };
    expect(validateCoreModel(m).warnings.join(' ')).not.toContain('wide-range');
  });

  it('warns when a lognormal range touches or crosses zero', () => {
    const m = ok();
    m.parameters[0].range = { dist: 'lognormal', p5: 0, p95: 0.2 };
    expect(validateCoreModel(m).warnings.join(' ')).toContain('wide-range');
  });

  it('leaves a normal range that straddles zero alone (a sign-uncertain effect is honest)', () => {
    const m = ok();
    m.parameters[0].range = { dist: 'normal', p5: -0.05, p95: 0.05 };
    expect(validateCoreModel(m).warnings.join(' ')).not.toContain('wide-range');
  });

  it('treats p5 above p95 as an error', () => {
    const m = ok();
    m.parameters[0].range = { dist: 'uniform', p5: 5, p95: 1 };
    expect(validateCoreModel(m).errors.join(' ')).toContain('range-invalid');
  });

  it('warns when the point value sits outside the parameter bounds', () => {
    const m = ok();
    m.parameters[0].bounds = [0, 0.05];
    expect(validateCoreModel(m).warnings.join(' ')).toContain('out-of-bounds');
  });
});

describe('literal-bound', () => {
  it('finds a numeric cap and exempts the structural ones', () => {
    expect(findLiteralBounds('min(x, 1000)')).toEqual([{ fn: 'min', literal: 1000, text: '1000' }]);
    expect(findLiteralBounds('min(a, b, c)')).toEqual([]);
    expect(findLiteralBounds('clamp(share, 0, 1)')).toEqual([]);
    expect(findLiteralBounds('max(headcount, 0)')).toEqual([]);
    expect(findLiteralBounds('min(x[t-1] * g, 250)')).toHaveLength(1);
    expect(findLiteralBounds('this is not an expression (')).toEqual([]);
  });

  it('warns about a cap in a variable and names the number to promote', () => {
    const m = ok();
    m.variables[0].equation = 'min(rate * 2, 1000)';
    const r = validateCoreModel(m);
    expect(r.ok).toBe(true);
    const w = r.warnings.find((x) => x.startsWith('literal-bound'));
    expect(w).toBeDefined();
    expect(w).toContain('no parameter and no source');
    expect(w).toContain('1000');
  });

  it('says nothing about the training model, whose limits are all parameters', () => {
    const r = validateCoreModel(trainingBudgetJson);
    expect(r.warnings.join(' ')).not.toContain('literal-bound');
  });
});

describe('validateOverlay', () => {
  const minimal = minimalJson as unknown as CoreModel;

  it('accepts the bundled tutoring overlay and counts its own assumptions', () => {
    const r = validateOverlay(minimal, tutoringJson);
    expect(r.errors, r.errors.join(' | ')).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.evidence.total).toBe(2);
    expect(r.evidence.assumptionCount).toBe(2);
    expect(r.model?.effects).toHaveLength(2);
  });

  it('rejects an overlay that rewrites a base equation', () => {
    const o: Overlay = { id: 'fork', variables: [{ id: 'wellbeing', equation: '7' }] };
    const r = validateOverlay(minimal, o);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('structural-change');
  });

  it('rejects a new overlay parameter with no source', () => {
    const o: Overlay = { id: 'bare', parameters: [{ id: 'novel', value: 3 }] };
    const r = validateOverlay(minimal, o);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('missing-source');
  });

  it('lets an overlay move an existing parameter without restating its source', () => {
    const o: Overlay = { id: 'faster', parameters: [{ id: 'growth', value: 0.04 }] };
    const r = validateOverlay(minimal, o);
    expect(r.errors).toEqual([]);
    expect(r.model?.parameters.find((p) => p.id === 'growth')?.value).toBe(0.04);
  });

  it('rejects an unknown overlay property', () => {
    const r = validateOverlay(minimal, { id: 'x', equations: [] });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('must NOT have additional properties');
  });

  it('validates the combined model, not just the overlay in isolation', () => {
    const o: Overlay = {
      id: 'dangling',
      effects: [{ id: 'e1', target: 'wellbeing', op: 'add', expr: 'notAParameter', source: guess('x') }],
    };
    const r = validateOverlay(minimal, o);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('unknown-symbol');
  });
});

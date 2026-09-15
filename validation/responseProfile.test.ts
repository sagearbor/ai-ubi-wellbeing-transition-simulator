import { describe, it, expect } from 'vitest';
import { runResponseProfile, renderMarkdown, NUMERIC_LEVERS, HEADLINE_KEYS, MACRO_STRESS_SWITCH, runScenario, defaultScenario, CATEGORICAL_SWITCHES } from './responseProfile';
import { PRESET_MODELS } from '../constants';

describe('responseProfile - stage 3 response review of the default world model', () => {
  const profile = runResponseProfile({ scenario: {...defaultScenario(),model:PRESET_MODELS[0]}, horizons: [12, 24] });

  it('profiles every public numeric lever with four nudge arms and a sweep', () => {
    expect(profile.levers.map((l) => l.id)).toEqual(NUMERIC_LEVERS.map((l) => l.id));
    for (const l of profile.levers) {
      expect(l.arms.map((a) => a.factor)).toEqual([0.99, 1.01, 0.9, 1.1]);
      expect(l.sweep.averageWellbeing).toHaveLength(9);
      expect(['flat', 'linear', 'saturating', 'threshold', 'non-monotone']).toContain(l.sweep.shape.shape);
    }
  });

  it('reports finite headline outputs at every horizon and a zero-nudge baseline', () => {
    for (const h of profile.horizons) {
      for (const k of HEADLINE_KEYS) expect(Number.isFinite(profile.base[h][k])).toBe(true);
    }
    // The 1.0 sweep point is the base itself, not a re-run that could drift.
    const last = Math.max(...profile.horizons);
    for (const l of profile.levers) expect(l.sweep.averageWellbeing[4]).toBe(profile.base[last].averageWellbeing);
  });

  it('adoption growth is a live lever and a faster rate lowers wellbeing in this model', () => {
    const g = profile.levers.find((l) => l.id === 'aiGrowthRate')!;
    const plus10 = g.arms.find((a) => a.factor === 1.1)!.delta[24];
    expect(plus10.usAdoption).toBeGreaterThan(0);
    expect(plus10.averageWellbeing).toBeLessThan(0);
  });

  it('renders markdown with one row per lever and horizon', () => {
    const md = renderMarkdown(profile);
    expect(md).toContain('| aiGrowthRate |');
    expect((md.match(/\| displacementRate \|/g) ?? []).length).toBe(2 + 2); // nudges table + other-outputs table
  });
});

describe('responseProfile - stage 4 displacement stress of the anchored candidate', () => {
  const anchored = { ...defaultScenario(), model: { ...PRESET_MODELS.find((m) => m.id === 'evidence-anchored')! } };

  it('each stress case reaches the displacement channel it names (unemployment rises; wellbeing is finite)', () => {
    // Mechanism reach only. No bound on how far wellbeing may fall: a size limit would reward a
    // preferred degree of calm (review 2026-09-14, finding 8).
    const runs = [anchored, ...MACRO_STRESS_SWITCH.alternatives.map((a) => a.apply(anchored))].map((s) => runScenario(s, [48])[48]);
    for (const r of runs) expect(Number.isFinite(r.usWellbeing)).toBe(true);
    expect(runs.slice(1).every((r) => r.usWellbeing < runs[0].usWellbeing)).toBe(true);
  });

  it('is offered only to models with a macro block', () => {
    expect(CATEGORICAL_SWITCHES.map((s) => s.id)).not.toContain('stress');
    expect(runResponseProfile({ scenario: {...defaultScenario(),model:PRESET_MODELS[0]}, horizons: [1] }).switches.map((s) => s.id)).not.toContain('stress');
  });
});

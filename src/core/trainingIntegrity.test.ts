import { expect, it } from 'vitest';
import training from '../../data/core/training-budget.json';
import type { CoreModel, Overlay } from './types';
import { runModel } from './engine';

it.each([-1, 3])('refuses invalid final placements for multiplier %s', (multiplier) => {
  const overlay: Overlay = { id: 'invalid-placement-effect',
    inputs: [{ ...(training as CoreModel).inputs![0], curve: { '2026': 500000 } }],
    effects: [{ id: 'boost', target: 'potential_placements', op: 'multiply', expr: String(multiplier), source: { label: 'test', kind: 'assumed' } }],
  };
  const r = runModel(training as CoreModel, { overlays: [overlay] });
  expect(r.ok).toBe(false);
  expect(r.diagnostics.some(d => d.code === 'invariant-violated')).toBe(true);
});

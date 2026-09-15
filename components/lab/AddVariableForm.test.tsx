/** Exercise rendered controls and their real handlers without adding a DOM dependency. */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
vi.mock('react', async original => {
  const react = await original<typeof import('react')>();
  return { ...react, useState: (initial: unknown) => [typeof initial === 'function' ? initial() : initial, vi.fn()] };
});
import AddVariableForm from './AddVariableForm';
import { findFixture } from '../../src/core/fixtures';
import { buildExperiment, exactModel } from '../../src/financials/share';
import type { CoreModel, Overlay } from '../../src/core/types';
import { runModel } from '../../src/core/engine';

function nodes(tree: any): any[] {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function words(tree: any): string {
  if (typeof tree === 'string') return tree;
  if (Array.isArray(tree)) return tree.map(words).join('');
  return tree && typeof tree === 'object' ? words(tree.props?.children) : '';
}
const financial = exactModel(buildExperiment(), 'A');
const supported = findFixture('minimal')!.model as CoreModel;
function render(model: CoreModel, applied: Overlay[] = []) {
  const onApply = vi.fn();
  const onRemove = vi.fn();
  const tree = AddVariableForm({ model, applied, onApply, onRemove });
  return { tree, onApply, onRemove, controls: nodes(tree) };
}

describe('authoring capability affordance', () => {
  it('replaces the impossible financial creation form with concrete extension instructions', () => {
    const ui = render(financial);
    expect(financial.variables.every(variable => variable.hook === false)).toBe(true);
    expect(words(ui.tree)).toContain('Adding a variable here is unavailable for this model.');
    expect(words(ui.tree)).toContain('no eligible equation targets');
    for (const instruction of ['Advanced: model file', 'Export model + overlays (JSON)', 'text editor', 'Import a model or overlay (JSON)', 'new experimental model']) {
      expect(words(ui.tree)).toContain(instruction);
    }
    expect(ui.controls.filter(node => ['form', 'input', 'select'].includes(node.type))).toHaveLength(0);
    expect(words(ui.tree)).not.toContain('Apply as an overlay');
    expect(ui.onApply).not.toHaveBeenCalled();
  });

  it('preserves a working form and overlay application for supported models', () => {
    const ui = render(supported);
    expect(words(ui.tree)).not.toContain('unavailable');
    expect(ui.controls.find(node => node.props.id === 'lab-eff-target-0')).toBeDefined();
    const form = ui.controls.find(node => node.type === 'form');
    expect(form).toBeDefined();
    form.props.onSubmit({ preventDefault: vi.fn() });
    expect(ui.onApply).toHaveBeenCalledOnce();
    const overlay = ui.onApply.mock.calls[0][0];
    expect(overlay.effects.length).toBeGreaterThan(0);
    expect(runModel(supported, { overlays: [overlay] }).diagnostics.filter(diagnostic => diagnostic.level === 'error')).toEqual([]);
  });

  it.each([['unsupported', financial], ['supported', supported]] as const)(
    'preserves overlay removal on an %s model', (_, model) => {
      const overlay: Overlay = { id: 'existing-user-overlay', effects: [] };
      const ui = render(model, [overlay]);
      const remove = ui.controls.find(node => node.props['aria-label'] === `Remove overlay ${overlay.id}`);
      expect(remove).toBeDefined();
      remove.props.onClick();
      expect(ui.onRemove).toHaveBeenCalledWith(overlay.id);
      expect(ui.onApply).not.toHaveBeenCalled();
    },
  );
});

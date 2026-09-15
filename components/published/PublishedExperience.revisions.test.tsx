/** Host the real component's state and handlers; source revisions must survive every edit path. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
const host = vi.hoisted(() => ({ cells: [] as unknown[], cursor: 0 }));
vi.mock('react', async original => {
  const react = await original<typeof import('react')>();
  return { ...react, useState(initial: unknown) {
    const index = host.cursor++;
    if (!(index in host.cells)) host.cells[index] = typeof initial === 'function' ? initial() : initial;
    return [host.cells[index], (value: unknown) => { host.cells[index] = value; }];
  } };
});
import PublishedExperience from './PublishedExperience';
import { buildExperiment, decodeExperiment, exactModel, validateExperiment, type FinancialExperiment } from '../../src/financials/share';
import recordedPrepatchExperiments from '../../src/financials/fixtures/v1-experiments.json';
// Revision behavior uses explicitly new executions on this runtime, never relabeled fixture pins.
const originalExperiments = recordedPrepatchExperiments.map(e => buildExperiment(e.recordId, e.scenarios, e.view as 'explore' | 'compare', e.collectionId));

function nodes(tree: any): any[] {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree: any): string {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join('');
  return tree && typeof tree === 'object' ? text(tree.props?.children) : '';
}
function mount(initial?: FinancialExperiment) {
  let mode: 'explore' | 'compare' = 'explore';
  let tree: ReturnType<typeof PublishedExperience>;
  const render = () => {
    host.cursor = 0;
    tree = PublishedExperience({ initial, mode, onMode: value => { mode = value; },
      onLab() {}, onWorld() {}, onHistory() {}, onRisk() {} });
  };
  render();
  return {
    get tree() { return tree; },
    experiment() {
      const link = nodes(tree).find(n => n.type === 'a' && text(n) === 'Paste a policy');
      return decodeExperiment(new URL(link.props.href).hash);
    },
    edit(side: 'A' | 'B', patch: object) {
      nodes(tree).find(n => n.props?.side === side && n.props?.update).props.update(patch);
      render();
    },
    select(id: string, value: string) {
      nodes(tree).find(n => n.props?.id === id).props.onChange({ target: { value } });
      render();
    },
    compare() {
      nodes(tree).find(n => n.type === 'button' && text(n) === 'Compare two editable scenarios').props.onClick();
      render();
    },
    async open(value: unknown) {
      const file = JSON.stringify(value);
      await nodes(tree).find(n => n.type === 'input' && n.props.type === 'file').props.onChange({
        target: { files: [{ size: file.length, text: async () => file }], value: 'test.json' },
      });
      render();
    },
  };
}
beforeEach(() => { host.cells = []; host.cursor = 0; });

describe('collection identity through published edits', () => {
  it('clearly refuses an old-runtime file without replacing the current experiment', async () => {
    const ui = mount();
    const current = ui.experiment();
    await ui.open(recordedPrepatchExperiments[0]);
    expect(ui.experiment()).toEqual(current);
    expect(text(ui.tree)).toContain('Incompatible runtime');
  });
  it('keeps v1 through independent scenario, company, cohort, view and tool-link changes', () => {
    const original = validateExperiment(originalExperiments[0]);
    const ui = mount(original);
    ui.edit('A', { policyShare: .41 });
    expect(ui.experiment().scenarios.A.policyShare).toBe(.41);
    expect(ui.experiment().modelHashes.B).toBe(original.modelHashes.B);
    ui.compare();
    ui.edit('B', { trainingShare: .53 });
    ui.select('pub-cohort', 'GBR');
    expect(ui.experiment().scenarios.A.recipientCountry).toBe('GBR');
    expect(ui.experiment().scenarios.B.recipientCountry).toBe('GBR');
    expect(exactModel(ui.experiment(), 'A').sources[0].url).toContain('apple.com/newsroom');
    ui.select('pub-company', 'nvidia-fy2025');
    const changed = ui.experiment();
    expect(changed.collectionId).toBe(original.collectionId);
    expect(changed.dataHash).toBe(original.dataHash);
    expect(changed.recordId).toBe('nvidia-fy2025');
    expect(changed.view).toBe('compare');
    expect(changed.scenarios.B.trainingShare).toBe(.53);
    expect(text(ui.tree)).toContain('NVIDIA · FY2025 (ended 2025-01-26)');
    for (const label of ['Paste a policy', 'Inspect extension options', 'Inspect uncertainty']) {
      const link = nodes(ui.tree).find(n => n.type === 'a' && text(n) === label);
      expect(decodeExperiment(new URL(link.props.href).hash)).toEqual(changed);
    }
  });
  it('starts on v2, reopens explicit v1, preserves it on edits, and allows explicit v2 reopen', async () => {
    const ui = mount();
    const current = ui.experiment();
    expect(current.collectionId).toBe('reported-company-financials-fy2025-v2');
    await ui.open(originalExperiments[0]);
    expect(ui.experiment()).toEqual(originalExperiments[0]);
    ui.edit('A', { trainingShare: .3 });
    expect(ui.experiment().collectionId).toBe('reported-company-financials-fy2025-v1');
    expect(exactModel(ui.experiment(), 'A').sources[0].url).toContain('apple.com/newsroom');
    await ui.open(current);
    expect(ui.experiment()).toEqual(current);
    expect(exactModel(ui.experiment(), 'A').sources[0].url).toContain('sec.gov');
  });
  it('refuses tampered collection pins without replacing the open legacy experiment', async () => {
    const original = validateExperiment(originalExperiments[0]);
    const ui = mount(original);
    await ui.open({ ...original, collectionId: buildExperiment().collectionId });
    expect(ui.experiment()).toEqual(original);
    expect(text(ui.tree)).toContain('Import failed');
    expect(text(ui.tree)).toContain('dataHash');
  });
});

/**
 * Model Lab smoke tests. There is no jsdom in this repo, so the tab is rendered to a string with
 * react-dom/server and asserted on the text it puts in front of a reader; everything that needs a
 * click lives in labState.ts and is tested directly there.
 *
 * The load-bearing assertions are the v3 stage-2 acceptance criteria: scope is visible before any
 * result, the binding sentence names the constraint that actually bound, assumptions are labelled
 * as assumptions, a new variable reaches two equations through an overlay alone, and a broken
 * overlay produces an explicit diagnostic rather than a silent wrong number.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import LabTab from './LabTab';
import DiagnosticsPanel from './DiagnosticsPanel';
import { CORE_FIXTURES, findFixture } from '../../src/core/fixtures';
import { runModel } from '../../src/core/engine';
import type { CoreModel } from '../../src/core/types';
import {
  applyOverlayForm,
  bindingChain,
  countAssumptions,
  emptyOverlayForm,
  hypotheticalBanner,
  hypotheticalOverlay,
  makeHypothetical,
  parameterOverlay,
  renameSymbol,
  sourceStyle,
  stepForYear,
  type OverlayForm,
} from './labState';

const training = findFixture('training-budget')!.model as CoreModel;
const minimal = findFixture('minimal')!.model as CoreModel;

const html = (props: React.ComponentProps<typeof LabTab> = {}): string =>
  renderToString(React.createElement(LabTab, props));

describe('LabTab (renders)', () => {
  it('renders the picker over every bundled fixture', () => {
    const out = html({ initialModelId: 'training-budget' });
    expect(out).toContain('Model Lab');
    expect(out).toContain('Start from');
    for (const f of CORE_FIXTURES) expect(out).toContain(f.label);
  });

  it('shows the training fixture scope before any result', () => {
    const out = html({ initialModelId: 'training-budget' });
    const scopeAt = out.indexOf('Tracks gross placements through one channel');
    expect(scopeAt).toBeGreaterThan(-1);
    expect(out).toContain('Scope and limits');
    // scope text comes before the results section on the page
    expect(scopeAt).toBeLessThan(out.indexOf('What limits the result'));
  });

  it('names the constraint that binds in 2029', () => {
    const out = html({ initialModelId: 'training-budget' });
    expect(out).toContain('completions is limited by instructor_capacity');
    expect(out).toContain('placements is limited by suitable_openings');
    expect(out).toContain('Try relaxing it (hypothetical)');
  });

  it('labels guessed parameters as assumptions and counts them', () => {
    const out = html({ initialModelId: 'training-budget' });
    expect(out).toContain('assumption');
    expect(out).toContain('5 of 5 parameters are assumptions');
  });

  it('shows the outputs, the tests and the model file expander', () => {
    const out = html({ initialModelId: 'training-budget' });
    for (const id of training.outputs) expect(out).toContain(id);
    expect(out).toContain('Reproduction tests');
    expect(out).toContain('2 of 2 passing');
    expect(out).toContain('Advanced: model file');
    expect(out).toContain('Add a variable');
  });

  it('reports an explicit diagnostic when a broken overlay is applied', () => {
    const form: OverlayForm = {
      ...emptyOverlayForm(minimal),
      inputId: 'brokenAccess',
      effects: [{ target: 'wellbeing', op: 'add', expr: 'nope * brokenAccess', unit: 'ladder' }],
    };
    const { overlay, errors } = applyOverlayForm(form, minimal);
    expect(errors).toEqual([]);
    const out = html({ initialModelId: 'minimal', initialCustomOverlays: [overlay!] });
    expect(out).toContain('unknown-symbol');
    expect(out).toContain('is not a parameter, input, variable or solve unknown');
    expect(out).toContain('This run did not complete');
  });

  it('renders the uncertainty band without pretending it is a forecast', () => {
    const out = html({ initialModelId: 'minimal', initialUncertainty: true });
    expect(out).toContain('Uncertainty on');
    expect(out).toContain('p5–p95 band');
  });
});

describe('DiagnosticsPanel', () => {
  it('shows code, level and message for each diagnostic', () => {
    const out = renderToString(
      React.createElement(DiagnosticsPanel, {
        diagnostics: [
          { level: 'error', code: 'cycle', message: 'same-step cycle: a -> b -> a', where: 'a' },
          { level: 'warning', code: 'disconnected', message: 'nothing reads x', where: 'x' },
        ],
      }),
    );
    expect(out).toContain('1 error, 1 warning');
    expect(out).toContain('cycle');
    expect(out).toContain('same-step cycle');
    expect(out).toContain('disconnected');
  });
});

describe('labState.applyOverlayForm', () => {
  const base = emptyOverlayForm(minimal);

  it('builds an overlay whose new input reaches two equations, with no edit to the base model', () => {
    const form: OverlayForm = {
      ...base,
      inputId: 'labTutoring',
      unit: 'share',
      startYear: 2026,
      startValue: 0,
      endYear: 2035,
      endValue: 0.6,
      effects: [
        { target: 'income', op: 'multiply', expr: '1 + 0.04 * labTutoring', unit: '' },
        { target: 'wellbeing', op: 'add', expr: '0.12 * labTutoring', unit: 'ladder' },
      ],
    };
    const { overlay, errors } = applyOverlayForm(form, minimal);
    expect(errors).toEqual([]);
    expect(overlay!.effects!.map((e) => e.target)).toEqual(['income', 'wellbeing']);

    const before = JSON.stringify(minimal);
    const plain = runModel(minimal);
    const withOverlay = runModel(minimal, { overlays: [overlay!] });
    expect(withOverlay.ok, withOverlay.diagnostics.map((d) => d.message).join('; ')).toBe(true);
    const last = plain.years.length - 1;
    expect(withOverlay.series._.income[last]).toBeGreaterThan(plain.series._.income[last]);
    expect(withOverlay.series._.wellbeing[last]).toBeGreaterThan(plain.series._.wellbeing[last]);
    expect(JSON.stringify(minimal)).toBe(before);
  });

  it('carries expressions when the new input is renamed', () => {
    expect(renameSymbol('1 + 0.05 * newAccess', 'newAccess', 'labTutoring')).toBe('1 + 0.05 * labTutoring');
    expect(renameSymbol('1 + newAccessMore', 'newAccess', 'x')).toBe('1 + newAccessMore');
    expect(renameSymbol('1 + a', 'a', 'a')).toBe('1 + a');
  });

  it('rejects a bad id, a clashing id, a missing effect and a missing source', () => {
    expect(applyOverlayForm({ ...base, inputId: '2bad' }, minimal).errors[0]).toContain('not a valid id');
    expect(applyOverlayForm({ ...base, inputId: 'income' }, minimal).errors[0]).toContain('already exists');
    expect(applyOverlayForm({ ...base, effects: [] }, minimal).errors.join(' ')).toContain('at least one effect');
    expect(applyOverlayForm({ ...base, sourceLabel: '  ' }, minimal).errors.join(' ')).toContain('source label');
    expect(applyOverlayForm({ ...base, endYear: 2020 }, minimal).errors.join(' ')).toContain('end year must be after');
    expect(applyOverlayForm({ ...base, inputId: '2bad' }, minimal).overlay).toBeNull();
  });
});

describe('labState.bindingChain', () => {
  const result = runModel(training);

  it('puts the selected output first, then what feeds it', () => {
    const t = stepForYear(result.years, 2029);
    const groups = bindingChain(training, result, '_', 'placements', t);
    expect(groups.map((g) => g.variable)).toEqual(['placements', 'completions']);
    expect(groups[0].depth).toBe(0);
    expect(groups[1].depth).toBe(1);
    expect(groups[0].lines[0].text).toBe('placements is limited by suitable_openings');
    expect(groups[1].lines[0].text).toBe('completions is limited by instructor_capacity');
  });

  it('offers a relax only when the binding argument is a bare parameter', () => {
    const groups = bindingChain(training, result, '_', 'placements', 0);
    const placements = groups.find((g) => g.variable === 'placements')!;
    // 2026: the completions * placement_rate branch binds, which is an expression, not a parameter
    expect(placements.lines[0].text).toBe('placements is limited by completions * placement_rate');
    expect(placements.lines[0].relaxParameter).toBeNull();
    const t = stepForYear(result.years, 2029);
    expect(bindingChain(training, result, '_', 'placements', t)[0].lines[0].relaxParameter).toBe('suitable_openings');
  });
});

describe('labState overlays', () => {
  it('turns edits into a parameter overlay, ignoring unchanged and unknown ids', () => {
    const baseValues = new Map(training.parameters.map((p) => [p.id, p.value] as const));
    expect(parameterOverlay({ suitable_openings: 1000 }, baseValues)).toBeNull();
    expect(parameterOverlay({ nope: 5 }, baseValues)).toBeNull();
    const ov = parameterOverlay({ suitable_openings: 2000, nope: 5 }, baseValues)!;
    expect(ov.parameters).toEqual([{ id: 'suitable_openings', value: 2000 }]);
    const r = runModel(training, { overlays: [ov] });
    expect(r.ok).toBe(true);
    expect(r.series._.placements[3]).toBe(1500);
  });

  it('relaxes the binding constraint by 25% and moves the output by exactly that much', () => {
    const plain = runModel(training);
    const h = makeHypothetical('suitable_openings', plain.parameters._.suitable_openings, 0.25);
    const bumped = runModel(training, { overlays: [hypotheticalOverlay(h)] });
    expect(bumped.ok).toBe(true);
    // 2029: openings bound placements at 1000; +25% headroom is the whole of the gain.
    expect(plain.series._.placements[3]).toBe(1000);
    expect(bumped.series._.placements[3]).toBe(1250);
    // completions is limited by instructor_capacity, so relaxing openings cannot move it
    expect(bumped.series._.completions[3]).toBe(plain.series._.completions[3]);
  });

  it('labels a hypothetical as a hypothetical that needs its own mechanism', () => {
    const h = makeHypothetical('suitable_openings', 1000, 0.25);
    expect(h.to).toBe(1250);
    const banner = hypotheticalBanner(h);
    expect(banner).toContain('HYPOTHETICAL: suitable_openings +25%');
    expect(banner).toContain('needs its own mechanism, cost and evidence');
  });

  it('calls a guess a guess', () => {
    expect(sourceStyle({ label: 'illustrative', kind: 'guess' }).assumption).toBe(true);
    expect(sourceStyle({ label: 'WHR 2024', kind: 'associational' }).assumption).toBe(false);
    expect(sourceStyle(undefined).label).toBe('assumed');
    expect(countAssumptions(training.parameters).text).toBe('5 of 5 parameters are assumptions');
    expect(countAssumptions(minimal.parameters).text).toBe('1 of 2 parameters are assumptions');
  });
});

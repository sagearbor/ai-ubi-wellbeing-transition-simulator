/**
 * Smoke tests for ModelUpload's pure render helpers (P8-repairs A5).
 *
 * There is no @testing-library / jsdom in this repo (see components/futures/FuturesTab.test.tsx
 * for the established pattern), so these render the helpers to a string with react-dom/server
 * and assert on the markup. `renderValidationSection` and `renderApplyButton` are exported
 * specifically so the "a model whose equations don't compile shows the errors and is never
 * offered an activate control" behaviour can be tested without simulating file-drop events,
 * which renderToString can't do.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { renderValidationSection, renderApplyButton } from './ModelUpload';
import { ModelValidationResult } from '../types';
import { EquationSetCompileResult, CompiledEquationSet } from '../src/services/equationParser';

const html = (node: React.ReactNode): string =>
  renderToString(React.createElement('div', null, node));

const passingTier1: ModelValidationResult = {
  valid: true,
  tier1Passed: true,
  tier2Score: 0,
  tier2Total: 6,
  failures: [],
  warnings: [],
  complexity: 42
};

const failingTier1: ModelValidationResult = {
  valid: false,
  tier1Passed: false,
  tier2Score: 0,
  tier2Total: 6,
  failures: [
    { testId: 'T1-SCHEMA', testName: 'JSON Schema Validation', category: 'sanity', reason: 'missing field', expected: 'x', actual: 'y' }
  ],
  warnings: [],
  complexity: 0
};

// The `.ok: true` branch's `equations` value is never read by these render helpers, so an
// empty stub is enough here.
const compileOk: EquationSetCompileResult = { ok: true, equations: {} as CompiledEquationSet };

const compileFailed: EquationSetCompileResult = {
  ok: false,
  errors: [
    { equation: 'aiAdoptionGrowth', error: 'Unexpected end of expression (char 15)', position: 15 },
    { equation: 'ubiUtility', error: "Variable 'hackerVar' is not allowed." }
  ]
};

describe('ModelUpload / renderValidationSection', () => {
  it('renders nothing before a file has been validated', () => {
    const out = html(renderValidationSection(null, null));
    expect(out).not.toContain('Tier 1');
  });

  it('shows the Tier 1 pass banner and no compile-error block for a model that compiles', () => {
    const out = html(renderValidationSection(passingTier1, compileOk));
    expect(out).toContain('Tier 1');
    expect(out).toContain('Passed');
    expect(out).not.toContain('do not compile');
  });

  it('shows Tier 1 failures without a compile section when schema validation itself failed', () => {
    const out = html(renderValidationSection(failingTier1, null));
    expect(out).toContain('Tier 1');
    expect(out).toContain('Failed');
    expect(out).toContain('missing field');
    expect(out).not.toContain('do not compile');
  });

  it('renders the per-equation error list (name + message + position) for a model whose equations do not compile', () => {
    const out = html(renderValidationSection(passingTier1, compileFailed));
    expect(out).toContain('Equations do not compile');
    expect(out).toContain('aiAdoptionGrowth');
    expect(out).toContain('Unexpected end of expression');
    expect(out).toContain('char 15');
    expect(out).toContain('ubiUtility');
    expect(out).toContain('hackerVar');
  });
});

describe('ModelUpload / renderApplyButton', () => {
  it('offers a disabled Apply Model control before any validation has run', () => {
    const out = html(renderApplyButton(null, null, () => {}, () => {}));
    expect(out).toContain('Apply Model');
    expect(out).toContain('disabled=""');
  });

  it('offers an enabled Apply Model control once Tier 1 passes and the equations compile', () => {
    const out = html(renderApplyButton(passingTier1, compileOk, () => {}, () => {}));
    expect(out).toContain('Apply Model');
    expect(out).not.toContain('disabled=""');
  });

  it('offers no activate control at all - not even a disabled one - when the equations fail to compile', () => {
    const out = html(renderApplyButton(passingTier1, compileFailed, () => {}, () => {}));
    expect(out).not.toContain('Apply Model');
    // Cancel must still be offered - the user isn't stuck.
    expect(out).toContain('Cancel');
  });

  it('still offers a disabled Apply Model control (not a hidden one) when Tier 1 itself failed', () => {
    const out = html(renderApplyButton(failingTier1, null, () => {}, () => {}));
    expect(out).toContain('Apply Model');
    expect(out).toContain('disabled=""');
  });
});

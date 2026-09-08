/**
 * Unit tests for ModelEditor's pure state helpers (P8-T11).
 */

import { describe, it, expect } from 'vitest';
import {
  EDITABLE_EQUATION_FIELDS,
  validateEquationField,
  validateAllEquationFields,
  allFieldsValid,
  initEquationsForEditor,
  resetFieldToDefault,
  buildModelConfigFromEditor
} from './modelEditorState';
import { DEFAULT_EQUATIONS, DEFAULT_MODEL_CONFIG } from '../../constants';
import { EquationSet, ModelConfig } from '../../types';

describe('validateEquationField', () => {
  it('accepts a valid equation over allowed variables', () => {
    expect(validateEquationField('adoption * 0.5 + wellbeing')).toEqual({ valid: true });
  });

  it('rejects an empty equation with a clear message', () => {
    const result = validateEquationField('');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cannot be empty/i);
  });

  it('rejects a whitespace-only equation', () => {
    expect(validateEquationField('   ').valid).toBe(false);
  });

  it('surfaces the underlying mathParser error for a disallowed variable', () => {
    const result = validateEquationField('totallyMadeUpVariable * 2');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/not allowed/i);
  });

  it('surfaces the underlying mathParser error for a syntax error', () => {
    const result = validateEquationField('adoption * (');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('surfaces the underlying mathParser error for a disallowed function (e.g. eval)', () => {
    const result = validateEquationField('eval(adoption)');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/forbidden pattern/i);
  });

  it('accepts every default equation for the fields the engine executes', () => {
    for (const field of EDITABLE_EQUATION_FIELDS) {
      const result = validateEquationField(DEFAULT_EQUATIONS[field]);
      expect(result.valid, `expected default ${field} to validate: ${result.error}`).toBe(true);
    }
  });
});

describe('validateAllEquationFields / allFieldsValid', () => {
  it('reports all-valid for the full default equation set', () => {
    const map = validateAllEquationFields(DEFAULT_EQUATIONS);
    expect(Object.keys(map)).toHaveLength(EDITABLE_EQUATION_FIELDS.length);
    expect(allFieldsValid(map)).toBe(true);
  });

  it('reports not-all-valid when one field is broken', () => {
    const broken: EquationSet = { ...DEFAULT_EQUATIONS, wellbeingDelta: 'notAllowedVar * 2' };
    const map = validateAllEquationFields(broken);
    expect(map.wellbeingDelta?.valid).toBe(false);
    expect(allFieldsValid(map)).toBe(false);
  });

  it('allFieldsValid is false for an empty map', () => {
    expect(allFieldsValid({})).toBe(false);
  });
});

describe('initEquationsForEditor', () => {
  it('returns the full default equation set when creating a new model (null config)', () => {
    expect(initEquationsForEditor(null)).toEqual(DEFAULT_EQUATIONS);
  });

  it("returns a model's own equations when editing an existing config", () => {
    const custom: ModelConfig = {
      ...DEFAULT_MODEL_CONFIG,
      equations: { ...DEFAULT_EQUATIONS, wellbeingDelta: 'ubiBoost * 0.9' }
    };
    const result = initEquationsForEditor(custom);
    expect(result.wellbeingDelta).toBe('ubiBoost * 0.9');
  });

  it('fills in defaults for any equation missing from a partial custom config', () => {
    const partial = {
      ...DEFAULT_MODEL_CONFIG,
      equations: { ...DEFAULT_EQUATIONS, giniDamping: undefined } as unknown as EquationSet
    };
    const result = initEquationsForEditor(partial);
    expect(result.giniDamping).toBe(DEFAULT_EQUATIONS.giniDamping);
  });
});

describe('resetFieldToDefault', () => {
  it('returns the exact default string for each editable field', () => {
    for (const field of EDITABLE_EQUATION_FIELDS) {
      expect(resetFieldToDefault(field)).toBe(DEFAULT_EQUATIONS[field]);
    }
  });
});

describe('buildModelConfigFromEditor', () => {
  it('mints a new id and metadata when creating a model from scratch (existing: null)', () => {
    const config = buildModelConfigFromEditor({
      existing: null,
      name: 'My New Model',
      description: 'desc',
      equations: DEFAULT_EQUATIONS
    });
    expect(config.name).toBe('My New Model');
    expect(config.description).toBe('desc');
    expect(config.id).toMatch(/^custom-/);
    expect(config.metadata.author).toBe('Anonymous');
    expect(config.parameters).toEqual(DEFAULT_MODEL_CONFIG.parameters);
  });

  it('falls back to placeholder name/description when both are blank', () => {
    const config = buildModelConfigFromEditor({
      existing: null,
      name: '   ',
      description: '',
      equations: DEFAULT_EQUATIONS
    });
    expect(config.name).toBe('Unnamed Model');
    expect(config.description).toBe('No description');
  });

  it('preserves id/parameters/metadata when editing an existing config', () => {
    const existing: ModelConfig = {
      ...DEFAULT_MODEL_CONFIG,
      id: 'custom-existing-1',
      metadata: { ...DEFAULT_MODEL_CONFIG.metadata, author: 'Ada' }
    };
    const edited: EquationSet = { ...DEFAULT_EQUATIONS, wellbeingDelta: 'ubiBoost * 0.5' };
    const config = buildModelConfigFromEditor({
      existing,
      name: 'Renamed',
      description: 'New description',
      equations: edited
    });
    expect(config.id).toBe('custom-existing-1');
    expect(config.metadata.author).toBe('Ada');
    expect(config.parameters).toBe(existing.parameters);
    expect(config.name).toBe('Renamed');
    expect(config.equations.wellbeingDelta).toBe('ubiBoost * 0.5');
  });
});

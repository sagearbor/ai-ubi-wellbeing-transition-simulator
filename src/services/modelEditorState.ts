/**
 * Pure editor-state helpers for ModelEditor (P8-T11).
 *
 * Kept React-free and side-effect-free (no DOM) so it can be unit tested directly with
 * vitest's default node environment, matching this repo's existing testing convention
 * (mathParser.test.ts, equationParser.test.ts, anchorTests.test.ts - none use a DOM/RTL
 * harness because the repo doesn't have one).
 */

import { EquationSet, ModelConfig } from '../../types';
import { DEFAULT_EQUATIONS, DEFAULT_MODEL_CONFIG } from '../../constants';
import { parseEquation } from './mathParser';

/**
 * The equations simulation/pure.ts's stepSimulationPure actually evaluates today when a
 * custom model is active (see its `equations?.aiAdoptionGrowth.evaluate(...)` etc. call
 * sites) - editing these is what changes the live trajectory. `demandCollapse`,
 * `reputationChange`, and `giniDamping` are parsed/validated elsewhere but not yet wired
 * into the engine, so they're intentionally not exposed here (see developer_checklist.yaml
 * P8-T9 notes / phase_8 backlog).
 */
export const EDITABLE_EQUATION_FIELDS: (keyof EquationSet)[] = [
  'aiAdoptionGrowth',
  'surplusGeneration',
  'wellbeingDelta',
  'displacementFriction',
  'ubiUtility'
];

export interface EquationFieldValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validate one equation string through the sandboxed mathParser - the SAME parser
 * (services/mathParser.ts::parseEquation) the engine uses to compile equations for
 * simulation, so an equation that validates here is guaranteed to compile there too.
 */
export function validateEquationField(value: string): EquationFieldValidation {
  if (!value || value.trim() === '') {
    return { valid: false, error: 'Equation cannot be empty' };
  }
  const result = parseEquation(value);
  return result.valid ? { valid: true } : { valid: false, error: result.error };
}

export type EquationValidationMap = Partial<Record<keyof EquationSet, EquationFieldValidation>>;

/** Validate every editable field of an equation set at once. */
export function validateAllEquationFields(
  equations: EquationSet,
  fields: (keyof EquationSet)[] = EDITABLE_EQUATION_FIELDS
): EquationValidationMap {
  const map: EquationValidationMap = {};
  for (const field of fields) {
    map[field] = validateEquationField(equations[field] || '');
  }
  return map;
}

/** True only when every field in the validation map is valid. */
export function allFieldsValid(map: EquationValidationMap): boolean {
  const entries = Object.values(map);
  return entries.length > 0 && entries.every(v => v?.valid === true);
}

/**
 * Build the starting EquationSet for the editor: a model's own equations when editing one
 * (falling back to the default for any equation the model doesn't define), or the full
 * default set when creating a new model from scratch.
 */
export function initEquationsForEditor(config: ModelConfig | null): EquationSet {
  const merged: EquationSet = { ...DEFAULT_EQUATIONS };
  const source = config?.equations;
  if (source) {
    for (const key of Object.keys(source) as (keyof EquationSet)[]) {
      const value = source[key];
      if (value !== undefined) {
        (merged as Record<keyof EquationSet, string>)[key] = value;
      }
    }
  }
  return merged;
}

/** The reference-implementation string for one equation field, for the per-field reset button. */
export function resetFieldToDefault(field: keyof EquationSet): string {
  return DEFAULT_EQUATIONS[field] ?? '';
}

export interface BuildConfigArgs {
  existing: ModelConfig | null;
  name: string;
  description: string;
  equations: EquationSet;
}

/**
 * Build the ModelConfig to save/run/export from the editor's current field state.
 * Editing an existing model preserves its id/parameters/metadata; creating a new one
 * mints a fresh id and default parameters, matching the placeholder's prior behavior.
 */
export function buildModelConfigFromEditor({
  existing,
  name,
  description,
  equations
}: BuildConfigArgs): ModelConfig {
  const trimmedName = name.trim() || 'Unnamed Model';
  const trimmedDescription = description.trim() || 'No description';

  if (existing) {
    return {
      ...existing,
      name: trimmedName,
      description: trimmedDescription,
      equations
    };
  }

  return {
    ...DEFAULT_MODEL_CONFIG,
    id: `custom-${Date.now()}`,
    name: trimmedName,
    description: trimmedDescription,
    equations,
    metadata: {
      ...DEFAULT_MODEL_CONFIG.metadata,
      author: 'Anonymous',
      createdAt: new Date().toISOString(),
      version: '1.0.0'
    }
  };
}

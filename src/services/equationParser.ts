/**
 * Equation Parser Service
 * Higher-level API for parsing and compiling equation sets from model configurations
 */

import { EquationSet, ModelConfig } from '../../types';
import {
  validateEquation,
  compileEquation,
  compileEquationDetailed,
  CompiledEquation,
  getAllowedVariables,
  getAllowedFunctions
} from './mathParser';
import { DEFAULT_EQUATIONS } from '../../constants';

/** Result of parsing an entire equation set */
export interface EquationSetParseResult {
  valid: boolean;
  errors: EquationError[];
  warnings: string[];
  compiledEquations?: CompiledEquationSet;
}

/** Individual equation error: which equation, what went wrong, and (when mathjs's
 *  parser gave one) the character position of the syntax error within that equation. */
export interface EquationError {
  equation: keyof EquationSet;
  error: string;
  suggestion?: string;
  position?: number;
}

/** Compiled versions of all equations for fast evaluation */
export interface CompiledEquationSet {
  sourceExpressions?: EquationSet;
  aiAdoptionGrowth: CompiledEquation;
  surplusGeneration: CompiledEquation;
  wellbeingDelta: CompiledEquation;
  displacementFriction: CompiledEquation;
  ubiUtility: CompiledEquation;
  demandCollapse?: CompiledEquation;
  reputationChange?: CompiledEquation;
  giniDamping?: CompiledEquation;
}

/** Required equations that must be present */
const REQUIRED_EQUATIONS: (keyof EquationSet)[] = [
  'aiAdoptionGrowth',
  'surplusGeneration',
  'wellbeingDelta',
  'displacementFriction',
  'ubiUtility'
];

/** Optional equations with defaults */
const OPTIONAL_EQUATIONS: (keyof EquationSet)[] = [
  'demandCollapse',
  'reputationChange',
  'giniDamping'
];

/**
 * Parse and validate an entire equation set from a model config
 */
export function parseEquationSet(equations: EquationSet): EquationSetParseResult {
  const errors: EquationError[] = [];
  const warnings: string[] = [];

  // Check required equations exist
  for (const eq of REQUIRED_EQUATIONS) {
    if (!equations[eq] || equations[eq].trim() === '') {
      errors.push({
        equation: eq,
        error: `Required equation '${eq}' is missing or empty`,
        suggestion: `Use default: ${DEFAULT_EQUATIONS[eq]}`
      });
    }
  }

  // Validate each equation
  const allEquations = [...REQUIRED_EQUATIONS, ...OPTIONAL_EQUATIONS];
  for (const eq of allEquations) {
    const eqStr = equations[eq];
    if (eqStr && eqStr.trim() !== '') {
      const result = validateEquation(eqStr);
      if (!result.valid) {
        errors.push({
          equation: eq,
          error: result.error || 'Unknown validation error'
        });
      }
    }
  }

  // If errors, return early
  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  // Try to compile all equations
  const compiled: Partial<CompiledEquationSet> = {};

  for (const eq of REQUIRED_EQUATIONS) {
    const result = compileEquationDetailed(equations[eq]);
    // NOTE: `=== false` (not `!result.ok`) - this repo's tsconfig doesn't enable `strict`,
    // and without it TS does not narrow a discriminated union on a bare truthiness check.
    if (result.ok === false) {
      errors.push({
        equation: eq,
        error: result.error || `Failed to compile equation '${eq}'`,
        position: result.char
      });
    } else {
      compiled[eq] = result.compiled;
    }
  }

  // Compile optional equations if present
  for (const eq of OPTIONAL_EQUATIONS) {
    const eqStr = equations[eq];
    if (eqStr && eqStr.trim() !== '') {
      const result = compileEquationDetailed(eqStr);
      if (result.ok === false) {
        warnings.push(`Optional equation '${eq}' failed to compile, will use default`);
      } else {
        compiled[eq] = result.compiled;
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  return {
    valid: true,
    errors: [],
    warnings,
    compiledEquations: { ...compiled, sourceExpressions: { ...equations } } as CompiledEquationSet
  };
}

/**
 * Merge custom equations with defaults (for missing optional equations)
 */
export function mergeWithDefaults(equations: Partial<EquationSet>): EquationSet {
  return {
    ...DEFAULT_EQUATIONS,
    ...equations
  };
}

/** Discriminated result of {@link compileEquationSet}. */
export type EquationSetCompileResult =
  | { ok: true; equations: CompiledEquationSet }
  | { ok: false; errors: EquationError[] };

/**
 * Compile an entire equation set, or report why it doesn't compile.
 *
 * A thin wrapper over {@link parseEquationSet} that reshapes its result into a
 * discriminated union so callers can't accidentally treat a failure as success (the
 * mistake {@link getCompiledEquationSet}'s bare `null` invites - see its deprecation
 * notice). Every error in the `ok: false` case carries the equation name, a message,
 * and - when mathjs's parser gave one - the character position of the syntax error.
 */
export function compileEquationSet(equations: EquationSet): EquationSetCompileResult {
  const result = parseEquationSet(equations);
  if (!result.valid || !result.compiledEquations) {
    return { ok: false, errors: result.errors };
  }
  return { ok: true, equations: result.compiledEquations };
}

/**
 * Get a compiled equation set with defaults for any missing equations.
 *
 * @deprecated Collapses every failure reason to `null`. Historically callers wrote
 * `getCompiledEquationSet(x) ?? <fall back to the default engine>`, which silently
 * scores/runs the DEFAULT hardcoded equations under a custom model's name whenever
 * that model fails to compile - the model looks like it ran (or passed anchor tests)
 * when it never actually executed (see docs/design/audit-2026-09-13.md finding A5).
 * Prefer {@link compileEquationSet}, whose `{ ok: false; errors }` case forces callers
 * to handle the failure explicitly instead of silently substituting something else.
 */
export function getCompiledEquationSet(equations: EquationSet): CompiledEquationSet | null {
  const result = parseEquationSet(equations);
  if (!result.valid || !result.compiledEquations) {
    return null;
  }
  return result.compiledEquations;
}

/**
 * Validate a single equation and return detailed analysis
 */
export function analyzeEquationForUI(equation: string, equationName: string): {
  valid: boolean;
  error?: string;
  variables: string[];
  unusedVariables: string[];
  complexity: number;
  suggestion?: string;
} {
  const validation = validateEquation(equation);

  if (!validation.valid) {
    return {
      valid: false,
      error: validation.error,
      variables: [],
      unusedVariables: [],
      complexity: 0
    };
  }

  const compiled = compileEquation(equation);
  if (!compiled) {
    return {
      valid: false,
      error: 'Failed to compile equation',
      variables: [],
      unusedVariables: [],
      complexity: 0
    };
  }

  // Find variables used vs expected for this equation type
  const expectedVariables = getExpectedVariables(equationName);
  const usedVariables = compiled.variables;
  const unusedVariables = expectedVariables.filter(v => !usedVariables.includes(v));

  return {
    valid: true,
    variables: usedVariables,
    unusedVariables,
    complexity: compiled.complexity
  };
}

/**
 * Get expected variables for a given equation type (for suggestions)
 */
function getExpectedVariables(equationName: string): string[] {
  const expectations: Record<string, string[]> = {
    aiAdoptionGrowth: ['aiGrowthRate', 'gdpPerCapita', 'aiAdoptionLevel', 'adoption'],
    surplusGeneration: ['aiRevenue', 'contributionRate'],
    wellbeingDelta: ['ubiBoost', 'displacementFriction'],
    displacementFriction: ['adoption', 'governance', 'gini'],
    ubiUtility: ['ubi', 'utilityScale', 'gdpPerCapita'],
    demandCollapse: ['customerBaseWellbeing', 'wellbeing'],
    reputationChange: ['contributionRate', 'avgContributionRate', 'policyStance'],
    giniDamping: ['gini']
  };
  return expectations[equationName] || [];
}

/**
 * Generate a template equation for a given equation type
 */
export function getEquationTemplate(equationName: keyof EquationSet): string {
  return DEFAULT_EQUATIONS[equationName] || '';
}

/**
 * Get documentation for an equation type
 */
export function getEquationDocumentation(equationName: keyof EquationSet): {
  description: string;
  expectedVariables: string[];
  example: string;
} {
  const docs: Record<keyof EquationSet, { description: string; expectedVariables: string[]; example: string }> = {
    aiAdoptionGrowth: {
      description: 'Determines how fast AI adoption spreads in a country. Should approach 0 as adoption nears 100%.',
      expectedVariables: ['aiGrowthRate', 'gdpPerCapita', 'aiAdoptionLevel', 'adoption'],
      example: DEFAULT_EQUATIONS.aiAdoptionGrowth
    },
    surplusGeneration: {
      description: 'How much surplus a corporation generates for UBI distribution.',
      expectedVariables: ['aiRevenue', 'contributionRate'],
      example: DEFAULT_EQUATIONS.surplusGeneration
    },
    wellbeingDelta: {
      description: 'Net change in wellbeing each month. Positive values improve wellbeing.',
      expectedVariables: ['ubiBoost', 'displacementFriction'],
      example: DEFAULT_EQUATIONS.wellbeingDelta
    },
    displacementFriction: {
      description: 'Negative wellbeing impact from job displacement. Peaks at mid-transition.',
      expectedVariables: ['adoption', 'governance', 'gini'],
      example: DEFAULT_EQUATIONS.displacementFriction
    },
    ubiUtility: {
      description: 'Converts UBI dollars to wellbeing utility. Should scale with local costs.',
      expectedVariables: ['ubi', 'utilityScale', 'gdpPerCapita'],
      example: DEFAULT_EQUATIONS.ubiUtility
    },
    demandCollapse: {
      description: 'Projects customer purchasing power collapse (0-1). Used for adaptive policy.',
      expectedVariables: ['customerBaseWellbeing', 'wellbeing'],
      example: DEFAULT_EQUATIONS.demandCollapse || ''
    },
    reputationChange: {
      description: 'How corporation reputation changes based on contribution behavior.',
      expectedVariables: ['contributionRate', 'avgContributionRate'],
      example: DEFAULT_EQUATIONS.reputationChange || ''
    },
    giniDamping: {
      description: 'Reduces UBI effectiveness in high-inequality societies.',
      expectedVariables: ['gini'],
      example: DEFAULT_EQUATIONS.giniDamping || ''
    }
  };

  return docs[equationName] || { description: '', expectedVariables: [], example: '' };
}

// Re-export useful constants
export { getAllowedVariables as ALLOWED_VARIABLES, getAllowedFunctions as ALLOWED_FUNCTIONS };

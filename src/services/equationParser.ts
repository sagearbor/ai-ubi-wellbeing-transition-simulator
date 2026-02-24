/**
 * Equation Parser Service
 * Higher-level API for parsing and compiling equation sets from model configurations
 */

import { EquationSet, ModelConfig } from '../../types';
import {
  validateEquation,
  compileEquation,
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

/** Individual equation error */
export interface EquationError {
  equation: keyof EquationSet;
  error: string;
  suggestion?: string;
}

/** Compiled versions of all equations for fast evaluation */
export interface CompiledEquationSet {
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
    const compiledEq = compileEquation(equations[eq]);
    if (!compiledEq) {
      errors.push({
        equation: eq,
        error: `Failed to compile equation '${eq}'`
      });
    } else {
      compiled[eq] = compiledEq;
    }
  }

  // Compile optional equations if present
  for (const eq of OPTIONAL_EQUATIONS) {
    const eqStr = equations[eq];
    if (eqStr && eqStr.trim() !== '') {
      const compiledEq = compileEquation(eqStr);
      if (!compiledEq) {
        warnings.push(`Optional equation '${eq}' failed to compile, will use default`);
      } else {
        compiled[eq] = compiledEq;
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
    compiledEquations: compiled as CompiledEquationSet
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

/**
 * Get a compiled equation set with defaults for any missing equations
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

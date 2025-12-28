/**
 * Complexity Scoring Service
 * Calculates model complexity for Occam's razor ranking
 * Lower scores = simpler models = higher leaderboard rank
 */

import { ModelConfig, EquationSet } from '../../types';
import { compileEquation } from './mathParser';

/** Detailed complexity breakdown for UI display */
export interface ComplexityBreakdown {
  total: number;                     // Final complexity score

  // Component scores
  parameterScore: number;            // Points from parameter count
  equationLengthScore: number;       // Points from total equation length
  operationScore: number;            // Points from operation count
  nestingScore: number;              // Points from function nesting
  optionalEquationScore: number;     // Points from using optional equations

  // Raw counts
  parameterCount: number;
  totalEquationLength: number;
  totalOperations: number;
  maxNestingDepth: number;
  optionalEquationsUsed: number;
}

/** Scoring weights (from developer_checklist.yaml) */
const WEIGHTS = {
  PARAMETER: 10,           // Each parameter = +10
  EQUATION_LENGTH: 5,      // Each 100 chars = +5
  OPERATION: 1,            // Each operation = +1
  NESTING: 3,              // Each nesting level = +3
  OPTIONAL_EQUATION: 5     // Each optional equation = +5
};

/** Required equations (not penalized) */
const REQUIRED_EQUATIONS: (keyof EquationSet)[] = [
  'aiAdoptionGrowth',
  'surplusGeneration',
  'wellbeingDelta',
  'displacementFriction',
  'ubiUtility'
];

/** Optional equations (penalized for complexity) */
const OPTIONAL_EQUATIONS: (keyof EquationSet)[] = [
  'demandCollapse',
  'reputationChange',
  'giniDamping'
];

/**
 * Count operations in an equation string
 * Operations: +, -, *, /, ^, function calls
 */
function countOperations(equation: string): number {
  let count = 0;

  // Count arithmetic operators
  const operators = equation.match(/[+\-*/^]/g);
  count += operators?.length || 0;

  // Count function calls (word followed by parenthesis)
  const functions = equation.match(/[a-zA-Z]+\s*\(/g);
  count += functions?.length || 0;

  // Count ternary operators
  const ternaries = equation.match(/\?/g);
  count += (ternaries?.length || 0) * 2; // ? and : count as 2 ops

  return count;
}

/**
 * Calculate maximum nesting depth in an equation
 * Counts nested parentheses and function calls
 */
function calculateNestingDepth(equation: string): number {
  let maxDepth = 0;
  let currentDepth = 0;

  for (const char of equation) {
    if (char === '(') {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    } else if (char === ')') {
      currentDepth--;
    }
  }

  return maxDepth;
}

/**
 * Calculate detailed complexity breakdown for a model
 */
export function calculateComplexityBreakdown(config: ModelConfig): ComplexityBreakdown {
  // Parameter score
  const parameterCount = config.parameters.length;
  const parameterScore = parameterCount * WEIGHTS.PARAMETER;

  // Equation analysis
  let totalEquationLength = 0;
  let totalOperations = 0;
  let maxNestingDepth = 0;
  let optionalEquationsUsed = 0;

  // Process all equations
  const allEquationKeys = [...REQUIRED_EQUATIONS, ...OPTIONAL_EQUATIONS] as (keyof EquationSet)[];

  for (const key of allEquationKeys) {
    const equation = config.equations[key];
    if (!equation || equation.trim() === '') continue;

    // Check if optional equation is used
    if (OPTIONAL_EQUATIONS.includes(key)) {
      optionalEquationsUsed++;
    }

    // Length
    totalEquationLength += equation.length;

    // Operations - use compiled complexity if available, fallback to string counting
    const compiled = compileEquation(equation);
    if (compiled) {
      totalOperations += compiled.complexity;
    } else {
      // Fallback to string-based counting if compilation fails
      totalOperations += countOperations(equation);
    }

    // Nesting
    const depth = calculateNestingDepth(equation);
    maxNestingDepth = Math.max(maxNestingDepth, depth);
  }

  // Calculate component scores
  const equationLengthScore = Math.floor(totalEquationLength / 100) * WEIGHTS.EQUATION_LENGTH;
  const operationScore = totalOperations * WEIGHTS.OPERATION;
  const nestingScore = maxNestingDepth * WEIGHTS.NESTING;
  const optionalEquationScore = optionalEquationsUsed * WEIGHTS.OPTIONAL_EQUATION;

  // Total
  const total = parameterScore + equationLengthScore + operationScore +
                nestingScore + optionalEquationScore;

  return {
    total,
    parameterScore,
    equationLengthScore,
    operationScore,
    nestingScore,
    optionalEquationScore,
    parameterCount,
    totalEquationLength,
    totalOperations,
    maxNestingDepth,
    optionalEquationsUsed
  };
}

/**
 * Calculate simple complexity score (for quick ranking)
 */
export function calculateComplexity(config: ModelConfig): number {
  return calculateComplexityBreakdown(config).total;
}

/**
 * Get complexity tier label
 */
export function getComplexityTier(score: number): {
  tier: 'minimal' | 'simple' | 'moderate' | 'complex' | 'very-complex';
  label: string;
  color: string;
} {
  if (score < 30) {
    return { tier: 'minimal', label: 'Minimal', color: 'text-green-400' };
  } else if (score < 60) {
    return { tier: 'simple', label: 'Simple', color: 'text-green-300' };
  } else if (score < 100) {
    return { tier: 'moderate', label: 'Moderate', color: 'text-yellow-400' };
  } else if (score < 150) {
    return { tier: 'complex', label: 'Complex', color: 'text-orange-400' };
  } else {
    return { tier: 'very-complex', label: 'Very Complex', color: 'text-red-400' };
  }
}

/**
 * Compare two models by complexity (for sorting)
 * Returns negative if a is simpler, positive if b is simpler
 */
export function compareComplexity(a: ModelConfig, b: ModelConfig): number {
  return calculateComplexity(a) - calculateComplexity(b);
}

/**
 * Format complexity for display
 */
export function formatComplexity(score: number): string {
  const tier = getComplexityTier(score);
  return `${score} (${tier.label})`;
}

/**
 * Get improvement suggestions to reduce complexity
 */
export function getSimplificationSuggestions(breakdown: ComplexityBreakdown): string[] {
  const suggestions: string[] = [];

  if (breakdown.parameterCount > 6) {
    suggestions.push(`Consider reducing parameters (${breakdown.parameterCount} → 6 or fewer)`);
  }

  if (breakdown.optionalEquationsUsed > 0) {
    suggestions.push(`Remove optional equations if not needed (using ${breakdown.optionalEquationsUsed})`);
  }

  if (breakdown.maxNestingDepth > 3) {
    suggestions.push(`Simplify deeply nested expressions (depth ${breakdown.maxNestingDepth})`);
  }

  if (breakdown.totalOperations > 30) {
    suggestions.push(`Reduce operation count (${breakdown.totalOperations} operations)`);
  }

  if (breakdown.totalEquationLength > 500) {
    suggestions.push(`Shorten equations (${breakdown.totalEquationLength} chars total)`);
  }

  return suggestions;
}

/**
 * Model Validation Service
 * Validates user-uploaded model configurations against schema and semantic rules
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { ModelConfig, ModelValidationResult, ValidationFailure, EquationSet } from '../../types';
import { validateEquation, compileEquation } from './mathParser';
import { calculateComplexity } from './complexityScorer';
import modelConfigSchema from '../../schemas/modelConfig.schema.json';

// Initialize AJV with formats (for date-time validation)
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Compile the schema once
const validateSchema = ajv.compile(modelConfigSchema);

/**
 * Tier 1 Sanity Checks - Must ALL pass
 * - JSON Schema validation
 * - All equations parse correctly
 * - Parameters have valid min/max/default ranges
 * - No forbidden patterns in equations
 */
export function validateTier1(config: ModelConfig): ValidationFailure[] {
  const failures: ValidationFailure[] = [];

  // 1. JSON Schema validation
  const schemaValid = validateSchema(config);
  if (!schemaValid && validateSchema.errors) {
    for (const error of validateSchema.errors) {
      failures.push({
        testId: 'T1-SCHEMA',
        testName: 'JSON Schema Validation',
        category: 'sanity',
        reason: `${error.instancePath} ${error.message}`,
        expected: 'Valid schema',
        actual: JSON.stringify(error.params)
      });
    }
  }

  // 2. Validate all equations parse
  const requiredEquations: (keyof EquationSet)[] = [
    'aiAdoptionGrowth', 'surplusGeneration', 'wellbeingDelta',
    'displacementFriction', 'ubiUtility'
  ];

  for (const eqName of requiredEquations) {
    const eq = config.equations[eqName];
    if (!eq) {
      failures.push({
        testId: 'T1-EQ-MISSING',
        testName: 'Required Equation Missing',
        category: 'sanity',
        reason: `Required equation '${eqName}' is missing`,
        expected: 'Equation string',
        actual: 'undefined'
      });
      continue;
    }

    const result = validateEquation(eq);
    if (!result.valid) {
      failures.push({
        testId: 'T1-EQ-PARSE',
        testName: 'Equation Parse Error',
        category: 'sanity',
        reason: `Equation '${eqName}' failed to parse: ${result.error}`,
        expected: 'Valid equation',
        actual: eq
      });
    }
  }

  // Also validate optional equations if present
  const optionalEquations: (keyof EquationSet)[] = ['demandCollapse', 'reputationChange', 'giniDamping'];
  for (const eqName of optionalEquations) {
    const eq = config.equations[eqName];
    if (eq && eq.trim() !== '') {
      const result = validateEquation(eq);
      if (!result.valid) {
        failures.push({
          testId: 'T1-EQ-PARSE-OPT',
          testName: 'Optional Equation Parse Error',
          category: 'sanity',
          reason: `Optional equation '${eqName}' failed to parse: ${result.error}`,
          expected: 'Valid equation or empty',
          actual: eq
        });
      }
    }
  }

  // 3. Validate parameter ranges
  for (const param of config.parameters) {
    if (param.min >= param.max) {
      failures.push({
        testId: 'T1-PARAM-RANGE',
        testName: 'Parameter Range Invalid',
        category: 'sanity',
        reason: `Parameter '${param.name}' has min >= max`,
        expected: 'min < max',
        actual: `min=${param.min}, max=${param.max}`
      });
    }

    if (param.default < param.min || param.default > param.max) {
      failures.push({
        testId: 'T1-PARAM-DEFAULT',
        testName: 'Parameter Default Out of Range',
        category: 'sanity',
        reason: `Parameter '${param.name}' default is outside min/max range`,
        expected: `${param.min} <= default <= ${param.max}`,
        actual: `default=${param.default}`
      });
    }
  }

  // 4. Check metadata requirements
  if (config.metadata.overridesStandardCausality && !config.metadata.justification) {
    failures.push({
      testId: 'T1-META-JUSTIFY',
      testName: 'Missing Justification',
      category: 'sanity',
      reason: 'Model overrides standard causality but no justification provided',
      expected: 'justification string',
      actual: 'undefined'
    });
  }

  return failures;
}

/**
 * Calculate model complexity score (lower is better - Occam's razor)
 * Note: Delegates to complexityScorer.ts for detailed analysis
 */
export { calculateComplexity };

/**
 * Full validation including Tier 1 checks
 * Note: Tier 2 (anchor tests) are run separately by the test runner
 */
export function validateModelConfig(config: ModelConfig): ModelValidationResult {
  const tier1Failures = validateTier1(config);
  const tier1Passed = tier1Failures.length === 0;

  const warnings: string[] = [];

  // Add warnings for potential issues (not failures)
  if (config.parameters.length > 10) {
    warnings.push('High parameter count may make model difficult to tune');
  }

  const complexity = calculateComplexity(config);
  if (complexity > 200) {
    warnings.push(`High complexity score (${complexity}) - simpler models rank higher`);
  }

  // Check for unusual coefficient values
  const wellbeingEq = config.equations.wellbeingDelta;
  if (wellbeingEq && !wellbeingEq.includes('0.')) {
    warnings.push('wellbeingDelta equation may be missing coefficient scaling (e.g., * 0.20)');
  }

  return {
    valid: tier1Passed,
    tier1Passed,
    tier2Score: 0,  // Set by anchor test runner
    tier2Total: 6,  // 6 anchor tests
    failures: tier1Failures,
    warnings,
    complexity
  };
}

/**
 * Quick validation check (for real-time feedback in editor)
 */
export function quickValidate(config: Partial<ModelConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.name || config.name.length < 3) {
    errors.push('Name must be at least 3 characters');
  }

  if (!config.id || !/^[a-z0-9-]+$/.test(config.id)) {
    errors.push('ID must be lowercase alphanumeric with hyphens');
  }

  if (config.equations) {
    const requiredEqs = ['aiAdoptionGrowth', 'surplusGeneration', 'wellbeingDelta',
                         'displacementFriction', 'ubiUtility'];
    for (const eq of requiredEqs) {
      if (!config.equations[eq as keyof EquationSet]) {
        errors.push(`Missing required equation: ${eq}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate a single equation string (for editor)
 */
export function validateSingleEquation(equation: string): {
  valid: boolean;
  error?: string;
  canCompile: boolean;
} {
  const result = validateEquation(equation);

  if (!result.valid) {
    return { valid: false, error: result.error, canCompile: false };
  }

  const compiled = compileEquation(equation);
  return {
    valid: true,
    canCompile: compiled !== null
  };
}

/**
 * Get validation summary as human-readable string
 */
export function getValidationSummary(result: ModelValidationResult): string {
  if (result.valid) {
    return `✅ Model valid (complexity: ${result.complexity})`;
  }

  const failureCount = result.failures.length;
  const warningCount = result.warnings.length;

  return `❌ ${failureCount} error${failureCount !== 1 ? 's' : ''}, ${warningCount} warning${warningCount !== 1 ? 's' : ''}`;
}

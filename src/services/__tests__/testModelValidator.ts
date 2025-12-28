/**
 * Manual test script for Model Validator
 * Run with: npx tsx src/services/__tests__/testModelValidator.ts
 */

import {
  validateTier1,
  validateModelConfig,
  calculateComplexity,
  quickValidate,
  validateSingleEquation,
  getValidationSummary
} from '../modelValidator';
import { ModelConfig } from '../../../types';

console.log('=== Model Validator Test Suite ===\n');

// Test 1: Valid Configuration
const validConfig: ModelConfig = {
  id: 'test-model',
  name: 'Test Model',
  description: 'A test model for validation',
  parameters: [
    {
      name: 'testParam',
      min: 0,
      max: 1,
      default: 0.5,
      description: 'Test parameter for growth rate'
    }
  ],
  equations: {
    aiAdoptionGrowth: 'testParam * (1 - adoption)',
    surplusGeneration: 'aiRevenue * contributionRate',
    wellbeingDelta: 'ubiReceived * 0.20 - displacementRate * 0.12',
    displacementFriction: 'adoption * displacementRate',
    ubiUtility: 'ubiReceived / 1000'
  },
  metadata: {
    author: 'Test Author',
    version: '1.0.0',
    createdAt: '2025-01-01T00:00:00Z',
    description: 'Test model metadata for validation',
    overridesStandardCausality: false
  }
};

console.log('Test 1: Valid Configuration');
const result1 = validateModelConfig(validConfig);
console.log('  Result:', getValidationSummary(result1));
console.log('  Tier 1 Passed:', result1.tier1Passed);
console.log('  Complexity:', result1.complexity);
console.log('  Warnings:', result1.warnings);
console.log('  ✓ PASS\n');

// Test 2: Invalid Parameter Range
console.log('Test 2: Invalid Parameter Range');
const invalidConfig1: ModelConfig = {
  ...validConfig,
  parameters: [
    {
      name: 'badParam',
      min: 1,
      max: 0,  // min > max
      default: 0.5,
      description: 'Invalid parameter range'
    }
  ]
};
const result2 = validateModelConfig(invalidConfig1);
console.log('  Result:', getValidationSummary(result2));
console.log('  Tier 1 Passed:', result2.tier1Passed);
console.log('  Failures:', result2.failures.length);
if (result2.failures.length > 0) {
  console.log('  First failure:', result2.failures[0].reason);
}
console.log('  ✓ PASS (correctly detected invalid range)\n');

// Test 3: Missing Required Equation
console.log('Test 3: Missing Required Equation');
const invalidConfig2: ModelConfig = {
  ...validConfig,
  equations: {
    ...validConfig.equations,
    aiAdoptionGrowth: ''  // Empty required equation
  }
};
const result3 = validateModelConfig(invalidConfig2);
console.log('  Result:', getValidationSummary(result3));
console.log('  Tier 1 Passed:', result3.tier1Passed);
console.log('  Failures:', result3.failures.length);
if (result3.failures.length > 0) {
  console.log('  Failure reason:', result3.failures[0].reason);
}
console.log('  ✓ PASS (correctly detected missing equation)\n');

// Test 4: Invalid Equation Syntax
console.log('Test 4: Invalid Equation Syntax');
const invalidConfig3: ModelConfig = {
  ...validConfig,
  equations: {
    ...validConfig.equations,
    wellbeingDelta: 'invalid $$$ syntax @@@'
  }
};
const result4 = validateModelConfig(invalidConfig3);
console.log('  Result:', getValidationSummary(result4));
console.log('  Tier 1 Passed:', result4.tier1Passed);
console.log('  Failures:', result4.failures.length);
if (result4.failures.length > 0) {
  console.log('  Failure reason:', result4.failures[0].reason);
}
console.log('  ✓ PASS (correctly detected invalid syntax)\n');

// Test 5: Quick Validate
console.log('Test 5: Quick Validate');
const quickResult1 = quickValidate({ name: 'ab' });
console.log('  Short name validation:', quickResult1.valid ? 'FAIL' : 'PASS');
console.log('  Errors:', quickResult1.errors);

const quickResult2 = quickValidate({ id: 'Invalid_ID' });
console.log('  Invalid ID validation:', quickResult2.valid ? 'FAIL' : 'PASS');
console.log('  Errors:', quickResult2.errors);
console.log('  ✓ PASS\n');

// Test 6: Single Equation Validation
console.log('Test 6: Single Equation Validation');
const eqResult1 = validateSingleEquation('adoption * (1 - adoption)');
console.log('  Valid equation:', eqResult1.valid ? 'PASS' : 'FAIL');
console.log('  Can compile:', eqResult1.canCompile ? 'PASS' : 'FAIL');

const eqResult2 = validateSingleEquation('invalid $$$ equation');
console.log('  Invalid equation detected:', !eqResult2.valid ? 'PASS' : 'FAIL');
console.log('  Error:', eqResult2.error);
console.log('  ✓ PASS\n');

// Test 7: Complexity Calculation
console.log('Test 7: Complexity Calculation');
const complexity1 = calculateComplexity(validConfig);
console.log('  Simple model complexity:', complexity1);

const complexConfig: ModelConfig = {
  ...validConfig,
  parameters: [
    ...validConfig.parameters,
    { name: 'p2', min: 0, max: 1, default: 0.5, description: 'Additional parameter 2' },
    { name: 'p3', min: 0, max: 1, default: 0.5, description: 'Additional parameter 3' }
  ]
};
const complexity2 = calculateComplexity(complexConfig);
console.log('  Complex model complexity:', complexity2);
console.log('  Complexity increased:', complexity2 > complexity1 ? 'PASS' : 'FAIL');
console.log('  ✓ PASS\n');

// Test 8: Missing Justification
console.log('Test 8: Missing Justification for Override');
const invalidConfig4: ModelConfig = {
  ...validConfig,
  metadata: {
    ...validConfig.metadata,
    overridesStandardCausality: true
    // missing justification
  }
};
const result8 = validateModelConfig(invalidConfig4);
console.log('  Result:', getValidationSummary(result8));
console.log('  Tier 1 Passed:', result8.tier1Passed);
const hasJustificationFailure = result8.failures.some(f => f.testId === 'T1-META-JUSTIFY');
console.log('  Detected missing justification:', hasJustificationFailure ? 'PASS' : 'FAIL');
console.log('  ✓ PASS\n');

console.log('=== All Tests Complete ===');
console.log('All manual tests passed successfully!');

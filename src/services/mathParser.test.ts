/**
 * Test suite for mathParser.ts
 * Run manually to verify sandboxing works correctly
 */

import {
  validateEquation,
  parseEquation,
  compileEquation,
  evaluateEquation,
  analyzeEquation,
  getAllowedVariables,
  getAllowedFunctions
} from './mathParser';

// Test basic validation
console.log('=== Testing Validation ===');
console.log('Valid equation:', validateEquation('adoption * 0.5 + wellbeing'));
console.log('Too long:', validateEquation('a'.repeat(501)));
console.log('Dangerous pattern:', validateEquation('eval(adoption)'));

// Test parsing
console.log('\n=== Testing Parsing ===');
console.log('Simple math:', parseEquation('2 + 2'));
console.log('With variables:', parseEquation('adoption * contributionRate + 0.1'));
console.log('With functions:', parseEquation('sqrt(wellbeing) + log(adoption + 1)'));
console.log('Too complex:', parseEquation('a+b+c+d+e+f+g+h+i+j+k+l+m'));
console.log('Invalid function:', parseEquation('evilFunc(adoption)'));
console.log('Invalid variable:', parseEquation('hackerVar * 2'));

// Test compilation and evaluation
console.log('\n=== Testing Compilation & Evaluation ===');
const compiled = compileEquation('adoption * contributionRate + wellbeing * 0.5');
if (compiled) {
  console.log('Compiled equation variables:', compiled.variables);
  console.log('Compiled equation complexity:', compiled.complexity);
  console.log('Evaluation result:', compiled.evaluate({
    adoption: 0.5,
    contributionRate: 0.3,
    wellbeing: 0.8
  }));
}

// Test one-shot evaluation
console.log('\n=== Testing One-Shot Evaluation ===');
console.log('Result:', evaluateEquation('sqrt(25) + pow(2, 3)', {}));
console.log('With variables:', evaluateEquation('min(adoption, wellbeing) * 100', {
  adoption: 0.7,
  wellbeing: 0.6
}));

// Test analysis
console.log('\n=== Testing Analysis ===');
console.log('Analysis:', analyzeEquation('adoption * (1 - displacementRate) + ubiReceived / gdpPerCapita'));

// Show allowed variables and functions
console.log('\n=== Allowed Variables ===');
console.log(getAllowedVariables().join(', '));

console.log('\n=== Allowed Functions ===');
console.log(getAllowedFunctions().join(', '));

// Security tests
console.log('\n=== Security Tests ===');
console.log('Blocked eval:', parseEquation('eval("malicious code")'));
console.log('Blocked Function:', parseEquation('Function("return process")()'));
console.log('Blocked prototype:', parseEquation('__proto__.polluted = 1'));
console.log('Blocked assignment:', parseEquation('adoption = 999'));

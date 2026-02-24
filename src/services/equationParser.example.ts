/**
 * Example usage of equationParser service
 * This file demonstrates how to use the equation parser API
 */

import {
  parseEquationSet,
  mergeWithDefaults,
  getCompiledEquationSet,
  analyzeEquationForUI,
  getEquationTemplate,
  getEquationDocumentation,
  ALLOWED_VARIABLES,
  ALLOWED_FUNCTIONS
} from './equationParser';
import { EquationSet } from '../../types';
import { DEFAULT_EQUATIONS } from '../../constants';

// Example 1: Parse and validate a complete equation set
function example1_ValidateEquationSet() {
  const customEquations: EquationSet = {
    aiAdoptionGrowth: 'aiGrowthRate * adoption * (1 - adoption)',
    surplusGeneration: 'aiRevenue * contributionRate * 0.5',
    wellbeingDelta: 'ubiBoost - displacementFriction',
    displacementFriction: 'adoption * gini * governance',
    ubiUtility: 'ubi / (gdpPerCapita + 1000)'
  };

  const result = parseEquationSet(customEquations);

  if (result.valid && result.compiledEquations) {
    console.log('Equation set is valid!');
    console.log('Compiled equations:', Object.keys(result.compiledEquations));

    // Use compiled equations for fast evaluation
    const adoptionGrowth = result.compiledEquations.aiAdoptionGrowth.evaluate({
      aiGrowthRate: 0.08,
      adoption: 0.3
    });
    console.log('AI Adoption Growth:', adoptionGrowth);
  } else {
    console.error('Validation errors:', result.errors);
    console.warn('Warnings:', result.warnings);
  }
}

// Example 2: Merge custom equations with defaults
function example2_MergeWithDefaults() {
  const partialCustom: Partial<EquationSet> = {
    // Override just one equation
    aiAdoptionGrowth: 'aiGrowthRate * 2 * adoption'
  };

  // Merge with defaults to get complete equation set
  const complete = mergeWithDefaults(partialCustom);

  console.log('Custom aiAdoptionGrowth:', complete.aiAdoptionGrowth);
  console.log('Default surplusGeneration:', complete.surplusGeneration);
}

// Example 3: Get compiled equation set (with automatic defaults)
function example3_GetCompiled() {
  const compiled = getCompiledEquationSet(DEFAULT_EQUATIONS);

  if (compiled) {
    // Evaluate wellbeing delta
    const delta = compiled.wellbeingDelta.evaluate({
      ubiBoost: 10,
      displacementFriction: 5
    });
    console.log('Wellbeing delta:', delta);
  }
}

// Example 4: Analyze equation for UI display
function example4_AnalyzeForUI() {
  const userInput = 'adoption * gini * governance';

  const analysis = analyzeEquationForUI(userInput, 'displacementFriction');

  if (analysis.valid) {
    console.log('Equation is valid');
    console.log('Variables used:', analysis.variables);
    console.log('Expected but unused:', analysis.unusedVariables);
    console.log('Complexity:', analysis.complexity);
  } else {
    console.error('Invalid equation:', analysis.error);
  }
}

// Example 5: Get template and documentation
function example5_GetTemplateAndDocs() {
  // Get a template to start with
  const template = getEquationTemplate('aiAdoptionGrowth');
  console.log('Template:', template);

  // Get documentation to understand what the equation should do
  const docs = getEquationDocumentation('aiAdoptionGrowth');
  console.log('Description:', docs.description);
  console.log('Expected variables:', docs.expectedVariables);
  console.log('Example:', docs.example);
}

// Example 6: Get allowed variables and functions
function example6_GetAllowed() {
  const allowedVars = ALLOWED_VARIABLES();
  const allowedFuncs = ALLOWED_FUNCTIONS();

  console.log('Allowed variables:', allowedVars.slice(0, 5), '...');
  console.log('Allowed functions:', allowedFuncs.slice(0, 5), '...');
}

// Example 7: Error handling
function example7_ErrorHandling() {
  const invalidEquations: EquationSet = {
    aiAdoptionGrowth: 'this is not a valid equation',
    surplusGeneration: 'aiRevenue * contributionRate',
    wellbeingDelta: '',  // Missing!
    displacementFriction: 'adoption * gini',
    ubiUtility: 'ubi / gdpPerCapita'
  };

  const result = parseEquationSet(invalidEquations);

  // Display errors with suggestions
  for (const error of result.errors) {
    console.error(`Error in ${error.equation}:`, error.error);
    if (error.suggestion) {
      console.log('Suggestion:', error.suggestion);
    }
  }

  // Display warnings
  for (const warning of result.warnings) {
    console.warn('Warning:', warning);
  }
}

// Export examples for documentation
export {
  example1_ValidateEquationSet,
  example2_MergeWithDefaults,
  example3_GetCompiled,
  example4_AnalyzeForUI,
  example5_GetTemplateAndDocs,
  example6_GetAllowed,
  example7_ErrorHandling
};

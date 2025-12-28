/**
 * Complexity Scorer Demonstration
 * Run with: npx tsx scripts/demo-complexity-scorer.ts
 */

import {
  calculateComplexity,
  calculateComplexityBreakdown,
  getComplexityTier,
  formatComplexity,
  getSimplificationSuggestions
} from '../src/services/complexityScorer';
import { ModelConfig } from '../types';

// Example 1: Minimal Model
const minimalModel: ModelConfig = {
  id: 'minimal-model',
  name: 'Minimal Economic Model',
  description: 'A very simple model with few parameters',
  parameters: [
    { name: 'growthRate', min: 0, max: 0.2, default: 0.05, description: 'AI growth rate' },
    { name: 'displacement', min: 0.5, max: 0.9, default: 0.7, description: 'Labor displacement' }
  ],
  equations: {
    aiAdoptionGrowth: 'growthRate * (1 - adoption)',
    surplusGeneration: 'aiRevenue * 0.3',
    wellbeingDelta: 'ubiReceived * 0.2',
    displacementFriction: 'adoption * displacement',
    ubiUtility: 'ubiReceived / 1000'
  },
  metadata: {
    author: 'Demo',
    version: '1.0.0',
    createdAt: '2025-01-01',
    description: 'Minimal model for testing',
    overridesStandardCausality: false
  }
};

// Example 2: Complex Model
const complexModel: ModelConfig = {
  id: 'complex-model',
  name: 'Advanced Economic Model',
  description: 'A complex model with many parameters and optional equations',
  parameters: [
    { name: 'growthRate', min: 0, max: 0.2, default: 0.05, description: 'AI growth rate' },
    { name: 'displacement', min: 0.5, max: 0.9, default: 0.7, description: 'Labor displacement' },
    { name: 'damping', min: 0, max: 1, default: 0.5, description: 'Damping factor' },
    { name: 'threshold', min: 0, max: 100, default: 50, description: 'Threshold value' },
    { name: 'sensitivity', min: 0, max: 2, default: 1, description: 'Sensitivity param' },
    { name: 'lag', min: 1, max: 12, default: 3, description: 'Time lag months' },
    { name: 'coupling', min: 0, max: 1, default: 0.3, description: 'Coupling strength' },
    { name: 'volatility', min: 0, max: 0.5, default: 0.1, description: 'Market volatility' }
  ],
  equations: {
    aiAdoptionGrowth: 'growthRate * (1 - adoption) * (1 + sin(month / 12 * 3.14159)) * exp(-damping * adoption)',
    surplusGeneration: 'aiRevenue * contributionRate * (1 + governance) * sqrt(marketCap / 1000)',
    wellbeingDelta: '(ubiReceived * 0.2 - displacementFriction * 0.5) * (1 + log(gdpPerCapita + 1) / 10)',
    displacementFriction: 'sin(adoption * 3.14159 / 2) * displacement * (1 - governance) * sensitivity',
    ubiUtility: 'log(ubiReceived + 1) / log(gdpPerCapita + 1) * 100 * (1 - gini * damping)',
    demandCollapse: 'max(0, threshold - wellbeing) * coupling * volatility',
    reputationChange: '(contributionRate - 0.2) * 50 * (1 + customerBaseWellbeing / 100)',
    giniDamping: 'pow(gini, 2) * damping * sensitivity'
  },
  metadata: {
    author: 'Demo',
    version: '1.0.0',
    createdAt: '2025-01-01',
    description: 'Complex model for testing',
    overridesStandardCausality: false
  }
};

// Example 3: Moderate Model
const moderateModel: ModelConfig = {
  id: 'moderate-model',
  name: 'Moderate Economic Model',
  description: 'A balanced model with moderate complexity',
  parameters: [
    { name: 'growthRate', min: 0, max: 0.2, default: 0.05, description: 'AI growth rate' },
    { name: 'displacement', min: 0.5, max: 0.9, default: 0.7, description: 'Labor displacement' },
    { name: 'ubiScale', min: 500, max: 2000, default: 1000, description: 'UBI scale factor' },
    { name: 'dampingFactor', min: 0, max: 1, default: 0.3, description: 'Damping factor' }
  ],
  equations: {
    aiAdoptionGrowth: 'growthRate * (1 - adoption) * (1 + gdpPerCapita / 100000)',
    surplusGeneration: 'aiRevenue * contributionRate * (1 + governance * 0.2)',
    wellbeingDelta: 'ubiReceived * 0.2 - displacementFriction * 0.15',
    displacementFriction: 'sin(adoption * 3.14159 / 2) * displacement',
    ubiUtility: 'log(ubiReceived + 1) / log(ubiScale) * 100',
    demandCollapse: 'max(0, 50 - wellbeing) * 0.5'
  },
  metadata: {
    author: 'Demo',
    version: '1.0.0',
    createdAt: '2025-01-01',
    description: 'Moderate model for testing',
    overridesStandardCausality: false
  }
};

console.log('='.repeat(80));
console.log('COMPLEXITY SCORER DEMONSTRATION');
console.log('='.repeat(80));
console.log();

const models = [
  { name: 'MINIMAL MODEL', model: minimalModel },
  { name: 'MODERATE MODEL', model: moderateModel },
  { name: 'COMPLEX MODEL', model: complexModel }
];

for (const { name, model } of models) {
  console.log(`\n${name}`);
  console.log('-'.repeat(80));

  // Simple complexity score
  const score = calculateComplexity(model);
  console.log(`\nTotal Complexity Score: ${formatComplexity(score)}`);

  const tier = getComplexityTier(score);
  console.log(`Tier: ${tier.label} (${tier.tier})`);

  // Detailed breakdown
  const breakdown = calculateComplexityBreakdown(model);
  console.log('\nDetailed Breakdown:');
  console.log(`  Parameters:        ${breakdown.parameterCount} params × 10 = ${breakdown.parameterScore} pts`);
  console.log(`  Equation Length:   ${breakdown.totalEquationLength} chars ÷ 100 × 5 = ${breakdown.equationLengthScore} pts`);
  console.log(`  Operations:        ${breakdown.totalOperations} ops × 1 = ${breakdown.operationScore} pts`);
  console.log(`  Max Nesting:       ${breakdown.maxNestingDepth} levels × 3 = ${breakdown.nestingScore} pts`);
  console.log(`  Optional Eqs:      ${breakdown.optionalEquationsUsed} eqs × 5 = ${breakdown.optionalEquationScore} pts`);
  console.log(`                     ${'='.repeat(40)}`);
  console.log(`  TOTAL:             ${breakdown.total} pts`);

  // Simplification suggestions
  const suggestions = getSimplificationSuggestions(breakdown);
  if (suggestions.length > 0) {
    console.log('\nSimplification Suggestions:');
    suggestions.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s}`);
    });
  } else {
    console.log('\nNo simplification suggestions - model is already simple!');
  }
}

// Ranking demonstration
console.log('\n' + '='.repeat(80));
console.log('LEADERBOARD RANKING (Occam\'s Razor - Simpler is Better)');
console.log('='.repeat(80));

const sorted = [...models].sort((a, b) =>
  calculateComplexity(a.model) - calculateComplexity(b.model)
);

sorted.forEach((item, index) => {
  const score = calculateComplexity(item.model);
  const tier = getComplexityTier(score);
  console.log(`${index + 1}. ${item.name.padEnd(20)} - Score: ${score.toString().padStart(4)} (${tier.label})`);
});

console.log('\n' + '='.repeat(80));
console.log('END OF DEMONSTRATION');
console.log('='.repeat(80));

# Complexity Scoring System

## Overview

The complexity scoring service implements Occam's razor ranking for economic models. Lower scores indicate simpler models, which rank higher on the leaderboard.

## Service Location

**File:** `/home/scb2/PROJECTS/gitRepos-wsl/ai-ubi-wellbeing-transition-simulator/src/services/complexityScorer.ts`

## Scoring Formula

Total Complexity = Parameter Score + Equation Length Score + Operation Score + Nesting Score + Optional Equation Score

### Scoring Weights

| Component | Weight | Description |
|-----------|--------|-------------|
| Parameters | 10 pts each | Each parameter in the model |
| Equation Length | 5 pts per 100 chars | Total length of all equations |
| Operations | 1 pt each | Arithmetic operators, function calls, ternaries |
| Nesting Depth | 3 pts per level | Maximum parenthesis nesting depth |
| Optional Equations | 5 pts each | demandCollapse, reputationChange, giniDamping |

### Required vs Optional Equations

**Required Equations (no penalty):**
- `aiAdoptionGrowth`
- `surplusGeneration`
- `wellbeingDelta`
- `displacementFriction`
- `ubiUtility`

**Optional Equations (5 pts penalty each):**
- `demandCollapse`
- `reputationChange`
- `giniDamping`

## Complexity Tiers

| Score Range | Tier | Label | Color |
|-------------|------|-------|-------|
| < 30 | minimal | Minimal | Green (400) |
| 30-59 | simple | Simple | Green (300) |
| 60-99 | moderate | Moderate | Yellow (400) |
| 100-149 | complex | Complex | Orange (400) |
| 150+ | very-complex | Very Complex | Red (400) |

## API Reference

### Core Functions

```typescript
// Calculate total complexity score
calculateComplexity(config: ModelConfig): number

// Get detailed breakdown
calculateComplexityBreakdown(config: ModelConfig): ComplexityBreakdown

// Get tier information
getComplexityTier(score: number): {
  tier: 'minimal' | 'simple' | 'moderate' | 'complex' | 'very-complex';
  label: string;
  color: string;
}

// Compare two models (for sorting)
compareComplexity(a: ModelConfig, b: ModelConfig): number

// Format for display
formatComplexity(score: number): string

// Get simplification suggestions
getSimplificationSuggestions(breakdown: ComplexityBreakdown): string[]
```

### ComplexityBreakdown Interface

```typescript
interface ComplexityBreakdown {
  total: number;

  // Component scores
  parameterScore: number;
  equationLengthScore: number;
  operationScore: number;
  nestingScore: number;
  optionalEquationScore: number;

  // Raw counts
  parameterCount: number;
  totalEquationLength: number;
  totalOperations: number;
  maxNestingDepth: number;
  optionalEquationsUsed: number;
}
```

## Usage Examples

### Basic Scoring

```typescript
import { calculateComplexity, formatComplexity } from './services/complexityScorer';

const score = calculateComplexity(modelConfig);
console.log(formatComplexity(score)); // "45 (Simple)"
```

### Detailed Analysis

```typescript
import { calculateComplexityBreakdown, getSimplificationSuggestions } from './services/complexityScorer';

const breakdown = calculateComplexityBreakdown(modelConfig);
console.log(`Total: ${breakdown.total} pts`);
console.log(`Parameters: ${breakdown.parameterCount} × 10 = ${breakdown.parameterScore}`);

const suggestions = getSimplificationSuggestions(breakdown);
suggestions.forEach(s => console.log(`- ${s}`));
```

### Leaderboard Sorting

```typescript
import { compareComplexity } from './services/complexityScorer';

const sortedModels = models.sort((a, b) => compareComplexity(a, b));
// sortedModels[0] is the simplest model (Occam's razor winner)
```

## Testing

Run the demonstration script:

```bash
npx tsx scripts/demo-complexity-scorer.ts
```

This shows three example models (minimal, moderate, complex) with full complexity breakdowns and leaderboard ranking.

## Example Output

```
MINIMAL MODEL
Total Complexity Score: 34 (Simple)

Detailed Breakdown:
  Parameters:        2 params × 10 = 20 pts
  Equation Length:   100 chars ÷ 100 × 5 = 5 pts
  Operations:        6 ops × 1 = 6 pts
  Max Nesting:       1 levels × 3 = 3 pts
  Optional Eqs:      0 eqs × 5 = 0 pts
                     ========================================
  TOTAL:             34 pts

No simplification suggestions - model is already simple!
```

## Design Philosophy

1. **Occam's Razor**: Simpler models are preferred when they achieve similar accuracy
2. **Multi-dimensional**: Complexity considers parameters, equation length, operations, and structure
3. **Actionable Feedback**: Suggestions help modelers reduce complexity
4. **Fallback Robustness**: Uses string-based counting if equation compilation fails
5. **Transparent Scoring**: All components are visible in the breakdown

## Integration Points

- **Model Validation**: Used in `modelValidator.ts` to warn about high complexity
- **Leaderboard**: Primary ranking metric (lower scores rank higher)
- **Model Editor**: Real-time complexity feedback as users edit
- **Model Comparison**: Side-by-side complexity comparison in UI

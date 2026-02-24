# Model Validator Service

## Overview

The Model Validator Service validates user-uploaded model configurations against JSON Schema and semantic rules. It implements a two-tier validation system:

- **Tier 1**: Sanity checks (must ALL pass) - schema validation, equation parsing, parameter ranges
- **Tier 2**: Anchor tests (scored) - causal relationship tests (implemented in P8-T7)

## Location

`/home/scb2/PROJECTS/gitRepos-wsl/ai-ubi-wellbeing-transition-simulator/src/services/modelValidator.ts`

## Dependencies

- `ajv` and `ajv-formats`: JSON Schema validation
- `mathParser.ts`: Equation parsing and compilation
- `types.ts`: TypeScript interfaces
- `schemas/modelConfig.schema.json`: JSON Schema for model configs

## Core Functions

### validateTier1(config: ModelConfig): ValidationFailure[]

Performs Tier 1 sanity checks that must ALL pass:

1. **JSON Schema Validation**: Validates against `modelConfig.schema.json`
2. **Equation Parsing**: All required equations must parse correctly
3. **Parameter Ranges**: min < max, default in range
4. **Metadata Requirements**: Justification required if `overridesStandardCausality` is true

**Returns**: Array of validation failures (empty array if all checks pass)

### calculateComplexity(config: ModelConfig): number

Calculates model complexity score using Occam's razor principle (lower is better):

- Parameter count: +10 per parameter
- Equation length: +5 per 100 characters
- Operation count: +1 per operation in equations
- Optional equations: +5 per optional equation used

**Example**: A simple 3-parameter model with basic equations scores ~30, while a 10-parameter model with complex equations scores 150+

### validateModelConfig(config: ModelConfig): ModelValidationResult

Full validation including Tier 1 checks and warnings:

- Runs Tier 1 validation
- Calculates complexity score
- Generates warnings for potential issues (high complexity, unusual coefficients)
- Returns `ModelValidationResult` with:
  - `valid`: Overall validation status
  - `tier1Passed`: Sanity checks status
  - `tier2Score`: Anchor tests passed (set by anchor test runner)
  - `failures`: Array of validation failures
  - `warnings`: Array of warning messages
  - `complexity`: Complexity score

### quickValidate(config: Partial<ModelConfig>): { valid: boolean; errors: string[] }

Lightweight validation for real-time editor feedback:

- Validates name length (3+ characters)
- Validates ID format (lowercase alphanumeric with hyphens)
- Checks for required equations

**Use case**: Live validation in the model editor UI

### validateSingleEquation(equation: string): { valid: boolean; error?: string; canCompile: boolean }

Validates a single equation string:

- Checks if equation parses correctly
- Attempts to compile equation
- Returns detailed validation result

**Use case**: Real-time validation in equation editor fields

### getValidationSummary(result: ModelValidationResult): string

Generates human-readable validation summary:

- Success: `✅ Model valid (complexity: 42)`
- Failure: `❌ 3 errors, 1 warning`

## Validation Rules

### Tier 1 Sanity Checks

#### T1-SCHEMA
JSON Schema validation using `modelConfig.schema.json`:
- ID must be lowercase alphanumeric with hyphens (3-50 chars)
- Name must be 3-100 characters
- Description must be 10-1000 characters
- Parameters: 1-20 allowed
- Equations: max 500 chars each, alphanumeric + operators only

#### T1-EQ-MISSING
All required equations must be present:
- `aiAdoptionGrowth`
- `surplusGeneration`
- `wellbeingDelta`
- `displacementFriction`
- `ubiUtility`

#### T1-EQ-PARSE
All equations must parse correctly:
- Valid mathjs syntax
- Only allowed functions (sin, cos, exp, log, sqrt, min, max, pow, etc.)
- Only allowed variables (adoption, wellbeing, gdp, contributionRate, etc.)
- No forbidden patterns (eval, Function, constructor, etc.)

#### T1-PARAM-RANGE
Parameter ranges must be valid:
- `min < max`
- No infinite or NaN values

#### T1-PARAM-DEFAULT
Parameter defaults must be in range:
- `min <= default <= max`

#### T1-META-JUSTIFY
Metadata requirements:
- If `overridesStandardCausality` is true, `justification` field is required (20-500 chars)

### Warnings (Non-blocking)

- **High Parameter Count**: 10+ parameters may make model hard to tune
- **High Complexity**: Complexity > 200 may indicate over-fitting
- **Missing Coefficients**: `wellbeingDelta` should include scaling coefficients (e.g., `* 0.20`)

## Complexity Scoring Examples

| Model Type | Params | Eq Length | Operations | Complexity |
|------------|--------|-----------|------------|------------|
| Minimal | 3 | 200 | 10 | ~40 |
| Standard | 5 | 400 | 20 | ~80 |
| Complex | 10 | 800 | 50 | ~200 |
| Over-fit | 15 | 1500 | 100 | ~400+ |

## Testing

Manual test suite available at:
`src/services/__tests__/testModelValidator.ts`

Run with:
```bash
npx tsx src/services/__tests__/testModelValidator.ts
```

Test coverage:
- Valid configuration
- Invalid parameter ranges
- Missing required equations
- Invalid equation syntax
- Quick validation
- Single equation validation
- Complexity calculation
- Missing justification

## Example Usage

```typescript
import { validateModelConfig, getValidationSummary } from './services/modelValidator';

// Validate a model configuration
const config: ModelConfig = {
  id: 'my-model',
  name: 'My Economic Model',
  description: 'A custom model for testing',
  parameters: [
    { name: 'growthRate', min: 0, max: 1, default: 0.5, description: 'AI growth rate' }
  ],
  equations: {
    aiAdoptionGrowth: 'growthRate * (1 - adoption)',
    surplusGeneration: 'aiRevenue * contributionRate',
    wellbeingDelta: 'ubiReceived * 0.20 - displacementRate * 0.12',
    displacementFriction: 'adoption * displacementRate',
    ubiUtility: 'ubiReceived / 1000'
  },
  metadata: {
    author: 'John Doe',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    description: 'Standard growth model',
    overridesStandardCausality: false
  }
};

const result = validateModelConfig(config);

console.log(getValidationSummary(result));
// Output: ✅ Model valid (complexity: 35)

if (!result.valid) {
  console.error('Validation failures:', result.failures);
}

if (result.warnings.length > 0) {
  console.warn('Warnings:', result.warnings);
}
```

## Integration Points

This service is used by:
- **Model Editor UI** (P8-T8): Real-time validation feedback
- **Model Upload Handler** (P8-T9): Pre-validation before anchor testing
- **Anchor Test Runner** (P8-T7): Tier 1 gating before Tier 2 tests
- **Leaderboard System** (P9): Complexity scoring for rankings

## Security Considerations

The validator enforces several security constraints:

1. **Equation Length Limit**: 500 characters max
2. **Forbidden Patterns**: Blocks eval, Function, constructor, etc.
3. **Variable Whitelist**: Only allowed simulation variables
4. **Function Whitelist**: Only safe math functions
5. **Schema Constraints**: Strict JSON Schema validation

These constraints prevent code injection and ensure equations are sandboxed.

## Future Enhancements

Phase 9 may add:
- Performance benchmarking (execution time limits)
- Statistical validation (distribution checks)
- Cross-model compatibility checks
- Version migration helpers

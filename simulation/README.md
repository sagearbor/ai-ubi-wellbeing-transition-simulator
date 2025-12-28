# Simulation Engine

This directory contains the pure simulation engine extracted from the main application.

## Architecture

The simulation logic has been extracted into **pure functions** with no side effects, no React dependencies, and no external state mutations. This enables:

1. **Deterministic testing** - Same inputs always produce same outputs
2. **Anchor test validation** - Reference implementation for equation verification
3. **Batch analysis** - Run simulations without UI overhead
4. **Time travel debugging** - Pure functions can be replayed

## Files

### `pure.ts`

The main simulation engine. Contains:

- **`stepSimulationPure()`** - Main simulation step function (PURE)
- **Helper functions** - All simulation logic extracted as pure functions:
  - `calculateAiRevenue()` - Corporation revenue calculation
  - `distributeGlobal()` - Global UBI distribution
  - `distributeCustomerWeighted()` - Customer-weighted distribution
  - `distributeHqLocal()` - HQ-local distribution
  - `adaptCorporationPolicy()` - Corporation policy adaptation
  - `respondToCompetitors()` - Nash equilibrium dynamics
  - `updateReputation()` - Reputation system
  - `analyzeGameTheory()` - Prisoner's dilemma detection
  - `usCorpAdaptation()` - US-specific behavior
  - `chinaCorpAdaptation()` - China-specific behavior
  - `euCorpAdaptation()` - EU-specific behavior

### `pure.test.ts`

Basic smoke tests to verify the extraction was successful.

## Usage

### From the main application (App.tsx)

```typescript
import { stepSimulationPure } from './simulation/pure';

// In your component:
const result = stepSimulationPure({
  state: currentState,
  corporations: currentCorporations,
  model: modelParameters
});

// Update React state with result
setState(result.state);
setCorporations(result.corporations);
setGlobalLedger(result.ledger);
setGameTheoryState(result.gameTheory);
```

### From anchor tests

```typescript
import { stepSimulationPure } from '../simulation/pure';

// Run simulation for multiple steps
let state = initialState;
let corps = initialCorps;
for (let i = 0; i < 12; i++) {
  const result = stepSimulationPure({ state, corporations: corps, model });
  state = result.state;
  corps = result.corporations;
}

// Validate against expected values
expect(state.averageWellbeing).toBeCloseTo(expectedValue, 2);
```

## Key Design Principles

### Pure Functions

All functions in this module are **pure** - they:
- Take inputs and return outputs
- Do NOT mutate external state
- Do NOT call setState or other React hooks
- Do NOT have side effects (logging, network calls, etc.)
- Are deterministic (same input = same output)

### No React Dependencies

The simulation engine has ZERO React dependencies. It can run:
- In Node.js (for batch processing)
- In web workers (for background simulation)
- In test runners (for validation)
- In the browser (for the UI)

### Immutability

Input state is NOT mutated. New objects are created and returned:

```typescript
// CORRECT - creates new objects
const newCountryData = { ...state.countryData };
const newShadowData = { ...state.shadowCountryData };

// INCORRECT - would mutate input
// state.countryData.usa.wellbeing = 100; // DON'T DO THIS
```

### Type Safety

All inputs and outputs are strongly typed using TypeScript interfaces from `types.ts`.

## Simulation Phases

The simulation executes in **5 phases** each month:

1. **Corporation Revenue Generation**
   - Calculate AI revenue based on adoption and customer demand
   - Update country AI adoption levels
   - Calculate customer base wellbeing

2. **Corporation Contribution Decisions**
   - Corporations contribute based on their contribution rate
   - Distribute funds via chosen strategy (global/customer-weighted/hq-local)
   - Track contributions in global ledger

3. **UBI Distribution to Citizens**
   - Global ledger distributes funds equally per capita worldwide
   - Countries receive UBI from multiple sources
   - Direct-to-wallet ensures no corruption

4. **Wellbeing Calculation**
   - UBI boosts wellbeing (purchasing power maintained)
   - Displacement friction reduces wellbeing (job loss anxiety)
   - Net wellbeing = base + UBI boost - displacement friction
   - Shadow simulation runs in parallel (no-UBI counterfactual)

5. **Corporation Adaptation**
   - Corporations observe market conditions
   - Adapt contribution rates based on demand projections
   - Respond to competitor behavior (Nash equilibrium)
   - Country-specific behaviors (US/China/EU)

## Economic Coefficients

Key parameters (from Phase 4 comments):

- **UBI Boost**: 0.20 (stability gain in democracies)
- **Displacement Friction**: 0.12 (transition anxiety)
- **Governance Exponent**: 1.5 (institutions buffer pain)
- **Gini Dampening**: 1.5 - gini (inequality reduces UBI utility)
- **Crisis Penalty Cap**: 5 points (adaptation limits)

These coefficients were tuned through extensive testing to produce realistic outcomes.

## Testing

Run tests with:

```bash
npm test simulation/pure.test.ts
```

The test suite verifies:
- ✓ Function executes without errors
- ✓ Month advances correctly
- ✓ Deterministic behavior (same input = same output)
- ✓ Corporation state updates
- ✓ Global ledger creation
- ✓ Game theory analysis

## Future Enhancements

Potential improvements for Phase 9+:

1. **Performance optimization** - Memoization, web workers
2. **Batch simulation** - Run multiple scenarios in parallel
3. **Serialization** - Save/load simulation checkpoints
4. **Replay system** - Time travel through simulation history
5. **Validation framework** - Anchor tests with expected outcomes

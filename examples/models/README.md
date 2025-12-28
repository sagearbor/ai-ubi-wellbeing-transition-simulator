# Example Model Configurations

This directory contains example economic model configurations for the AI/UBI Transition Simulator.

## File Format

Models can be defined in JSON or YAML format. Both are fully supported.

## Available Models

### default-model.yaml
The standard reference implementation matching the built-in simulation logic.

### aggressive-growth.yaml
Optimized for rapid AI adoption with higher displacement tolerance.

### social-stability.yaml
Conservative model prioritizing social stability over transition speed.

## Creating Your Own Model

1. Copy one of the example files
2. Modify the parameters and equations
3. Upload via the Models tab in the simulator
4. Run anchor tests to validate causal correctness

## Equation Variables

Available variables in equations:
- `adoption` - Country's AI adoption level (0-1)
- `wellbeing` - Country wellbeing score (0-100)
- `gdpPerCapita` - GDP per capita in USD
- `population` - Country population in millions
- `gini` - Inequality coefficient (0-1)
- `governance` - Institutional quality (0-1)
- `contributionRate` - Corporation UBI contribution rate (0-1)
- `aiRevenue` - Corporation AI revenue in billions
- `ubiReceived` - Total UBI received
- And more...

## Anchor Tests

Your model must pass at least 4/6 anchor tests to be eligible for the leaderboard:

1. **AT-1**: Displacement without UBI must harm wellbeing
2. **AT-2**: Generous UBI must prevent collapse
3. **AT-3**: All-selfish scenario triggers game theory detection
4. **AT-4**: Demand collapse triggers corporate adaptation
5. **AT-5**: Global distribution helps poor countries more
6. **AT-6**: Money conservation (accounting sanity)

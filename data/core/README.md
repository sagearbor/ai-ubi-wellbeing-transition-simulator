# data/core — bundled authoring-core fixtures

Model files (`*.json`) and overlays (`overlays/*.json`) for the authoring core engine
(`src/core/engine.ts`). See `docs/core-authoring.md` for how to write one; see
`src/core/fixtures.ts` for how a model gets listed in the Lab tab's "Start from" picker.

| File | Structure it demonstrates | Registered? |
| --- | --- | --- |
| `minimal.json` (+ `overlays/tutoring.json`) | Smallest useful model: a compounding stock and a derived variable | Yes |
| `training-budget.json` | `min()`-capped variables and the binding explanation | Yes |
| `pool-allocation.json` | Entity/aggregate allocation with a per-entity capacity limit (`sum()`, `min()`, an unused-remainder aggregate) | Yes |
| `market-clearing.json` | An explicit scalar equilibrium (`solves`) block, resolved every step, driven by an exogenous input | Yes |
| `market-no-root.json` | **Adversarial.** Same market as `market-clearing.json` but with the solve bracket deliberately set so no root exists in it (`[0, 5]` when the true price is `18`). Demonstrates that the engine fails explicitly (`solve-no-root`) instead of returning a wrong number. **Not registered** in `src/core/fixtures.ts` — it must never appear in the Lab picker — but `npm run validate:core` (the bundle validator) should still discover and run it, and is expected to report it as a failing model by design. Do not "fix" it. |
| `cohort-flow.json` (+ `overlays/retraining.json`) | Time-stepping cohort/flow model: a monthly displaced-worker pool with inflow/outflow and a depth-2 lag (`x[t-2]`) exercised via declared `history` | Yes |

## Running the fixtures

`npm run validate:core` (script maintained by another work package) is expected to load every
file in this directory, run each registered model's own `tests`, run every overlay on its base,
and separately confirm `market-no-root.json` fails with `solve-no-root`. In the meantime,
`src/core/fixtures.test.ts` exercises the same fixtures directly against the engine
(`npx vitest run src/core`).

## Honesty rule

Every parameter, input and effect in these files carries a `source`. None of the numbers here are
real estimates — they are deliberately labeled `"kind": "guess"` or `"assumed"` so nobody mistakes
a toy fixture for a calibrated claim. See `docs/core-authoring.md` for the full evidence-kind
rules.

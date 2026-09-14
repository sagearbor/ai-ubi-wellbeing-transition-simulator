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
| `korinek-2026.json` (+ `overlays/korinek-modest.json`, `overlays/korinek-extreme.json`) | **A published model.** The reduced-form transcription of Korinek, Jones, Sacher, Cotter & McCrory (2026) that `simulation/pure.ts` carries: exogenous adoption input, GDP path, labour share, displaced pool, unemployment. In-file tests reproduce the three published US-2030 scenarios within `validation/korinekTests.ts` tolerances; scenarios are overlays that swap the input curve and patch two coefficients. US only; approximation of published outputs, not the paper's equations. | Yes |

| `gasteiger-prettner-2020.json` (+ `overlays/gasteiger-prettner-mu04.json`, `overlays/gasteiger-prettner-mu06.json`) | **A published model, ported as a generality test** (selected by an independent reviewer, incorporated through data only). Gasteiger & Prettner (2020, ECON WPS 02/2020) two-period OLG economy with traditional and automation capital, CES robot-worker substitution and a robot tax paid lump-sum to workers. A nonlinear per-step solve for `p` with a lagged term, entities as a robot-tax grid, a baseline entity read through an indicator-weighted `sum()`, and welfare (compensating variation) against it. Tests reproduce the published welfare-maximising tax (0.55; 0.57 and 0.54 in the substitution overlays) on the grid and the Figure 2-5 steady states. One step = one 25-year generation, labelled `year` (axis values are generation indices). Gaps it exposed: `docs/design/capability-requests/gasteiger-prettner.md`. | Yes |

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

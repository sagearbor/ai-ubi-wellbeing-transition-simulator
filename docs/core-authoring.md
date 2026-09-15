# Writing a core model file

A model in `data/core/*.json` is data, not code. It is parsed by `src/core/engine.ts`
(`resolveModel` → `compileModel` → `runModel`/`runTests`) into a dependency graph and stepped
through time. This doc explains the file format element by element, then walks three worked
examples that each demonstrate a different mathematical structure.

There are two ways to run a model file in the app:

- **Import it into the Lab** (no code change). In the Model Lab, open "Import a model or overlay
  (JSON)", paste the file or choose it. It is validated (`validateCoreModel`; an overlay with
  `validateOverlay` against the model on screen) and then runs like a bundled model, through the
  same runner and limits. It stays **experimental — not curated**: the picker, the results, policy
  bundles and memos all say so, share links are off for it (a link names a model the app ships),
  and a bundle made on it carries the model itself so it reopens elsewhere. "Export model +
  overlays (JSON)" in "Advanced: model file" writes a file the importer reads back. Fields the
  format does not have are reported as *unsupported capabilities*, not silently dropped.
- **Make it a curated fixture** (a code change, and review). Put the file under `data/core/`,
  make its own `tests` pass under `npm run validate:core`, read `data/core/README.md`, and register
  it in `src/core/fixtures.ts`. Importing an unchanged copy of a curated model opens the curated one.

## The shape of a model (`CoreModel`, `src/core/types.ts`)

```
schemaVersion, id, name, description?, scope?, license?, sources?
time: { start, end, step: 'year' | 'month', stepLabel?, stepYears? }
limitations?: { steadyStateOnly?: { outputs, reason, at? } }
entities?: { kind, ids, roles? }
parameters: Parameter[]
inputs?: Input[]
variables: Variable[]
effects?: Effect[]
solves?: SolveBlock[]
outputs: string[]
tests?: ModelTest[]
```

`scope` is a plain-English sentence shown before results: say what the model can and cannot
claim. Every registered fixture should have one.

## Time: calendar years, or the model's own unit

`time.start`/`time.end` are calendar years by default, and `step` says how many engine steps make
one year (`year`: 1, `month`: 12). A model whose step is **not** a calendar period declares its
unit instead of pretending:

```json
"time": { "start": 0, "end": 40, "step": "year", "stepLabel": "generation", "stepYears": 25 }
```

With `stepLabel`, every time value in the file counts that unit — `start`, `end`, input curve
keys, effect `from`, test `at`, and the `year` symbol in expressions — and the app labels steps
"Generation 3", never "Year 3" or a calendar year. `stepYears` states the real length of one unit
for the reader; nothing is converted or interpolated with it, and no annual path is invented
between steps. `data/core/gasteiger-prettner-2020.json` (an OLG model, one step = one 25-year
generation) is the worked case.

When some outputs are only meaningful at a steady state — Gasteiger–Prettner's consumption and
welfare series mix two cohorts during a transition, and its welfare comparison is between steady
states — say so:

```json
"limitations": { "steadyStateOnly": { "outputs": ["utility_prev", "cv1_pct"], "at": 40, "reason": "..." } }
```

The Lab and the policy results then show those outputs' steady-state values (at `at`, default
`time.end`; for a model with entities, the value for every entity) and the reason, instead of a
transition chart; the policy memo reports only the steady-state row. `at` must be a step of the
model, and each listed id should be an output.

## Execution limits

The engine enforces hard limits (`src/core/limits.ts`), and the Lab and Policy panel check run
settings against the same numbers before starting anything — including settings that arrive in a
shared link or a bundle, which are not run if they exceed them:

| limit | value | where it is enforced |
|---|---|---|
| steps per run | 5,000 | `compileModel`: `limit-exceeded`, nothing is allocated |
| entities per model | 500 | `compileModel` |
| Monte Carlo draws per request | 2,000 | `runMonteCarlo`, `pairedRun`, link/bundle checks |
| bisection iterations a solve may declare (`maxIter`) | 1,000 | `compileModel`, and a backstop inside the solver |
| wall clock per run request | 60 s | a `RunBudget` checked every step and bisection iteration; the worker's watchdog |

In the browser, runs execute in a Web Worker (`src/workers/`): a newer change supersedes the run in
progress, long runs show progress and a Cancel button, and a run that cannot hear a cancel (inside
one long step) is stopped by restarting the worker. A model with no ranged parameter is
deterministic: the Lab's uncertainty band and the paired policy run execute it **once** and say
"deterministic: uncertainty off", rather than repeating identical draws.

## Expression rules

Equations are parsed by a restricted mathjs subset. Allowed:

- Arithmetic, comparisons are **not** allowed as boolean logic — there is no `if`; branch behavior
  comes from `min()`/`max()`.
- Functions: `min, max, abs, exp, log, log10, sqrt, pow, floor, ceil, round, logit, sigmoid, clamp,
  sum, mean`. Anything else (`random()`, custom functions) is rejected at compile time.
- `t` — the step index, starting at 0. `year` — the calendar year, fractional for monthly models
  (e.g. `2026.5` is July 2026).
- **Lags**: written inline as `x[t-1]`, `x[t-2]`, ... on a variable or input id. This is the only
  way to reference an earlier step; a same-step self-reference (`x` used inside `x`'s own
  equation) is a compile error telling you to use a lag or a stock.
- **Aggregates**: `sum(x)`, `mean(x)`, `min(x)`, `max(x)` where `x` is a bare variable or input id
  (not an expression) compute across all entities at the current step. Used inside a per-entity
  equation, or as a variable's own equation to publish the aggregate itself (see
  `pool-allocation.json`'s `pool` variable, `equation: "sum(contribution)"`).
- Assignments, object/array literals, and string constants are rejected — a model file expresses
  values, not control flow.

`min()`/`max()` calls with two or more arguments are also binding-tracked: the engine records
which argument was active at every step, so the UI (and `explainBinding()`) can say things like
"placements is limited by suitable_openings" instead of just showing a number.

## Stocks: `initial` and `history`

A variable becomes a stock by setting `initial` (a number, or a string expression evaluated only
at `t = 0`) and referencing its own lag in its `equation`, which then applies for `t >= 1`:

```json
{ "id": "displaced_pool", "initial": 0, "equation": "displaced_pool[t-1] * (1 - reemploymentRate) + inflow" }
```

If something needs a **deeper** lag than one step back before the run has produced that many
steps (e.g. `x[t-2]` evaluated at `t = 0` or `t = 1`), declare `history`: an array where index 0 is
the value at `t-1`, index 1 is `t-2`, and so on. Missing history is a hard compile error
(`missing-history`) — the engine will not silently invent a value for a step that doesn't exist.

## Inputs and interpolation

`inputs[]` are exogenous curves keyed by calendar year as strings: `{"2026": 0.1, "2030": 0.45}`.
Between keys, `interp` controls the shape: `linear` (default), `step` (holds the earlier value),
or `logodds` (interpolates in logit space — the right choice for a probability/share input where
linear interpolation would misbehave near 0 or 1). `outside` controls behavior past the last key:
`hold` (default — freezes at the boundary value) or `error` (refuses to run past the declared
range). `byEntity` overrides the curve for specific entity ids.

## Effects and hooks

An effect attaches to a **variable** (not a parameter — see below) whose `hook` is not explicitly
`false`. Multiple effects on the same target compose in a fixed order: every `add` effect is
summed, then every `multiply` effect is applied as a product, then that combined adjustment is
applied to the target's own computed value — `value = (base + sum(adds)) * product(multiplies)`.
This means an `add` effect is in the target's own unit (declare `unit` and it is checked against
the target's `unit`), while a `multiply` effect should be dimensionless — the engine only warns
(doesn't hard-fail) if you give it a unit that isn't `''`/`'ratio'`/`'1'`. Every effect requires a
`source`.

**If what you want to change is a parameter**, make it a small pass-through variable first
(`{ "id": "reemploymentRate", "equation": "reemploymentRateBase" }`) so it has a hook to attach to.
`cohort-flow.json` does exactly this so `overlays/retraining.json` can multiply the re-employment
rate without touching `cohort-flow.json` itself.

## Solve blocks: explicit scalar equilibrium

`solves[]` declares an unknown the engine finds by bisection, once per entity per step, *before*
anything that depends on it is evaluated that step:

```json
{ "id": "clear", "unknown": "price", "residual": "(demand) - (supply)", "bracket": [0, 1000], "tol": 1e-10 }
```

`residual` must reference `unknown` (compile error if it doesn't — a solve that can't move its own
unknown isn't a solve).

**How a root is accepted.** The absolute residual must satisfy
`|residual| <= residualTol` (default `tol`), including at bracket endpoints. The threshold never
scales with endpoint residuals, and bracket width alone cannot certify a solution. Authors should
normalize the residual or choose an explicit tolerance in its declared units. A numerical residual
check is not a mathematical proof that a discontinuous function has a root.

A non-finite evaluated residual inside the bracket fails with `solve-discontinuity`. A finite
bracket that cannot produce a distinct floating-point midpoint fails with `solve-no-convergence`,
as does exhausting `maxIter` (default 100). Neither condition proves a discontinuity. Same-sign
endpoints, unless one already meets the residual tolerance, fail with `solve-no-root`: the declared
bracket does not provide the sign change this method requires. The result is `ok: false`; the engine
never substitutes an unconverged midpoint. `data/core/market-no-root.json` demonstrates that failure.

### Execution budgets

The direct core, paired policy and worker entry points enforce combined source, graph, retained-result
and work limits before allocating the calculation. The current limits are defined in
`src/core/limits.ts`: 250,000 source characters, 1,000 variables, 2,000 characters and 256 lexical
tokens per expression, 64 bracket levels, and a conservative 4,000,000 retained-cell allowance
(estimated at 64 bytes per cell). Graph dependencies, entities, steps, draws, paired sides and retained
jobs contribute to the budget. These estimates are conservative limits, not measured browser heap
guarantees. Oversized source is refused before cloning or hashing it.

Worker jobs share one active allocation reservation per execution realm and a bounded queue. Queued
jobs can be cancelled without waiting for the active job; completing or cancelling a job releases
its reservation. Independent workers and results retained by external callers remain outside that
reservation's accounting. A budget failure is an execution diagnostic, not an economic constraint.

### `through`: variables and effects inside the equilibrium

A residual may not read a variable that itself depends on the unknown (that is a same-step cycle)
unless the solve lists it in `through`. Through variables are re-evaluated **with their effects**
at every bisection step, so an effect on one of them — a subsidy on supply, a tax multiplying a
factor demand — moves the equilibrium instead of being applied after it:

```json
{ "id": "clear", "unknown": "price", "residual": "demand - supply", "through": ["supply", "demand"], "bracket": [0, 1000] }
```

Through variables may read each other (listed in any order), cannot be stocks, and are reported at
the root as ordinary variables. If an effect targets a variable that depends on a solve unknown
and the solve does not list it, the engine emits an `effect-after-solve` warning: the effect is
applied to the reported value only, and the equilibrium does not see it. That case was found by
the independently selected Gasteiger & Prettner port (`docs/design/capability-requests/gasteiger-prettner.md`, gap 2).

## Invariants: limits that must hold on final values

`invariants[]` are boolean expressions checked at every step, for every entity, on final values
(after effects): `{ "id": "within-capacity", "expr": "completions <= instructor_capacity" }`. A
violation fails the run with `invariant-violated` and names the values. Use them for capacity limits
and accounting identities, so an overlay or an added variable cannot push a limited output past its
limit while the binding explanation still reports the limit. Overlays may add invariants but cannot
replace or relax one. Relatedly, an effect attached to a variable whose equation is a `min()`/`max()`
limit raises `effect-after-constraint`: attach it to an input of the limit instead.

## Entities and `byEntity`

`entities: { kind, ids }` turns every variable, parameter, input and effect into one instance per
entity id (series live at `result.series[entityId][varId]`); a model with no `entities` block runs
as a single implicit entity `"_"`. `byEntity` on a `Parameter` or `Input` overrides its value/curve
per entity id, falling back to the shared `value`/`curve` otherwise. Aggregates (`sum`, `mean`,
`min`, `max`) are the only way a per-entity equation reads across entities — there is no direct
`otherEntity.x` syntax, by design, so cross-entity coupling always goes through a declared,
readable aggregate.

## Tests

`tests[]` are the model's own reproduction checks: `{ name, at (a calendar year), entity?, expr,
expected, tol }`. `expr` is evaluated once, at the step matching `at`, in the same expression
language as equations (lags and aggregates included). A model with a `solves` block that fails
produces no passing tests — `runTests` reports every test as failed with the run's diagnostics in
the message rather than a numeric mismatch.

## Overlays: what they may and may not do

An overlay (`Overlay`, no `schemaVersion`/`time`/`entities` of its own) can add new `parameters`,
`inputs`, `variables`, `effects`, `solves`, `outputs`, and `tests` on top of a base model.
It **cannot** redefine an existing variable's equation — `resolveModel` detects an overlay
variable id that collides with a base variable id and rejects it with a `structural-change`
diagnostic, pointing you at attaching an effect instead. This is deliberate: replacing an equation
silently would invalidate whatever reproduction claims were made about the base model without
saying so. If you genuinely need different mechanics, that's a new model (a "structural fork"),
not an overlay. Two overlays defining the same effect or solve id is also rejected
(`duplicate-id`) — the usual way a value silently gets counted twice.

## Evidence kinds and the honesty rules

Every `Parameter.source`, `Input.source` (when present) and `Effect.source` needs at least a
`label`; `kind` defaults to `'assumed'` if you omit it, but you should be explicit. The six kinds,
loosest to strongest: `guess` (a placeholder, no real backing), `assumed` (a modeling choice, not
a measured quantity), `elicited` (expert judgment), `calibrated` (fit to data by the model author),
`associational` (a measured correlation — e.g. the WHR income/wellbeing regression in
`minimal.json`), `causal` (an estimated causal effect, e.g. from a natural experiment). **`guess`
is a completely legitimate, expected label for a toy fixture** — every number in
`pool-allocation.json`, `market-clearing.json` and `cohort-flow.json` is a `guess`, and that is
correct, not a shortcoming: the UI is expected to display "guess"/"assumed" sources as visible
assumptions, not hide them. What is not acceptable is a fabricated citation (a `url` or specific
study name attached to a number nobody actually checked) or an uncredited capacity/bound
(`bounds`, a `capacity` parameter, a bracket) presented as if it were derived rather than chosen.
A missing `source.label` on a parameter is a compile error (`missing-source`) precisely so this
can't slip through silently.

## Three worked examples

**Entity/aggregate allocation with a capacity limit — `data/core/pool-allocation.json`.** Four
countries each contribute `contributionRate * income` (per-entity, via `byEntity` on `income`)
into a shared pool (`sum(contribution)`), which is redistributed by a fixed `share` and then
capped by each country's `capacity` (`min(allocation_uncapped, capacity)`). The gap between what a
share entitles a country to and what it can actually absorb is tracked, not discarded, as another
aggregate (`unused_total = sum(unused)`). Its `tests` deliberately cover one country that binds
hard on capacity, two that don't bind at all, and the aggregate remainder.

**Explicit scalar equilibrium — `data/core/market-clearing.json`.** `supply` and `demand` are
ordinary linear variables in `price`, but `price` itself is never assigned an equation — it's the
`unknown` of a `solves` block whose `residual` is `demand - supply`, re-solved every year against
an exogenous `demand_shift` input that ramps up 2026→2030. Its `tests` check that supply equals
demand at both ends of the run and that the closed-form price (`(c + shift − a) / (b + d)`)
rose from 18 to 22 as demand shifted up. `data/core/market-no-root.json` is the same system with
the bracket deliberately narrowed so the root falls outside it — proof the engine reports
`solve-no-root` instead of guessing.

**Time-stepping cohort/flow model — `data/core/cohort-flow.json`.** A monthly stock,
`displaced_pool`, gains `inflow` (`workforce * displacementInput`, an exogenous share-of-workforce
input) and loses a share `reemploymentRate` of itself each month —
`displaced_pool[t-1] * (1 - reemploymentRate) + inflow`. `unemployment` is
`naturalUnemployment + displaced_pool / workforce`. `processing_backlog`
(`displaced_pool - displaced_pool[t-2]`) exercises a depth-2 lag, which needs `displaced_pool` to
declare two steps of `history` since the model's very first two months don't have real prior
values yet. Its `tests` check the pool has settled near its analytic steady state
(`inflow_steady / reemploymentRate`) by the end of the run. `overlays/retraining.json` pairs with
it: a `retrainingParticipation` input, a `retrainingReemploymentEffect` parameter, a `multiply`
effect on `reemploymentRate` (which `cohort-flow.json` exposes as a small pass-through variable
specifically so this effect has somewhere to attach), and a new `retraining_cost` variable — none
of `cohort-flow.json`'s own equations are touched.

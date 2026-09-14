# Capability requests from the Gasteiger & Prettner (2020) port

Context: v3 spec generality test. A reviewer selected Gasteiger & Prettner, *Automation, Stagnation,
and the Implications of a Robot Tax* (ECON WPS 02/2020, TU Wien; PDF SHA-256
`1b9b1f74…a551c`). A contributor ported it through model data only:
`data/core/gasteiger-prettner-2020.json`, `data/core/overlays/gasteiger-prettner-mu0{4,6}.json`,
`src/core/gasteigerPrettner.test.ts`. No change was made to `src/core/engine.ts`, `expr.ts`,
`validate.ts`, `types.ts`, `sensitivity.ts` or any component.

Each candidate gap below was checked against the engine's actual behaviour. The "capability
probes" block in `src/core/gasteigerPrettner.test.ts` pins every finding marked **real**. If one of
those probes starts failing, the engine has changed and the request should be revisited.

## Summary

| # | Candidate gap | Verdict | What the port did |
|---|---|---|---|
| 1 | Generation-length time step | **Real** (presentation) | Labelled `year`, start 0, and the scope says the axis values are generation indices |
| 2 | Solve residual routed through derived variables / effects inside a solve | **Real**, and the effect case fails silently | Spelled `k`, `X`, `R`, `psi` out in `p` inside the residual; robot tax is an explicit parameter, not an effect; the solve's cone is `hook: false` |
| 3 | Lags inside a solve residual | Not a gap | Works (probe) |
| 4 | `history` on a non-stock variable | Not a gap | Works (probe); the port uses a sourced stock `young_income` instead so the initial condition carries a source |
| 5 | Referencing a baseline entity | **Real** | `isBaseline` 0/1 parameter plus `sum(isBaseline * c)` aggregate |
| 6 | Argmax over entities | **Real** | Grid tests `x - max(x) = 0` at an entity; fine grids in the vitest file |
| 7 | Charts assume entities are countries | Not a gap as stated; a **real** adjacent gap (no cross-entity chart) | Nothing: the Lab shows one entity's time path |
| 8 | Aggregate over a solve unknown (found while porting) | **Real** (minor) | Monotonicity of `p` checked in vitest instead |
| 9 | Monte Carlo rescaling of `byEntity` when the base value is 0 (found while porting) | **Real hazard**, not triggered | `tau` and `isBaseline` carry no range; the parameter note warns |
| 10 | No source on initial conditions / history (found while porting) | **Real** (minor) | The initial income is a sourced parameter `w_init`, used through a stock's `initial` expression |

## 1. Generation-length time step

- **Model needs:** one step = one 25-year generation (paper p.16).
- **Engine offers:** `time.step: 'year' | 'month'`. The engine itself treats any value other than
  `'month'` as a year. The JSON schema rejects anything else (probe: `step: 'generation'` fails
  validation at `/time/step`). Test `at` values and chart x-axes are calendar years.
- **Smallest capability:** an optional `time.stepLabel` (e.g. `"generation"`) plus
  `time.stepYears` (e.g. `25`), used only for axis labels and year arithmetic. Alternatively, allow a
  non-calendar step whose `at` values are step indices.
- **What the port did:** `time: { start: 0, end: 40, step: "year" }`. The scope text says the axis
  values 0-40 are generation indices, not calendar years. No maths depends on the label, because the
  model is natively discrete.

## 2. Solve residuals cannot go through derived variables, so effects cannot act inside a solve

- **Model needs:** the unknown `p` enters the residual directly and through `k(p)`, `X(p)`,
  `R(k, p)` and `psi(R)`. The robot tax is naturally a `multiply (1 + tau)` effect on `k`, and the
  published equation is literally `k = (1 + tau)·{…}`.
- **Engine offers:**
  - A residual may reference only parameters, inputs, lags, and variables that do not depend on the
    unknown.
  - Referencing a variable that depends on the unknown is a hard `cycle` error. It is accompanied
    by a misleading `residual does not reference its unknown` parse error when the unknown appears
    only through that variable (probe).
  - Effects are applied when a variable is evaluated, which happens after the solve.
  - An effect on a variable downstream of the unknown is therefore applied to the reported value but
    never seen by the solve. There is no diagnostic (probe: `x` is reported as 8 while the solve used
    `x = 4`).
  - For this model that means an overlay attaching `(1 + tau)` to `k` would report a taxed `k` next
    to an untaxed equilibrium `p` (about 0.025 instead of 0.011 for p·100 at tau = 0.5), with status
    `ok`.
- **Smallest capability** (either):
  - (a) Let a solve list `through: ["k", "X", "R", "psi"]`, the variables re-evaluated with their
    effects inside each bisection step. The compile step then treats those variables as part of the
    solve node rather than as a cycle.
  - (b) At minimum, emit a warning when an effect targets a variable that is downstream of a solve
    unknown and that variable's formula is duplicated in, or feeds, the residual. The cheap version:
    warn on any effect whose target depends on a solve unknown.
- **What the port did:**
  - The residual spells the four formulas out in `p`. Four tests confirm the residual recomputed
    from the `k` and `psi` variables is zero to 1e-9, so the two copies cannot drift.
  - `tau` is a base-model parameter with value 0, set per entity. This is the paper's own
    Appendix B system, which nests the untaxed model at tau = 0, so no equation was changed to fit.
  - All variables in the solve's cone are `hook: false`, so nobody can attach an effect that the
    solve would ignore.
  - Because of this gap the robot tax is not demonstrable as an overlay, which was the memo's
    intended probe.

## 3. Lags inside a solve residual — not a gap

`scopeFor` resolves lags for residuals exactly as for equations, including declared history at
t = 0 (probe: `u - x[t-1] - 1` with `history: [3]` solves to 4, then 9).

## 4. `history` on a non-stock variable — not a gap

History is read for any variable, with or without `initial` (same probe). Missing history is a hard
`missing-history` error. The port nevertheless uses a stock, `young_income`, with
`initial: "w_init"` and equation `w[t-1] + transfer[t-1]`, because `history` arrays cannot carry a
source (see 10).

## 5. Referencing a baseline entity

- **Model needs:** every tax scenario's welfare is measured against the tau = 0 steady state
  (p.23).
- **Engine offers:**
  - Cross-entity reads only through `sum/mean/min/max(x)`.
  - `Entities.roles` is declared in `types.ts` and the schema but is not read by the engine at all
    (probe: a role name used in an equation is `unknown-symbol`).
- **Smallest capability:** `x@baseline`, or `at(x, "tau=0.0")`, where `baseline` is a role that maps
  to an entity id. It would be compiled as an aggregate-like node that depends on that one entity's
  `x`.
- **What the port did:**
  - An `isBaseline` parameter (1 for `tau=0.0`, 0 otherwise), variables
    `c1_base_part = isBaseline * c1_prev`, and aggregates `c1_base = sum(c1_base_part)` (likewise
    for c2).
  - Correct, no cycle, but roundabout. The indicator is labelled `assumed` ("model structure, not a
    number from the paper").

## 6. Argmax over entities

- **Model needs:** the welfare-maximising tax rate (p.24).
- **Engine offers:** aggregates return values, not the entity or parameter value that attains them.
- **Smallest capability:** `argmax(x, tau)` / `argmin(x, tau)`, returning the value of parameter
  `tau` at the entity where `x` is extreme. The `roles` comment in `types.ts` already imagines
  `argmax(chipShare)`.
- **What the port did:**
  - In-file tests assert `utility_prev - max(utility_prev) = 0` at `tau=0.55` (0.58 and 0.55 in
    the mu overlays) on a 0.01 grid.
  - `src/core/gasteigerPrettner.test.ts` re-runs the same file on 0.001 grids by rewriting only the
    entity list and the `byEntity` maps.
  - Results:

    | mu | Published | Max utility | Min CV1 share | Min CV2 share |
    |---|---|---|---|---|
    | 0.5 | 0.55 | 0.553 | 0.554 | 0.552 |
    | 0.4 | 0.57 | 0.579 | 0.581 | 0.575 |
    | 0.6 | 0.54 | 0.546 | 0.546 | 0.546 |

  - The criterion matters at the third decimal. Only "max utility", the paper's "maximizes
    welfare", keeps mu = 0.4 inside ±0.01.

## 7. Charts and entities

- The Lab does not assume entities are countries: it shows an entity picker labelled with
  `entities.kind` ("robotTaxRate") and plots one entity's series against the step axis. The model
  renders in the Lab.
- The real, adjacent gap: the paper's Figures 4 and 5 plot a steady-state value against the tax rate
  (x = a parameter across entities). The Lab has no "value at step T across entities" chart, so
  those figures cannot be drawn.
- **Smallest capability:** an output chart mode "across entities at the selected step", with the
  x-axis given by a parameter that varies by entity.
- **What the port did:** nothing in the views. The figures are reproduced as tests only.

## 8. Aggregate over a solve unknown

`min(p)` is rejected with `aggregate over unknown "p"`: aggregates accept only variables and
inputs, and solve unknowns are not variables (probe).

- **Smallest capability:** accept solve unknowns in aggregates, since they are per-entity series
  like any variable.
- **What the port did:** checked monotonicity of `p` in tau in the vitest file rather than adding a
  pass-through variable purely for the test.

## 9. Monte Carlo and `byEntity` with a zero base value

`resolveParameters` rescales a sampled value by `byEntity[entity] / value`. When `value` is 0 this
gives `Infinity`, and the run fails with `non-finite` (probe in scratch, not committed).

`tau` (value 0, byEntity grid) and `isBaseline` would both hit this if given a range. Neither is
ranged, and the `tau` source note says not to range it.

- **Smallest capability:** skip the rescaling, or sample around the entity's own value, when the base
  value is 0. Alternatively, reject a `range` on a parameter whose `value` is 0 and that has
  `byEntity`.

## 10. Initial conditions carry no source

`Variable.history` (and a numeric `initial`) have no `source` field, so an assumed starting state is
invisible to the evidence summary.

- **Smallest capability:** optional `source` on `Variable`, required when `history` or `initial` is
  present.
- **What the port did:** the assumed initial income is a parameter `w_init` (source kind `assumed`),
  used through `initial: "w_init"`.

## What was labelled rather than modelled

- **Time axis:** generation indices labelled "year" (gap 1).
- **Cohort timing:** `c1_prev`, `c2_prev`, `utility_prev`, `cv1_pct` and `cv2_pct` belong to the
  cohort born at t-1, because c1 needs next period's return and the engine has no leads. They equal
  the paper's steady-state values; during a transition they mix cohorts (`cv*_pct` divides by the
  current `y`). Only steady states are quantitative targets.
- **Initial condition:** `w_init = 0.12`, assumed. The paper's transition figures are linearised
  and state no initial condition.
- **Welfare baseline:** the `isBaseline` indicator (gap 5).
- **Optimum location:** on grids only (gap 6).
- **Solve bracket:** `[1e-12, 1]` is assumed, not derived (p = 0 is excluded by `p^(1-mu)` and
  `k^(alpha-1)`).

## Published targets that the port does not match at the reviewer's tolerance

- **Fig. 3(a) p.21, p×100 plateau at tau = 0.5:**
  - Port 0.01143 against a reading of 0.011 ±3%, a 3.9% miss.
  - The reviewer's own independent recomputation (0.0114) misses by the same amount, so the
    tolerance is tighter than a two-digit reading of an axis with 0.025 ticks supports.
  - Not tuned: removed from the in-file tests and pinned in the vitest file as a documented
    discrepancy.
- **mu = 0.4, Figure 5 CV1-share minimiser:**
  - 0.581, which is 0.011 from the published 0.57.
  - The utility maximiser (0.579) is within tolerance. See gap 6.

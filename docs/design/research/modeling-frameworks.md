# Modeling frameworks, standards, and prior art — critical survey

**Goal.** We plan to replace two ad-hoc engines (a month-by-month simulator
driven by 5 uploadable equations, and a static probability influence graph)
with **one core**: a user-editable graph of variables, each with an equation
or exogenous input, parameters with ranges/sources, lagged references, time
integration, Monte Carlo over parameter ranges, data bindings for
backtesting, and time-profiled interventions. Stack: TypeScript + React,
mathjs already in use.

For each item below: what it is, licence, language, maturity, and an
**adopt / borrow ideas / ignore** verdict, judged against our constraints —
TS-native or cleanly embeddable, editable by lay users, and generatable by
an LLM without producing invalid syntax.

---

## 1. System dynamics: XMILE, Vensim, Stella, Insight Maker, PySD, simlin

**XMILE** is an OASIS Committee Specification (v1.0, Dec 2015) encoding
stock/flow SD models as XML: `<stock>`, `<flow>`, `<aux>`, graphical
functions, array/subscript support, units, and a `<sim_specs>` block for
start/stop/dt/integration method. The OASIS TC appears dormant since
~2015–16, but Stella explicitly treats XMILE as its own interchange format,
making it the de facto SD lingua franca despite the frozen committee. No
mature standalone JS/TS parser exists as an npm package — XMILE parsing
lives only inside PySD (Python) and simlin (Rust/WASM).
([spec](https://www.oasis-open.org/standard/xmile1-0/),
[TC](https://www.oasis-open.org/committees/xmile/))
**Verdict: borrow ideas (typed stock/flow/aux, sim_specs, units-as-metadata), don't adopt as our native format.** XML is a poor round-trip target for LLM-generated files versus JSON, and it's rigidly stock/flow-centric where we want a general variable graph.

**Vensim** (Ventana Systems) — proprietary, `.mdl` text format, free reader
only (no create/edit). **Ignore** as a target; only relevant as an import
source. ([license](https://vensim.com/license/))

**Stella / isee systems** — proprietary, but runs "industry-standard
XMILE" natively, confirming XMILE's role. **Ignore**, no open code.
([product](https://www.iseesystems.com/store/products/stella-simulator.aspx))

**Insight Maker / `scottfr/simulation`** — free web tool; its engine is a
standalone JS/TS npm package, **AGPL-3.0**. Mixes stocks/flows *and*
agent-based primitives in one model (closer to a general variable graph than
rigid stock/flow), named vectors, units checking, Euler/RK4 integration,
live parameter tweaking mid-run, own ModelJSON format. No built-in Monte
Carlo. **Verdict: borrow ideas heavily** (closest JS-native architectural
match found); **evaluate licence risk before importing any code** — AGPL is
a real constraint for us. ([repo](https://github.com/scottfr/simulation))

**PySD** — MIT, Python, actively maintained (~460 stars). Translates
Vensim/XMILE into Python via an intermediate AST, designed so other
backends could be added; Monte Carlo bolted on via external tooling (SALib),
not native. **Verdict: ignore for reuse (wrong language), copy the
architecture**: parse → stable intermediate AST → compiled evaluator,
decoupled from storage format — exactly the shape we want with mathjs.
([repo](https://github.com/SDXorg/pysd))

**simlin** (Bobby Powers) — **Apache-2.0**, actively developed successor to
`sd.js`. Rust core compiled to WASM + TypeScript/React frontend + Python
bindings. Browser editor imports Vensim/XMILE and **exports XMILE**; pieces
published as embeddable npm packages. **Verdict: the most concretely
reusable SD project here** — permissive licence removes the AGPL problem.
Consider vendoring it later specifically as an **XMILE/Vensim
import-export bridge**, not as our core engine.
([repo](https://github.com/bpowers/simlin))

**Direct answer — adopt XMILE as our format + reuse an engine? No.** No
mature standalone TS engine exists (only Rust/WASM or Python); XMILE's
XML/stock-flow rigidity fights our general lag/exogenous/Monte-Carlo graph;
JSON/YAML is far more LLM-reliable than XML. Design our own JSON schema;
optionally add a simlin-backed XMILE importer later as a bridge.

---

## 2. Probabilistic estimation: Squiggle and Guesstimate

**Squiggle** (QURI) — a DSL where probability distributions are first-class
values, built-in Monte Carlo. Published as `@quri/squiggle-lang` on npm
(genuinely TS-embeddable, not just a hosted playground), plus
`@quri/squiggle-components` for UI widgets. Licence trends MIT across QURI
repos but should be verified directly before use. Time/dynamics support is
weak — functions-of-time exist but there's no native lagged-state or
ODE-integration primitive; it's single-shot functional-probabilistic, not a
system-dynamics engine. Active project (Hub, Playground, real releases).
([squiggle-language.com](https://www.squiggle-language.com/),
[npm](https://www.npmjs.com/package/@quri/squiggle-lang))
**Verdict: borrow ideas, seriously evaluate partial adoption.** Realistic
path: embed `@quri/squiggle-lang` as the distribution/uncertainty
sub-language for parameter values, while our own graph+time+lag engine
(mathjs for deterministic parts) stays the outer layer — Squiggle gives us
no stocks, flows, or lags on its own.

**Guesstimate** — spreadsheet-style Monte Carlo tool, Squiggle's spiritual
predecessor (its distribution-syntax editor was forked into Foretold;
Squiggle is the same community's intended successor). No strong recent
activity found. **Verdict: ignore for code reuse**, Squiggle supersedes it.

**Could Squiggle be our equation language?** Not wholesale, but yes as a
sub-language: mathjs stays the deterministic evaluator; Squiggle-style
distribution syntax (or the literal embedded library) handles parameters
declared with a range/uncertainty rather than a point value.

---

## 3. Policy microsimulation: "tax code in state X vs state Y"

**PolicyEngine** — AGPL-3.0, Python engine packages
(`policyengine-core/us/uk/au`, one per jurisdiction) behind a Python REST
API; the React frontend is a thin HTTP client, nothing JS-native to embed.
Built directly on OpenFisca's model; US state variation lives inside
`policyengine-us` as a state-scoped branch of the parameter tree —
jurisdiction is a namespace dimension, not a separate engine. Active,
funded, production API. **Verdict: borrow the pattern, not the code** — AGPL
risk, and nothing JS to embed anyway.
([repo](https://github.com/PolicyEngine/policyengine-us))

**OpenFisca** — AGPL-3.0-or-later, Python engine + YAML parameter files
mirroring a folder hierarchy, Python formula functions per variable. This is
the **strongest structural precedent found for state-vs-state tax
modeling**:
- Parameters form a hierarchical, path-keyed tree; each value can vary
  **by date/period** — time-indexing is baked into the parameter format.
- **Formulas are strictly separated from parameters** — a formula is fixed;
  only the parameters it reads change per jurisdiction/time. Maps directly
  onto our equation-node vs. parameter-node split.
- **Jurisdiction is a swappable package** (`country-template` scaffold) —
  pluggability is a first-class design goal.
- **Reforms are overrides** layered on a base package — directly analogous
  to "scenario = diff against baseline," i.e. our time-profiled interventions.

**Verdict: borrow the schema, not the code** (Python, AGPL, wrong stack).
([docs](https://openfisca.org/doc/coding-the-legislation/legislation_parameters.html))

**Penn Wharton Budget Model** — not open source, no public repo found for
the model itself; methodology described but code/data unpublished as of
this search. **Verdict: ignore.**
([site](https://budgetmodel.wharton.upenn.edu/model/))

**Tax-Calculator / PSLmodels** — parameters stored as **flat JSON files**
(`policy_current_law.json`, dated reform files like `2017_law.json`);
sibling PSL repos trend **MIT**, notably more permissive than
OpenFisca/PolicyEngine (verify Tax-Calculator's own LICENSE directly). A
"reform" is literally a **JSON diff against the baseline** — parameter name
→ time-indexed values. Simpler/flatter than OpenFisca's YAML tree, same
core idea. **Verdict: borrow the JSON schema directly — the best-fit format
surveyed for a TS/LLM-editable app.** Each jurisdiction/scenario becomes a
JSON overlay against a shared baseline, formula nodes untouched.
([repo](https://github.com/PSLmodels/Tax-Calculator))

**Bottom line:** nothing here is embeddable in a TS/AGPL-free stack.
Replicate the structural pattern — time-indexed, jurisdiction-namespaced
parameter nodes; shared formula nodes; jurisdiction/reform as a JSON overlay
against a baseline (Tax-Calculator's flatter convention over OpenFisca's
tree-of-YAML).

---

## 4. AI-economics models: what has public code?

| Model | Public code? | What's public |
|---|---|---|
| Epoch AI **GATE** | No | Equations in the [arXiv paper](https://arxiv.org/abs/2503.04941) only; [playground](https://epoch.ai/gate) has no linked repo |
| Davidson **compute-centric takeoff** | Partial | No code from Davidson; Epoch's [interactive companion tool](https://epoch.ai/latest/interactive-model-of-takeoff-speeds), still no repo |
| Erdil & Besiroglu **explosive growth** | No | [Argument paper only](https://arxiv.org/abs/2309.11690) |
| Korinek & Suh **AGI transition scenarios** | No | Pure theory, [NBER w32255](https://www.nber.org/papers/w32255) |
| Anthropic **Korinek-Jones et al. 2026 explorer** | No — confirmed | Interactive tool + [technical report](https://www.anthropic.com/institute/econ-scenarios); task-based; no repo anywhere |

GATE combines a compute-based AI development submodel, an automation
submodel (compute → task automation via scaling laws), and a
semi-endogenous growth submodel — each conceptually swappable. That
separation is a useful organizing principle for our own equation library
even with no code to import. Davidson's report is worth mining for its
named parameter list (effective FLOP gap, software vs. hardware progress
rates) as a checklist for an AI-takeoff submodel. Korinek & Suh's
task-complexity decomposition is a finer-grained alternative to our current
single `displacementRate` constant, worth considering if we ever want
task-level labor displacement. Anthropic's 2026 explorer is the closest in
spirit (AI adoption → task automation → economic/wellbeing outcome) and
worth reading for scenario taxonomy, but confirms our assumption: no code.

**Verdict across all five: ignore for code (none exists); borrow equations
and framing from the papers as hand-transcribed starting templates.**

---

## 5. Integrated Assessment Models: DICE as a schema analogy

**DICE** (Dynamic Integrated Climate-Economy, Nordhaus) — unlike the
AI-economics models, has **multiple independently published open-source
ports** (originally GAMS/Excel), e.g.
[hazem2410/PyDICE](https://github.com/hazem2410/PyDICE),
[domokane/DicePy](https://github.com/domokane/DicePy),
[sylvaticus/DICEModel.jl](https://github.com/sylvaticus/DICEModel.jl), plus
an official Nordhaus-endorsed 2023 Python port in progress
([Welch & Nie](https://ivo-welch.info/research/dice)). Permissively
licensed, small academic repos, but cross-validated by multiple independent
implementations.

DICE cleanly separates three layers worth copying directly:

1. **Constants/parameters** — named, calibrated scalars (time preference,
   growth rates, climate sensitivity, damage/abatement coefficients),
   versioned independently of the equations using them.
2. **Structural equations** — Cobb-Douglas production, a capital-
   accumulation difference equation, quadratic damage function, power-law
   abatement cost, carbon-cycle transfer — each referencing named
   parameters and named lagged state (capital at t-1), the same
   lagged-reference + integration pattern we've specified.
3. **Scenario/policy variables** — `MIU` (emission-reduction rate) and `S`
   (savings rate) are **time-indexed control vectors with bounds**, not
   hardcoded constants; scenarios differ by which bounds/trajectories are
   fixed vs. optimized (e.g. an `ifopt` flag), not by branching the
   equations. Notably DICE has **no hardcoded named presets** — scenarios
   emerge from setting different bounds on the same control vectors.

**Lesson**: keep parameters / equations / scenario-overrides as three
distinct, independently versionable layers, and make a "scenario" a
**diff/override on top of the base graph**, not a copied model. This
matches Tax-Calculator's reform-as-overlay pattern (§3) independently — two
unrelated traditions (climate-economy IAMs, tax microsimulation) converging
on the same answer is a strong signal it's correct.

**Verdict: adopt the structural pattern, ignore the actual code** (domain-
specific Python/Julia, not runnable for us).

---

## 6. Causal graphs with dynamics: DBNs, CLDs, and log-odds combination

**Dynamic Bayesian Networks** unroll a standard BN across time slices, with
edges from a variable at *t* to itself/others at *t+1* — formally our
"lagged reference" idea, implemented as replicated static slices rather
than continuous integration. JS options:
[bayesjs](https://github.com/bayesjs/bayesjs) (MIT, TS, junction-
tree/variable-elimination inference, has a React editor) and
[jsbayes](https://github.com/vangj/jsbayes) (JS) — both **static BNs only**,
no temporal extension; `bayes-server` claims DBN support but is commercial,
not open. **Verdict: borrow ideas (TS API shape, editor UX), don't adopt** —
these are discrete conditional-probability-table engines, a mismatch for
our continuous, mathjs-based variables.

**Causal Loop Diagrams (CLD)** are a visualization convention (signed +/−
edges for reinforcing/balancing loops), not a computable model on their
own — SD tools execute the underlying stock-flow model; CLDs are the sketch
layer. No dedicated mature JS library exists; Mermaid has an open,
unresolved [CLD feature request](https://github.com/mermaid-js/mermaid/issues/4453).
**Verdict: borrow the signed-edge visual convention; ignore as a
dependency** — nothing turnkey exists, build our own renderer on a generic
graph-layout library.

**Does our "log-odds combination" have an established name? Yes.**
**Noisy-OR** (Pearl) is the classical way to combine multiple binary causes
into one binary effect with linear (not exponential) parameter count under
a "causal independence" assumption — and is mathematically a special case
of a **logistic function of weighted parent log-odds**
([arXiv:1301.6727](https://arxiv.org/pdf/1301.6727)). **Structural Causal
Models** (Pearl) generalize this: each variable is a function of its
parents plus exogenous noise, and a "logistic SCM" is simply an SCM whose
structural function is a sigmoid of a weighted linear combination of parent
values — standard practice in applied causal/statistical modeling. Log-odds
combination is just the GLM logit link, a decades-old named technique, not
a novel invention. **Verdict: adopt the terminology, not code** — describe
our combination rule explicitly as "noisy-OR-style / logistic SCM" in docs
and in any LLM-facing prompt, so the correct functional form (sigmoid of
weighted log-odds sum) gets reached for instead of an ad hoc formula.

---

## 7. Community forecasting platforms and aggregation

**Metaculus** — methodology described, not open-sourced. "Community
Prediction" is a **recency-weighted median**; the deprecated "Metaculus
Prediction" added performance-weighting and extremizing. No repo publishes
the exact algorithm (only a third-party bot-helper,
[forecasting-tools](https://github.com/Metaculus/forecasting-tools), exists).
**Verdict: borrow ideas only** — recency-weighted median + extremizing as a
recipe, no code to adopt.

**Manifold Markets** — **fully open source, MIT, TypeScript/Next.js**
monorepo (~17k+ commits, very active). Probability from a CPMM-variant AMM
("Maniswap", `k = y^p · n^(1-p)`) allowing non-50/50 seeded odds.
**Verdict: worth a closer code read** — rare case of MIT-licensed TS we can
legally inspect/adapt — but a full prediction-market AMM is likely overkill
versus simpler log-odds pooling for our expert/public tiers; treat as a
reference, not something to adopt now.
([repo](https://github.com/manifoldmarkets/manifold))

**Log-odds pooling / extremizing — the key prior art.** Satopää, Baron,
Foster, Mellers, Tetlock & Ungar, "Combining multiple probability
predictions using a simple logit model,"
[*International Journal of Forecasting*](https://www.sciencedirect.com/science/article/abs/pii/S0169207013001635).
Method: convert each forecaster's probability to log-odds, take a
(weighted) geometric mean of the odds (= average of log-odds), then apply a
single tunable **extremizing exponent** pushing the pooled estimate further
toward 0/1 than a naive probability-space average would — correcting for
forecasters sharing overlapping information (elaborated in
[arXiv:1501.06943](https://arxiv.org/pdf/1501.06943)). Validated on Good
Judgment Project data (1300+ forecasters, 69 events); the direct ancestor of
Metaculus's own extremizing step. **Verdict: adopt directly.** Precisely the
mechanism for merging expert-tier and public-tier probability inputs at a
node — a few lines of mathjs, not a library dependency.

---

## Ranked recommendation

1. **Build our own JSON/TS-native schema — don't adopt XMILE, PySD, PolicyEngine, OpenFisca, or any Bayesian-network library wholesale.** None fits our stack (Python/XML/AGPL) or our lay-user/LLM-editability requirement as well as a purpose-built JSON schema on mathjs would.
2. **Evaluate embedding `@quri/squiggle-lang`** (TS, npm, built-in Monte Carlo) as the distribution/uncertainty sub-language for parameter ranges — verify licence first — instead of reinventing distribution sampling.
3. **Copy the three-layer separation DICE (climate-economy) and Tax-Calculator/OpenFisca (tax microsimulation) converged on independently**: parameters (calibrated, time-indexed, sourced) / equations (reference named parameters + lagged state) / scenarios-interventions (time-indexed overrides with bounds, as a diff against baseline).
4. **Adopt the log-odds/logistic-SCM framing and the Satopää et al. extremizing formula** for combining expert-tier and public-tier estimates — a validated formula, not a library.
5. **Vendor simlin (Apache-2.0, Rust/WASM) later as an optional XMILE/Vensim import bridge**, not as our core engine, for interoperability with legacy SD tools.
6. **Treat AI-economics models (GATE, Davidson, Erdil, Korinek-Suh, Anthropic's explorer) as equation/framing references only** — none has public code — mining their compute→automation→growth and task-based decomposition patterns as hand-transcribed starting templates.

---

## Proposed minimal model file format

No surveyed format should be adopted wholesale. This synthesizes the
strongest ideas above — XMILE's typed stock/flow/aux + sim_specs, Insight
Maker's flexible ModelJSON, DICE's parameter/equation/scenario separation,
Tax-Calculator's overlay-as-diff scenarios, and Squiggle-style distribution
literals:

```json
{
  "modelVersion": "1.0",
  "simSpecs": { "start": 0, "stop": 120, "dt": 1, "timeUnit": "month", "integration": "euler" },
  "nodes": [
    {
      "id": "aiAdoption",
      "kind": "stock",
      "unit": "fraction",
      "initial": 0.05,
      "inflow": "aiAdoption * aiGrowthRate * (1 - aiAdoption)"
    },
    {
      "id": "aiGrowthRate",
      "kind": "parameter",
      "value": { "dist": "to", "args": [0.04, 0.15] },
      "source": "Epoch AI compute growth estimates, 2025",
      "unit": "1/month"
    },
    {
      "id": "wellbeing",
      "kind": "equation",
      "expr": "gdpWellbeing + ubiBoost - displacementFriction",
      "dependsOn": ["gdpWellbeing", "ubiBoost", "displacementFriction"]
    },
    { "id": "contributionRate_lag1", "kind": "laggedRef", "of": "contributionRate", "lag": 1 },
    {
      "id": "corpDefects",
      "kind": "probability",
      "combine": "logisticSCM",
      "parents": [
        { "of": "demandCollapseRisk", "weight": 1.2 },
        { "of": "reputationPressure", "weight": -0.8 }
      ],
      "extremize": 1.0
    }
  ],
  "dataBindings": [
    { "nodeId": "wellbeing", "source": "worldbank:SI.POV.GINI", "country": "US", "purpose": "backtest" }
  ],
  "scenarios": [
    {
      "id": "raceToBottom",
      "baseline": "default",
      "overrides": [
        { "nodeId": "contributionRate", "from": 6, "to": 24, "value": 0.06, "bound": [0.0, 0.5] }
      ]
    }
  ]
}
```

Design choices, each traceable to a section above:

- **`kind: stock | equation | parameter | exogenous | laggedRef | probability`** on every node — XMILE's typing (§1) flattened into one discriminated union instead of XML elements, so an LLM fills in one shape.
- **`value: { dist, args }`** — a minimal Squiggle-inspired distribution literal (§2) rather than embedding the full runtime, unless bundle-size tolerance later favors embedding `@quri/squiggle-lang` directly.
- **`source` required on every parameter** — matches how DICE and OpenFisca both insist calibrated values are traceable (§3, §5).
- **`laggedRef` as explicit graph nodes**, not hidden syntax — visible/diffable in the UI, same reason DBNs unroll time into explicit slices (§6).
- **`combine: "logisticSCM"` + `extremize`** on probability nodes — implements the noisy-OR/logistic-SCM framing (§6) and Satopää et al. extremizing (§7) by name, so both a lay user and an LLM reach for the validated form.
- **`dataBindings`** as a separate top-level array — decouples backtesting sources from causal structure, so one model backtests against different data without touching equations.
- **`scenarios[].overrides`** as time-indexed diffs against a named baseline — copies DICE's control-vector pattern and Tax-Calculator's JSON reform overlays, independently converged on (§3, §5); this is our "time-profiled interventions."

Intentionally not a full adoption of any framework surveyed — a purpose-
built minimal schema, JSON for LLM-friendliness, TS-native, extensible to
embed Squiggle distributions and/or a simlin-based XMILE importer later
without a breaking change.

# Wellbeing Transition Simulator — Unified Core Specification, v1 (for review)

Date: 2026-09-12. Status: DESIGN, nothing implemented. This document is self-contained; the
appendices carry the supporting research so a reviewer needs nothing else.

---

## 0. Instructions for the reviewing model

You are reviewing a design specification before any code is written. The authors want you to
find what is wrong, missing, gameable, or over-engineered. Do not summarise the document back.

Answer these six questions, each with concrete examples drawn from the text, ranked by severity:

1. **Expressiveness.** Which of the eight target models in section 9 will the schema in section 4
   fail to express, and what minimal change fixes it? Try to write two of them in the schema in
   your head.
2. **Engine semantics.** Where is the evaluation order in section 5 ambiguous or wrong
   (simultaneity, lags, entities, Monte Carlo, determinism)?
3. **Validation.** How could the validation harness in section 8 be gamed by a well-meaning
   modeller, and does the discipline described actually prevent it?
4. **Simplicity.** Where does the design make simple models harder than they need to be for a
   human or an LLM author? Show a three-variable model written in this schema and say what is
   noise.
5. **Honesty.** Where would the site imply more certainty or more validation than it has? Point at
   specific outputs.
6. **Sequencing.** Is the migration plan in section 12 in the right order, and what would you cut
   from the first release?

Then list up to five things the spec gets right that should not be lost in revision. Output in
markdown with headings per question. Be specific and blunt; vague praise is unhelpful.

---

## 1. Purpose and the bar

The site simulates the transition from a labour economy to an AI-driven one and its effect on human
wellbeing, country by country, including paths that are not economic (governance, catastrophe).
Today it has two disconnected engines (section 2). This spec replaces both with one core.

The bar, in the owner's words:

- **Not a toy.** Rerunnable on past data and scored. Where a claim can be checked, it is checked;
  where it cannot, the site says so.
- **Nimble.** A person or an AI can add a new variable, say how it affects existing ones with
  sourced coefficients, and run it. Simple models stay simple: a three-variable model is a valid
  model, everything else defaults to zero.
- **Interventions that behave.** Costly now and rewarding later; conditional on each other;
  applied to one actor or mirrored across actors with different structure.
- **Killer-app clarity.** One primary screen. Everything advanced behind progressive disclosure.
- **No friction to host.** Runs as a static site; models are files in the repo.

## 2. What exists and why it is replaced

- **Country simulator** (`simulation/pure.ts`): month-by-month, 128 countries, 80 corporations,
  five hardcoded phases, real feedback (poor customers cut corporate revenue). Uploadable models
  replace exactly five formulas. Structure cannot be extended.
- **Futures map** (`src/futures/`): an editable influence graph of about 20 event nodes in
  log-odds feeding five exclusive world-states, with interventions as additive nudges. No state,
  no dynamics, interventions cannot interact.
- **Also present and kept:** an opt-in macro block that reproduces the three 2030 scenarios of
  Korinek, Jones, Sacher, Cotter and McCrory (2026); a hindcast harness (2015 to 2025, 106
  countries, wellbeing correlation 0.485 with AI off); Firebase-backed expert and public voting
  tiers; a Gemini extraction step that turns pasted policy text into a structured intervention.

Neither engine can host the other's ideas. The core below can host both.

## 3. Core concepts

A **model** is a JSON file containing:

| Element | What it is |
|---|---|
| `parameters` | Named constants with a unit, a point value, an optional uncertainty range, and a **required source**. Sampled once per Monte Carlo run. |
| `inputs` | Exogenous time series: a sparse curve of year to value, interpolated. The scenario knobs (e.g. AI adoption path). |
| `variables` | Things computed each step: either a plain **equation**, a **stock** (equation may reference its own previous value), or a **probability** node combined by a logistic structural causal model from its parents. |
| `entities` | Optional dimension: countries, states, actors. Any parameter or input may be overridden per entity. Roles map abstract actors ("largest chip manufacturer") to entities by rule. |
| `interventions` | Overlays: time-profiled changes to parameters or inputs, with optional conditions, a cost profile, and the roles they act on. |
| `bindings` | Links from a variable to a real data series, used for hindcasting and validation. |
| `tests` | Assertions the model must satisfy ("reproduces Table 3 of the paper within 2%"). |

Two rules make it composable:

1. **A new element may only touch existing ones through explicit, sourced coefficients.** It never
   rewrites an existing equation. Authors extend by adding, reviewers read the diff.
2. **Scenarios, entity differences, and interventions are all the same mechanism: an overlay.** A
   base model plus a stack of overlays. Nothing is copied.

Time is discrete (month or year). Lags are written inline (`unemployment[t-1]`) and drawn as
explicit edges in the editor. This is a dynamic Bayesian network in substance: the causal graph
copied once per step with arrows allowed to cross steps, plus continuous variables and logistic
combination for the probability nodes.

## 4. Schema v1 (draft)

```json
{
  "schemaVersion": 1,
  "id": "korinek-2026",
  "name": "Economic Scenarios for Transformative AI (Korinek et al. 2026)",
  "license": "CC-BY-4.0 transcription of published equations",
  "sources": [{ "label": "Anthropic Institute WP 2026-02", "url": "https://www.anthropic.com/institute/econ-scenarios" }],
  "time": { "start": "2026-06", "end": "2030-12", "step": "month" },

  "entities": {
    "kind": "country",
    "ids": ["USA"],
    "roles": { "home": "USA" }
  },

  "parameters": [
    { "id": "cognitiveShare", "value": 0.624, "unit": "share",
      "source": { "label": "Korinek et al. 2026, Table 1" } },
    { "id": "productivityGain", "value": 1.13, "unit": "",
      "range": { "dist": "lognormal", "p5": 0.8, "p95": 1.6 },
      "source": { "label": "calibrated to GDP targets, this repo", "kind": "calibration" } },
    { "id": "reemploymentMonths", "value": 18, "unit": "month",
      "source": { "label": "Korinek et al. 2026, extreme scenario mu = 0.04/month" } }
  ],

  "inputs": [
    { "id": "aiAdoption", "unit": "share",
      "curve": { "2026-06": 0.01, "2030-12": 0.45 }, "interp": "logistic" }
  ],

  "variables": [
    { "id": "affected", "equation": "aiAdoption * cognitiveShare", "unit": "share" },
    { "id": "gdpNoAi", "kind": "stock", "initial": 63000, "unit": "usd",
      "equation": "gdpNoAi[t-1] * (1 + baselineGrowth) ^ (1/12)" },
    { "id": "gdp", "equation": "gdpNoAi * (1 + productivityGain * affected)", "unit": "usd",
      "bind": { "source": "worldbank", "series": "NY.GDP.PCAP.KD" } },
    { "id": "displaced", "kind": "stock", "initial": 0, "unit": "share",
      "equation": "displaced[t-1] * (1 - 1/reemploymentMonths) + max(0, aiAdoption - aiAdoption[t-1]) * cognitiveShare * automationShare" },
    { "id": "misalignedTakeover", "kind": "probability", "unit": "probability",
      "base": { "2028": 0.005, "2030": 0.02, "2035": 0.06, "2045": 0.09 },
      "parents": [
        { "of": "alignmentAdequate", "weight": -0.8, "lag": 0, "note": "prevents" },
        { "of": "agi", "weight": 0.8, "lag": 1, "note": "requires", "requires": true }
      ] }
  ],

  "outputs": ["gdp", "laborShare", "unemployment", "cognitiveUnemployment"],

  "interventions": [
    { "id": "ai-dividend", "label": "AI dividend fund",
      "roles": ["home"],
      "overrides": [
        { "target": "inputs.redistribution", "mode": "add",
          "profile": { "2028": 0.05, "2032": 0.25 },
          "when": "aiAdoption > 0.2" }
      ],
      "cost": { "unit": "share_of_gdp", "profile": { "2028": 0.01, "2032": 0.04 } } }
  ],

  "tests": [
    { "name": "extreme scenario: GDP +32.4% by 2030 (paper Table 3)",
      "at": "2030-12", "entity": "USA", "expr": "gdp / gdpNoAi - 1", "expected": 0.324, "tol": 0.02 }
  ]
}
```

Schema decisions and their reasons:

- **One discriminated shape per element.** An author fills in one object kind; an LLM cannot
  produce an invalid mixture. (Borrowed from XMILE's typing, flattened.)
- **Expression language is the existing mathjs subset** plus `x[t-k]` for lags, `t` and `year`,
  `logit`, `sigmoid`, `clamp`, and aggregates over entities (`sum(gdp * population)`). No user-defined
  functions in v1.
- **Uncertainty literal** `{ dist, p5, p95 }` with `lognormal`, `normal`, `uniform`. Sampled with
  d3-random. (Squiggle was evaluated and declined: MIT-licensed and capable, but a whole language
  with a stale release cadence for what is "parse a range and sample it". Appendix B4.)
- **`source` is required on every parameter.** A parameter without a source is a validation error.
  A `kind: "calibration"` source is allowed but is displayed differently.
- **Probability nodes use a logistic structural causal model:** `P = sigmoid(logit(base) + Σ w_i ·
  Δlogit(parent_i))`, deviation-based so the base curve is reproduced exactly when nothing is
  nudged. `requires: true` clamps the child at or below the parent. This is the current futures
  engine, unchanged, now as one node kind among others.
- **Entities and roles.** `entities.ids` instantiates the model per entity; `parameters[].byEntity`
  and `inputs[].byEntity` override values. A role is either an explicit entity id or a rule
  expression (`argmax(chipManufacturingShare)`) evaluated at start. Interventions name roles, never
  entities, so the same intervention can be mirrored onto another actor.
- **Overrides are the only mutation.** `mode` is `set`, `add`, or `multiply`; `profile` is a sparse
  time curve; `when` is an expression evaluated each step, which is how one intervention can depend
  on another ("when dividendActive and aiAdoption > 0.3").
- **Bindings** are declared on the variable but resolved outside the model, so one model can be
  backtested against different data sources without editing equations.
- **Tests live in the model file.** They are the reproduction claim and run in CI.

## 5. Engine semantics

1. **Load.** Validate against the JSON schema, then structurally: every referenced id exists, every
   parameter has a source, no zero-lag cycle among variables, units match on both sides of `set`
   overrides, every `requires` parent is a probability node.
2. **Instantiate.** For each entity, resolve parameters (base, then `byEntity`, then scenario
   overlays, then intervention overrides that are unconditional and untimed). Resolve roles.
3. **Sample.** For each Monte Carlo run `r` of `N`, draw every ranged parameter once from its
   distribution using a seeded generator (`seed + r`). Runs are independent and reproducible.
4. **Step.** For each time `t` from start to end: evaluate inputs at `t` by interpolation
   (`linear`, `logodds` for probabilities, `logistic` for adoption-style curves); apply time-profiled
   and conditional overrides whose `when` is true at `t-1` state; evaluate variables in topological
   order over zero-lag dependencies, with `x[t-k]` reading frozen earlier steps; stocks read their own
   `[t-1]`; probability nodes combine parents' *deviations* from their own base; aggregates over
   entities are evaluated after all entities' zero-lag variables at that step. A zero-lag cycle is a
   load-time error, so there is no solver.
5. **Report.** Per output, per entity, per time: median and 5/25/75/95 percentiles across runs. Per
   probability node: the same. Per intervention: mean shift, floor lift, ceiling lift on any
   declared goodness axis, and cumulative cost from the cost profile.
6. **Performance target.** 30 variables, 5 entities, 240 monthly steps, 500 runs in under one
   second in the browser. The current engines are far inside this.
7. **Determinism.** Same model, same seed, same overlays, same numbers, bit for bit.

Open question for reviewers: whether to allow a within-step fixed-point solve for models that
genuinely need simultaneity (Korinek's labour market clears within a period). The current position
is no: authors add a one-step lag, and the spec says so in the authoring guide.

## 6. Interventions

An intervention is a named set of overrides plus metadata:

- **Time profile** on every override, so "expensive for five years, rewarding from year ten" is
  two curves, cost and effect, and the site can show benefit minus cost over time.
- **Conditions** (`when`) evaluated each step against the live state, which gives dependence on
  other interventions, thresholds, and diminishing returns without special machinery.
- **Roles, not countries.** The mirror mechanic runs the same intervention with the role bound to a
  different entity. The asymmetry comes from the entities' own parameters (manufacturing base,
  cognitive share, governance), not from the intervention.
- **Cost** as a time profile in a declared unit (share of GDP or currency). Cost bands from the
  current futures map become the coarse fallback when no profile is known.
- **Provenance.** `source` (bill text, paper, editorial), `status` (ai-drafted, reviewed, locked),
  and the quoted evidence per override, as now.

The Gemini extraction step is unchanged in spirit: it may only pick existing ids, coarse magnitudes,
and must quote evidence. Its output is an overlay file that a human reviews.

## 7. Community tiers

People vote on **parameters and inputs**, never on outputs. A vote is a distribution (p5, p95) or a
curve for an input, tagged with tier, time, and the model and parameter version. Pooling is in
log-odds for probabilities and in log space for positive quantities, using the Satopää et al.
logit-pooling formula with an extremising exponent held at 1.0 until there is scored history.
Locked, expert, and public tiers are three overlays on the same base model, so any view can show
"seed versus experts versus public" for any parameter and for any output that depends on it.

Reputation from calibration is logged from day one and displayed only when a user has fifty
resolved items. No upvote leaderboards, no participation points.

## 8. Validation library

A **validation case** is a structured file:

```yaml
id: alaska-pfd-1982
intervention: { type: universal_cash_transfer, region: US-AK, start: 1982-01 }
comparison: { design: synthetic_control, source_study: "Jones & Marinescu 2022 AEJ:EP", donor_pool: "other US states" }
outcomes:
  - { variable: employmentRate, effect: 0.0, ci95: [-0.5, 0.5], unit: pp }
  - { variable: partTimeShare, effect: 1.8, ci95: [0.9, 2.7], unit: pp }
data: [{ source: BLS-CPS, series: [...] }, { source: "Alaska PFD Division", url: "..." }]
mapping:            # pre-registered: how the case is expressed in the model
  model: country-simulator
  overlays: [{ target: inputs.cashTransferPerCapita, profile: { "1982": 1000, ... } }]
confidence: high
held_out: false
```

Scoring: a point outcome passes if the model's median falls inside the union of its own 5 to 95
band and the study's 95% interval; the normalised error `(predicted - measured) / se` is published
per case. Directional claims get Brier scores. Every scored run is pinned to a model version and a
commit; scores are immutable; a held-out subset of cases is never used for tuning; failures are
published with the passes; the mapping is written before the outcome is looked at.

First cases, in order: Alaska Permanent Fund Dividend; the 138-episode state minimum-wage panel
(Cengiz et al. 2019); Finland basic income 2017-18; Oregon Medicaid lottery 2008; the 2021 expanded
Child Tax Credit; Kansas 2012 tax cuts. California additions once the harness exists: Stockton SEED,
Los Angeles BIG:LEAP, Compton Pledge, harvested from the Stanford Basic Income Lab map. New studies
enter through the same intake as bills: an agent drafts the case file from the paper, a human
reviews, it lands as a pull request; one sweep a year.

Statistics that need difference-in-differences or synthetic control run in a Python sidecar in CI
only, never in the browser. The first cases need none of that: the published estimate already
exists and the model only has to reproduce it.

Honesty rule: every output on the site carries one of three tags, interpolation within validated
range, extrapolation along a validated mechanism, or unvalidated mechanism. The corporate
voluntary-contribution game theory is in the third category by construction and is labelled so.

## 9. Target models: the conformance suite

The schema is accepted only when all of these load, run, and pass their own `tests` in CI. Each is
also a "Start from" entry in the model gallery (read-only; edits are overlays).

Inclusion criterion: open code first; otherwise a paper with a complete parameter table and
published outputs to reproduce; otherwise excluded. Recent, active authors preferred, because a
faithful open reproduction is the artefact most likely to get a reply, a citation, or a correction.

| # | Model | Why it is here | Door |
|---|---|---|---|
| 1 | Korinek, Jones, Sacher, Cotter, McCrory 2026 | The reference AI-economy model; already reproduced in the macro block | paper, complete parameters and outputs |
| 2 | Epoch AI GATE (2025) | Compute to automation to growth; different mechanism from 1 | paper; playground to check outputs |
| 3 | The current country simulator, five phases as one model per country | Continuity; demand feedback and transfer game theory | open code (this repo) |
| 4 | The current futures graph | Continuity; probability nodes and goodness axis | open code (this repo) |
| 5 | Minimal three-variable model | Proves simple stays simple | authored here |
| 6 | Model 5 plus one invented variable touching income and wellbeing with two sourced coefficients | The owner's extension test | authored here |
| 7 | Historical hindcast, 2015 to 2025, GDP and ladder score bound to data | Proves bindings and scoring | data: World Bank, WHR |
| 8 | Two interventions together, one lagged, one conditional on the other, run under two state overlays | Proves interventions and mirror | authored here |

Candidates for later: a 2024 or 2025 cash-transfer RCT expressed as a model; Davidson's takeoff
model (Epoch's interactive companion gives outputs to check).

## 10. Data, wellbeing, and units

- **Wellbeing equation.** The World Happiness Report six-factor regression becomes a named model
  with published coefficients (log GDP 0.349, social support 2.563, healthy life expectancy 0.028,
  freedom 1.378, generosity 0.487, corruption −0.733) and its critiques in the model notes. Four of
  six inputs exist for every country, so it covers countries Gallup does not poll. It replaces the
  anchor fitted in this repo.
- **Elasticities as parameters with sources:** income about 0.3 ladder points per doubling;
  unemployment about −0.22 standard deviations, persistent, as a separate scarring term; inequality
  negative, opportunity-moderated; cash transfers +0.17 to +0.26 standard deviations with no negative
  labour-supply effect in Finland, Stockton, and Kenya. The last is a testable claim the current
  game-theory module contradicts by assumption.
- **WELLBYs** as a second output unit: one ladder point for one person for one year, priced at the
  UK Treasury's £13,000 (2019), configurable.
- **Social Progress Index** (Porter and Stern) as the income-free driver layer, via the Quality of
  Government Institute mirror.
- **Data bindings available at launch:** World Bank (GDP per capita, unemployment, Gini), WHR panel,
  FRED, BLS, Census, BEA for US state series, OECD SDMX for OECD countries. State-level wellbeing is
  thin (CDC question irregular, Gallup paywalled) and is scored with wider bands.

## 11. Product and UX principles

1. **One primary screen:** the goodness chart with time on x, the model gallery as the way in, and
   the year scrubber. Everything else is progressive disclosure: hamburger and section menus, details
   expanders, an "advanced" switch for the equation editor.
2. **Every number is traceable in two taps** to a source, a parameter range, or a validation score.
3. **First-release mechanics** (from Appendix C): predict-then-reveal on validation cases; direct
   manipulation of curves and arrow strengths on touch, clamped to sourced ranges, with a
   sensitivity heatmap; mirror; fork a published model with a provenance receipt on anything shared.
4. **Deliberately absent:** upvote leaderboards, points for participation, win states, gestures
   that do not map to a quantity, and any reputation display before fifty resolved items.
5. **Hosting:** static site; models and validation cases are files in the repo; CI runs tests, the
   conformance suite, the validation library and its Python sidecar; Firebase holds votes and
   community overlays. The site works fully with Firebase absent.

## 12. Migration plan

| Phase | Delivers | Accepted when |
|---|---|---|
| A. Core | Schema, validator, engine, uncertainty sampler, overlay resolver, tests | Target models 5, 6, 8 pass their tests; performance target met |
| B. Ports | Models 1, 3, 4 transcribed; the Futures and Map tabs read from the core | Models 1, 3, 4 pass; the current anchor tests, Korinek tests, and futures golden file reproduce within tolerance |
| C. Data | Bindings, hindcast on the core, WHR equation, WELLBYs, SPI layer; model 7 | Hindcast score equals or beats today's (r 0.485, MAE 0.45 ladder) |
| D. Validation | Case schema, six cases, scoring, CI, held-out set, honesty tags in the UI | Scores published per case, failures included |
| E. Product | Gallery, fork with receipts, predict-then-reveal, direct manipulation, mirror | Usable on a 390px phone without horizontal scroll; every number traceable in two taps |
| F. Community | Votes on parameters, pooling, tiers as overlays | Expert overlay visible on a parameter and on a dependent output |

Phase A is the design risk; everything after it is porting. The existing site stays live throughout.

## 13. Risks and open questions

- **Simultaneity.** Some published models clear markets within a period. Position: lag by one step
  and document; revisit if a target model cannot pass its test that way.
- **Expression language creep.** mathjs is powerful; the allowed subset must be enforced, or models
  become unreadable and unsafe to run from strangers.
- **False precision.** Monte Carlo bands look authoritative. Bands reflect only declared parameter
  ranges, never structural uncertainty; the UI must say so.
- **Validation gaming.** Pre-registration and held-out cases are process, not code. They fail if
  one person holds all the keys. Publishing everything is the real defence.
- **Wellbeing data at state level.** Thin. Income and employment claims will be stronger than
  wellbeing claims for US states, and the UI has to reflect that difference.
- **Scope.** The temptation is to build phase E before phase D. The order matters: mechanics on top
  of unvalidated numbers is the toy the owner does not want.

---

## Appendix A. Two small models in the schema

### A1. Minimal three-variable model (target model 5)

```json
{
  "schemaVersion": 1, "id": "minimal", "name": "Minimal",
  "time": { "start": "2026", "end": "2045", "step": "year" },
  "parameters": [
    { "id": "growth", "value": 0.02, "unit": "1/year", "range": { "dist": "normal", "p5": 0.0, "p95": 0.04 },
      "source": { "label": "World Bank long-run average, advanced economies" } },
    { "id": "incomeElasticity", "value": 0.35, "unit": "ladder_points_per_log_income",
      "source": { "label": "WHR 2024 Table 2.1 log-GDP coefficient" } }
  ],
  "variables": [
    { "id": "income", "kind": "stock", "initial": 50000, "unit": "usd", "equation": "income[t-1] * (1 + growth)" },
    { "id": "wellbeing", "unit": "ladder", "equation": "6.5 + incomeElasticity * log(income / 50000)" }
  ],
  "outputs": ["income", "wellbeing"]
}
```

### A2. Model 5 plus one invented variable (target model 6)

Adds an overlay file; the base is untouched.

```json
{
  "schemaVersion": 1, "id": "minimal-plus-tutoring", "extends": "minimal",
  "inputs": [
    { "id": "aiTutoringAccess", "unit": "share", "curve": { "2026": 0.0, "2035": 0.6 }, "interp": "logistic" }
  ],
  "parameters": [
    { "id": "tutoringIncomeEffect", "value": 0.04, "unit": "share", "range": { "dist": "lognormal", "p5": 0.01, "p95": 0.10 },
      "source": { "label": "author guess", "kind": "guess" } },
    { "id": "tutoringWellbeingEffect", "value": 0.12, "unit": "ladder", "source": { "label": "author guess", "kind": "guess" } }
  ],
  "variables": [
    { "id": "income", "equation": "income[t-1] * (1 + growth) * (1 + tutoringIncomeEffect * (aiTutoringAccess - aiTutoringAccess[t-1]))" },
    { "id": "wellbeing", "equation": "6.5 + incomeElasticity * log(income / 50000) + tutoringWellbeingEffect * aiTutoringAccess" }
  ]
}
```

Open question for reviewers: A2 rewrites two equations, which breaks rule 1 of section 3 ("only
touch existing ones through explicit coefficients"). The alternative is an `effects` element that
adds additive or multiplicative terms to a named variable without restating its equation. Which is
better for a lay author and for an LLM?

---

## Appendix B. Research reports (verbatim, 2026-09-12)

(Concatenated below: B1 wellbeing measurement, B2 modelling frameworks and standards, B3 policy
validation, B4 Squiggle evaluation.)

## Appendix C. Gamification note (verbatim)

## Appendix D. Decision log

- Log-odds influence graph kept as the probability node kind; deviation-based so seeds reproduce.
- Cycles allowed only across a lag; no solver (open question in section 5).
- Squiggle declined; home-grown distribution literal.
- Entities and roles added so interventions mirror across actors.
- Validation library before product mechanics.
- Static hosting with Firebase for votes; Python only in CI.

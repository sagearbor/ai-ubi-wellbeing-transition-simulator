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

---

### B1. Wellbeing measurement frameworks

### Wellbeing Measurement Frameworks — Research Report

**Purpose:** identify established wellbeing frameworks the simulator could adopt or add, beyond the World Happiness Report (WHR) Cantril ladder we currently hindcast against, with an eye to (a) data we can actually download and bind to per country/year, and (b) equations/elasticities we can drop directly into `simulation/pure.ts` as parameters.

**Scope note:** the simulator needs a single 0–100 scoreable number per country *plus* decomposable drivers (income, employment, inequality, transfers). That constraint eliminates frameworks that are qualitative, non-country-comparable, or have no reusable regression structure, no matter how conceptually rich they are.

##### Quick-reference comparison

| # | Framework | Countries | Years | Bulk download | Licence | Verdict |
|---|---|---|---|---|---|---|
| 1 | Bhutan GNH Index | 1 (Bhutan) | 2007/08, 2010, 2015, 2022 | PDF report only, no API | Government/OPHI publication, free to read; no stated open-data licence | Reference only — not adoptable as data |
| 2 | OECD Better Life Index / How's Life? | ~38 OECD + accession/partner | 2004/05–present, biennial report | OECD Data Explorer, SDMX REST API, CSV/JSON | OECD Terms and Conditions (free reuse, attribution) | Adopt for OECD-country cross-check |
| 3 | WHR / Cantril ladder (in use) | 140–160+ | 2005–present (full panel from 2019) | XLSX/CSV at worldhappiness.report/data-sharing; OWID mirror | WHR: free for research/attribution use; OWID mirror: CC BY | Keep as backbone |
| 4 | WELLBYs | N/A (a unit, not a survey) | N/A | N/A — applied to WHR/other life-satisfaction panels | Academic/HM Treasury public guidance, free to use | Adopt as second output unit |
| 5 | Social Progress Index | 170+ | 2011–present | Premium tier for bulk historical panel; free mirror via QoG Institute | Social Progress Imperative terms (site browsing free); QoG mirror academic use; EU-SPI variant CC BY 4.0 | Adopt as income-independent decomposition layer |
| 6 | HDI | ~193 | 1990–present | CSV/Excel bulk download, hdr.undp.org | UN open-data terms, free reuse with attribution | Cheap sanity-check column only |
| 6 | GPI | inconsistent (mostly US states + scattered academic global estimates) | inconsistent | No standardized global panel | Varies by source (mostly academic, no unified licence) | Not adoptable — no consistent panel |

---

#### 1. Bhutan Gross National Happiness (GNH) Index

**What it measures:** a multidimensional sufficiency index across 9 domains — psychological wellbeing, health, education, time use, cultural diversity & resilience, good governance, community vitality, ecological diversity & resilience, and living standards — built from 33 indicators and 124 variables.

**Construction:** the Centre for Bhutan and GNH Studies, with the Oxford Poverty and Human Development Initiative (OPHI), applies the **Alkire-Foster (AF) counting/sufficiency method** (the same family of methods behind the global Multidimensional Poverty Index). Each of the 33 indicators has a "sufficiency" cutoff; a person is counted as GNH-**happy** if they are sufficient in ≥66% of the (weighted) indicators. The national index blends the proportion of people who are happy with the intensity of sufficiency among those who are not-yet-happy — structurally identical to the M0 adjusted headcount ratio used in MPI.

**Coverage:** Bhutan only, four waves (2007/08, 2010, 2015, 2022). 2022 survey: ~11,525 respondents across all 20 dzongkhags; national GNH value 0.781 (up from 0.756 in 2015, 0.743 in 2010).

**Data availability:** the 2022 survey report (PDF, ~300pp) is downloadable from the Centre for Bhutan & GNH Studies (bhutanstudies.org.bt) and mirrored by OPHI. There is **no cross-country panel** — this is a single-nation instrument with no equivalent data collected anywhere else, so it cannot be hindcast or projected for other countries.

**Licence:** published as a government/OPHI research report; freely readable and citable, but there is no stated open-data licence, no machine-readable microdata release, and no API. Reuse would mean manually transcribing tables out of a PDF.

**Assessment:** **Not adoptable as data**, but the *domain structure and sufficiency-counting method* are worth stealing conceptually — it is the clearest example of a policy government actually uses to score multidimensional wellbeing with named domains and explicit weights. Useful as a design reference for how to define domain weights in the simulator's own wellbeing index documentation; not usable as an input series since it exists for exactly one country.

Sources: [OPHI — Gross National Happiness](https://ophi.org.uk/gross-national-happiness) · [OPHI — GNH 2022 report](https://ophi.org.uk/publications/Bhutan-GNH-2022) · [2022 GNH Survey Report (PDF)](https://bhutanstudies.org.bt/wp-content/uploads/2025/01/2022-GNH-Survey-Report_compressed-1.pdf) · [OECD — Bhutan's GNH Index](https://www.oecd.org/en/publications/well-being-knowledge-exchange-platform-kep_93d45d63-en/bhutan-s-gross-national-happiness-gnh-index_ff75e0a9-en.html) · [BhutanWiki — GNH methodology](https://www.bhutanwiki.org/articles/gnh-survey-methodology-and-limitations)

---

#### 2. OECD Better Life Index / How's Life?

**What it measures:** the OECD Well-being Framework covers **11 dimensions** of current material and quality-of-life conditions — housing, income, jobs, community, education, environment, civic engagement/governance, health, life satisfaction, safety, work-life balance — plus, in the *How's Life?* report series, additional indicators of inequality and of resources for *future* wellbeing (natural, economic, human, social capital). The interactive **Better Life Index** lets the public assign their own weights to the 11 dimensions; the underlying data does not impose a single official aggregate score (deliberately, to avoid a contested single number).

**Coverage:** the 38 OECD member countries plus accession/partner countries (Brazil, South Africa now included; Argentina, Bulgaria, Croatia, Indonesia, Peru, Romania being added). Time series generally from 2004/2005 onward, updated with each biennial *How's Life?* edition (latest: *How's Life? 2024*, 6th edition, 80+ indicators).

**Data availability:** all series are published on the **OECD Data Explorer** (`data-explorer.oecd.org`) under the "Society → Well-being and beyond GDP" topic, with a documented **SDMX-based REST API** (JSON/CSV/SDMX-ML output, query builder generates the API call directly from the UI). No registration required.

**Licence:** OECD data is free to reuse under the **OECD Terms and Conditions** for its statistical databases (attribution required; generally treated as CC BY 4.0-equivalent, though the exact clause should be re-checked per dataset since OECD licensing terms have varied slightly across products over time).

**Assessment:** **Worth adding** as a secondary validation/decomposition source for the ~38-50 countries it covers, specifically because (a) it has a genuine, versioned, queryable API rather than a static PDF, and (b) its dimensions map cleanly onto simulator concepts we already track (jobs/displacement, income, inequality-adjacent "resources for future wellbeing"). Its weakness for us is coverage — it excludes most of the Global South, where the AI/UBI transition story is arguably most consequential. Use as an **OECD-country cross-check**, not a global backbone.

Sources: [OECD Better Life Index](https://www.oecd.org/en/data/tools/oecd-better-life-index.html) · [OECD Well-being Data Monitor](https://www.oecd.org/en/data/tools/well-being-data-monitor.html) · [How's Life? 2024](https://www.oecd.org/en/publications/how-s-life-2024_90ba854a-en.html) · [OECD Data Explorer / API docs](https://www.oecd.org/en/data/insights/data-explainers/2024/09/api.html) · [OECD Better Life Index — Wikipedia](https://en.wikipedia.org/wiki/OECD_Better_Life_Index)

---

#### 3. World Happiness Report / Gallup Cantril Ladder (what we already use)

**What it measures:** the Cantril **Self-Anchoring Striving Scale** — "imagine a ladder with steps numbered 0 to 10, where 10 is the best possible life for you and 0 the worst; on which step do you feel you personally stand?" It is a single-item *life evaluation* (a cognitive/global judgment), not a momentary-affect measure.

**Coverage:** Gallup World Poll has run since 2005/2006 in 140–160+ countries and territories, with roughly 1,000 respondents per country per year via telephone or face-to-face interviews (nationally representative sampling, weighted). The WHR reports 3-year rolling averages (e.g., 2022–2024) to stabilize small annual samples. Full explanatory-variable panel is complete from 2019 onward; pre-2019 years have ladder scores and ranks only for some variables.

**Known critiques (worth stating honestly in-repo):**
- **Small per-country samples** (~1,000/year) rolled into multi-year averages — noisy for smaller or fast-changing countries, and RDD telephone sampling under-covers populations with poor phone/telecom infrastructure.
- **Single-item measure** — a global life evaluation captures a hedonic/status-linked judgment and is argued to miss eudaimonic dimensions (purpose, meaning, virtue).
- **Cultural response bias** — self-reported life evaluation may be shaped by individualist vs. collectivist norms around self-presentation, complicating cross-cultural comparability.
- **Correlational, not causal**, regression — the six-factor model (below) is explanatory/accounting, not identified causal effects; the WHR itself is explicit about this.

**The six-factor regression (directly reusable as a wellbeing equation):** the WHR fits, across the pooled country-year panel,
```
Ladder = β0 + β1·ln(GDP per capita) + β2·SocialSupport + β3·HealthyLifeExpectancy
              + β4·FreedomToMakeLifeChoices + β5·Generosity + β6·PerceptionsOfCorruption + ε
```
Reported coefficients (WHR Table 2.1, OLS with time and/or country effects; magnitudes are stable across recent report years, quoted from the widely-cited specification):

| Factor | Coefficient (β) | Sign/interpretation |
|---|---|---|
| Log GDP per capita | **0.349** | + (diminishing-returns income effect, already logged) |
| Social support (0–1, "someone to count on") | **2.563** | + (largest single driver — a 1-unit shift in the binary-support share moves the ladder ~2.6 points) |
| Healthy life expectancy at birth (years) | **0.028** | + (small per-year coefficient, but life-expectancy ranges span ~30 years across countries → large aggregate contribution) |
| Freedom to make life choices (0–1) | **1.378** | + |
| Generosity (residual of donation rates) | **0.487** | + |
| Perceptions of corruption (0–1) | **−0.733** | − |

These six factors typically explain ~70–75% of cross-country variance in the ladder score; the residual ("Dystopia + residual" in WHR terminology) is not attributed to unmeasured national factors, deliberately, to avoid implying causality. **This regression is the single most directly reusable equation in this whole survey** — it is already expressed in country-year panel form, coefficients are public, and 4 of its 6 inputs (GDP, life expectancy, freedom/governance proxies, corruption perception) already have public global panels (World Bank, UNDP, Transparency International) that could feed a simulator wellbeing sub-model even for non-WHR-surveyed countries.

**Data availability:** WHR publishes the full panel (ladder score + all six factors + standard errors) as an Excel/CSV download at `worldhappiness.report/data-sharing/`, refreshed annually with the March report; mirrors exist on Kaggle (`unsdsn/world-happiness`) and Our World in Data (`happiness-cantril-ladder`, CC BY). Gallup's own raw microdata requires a paid Gallup Analytics subscription; the WHR's aggregated country-year panel is free.

**Licence:** the WHR aggregated panel is published for free reuse with attribution to the report and Gallup as the underlying data source (research/non-commercial framing; check current-year report for exact wording). The Our World in Data mirror is unambiguously **CC BY**, which is the cleanest licence to cite if redistributing derived figures from this repo.

**Assessment:** **Keep as backbone** (already in use) — it's the only genuinely global, annually-updated, free panel with an attached explanatory regression. Its critiques should be documented in-repo as known limitations, not silently ignored, and its regression should be exposed as a swappable/citable formula rather than baked in as unexplained magic numbers.

Sources: [WHR FAQ](https://www.worldhappiness.report/faq/) · [WHR Data Sharing](https://www.worldhappiness.report/data-sharing/) · [World Happiness Report — Wikipedia](https://en.wikipedia.org/wiki/World_Happiness_Report) · [Our World in Data — Cantril ladder](https://ourworldindata.org/grapher/happiness-cantril-ladder) · [Kaggle mirror](https://www.kaggle.com/datasets/unsdsn/world-happiness) · [ORF — critiques of WHR](https://www.orfonline.org/expert-speak/the-unbearable-sadness-of-being-happy) · [Debate on Gallup World Poll strengths/limitations](https://www.afterbabel.com/p/a-debate-on-the-strengths-limitations)

---

#### 4. WELLBYs (Wellbeing-Adjusted Life Years)

**What it is:** a unit defined by Layard, Frijters, De Neve and collaborators (Happier Lives Institute / LSE Centre for Economic Performance) — **1 WELLBY = a 1-point increase in life satisfaction (0–10 scale) for 1 person for 1 year**. It is explicitly designed as the wellbeing analogue of a QALY (Quality-Adjusted Life Year), so cost-effectiveness of any policy or transfer can be expressed as **cost per WELLBY**, directly comparable across health, welfare, and income interventions.

**Formula:** `WELLBYs generated = Δ(life satisfaction) × (years affected) × (people affected)`. Aggregating over a population/time period gives a stock of WELLBYs comparable to a national income aggregate.

**UK Treasury Green Book adoption:** HM Treasury's 2021 *Wellbeing guidance for appraisal: supplementary Green Book guidance* formally endorses WELLBYs for UK government cost-benefit analysis. It sets a **recommended monetary value of £13,000 per WELLBY (2019 prices)**, with a sensitivity range of **£10,000 (low, QALY-willingness-to-pay-derived) to £16,000 (high, equivalent-income-derived)**; inflation-updated estimates put the current value near **£15,000–£15,300**. This is the only G7 government that has an official shadow price for a life-satisfaction point, which makes it a credible external anchor for "what is a point of wellbeing worth" if the simulator ever wants to convert its 0–100 index into a monetized welfare aggregate.

**Elasticities / effect sizes (from the WELLBY literature, useful as simulator parameters):**
- **Income:** the benchmark used across this literature is that a **doubling of income** (i.e., +1 unit of ln(income)) is associated with roughly **+0.3–0.4 points of life satisfaction** on the 0–10 scale in cross-sectional/panel estimates — consistent with the WHR's own log-GDP coefficient (0.349, see §3) once scaled to national-average terms; note this is smaller and slower-acting than *individual*-level income shocks from cash-transfer RCTs (see below), because national income differences reflect much more than take-home pay.
- **Unemployment:** longitudinal/panel meta-analyses find unemployment has a robust *negative, only-partially-adapting* effect on life satisfaction, distinct from (and larger than) the pure income-loss effect — i.e., there's a non-pecuniary "scarring" cost of joblessness itself, and repeated unemployment spells compound (people who have ever been unemployed report persistently lower life satisfaction than the never-unemployed, and the repeatedly-unemployed report the lowest of all). This is the standard empirical justification in UBI/AI-displacement modeling for **not** treating a lost job as equivalent to its foregone income alone — the simulator's `displacementFriction` term should plausibly include both an income-loss component and a separate, only slowly-adapting non-pecuniary unemployment penalty.
- **Inequality:** the Gini coefficient is negatively associated with average life satisfaction in cross-country/OECD panels, with the effect concentrated among lower-income groups and moderated by perceived economic opportunity (inequality "bites" harder where social mobility is perceived as low) — relevant to how the simulator's `gdpScaling` parameter for UBI distribution interacts with wellbeing outcomes.

**Licence:** WELLBYs are a unit definition and a published UK government methodology, not a dataset — there is nothing to "download," only a formula and a price to apply to whatever life-satisfaction panel you already have (e.g., the WHR panel in §3). The HM Treasury guidance PDF and the academic papers defining the unit are freely citable public documents.

**Assessment:** **Adopt** — WELLBYs are the best available bridge between "a 0–100/0–10 wellbeing index" (what we already compute) and "a monetizable, policy-comparable unit" (what a UBI-cost-effectiveness argument needs). Recommend exposing a `wellbyValue` config parameter (default £13,000/2019, adjustable) so the simulator can report cumulative WELLBYs generated by a scenario and their £/$ monetary equivalent, alongside the existing 0–100 index.

Sources: [OECD — The WELLBY Well-being Valuation Method in the UK](https://www.oecd.org/en/publications/well-being-knowledge-exchange-platform-kep_93d45d63-en/the-wellby-well-being-valuation-method-in-the-united-kingdom_60c1396c-en.html) · [Nature — "The WELLBY: a new measure of social value and progress" (Frijters et al. 2024)](https://www.nature.com/articles/s41599-024-03229-5) · [HM Treasury — Wellbeing guidance for appraisal: supplementary Green Book guidance (PDF)](https://assets.publishing.service.gov.uk/media/60fa9169d3bf7f0448719daf/Wellbeing_guidance_for_appraisal_-_supplementary_Green_Book_guidance.pdf) · [Happier Lives Institute — The WELLBY](https://www.happierlivesinstitute.org/the-wellby/) · [State of Life — "What's a WELLBY and what is it worth?"](https://www.stateoflife.org/news-blog/2024/10/4/whats-a-wellby-and-what-is-it-worth) · [WHR 2021 — Living long and living well: the WELLBY approach](https://www.worldhappiness.report/ed/2021/living-long-and-living-well-the-wellby-approach/) · [Meta-analysis — unemployment and wellbeing, longitudinal evidence](https://www.researchgate.net/publication/362496277_The_relationship_between_unemployment_and_wellbeing_an_updated_meta-analysis_of_longitudinal_evidence) · [East Germany 20-year longitudinal unemployment study](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7652576/)

---

#### 5. Social Progress Index (Social Progress Imperative; Porter & Stern)

**What it measures:** an explicitly **non-economic** composite — deliberately excludes GDP/income entirely, on the premise that social progress should be measured independent of, then correlated against, economic performance. Three dimensions:
1. **Basic Human Needs** (nutrition & basic medical care, water & sanitation, shelter, personal safety)
2. **Foundations of Wellbeing** (access to basic knowledge, access to information & communications, health & wellness, environmental quality)
3. **Opportunity** (personal rights, personal freedom & choice, inclusiveness, access to advanced education)

— 12 components total, built from **57 unique third-party indicators** (all outcome measures, not spending/input measures, by design).

**Coverage:** the 2025/2026 Global SPI covers **170+ countries** (>99% of world population), annually, with a back-series to **2011**. This is the broadest country coverage of any framework in this report except HDI.

**Data availability:** the public site (`socialprogress.org`) provides country profiles and an interactive explorer for free; a **downloadable full panel (2011–2025, all components/indicators)** exists but is gated behind the "Premium" tier reserved for sponsors/supporters — the free tier gives country-by-country browsing, not bulk download. A usable **free bulk alternative** exists via the University of Gothenburg's Quality of Government (QoG) Institute data finder, which republishes SPI as a downloadable dataset (`datafinder.qog.gu.se/dataset/spi`). An EU regional variant (EU-SPI 2.0, 2024) is published under **CC BY 4.0** with full open data for European NUTS regions.

**Licence:** browsing the public site is free with no explicit restrictive licence stated; the bulk historical CSV panel is a **paid Premium** product for sponsors/supporters, so a production pipeline should plan on the QoG Institute mirror (academic/research reuse terms) or the EU regional variant (explicit **CC BY 4.0**) rather than assuming free bulk access to the flagship global dataset.

**Assessment:** **Worth adding**, specifically because it is (a) genuinely global in coverage — better than OECD, comparable to HDI — and (b) structurally decomposable into a needs/foundations/opportunity hierarchy that maps well onto a "drivers" panel the simulator could expose per country (distinct from the single-number WHR ladder). The main friction is the Premium paywall for bulk historical download from the primary source; the QoG mirror resolves this for most purposes. Because it deliberately excludes income, it pairs well as a **complement to, not a replacement for**, the WHR/WELLBY income-sensitive terms — combining both gives an income-driven wellbeing term (WHR/WELLBY) and an income-independent social-conditions term (SPI).

Sources: [Social Progress Imperative — Methodology](https://www.socialprogress.org/methodology) · [Global Social Progress Index 2025/2026](https://www.socialprogress.org/social-progress-index-2025-2) · [Social Progress Index — Wikipedia](https://en.wikipedia.org/wiki/Social_Progress_Index) · [SPI Time Series](https://www.socialprogress.org/social-progress-index-time-series) · [QoG Institute — SPI dataset (free bulk download)](https://datafinder.qog.gu.se/dataset/spi) · [EU Regional SPI 2.0 2024 (CC BY 4.0)](https://ec.europa.eu/regional_policy/sources/work/spi_2024/EUSPI_2024_working%20paper.pdf)

---

#### 6. Human Development Index, Genuine Progress Indicator, and other indices

**Human Development Index (HDI) — UNDP.**
Composite of three normalized sub-indices: a **Life Expectancy Index**, an **Education Index** (mean years of schooling + expected years of schooling), and an **Income Index** (log-transformed GNI per capita). Published annually since 1990 for ~193 countries back to 1990 (and a back-extended series to 1870 for many countries via the UNDP/academic reconstructions) — **the single broadest country-year coverage of any index here**. Freely downloadable as CSV/Excel from `hdr.undp.org` (UNDP Human Development Report Office), no API but a clean bulk-download data bank; explicit UN open-data terms. **Assessment:** worth adding as a cheap, near-universal-coverage cross-check variable (it already substantially overlaps with two of the WHR's six factors — GDP and life/health), but on its own it's a *development* index, not a *wellbeing* index — it says nothing about subjective experience, inequality within a country (see Inequality-adjusted HDI variant, which does correct for this), or freedom/social support. Low marginal value beyond what WHR + World Bank data already give the simulator, except as an easy sanity-check column.

**Genuine Progress Indicator (GPI).**
Starts from personal consumption expenditure and adjusts with ~24 factors — subtracting costs of crime, pollution, resource depletion, commuting, and adding unpaid household/volunteer labor and adjusting for income distribution. Best known from US state-level implementations (Maryland, Vermont, others) and academic global reconstructions; **no single authoritative, regularly-updated global panel exists** — estimates are scattered across academic papers with inconsistent methodology, and there is active academic debate calling for a standardized "GPI 2.0." **Assessment: not adoptable** in current form — no downloadable, consistently-methodologized global country-year panel exists to bind to. Interesting conceptually (it is the closest existing index to "GDP minus externalities," which resonates with this simulator's displacement-friction concept) but not implementable without doing the index construction ourselves, which is out of scope.

**Other indices worth one line each:**
- **Legatum Prosperity Index** — 12 pillars (similar structure to SPI), ~170 countries, free country profiles at `prosperity.com`, bulk data less openly downloadable than SPI; redundant with SPI for our purposes.
- **World Bank Human Capital Index** — narrowly focused on health+education productivity potential, not wellbeing per se; useful only as a labor-market/human-capital input feeding *into* a wellbeing equation, not as a wellbeing output itself.
- **Happy Planet Index (New Economics Foundation)** — combines wellbeing, life expectancy, inequality, and ecological footprint into one ratio; conceptually interesting for an AI-abundance-and-ecology narrative, but has had inconsistent update cadence and small analytical following — lower priority.
- **Gallup-Sharecare Wellbeing Index / OECD PISA-style subnational surveys** — rich for the US and a few countries only; not global.

---

#### 7. Empirical elasticities usable as simulator parameters

| Parameter | Estimate | Source / context |
|---|---|---|
| **Income → life satisfaction** (log-income elasticity) | **≈0.3–0.35** points (0–10 scale) per 1 log-point (doubling) of income | WHR log-GDP coefficient 0.349 (§3); WELLBY literature benchmark "0.3 useful benchmark for effect of log income on wellbeing" ([Cambridge — *Wellbeing*, ch. 13, Income](https://www.cambridge.org/core/books/wellbeing/income/CB44D2AB5EFCEFAAFA85148E204E7F10)) |
| **Unemployment → life satisfaction** (own effect, longitudinal) | effect size ≈ **−0.22** (standardized, longitudinal meta-analysis); persistent/scarring — repeated unemployment compounds and does not fully adapt over decades | [Meta-analysis of longitudinal unemployment-wellbeing studies](https://www.researchgate.net/publication/362496277_The_relationship_between_unemployment_and_wellbeing_an_updated_meta-analysis_of_longitudinal_evidence); [20-year East Germany panel](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7652576/) |
| **Inequality (Gini) → life satisfaction** | negative and significant in OECD/cross-country panels; effect concentrated among lower-income deciles, moderated by perceived opportunity | [Economic Freedom, Income Inequality and Life Satisfaction in OECD Countries](https://link.springer.com/article/10.1007/s10902-017-9905-7); [Income Inequality Is Associated with Stronger Social Comparison Effects](https://pmc.ncbi.nlm.nih.gov/articles/PMC4718872/) |
| **Cash transfers (GiveDirectly, rural Kenya, unconditional, RCT)** | recipients **+0.17 SD** life satisfaction (≈+6.7% self-reported satisfaction); **+0.26 SD** on a broader psychological-wellbeing index; **2.0 WELLBYs generated per $1,000 donated** (HLI cost-effectiveness estimate) | [J-PAL evaluation](https://www.povertyactionlab.org/evaluation/improving-economic-and-psychological-well-being-through-unconditional-cash-transfer); [Haushofer & Shapiro, QJE 2016](https://academic.oup.com/qje/article-abstract/131/4/1973/2468874); [Happier Lives Institute — the WELLBY](https://www.happierlivesinstitute.org/the-wellby/) |
| **Cash transfers (GiveDirectly, Malawi, "Paying for Happiness")** | large, statistically significant subjective-wellbeing gains from a large-scale unconditional transfer program; magnitude broadly consistent with Kenya RCT | [Paying for Happiness: Malawi (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6088229/) |
| **Finland Basic Income Experiment (2017–18, RCT, 2,000 unemployed recipients)** | recipients reported significantly higher life satisfaction, less mental strain/depression/loneliness than control; small positive employment effect (+6 days employed over the period, on a base of 78 days) — i.e., wellbeing gains **did not come at a labor-supply cost**, a directly relevant finding for AI-displacement UBI framing | [Finland Toolbox — 2017–2018 results](https://toolbox.finland.fi/life-society/finlands-basic-income-experiment-2017-2018/); [Ministry of Social Affairs and Health — results release](https://stm.fi/en/-/perustulokokeilun-tulokset-tyollisyysvaikutukset-vahaisia-toimeentulo-ja-psyykkinen-terveys-koettiin-paremmaksi) |
| **Stockton SEED ($500/month, 24 months, US)** | reduced income volatility; improved mental health (less depression/anxiety, less fatigue); full-time employment rate **more than doubled** vs. control (i.e., again no negative labor-supply effect) | [Results for America case study](https://catalog.results4america.org/case-studies/guaranteed-income-stockton); [Penn Today — health results during pandemic](https://penntoday.upenn.edu/news/guaranteed-income-improved-peoples-health-during-pandemic) |

**Methodological caveat:** none of the elasticities above are estimated from a single unified randomized design — the income and inequality coefficients come from observational cross-country/panel regressions (correlational, subject to omitted-variable and reverse-causality concerns, e.g. happier people may earn more), while the cash-transfer figures come from genuine RCTs but in specific (mostly low/middle-income or small US-city) contexts that may not generalize to a national-scale AI-driven UBI rollout. Treat every number in this table as a **plausible planning parameter with a wide uncertainty band**, and expose it as an adjustable constant rather than a hardcoded literal, so scenario authors can stress-test sensitivity to the elasticity assumption itself.

**Cross-cutting note for the simulator:** all three UBI/cash-transfer natural experiments above (Kenya, Finland, Stockton) find **positive wellbeing effects with neutral-to-positive labor-supply effects** — directly contradicting the "UBI kills work incentive" prior baked into some displacement-friction models. This is strong external validation for keeping `displacementFriction` and `ubiBoost` as separable, not offsetting, terms in the wellbeing equation, and for not penalizing simulated UBI recipients with an implicit "laziness" tax.

---

#### 8. Implementation notes (how to actually bind to this data)

A few concrete pointers for whoever picks this up, since "worth adopting" is only useful if paired with a real ingestion path:

- **WHR panel (§3):** the CSV/XLSX at `worldhappiness.report/data-sharing/` has one row per country-year with columns for `Life Ladder`, `Log GDP per capita`, `Social support`, `Healthy life expectancy at birth`, `Freedom to make life choices`, `Generosity`, `Perceptions of corruption`. This maps almost 1:1 onto a `WHRFactors` TypeScript interface — country code, year, the six factors, and the ladder score — and can be checked into `constants.ts` or loaded at build time as a static JSON fixture (it's a small file, low tens of KB per year).
- **OECD (§2):** the Data Explorer's "Developer API" button generates a ready-to-copy SDMX REST URL for any filtered view (e.g., a specific indicator × country × year selection); the response can be requested as CSV directly (`...&format=csvfile`) which avoids needing an SDMX parser. Because coverage is limited to OECD members, this is best wired in as an optional per-country override/enrichment layer, not a required data source, so the simulator degrades gracefully for the 150+ countries OECD doesn't cover.
- **WELLBY (§4):** no ingestion needed — this is a derived metric. Implementation is `wellbys = Δladder_or_life_satisfaction × years × population`, then `monetaryValue = wellbys × wellbyPrice` where `wellbyPrice` defaults to the Green Book's £13,000 (2019) figure, ideally inflation-adjusted and currency-configurable so it isn't silently GBP-only for a global simulator.
- **SPI (§5):** the QoG Institute dataset finder exposes the panel as a plain downloadable CSV (`datafinder.qog.gu.se/dataset/spi`) with documented variable codebooks — this is the most practical free route to a multi-year, multi-component SPI panel without the Premium paywall, and its component-level columns (basic needs / foundations / opportunity, and the 12 sub-components) can be surfaced as a "drivers" breakdown alongside the existing wellbeing index in the UI.
- **HDI (§6):** UNDP's Human Development Report Office publishes a "Data Center" bulk download (composite indices + the underlying life-expectancy/education/income sub-indices) as CSV; useful as a single low-effort sanity-check column since it needs no API integration, just a periodic manual refresh.

---

#### Ranked recommendation

1. **Adopt WELLBYs as a second output unit.** Add a `wellbyValue` parameter (default £13,000 @ 2019 prices / ~£15,300 today, per HM Treasury Green Book) so the simulator can report cumulative WELLBYs and a monetized £/$ welfare equivalent alongside the existing 0–100 index — this is the highest-leverage addition because it turns "wellbeing went up" into a policy-comparable, defensible number, and both the unit definition and a government-validated price already exist off the shelf.
2. **Expose the WHR six-factor regression as a named, citable formula**, not implicit constants — keep Cantril-ladder hindcasting as the backbone (best global coverage + only free annually-updated panel with an attached explanatory regression), but surface the β coefficients (0.349 / 2.563 / 0.028 / 1.378 / 0.487 / −0.733) in `constants.ts` with the source cited, and document the report's own stated critiques (small samples, single-item measure, correlational-not-causal) in-repo so users don't mistake it for ground truth.
3. **Add Social Progress Index as a second, income-independent decomposition layer**, pulled via the QoG Institute's free bulk mirror — its 170+-country coverage rivals HDI, its Basic-Needs/Foundations/Opportunity structure gives users a driver breakdown the single-number Cantril ladder can't, and because it excludes income entirely it is genuinely complementary (not redundant) with WHR/WELLBY.
4. **Wire in the empirical elasticities from §7** (income ≈0.3/log-point, unemployment ≈−0.22 SD persistent, inequality negative-and-opportunity-moderated, cash-transfer +0.17–0.26 SD) as the actual coefficients behind `displacementFriction` and `ubiBoost`, replacing any hand-tuned constants — and treat the Finland/Stockton/Kenya finding of **no negative labor-supply effect from UBI** as a testable anchor/regression-test case for the game-theory module.
5. **Do not build GNH, GPI, or HDI ingestion pipelines.** GNH has no cross-country data at all (single nation, 4 waves); GPI has no standardized global panel to bind to; HDI is broad but adds little marginal signal beyond what WHR + World Bank GDP/life-expectancy series already give the simulator — at most, pull HDI as a single cheap sanity-check column, not a modeled input.

---

### B2. Modelling frameworks and standards

### Modeling frameworks, standards, and prior art — critical survey

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

#### 1. System dynamics: XMILE, Vensim, Stella, Insight Maker, PySD, simlin

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

#### 2. Probabilistic estimation: Squiggle and Guesstimate

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

#### 3. Policy microsimulation: "tax code in state X vs state Y"

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

#### 4. AI-economics models: what has public code?

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

#### 5. Integrated Assessment Models: DICE as a schema analogy

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

#### 6. Causal graphs with dynamics: DBNs, CLDs, and log-odds combination

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

#### 7. Community forecasting platforms and aggregation

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

#### Ranked recommendation

1. **Build our own JSON/TS-native schema — don't adopt XMILE, PySD, PolicyEngine, OpenFisca, or any Bayesian-network library wholesale.** None fits our stack (Python/XML/AGPL) or our lay-user/LLM-editability requirement as well as a purpose-built JSON schema on mathjs would.
2. **Evaluate embedding `@quri/squiggle-lang`** (TS, npm, built-in Monte Carlo) as the distribution/uncertainty sub-language for parameter ranges — verify licence first — instead of reinventing distribution sampling.
3. **Copy the three-layer separation DICE (climate-economy) and Tax-Calculator/OpenFisca (tax microsimulation) converged on independently**: parameters (calibrated, time-indexed, sourced) / equations (reference named parameters + lagged state) / scenarios-interventions (time-indexed overrides with bounds, as a diff against baseline).
4. **Adopt the log-odds/logistic-SCM framing and the Satopää et al. extremizing formula** for combining expert-tier and public-tier estimates — a validated formula, not a library.
5. **Vendor simlin (Apache-2.0, Rust/WASM) later as an optional XMILE/Vensim import bridge**, not as our core engine, for interoperability with legacy SD tools.
6. **Treat AI-economics models (GATE, Davidson, Erdil, Korinek-Suh, Anthropic's explorer) as equation/framing references only** — none has public code — mining their compute→automation→growth and task-based decomposition patterns as hand-transcribed starting templates.

---

#### Proposed minimal model file format

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

---

### B3. Policy-effect validation

### Policy-Effect Validation: What It Would Take to Make This Simulator Credible

Research memo for the AI-UBI Wellbeing Transition Simulator. Question: if we want to eventually claim
"policy X in state A vs. state B does Y to income/employment/wellbeing," what does the empirical
literature actually support, what public-data test cases exist to check a model against, and what
would a defensible validation harness look like. This is a research document, not a build plan —
no code changes were made.

---

#### 0. The one distinction that matters most

**Causal inference from historical data** (DiD, synthetic control, RDD, event studies) answers: *given
what actually happened, what was the effect of a specific, already-implemented policy on a specific
outcome, in the population actually exposed to it?* It is backward-looking, and its credibility rests
on a *design* (a natural experiment) that approximates randomization. It cannot run before a policy
happens, and says nothing about counterfactuals never tried, or responses under conditions unlike the
historical sample (e.g. mass AI-driven displacement, which has no historical analogue).

**Forward simulation** (what this repo does) is a structural/reduced-form model — equations with
parameters — run forward to project what *would* happen under a hypothetical policy. It is only as
good as (a) whether its functional forms are right and (b) whether its parameters match reality. It
can simulate anything, including scenarios with zero precedent, but nothing forces it to be right.

The only way to connect the two: require the forward simulator, initialized on historical pre-treatment
conditions, to *reproduce* the causally-identified effect sizes from natural experiments. That
reproduction exercise is "backtesting"/"validation" — necessary but not sufficient. Passing it proves
the model isn't obviously wrong in situations resembling the past; it proves nothing about genuinely
novel AI-era scenarios (Section 6).

---

#### 1. Causal inference methods: what each needs, pitfalls, implementations

##### 1.1 Difference-in-differences (DiD)

**What it needs:** a treated group and a comparison group, observed both before and after treatment,
where — absent treatment — the two groups' outcomes would have trended in parallel ("parallel trends").
Classic 2x2 design; extends to many units/many time periods.

**Pitfalls:**
- *Parallel trends is untestable directly* — you can only eyeball pre-trends (necessary, not
  sufficient), and pre-testing on pre-trends itself biases inference (see arXiv:2510.26470, "Valid
  Inference when Testing Violations of Parallel Trends").
- *Staggered adoption with heterogeneous treatment effects breaks standard two-way-fixed-effects
  (TWFE)* — TWFE implicitly uses already-treated units as controls for later-treated units, which can
  sign-reverse estimates. The key fixes: Goodman-Bacon 2021 decomposition, Callaway & Sant'Anna 2021
  group-time ATT, Sun & Abraham 2021 interaction-weighted estimator, de Chaisemartin & D'Haultfœuille —
  see survey at arXiv:2112.04565.
- Anticipation effects and spillovers to "control" units both violate the design (SUTVA); see
  arXiv:2512.21176 on DiD under unknown interference.

**Implementations:** R is the reference ecosystem — `did` (Callaway & Sant'Anna), `fixest` (Sun-Abraham,
two-way FE with clustering), `bacondecomp`, `DIDmultiplegt`. Python: `linearmodels` (basic panel FE
DiD), `differences` (a Callaway-Sant'Anna port), `pyfixest` (fast fixed-effects, growing DiD support).
**JavaScript/TypeScript: no maintained implementation exists.** A JS/TS simulator that wants to run
these tests itself would need to either shell out to Python/R, reimplement a basic 2x2/event-study DiD
(tractable — it's just OLS with fixed effects and cluster-robust SEs) or use this as the argument for a
Python validation *sidecar* rather than porting the stats into the app.

##### 1.2 Synthetic control method (SCM)

**What it needs:** one (or few) treated units, a "donor pool" of untreated units, and a long enough
pre-treatment period to fit weights that make the weighted combination of donors track the treated
unit's pre-treatment outcome and predictors closely. Popularized by Abadie & Gardeazabal (2003, Basque
terrorism) and Abadie, Diamond & Hainmueller (2010, California Prop 99 tobacco tax) and (2015, German
reunification).

**Pitfalls:** overfitting in the donor-weight optimization when the pre-treatment window is short
relative to the number of donors/predictors; no standard closed-form inference — significance is
usually assessed via in-space placebo tests (run the same procedure on untreated donors and see how
extreme the real treated-unit gap is) and in-time placebo tests; sensitive to donor pool composition
(a bad match set gives an unconvincing synthetic control); interpolation bias when the treated unit is
an outlier relative to the donor pool.

**Implementations:** R `Synth` (original), `gsynth`, `tidysynth`, `scpi` (Cattaneo et al., proper
uncertainty quantification — arXiv:2202.05984). Python: **`pysyncon`** — classic, robust
(Amjad/Shah/Shen), augmented (Ben-Michael/Feller/Rothstein), and penalized SCM in one package
([GitHub](https://github.com/sdfordham/pysyncon), [docs](https://sdfordham.github.io/pysyncon/synth.html));
**`SyntheticControlMethods`** ([PyPI](https://pypi.org/project/SyntheticControlMethods/)); **`SparseSC`**
for many-donor high-dimensional settings. No maintained JS package.

##### 1.3 Regression discontinuity (RDD)

**What it needs:** treatment assignment determined by a running variable crossing a known cutoff (e.g.
income threshold for a benefit, birthdate cutoff, vote-share threshold). Compares outcomes for units
just above vs. just below the cutoff.

**Pitfalls:** manipulation of the running variable around the cutoff (test with McCrary/Cattaneo-Jansson-
Ma density tests); bandwidth choice trades off bias and variance — must use data-driven optimal
bandwidth selectors, not ad hoc ones; results are *local* to the cutoff (LATE at the threshold) and do
not necessarily generalize to units far from it — a serious limitation for state policy work where
almost no policies are assigned by a sharp, exogenous running-variable cutoff (fuzzy RDD, where the
cutoff only shifts the *probability* of treatment, is more common and needs an IV-style two-stage
setup).

**Implementations:** the reference toolkit is **`rdrobust`** (Calonico, Cattaneo, Farrell, Titiunik,
Masini) — available for Stata, R, **and Python** ([PyPI](https://pypi.org/project/rdrobust/), [package hub](https://rdpackages.github.io/rdrobust/)), plus companion packages `rddensity` (manipulation
testing) and `rdlocrand` (local randomization inference). No JS port.

##### 1.4 Event studies

**What it needs:** a well-defined event date and a model of what the outcome "would have done" absent
the event (for financial event studies, a market/factor model estimated in a clean pre-event window;
for policy event studies, this collapses into a dynamic/staggered DiD specification with leads and
lags around treatment).

**Pitfalls:** event-date precision (anticipation/leakage before the "official" date contaminates the
pre-period); confounding events in the same window; policy-econometrics "event study" plots of dynamic
treatment effects inherit all the staggered-DiD problems above unless built with a heterogeneity-robust
estimator. Walkthroughs: ["The Effect," ch. 17](https://theeffectbook.net/ch-EventStudies.html),
[bookdown ch. 39](https://bookdown.org/mike/data_analysis/sec-event-studies.html).

**Implementations:** same toolchain as DiD (`did`, `fixest` in R; `linearmodels`/`pyfixest` in Python).

##### 1.5 Causal-inference "meta" frameworks

**DoWhy** (Microsoft/PyWhy) provides a four-step workflow — model (DAG) → identify → estimate → refute —
with a refutation API (placebo treatment, random common cause, sensitivity analysis) that's the closest
thing to a general "sanity check my causal claim" tool ([arXiv:2011.04216](https://arxiv.org/pdf/2011.04216),
[pywhy.org](https://www.pywhy.org/)). It hands estimation off to **EconML** (heterogeneous/conditional
treatment effects via double-ML, causal forests) — relevant if the simulator wants "effect varies by
state characteristics" rather than one national ATE. **CausalML** (Uber) offers a similar CATE toolkit.
None replace DiD/SCM/RDD; they organize assumptions and test robustness once a design is picked.

---

#### 2. Natural experiments with public data: a validation catalog

Each entry: intervention → measured effect (with citation) → where the underlying data live. These are
candidates for "validation cases" in Section 5.

##### 2.1 State minimum wage changes (Card & Krueger and successors)

- **Card & Krueger (1994/2000)**: NJ raised its minimum wage $4.25→$5.05 on 4/1/1992; PA did not. 410
  fast-food restaurants surveyed before/after. NJ employment rose ~13% *relative to* PA — no employment
  loss, contra the standard competitive-labor-market prediction. [NBER w4509](https://www.nber.org/papers/w4509);
  Neumark-Wascher reanalysis and reply: [AER 2000](https://www.aeaweb.org/articles?id=10.1257%2Faer.90.5.1397).
  Replication data/code: davidcard.berkeley.edu.
- **Modern synthesis**: Cengiz, Dube, Lindner & Zipperer (2019, QJE) use a bunching event-study design
  across 138 U.S. state minimum-wage changes 1979–2016: near-zero net employment effects up to ~median
  wage, losses concentrated only well above it. The most-cited modern robustness check, and a strong
  target because it spans dozens of state-level natural experiments with a uniform design.
- **Data**: BLS QCEW (state/county employment and wages, quarterly, free); minimum-wage histories via
  DOL and the Cengiz et al. replication package (openICPSR).

##### 2.2 EITC expansions

- **1986/1990/1993 federal EITC expansions**, via DiD comparing single mothers to single childless
  women. Eissa & Liebman (1996): 1986 expansion raised single-mother employment **2.8 pp** relative to
  childless women ([NBER w5158](https://www.nber.org/papers/w5158)). Meyer & Rosenbaum (2001): cumulative
  1984–96 expansions raised unmarried-mother employment **7.2 pp**. Hoynes & Patel (2018): the 1993
  expansion alone raised employment **6.1 pp** among lower-educated unmarried mothers
  ([NBER w28041](https://www.nber.org/system/files/working_papers/w28041/revisions/w28041.rev0.pdf)).
  Curated summary: [Policy Impacts Library](https://policyimpacts.org/policy-impacts-library/1986-expansion-of-the-earned-income-tax-credit-eitc/).
- **Data**: CPS ASEC (income/labor force by state, via IPUMS-CPS); IRS SOI state-level EITC claims.

##### 2.3 Medicaid expansion (Oregon 2008 lottery; ACA 2014 state expansions)

- **Oregon Health Insurance Experiment**: a 2008 Medicaid lottery among low-income adults — the
  cleanest RCT-grade natural experiment in U.S. health policy. Winning raised coverage ~25pp. Year-1:
  more utilization, reduced financial strain and depression; **no significant effect on physical health
  or labor-market outcomes**. [NBER w17190](https://www.nber.org/papers/w17190) (Finkelstein et al.).
  Public replication data via NBER/ICPSR.
- **ACA state Medicaid expansion (2014–)**: 39 states + DC expanded, several did not — used in dozens
  of DiD studies of coverage, financial security, and (mixed evidence) health/labor supply. Good for a
  *state-vs-state* case since the treatment/control split is at state level, matching this simulator's
  target granularity.
- **Data**: CDC BRFSS (state-level health and coverage, annual), Census SAHIE (Small Area Health
  Insurance Estimates), KFF state Medicaid expansion tracker.

##### 2.4 Kansas 2012 tax cuts ("Brownback experiment")

- Kansas cut the top individual rate 6.45%→4.9% and zeroed pass-through business income tax in 2012,
  explicitly framed as a real-world test of supply-side theory. Result: Kansas underperformed neighbors
  and the U.S. on job growth (+28,000 jobs Jan 2014–Apr 2017 vs. +35,000 in smaller-labor-force
  Nebraska), and lost enough revenue that the legislature reversed most cuts in 2017. See [Tax Policy
  Center](https://taxpolicycenter.org/taxvox/brownback-tax-cut-experiment-ends-kansas),
  [Brookings](https://www.brookings.edu/articles/the-kansas-tax-cut-experiment), [Wikipedia](https://en.wikipedia.org/wiki/Kansas_experiment).
  Contested counter-read: [Tax Foundation](https://taxfoundation.org/blog/kansas-experiment-kansas-tax-cuts-critique/)
  — useful *because* it's contested, a good stress test for whether a simulator bakes in one side's view.
- **Data**: BLS state employment/QCEW, Census Annual Survey of State Government Tax Collections, Kansas
  Dept. of Revenue.

##### 2.5 California Proposition 13 (1978)

- Capped property tax at 1% of assessed value, annual reassessment growth at 2% unless sold. Cut
  property tax revenue **~53%** immediately; produced a documented "lock-in effect" (owners stay put to
  avoid reassessment) — NBER Digest summary of Wasi & White: [nber.org/digest/apr05](https://www.nber.org/digest/apr05/lock-effect-californias-proposition-13);
  40-years-later retrospective: [PPIC](https://www.ppic.org/publication/proposition-13-40-years-later/).
  Single-state, long-horizon case with no clean comparison state — best matched via synthetic control
  against a donor pool of other high-growth states.
- **Data**: California State Board of Equalization tax collections; Zillow/FHFA county housing turnover.

##### 2.6 Alaska Permanent Fund Dividend (1982–present)

- The longest-running unconditional, universal, permanent cash-transfer program with public payout data
  back to 1982 (varies ~$1,000–$3,000+/year per resident). Jones & Marinescu (2022, AEJ:EP; NBER w24312)
  use synthetic control on the CPS: **no effect on overall employment**, but part-time work rose
  **1.8 pp (17% relative)** — interpreted as general-equilibrium demand effects offsetting the standard
  labor-supply-reduction prediction from individual cash-transfer studies. [NBER paper](https://www.nber.org/system/files/working_papers/w24312/w24312.pdf),
  [AEA published version](https://www.aeaweb.org/articles?id=10.1257%2Fpol.20190299). This is arguably
  **the single best validation case for a UBI-focused simulator**: it is UBI, it is real, it has 40+
  years of data, and it already comes with a synthetic-control estimate to match against.
- **Data**: Alaska Dept. of Revenue PFD Division (historical payout amounts, public); CPS (BLS/Census)
  for employment.

##### 2.7 UBI / cash-transfer pilots

- **Stockton SEED (2019–2021)**: RCT, $500/month unconditional to 125 residents for 24 months. Full-time
  employment rose to more than double the control group's rate; reduced anxiety/depression and income
  volatility; <1% of spending on alcohol/tobacco. [SEED report](https://www.stocktondemonstration.org/press-landing/guaranteed-income-increases-employment-improves-financial-and-physical-health).
  Small N (125 treated) — useful for wellbeing-channel calibration, not macro/GE effects.
- **Finland Basic Income Experiment (2017–2018)**: RCT, 2,000 unemployed given €560/month vs. control.
  Employment effect small/mixed (~6 more employed days/year, confounded by a concurrent 2018 activation-
  model reform); *large* wellbeing gains — higher life satisfaction, lower psychological strain, 55% vs.
  46% self-rated good/very good health. [Government results](https://valtioneuvosto.fi/en/article/-/asset_publisher/1271139/perustulokokeilun-alustavat-tulokset-hyvinvointi-koettiin-paremmaksi-ensimmaisena-vuonna-ei-tyollisyysvaikutuksia),
  [full report](https://julkaisut.valtioneuvosto.fi/bitstreams/f2041c17-878d-490c-8c5f-f12ab5cbd70b/download).
  Best available case for calibrating "UBI decouples wellbeing from employment status," central to this
  simulator's thesis.
- **GiveDirectly Kenya (2016– , world's largest/longest UBI RCT)**: ~23,000 people, 195 villages, three
  arms (lump sum / 2-yr UBI / 12-yr long-horizon UBI) vs. control. No increase in "idleness" — recipients
  worked comparably or more, became more entrepreneurial; lump-sum income rose ~50% vs. control.
  [2023 results](https://www.givedirectly.org/2023-ubi-results), [NPR coverage](https://www.npr.org/sections/goatsandsoda/2023/12/07/1217478771/its-one-of-the-biggest-experiments-in-fighting-global-poverty-now-the-results-ar).
  Different regime (rural low-income Kenya) — an out-of-distribution stress test, not a U.S.-state analogue.
- **Baby's First Years (U.S., RCT since 2018)**: 1,000 low-income mothers, $333/mo vs. $20/mo
  unconditional cash. 1-year result: causal change in infant brain activity (EEG, high-frequency power)
  — [PNAS 2022](https://www.pnas.org/doi/10.1073/pnas.2115649119). **4-year follow-up found NO
  significant effect** on its four pre-registered primary outcomes — [NBER w33844](https://www.nber.org/papers/w33844),
  [4-yr article](https://pmc.ncbi.nlm.nih.gov/articles/PMC12861262/). This null result is itself
  valuable: a pre-registered RCT failing to replicate its own earlier finding is a good discipline check
  against cherry-picking only "cash transfers work" evidence.

##### 2.8 2021 expanded Child Tax Credit (monthly, fully refundable)

- Part of the American Rescue Plan, paid monthly July–Dec 2021. Census SPM child poverty fell to **5.2%**
  in 2021 from 9.7% in 2020 — the largest single-year drop on record — with the CTC expansion credited
  with lifting **2.1 million children** out of poverty (5.3M people total). [Senate JEC/Census sourcing](https://www.jec.senate.gov/public/index.cfm/democrats/2022/11/the-expanded-child-tax-credit-dramatically-reduced-child-poverty-in-2021),
  [Columbia CPSP brief](https://povertycenter.columbia.edu/sites/default/files/content/Publications/Child-Tax-Credit-Expansion-on-Employment-CPSP-2021.pdf).
  **Contested employment effect**: Corinth, Meyer, Stadnicki & Wu (NBER w29823) project large negative
  labor-supply effects from a *permanent* expansion; Bastian and others, using the actual 2021 policy's
  realized data, find effects small at most — [Wiley PAM 2023](https://onlinelibrary.wiley.com/doi/full/10.1002/pam.22528).
  This live dispute between credentialed teams is itself a good harness case for testing whether CI-based
  scoring (Section 5), not a single point estimate, is what gets reported.
- **Data**: Census SPM public-use files (IPUMS-CPS ASEC), IRS advance-CTC payment statistics by
  state/county (public, 2021–22).

---

#### 3. Public data APIs for state-level series

| Source | Coverage | Access | Rate limits / licence |
|---|---|---|---|
| **FRED** (St. Louis Fed) | 800,000+ series aggregating BLS/BEA/Census/OECD/World Bank/Treasury etc., incl. state-level series | Free API key, REST/JSON | 120 requests/60s documented limit, no monthly cap; redistribution allowed but check each series' own source-note licence before republishing values — [terms](https://fred.stlouisfed.org/docs/api/terms_of_use.html) |
| **BLS API v2** | CPS, QCEW, CES employment/wages/unemployment by state/county | Free registration | v1 (no key): 25 queries/day, 25 series/query; **v2 (registered): 500 queries/day, 50 series/query**, adds % change and more years — [guide](https://bd-econ.com/blsapi.html) |
| **Census API (ACS, SAHIE, SPM, etc.)** | Income, poverty, health insurance, demographics by state/county/tract | Free key | ~500 queries/IP/day without key (soft, enforceable), key recommended for anything above trivial use; misuse can get you blocked — [ToS](https://www.census.gov/data/developers/about/terms-of-service.html) |
| **BEA (Regional accounts)** | State/county GDP, personal income, regional price parities | Free key (email only, never expires) | Per-key rate limits enforced but not published as a fixed number; practical use is generous |
| **CDC BRFSS** | State-level health, "Healthy Days" HRQOL module, and (2017 wave only) an Emotional Support & Life Satisfaction module | Public microdata + summary tables | No API key; life-satisfaction module is not asked every year, so time-series use for wellbeing is thin — [CDC Life Satisfaction & Healthy Days](https://cdc.gov/mental-health/about-data/life-satisfaction.html) |
| **Gallup U.S. state well-being** | State-level life evaluation ("thriving/struggling/suffering," Cantril ladder) historically published via the Gallup-Healthways Well-Being Index (since 2008; methodology changed 2018 to mail/web) | Proprietary — published rankings free to read, underlying microdata is licensed/paid | No public API; usable only as periodic published snapshots, not a programmatic feed — [Gallup wellbeing topic](https://news.gallup.com/topic/well-being-index.aspx) |

Practical implication for this repo: FRED + BLS + Census/BEA cover income, employment, and GDP cleanly
and are free, keyed, and scriptable — a solid backbone for the income/employment legs of validation.
The wellbeing leg is the weak link: BRFSS Healthy Days is annual and state-representative but its
life-satisfaction question is not consistently asked, and Gallup's genuinely comparable state
life-satisfaction series is paywalled. A validation harness should treat "wellbeing" cases as
lower-confidence / wider-CI than income and employment cases for exactly this reason.

---

#### 4. What "validated" means for existing policy simulators

- **Penn Wharton Budget Model (PWBM)**: publishes a [validation page](https://budgetmodel.wharton.upenn.edu/microsim/validation)
  comparing its microsim's demographic/economic distributions (100 runs) against CPS benchmarks, plus
  outside-academic review of assumptions. This is **distributional/calibration validation** (does the
  synthetic population look real), not **causal-effect backtesting** (did a past policy move outcomes
  as the model says) — an important distinction. Critics ([The American Prospect](https://prospect.org/economy/2023-04-10-penn-wharton-beltways-favorite-bogus-budget-model/))
  argue PWBM's elasticities are contestable even though the microsim mechanics are sound.
- **CBO**: publishes an annual [Economic Forecasting Record](https://www.cbo.gov/system/files/2025-07/61334-forecasts.pdf)
  scoring past forecasts against realized outcomes via mean absolute error and RMSE, decomposed into
  "centeredness" (bias) and "spread" (variance) — the closest thing here to genuine **prospective
  backtesting with a public scorecard**, though it scores macro forecasts, not individual-bill causal
  effects; those are acknowledged as "often quite difficult and sometimes impossible" to validate ex
  post since the no-bill counterfactual is never observed.
- **PolicyEngine** (open source, US/UK/CA/IL/NG tax-benefit microsim): validates by calibrating survey
  microdata to administrative/aggregate targets via ML reweighting, with a public calibration dashboard
  — see [policyengine-us](https://github.com/policyengine/policyengine-us) and the
  [JOSS paper](https://joss.theoj.org/papers/34b9f72df98e586d7e6a2448922407e7). Closest existing project
  in spirit to what this repo could become (open, inspectable, rules-engine style), though it computes
  *statutory* tax-benefit amounts deterministically rather than simulating *behavioral* response.
- **Tax Foundation (Taxes & Growth model)**: growth-optimistic elasticity assumptions produce
  systematically larger growth/revenue effects than CBO/JCT — a cautionary example of "validation"
  meaning internal consistency with chosen elasticities, not a public backtest. See
  [Equitable Growth's critique](https://equitablegrowth.org/the-tax-foundations-score-of-the-tax-cuts-and-jobs-act/)
  vs. [Tax Foundation's defense](https://taxfoundation.org/blog/dynamic-scoring-stands-criticism/).

**Takeaway**: none of these four organizations publish a clean "predicted effect vs. measured causal
effect, scored against a pre-registered baseline" record for policy *effects* (as opposed to macro
*forecasts*, which CBO does score). That gap is exactly what Section 5 proposes filling — it would be a
distinguishing, credibility-building feature rather than something to copy from elsewhere.

---

#### 5. A proposed validation harness

##### 5.1 A library of validation cases

Each case is a structured record, not free text, so it can be run programmatically:

```yaml
id: alaska-pfd-1982
intervention:
  type: universal_cash_transfer
  amount_per_capita_per_year: "varies 1982-present, ~$1,000-$3,100"
  region: Alaska
  start_date: 1982-01-01
comparison:
  design: synthetic_control
  donor_pool: [other US states, CPS-derived]
  source_study: "Jones & Marinescu 2022, AEJ:Economic Policy"
outcomes:
  - {name: employment_rate, measured_effect: "~0 pp (not significant)", ci_95: [-0.5, 0.5]}
  - {name: part_time_share, measured_effect: "+1.8 pp (+17% relative)", ci_95: [0.9, 2.7]}  # illustrative
data_sources:
  - {name: CPS, api: BLS/Census, series: [...]}
  - {name: Alaska PFD Division, url: "https://pfd.alaska.gov/Division-Info/Summary-of-Applications-and-Payments"}
replication_package: null
confidence: high   # RCT/synthetic-control, long panel, published CI
```

Populate the library with the six cases in Section 2 to start (see the ranked list at the end), then
expand. Every case needs: (1) a specific outcome series, not a vague "the economy," (2) a comparison
design (what's the counterfactual), (3) a **published effect size with its own uncertainty interval** —
not just a point estimate, because grading a point-prediction against a point-estimate treats the
original study's sampling error as if it doesn't exist.

##### 5.2 A scoring rule

Two outcome types need two different scores:

- **Point/interval outcomes** (income change in dollars, employment-rate change in pp): score by
  whether the simulator's predicted effect falls inside the *union* of its own stated uncertainty and
  the published study's 95% CI, and report a normalized error `(predicted - measured) / measured_se`
  so partial credit is possible rather than pure pass/fail. Track this across all cases as an aggregate
  RMSE/MAE, the same two summary statistics CBO already uses for its own forecast scorecard — that
  makes the simulator's track record legible to people already familiar with how CBO reports itself.
- **Probabilistic/directional claims** ("wellbeing will rise," "employment effect will be positive"):
  score with a **Brier score** against the realized binary/discretized outcome, exactly as Metaculus does
  for its community forecasts (documented track record ~0.111 Brier across thousands of resolved
  questions — see [Metaculus FAQ](https://www.metaculus.com/faq/)). This is the right tool when the
  simulator is only confident enough to state a direction/probability rather than a magnitude — which,
  for genuinely novel scenarios, will often be the honest thing to do (see Section 6).

Both scores should be published per-case (not just aggregated) — an aggregate score lets a few easy
cases hide failure on the hard ones, exactly the failure mode a "not a toy" tool needs to avoid.

##### 5.3 Keeping it honest: pre-registration and no peeking

The single biggest threat to a validation harness's credibility is silent parameter-tuning to the test
set — i.e., hand-fitting `displacementRate` or `gdpScaling` until the Alaska and Card-Krueger cases score
well, which would prove nothing about the model's genuine predictive power. Concretely:

1. **Version-pin every claim.** Every scored run records the exact git commit / model-config hash,
   timestamped before the case's outcome was inspected. A version's score is immutable once recorded;
   re-tuning requires a new version and a new score, never an edit to the old one.
2. **Hold out a subset.** Split the library into a "development" set builders can tune against and a
   "held-out" set whose outcomes stay unsurfaced until a model version is frozen and logged — the same
   discipline ML benchmarks and forecasting tournaments use against leaderboard overfitting.
3. **Pre-register the mapping, not just the parameters.** Before running a held-out case, write down
   which simulator inputs correspond to the real-world intervention (e.g. "Alaska PFD → set
   `distributionStrategy: hq-local`, `contributionRate` calibrated to $X/person/year") — choosing this
   mapping after seeing the outcome lets modelers quietly pick what fits.
4. **Publish failures.** A model that reports only the cases it passes is actively misleading — the CBO
   and Metaculus precedents work because they report everything, resolved or not, pass or fail.
5. **Re-run periodically as new data lands** — the Baby's First Years 4-year follow-up reversing its
   own 1-year finding is a reminder that "validated against early results" can later look wrong; show
   score history over time, not just the current value.

---

#### 6. Honest limits: what this cannot claim about AI-era scenarios

Every case in Section 2 is a historical natural experiment. None of them involves the thing this
simulator is actually built to reason about: **large-scale, rapid AI-driven labor displacement combined
with a corporation-funded, blockchain-distributed UBI at national/global scale.** No such event has
happened. That means:

- **No validation case can test the model's core mechanism** — corporate voluntary contribution
  dynamics, game-theoretic cooperation/defection among firms, direct-to-wallet distribution bypassing
  states. The closest analogues (Alaska PFD, GiveDirectly, Finland) test *UBI receipt effects on
  wellbeing/employment*, not the *corporate contribution/game-theory* arm — no historical case exists
  of firms voluntarily funding a UBI-like pool at scale. That mechanism is unvalidatable by definition;
  the tool should say so rather than implying it inherits the UBI-outcome literature's credibility.
- **Extrapolation risk compounds with horizon.** A model tuned to reproduce 1990s minimum-wage effects
  or a 1982–2020 Alaska panel, used prospectively, must extrapolate into a labor-market regime with
  different automation elasticities than any it was fit on. Passing backtests shows the model isn't
  *obviously* broken in-sample; it does not bound out-of-sample error, because that regime doesn't yet
  exist to measure.
- **Precedent: forecasting platforms don't pretend precision on unresolved questions.** Metaculus and
  Good Judgment track calibration only on *resolved* questions; overconfidence is measurable only in
  retrospect — Metaculus's resolved-AI-question track record is notably worse-calibrated than its
  all-domain average ([Rethink Priorities](https://rethinkpriorities.org/research-area/an-examination-of-metaculus-resolved-ai-predictions/),
  [LessWrong analysis](https://www.lesswrong.com/posts/oJ6wXoBqxJjHhPLLu/an-examination-of-metaculus-resolved-ai-predictions-and)).
  The honest analogue here is to **tag every output** as (a) interpolating within the validated
  historical range, (b) extrapolating beyond it along a validated mechanism, or (c) simulating a
  mechanism with no historical case at all — and distinguish those visually in the UI, the way
  Metaculus marks a question "open" rather than implying false resolved-accuracy.
- **Claim the tool can honestly make**: "under conditions resembling documented natural experiments,
  our income/employment/wellbeing mechanisms reproduce measured effects within published CIs in N of M
  cases." **Claim it cannot make**: "this is what a corporate-funded global UBI will do once AI
  displaces X% of jobs" — a projection under a never-validated mechanism, and should be labeled as such
  everywhere it appears.

---

#### Ranked recommendations

1. **Stand up the validation-case library and scoring harness before adding new simulation mechanics** —
   right now the simulator's forward equations have no empirical anchor at all; even 6 cases with honest
   CIs is a bigger credibility jump than any new feature.
2. **Treat income and employment as scoreable now (FRED/BLS/Census-backed); treat wellbeing as
   low-confidence** until a real state-level life-satisfaction time series is secured — BRFSS's
   life-satisfaction module isn't asked consistently and Gallup's comparable series is paywalled, so
   don't let the UI imply wellbeing predictions carry the same evidentiary weight as employment ones.
3. **Build the statistical layer as a Python sidecar (pysyncon, rdrobust, linearmodels/pyfixest, DoWhy),
   not a JS port** — there is no maintained JS/TS implementation of DiD, SCM, or RDD, and reimplementing
   Callaway-Sant'Anna-quality staggered-DiD correctness in-house is a multi-month research project, not
   a library swap.
4. **Explicitly wall off the corporate-contribution / game-theory mechanism as "unvalidated by
   construction"** in documentation and UI — it is the model's central novel claim and also the one
   piece with zero natural-experiment precedent; conflating it with the UBI-outcome evidence above would
   be the single biggest credibility risk.
5. **Publish score history, not just current scores, and pre-register model-version freezes** before
   scoring against any held-out case — the CBO forecast-record and Metaculus track-record precedents both
   derive their credibility from publishing everything over time, not from a one-time "validated" badge.

#### Six best first validation cases

1. **Alaska Permanent Fund Dividend (1982–present)** — the only long-running, real-world, universal
   cash-transfer program; directly on-thesis for a UBI simulator; synthetic-control estimate already
   published (Jones & Marinescu 2022) to match against.
2. **Cengiz, Dube, Lindner & Zipperer (2019) 138-state-episode minimum-wage bunching study** — dozens of
   state-level natural experiments in one uniform design, ideal for testing whether the simulator's
   labor-market response to a policy shock is state-comparable and dose-responsive.
3. **Finland Basic Income Experiment (2017–2018)** — RCT-grade, and the best available case for the
   simulator's specific claim that UBI raises wellbeing independent of employment effects.
4. **Oregon Health Insurance Experiment (2008 Medicaid lottery)** — true randomization, a clean
   "no effect on labor supply, real effect on financial strain/depression" result to test against a
   wellbeing model that shouldn't overstate income-transfer effects on employment.
5. **2021 expanded Child Tax Credit** — recent, state-and-national administrative data available (IRS
   advance-CTC by state, Census SPM), and its contested employment-effect literature is a useful
   discipline test for whether the harness reports genuine uncertainty rather than a false-precision
   point estimate.
6. **Kansas 2012 tax cuts** — a single-state "policy experiment" explicitly billed as such by its own
   architects, with a clear comparison-state design (Kansas vs. Nebraska/neighbors) and an unambiguous,
   well-documented negative result — good for testing whether the simulator can produce a *negative*
   or null finding rather than only ever recovering positive effects.

---

### B4. Squiggle evaluation

### Squiggle (QURI) as the uncertainty sub-language — research report

Date: 2026-09-12
Scope: evaluate `@quri/squiggle-lang` for embedding distribution literals (e.g. `0.04 to 0.15`,
`normal(0.3, 0.05)`) into this Vite/React/TS app, sampled by our own Monte Carlo /
time-stepping engine. Verified via primary sources (GitHub repo, npm registry) and a
real local install + sampling test in `/private/tmp/claude-502/squiggle-research/`
(not installed into the repo).

---

#### 1. License

**Verdict: MIT, fully compatible with an MIT app.**

- Root `LICENSE` at [quantified-uncertainty/squiggle](https://github.com/quantified-uncertainty/squiggle/blob/main/LICENSE)
  (fetched raw, verbatim): standard MIT text, `Copyright (c) 2020 Foretold` (Foretold was
  QURI's predecessor project — the monorepo inherited its license file; this is a single
  repo-wide license, not per-package).
- `packages/squiggle-lang/LICENSE` and `packages/components/LICENSE` do **not** exist as
  separate files (404 on raw GitHub) — the single root LICENSE covers the whole monorepo.
- Both `packages/squiggle-lang/package.json` and `packages/components/package.json`
  independently declare `"license": "MIT"` (confirmed via raw fetch of both files on `main`).
- Published npm package `@quri/squiggle-lang`: `npm view @quri/squiggle-lang license` →
  `MIT` (run 2026-09-12, from `/private/tmp/claude-502/squiggle-research`).
- GitHub API repo metadata also reports `license.spdx_id: MIT`
  ([api.github.com/repos/quantified-uncertainty/squiggle](https://api.github.com/repos/quantified-uncertainty/squiggle)).

MIT is permissive and compatible with distributing this project under MIT — no copyleft
obligations beyond retaining the copyright/permission notice for redistributed Squiggle
source.

---

#### 2. Bundle cost

Measured directly, not estimated.

- **npm registry metadata**: `npm view @quri/squiggle-lang dist.unpackedSize` → **3,858,060
  bytes (~3.86 MB) unpacked** for the package itself (published 0.10.0, tarball at
  `registry.npmjs.org/@quri/squiggle-lang/-/squiggle-lang-0.10.0.tgz`).
- **`npm install @quri/squiggle-lang` in a scratch dir**: pulled in **64 packages**
  (61 entries under `node_modules`, ~**38 MB** total `node_modules` footprint). The
  package's declared runtime `dependencies` are: `@commander-js/extra-typings`,
  `commander`, `d3-format`, `d3-time-format`, `immutable`, `ink`, `jstat`, `lodash`,
  `open`, `react`, `web-worker`, `@quri/serializer`. Several of these
  (`commander`, `ink`, `open`, `react`, `@commander-js/extra-typings`) exist **only to
  support the package's own CLI** (`squiggle` bin), not the library API.
- **Does the CLI weight leak into a browser bundle?** No, in practice. `dist/index.js`
  (the `.` export target) never imports anything under `dist/cli/*` — grepped for static
  imports of `ink`/`commander`/`open`/`react` from the CLI chain and confirmed those only
  appear inside `dist/cli/**`, which `index.js` never reaches. I proved this by actually
  bundling `export { run } from "@quri/squiggle-lang"` with esbuild
  (`platform=browser`, `format=esm`, `minify`):
  - **Result: 488.5 KB minified / ~144.8 KB gzipped** for the whole language engine
    (parser + interpreter + stdlib + stats), with **zero unresolved Node builtins** and
    no bundler errors/warnings.
  - Checked the output for leftover Node-isms: one guarded `typeof process === "undefined"
    ? undefined : process.env.SQUIGGLE_DEFAULT_RUNNER` (safe no-op in browsers) and one
    `try { require("util") } catch {}` (a defensive lodash-style feature-detect, caught,
    harmless). No `require(` calls that execute unconditionally, no `node:` protocol
    imports.
  - **Conclusion: runs in the browser with no Node polyfills needed**, as long as you
    import only from the package root (`@quri/squiggle-lang`) and not `bin/squiggle.js`.
- **WebAssembly**: none. `find node_modules/@quri/squiggle-lang -iname "*.wasm"` returned
  nothing — pure TypeScript/JS (parser generated by Peggy, compiled to `.js`).
- **Dynamic import**: yes — it's a standard ESM package (`"type": "module"`,
  `exports["."] = "./dist/index.js"`), so `await import("@quri/squiggle-lang")` /
  Vite code-splitting works normally. There's also a separate export
  `./runners/WebWorkerRunner` for offloading evaluation to a Web Worker (uses the
  `web-worker` dependency), useful if large Monte Carlo runs should not block the main
  thread.

##### Working sample test (exact API used)

Ran in `/private/tmp/claude-502/squiggle-research/test.mjs` against the real installed
package:

```js
import { run } from "@quri/squiggle-lang";

const code = `
x = 0.04 to 0.15
result = {mean: mean(x), p5: quantile(x, 0.05), p95: quantile(x, 0.95)}
`;

const output = await run(code);                 // Promise<SqModuleOutput>
const bindings = output.getBindings();           // result<SqDict, SqErrorList>
const resultVar = bindings.value.get("result");  // SqValue, tag "Dict"
const plain = {};
for (const [k, v] of resultVar.value.entries()) plain[k] = v.value;
console.log(plain);
```

**Actual output:**
```
{ mean: 0.08427115722826584, p5: 0.03901869604575305, p95: 0.1448763707259067 }
```

Note `0.04 to 0.15` is **not** a uniform distribution — Squiggle's `to` operator builds a
distribution (by default lognormal-shaped) whose 5th/95th percentiles are pinned to the
two numbers given; that's why mean (0.084) sits below the arithmetic midpoint (0.095) and
p5/p95 land almost exactly on 0.04/0.15. Worth knowing before treating `a to b` as "range."

A second test (`test2.mjs`) confirmed raw-sample extraction:
```js
const ss = bindings.value.get("ss").value;  // SqSampleSetDistribution
const samples = ss.getSamples();             // readonly number[] — plain JS numbers
```
`getSamples()` returned **1000 numbers** (Squiggle's default `sampleCount` is 1000,
matching the task's ask out of the box) — mean computed from raw JS numbers matched the
API's own `.mean(env)` exactly.

---

#### 3. Language fit

**Both requirements are met.**

- **External variables → Squiggle expression:** `@quri/squiggle-lang`'s public API
  (`run(code, {environment})`) does not expose a "bindings/variables" injection object —
  the `environment` option only configures sampling settings (`sampleCount`,
  `xyPointLength`, etc.), not external values. The supported pattern (and the one used in
  Squiggle's own docs/playground embedding) is **template the externally-computed JS
  number straight into the source string** before calling `run()`:
  ```js
  const growthRate = computeFromOurEngine(); // plain JS number
  const code = `x = ${growthRate} to (${growthRate} * 1.6)`;
  const output = await run(code);
  ```
  This is simple and safe here because our values are always numeric (no string
  interpolation/injection risk). Verified working in `test2.mjs`. There is also a more
  structured multi-module mechanism (`SqProject`, `SqModule`, `SqLinker`,
  "imports"/"exports" fields on `OutputResult`) for importing one Squiggle *module* from
  another, but that's for composing Squiggle source files, not passing JS objects — string
  templating is the right tool for our use case.
- **Distribution object we can sample from ourselves:** yes. A bound Squiggle value with
  `tag === "Dist"` wraps an `SqDistribution` (`SqSymbolicDistribution` /
  `SqPointSetDistribution` / `SqSampleSetDistribution`). Confirmed via
  `node_modules/@quri/squiggle-lang/dist/public/SqValue/SqDistribution/index.d.ts`:
  - `SqSampleSetDistribution.getSamples(): readonly number[]` — direct array of raw JS
    numbers, exactly what a home-grown time-stepping/Monte Carlo loop needs.
  - `.mean(env)`, `.stdev(env)`, `.pdf(env, n)`, `.cdf(env, n)`, `.inv(env, n)` (inverse
    CDF / quantile) available on every distribution tag without needing our own math.
  - `SampleSet.fromDist(dist)` (Squiggle stdlib function) converts any distribution to a
    sample set, confirmed working in `test2.mjs` (`dist subtype: SampleSet`, 1000 samples
    returned).

  So our own simulation stays in charge: Squiggle only parses the distribution literal
  and (optionally) samples it; we pull the raw numbers out via `getSamples()` and drive
  our existing month-by-month engine (`simulation/pure.ts` etc.) exactly as today, just
  swapping a hand-rolled RNG call for `sqDist.getSamples()[i]`.

Docs referenced: [squiggle-language.com/docs/Api/Dist](https://www.squiggle-language.com/docs/Api/Dist),
[squiggle-language.com/docs/Discussions/Three-Formats-Of-Distributions](https://www.squiggle-language.com/docs/Discussions/Three-Formats-Of-Distributions).

---

#### 4. Alternatives (if Squiggle is unsuitable)

| Option | License | Last publish | Unpacked size | Notes |
|---|---|---|---|---|
| **Home-grown** `{dist:'lognormal', p5, p95}` + small sampler | n/a (ours) | n/a | ~0 (a few dozen LOC) | Full control, zero new dependency/license surface, trivially matches existing `ModelParameters` typing. Needs us to hand-write inverse-CDF/Box-Muller for normal/lognormal/uniform/beta — a solved, small problem (~100 lines) for the handful of distribution shapes this app actually needs. |
| `jstat` | MIT (old-style `licenses` array, confirmed via `npm view jstat --json`) | 2022-11-21 (~4 yr stale) | 706 KB unpacked | Already a **transitive dependency of squiggle-lang itself**. Full stats library (pdf/cdf/inv for many distributions) but no expression-language layer — we'd still write our own literal syntax/parser. |
| `d3-random` | ISC (permissive, MIT-compatible) | 2022-06-14 (~4 yr stale) | 38 KB unpacked | Tiny, just RNG generators (`randomNormal`, `randomLogNormal`, `randomUniform`, etc.), no percentile-parameterization (p5/p95 → params) built in — we'd add that math ourselves. Very low bundle cost. |
| `simple-statistics` | ISC | **2026-09-08** (4 days old — actively maintained) | 1.35 MB unpacked | Broader stats toolkit, more actively maintained than jstat/d3-random, but same story: no distribution-literal parser. |
| `probability-distributions` | MIT | 2022-06-24 (~4 yr stale, low adoption) | small | Niche, unmaintained-looking; not recommended. |

**Recommendation: do not add a second, heavier alternative for its own sake.** If Squiggle
itself is rejected (e.g. team doesn't want a DSL/parser dependency at all), the better
fallback is the **home-grown literal** (`{dist:'lognormal'|'normal'|'uniform', p5, p95}`
or `{dist:'normal', mean, sd}`) plus `d3-random` (38 KB, ISC, actively fine even if not
recently republished — the API is stable and there's nothing to fix) for the actual RNG
draws, with a ~30-line inverse-CDF helper to turn p5/p95 into distribution parameters.
This mirrors exactly what Squiggle's `to` operator does internally, at near-zero bundle
and license cost, and keeps the parameter format aligned with `types.ts`/`ModelParameters`
instead of introducing a second expression language for contributors to learn.

---

#### 5. Maturity and risk

- **Release cadence / npm lag (biggest risk):** npm's `latest` dist-tag is **0.10.0**,
  published **2024-12-07** — almost **21 months old** as of this report (2026-09-12).
  `main`'s `packages/squiggle-lang/package.json` is already at **0.10.1**, but
  `npm view @quri/squiggle-lang@0.10.1` returns **404 — not published**. So the npm
  package is meaningfully behind the repo's `main` branch; anyone installing from npm
  today does **not** get ~21 months of fixes/changes. 28 versions published total
  (0.2.12 → 0.10.0) over the package's life, so cadence was healthy earlier but appears
  to have stalled recently for the `-lang` package specifically (repo itself is still
  actively pushed — last push 2026-08-11 per GitHub API).
- **Adoption:** `npm view` weekly downloads for `@quri/squiggle-lang` = **97/week**
  (`api.npmjs.org/downloads/point/last-week/@quri/squiggle-lang`, week of 2026-09-05).
  Small but non-zero; this is a niche EA/forecasting-community tool, not a mainstream
  JS package.
- **Repo health (GitHub API,** [api.github.com/repos/quantified-uncertainty/squiggle](https://api.github.com/repos/quantified-uncertainty/squiggle) **):**
  218 stars, 29 forks, MIT license confirmed, last push 2026-08-11.
  Open issues: **254**, open PRs: **48** (GitHub search API,
  `is:issue is:open` / `is:pr is:open`) — a fairly large backlog for a project this size,
  suggesting maintainers are stretched.
- **Bus factor:** contributor stats (`api.github.com/repos/.../contributors`) show **26**
  distinct contributors, but heavily concentrated: top 2 humans (`berekuk`, `OAGr` — OAGr
  is Ozzie Gooen, QURI's founder/director) account for **~6,866 of ~8,700+ total
  contributions**, i.e. roughly **two people** carry the large majority of the codebase
  (plus `dependabot[bot]` inflating the raw count with dependency-bump commits). This is a
  **real bus-factor risk** for a dependency this specialized — if QURI's funding or focus
  shifts away from Squiggle, there's a thin bench to keep it maintained.
- **Scope/complexity:** Squiggle is a full language (parser, type system, stdlib,
  playground, serialization format) built for probabilistic *forecasting/estimation*
  workflows (Squiggle Hub, Metaforecast) — considerably more machinery than this app
  needs for "parse a distribution literal and sample it."

---

#### 6. Sources

- [github.com/quantified-uncertainty/squiggle](https://github.com/quantified-uncertainty/squiggle) — repo root
- [github.com/quantified-uncertainty/squiggle/blob/main/LICENSE](https://github.com/quantified-uncertainty/squiggle/blob/main/LICENSE)
- [github.com/quantified-uncertainty/squiggle/blob/main/packages/squiggle-lang/package.json](https://github.com/quantified-uncertainty/squiggle/blob/main/packages/squiggle-lang/package.json)
- [github.com/quantified-uncertainty/squiggle/blob/main/packages/components/package.json](https://github.com/quantified-uncertainty/squiggle/blob/main/packages/components/package.json)
- [npmjs.com/package/@quri/squiggle-lang](https://www.npmjs.com/package/@quri/squiggle-lang)
- [squiggle-language.com/docs](https://www.squiggle-language.com/docs)
- [squiggle-language.com/docs/Api/Dist](https://www.squiggle-language.com/docs/Api/Dist)
- [squiggle-language.com/docs/Discussions/Three-Formats-Of-Distributions](https://www.squiggle-language.com/docs/Discussions/Three-Formats-Of-Distributions)
- `npm view @quri/squiggle-lang license version dist.unpackedSize dependencies` (run locally, 2026-09-12)
- `api.github.com/repos/quantified-uncertainty/squiggle` (repo metadata, issues, contributors, commits)
- `api.npmjs.org/downloads/point/last-week/@quri/squiggle-lang` (download stats)
- Local test artifacts: `/private/tmp/claude-502/squiggle-research/test.mjs`,
  `/private/tmp/claude-502/squiggle-research/test2.mjs`,
  `/private/tmp/claude-502/squiggle-research/bundle.js` (esbuild browser bundle output)

## Appendix C. Gamification note (verbatim)

---

### C1. Gamification ideas

### Gamification that teaches, not flatters

Design note, 2026-09-12. Question: how to make the site pleasant and instructive without turning a
forecasting and policy tool into a toy. The bar is the owner's: utility and correctness. Every
mechanic below is judged by one test: **does it make the model's assumptions more visible, or less?**
A mechanic that makes people feel clever while hiding what the model assumes is a loss, however fun.

---

#### 1. Principles

Five, drawn from games that actually teach.

1. **The world pushes back, honestly.** Kerbal Space Program teaches orbital mechanics because the
   rocket falls when your intuition is wrong, and the physics never lies to be kind. Factorio teaches
   throughput because the belt backs up. The lesson is not "make it fun", it is "make consequences
   legible and undeniable". For us: every drag, every card, every vote must show its consequence
   through the real engine, never through a canned animation.

2. **Reveal the machine.** Universal Paperclips is a joke about a paperclip maximiser, and it works
   because the player becomes the maximiser and feels the pull. Papers Please makes you complicit in
   the rules. The best mechanics here put the user inside the model's assumptions: you set the
   coefficient, you feel what it implies, you argue with it. A mechanic that only lets people pull
   levers without seeing the equations behind them teaches superstition.

3. **Score calibration, never popularity or extremity.** Metaculus works because your Brier score
   improves by being right and well-calibrated, and the community median is a recency-weighted median
   that a single loud vote cannot move. A leaderboard of "most upvoted future" would reward
   confident, extreme, dramatic claims and would poison the expert and public tiers within a month.
   Reputation must be earned only by resolved predictions.

4. **Small, complete loops.** Wordle is one puzzle a day with a shareable card that shows your
   process, not your answer. Duolingo streaks work until they become guilt. The honest version: a
   short daily loop (one question, one guess, one reveal) with a share card that shows reasoning and
   uncertainty, and no punishment for missing a day.

5. **Difficulty should come from the world, not from the interface.** Papers Please is hard because
   the rules are complex and the stakes are moral, not because the UI fights you. Our hard parts are
   real (interventions interact, timing matters, data are thin). The interface should be frictionless
   so the difficulty people meet is the real one.

What corrupts a forecasting tool, explicitly: upvote leaderboards; points for participation volume;
badges for extreme positions; any score that resolves before the world does; "win" states that imply
the model is settled; and animations that suggest precision the model does not have.

---

#### 2. Mechanics

Effort: S = days, M = a week or two on top of the unified core, L = a month or more. "Needs" lists what
the mechanic requires from the core, so the shortlist can be mapped to fixture models and validation
cases in section 4.

##### 2a. Mirror
- **Does:** after applying an intervention as one actor (the US bans chip exports to China), the user
  taps "mirror" and sees the same policy applied by other actors (China bans rare-earth exports to the
  US, the EU does both, India does neither), side by side, with the outcome differences explained by
  the parameters that differ: manufacturing base, import dependence, share of the frontier, ally
  alignment. A short "why it differs" panel lists the three parameters with the largest contribution.
- **Learns:** policy effects are not symmetric; the same lever pulled from a different seat has a
  different, sometimes opposite, result, and the reason is structural, not moral.
- **Needs:** per-actor parameterisation in the core (a country or bloc is an overlay of parameters
  on shared equations), interventions written against roles ("exporter", "target") rather than named
  countries, and a sensitivity routine that attributes the outcome gap to parameters.
- **Effort:** M once the core exists; L without it.
- **Risk:** an actor whose parameters are not calibrated produces confident nonsense. Mirror should
  refuse actors whose parameters are unsourced and say so.

##### 2b. Direct manipulation of curves and arrows, maths honoured
- **Does:** on touch, drag a band on the goodness chart up or down, or drag an arrow's thickness in
  the influence graph. The engine treats a dragged band as a pinned target and solves for the
  log-odds shift that reproduces it; the rest of the graph responds live. Dragging an arrow changes
  its strength coefficient, and the panel shows the coefficient, its allowed range and its source,
  greyed if the user has left the sourced range.
- **Learns:** what it costs to move one thing, because other things move; and that arrow strengths
  are claims with sources, not free dials.
- **Needs:** an inverse solve (given a target probability for one node, find the shift), which the
  current engine can do by bisection in a millisecond; coefficient ranges and sources on every edge.
- **Effort:** S for bands, M for arrows.
- **Risk:** drags feel authoritative. Anything dragged outside its sourced range must render hatched
  and labelled "your assumption", and never persist into any tier.

##### 2c. Predict, then reveal
- **Does:** a validation case is presented as a puzzle: "In 2012 Kansas cut its top income tax rate
  from 6.45% to 4.9%. By 2017, how did its job growth compare with Nebraska's?" The user sets a range
  and a confidence. Then the published estimate and its confidence interval are revealed, and the
  model's own pre-registered prediction is shown beside both. The user gets a Brier or interval score;
  so does the model. Cases: Kansas, Alaska dividend, Finland basic income, Oregon Medicaid, the 2021
  child tax credit, the minimum-wage panel, Stockton.
- **Learns:** how wrong intuition is about real policy, and that the model is scored the same way.
  This is the Freakonomics feel the owner wants, done honestly.
- **Needs:** the validation-case library with published effect sizes and intervals; the model's
  frozen predictions per version.
- **Effort:** S for the quiz, M to show the model's own score beside the user's.
- **Risk:** people learn the answers and replay. Keep a bank of at least twenty cases and rotate.

##### 2d. Shareable result cards
- **Does:** any state of the chart or any prediction becomes a card: a small image plus a link that
  reproduces the exact state (the URL-hash share already exists). The card shows the change as a
  dashed-before, solid-after pair, the three biggest movers, the interventions on, and a footer that
  says which tier's numbers it used and the model version.
- **Learns:** nothing directly, but it is the growth loop, and the footer keeps the provenance
  attached to every screenshot that leaves the site.
- **Needs:** server-side or canvas image rendering of the chart; the existing share encoding.
- **Effort:** S.
- **Risk:** cards without the provenance footer become "the site says 8% extinction". The footer is
  not optional.

##### 2e. Daily question tied to the news
- **Does:** one question a day, drawn from the map's nodes or a validation case, prompted by a real
  headline: "Reports today say X lab compressed its safety review. Does this move your 'frontier race'
  estimate?" The user answers in ten seconds. Answers feed the public tier as ordinary estimates and
  the user sees how the pooled number moved.
- **Learns:** how to update on evidence, and how small one person's update is against a pool.
- **Needs:** a curated headline feed (a human or an agent proposing three per day for editor
  approval), the estimate store.
- **Effort:** S for the mechanic, ongoing editorial cost.
- **Risk:** news-driven updating trains overreaction. Show the pooled number's 30-day path so the
  user sees that most days move nothing.

##### 2f. Experts versus you
- **Does:** after the user has estimated a few nodes, a panel shows their curve against the expert
  tier and the public tier, with the spread, and names the three nodes where they differ most. One
  tap opens the expert reasoning notes for that node (experts can attach a one-line rationale).
- **Learns:** where the user is an outlier and why the experts think what they think.
- **Needs:** expert tier populated (a dozen people minimum), rationale field on estimates.
- **Effort:** S.
- **Risk:** anchoring: showing the expert number before the user commits destroys the signal. Always
  collect first, reveal after.

##### 2g. Challenge modes
- **Does:** a constrained optimisation puzzle: "Get existential under 3% by 2045 with total cost band
  at most 8. Interventions available: these twelve." The user picks a set; the engine scores mean
  shift, floor lift, cost, and shows the cost curve. A second challenge type: "Reach the same result
  from China's seat." The best solutions are shown as a set, not a ranking, with the assumptions each
  one leans on.
- **Learns:** trade-offs, interactions between interventions (once the core supports conditional and
  lagged effects), and that different seats have different feasible sets.
- **Needs:** cost profiles over time, interaction terms in the core, per-actor overlays.
- **Effort:** M.
- **Risk:** it is easy to make this feel like a solved game. Every challenge page must state which
  coupling coefficients its answer depends on and how contested they are.

##### 2h. Reputation from calibration only
- **Does:** a user's reputation is their Brier score on resolved questions and validation cases,
  shown with the count of resolved items. Nothing else counts: not votes, not participation, not
  challenge scores. Reputation weights their estimates in the public pool, capped (weight 0.5 to 3,
  the range the aggregation already supports). Experts start at weight 1 and are subject to the same
  scoring.
- **Learns:** that being right over time is the only currency, and that the site treats experts and
  the public by the same rule.
- **Needs:** resolution of questions (a curator marks nodes or daily questions resolved), the
  estimate log with timestamps.
- **Effort:** M.
- **Risk:** almost nothing in the map resolves before 2028. In the first two years reputation would
  come almost entirely from the validation-case quizzes and daily questions on near-term events, and
  the UI must say so.

##### 2i. Story mode, walk a path
- **Does:** pick an ending, and walk backwards through the highest-contribution chain one screen at
  a time, with the lane animating beside plain-English narrative from the node files. At each step
  the user can nudge and see the ending change. (Designed in v0, not built.)
- **Learns:** the actual mechanisms, especially the non-Terminator ways things go wrong, which was the
  original motivation for the map.
- **Needs:** node narratives (already in the seed data), the propagation engine.
- **Effort:** S.
- **Risk:** narrative is persuasive. Each screen must show the number and its source chip beside the
  prose.

##### 2j. Time scrubbing as the primary control
- **Does:** the year scrubber drives everything on the page at once: chart, lanes, country map
  colours, the readout. Press and hold to play forward. On the country simulator, the same scrubber
  runs the months.
- **Learns:** that most divergence between futures happens late, and when interventions with lags
  begin to bite.
- **Needs:** nothing new; both engines already produce per-year and per-month series.
- **Effort:** S.
- **Risk:** none of note.

##### 2k. Fork a target model
- **Does:** a dropdown of the fixture models (Korinek 2026, the country simulator, the futures map,
  the toy, the toy plus one variable, the two-intervention model, the state-overlay model, the
  hindcast). Pick one, it loads as the starting point, the user edits parameters or adds a variable,
  and the diff against the original is always visible. A fork can be shared, and the original's
  authors are credited on every fork.
- **Learns:** how published models are built, and how little or how much a conclusion depends on a
  parameter.
- **Needs:** the unified core with the fixture models as loadable files; diff rendering.
- **Effort:** S once the core exists; it is the core's natural UI.
- **Risk:** forks that drift far from the original still carry its name. The diff and a "modified"
  badge must be unremovable.

##### 2l. Sensitivity heatmap
- **Does:** for the current state, one tap shows which parameters the headline numbers depend on
  most, as a ranked bar list with the parameter's source and range. Tap a bar to jump to that
  parameter and drag it.
- **Learns:** which assumptions matter and which are decoration.
- **Needs:** a sensitivity routine (one-at-a-time perturbation is enough to start).
- **Effort:** S.
- **Risk:** none of note; this is the most honest mechanic on the list.

##### 2m. Country seat selection
- **Does:** the user chooses a seat (a country or bloc) at the start of a session. All interventions,
  costs and mirror results are then framed from that seat, and the public tier can be sliced by seat.
- **Learns:** how differently the same future looks from Lagos, Shenzhen and Ohio.
- **Needs:** per-actor overlays and seat-tagged estimates.
- **Effort:** M.
- **Risk:** seat-sliced public tiers get thin fast. Show n and suppress below the usual threshold.

##### 2n. Consequence receipts
- **Does:** after a user applies an intervention, a receipt lists what it bought and what it cost:
  mean shift, floor lift, ceiling lift, cost band, and the two or three assumptions the result leans on
  hardest, with their sources. The receipt is what gets shared, not a bare number.
- **Learns:** that every result has a price and an assumption list.
- **Needs:** the metrics already computed plus the sensitivity routine.
- **Effort:** S.
- **Risk:** none of note.

---

#### 3. Shortlist for the first release, and rejections

Ranked. Criteria: honesty (assumptions more visible), learning per minute, and feasibility on the
unified core within the first release.

1. **Predict, then reveal (2c).** It is the Freakonomics experience the owner asked for, it works
   with a library of only six cases, it scores the user and the model by the same rule, and it is the
   foundation of an honest reputation system. It also forces the validation library to exist early,
   which is the single most important credibility step.

2. **Direct manipulation with sourced ranges (2b) plus the sensitivity heatmap (2l).** Counted as one
   because they share the machinery. Together they turn the chart into an instrument rather than a
   picture: drag a thing, see what it costs, see which assumption it leaned on. This is the mechanic
   that makes the model's assumptions visible by construction.

3. **Mirror (2a).** The owner's strongest idea, and it teaches something no other tool does. It
   depends on per-actor overlays, which the unified core must have anyway for state-versus-state
   policy, so it rides on work that is planned.

4. **Fork a target model (2k) with shareable receipts (2n).** The dropdown of published models is the
   natural front door of the unified core, and it is also the outreach mechanic: authors whose model
   can be loaded, forked and cited from a URL will use and cite the site. Receipts keep provenance on
   everything that leaves.

Explicitly rejected, at least for the first release:

- **Reputation from calibration (2h).** Right in principle, wrong now. Almost nothing on the map
  resolves before 2028, so any visible reputation in year one would be built on a handful of quiz
  answers and would read as noise with a badge on it. Log the data from day one, show no reputation
  until at least fifty resolved items exist per user.
- **Challenge modes (2g).** They need interaction terms and cost profiles the core does not have
  yet, and without those the "best" answer is an artefact of additive log-odds. Shipping it early
  would teach the wrong lesson with a trophy attached.
- **Daily question tied to the news (2e).** Good mechanic, wrong moment. It needs a daily editorial
  process and a populated public tier to be anything other than an empty room, and it trains
  overreaction unless the pooled path is shown. Revisit once a few hundred people are voting.

Also declined: any upvote leaderboard, any points for participation, and any "you saved the world"
end state.

---

#### 4. Mapping the shortlist onto the unified core

| Mechanic | Fixture models it needs | Validation cases it needs | Core features it needs |
|---|---|---|---|
| Predict, then reveal | The hindcast model (2015 to 2025) as the scored baseline; the country simulator with a state overlay for Kansas and Alaska | Alaska dividend, Kansas 2012, Finland basic income, Oregon Medicaid, 2021 child tax credit, the minimum-wage panel, Stockton or Los Angeles BIG:LEAP | Frozen per-version model predictions; case file format with effect size and interval; Brier and interval scoring |
| Direct manipulation + sensitivity | The futures map and the toy plus one variable (to prove drags work on a three-node model too) | None | Inverse solve for a pinned target; coefficient ranges and sources on every edge and parameter; one-at-a-time sensitivity |
| Mirror | The two-intervention model; the state-overlay model generalised to country and bloc overlays; Korinek 2026 as the US economic overlay | None to start; later the minimum-wage panel as a "same policy, different states" demonstration | Interventions written against roles; per-actor parameter overlays with sources; attribution of outcome gaps to parameters |
| Fork a target model + receipts | All eight fixtures, each loadable and diffable | None | Model file loader with diff; author credit metadata in every model file; receipt generation from existing metrics plus sensitivity |

Two consequences for the core spec:

- **Roles, not names, in interventions.** "Exporter restricts chips to target" must be expressible
  once and instantiated for any actor pair. That is a schema requirement, not a UI nicety.
- **Sources and ranges are mandatory on every coefficient.** Three of the four shortlisted mechanics
  depend on being able to say "you left the sourced range" or "this result leans on parameter X from
  source Y". Unsourced coefficients should be legal only in a fork and always rendered as such.

One last note on the owner's gesture idea. Dragging importance is exactly mechanic 2b, and it is
honest as long as the drag maps to a real quantity with a real range. Gestures that map to nothing in
the model (shaking, swiping for emphasis) would be decoration, and decoration on a forecasting tool
reads as manipulation. Keep every gesture attached to a number the user can read.

## Appendix D. Decision log

- Log-odds influence graph kept as the probability node kind; deviation-based so seeds reproduce.
- Cycles allowed only across a lag; no solver (open question in section 5).
- Squiggle declined; home-grown distribution literal.
- Entities and roles added so interventions mirror across actors.
- Validation library before product mechanics.
- Static hosting with Firebase for votes; Python only in CI.

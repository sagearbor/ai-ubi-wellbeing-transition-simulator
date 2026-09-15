# Transition Simulator v3 — flexible models, a dependable default, and meaningful limits

Date: 12 September 2026  
Status: design for implementation; no new application code or empirical validation claimed  
Audience: Sage, Claude Code Fable, and implementation reviewers  
Replaces: v2's product priorities and release sequence. Preserve v1 and v2 as the review history. This document states the current requirements; v2 retains the detailed source audit.

## 1. What we are building, in executive terms

Build a visual environment where people explore which policies could improve the AI transition, discover what prevents those policies from working, and inspect the assumptions behind the answer. Keep the existing map, playback, charts, corporations, Futures views, and public front door.

Most visitors start with one clearly identified, reviewed default. They change meaningful policy choices: funding, eligibility, implementation timing, coverage, or other supported interventions. The model works through the consequences, including resource limits, delays, and uncertain behavioral responses. Users should see why another dollar or a bigger intervention does little when a particular constraint is binding.

Researchers and advanced users can add variables, alter relationships, import new models, and compare theories. Their changes produce explicitly identified experimental versions. The public default does not change simply because somebody produced a dramatic chart.

**The product combines broad extensibility with a disciplined default experience.** It must neither let arbitrary coefficients masquerade as established policy effects nor suppress a real mechanism because its implications are dramatic.

The desired result is a useful statement such as: “Under these assumptions, additional training money makes little difference because suitable job openings are the limiting factor. Here is the evidence for that constraint, and here is what changes if the constraint is different.” It is not a promise that the simulator has discovered the uniquely true solution.

## 2. Corrections to the latest discussion

Claude's distinction between stepping forward, solving an equilibrium, and optimizing over time is a useful introduction. The following claims go too far:

| Claim | Correction and consequence |
|---|---|
| “The mathematics is not the barrier.” | A short list of equations can still involve coupled nonlinear systems, multiple equilibria, expectations, discrete choices, or difficult identification. Equation count is a poor estimate of implementation difficulty. Evidence quality and numerical correctness both matter. |
| A generic step/equilibrium engine covers “nearly every model you would care about.” | That coverage has not been established. Support specific mathematical capabilities and demonstrate generality on additional models. Never imply that an arbitrary cycle of equations can be solved by inserting a scalar root finder. |
| “No such framework already exists off the shelf.” | Broad open-source modeling frameworks already exist. Dynare supports multiple economic model classes and numerical methods; Mimi supports component-based integrated assessment models; ModelingToolkit supports multiple equation types and solver interfaces. These are useful foundations or references, although none is automatically this product's complete browser application. [Dynare](https://www.dynare.org/about/), [Mimi](https://www.mimiframework.org/Mimi.jl/dev/), [ModelingToolkit](https://docs.sciml.ai/ModelingToolkit/stable/). |
| Small changes should always produce small outcomes. | This is a good question to investigate, not a universal rule. A policy threshold, a binding constraint, compounding over a long horizon, or positive feedback can produce a large response. Diagnose the source instead of forcing a smooth answer. |

Our contribution is the accessible interface, model/evidence integration, explanation of constraints, and reproducible policy exploration. We do not need to claim that we invented general economic modeling.

GATE remains deferred as a particular integration project. Optimization is not prohibited by the long-term architecture; it can use an appropriate existing numerical engine when there is a concrete implementation case.

## 3. Two ways to use the same product

### Explore policies — the default

Open the current site and see the current map or saved view, a named default model version, its scope, and a short explanation of its evidence limits. Policy controls change quantities that a policymaker could actually influence. Show the baseline, the proposed change, the result, and the main modeled constraint.

Keep three distinctions visible without a wall of caveats:

- **What you chose:** the policy intervention and funding assumptions.
- **What the model assumes:** uncertain responses, exogenous AI progress, and other conditions.
- **What limits the result:** an active modeled constraint, missing evidence, or an unsupported mechanism.

Ordinary policy exploration preserves the reviewed equations. Users can inspect alternative assumptions through an expandable panel. Moving outside the reviewed parameter region creates an explicitly marked extrapolation or experimental scenario; it does not silently retain the same applicability claim.

### Build or modify a model — the authoring workspace

Offer the same visual outputs with tools to add variables, equations, constraints, and evidence. AI helps translate papers and proposals into a reviewable draft. Authors can also edit the model file directly.

Changing model structure creates a fork automatically. Private experiments do not require expert permission. Sharing a fork retains its experimental status, model/version, scenario scope, and a concise change description in the page and generated chart exports. Adding a source citation does not automatically make a fork part of the reviewed default.

Promotion into the default library requires numerical review, applicable evidence checks, and a documented scope decision. Existing expert/public voting can express disagreement about assumptions; popularity is not a promotion criterion for scientific validity.

These are two interface modes over the same model and run records. Do not create two disconnected applications or restrict open-source users from studying unusual hypotheses.

## 4. Select and qualify the default explicitly

The initial candidate is the existing world/corporation model, incrementally repaired and limited to the mechanisms and geographic detail it can actually support. Do not replace it wholesale with Korinek or a newly invented universal model. Korinek and later published models are available reference choices, not the definition of the product.

**The current candidate has not yet earned the reviewed-default designation.** The previous audit found biased baseline equations, a Korinek-inspired approximation presented too strongly, and fitted historical relationships that do not establish forecast accuracy. Preserve the interface while repairing those claims and calculations.

Qualification requires a compact, versioned model card:

| Required item | What the implementer must provide |
|---|---|
| Scope | Supported geography, populations, dates, outcomes, and policy mechanisms; unsupported map regions remain unestimated. |
| Causal structure | How each public lever reaches outcomes, including important missing channels and external assumptions. |
| Accounting | Household/firm/public flows actually modeled, their units, funding boundaries, and identities. Transfers cannot be counted as newly created resources. |
| Constraints | Capacity, eligibility, financing, timing, or behavioral limits, each with its equation and provenance. |
| Input region | Reviewed parameter ranges and joint restrictions, why they were selected, and what extrapolation means. This region is not automatically a probability distribution. |
| Evidence | Which relationships are causal, associational, calibrated, elicited, or assumed, with applicable populations and dates. |
| Response review | Sensitivity results, binding constraints, tipping behavior, solver failures, and unresolved discrepancies. |
| Evaluation | Implementation checks, reproduction where relevant, historical errors, case coverage, and fitting history. |

Do not select a default merely because it produces moderate-looking curves, matches a preferred political conclusion, or agrees with the most other models. If only a narrower scope qualifies, publish that scope and mark broader results illustrative. A reviewed default is a maintained reference with disclosed limitations, not a certified forecast of the future.

The Futures influence model remains available with its own scope and assumptions. Economic calibration does not validate its catastrophe probabilities or a spending-to-safety relationship. Preserve the visual continuity without manufacturing a causal link between economic and risk outputs.

## 5. Make limits part of the model, not decoration on the chart

Users want to find out when an apparently useful intervention runs out of effect. Several different kinds of limit must not be confused:

| Kind of limit | Product treatment |
|---|---|
| Accounting or definitional limit | Enforce the identity or admissible domain: recipients cannot exceed the eligible population; a declared budget must reconcile. Financing must be specified if spending exceeds existing funds. |
| Capacity or behavioral limit | Compute the constraint or response from the selected model. Show its evidence and whether it is estimated or assumed. Capacity may change over time when that mechanism is modeled. |
| Deliberate model assumption | Say that a fixed workforce, adoption ceiling, or other closure is assumed. Do not describe it as a proven real-world limit. |
| Evidence boundary | Explain that extrapolation is uncertain. Lack of evidence is not a numerical cap and is not a zero effect. |
| Numerical or display boundary | Report a failed solve or a clipped display honestly. Do not pretend a numerical guard or chart ceiling is an economic bottleneck. |

Every public policy mechanism must declare: **what it changes, through which relationship, who pays, who can benefit, when it acts, and what limits or amplifies its effect**. If the model has no relevant limit or omits an important one, record that rather than adding an arbitrary saturation term.

Account for funding and resource use without assuming every policy must have a negative tradeoff. Efficiency improvements and mutually beneficial policies are possible. Conversely, an unexplained benefit cannot be made credible by appending an invented cost.

### Worked example: training funding meets a jobs constraint

The following is a deliberately simple teaching model. All numbers and relationships are assumptions for illustration; none is an empirical estimate or a proposed real policy.

Consider one year, 10,000 eligible people, a training cost of $5,000 per completion, instructor capacity of 3,000 completions, a 50% potential placement rate, and 1,000 suitable openings available to this program. Funding is assumed available for this illustration; its wider financing effects are not modeled.

```text
completions = min(training_budget / cost_per_completion,
                  instructor_capacity, eligible_people)
actual_training_spend = completions * cost_per_completion
unspent_budget = training_budget - actual_training_spend
placements = min(completions * placement_rate, suitable_openings)
```

| Authorized budget | Completions | Actual training spend | Placements in this channel |
|---:|---:|---:|---:|
| $6 million | 1,200 | $6 million | 600 |
| $10 million | 2,000 | $10 million | 1,000 |
| $11 million | 2,200 | $11 million | 1,000 |
| $20 million | 3,000 | $15 million | 1,000 |

At $11 million, suitable openings prevent additional placements despite more training. At $20 million, instructor capacity also limits completions and $5 million remains unspent. These are modeled constraints, not an instruction to flatten the outcome chart.

Display: **“Additional training produces no additional placements here because suitable openings are fully used.”** Let the user inspect the openings assumption. A diagnostic experiment may relax it, clearly labeled hypothetical. Actually creating openings requires its own mechanism, timing, costs, and evidence; the simulator must not present a free increase in vacancies as a policy solution.

This example tracks gross placements through one channel. It does not establish net employment effects, displacement of other workers, earnings effects, or the broader value of education. It is an arithmetic and interface fixture, not a substitute for the historical policy benchmark.

## 6. Investigate small nudges and large responses

The model must explain surprising responsiveness rather than pass a blanket “small changes only” rule. Each reviewed control has a response profile in the units a visitor understands.

### Minimum review protocol

1. **Define the nudge.** Record an absolute change and, where meaningful, a relative change. A one-percentage-point change in a tax rate is different from a one-percent relative change. Never use relative sensitivity alone near zero.
2. **Sweep the usable range.** Test a declared grid across the reviewed interval, with finer checks near policy thresholds or suspected regime changes. Include the starting point and boundaries. A sampled grid does not prove behavior everywhere.
3. **Check the neighborhood.** Run positive and negative perturbations at more than one scale. Display the absolute outcome change, its horizon, and the numerical resolution of the comparison. Long-run compounding is separated from immediate responsiveness.
4. **Check interactions.** Test declared interacting controls and a reproducible sample of feasible joint parameter settings. Two individually harmless sliders can create a strong combined response. Respect joint constraints and declared correlations.
5. **Check the arithmetic and numerics.** Verify applicable identities and residuals; refine numerical tolerances or numerical integration steps where relevant. Do not change a model's economic monthly timing and call that numerical refinement. Record root-selection and branch changes.
6. **Explain the response.** Identify active constraints, explicit thresholds, feedback mechanisms, scenario assumptions, and sensitivity to uncertain coefficients. A trace explains computation; it is not evidence that the causal story is true.

Material-response flags use outcome-specific, predeclared thresholds with units and horizons. They trigger investigation, not automatic rejection. No universal elasticity ceiling, preferred sign, or fixed maximum policy benefit is imposed.

### What to do with a large jump

| Explanation | Required handling |
|---|---|
| Unit error, singular expression, accidental repeated effect, or failed solve | Treat the run as invalid; fix the implementation. Never sanitize it into a plausible-looking result. |
| Policy eligibility cliff or explicit regime switch | Show the triggering rule and affected population; preserve the discontinuity. |
| Multiple equilibria or strong feedback | Disclose the branch/selection assumption, inspect neighboring solutions and numerical stability, and show alternatives where supported. Numerical stability alone does not establish empirical plausibility. |
| Highly uncertain coefficient or unsupported extrapolation | Mark the result as fragile/experimental and expose the assumption that drives it. |
| Reproducible mechanism supported within the model's scope | Preserve the large response and document the explanation, remaining uncertainty, and relevant evidence. |

A flat response also needs diagnosis. It may reflect a genuine constraint, an omitted mechanism, or a disconnected variable. Zero influence is not automatically reassurance. Tests must include both a legitimate saturation case and a legitimate threshold case, so the system cannot pass by making every curve flat.

When reporting the cause of a difference, label one-at-a-time diagnostic comparisons and show interaction effects separately. Do not add them as if they were independent causal contributions. Report constraint names, units, current values, slack, and evidence references; label hypothetical relaxations explicitly.

For an ordinary policy comparison, summarize whether the direction and approximate size of the benefit survive the declared sensitivity cases, which populations gain or lose, and which assumptions reverse the result. Show the outcome spread and failed/unsupported cases. Any count states its denominator and exclusions; a share of tested scenarios is not a probability that the policy will work. This is a modest comparison report, not a new portfolio-optimization product.

## 7. Generality is an acceptance requirement

Build one model-authoring system and one result interface, with execution methods selected according to the model's mathematics. The same interface can host a wide range of models. It does not promise instant, faithful import of every paper.

The common authoring path supports equations, parameters, observed/exogenous series, state updates, explicit lags, entity collections, cross-entity aggregation, constraints, and effects at declared hooks. Add explicit bounded scalar equilibrium blocks as a reusable capability; retain specialized runners where numerical structure requires them.

An equilibrium block declares its unknown, residual equation, input dependencies, admissible bracket/domain, scaling/tolerance, iteration limit, and root-selection behavior. Lack of a root, nonconvergence, or ambiguity is reported explicitly. Nested solves must be declared and diagnosed. Mutually coupled multi-variable systems are not silently treated as independent scalar roots; they require a suitable solver capability or an explicit unsupported result.

Use a single expanded dependency graph across entities and aggregates. Same-period cycles outside explicit solve blocks are errors with a readable cycle trace. A previous-period reference is allowed when a lag is intended, not as an automatic equilibrium workaround.

Effects declare units, scope, operation, timing, and provenance. For ordinary hooks, additive terms sum or multiplicative factors multiply, as the hook specifies. Consumers read the modified value. Effects inside equilibrium enter before the relevant solve and trigger recomputation. Structural changes fork the model and invalidate affected reproduction claims.

### Prove this is more than a collection of bespoke models

Before calling the authoring foundation complete:

- A first-time author builds a small model and adds a variable affecting at least two downstream equations without modifying application code or writing schema boilerplate.
- Demonstrate distinct structures: a time-stepping cohort/flow model, an entity/aggregate allocation model with a capacity limit, and a model with an explicit scalar equilibrium block.
- After the supported primitives are frozen, a reviewer selects an additional model within those declared capabilities that was not used to design the examples. A contributor incorporates it through model data/equations and sources, without editing the evaluator or chart components. This tests software generality, not forecast independence.
- Import one real published model from a pinned source, with an equation mapping, parameter provenance, and reproduction checks. A paper-specific numerical routine is acceptable where declared, but cannot substitute for the general-authoring demonstrations.

Korinek is a useful reproduction and numerical stress test. GATE is a future integration candidate. Neither is a permanent limit on supported models. Published models can arrive as declarative packages, integrations with supported external implementations, or reviewed specialized runners. An unsupported method produces a concrete capability request instead of an altered version of the paper presented as equivalent.

### Reuse existing work without restarting the project

Keep the React interface and existing expression infrastructure where appropriate. Inspect existing modeling libraries before implementing substantial new solver machinery. Dynare, Mimi, and ModelingToolkit demonstrate relevant established capabilities; choosing one requires a bounded comparison of numerical fit, licensing, maintenance, and deployment. Their existence is not a decision to port the application to Julia or MATLAB.

Ordinary first-release simulations run in browser workers. Keep the runner interface capable of later calling another execution environment for demanding models. No general remote compute platform or optimization engine is required now. Browser-only execution is an initial delivery choice, not a permanent scientific restriction.

## 8. Model intake, policy translation, and evidence

For each new paper or model, collect its source edition, equations, scope, calibration/data, mathematical requirements, license, and any reference implementation. AI drafts the mapping and flags omissions. Numerical verification and reproduction establish what was actually incorporated. Reproduction of a paper does not prove the paper's theory is empirically correct.

For a bill or idea, retain this pipeline:

**Source text → actual provisions → proposed mechanisms → parameter/equation mappings → constraints and funding → reviewed draft → paired run.**

Separate policy controls from empirical coefficients. A bill can specify a training budget; it does not establish the employment response to that budget. A provision's quoted source supports its extraction, not the magnitude of a predicted effect. Each relationship is marked causal, associational, calibrated, elicited, or assumed, with applicability and uncertainty described separately.

Every provision must be mapped, unresolved, or outside the selected model. Missing mechanisms remain visible. No risk reduction is fabricated because a proposal mentions alignment funding. No public-ownership proposal becomes a profit tax unless the draft explicitly makes and labels that modeling choice.

Compare policy and baseline using the same model, complete initial state, exogenous conditions, and paired draws, changing only the declared policy. Endogenous responses can diverge. A model-and-policy change is a scenario comparison, not an isolated policy effect.

Retain five evaluation categories:

1. Implementation verification: equations, accounting, limiting cases, and numerical behavior.
2. Published-model reproduction: specified version, paths/outputs, tolerances, and departures.
3. Retrospective calibration/benchmark: fitting history, observed levels and changes, simple comparators, and misses.
4. Policy-effect benchmark: matched treatment contrast, population, period, outcome definition, and uncertainty.
5. Prospective/time-separated prediction: frozen predictions and data cutoff, with independence claims appropriate to what was known.

Keep Alaska employment as the first narrowly mapped policy-effect case unless source extraction reveals a concrete incompatibility. Match the actual study estimate, denominator, inference method, funding boundary, and period. If it is used to fit the model, label it calibration. The synthetic training example above does not replace it. [Primary study record](https://www.nber.org/papers/w24312).

Remove the median-within-own-interval pass rule and generic “four of six” scientific-validity rule. Report signed empirical discrepancies in original units, appropriate study uncertainty, model uncertainty separately, and a complete coverage/failure report. Proper predictive scores may be used where the forecast distribution and observation model are defined. Enlarging an uncertainty band or dropping a difficult case cannot automatically improve a grade.

Historical resemblance, moderate sensitivity, and agreement among related models do not establish novel causal effects. Where compatible independent models disagree, show the disagreement and its assumptions. Do not average incompatible outputs into a single authoritative answer. Keep wellbeing, distribution, and safety outcomes distinct; any combined value judgment must be explicit. Defer automatic portfolio optimization and universal policy rankings.

## 9. Preserve execution integrity and the existing product

Carry forward these concrete v2 requirements:

- Resolve model defaults, base-scenario values, and selected-scenario overrides in that order. Conflicts at the same precedence are errors. Require initial state and lag history; no silent zero initialization.
- Freeze prior state for each step. In the general authoring runner, policy eligibility uses the calendar/prior state. Apply at most one active `set`, then summed `add`, then multiplied factors to permitted input targets. Inactive terms are neutral. Published runners preserve their own declared timing, including known future exogenous inputs where required.
- Use complete checkpoints or deterministic recomputation. Seeking cannot combine past countries with future corporations or ledgers. Both comparison panels must advance.
- Run computations in workers with run IDs, progress, cancellation, and finite execution limits. Old completions cannot overwrite newer runs. Invalid equations or failed solves do not fall back to defaults under the custom model's label.
- If stochastic, key paired draws by seed/source/entity/time/draw index; retain generator versions and correlations. Do not assume both scenarios consume random values in the same sequence.
- Keep a run manifest containing model/code/data versions, resolved inputs, equations, full policy drafts, evidence references, review/extrapolation status, solver settings, random settings, and result definitions. Export output units, denominators, and time conventions.
- Preserve legacy links where reconstructable. New links/bundles pin the full scenario and model version. Unsupported links report what is missing instead of silently opening a different baseline. Large/private scenarios can use downloaded bundles before any new sharing service.
- Map, Charts, Corporations, and Futures consume compatible results from the active run. Its controls and calendar belong to that model. Unsupported geography or outputs are not filled with invented numbers.
- Keep the Futures flow visualization labeled according to its actual construction; it is not automatically a simulated transition distribution. Remove numeric cost-effectiveness ratios obtained by dividing by qualitative cost bands.
- Keep the World Happiness Report regression descriptive, and label the existing fitted wellbeing anchor with its own data and assumptions. An outcome scale's ceiling is not evidence that all beneficial mechanisms saturate at a particular income.
- AI extraction can use a small protected provider gateway; browser workers do not hide a shared provider secret. Manual drafts work offline. Do not introduce a general simulation backend to solve this limited requirement.

The earlier source findings refer to commit `c304d94b4e503d47a5b6ad5125552b4cb0726f5c`, not a new audit of subsequent repository changes. The existing default baseline, uploaded-equation fallback, playback state, and approximation labels require verification at the implementation revision.

## 10. Delivery sequence and release evidence

| Stage | Visible deliverable | Acceptance condition |
|---|---|---|
| 1. Repair the current experience | Existing visuals, correct labels, complete paired comparison, reliable playback | Same equations on both sides; zero policy difference gives zero paired difference; seek/replay reproduces complete state; equation uploads still execute or fail explicitly. |
| 2. Show useful constraints and flexible authoring | Training example, constraint explanation, reusable equation/flow/aggregate/scalar-solve capabilities | The worked example reconciles; a new variable reaches two equations; authoring examples require no app edits; invalid cycles/units and numerical failures are explicit. |
| 3. Qualify one default within an honest scope | Meaningful public controls, a readable model card, response profiles and bottleneck explanations | Accounting/evidence inventory complete; small-nudge, interaction, threshold, saturation, and failure tests reviewed; no arbitrary smoothing or missing-mechanism zeroes. |
| 4. Demonstrate evidence and generality | One exactly mapped historical policy case, one independently selected additional model, and one faithful published reference | Case classification and discrepancies visible; additional model does not require evaluator/view changes within supported capabilities; reference reproduction has independent numerical checks. |
| 5. Complete sharing and policy exploration | Paste, inspect assumptions, run, explain limits, share, and reopen | All provisions accounted for; scenario/model status survives sharing; downloaded results reproduce within declared tolerance; existing supported views remain usable. |

Begin published-model feasibility and historical source extraction early, while delivering the first visible repairs. Treat failed numerical assumptions as findings, not reasons to preserve misleading reference labels. A faithful Korinek port is new work; its existing calibrated endpoint fit does not satisfy stage 4.

Review must include deliberately adversarial examples: a disconnected variable, a unit error, a double-applied effect, a solver branch change, a huge uncertainty band, missing difficult cases, a fabricated post-processing cap, a legitimate capacity plateau, and a legitimate threshold jump. The harness must distinguish these rather than reward universally calm curves.

Use the existing repository and incremental branches. Run appropriate existing and new checks, including `npm run check` when implementing changes. Show the working map/charts at every stage. No application tests have been executed as part of writing this v3 document, and no implementation completion or release date is claimed.

Claude Code Fable remains the recommended implementation lead for continuity with the product and repository. GPT-6 should independently review the numerical behavior, evidence claims, and whether the authoring demonstrations prove the promised flexibility. No new repository or deployment is required by this design.

### Handoff to Claude

> Implement v3 incrementally in the existing simulator. The primary product is a reviewed default with meaningful policy controls and inspectable constraints, alongside an open authoring workspace that can incorporate additional models. Preserve the existing interface. Fix the current paired comparison and playback first, then demonstrate both reusable authoring and a real computed bottleneck. Do not tame results by clipping them, forcing small elasticities, or designing tests to favor an intervention. Preserve justified thresholds and diagnose unexplained jumps. Qualify the default using explicit scope, accounting, evidence, and response checks. Treat Korinek and other papers as reference integrations and tests of generality, not the boundary of the product. Provide a working preview and the relevant verification evidence at each stage.

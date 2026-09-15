# Forensic Analysis: Task 4/5 conditional world default design

**Domain lens:** principal simulation engineer / economic model accounting reviewer.

## Executive summary

The proposed versioned conditional world model is defensible as a **conditional resource and transfer-allocation reference**, with illustrative macro conditions and an illustrative wellbeing mapping. The final availableShare=1 ruling does not introduce an arbitrary expense estimate: it declares an accounting boundary. It does not demonstrate real corporate affordability, net welfare, or causal policy effects.

**Ready for implementation after the four bounded corrections below.** This is design review only, not acceptance of unbuilt code, generated evidence, or completion of v3 stages 3/5. No production files were edited and no application tests were run in this review.

## Claim verification

| Claim | Verdict | Evidence/reasoning |
|---|---|---|
| M × a × 0.15/year /12 yields monthly billions | Verified | M is billions USD, a dimensionless, rate annual; 3000 × .65 × .15 /12 = 24.375. |
| AvailableShare=1 provides a legitimate accounting constraint | Verified within definition | Requests above the declared source cannot be funded; this is not an empirical corporate spending limit. |
| Transfers are not newly produced GDP | Plausible pending code | Design explicitly separates receipts from macro production; source allocation is locally conserved. Full household/firm national accounts are expressly absent. |
| U=loss × excess unemployment × labor force/residents is a population-average term | Verified algebraically | .01 × .50 × 5 = .025 index points per resident. Assumes unemployment fractions use labor-force denominator. |
| New unemployment term removes empirical overlap with anchor | Suspicious if stated without qualification | It avoids adding a second aggregate unemployment coefficient, but an associational GDP regression does not identify a statistically orthogonal non-income channel. |
| Month-zero and later outputs have identical economic semantics | Flawed as currently specified | Initial laborShare=.60 and gdpNoAi=initial GDP disagree with nonzero-adoption level equations used at month1. |
| Shared mode discriminator can prevent hidden wellbeing feedback | Plausible pending exhaustive reader audit | Design explicitly bypasses revenue/demand/adaptation; coefficient mutation invariance must test the full run. |
| Narrow qualification can meet v3 stage3 | Plausible | Spec section4 explicitly allows narrower scope with broader results illustrative. Section6 response/failure review and section10 acceptance remain mandatory. |

## Blocking conceptual issues and minimal corrections

### 1. Month-zero macro initialization must use one consistent level definition (high)

Design lines207–209 require same output semantics at all months but initialize laborShare=.60 and gdpNoAi=initial GDP. Existing `simulation/pure.ts:91–96` computes GDP and labor share from **total current adoption**, not just its increment. With nonzero initial adoption, month1 therefore applies an initial productivity/labor-share shift even with no adoption growth. Removing wellbeing relaxation would expose this initialization artifact directly.

**Minimal fix:** compute month-zero static macro levels using the same equations as later months without advancing growth/adoption/displacement. Explicitly choose what supplied initial GDP means. If it is the scenario's month-zero actual GDP, derive gdpNoAi = initialGDP / (1 + productivityGain × initialAffected); initialize labor share from initialAffected. If it is a no-AI baseline instead, preserve that baseline but compute and label the corresponding month-zero actual GDP. Do not mix these conventions. Initialize lastAiAdoption consistently. Add zero-growth/zero-adoption-change month0→month1 fixture showing no unexplained level jump. Reference mode uses its reference month-zero state.

### 2. Population-average mapping requires an explicit headline aggregation (high)

The new unemployment conversion is per resident, but existing `simulation/pure.ts:972` reports an **unweighted mean across countries** as averageWellbeing. The design does not explicitly replace that aggregation. Reusing it would make a tiny country's population-average change count as much as a large country's, and would not support a world-resident interpretation.

**Minimal fix:** new conditional mode computes sum(population × W)/sum(population) for the declared valid population, with country count, covered population, exclusions and validity. If retaining an unweighted mean, label it explicitly “country-average conditional index,” never world population wellbeing. Paired comparisons need the same included population on both sides or an unavailable/coverage-change warning; changing exclusions must not manufacture a policy gain. Legacy aggregation may remain for replay.

### 3. Full-world denominator and partial states need a coherent allocation contract (high)

Design line165 preserves all-country population denominator while line175 requires all contributions equal country receipts. Existing `simulation/pure.ts:639–643` explicitly supports subset states using the whole-dataset denominator. Reusing this path in a partial state loses displayed receipts relative to source. Customer allocation also silently ignores missing operating countries (`pure.ts:249–263`), changing the destination population.

**Minimal fix:** require the complete versioned country roster with unique IDs and positive finite populations for reviewed world execution. Alternatively, retain full allocation accounts for outside-view countries; a map filter may reduce display, never the accounting population. Reject unresolved HQ/customer IDs rather than silently changing recipient coverage. Explicitly define customer allocation as **population-weighted residents of operating countries**, not identified individual customers. Existing data do not establish customer counts. Reject unknown allocation strategies and empty recipient sets.

### 4. Narrow the unemployment decomposition claim (medium; wording/model-card blocker)

Design line203 says this “actually removes overlapping unemployment effects.” The code construction can remove the previous combined aggregate/direct penalty. It cannot prove that the fitted anchor contains no unemployment association, nor that labor-share scaling identifies individual income loss.

**Minimal fix:** say “removes the previous combined aggregate/direct penalty and substitutes an assumed additive non-income channel; statistical independence from the associational anchor is not established.” Keep beta, loss=5 and laborForcePerResident=.50 visible as author assumptions. Define u/uNatural as labor-force fractions, bound laborForcePerResident in [0,1], and distinguish the all-resident illustrative index from the source survey's observed population. These values are defensible as inspectable illustrative inputs; they are not evidence-based defaults for causal wellbeing.

## Best practices and failure modes to retain in implementation acceptance

- Qualification identity design is appropriate: pinned local evidence, full structural/dataset/assumption identity, per-run identity, tested domains and joint restrictions. Ensure requested-amount versus requested-rate kind, availableShare, population conversion, calendar, initialization convention, hooks and all effective overrides enter identity. Hashes establish identity, not scientific quality.
- A finite parameter grid does not prove its full Cartesian envelope. Inherited review applies only to the declared justified domain and restrictions; sampled coverage must be labeled sampled. Artifact regeneration is not automatic human scientific acceptance.
- Validate finite nonnegative resource stocks/requests, capability and shares in their declared domains, positive income denominators, and macro joint domains. Zero source is a valid empty source, not a divide-by-zero ratio. Negative/nonfinite inputs must not be clamped into qualifying results.
- Existing unemployment caps .6/.9 and adoption cap .999 remain assumed boundaries. Expose activation and pre-cap diagnostics where relevant; do not call them estimated capacity. Macro assumptions remain illustrative even when implementation checks pass.
- Mode-specific bypass must include legacy anchor-rate mutation inside applyMacroDynamics, custom equation hooks, crisis counts, trend histories, reputation, AI narratives and exported cards, not just final country.wellbeing assignment. Test changing all mapping coefficients leaves corporate source/requests/allocation and macro paths unchanged.
- Month-zero ledger is a rate snapshot. Any cumulative spending sums must exclude month0 as past spending and state the integration convention. Mid-run scenario edits need reproducible event history or a clearly fresh run.

## Documented limitations, not blockers to this narrow reference

Gross-source construction excludes expenses, ownership incidence and other competing uses; use “modeled source pool” consistently, not disposable profit or safe real-world funding. Source scaling is a separate scenario assumption, not a free policy benefit. Named corporate figures are hypothetical amounts in newly declared units, not converted observations.

Fixed corporate response and omitted transfer-to-macro feedback are defensible closures only with the proposed unsupported-mechanism labels. No hidden zero-effect claim or demand narrative may survive. Conditional wellbeing levels remove an unsupported timing law without estimating adaptation. GDP/labor-share and transfer proxies do not become household disposable income or net welfare; illustrative status must remain visible on charts and comparisons.

## Recommendations and confidence assessment

Implement after the four corrections, preserve the existing world/corporation interface, and keep the old execution definition for historical replay. No new empirical coefficients, smoothing parameter, US-only replacement or research program is needed to resolve these findings.

**Confidence: high in the accounting/design findings; medium in implementation feasibility until code and real UI are checked.** Stage3 acceptance can be recorded within the published resource/allocation scope only after the specified evidence and adversarial response review passes and is reviewed. Causal macro/wellbeing qualification remains unestablished. Stage5 additionally requires actual status-preserving sharing/reopen and compatible-view checks; a good design note cannot satisfy that acceptance condition.

# Stage 3 qualification design at 436a16e

Read-only investigation, 15 September 2026. Inspected the requested re-review, spec sections 4/6/9/10, constants.ts, simulation/pure.ts, simulation/run.ts, simulation/usReference.ts, validation/responseProfile.ts, data/countries/README.md and model card. This is an implementation recommendation, not new empirical evidence.

## Decision

Do not make `us-reference-korinek` the sole default and declare Stage 3 complete. Spec section 4 explicitly preserves the world/corporation candidate; the current US preset still runs the unqualified wellbeing bridge and the illustrative reduced form outside the US. The faithful port supports a reproduction claim for specified US macro outputs, not a policy-to-wellbeing qualification.

Keep the world product and its controls. Add a versioned, executable qualification contract for the actual default, with separate statuses for (1) transfer accounting/allocation under explicit monetary assumptions, (2) illustrative macro scenario, and (3) conditional wellbeing extension. Broader outputs remain available with their real status. A reviewed default can contain stated assumptions, but relabeling assumptions alone is insufficient: inputs must be explicit and consistent, unsupported controls unavailable, response review complete, and qualification based on computed evidence with unresolved findings retained. If remaining bridge issues cannot be resolved now, state Stage 3 remains partial. This is preferable to an invented fully qualified result.

A narrowed reviewed reference can be added alongside that world default: US macro reproduction, January 2025–January 2030, with wellbeing explicitly a separate extension. It does not replace the world-model qualification requirement without an explicit product-scope decision.

## Minimal interfaces and ownership boundaries

Add `simulation/qualification.ts` (or equivalent shared module) and types in `types.ts`:

```ts
type EvidenceKind = 'observed' | 'reproduced' | 'calibrated' | 'assumed' | 'unsupported';
interface MonetaryBasis {
  currency: 'USD'; priceYear: number | null; observationYear: number | null;
  status: 'observed' | 'dated-assumption' | 'undated-assumption' | 'legacy-unsourced';
  source: string;
}
interface CapabilityReview {
  id: string; outputs: string[]; geography: string[] | 'world';
  firstMonth: number; lastMonth: number | null;
  status: 'reviewed-conditional' | 'illustrative' | 'unsupported';
  assumptions: string[]; evidenceIds: string[]; unresolvedFindingIds: string[];
}
interface DefaultReview {
  version: string; modelId: string; modelFingerprint: string; datasetId: string;
  capabilities: CapabilityReview[];
  controls: {id: string; kind: 'policy' | 'scenario-assumption';
    supported: boolean; affectedOutputs: string[]; reason?: string}[];
}
```

Qualification must resolve from the actual model/inputs and fingerprint, not merely `model.id`; custom equations, altered coefficients, scope or money assumptions invalidate the matching review and become a fork with conditional/experimental status. Persist contract version, resolved assumptions, limitations and monetary basis in world saved state/share artifacts. App banners, control enablement and output labels read the same resolver; do not duplicate hard-coded truth in the card and UI.

## N8: workforce inputs independent of governance

`constants.ts:getArchetype` currently selects `COGNITIVE_SHARE_BY_ARCHETYPE` and `NATURAL_UNEMPLOYMENT_BY_ARCHETYPE` through discontinuities at 0.35/0.50/0.60/0.80 and GDP boundaries. `simulation/pure.ts:applyMacroDynamics` fills missing country fields from those buckets.

For a new versioned default dataset, provide explicit `cognitiveShare` and `naturalUnemployment` records with per-field source, year, status and fallback rule. To avoid fabricating source evidence, freeze the existing initialized values by country as *assumed*, with provenance `legacy archetype-derived scenario input at 436a16e`. That removes the accidental governance-to-workforce causal link without claiming those numbers are measured. It is a real structural repair; it is not empirical qualification of the resulting country assumptions. Make this migration new-version-only; preserve old dataset/model behavior for old links.

Prefer eventual actual sources per country, but that requires a substantive definition-matching exercise: cognitive task share is not any convenient occupation fraction, and an observed unemployment rate is not automatically a natural rate. In faithful US mode, use the paper's declared calibration and separate it from observed data.

Replace public political regime labels with neutral scenario labels or remove them. WGI components cannot justify `rich-democracy` / `authoritarian`. Do not smooth the score thresholds as a fix. Direct-wallet eligibility at governance 0.4 and crisis/legacy subsistence thresholds also require explicit assumed-rule inventory and threshold probes; removing only the reported 0.8 crossing does not review the whole model.

Tests: hold explicit workforce inputs fixed and compare governance 0.7999/0.8001; employment share and natural unemployment must be identical, while genuinely governance-dependent channels may change. Repeat around every old bucket boundary. Changing an explicit workforce field must reach affected output equations. Check old-version replay remains unchanged.

## N9: monetary evidence and calculation

Country GDP records currently carry year/status but lose these distinctions in `baseCountryFromRecord`; corporate values have no vintage. Do not apply the conditional 1.289 deflator as if the current corporations were known 2024 observations.

New default scenario can explicitly author corporate numbers as **assumed constant-2015 USD amounts**, recording that this is a newly declared scenario convention, not a historical conversion or claim about observed company accounts. Preserve original raw/legacy values and provenance. This makes an internally consistent hypothetical calculation possible, while empirical corporate scale remains unqualified. Old undated scenarios stay flagged as undated and cannot earn a reconciled-evidence claim. Better sourced corporate inputs are optional later work, not evidence software can synthesize.

For genuinely dated inputs add a conversion function requiring `from.priceYear`, target basis and a pinned deflator series/method. Reject incompatible currencies or unknown basis when executing a reviewed ratio. Keep amount denomination (dollars vs billions), price year, observation year, annual/monthly time basis, and recipient denominator distinct. A deflator based on same-year current GDP / real GDP must be documented and country-specific if used; do not assume a US deflator is a global purchasing-power conversion.

PRK/TWN GDP fallbacks: keep visible as legacy-unsourced and exclude their monetary ratios/wellbeing evidence from reviewed scope, or supply sourced compatible inputs. Do not silently exclude them from global denominators while continuing to label results world-wide. If retaining hypothetical fallback amounts, declare their new assumed price basis explicitly and show assumed-country counts plus population coverage in output metadata. Neither choice warrants an observed-data claim.

Tests: identity conversion, independently hand-calculated dated conversion, unknown-basis rejection/conditional status, incompatible-currency rejection, annual/monthly consistency, billion/million conversion, and conversion round-trip. Audit transfer flows (sources = recipients + leakage + retained balances) and ensure transfers are not added to produced GDP. Export basis survives reopening. Inventory all corporate stock and flow money, not only revenue.

## Meaningful controls and unsupported effects

`validation/responseProfile.ts:NUMERIC_LEVERS` always includes `displacementRate` and `gdpScaling`; in anchored mode neither affects the final anchored wellbeing path. The UI/card must obtain supported controls from the same model capability resolver. Disable with explanation or hide unavailable controls in that model; retain legacy controls on legacy models. `corporateTaxRate`, `adoptionIncentive`, `baseUBI`, and `globalRedistributionRate` are present on presets without direct reads in the inspected world stepping engine: audit the complete App/controller path before declaring these live policy levers.

Supported world interventions include contribution rate and allocation strategy where they actually alter contributions and recipients. Separate adoption speed, macro response coefficients and wellbeing coefficients as scenario assumptions. Reference-US GDP/employment is exogenous to world corporate policy: label that lack of policy feedback explicitly. Do not display a zero GDP policy effect as evidence of no effect. Cash transfers do not imply training, new vacancies, ownership, safety spending effects or net societal welfare.

The wellbeing bridge needs an explicit non-double-count construction before qualification. Current `unemploymentEffectPerPoint=0.45` combines direct and aggregate estimates with unresolved overlap; select a single declared assumed channel (and name population conversion) or implement mutually exclusive alternatives, never silently set the effect to zero. Keep income response vs non-income unemployment response distinguishable, since the anchor already responds to labor income. The transfer effect per doubling, denominator bridge, long-run interpretation and 0.02/month speed jointly remain assumptions. No finite sensitivity range turns these into an empirical estimate.

## Response review implementation

Extend `validation/responseProfile.ts`, its tests, and `scripts/response-profile.ts`; emit machine-readable evidence plus readable report. Current profile measures mostly final realized wellbeing, relative nudges, and average-wellbeing-only sweeps. It omits the target and paths, GDP/employment, joint draws, absolute near-zero nudges and comprehensive thresholds.

1. Capture at every month: wellbeing target and realized wellbeing, separate income/transfer/unemployment terms, GDP, labor income, employment rates, transfer amount/ratio, population-specific results and active constraint flags. Publish 1/12/24/60-month summaries, never 120 months for the finite US reference.
2. Test target-versus-path exactly using a fixed-country/constant-target fixture: `W(t) = target + (W0-target)*(1-rate)^t` when no outcome bound is active. Test rate=0 and rate=1 as mathematical limits, explicitly hypothetical, plus the shipped rate. No arbitrary calmness ceiling. Report target displacement and fraction realized separately.
3. Define absolute and relative nudges: e.g. contribution ±1 percentage point and ±0.1 percentage point, alongside ±1%/±10% relative changes. Actual amounts must be shown after feasible-domain clipping, with boundary/one-sided status. Current mean-rate scaling cannot produce a positive contribution arm from an all-zero base; replace it with a defined absolute setter for that edge case.
4. Full declared range sweep per supported lever, not just 0.5–1.5 times default. Fine neighbors around every actual branch/eligibility boundary. Inventory rule text and provenance. Preserve legitimate jumps; material flags trigger explanation, not failure based on magnitude.
5. Joint response cases with deterministic seed/sample identity and explicit feasible constraints: contribution × allocation; adoption × automation × reemployment; transfer coefficient × denominator assumption × adjustment speed; unemployment channel × income-bridge choice. Report extrema, direction reversals, failure/unsupported count and denominator. Assumption-scenario share is not probability.
6. Predeclare material investigation flags with units/horizons (such as target/index-point change and GDP percentage-point change), distinguish these from numerical tolerances. Threshold values are review triggers selected by the reviewer, not scientific bounds on possible benefit/harm.
7. Link a legitimate training saturation case and an explicit eligibility threshold fixture to verify harness classification, but do not substitute those fixtures for actual default threshold review. Include disconnected control, double-applied effect, unit mismatch, clamp activation, huge uncertainty band and missing case mutations; none may improve a qualification verdict by concealing evidence.
8. Report bounds explicitly: `wellbeingAnchor` currently clamps 15–90 and final wellbeing clamps 1–100; neither can substitute for causal saturation. A target beyond the outcome scale should retain its raw value plus a visible boundary/unsupported extrapolation diagnostic.

## N10 and N12

`simulation/run.ts:advanceRun`, `runMonths`, `replayTo` and direct `stepSimulationPure` all need one supported-horizon check before mutation. Reject month 61 for US reference with a typed scope diagnostic (or return unavailable US outputs; hard stop is simpler and fits existing intent). Guard both sides of comparison and seek. Never freeze only GDP while advancing transfers/wellbeing. Test month 60 accepted, 61 refused, replay and secondary-reference comparison, and input immutability on refusal. Name effective wage-bill share separately from printed marginal-product labor share.

Correct `docs/design/model-card-default.md`: WHR regression = log GDP per capita and governance, 335 observations / 120 countries at 2015/2020/2025; 106 is the hindcast comparison sample. Labor-income rescaling is an additional bridge. `evidence-anchored` is already provisional default; illustrative macro still executes. Remove stale owner-decision wording and unsupported comment `evidence-calibrated target` in pure.ts. Updating stale prose closes N12 but not F7/F8.

## What can finish now, and what remains evidence work

Software can finish now: explicit model/capability contract, honest monetary scenario convention and unknown-basis handling, explicit workforce assumptions detached from governance, executable bounds/horizons, supported controls, sharing status, accounting invariants, target/path and joint response evidence, corrected card, and retained unresolved findings.

Evidence cannot be manufactured now: observed corporate scale/vintage, compatible GDP fallback sourcing, country cognitive shares/natural-rate estimates, a dose/population/outcome/time-matched transfer slope, distinct unemployment non-income effect, and validated adjustment speed. A narrower *conditional reference* may be reviewed after the tests and inventory are actually evaluated. Do not announce the full Stage 3 as met solely because tests pass or the word provisional was replaced. Stage 5 can be completed independently for supported capabilities while carrying Stage 3 limitations through exports and views.

## Follow-up decision: contemporaneous conditional wellbeing levels (15 September)

**Yes, a direct conditional level mapping is defensible and is preferable to inventing an adaptation rate, provided it is genuinely an output mapping and the product stops calling it a realized wellbeing trajectory.** A sequence of conditional levels is not an estimate of transition timing. The month labels identify the economic conditions used by the mapping. Label the chart axis/title `Conditional wellbeing index` and explain `Model-implied level under this month's scenario conditions; adaptation time and the realized path are not estimated.` Do not call it instantaneous adaptation, long-run equilibrium, predicted life satisfaction, or observed change. This resolves arbitrary smoothing by removing an unsupported dynamic equation from the new model definition, not by setting its parameter to 1 under the old definition.

### Crucial implementation caveat: feedback

A one-line replacement `country.wellbeing = target` is **not** this design. In the existing engine, wellbeing is an economic state variable:

- `calculateAiRevenue` multiplies GDP purchasing power by `country.wellbeing / 100`.
- `projectDemandCollapse` extrapolates its six-point history 12 months forward.
- `adaptCorporationPolicy` changes contributions/allocation at projected demand-collapse thresholds.
- `usCorpAdaptation`, `chinaCorpAdaptation`, and `euCorpAdaptation` change behavior at wellbeing thresholds.

Putting the target in that state instantly changes corporation behavior; the statement “we are not assuming instantaneous adaptation” would then be false. A disclaimer cannot repair this. Nor may those functions unknowingly keep reading stale observed wellbeing while charts show a different quantity under the same name.

### Recommended architecture, smallest honest new default

Make a new versioned world preset representing **conditional distribution scenarios with a separately reported wellbeing mapping**. Keep the current dynamic preset intact and selectable as a legacy assumed-timing model.

1. Add a distinct `conditionalWellbeing` result (raw total, income term, transfer term, non-income unemployment term, validity/status). Never store it in the realized `wellbeing` field. Make map/charts choose their declared output through the capability resolver. If preserving the old field is technically essential, introduce explicit `wellbeingRole: 'conditional-output' | 'dynamic-state'` and ensure every engine consumer branches correctly; a separate field is less fragile.
2. Define the corporation-side economic inputs explicitly. The least-assumption conditional baseline holds contribution/allocation schedules and customer-demand factors at declared values, while computing the existing adoption/macro scenario, monthly source amounts and allocation identities. Model wellbeing-to-demand and wellbeing-to-policy reactions as **unsupported feedback**, not zero estimated causal effects. The output card says the comparison is conditional on fixed corporate response inputs; it is not the total policy effect. Preserve optional legacy adaptive-corporation simulation in the old preset, with its assumptions and review status.
3. If keeping adaptive corporations in the new default is a hard product requirement, require an explicit separately named behavioral state and law with source/assumption status. Retaining its rate0.02 law leaves an arbitrary timing assumption in the economic loop; reporting raw wellbeing targets alone does not cure it. Replacing behavior with new income-based triggers is substantive model development and cannot inherit old qualification automatically.
4. Compute the conditional wellbeing output from economic conditions at month0 as well as later months. Display observed initial ladder as a distinct reference marker; do not splice observed month0 into conditional month1 and interpret the jump as an intervention effect.
5. Use a separately declared non-income unemployment term, with direct-only and alternative aggregate-effect scenarios kept mutually exclusive. The labor-income bridge already contains income losses. The coefficient may be a clearly elicited/assumed scenario parameter; existing citations do not validate a combined coefficient or establish this decomposition. Show uncertainty/alternative mappings. Do not silently omit unemployment and imply absence of harm.
6. Preserve raw out-of-scale conditional values and mark them unsupported/outside the declared mapping range; a visual scale clamp must not overwrite the reported value or count as genuine saturation. The `wellbeingAnchor` 15–90 clamp is likewise an old modeling choice and requires removal from the raw conditional mapping or explicit review of its applicability.
7. Version links and exports so old0.02 runs reopen unchanged. New contract identifies wellbeing output as conditional, corporation feedback held fixed/unsupported, monetary assumptions, all explicit workforce values and data coverage. No old reviewed fingerprint may apply to the new structural model.

This preserves the world/corporation product and meaningful source/allocation controls, while **explicitly narrowing the interpretation of results**. It is compatible with section4's permission to publish a narrower honest scope; it must be prominent, not buried in the card. If this is unacceptable to the owner because they require endogenous corporation reactions and realized wellbeing predictions in the default, the least misleading immediate choice is retain0.02 as an explicitly assumed dynamic scenario and keep Stage3 incomplete. No software change can establish that timing empirically.

### What can satisfy Stage3 here

A maintained conditional reference may qualify for *specified contribution/allocation scenarios under stated macro/demand/workforce/money assumptions*, after actual accounting, evidence-inventory and response review—not as a forecast or complete policy-effect model. Complete the reviewed control ranges and joint restrictions, examine large and flat responses, resolve dimensional errors, verify scale boundaries and unsupported outputs, preserve legitimate thresholds, and ship report evidence with the model fingerprint. Timing is deliberately outside this reference's claimed output; it is not a missing mechanism smuggled in as zero. Welfare ranking, employment effects of transfers, endogenous demand feedback, and rich-country causal transfer slopes remain unavailable/unqualified.

Tests specific to this architecture: varying the conditional wellbeing coefficient cannot change revenues, transfers, adoption or corporate behavior in the fixed-response model; changing contribution/allocation must still change receipts and the conditional mapping; observed month0 and conditional month0 remain separate; target evaluated at month t depends on month-t economic conditions only, not the previous wellbeing output; old preset still obeys its exact rate0.02 recurrence; new exports cannot be mistaken for realized time paths. Include meaningful boundary/saturation fixtures and the actual source-budget constraint; do not demand every response be small.

### Verified threshold inventory and dead-control corrections

**Governance classification:** `constants.ts:getArchetype` has gov <0.35; gov <0.50 with GDP >5000; GDP >=35000 and gov >=0.80; GDP >=10000 and gov >=0.60. These select workforce defaults and must be removed from new default causal paths by explicit workforce inputs. Keep legacy replay behavior only.

**Wallet eligibility is presently not operative:** `constants.ts:getNationalPolicy` uses governance >=0.40, but `simulation/run.ts:initialCountryData` overwrites it with >0.40. `stepSimulationPure` does not consult nationalPolicy or directToWalletEnabled: all allocation proceeds government-agnostically. Therefore do not claim a legitimate 0.4 eligibility cliff or test that it must affect receipts. Remove misleading eligibility UI or report “wallet restrictions are outside this model.” If implemented later, require an explicit observed/assumed eligibility input, consistent boundary convention, recipient handling and reconciliation.

**Real current behavioral thresholds in pure.ts:** projected demand collapse >15% raises contribution and may change allocation; <5% plus reputation>70 lowers contribution; reputation<30 increases contributions; competitor contribution difference ±0.10 changes stance/rate; reputation changes at 1.2/0.8 times peer contribution and reputation50; stance labels at contribution0.12/0.25. US wellbeing <30/<50 with falling trend or >70; China wellbeing<40/<60; the named “EU” group average<40/>65, with rate<0.20. The group actually includes GBR and CHE, so it is not EU membership. These are assumed corporate heuristics, not sourced political/behavioral rules. Archive/surface them with their model; do not silently apply conditional wellbeing to these triggers.

**Other thresholds:** projectedDemandCollapse display uses customer wellbeing<40; demandFactor saturates at1; monthly adoption caps at0.999; macro unemployment caps0.6 and cognitive unemployment0.9; legacy crisis threshold is displacementGap>30% monthly wage, subsistence changes at adoption>0.60 and transfer floor multiples. In anchored mode the legacy wellbeing penalties are overwritten, but countriesInCrisis still reports its threshold count. Label that diagnostic separately. Review activation traces, and do not call these all “economic capacity limits.”

**Confirmed dead public controls:** App.tsx still renders Surplus Tax (`corporateTaxRate`) and Adoption Incentive (`adoptionIncentive`) as editable with badges; GDP Scaling (`gdpScaling`) and Displacement Rate (`displacementRate`) are also dead for anchored final outputs; Market Pressure (`marketPressure`) and Default Corp Policy (`defaultCorpPolicy`) are rendered but repo-wide reads found no engine/initialization consumption. The latter two appear in AI prompts, which can make explanations even more misleading. `baseUBI`, `globalRedistributionRate`, `directToWalletEnabled`, and `volatility` likewise have no reads in inspected world stepping. Hide/disable these for the built-in default using the shared capability contract, and fix AI prompt and Methods text. The App comment that unused controls remain because custom equations “may use them” is not sufficient: current evaluate() scopes do not pass these model variables. Declare support only for actual equation bindings. Corporation-specific contribution rate/allocation and actual adoption/macro inputs remain the useful controls.

## Concrete task4/5 implementation addendum: minimum conditional world reference

The following is a concrete proposed model definition, not a claim these numerical assumptions are empirically identified. The implementer should use these choices consistently instead of silently filling gaps. New model ID: `world-conditional-v1`. Old presets, model IDs and defaults attached to old artifacts retain their original definitions.

### Small implementation surface

Use one new `simulation/conditionalWorld.ts` module containing the new corporate resource calculation, conditional wellbeing calculation, month-zero initializer and result metadata. Add a single explicit `executionMode: 'legacy-world' | 'conditional-world-v1'` discriminator to ModelParameters. Missing discriminator means legacy-world, never the new default. Reuse the existing country/corporation/ledger run shape and geography/allocation code. Branch in `stepSimulationPure` at revenue generation, wellbeing calculation and corporation adaptation; do not duplicate the full stepper.

For the new mode, the existing `country.wellbeing` number may hold the conditional output **only if** `SimulationState.wellbeingDefinition = 'conditional-index-v1'` is mandatory and every reader uses the mode correctly. That is smaller than maintaining two evolving wellbeing states. Add optional `country.wellbeingComponents` with raw income/transfer/unemployment/total and validity. Keep `country.observedWellbeing` as a constant reference marker when sourced; never use it to seed a realized dynamics state. The new mode must bypass **all** wellbeing/trend consumers in revenue, demand predictions, corporate adaptation and reputation adaptation. Remove/disable their output cards via capabilities, rather than leaving obsolete computed narratives visible. Old mode stays untouched.

Maintainable rule: exactly one discriminator selects an execution definition; UI labels and capability checks derive from that definition. A test that mutates any conditional wellbeing coefficient without changing corporate or macro results verifies the absence of hidden feedback.

### Corporate resource model and genuine budget plateau

Author and version these scenario assumptions explicitly:

- Corporate market capitalization M is **assumed billions of constant-2015 USD**, newly declared scenario units; it is not a deflated observation of the real named company.
- Fixed corporate AI capability a is existing aiAdoptionLevel; fixed annual AI revenue-to-market-capitalization ratio r = 0.15/year. Monthly gross modeled AI revenue R = M × a × r / 12. Demand and reputation multipliers are exactly absent from this definition, not zero measured effects. They are outside scope.
- Define the available modeled source pool F = R by accounting convention (`availableShare = 1.00`). R is the modeled gross source, not a claim of economically disposable profits. Expenses, ownership incidence and competing uses are unestimated. An optional explicitly authored availableShare scenario may reserve part of R: F = R × availableShare and reservedForOtherUses = R−F. No default fraction is chosen to manufacture a plateau.
- Existing contributionRate becomes requested share q of the modeled gross monthly source. Requested funds Q = R × q; actual contribution C = min(Q,F). Valid public q in [0,1], optional availableShare in [0,1]. Also support an explicit requested monthly amount Q >= 0 for funding diagnostics/stress (with an exclusive request kind, never simultaneous amount and rate setters). Unfunded request = max(0,Q−F), unused available funding = F−C. No borrowing or outside financing.
- Freeze the request specification, allocation strategy, a, M and availableShare across months unless the user explicitly edits a scenario input; no competition, reputation, wellbeing-triggered or political adaptation in this mode.
- The selected global/customer/HQ allocation route consumes C, never Q. Preserve all-country population denominator. Require valid recipients; a missing HQ or empty customer recipient set is a typed invalid scenario, not lost funds.

This imposes source conservation, not an empirically estimated profit or spending limit. The public 100% rate endpoint alone is not a measured economic bottleneck. To demonstrate actual source exhaustion, use explicit requested amounts below/at/above F. With Apple M=3000, a=0.65, R=F=24.375 billion/month, requested amounts Q=12.1875,24.375,36.5625 yield C=12.1875,24.375,24.375 and unfunded requests0,0,12.1875. Unused source is12.1875,0,0. Every actual contribution remains funded, while the last requested amount cannot be met from the modeled pool. This is an arithmetic scenario example, not Apple's real revenue or cash position. Optional availableShare changes must be visible authored assumptions, never selected to create an attractive plateau.

Expose constraint data `{name,unit,requested,available,actual,slack,unfunded,assumptionId}`. Don't call a fixed50% rate slider endpoint a financing constraint. New q supports0–100%; the visible plateau follows the separately inspectable available resource assumption.

Accounting acceptance is local to these modeled corporate resources and transfers:

- R = reservedForOtherUses + F.
- F = C + unusedAvailableFunding.
- Sum(C) = sum(country receipts), with no leakage or borrowing in this mode.
- Global/customer/HQ breakdowns reconcile to total receipts.
- Transfer payments do not increase modeled produced GDP; recipients' transfers are funded by C.

This is not balanced full national accounts: firm ownership losses, indirect taxes, displaced consumption, general-equilibrium prices, public financing and household distribution are unestimated. Do not use `net welfare`, `total benefit` or a net fiscal cost claim. Corporate retained funding is a modeled resource remainder, not profit attributable to real shareholders.

### Macro and workforce

Reuse existing reduced-form macro equations as **illustrative scenario conditions**, with explicit per-country cognitiveShare and naturalUnemployment records frozen from the prior initialized default and marked assumed. Their default numbers are not new measurements. Governance no longer selects either value. Keep the US reference optional and horizon-limited; it does not earn a global macro-evidence status. Avoid new political regime classifications.

Expose AI adoption growth, automationShare, reemploymentMonths, productivityGain, laborShareSensitivity and baselineGrowth under “Scenario assumptions,” not policy controls. Transfer-policy comparisons hold these inputs and initial state fixed. Macro outcomes' paired differences under this definition are structurally absent; UI says “Transfer-to-macro feedback not modeled” instead of interpreting identical paths as an estimated zero effect.

### Conditional wellbeing: exact choice and population basis

Keep the existing associational log-GDP/governance anchor coefficients for the selected matching dataset, but evaluate the **raw** regression without the15–90 clamp. Income index I = GDPperResident × laborShare/0.60; income component A = intercept + lnGdp × ln(I) + governanceCoefficient × governance. Require I>0; no silent floor or epsilon replacement. The labor-share rescaling remains an assumed extension of a GDP regression.

Use existing transfer coefficient beta = 2.8 index points per income doubling as an explicitly **assumed** default; retain no claim the cited studies identify its dose slope. Transfer ratio s = monthlyTransferPerResident / (GDPperResident × laborShare /12). Transfer component T = beta × log2(1+s). This deliberately remains a per-resident labor-income proxy, not household disposable income or consumption.

Replace the old overlapping aggregate/direct unemployment coefficient with an explicitly direct, non-income scenario term:

- `nonIncomeLossPerAdditionalUnemployedPerson = 5` index points (equivalent0.5 ladder point). This is a NEW declared scenario assumption, **not an estimate drawn from the existing papers**.
- `laborForcePerResident = 0.50` per country, explicitly assumed until replaced by compatible sourced population data. Do not call it the employment rate. It represents economically active persons / all residents.
- Additional unemployed persons per resident e = max(0,u−uNatural) × laborForcePerResident.
- Non-income population-average decrement U = 5 × e. One percentage point additional unemployment then subtracts0.025 index point when laborForcePerResident=0.50. No separate aggregate unemployment penalty is added; no income loss is contained in this5-point coefficient by definition.
- Conditional index W = A + T − U. No temporal relaxation and no output clipping. If W is outside[0,100], mark that country's wellbeing output unsupported/outside declared mapping scale, retain the raw diagnostic value, and don't include it in a supposedly valid headline without excluded-count/coverage information.

The values5 and0.50 are intentionally explicit and inspectable, not empirically qualified. The **wellbeing mapping remains illustrative**, while its computation can be implementation-reviewed. Joint sensitivity must include non-income loss0/5/10, laborForcePerResident0.35/0.50/0.65, beta0/2.8/5.6 and explicit alternative income denominators. These are diagnostic scenarios, not a confidence interval or probability distribution. Zero is a tested counter-assumption, not default omission of harm. Distinct assumed values may be substituted later only as a new reviewed model definition with the same honesty requirements.

If new assumption values are judged too much model-authoring for this task, do not silently reuse0.45; retain old wellbeing output as illustrative legacy and leave the new capability unavailable. The concrete proposed definition above is the minimum that removes the prior combined aggregate/direct penalty and substitutes an assumed additive non-income channel. Statistical independence from the associational anchor is not established.

### Month zero and observation date

Add `initializeConditionalOutputs(run, inputs)` called by initialRun/initOptionsFor for this mode. It evaluates the corporate resource/allocation calculation and W on month-zero economic conditions **without** advancing month/adoption/GDP or applying any lag dynamics. Month-zero policy receipts and conditional output thus have the same semantics as every subsequent month. Record the ledger as `monthly-flow-at-month`, not cumulative elapsed spending. No time integral may count month0 as already-paid historical money.

Treat the supplied initial GDP as the scenario month-zero actual GDP. At initial affected share x, derive gdpNoAi = initialGDP / (1 + productivityGain*x), initialize laborShare = 0.60*(1-laborShareSensitivity*x), u=uNatural, displacedPool=0 and lastAiAdoption consistently before evaluating W. The inferred no-AI baseline and initial displaced pool are assumptions. Use identical static level equations at month zero and later months without advancing month-zero growth or displacement. Reference mode must apply its month0 reference conditions before the output mapping. Original observed ladder remains separately dated; exclude unsourced formula fallback from the observed marker. Never splice observed ladder values into the new conditional index path.

### Verified demandFactor dimensional issue

Current calculateAiRevenue computes `customerDemand = sum(GDP USD/person/year × population millions × wellbeing/100)`, whose numeric unit is **million USD/year**. It divides by `marketCap billions USD ×10`. Under the code's stated expected-demand denominator interpretation, the latter needs units of annual demand (10/year). Even granting that implicit time unit, a factor1000 is missing.

Hand calculation using the repo's USA GDP66856.5131698371, population340.003797 million, a hypothetical wellbeing70, and real Apple model marketCap3000 billion, with only USA as a diagnostic customer:

- raw customerDemand = 15,912,027.832347583 **million USD/year**;
- converted demand = 15,912.027832347583 **billion USD/year**;
- existing ratio = 15,912,027.832347583 /30,000 =530.4009277449194, capped to1;
- denomination-correct ratio =15,912.027832347583 /30,000 =0.5304009277449194.

Thus the ratio before the min cap is overstated1000-fold in this diagnostic. This calculation does not establish that every real current company output changes1000-fold; operating-country totals and the min cap matter. The denominator's economic meaning/year unit is itself undocumented. New fixed-response mode avoids this formula altogether; don't claim to have validated it. Preserve historical mode for reproducibility and document this defect in its review status; a corrected dynamic model must get a new version rather than silently rewriting replay.

Further monetary audit: marketCap is a stock; R/C/receipts are monthly flows; GDP/labor income are annual per-resident flows; `country.population` is millions. Use `usdPerPerson` only for billion-flow/million-person conversion; divide GDP-based income by12 before transfer ratios. Existing initialized `corp.aiRevenue` numbers are overwritten by the formula; new initialization must do that before first displayed result. Corporate market cap is assumed; availableShare 1.00 defines the modeled source accounting boundary, while any alternative availableShare is an explicit scenario assumption. PRK/TWN fallback GDP remains explicit assumed basis or unsupported for wellbeing; never silently include a nominal unknown value in a reviewed constant-dollar ratio. Record assumed-country counts and covered population.

### Actual qualification resolver

Do not place `reviewed:true` on the preset and trust it. Add a checked-in, generated `validation/default-review.json` with:

- model definition version/hash, relevant engine code version, dataset content hash, initial corporate table hash, monetary-assumption table hash, scenario-input rules hash;
- declared reviewed parameter domains and joint restrictions;
- exact executed test/report artifacts, date, command, success/failure counts and retained finding IDs;
- outcome/capability classifications and reviewed coverage;
- response grid and joint-case definitions, raw results/flags, explained constraints, unresolved anomalies and exclusions.

Canonical serialization must sort object keys, reject non-finite numbers and include full equations/assumptions/initial state, not display names alone. Use the existing hashing machinery if it is deterministic and adequate; qualification lookup compares the full canonical signature or cryptographic digest, not a short non-cryptographic display hash alone. A manifest hash proves identity, not model quality.

`resolveReview(inputs, manifest)` accepts a known structural fingerprint plus input values within the explicitly tested/reviewed region; it checks unsupported custom equations, dataset changes, workforce overrides and monetary basis. Exact registered default gets its actual artifact classification. In-domain parameter changes inherit only the declared region-specific capability review, with their own run fingerprint and conditional assumption list. Unknown structural variants or out-of-region inputs become unreviewed/illustrative, never silently reuse the preset's badge. An old result cannot supply its own trusted qualification record: recompute identity and lookup local signed/pinned artifact content.

Use a test/report command that regenerates the computed evidence and a --check mode that fails stale artifacts. Failure includes missing test cases, changed model/dataset signature, accounting residual outside predeclared numerical tolerance, non-finite outputs, unhandled domain error, disconnected advertised control, or unexplained material-response flag. Large response alone is not a failure; it must be recorded and explained. Human scientific review remains a distinct record rather than an assertion generated by the same tests.

### Capability verdicts and visible controls

For the proposed completed implementation, warranted statuses are:

| Component | Status that can be earned now | Acceptance |
|---|---|---|
| Corporate resource and transfer allocation | reviewed-conditional | Identities, units, budget constraint, geographic coverage, live controls, zero comparator, replay and scenario-domain checks pass; assumptions visible |
| Budget plateau and funding constraint | reviewed-conditional arithmetic | Requested-amount sweep below/at/above source reproduces independent expected figures; no endpoint called measured capacity |
| World macro conditions | illustrative | Existing reduced form remains assumed/calibrated; no new causal evidence |
| US faithful macro option | reproduced-reference within scope | Port checks and month0–60 contract pass; do not transfer claim to world macro/wellbeing |
| Conditional wellbeing mapping | illustrative, implementation-checked | Explicit population/dose/denominator assumptions, no overlap/timing claim, raw range diagnostics and sensitivity report |
| Realized wellbeing timing, induced demand, total policy GDP/employment effects, risk/safety | unsupported | Outputs absent or plainly unavailable; never represented as estimated zero |

Top-level model label: **“Conditional world reference”**, with visible one-line scope “Compare funded transfers under stated corporate and macro assumptions; wellbeing is an illustrative conditional index.” Do not attach an unqualified global reviewed badge to every output. Stage3 can be reported complete **only within this explicitly published reference scope after the specified checks and response review are actually accepted**; the report must simultaneously say wellbeing/macro causal qualification is not established. If the requested Stage3 interpretation requires a reviewed causal wellbeing response, this design does not meet that demand and should remain partial.

Visible policy controls: corporation requested contribution rate and allocation strategy. Visible scenario controls: optional authored available funding share, corporate scale/capability assumptions, adoption/macro assumptions, and explicitly illustrative wellbeing assumptions. Remove dead built-in controls listed above. No custom control qualifies solely because an equation parses; require binding and response evidence. Map, Charts and Corporations remain usable for their compatible outputs; Futures remains separate and unavailable as an effect of these transfers. Ship exports/imports with output definition, flow convention, support status and complete assumptions.

### Bounded acceptance checklist for task4/5

Task4 model work: implement new mode and month-zero semantics; retain old behavior; explicit workforce/money assumptions; remove wellbeing feedback in new mode; add budget diagnostics and conditional mapping; correct live-control capabilities.

Task5 evidence/UX work: generate raw response/qualification artifacts; independent hand fixtures and domain/threshold/interaction tests; check old/new replay and bundle identity; active-view adapter uses actual result definitions; explain scope, finance constraint and illustrative outcomes on first visit. Test the actual map/chart/corporation view at month0 and a later month, changing the explicit requested monthly amount below and above the modeled source budget. The plateau message must identify available funds, requested funds and unfunded request. New default need not duplicate or rebuild the application.


### Final funding ruling (supersedes the original 0.20 proposal)

Use availableShare 1.00 by definition of the modeled source pool. No empirical availability/expense fraction is introduced by default, and no fraction is selected to make a plateau appear. Source-exhaustion tests use explicitly requested amounts exceeding that source; they verify conservation and visible unmet requests. The 100% contribution-rate endpoint is a control boundary, not empirical evidence of economic capacity.

Independent expected-value fixture: source 24.375 billion/month; requests 12.1875,24.375,36.5625; paid 12.1875,24.375,24.375; unpaid 0, 0, 12.1875; retained source 12.1875,0,0. Test that recipients sum to paid, paid+retained equals source, and paid+unpaid equals requested. Raising the source is a separate hypothetical source assumption, not a policy-free increase in available resources.

Substantive limitation: because the source construction is a gross-revenue scenario, interpreting its entire pool as funds a real corporation could safely transfer would be unjustified. Label it “modeled source pool” throughout, disclose expenses/ownership/competing uses as unestimated, and do not call the available balance profit, surplus cash or net public benefit. This is defensible for the explicitly scoped conditional resource/allocation accounting reference, while broader macro/wellbeing remains illustrative. No production code changed by this design note.

## Final implementation corrections from independent design review

The read-only review in docs/design/reviews/2026-09-15-stage35-default-design-review.md is accepted with these concrete choices. It does not accept unbuilt code.

1. Supplied initial GDP is month-zero actual scenario GDP. Infer the no-AI baseline by removing the model's initial adoption-level boost; initialize labor share using that same initial affected share. Zero growth and zero adoption change must yield identical month-zero/month-one static levels. Reference mode uses its own month-zero values. No observation is relabeled a measured no-AI counterfactual.
2. The new headline is a population-weighted conditional index, distinct from legacy's unweighted country mean. Record the population, country count and validity behind it. Do not compare changing cohorts: if any country is outside the mapping range, the full-roster headline/delta is unavailable while valid country outputs and raw diagnostics remain inspectable. A later explicitly labeled common-cohort comparison can be added; never silently drop an inconvenient country and report a gain.
3. Conditional world execution requires the complete declared country roster, unique IDs and positive finite populations. A map filter changes display, not recipients. Reject missing HQ/operating-country IDs, unknown allocation strategies and empty destination sets; customer allocation means population-weighted residents of operating countries, not known individual customers. Preserve subset-state legacy replay only in legacy mode. Small hand fixtures may test the pure allocation helper against their own explicit full roster.
4. The unemployment term is an assumed additive non-income channel. Removing the old combined penalty does not establish empirical independence from the GDP/governance anchor. Define unemployment as a labor-force fraction and laborForcePerResident in[0,1]; retain all-resident versus survey-population limitations.

# Default model card: world-conditional-v1

Version: conditional-assumptions-v1, 15 September 2026. Computational response evidence is generated separately from independent review. The 61 exact default monthly points (months 0–60) are **accepted for conditional source/allocation accounting after independent automated numerical/accounting review** ([review report](reviews/2026-09-15-beta-security-qualification-review.md)). This is not human or empirical approval, nor a claim that final product integration is complete. Macro and conditional wellbeing remain illustrative. Broad empirical default qualification is not established.

## Scope and output

The complete declared roster contains 128 countries and 7,443.352 million modeled residents. This is the denominator of the population-weighted conditional index, not a stated fraction of humanity. Two country GDP inputs (PRK and TWN) have newly declared hypothetical constant-2015 USD values; they are not observed/converted GDP evidence. Country-level validity and assumed-GDP population coverage remain in every output. If any country's raw index is outside [0,100], the full-roster headline is unavailable. A changing valid-country subset must never silently replace it in a comparison.

Month zero and later months use the same conditional mapping and GDP definitions. The supplied initial GDP is actual scenario GDP; its inferred no-AI baseline is a model construction. Observed initial ladder values remain a separate reference. Monthly labels identify economic conditions, not adaptation time, realized life satisfaction, or a long-run equilibrium. The reviewed candidate horizon is months 0–60; the US reference adapter refuses month 61. Reduced-form execution beyond 60 is outside this evidence review.

## Resource accounting and controls

All amounts below use hypothetical constant-2015 USD. Market capitalization is in billions; source, requests and receipts are billions per month. Corporate amounts were newly authored in that basis, not historically deflated from an unknown vintage.

```
modeled monthly source = marketCap × aiAdoptionLevel × 0.15 / 12
available = modeled source × availableShare
requested = source × contributionRate OR explicit monthly amount
funded = min(requested, available)
reserved + unused + funded = source
funded + unfunded = requested
sum of resident receipts = funded
```

The source is a hypothetical gross-revenue construction. It is not profit, surplus cash, empirical fundraising capacity or net public benefit. Default availableShare=1 is a convention; expenses, ownership and competing uses are unestimated. Amount requests above available funds demonstrate actual modeled exhaustion. The 100% slider endpoint alone does not show exhaustion evidence.

Global allocation reaches all modeled residents equally; HQ allocation reaches headquarters-country residents; customer-weighted allocation reaches residents of operating countries in proportion to population, not identified customers. The executor requires the complete roster, unique positive populations, valid HQ/operating IDs and nonempty destinations. There is no eligibility threshold in the new allocation helper. Legacy wallet/governance/crisis rules are absent.

Policy controls are requested contribution amount/share and allocation. Available share, corporate scale, adoption, GDP/workforce and mapping coefficients are scenario assumptions. `resolveRunCapabilities` is the shared control inventory. Legacy displacementRate, gdpScaling, corporateTaxRate, baseUBI, adoptionIncentive, globalRedistributionRate, marketPressure and adaptive-policy controls do not become supported merely because fields survive in old presets. Transfers do not enter produced GDP. Wellbeing-to-demand, corporate adaptation, game theory, transfer-to-macro feedback, spending-to-safety and net welfare are unsupported.

## Conditional wellbeing and evidence

```
income = intercept + logGDPslope × ln(GDPpc × laborShare / 0.60)
         + governanceSlope × governance
transfer = transferEffectPerDoubling × log2(1 + annualTransfer /
           (GDPpc × laborShare × incomeDenominatorMultiplier))
nonIncomeUnemployment = assumedLoss × max(0, unemployment-naturalUnemployment)
                       × laborForcePerResident
raw index = income + transfer - nonIncomeUnemployment
```

Raw values are retained; [0,100] is a mapping/display validity boundary, not causal saturation. The conditional income anchor does not apply the old 15–90 clamp. Income, transfer and non-income loss remain separately inspectable. There is no past-wellbeing term or feedback into economics.

The anchor is an associational fit of WHR ladder on log GDP per capita and governance: **335 observations, 120 countries, 2015/2020/2025**. Labor-share rescaling is an additional assumed bridge, not the fitted regressor. The non-income loss coefficient (default 5 index points per additional unemployed person), labor-force fraction per resident (0.50), income denominator multiplier (1), and transfer slope (2.8) are assumed. The unemployment rate is a labor-force fraction; multiplying by laborForcePerResident converts it to an all-resident share. This additive decomposition does not establish statistical independence from the income/governance anchor. Survey respondents and all residents are not matched populations.

The cash-transfer meta-analysis provides a pooled standardized effect, not a dose-matched slope per income doubling or a validated global permanent-transfer response. Direct unemployment and aggregate spillover findings from different populations are not added here. See [the source/limitations note](research/cash-transfer-wellbeing-evidence.md). No passing response grid supplies the missing dose/population/outcome/time match.

## Response and qualification contract

[The frozen response report](conditional-response-v1.md) lists every attempted deterministic case and failure. Compressed machine-readable evidence in the gitignored local artifact `tmp/qualification/world-conditional-v1-profile.jsonl.gz` (regenerate with `node --import tsx scripts/response-profile.ts --freeze`) retains every month (0–60), every country, raw mapping/components, GDP/labor income/unemployment, population coverage and corporation source budget. The evidence manifest binds payload and source-file hashes. Supported builds obligatorily verify current source freshness before building and again at Vite build start/end. Development serves an actual source-hash marker and invalidates/reloads pages when freshness changes; stale development inputs remain unreviewed. The plain module fails closed outside that pipeline. `npm run qualification:source-check` verifies source plus committed evidence metadata from a clean checkout without requiring the large local raw file. `node --import tsx scripts/response-profile.ts --check` fails on altered sources, payload, omitted cases, failed calculations or incomplete paths.

Ranges are declared investigation ranges, not confidence intervals. Nonnegative growth/source/effect parameters have unbounded executable domains, so finite sweeps do not claim full mathematical-domain coverage. Full finite domains are swept where applicable. Joint allocation × funding, adoption × automation × reemployment, and transfer slope × denominator × non-income-loss × resident labor-force-fraction cases are deterministic assumption scenarios; their frequency is not probability. Legacy governance bucket thresholds are probed with explicit workforce values. Adoption and unemployment numerical caps and raw mapping bounds remain distinct from source exhaustion.

Qualification resolves from exact actual model and economic snapshot inputs, roster, workforce, money provenance and history/import distinctions, plus executing implementation identity. Only derived conditionalWellbeing and conditionalSummary fields are excluded from the input digest. They are separately recomputed from the current snapshot and checked with a fixed absolute tolerance of1e-10; booleans, structure and nonnumeric fields must match exactly. Authored inputs are never rounded. The reviewed region consists only of exact reviewed snapshot identities, with no interpolated region or inherited model-ID badge. A changed input is a new unreviewed identity. Imported snapshots remain importedUnverified even after current accounting/mapping recomputation; imported macro history is not replay-certified. Saved review flags cannot supply local review authority.

Independent automated review inspected the frozen outputs and explanations and accepted only the 61 exact default monthly accounting points. Generated checks alone cannot accept additional points or capabilities. Broader macro/wellbeing and unsupported mechanisms cannot inherit an accounting verdict.

## Historical/reference evidence retained

Published targets and tolerances are unchanged. The historical comparison cohort is **106 countries**, not the fit population. Existing AI-off reconstruction: correlation 0.473, MAE 4.53 index points versus persistence MAE 4.68. Legacy anchored AI-on MAE 4.48 is in-sample, not a conditional-default historical forecast. GDP errors and the absence of a transfer-employment mechanism remain limitations. No new causal accuracy is claimed from these baselines.

The faithful Korinek port's specified US reproduction is separate from the reduced-form world path and the wellbeing extension. Legacy discontinuities, the demand million/billion error, crisis penalties and old displacement dynamics remain documented in [archived legacy evidence](model-card-legacy.md). They are not new-default evidence. The old fixed-target recurrence is tested analytically at assumed rates 0, .02 and 1: target + (initial-target) × (1-rate)^month. At .02 only 38.4% of a constant change appears by month24; the new conditional output omits that law entirely.

## Threshold inventory and interpretation

The executed conditional thresholds are requested funds meeting available source, adoption capped at0.999, macro unemployment capped at0.6/cognitive unemployment at0.9, and raw mapping validity at0/100. Funding is an accounting constraint; adoption/unemployment caps are numerical/scenario limits; mapping bounds are output validity. They cannot substitute for estimated behavioral capacity. Every monthly activation list is retained.

Legacy-only investigation sites are governance0.35/0.50/0.60/0.80 with GDP5000/10000/35000, projected demand changes5%/15%, reputation30/50/70, peer-rate difference±0.10 and ratios0.8/1.2, stance rates0.12/0.25, regional wellbeing30/40/50/60/65/70 and rate0.20, crisis displacement above30% of wage, and subsistence/adoption0.60. Their effects and known defects belong to legacy evidence. Wallet governance0.40 is not an operative eligibility cliff. New probes at the old governance/GDP boundaries retain explicit workforce inputs and must not claim that a nonexistent wallet restriction changes receipts.

Legacy timing/dose arithmetic is not a new conditional-model mechanism: a fixed transfer dose ratio s and slope beta imply a target increment beta×log2(1+s), and the old rate r realizes the fraction1−(1−r)^t. At r0/.02/1 the month24 fractions are0/0.3842/1. Changing dose, slope, denominator or timing together can therefore change the old realized increment; none of these algebraic combinations identifies an empirical response. The new output has no r parameter.

The near-zero contribution case sets every corporation to0.001; its zero-rate comparison is `range-contributionRate-0`. The report's material-trigger table compares all cases to the shipped default instead. The complete grid initially caught six infeasible macro-cap fixtures; these were corrected under an explicit automation0.5 assumption and tested below/at/above both caps before final regeneration. Rejected cases were not counted as successes.


Source manifest version2 follows static local import/export dependencies from the explicitly listed world/profile/build entrypoints, plus package.json/package-lock.json. It includes the reachable math parser and JSON inputs. Unused validation/schema/fixture modules are not represented as reviewed execution dependencies; any later static import pulls its reachable files into the digest. Dynamic scenario values are separately exact-bound. This pins locked dependency declarations, not installed package bytes or arbitrary-platform bitwise arithmetic.

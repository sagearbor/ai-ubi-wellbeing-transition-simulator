# Model card: default world model (`organic-incentive` preset on the built-in engine)

Filled from `docs/design/model-card-template.md`. Numbers come from `npm run validate`,
`npm run validate:korinek`, `npm run hindcast` and `npm run profile:default` at the version below.
Where a row says "assumed", the number was chosen by the author and no source exists for it.

```
Model:            built-in engine, simulation/pure.ts, preset organic-incentive (PRESET_MODELS[0])
Version:          branch stage3/qualify-default, 2026-09-13 (engine after findings C2, C3, C4 of
                  docs/design/audit-2026-09-13.md were fixed)
Maintainer:       repository owner
Reviewed:         2026-09-13, internal (Claude), against the v3 plan section 4. Not externally
                  reviewed. Status: CANDIDATE, not a reviewed default (see "Known failures").
```

## Scope

- **Geography and populations:** 128 countries as recipients and as customers, 79 corporations as
  payers. Each country is one record (population, GDP per capita, governance, Gini, wellbeing).
  There is no within-country distribution, no regions, no cohorts.
- **Dates and step:** month index 0 is January 2025; one step is one month; the app runs to any
  horizon, this card reviews 5 and 10 years.
- **Outcomes it can report:** per-country wellbeing (0 to 100 index), world average wellbeing,
  per-country AI adoption (0 to 1), UBI received by channel, displacement gap, countries in crisis,
  corporate AI revenue and contributions, a cooperation/defection summary of the corporation
  table, and a "no intervention" shadow wellbeing. With the optional macro block: GDP per capita
  path, labour share, unemployment and cognitive unemployment.
- **Policy mechanisms it can represent:**
  | Mechanism | Parameter or hook |
  |---|---|
  | Speed of AI adoption | `aiGrowthRate` (model) |
  | Share of labour income lost at full adoption | `displacementRate` (model) |
  | Whether UBI utility tilts toward rich or poor countries | `gdpScaling` (model) |
  | How much each corporation gives | per-corporation `contributionRate` (overridden by adaptive rules, see C7) |
  | Where the money goes | per-corporation `distributionStrategy`: global / customer-weighted / hq-local |
  | Task-based macro dynamics | `macro` block (off in this preset) |
- **Parameters shown in the UI that the engine does not read (finding C6):** `corporateTaxRate`,
  `adoptionIncentive`, `globalRedistributionRate`, `marketPressure`, `defaultCorpPolicy`. The
  Equations tab still documents formulas using them from an earlier engine; those formulas are
  not what runs.
- **Unsupported:** taxation, public budgets, prices, trade, migration, demographics, within-country
  inequality dynamics, any state or sub-national unit, any outcome for countries with no
  corporation operating in them (their adoption stays at its initial value).

## Causal structure

One line per lever, as the code actually computes it (`simulation/pure.ts`):

- `aiGrowthRate` → country adoption: `Δadoption = aiGrowthRate × (1 + gdp/100000) × meanCorpLevel × 0.1 × (1 − adoption)`, once per country per month, where `meanCorpLevel` is the mean `aiAdoptionLevel` of corporations operating there. Adoption → lost wages and → displacement friction below.
- `displacementRate` → lost wages: `lostWages = (gdp/12) × adoption × displacementRate`. Lost wages minus per-capita UBI is the displacement gap; a gap above 30% of the monthly wage triggers the crisis penalty (`−min(5, 10 × gap/wage)` per month).
- `contributionRate`, `distributionStrategy` → UBI: corporation revenue `= aiAdoptionLevel × marketCap × 0.15/12 × demandFactor × reputationMultiplier` (bn USD/month); contribution `= revenue × contributionRate`; global contributions are paid equally per person worldwide, customer-weighted by population of operating countries, hq-local to the HQ country only.
- UBI → wellbeing: `ubiBoost = (UBI × (1.5 − gini) × max(0.5, 1 + gdpScaling × 0.5 × (log10(gdp+1000) − 4))) / (gdp/40 + 150) × 120`; monthly wellbeing change `= 0.20 × ubiBoost − 0.12 × friction`, with `friction = sin(π × adoption) × 40 × (1 − governance)^1.5 × (1 + 0.5 × gini)`.
- Wellbeing → corporate revenue (demand feedback): `demandFactor = min(1, Σ gdp × wellbeing/100 × population / (marketCap × 10))`.
- Wellbeing → corporate behaviour: if a corporation's customer-base wellbeing is below 40 its contribution rate rises 0.02/month (to 0.5) and hq-local switches to customer-weighted; US-, China- and EU-headquartered corporations have extra rules keyed to home wellbeing thresholds (50/30, 40/60, 40/65).
- **Wellbeing has no level anchor in this preset:** monthly changes accumulate without mean reversion, clipped to [1, 100]. The macro block's `wellbeingAnchorRate` provides one but is 0 here.
- **Important channels that are missing:** no re-employment or wage recovery after displacement (lost wages are permanent while adoption stays high); no public transfers or taxes; no prices or inflation; no demand effect of UBI on GDP; no interaction between countries except through corporate contribution flows.
- **External assumptions the results depend on:** the corporation table (market caps, operating countries, initial rates and strategies) is hand-entered; country records are single-year snapshots with no source column.

## Accounting

- **Flows modelled:** corporate AI revenue (bn USD/month) → contributions (bn USD/month) → country receipts by channel (bn USD/month) → per-capita monthly UBI (USD/person/month). Lost wages are computed in USD/person/month but are not a flow out of anyone's account: they reduce a wellbeing term, they do not reduce GDP or corporate demand directly (demand falls only through wellbeing).
- **Funding boundary:** every transfer is paid from that month's corporate AI revenue. Nothing is financed by governments; nothing is borrowed; there is no stock of funds carried between months (the ledger is rebuilt monthly).
- **Identities enforced:** contributions in = UBI paid out, each month (anchor test AT-6, tolerance 1%). No identity links GDP to wages or revenue.
- **Units (fixed 2026-09-13):** billions USD for money stocks and flows, millions for population, USD/person/year for GDP per capita. Findings C3 and C4 in the audit were unit errors in exactly these conversions.

## Constraints and limits

| Limit | Kind | Equation or parameter | Provenance |
|---|---|---|---|
| Adoption cannot exceed 0.999 | numerical | `min(0.999, adoption + Δ)` | assumed |
| Contribution rate in [0, 0.5] | assumption | `min(0.50, rate + 0.02)`; relaxation floor `min(0.05, rate)` | assumed |
| Corporate revenue capped by customer demand | capacity | `demandFactor = min(1, demand / (marketCap × 10))` | assumed; the ×10 has no source |
| Wellbeing in [1, 100] | numerical | `max(1, min(100, w))` | assumed |
| Crisis penalty at most 5 points/month | assumption | `min(5, 10 × gap/wage)` | assumed ("societies adapt") |
| Wealth gradient at least 0.5 | assumption | `max(0.5, wealthGradient)` | assumed |
| Crisis regime switch at gap > 30% of wage | assumption (threshold) | `displacementGap > monthlyWage × 0.3` | assumed |
| Subsistence rules at UBI < gdp/25 with adoption > 0.6 (−1.5/month) and UBI > 2.5 × gdp/25 (+2/month) | assumption (threshold) | Phase 4 | assumed |
| No solver | numerical | all equations are explicit | n/a |

## Reviewed input region

- `aiGrowthRate` 0.04 to 0.15, `displacementRate` 0.5 to 0.95, `gdpScaling` 0 to 1, corporation
  contribution rates 0 to 0.5: these are the UI slider ranges and the ranges the response review
  below covers (0.5× to 1.5× of the preset values). No joint restrictions are known.
- Outside this region nothing is checked; results there are extrapolation and are not a claim.
- This region is a review boundary, not a probability distribution. No parameter has a declared
  uncertainty range in this engine (the authoring core requires one; this engine does not).

## Evidence

| Relationship | Kind | Population and dates | Source |
|---|---|---|---|
| Corporate AI revenue = 15%/yr of market cap at full adoption | assumed | large-cap tech, 2020s | none; plausible order of magnitude only |
| Demand factor and reputation multiplier (0.85 to 1.15) | assumed | — | none |
| Adoption logistic with GDP modifier and mean corporate capability | assumed | — | none |
| Corporate contribution and distribution rules | assumed | — | none |
| Adaptive rules (demand-collapse trigger, competitor matching, reputation) | elicited (author's game-theory intuition) | — | none |
| Regional rules (US/China/EU thresholds) | assumed | — | none |
| UBI → wellbeing boost, incl. Gini damper and wealth gradient | assumed; coefficients tuned when UBI was effectively zero (C5) | — | none |
| Displacement friction `sin(π·adoption)`, governance exponent 1.5 | assumed | — | none |
| Crisis penalty and subsistence rules | assumed | — | none |
| Wellbeing coefficients 0.20 / 0.12 | assumed ("rebalanced" by hand) | — | code comment |
| Shadow (no-intervention) path | assumed | — | none |
| Wellbeing anchor `7.454 + 5.103·ln(gdp) + 7.658·governance` (macro block only) | associational, calibrated | 106 countries, 2015 to 2025 | World Happiness Report ladder, World Bank GDP; fitted on the same span it is scored on |
| Macro block (GDP path, labour share, displaced pool) | calibrated, reduced-form | US, 2026 to 2030 | Korinek, Jones, Sacher, Cotter & McCrory (2026) published 2030 outputs; approximation, not their mechanism |
| Country records (population, GDP, governance, Gini) | assumed snapshot | c. 2020 | no source column in `constants.ts` |
| Corporation table (79 rows) | assumed | c. 2024 | hand-entered |

Count: 15 relationships, of which 13 are assumptions or elicitations. The two calibrated ones
are off in this preset (macro block absent).

## Response review

From `npm run profile:default` (horizons 5 y and 10 y; ±1% and ±10% on each lever; 0.5× to 1.5×
sweep classified with the authoring core's `classifyShape`).

Base path:

| Horizon | avg wellbeing | US wellbeing | poor-8 wellbeing | US adoption | countries in crisis | inflow bn/mo |
|---|---|---|---|---|---|---|
| 0 | 54.1 | 92.5 | ~36 | 0.010 | 0 | 27 |
| 5 y | 45.0 | 57.2 | 36.2 | 0.469 | 15 | 101.3 |
| 10 y | 31.3 | 1.0 | 29.5 | 0.715 | 40 | 125.1 |

Small nudges, change in average wellbeing (index points):

| Lever | base | horizon | −10% | −1% | +1% | +10% | amplification | sweep shape |
|---|---|---|---|---|---|---|---|---|
| aiGrowthRate | 0.090 | 5 y | +2.0 | +0.27 | −0.18 | −2.1 | 0.79 | |
| aiGrowthRate | 0.090 | 10 y | +0.2 | −0.00 | −0.03 | −0.2 | 0.71 | threshold (span 11.4) |
| displacementRate | 0.750 | 5 y | +2.0 | +0.28 | −0.23 | −2.4 | 0.85 | |
| displacementRate | 0.750 | 10 y | +0.3 | −0.00 | −0.03 | −0.2 | 1.00 | saturating (span 10.4) |
| gdpScaling | 0.400 | 5 y | +0.0 | −0.00 | +0.00 | +0.0 | 1.11 | |
| gdpScaling | 0.400 | 10 y | +0.0 | +0.00 | −0.00 | −0.0 | 1.45 | non-monotone (span 0.1) |
| contributionRate | 0.103 | 5 y | −0.1 | +0.03 | +0.03 | +0.1 | 0.33 | |
| contributionRate | 0.103 | 10 y | −0.0 | +0.01 | +0.01 | +0.0 | 0.38 | non-monotone (span 0.3) |

Switches (difference from base at 10 y):

| Switch | alternative | avg wellbeing | US wellbeing | poor-8 wellbeing | crisis count | inflow bn/mo |
|---|---|---|---|---|---|---|
| distributionStrategy | all global | +25.0 | +0.0 | +58.3 | +0 | −0.3 |
| distributionStrategy | all customer-weighted | −1.8 | +0.0 | −4.3 | +0 | −0.0 |
| distributionStrategy | all HQ-local | −1.8 | +0.0 | −4.3 | +0 | −0.0 |
| macro | DEFAULT_MACRO on | +0.2 | +0.0 | −0.4 | +0 | +0.1 |

- **Largest small-nudge response:** ±10% on `aiGrowthRate` or `displacementRate` moves 5-year
  average wellbeing by about 2 points, roughly proportionally (amplification 0.8 to 1.0). Fine.
- **Binding constraints found:** the wellbeing floor of 1 binds for the US from year 9 (so 10-year
  US responses are one-sided: −10% adoption growth gives +4.7, +10% gives 0.0). The contribution
  rate cap of 0.5 is reached by most corporations through the adaptive rule.
- **Threshold or regime-switch behaviour:** the crisis rule (gap > 30% of wage) is a modelled rule,
  not an artefact; it switches on for the US at adoption ≈ 0.4 (year 4 to 5) and then removes up
  to 5 points a month with no time limit, which is why the 10-year sweep on `aiGrowthRate`
  classifies as *threshold*. The subsistence rules are two more thresholds.
- **Dead or near-dead levers:** `gdpScaling` (≤ 0.1 point at any nudge) and the starting
  `contributionRate` (converges under the adaptive rule within ~3 years, finding C7).
- **Solver failures or non-finite results:** none (no solver; all runs finite).
- **Unresolved discrepancies:** the "all global" switch moves poor-country wellbeing by +58 points
  at about 16 USD/person/month. That magnitude has no evidential basis (finding C5, open).

## Evaluation

- **Implementation checks:** 471 vitest tests; engine step is pure (clone-per-step test); compiled
  default equations reproduce the hardcoded engine bit-for-bit (golden test); money conservation
  (AT-6). Anchor tests 5/6: AT-1, AT-2, AT-4, AT-5, AT-6 pass; AT-3 (race-to-bottom risk > 0.6
  when all corporations start selfish) fails at 0.578. Anchor tests are causal-direction checks,
  not accuracy checks.
- **Reproduction:** the macro block reproduces Korinek et al. (2026) US-2030 outputs for three
  scenarios within tolerance (KJ-1 to KJ-3) as a reduced-form approximation with an exogenous
  adoption path; it does not implement their equations. The block is off in this preset.
- **Historical reconstruction (2015 to 2025, 106 countries, AI off, macro on):** wellbeing-change
  correlation r = 0.485, MAE 4.48 index points (0.448 ladder points); persistence baseline
  (predict no change) MAE 4.68. The wellbeing anchor was fitted on this same span, so this is a
  reconstruction, not a forecast. GDP path: r −0.04, MAE 17% (the macro block's growth rule does
  not track country GDP). With UBI on at real units the reconstruction degrades to r 0.181 / MAE
  7.04, which is evidence against the current UBI coefficient (C5).
- **Policy-effect benchmarks:** none. No published policy effect has been mapped onto this engine.
- **Fitting history:** wellbeing coefficients 0.20/0.12 hand-set (code comment, undated);
  wellbeing anchor OLS fitted 2026-09 on WHR 2015 to 2025; macro block tuned 2026-09 to Korinek
  2030 targets; C2 to C4 unit and aggregation fixes 2026-09-13, after which the anchor baseline
  moved from 4/6 to 5/6 and the 6-month regression values in `simulation/pure.test.ts` were
  re-locked.

## Known failures and open questions

- UBI → wellbeing coefficient overshoots for poor countries by an order of magnitude or more once
  units are correct (C5). Until recalibrated against transfer-size evidence, every UBI-driven
  gain shown by the app is illustrative.
- Lost wages are permanent and untaxed: 75% of labour income disappears at full adoption with no
  re-employment channel (the macro block's displaced pool exists but does not feed wages). This
  single assumption drives every collapse the app shows.
- Wellbeing accumulates monthly changes with no level anchor in this preset; a long run drifts to
  a bound by construction.
- Five UI parameters and the Equations tab describe an engine that no longer runs (C6).
- Country and corporation records have no source column.
- AT-3 fails; the race-to-bottom metric has not been reviewed for whether 0.6 is a meaningful bar.
- Countries with no operating corporation never adopt AI.
- The Futures tab is a separate influence model with its own assumptions; nothing here validates
  its probabilities.

**Verdict:** the default is a coherent, deterministic, conserving mechanism model whose numbers
are assumptions. It qualifies as the *illustrative default* with this card attached. It does not
qualify as a reviewed default until C5 is recalibrated with evidence and the displacement
assumption is either sourced or bounded.

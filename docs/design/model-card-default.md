# Model card: world model presets on the built-in engine

> **Default changed 2026-09-14 (owner decision 4(a) of the independent review):** the app now opens
> with the **provisional level model** (`evidence-anchored`, section "Candidate variant" below),
> presented as *evidence-informed assumptions*, not as validated or reviewed. The legacy flow model
> (`organic-incentive`, the first sections of this card) remains available as "Organic Incentive Model
> (legacy, illustrative)" for reproducibility. Qualification of a dependable default is still open.
>
> **Country data migrated 2026-09-14 (owner decision 4(b)):** country inputs now come from the
> sourced dataset `countries-wb-2026-09` (World Bank WDI + WGI, reference year 2024; conventions in
> `data/countries/README.md`). The hand-entered table is kept as `countries-legacy-v1` for saves and
> links made before the migration. Numbers in this card are on the new dataset; before/after for
> every table is in `docs/design/research/country-data-migration.md`.


Filled from `docs/design/model-card-template.md`. Numbers come from `npm run validate`,
`npm run validate:korinek`, `npm run hindcast` and `npm run profile:default` at the version below.
Where a row says "assumed", the number was chosen by the author and no source exists for it.

```
Model:            built-in engine, simulation/pure.ts, preset organic-incentive (PRESET_MODELS[0])
Version:          main after stages 2-4, 2026-09-13 (engine after findings C2, C3, C4 of
                  docs/design/audit-2026-09-13.md were fixed; stage 4 slice 2 additions below)
Country data:     countries-wb-2026-09 (data/countries/wb-2026-09.json), from 2026-09-14;
                  countries-legacy-v1 before
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
- **External assumptions the results depend on:** the corporation table (market caps, operating countries, initial rates and strategies) is hand-entered. Country records are single-year snapshots from `countries-wb-2026-09` with a source, year and status per value (23 Gini values, 2 GDP values and 1 population value are still hand-entered and flagged).

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
| Wellbeing anchor `2.877 + 5.991·ln(gdp) + 1.830·governance` (macro block only; `countries-legacy-v1` keeps `7.454 + 5.103·ln(gdp) + 7.658·governance`) | associational, calibrated | 335 country-years (2015/2020/2025), scored on 106 countries 2015 to 2025 | World Happiness Report ladder, World Bank GDP (constant 2015 US$), WGI-based governance; fitted on the same span it is scored on. The governance coefficient is within one standard error of zero on sourced data |
| Macro block (GDP path, labour share, displaced pool) | calibrated, reduced-form | US, 2026 to 2030 | Korinek, Jones, Sacher, Cotter & McCrory (2026) published 2030 outputs; approximation, not their mechanism |
| Country records (population, GDP, governance, Gini) | observed snapshot, flagged where not | 2024 (Gini 2014-2024) | `data/countries/wb-2026-09.json`: SP.POP.TOTL, NY.GDP.PCAP.KD, SI.POV.GINI, WGI GE/RL/CC; governance is institutional quality, not democracy |
| Corporation table (79 rows) | assumed | c. 2024 | hand-entered |

Count: 15 relationships, of which 12 are assumptions or elicitations. The two calibrated ones
are off in this preset (macro block absent); the country records are now observed.

## Response review

From `npm run profile:default` (horizons 5 y and 10 y; ±1% and ±10% on each lever; 0.5× to 1.5×
sweep classified with the authoring core's `classifyShape`).

Base path:

| Horizon | avg wellbeing | US wellbeing | poor-8 wellbeing | US adoption | countries in crisis | inflow bn/mo |
|---|---|---|---|---|---|---|
| 0 | 55.2 | 95.7 | 40.7 | 0.010 | 0 | 27.1 (month 1) |
| 5 y | 45.4 | 52.4 | 36.8 | 0.477 | 15 | 104.2 |
| 10 y | 31.7 | 1.0 | 30.4 | 0.724 | 40 | 124.8 |

Small nudges, change in average wellbeing (index points):

| Lever | base | horizon | −10% | −1% | +1% | +10% | amplification | sweep shape |
|---|---|---|---|---|---|---|---|---|
| aiGrowthRate | 0.090 | 5 y | +2.0 | +0.17 | −0.23 | −2.2 | 0.94 | |
| aiGrowthRate | 0.090 | 10 y | +0.2 | +0.03 | +0.00 | −0.1 | 0.70 | threshold (span 10.3) |
| displacementRate | 0.750 | 5 y | +2.0 | +0.16 | −0.24 | −2.5 | 1.07 | |
| displacementRate | 0.750 | 10 y | +0.2 | +0.03 | +0.00 | −0.2 | 0.89 | saturating (span 9.6) |
| gdpScaling | 0.400 | 5 y | −0.0 | −0.00 | +0.00 | +0.0 | 0.97 | |
| gdpScaling | 0.400 | 10 y | +0.0 | +0.00 | −0.00 | +0.0 | 2.71 | non-monotone (span 0.1) |
| contributionRate | 0.103 | 5 y | −0.1 | +0.04 | +0.02 | +0.1 | 0.28 | |
| contributionRate | 0.103 | 10 y | −0.0 | +0.01 | +0.01 | +0.1 | 0.58 | non-monotone (span 0.2) |

Switches (difference from base at 10 y):

| Switch | alternative | avg wellbeing | US wellbeing | poor-8 wellbeing | crisis count | inflow bn/mo |
|---|---|---|---|---|---|---|
| distributionStrategy | all global | +23.1 | +0.0 | +55.7 | +0 | +0.1 |
| distributionStrategy | all customer-weighted | −1.6 | +0.0 | −3.9 | +0 | +0.0 |
| distributionStrategy | all HQ-local | −1.6 | +0.0 | −3.9 | +0 | −0.0 |
| macro | DEFAULT_MACRO on | +0.3 | +0.0 | −0.3 | +0 | −0.0 |

- **Largest small-nudge response:** ±10% on `aiGrowthRate` or `displacementRate` moves 5-year
  average wellbeing by about 2 points, roughly proportionally (amplification 0.9 to 1.1). Fine.
- **Binding constraints found:** the wellbeing floor of 1 binds for the US from month 104 (month
  114 on the legacy table), so 10-year US responses to ±10% nudges are 0.0 in both directions
  (on the legacy table −10% adoption growth gave +4.7). The contribution
  rate cap of 0.5 is reached by most corporations through the adaptive rule.
- **Threshold or regime-switch behaviour:** the crisis rule (gap > 30% of wage) is a modelled rule,
  not an artefact; it switches on for the US at adoption ≈ 0.4 (month 48) and then removes up
  to 5 points a month with no time limit, which is why the 10-year sweep on `aiGrowthRate`
  classifies as *threshold*. The subsistence rules are two more thresholds.
- **Dead or near-dead levers:** `gdpScaling` (≤ 0.1 point at any nudge) and the starting
  `contributionRate` (converges under the adaptive rule within ~3 years, finding C7).
- **Solver failures or non-finite results:** none (no solver; all runs finite).
- **Unresolved discrepancies:** the "all global" switch moves poor-country wellbeing by +56 points
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
  Corrections 2026-09-13 (stage 4 slice 2, read from Table 3, p. 31 of the September 2026 working
  paper): the modest scenario's cognitive unemployment is 2.9% (the repo had 3.9%, and the reduced
  form still lands on 3.9%, now +1.0 pp off, inside the 2.5 pp band); the substantial scenario's
  headline unemployment is 4.6% (repo had 4.3%; reduced form 4.2%). The published values are for
  the start of 2030, while the reduced form is scored at end-2030, eleven months later — a timing
  mismatch that is disclosed and not re-tuned.
- **Reproduction, faithful (stage 4):** `data/core/korinek-2026-faithful.json` implements the
  paper's own equations (Table A.1, monthly 2024-2030, four bisection solves per month) in the
  authoring core with no engine changes. It reproduces 169 published cells of Tables 3, 5 and 6 at
  the paper's rounding (max error 0.049 vs tolerance 0.055), holds the accounting identities every
  month, passes the limiting cases, and matches the authors' explorer code to ~1e-11 at 11 settings
  including 8 non-default ones (expected values stored as numbers with URL and hash; no explorer
  code in the repo). Mapping and departures: `docs/design/research/korinek-2026-model.md`. It is a
  Lab model, not wired into the world engine; the world engine's macro block remains the reduced form.
- **Historical reconstruction (2015 to 2025, 106 countries, AI off, macro on):** wellbeing-change
  correlation r = 0.473, MAE 4.53 index points (0.453 ladder points; 0.485 / 4.48 on the legacy table); persistence baseline
  (predict no change) MAE 4.68. The wellbeing anchor was fitted on this same span, so this is an
  in-sample reconstruction, not validation and not a forecast. GDP path: r −0.04, MAE 17% (the macro block's growth rule does
  not track country GDP). With UBI on at real units the reconstruction degrades to r 0.175 / MAE
  7.03, which is evidence against the current UBI coefficient (C5).
- **Policy-effect benchmarks:** one case, Alaska Permanent Fund Dividend (Jones & Marinescu 2022;
  `data/cases/alaska-pfd.json`, `npm run validate:cases`). The world engine (either wellbeing
  mode) has **no mechanism** by which a transfer changes employment: running it with every
  corporation contributing 0 vs 0.5 leaves US unemployment identical. That is verified by running
  the engine, and it means the headline null (+0.1 pp, 95% CI −3.0 to +3.3) cannot be matched or
  missed — the model is silent. The part-time (+1.8 pp), participation, hours and sector outcomes
  are outside the model. The authors' own micro-vs-macro calibration, ported as a core model,
  predicts −0.7 pp (published edition; −0.2 pp working-paper edition): discrepancy −0.8 pp,
  not fitted, not independent of the authors. Dose for scale: the dividend was 7.25% of labour
  income; the engine's transfer at a 50% contribution rate is 0.5% of US labour income.
- **Fitting history:** wellbeing coefficients 0.20/0.12 hand-set (code comment, undated);
  wellbeing anchor OLS fitted 2026-09 on WHR 2015 to 2025; macro block tuned 2026-09 to Korinek
  2030 targets; C2 to C4 unit and aggregation fixes 2026-09-13, after which the anchor baseline
  moved from 4/6 to 5/6 and the 6-month regression values in `simulation/pure.test.ts` were
  re-locked. 2026-09-14 country-data migration: the anchor was refitted on the WGI-based governance
  column over the same 335 country-years (R² 0.651 → 0.644) and the regression snapshots were
  re-locked per dataset (`docs/design/research/country-data-migration.md`).

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
- Country records were migrated on 2026-09-14 from the hand-entered table to `countries-wb-2026-09`
  (`data/countries/README.md`; before/after in `docs/design/research/country-data-migration.md`):
  population and GDP per capita (constant 2015 US$, the anchor's own series) are observed for 127
  and 126 of 128 countries (TWN, PRK keep flagged hand-entered values), Gini for 105 (23 flagged,
  9 observations older than 2019), governance for all 128 as institutional quality from the WGI
  (Government Effectiveness, Rule of Law, Control of Corruption), mapped onto the engine's existing
  governance scale; it is not a democracy measure. Open: (a) on sourced governance the anchor's
  governance coefficient is 1.83 ± 3.09, indistinguishable from zero; (b) the Korinek US
  calibration (cognitive share 0.62, natural unemployment 3.9%) still reaches the US only through
  the `rich-democracy` archetype, which the US clears by 0.024 governance points; cognitive share
  and natural unemployment should be sourced per country; (c) 21 countries changed archetype
  (e.g. Mexico and Brazil to "authoritarian", China and Kazakhstan to "developing-fragile"); the
  archetype names are legacy labels for capacity bands, not regime classifications; (d) corporate
  money is undated and not deflated while GDP is constant 2015 US$ (US deflator 2015→2024 1.289x).
  Corporation AI revenue and adoption have no public reference series and remain assumptions.
- AT-3 fails for a measurement reason, not a dynamics one: race-to-bottom risk is
  `(selfish − 0.4·N) / (0.6·N)` over the corporation table, which is 1.0 in the all-selfish
  starting state, but the harness only records states after a step, and in month 1 the
  demand-collapse trigger flips about 20 of 79 corporations to "generous" because their customer
  countries start below wellbeing 40. The recorded maximum is 0.578 against a 0.6 bar. The bar is
  met by the initial state, not the dynamics; the test is left failing and the metric is not a
  finding about the market.
- Countries with no operating corporation never adopt AI.
- The Futures tab is a separate influence model with its own assumptions; nothing here validates
  its probabilities.

## Candidate variant (stage 4): `evidence-anchored`

Same corporations, adoption and money flows; only the wellbeing update changes, from the
accumulating flow above to a level model (`MacroParameters.wellbeingMode = 'anchored'`):

```
target       = anchor(anchorIncome, governance) + ubiEffect − unemploymentEffect
wellbeing   += (target − wellbeing) × 0.02 per month          (assumed speed; 3-year half-life)
anchorIncome = GDP per capita × labourShare / 0.60             (normalised GDP-equivalent index, not an income)
anchor       = clamp(2.877 + 5.991·ln(anchorIncome) + 1.830·governance, 15, 90)   (WHR 2015-2025 fit on countries-wb-2026-09, R² 0.64)
labourIncome = GDP per capita × labourShare                    (actual labour income per resident)
ubiEffect    = 2.8 × log2(1 + monthly UBI / (labourIncome / 12))   [index points per doubling; range 1.6-4, assumed]
unemploymentEffect = 0.45 × (unemployment − natural) in pp         [index points; range 0.3-1.0, assumed]
```

Corrections after the independent review of 2026-09-14 (`docs/design/reviews/`, findings 6-9):
the transfer term is now genuinely per doubling (`log2`; the earlier `4 × ln` gave 2.77 index points
per doubling while this card advertised 0.4 ladder points), its denominator is actual labour income
rather than the normalised anchor input (the old proxy understated transfer/income by 40%), and the
anchor clamp is shown. The clamp and the wellbeing bounds [1, 100] were not active for any country in
the base run or the harshest stress case below. Headline numbers moved by at most 0.2 points
because transfers are small at current fund sizes.

Initial wellbeing comes from the latest World Happiness Report ladder × 10 (US ≈ 70) instead of
the unsourced `gdp/1200 + 40` rule (US 95.7 on `countries-wb-2026-09`, 92.5 on the legacy table); countries the WHR does not cover fall back to the
rule. The legacy levers `displacementRate` and `gdpScaling` do nothing in this mode (disclosed);
the macro block's `automationShare`, `reemploymentMonths`, `laborShareSensitivity`,
`productivityGain` become the live levers.

| Relationship | Kind | Population and dates | Source |
|---|---|---|---|
| Transfer → life satisfaction, 0.28 ladder points per doubling of labour income, log2 | **evidence-informed assumption.** The meta-analysis gives a pooled, dose-blind effect (d = 0.13 SD ≈ 0.25-0.3 ladder points, ~2-year average follow-up); reading it as the effect of a doubling, the log form, the income denominator, and applying it as a permanent long-run target are all modelling choices. The range 1.6-4 is assumed; a pooled 95% CI is not a slope distribution. | Kenya (GiveDirectly, 2011-2019), Finland (2017-18), US pilots (2019-22); 45 LMIC-heavy studies | `docs/design/research/cash-transfer-wellbeing-evidence.md`; McGuire, Kaiser & Bach-Mortensen 2022 |
| Unemployment → mean life satisfaction, ~0.045 ladder points per pp | **evidence-informed assumption** combining a direct effect on the unemployed (GSOEP) with an aggregate spillover estimate from other populations; whether the aggregate estimate already contains the direct effect is not verified (possible double count), and an unemployment-rate point is treated as a population point. Range 0.3-1.0 assumed. | Germany 1984-2011; Europe/US 1975-1997 | same note; Winkelmann & Winkelmann 1998, Di Tella, MacCulloch & Oswald 2001/2003, Kassenboehmer & Haisken-DeNew 2009 |
| Adjustment speed 0.02/month | **assumed** (no source). After 24 months only 38% of a constant target change is realised, so the transfer evidence's two-year effects are not reproduced on their own timescale. | — | — |
| Labour income anchor | associational, calibrated | 106 countries 2015-2025 | WHR ladder, World Bank GDP (as above) |
| GDP path, labour share, displaced pool | calibrated, reduced-form | US 2026-2030 | Korinek et al. 2026 published outputs |

Not validated for: a permanent, simultaneous 100+-country transfer; rich-country UBI at national
scale; persistence beyond ~2-3 years (the evidence's average follow-up).

Response review (`npm run profile:default -- --model=evidence-anchored`):

| Horizon | avg wellbeing | US wellbeing | poor-8 wellbeing | US adoption | countries in crisis |
|---|---|---|---|---|---|
| 5 y | 58.9 | 69.6 | 41.7 | 0.510 | 0 |
| 10 y | 59.3 | 70.3 | 43.5 | 0.784 | 0 |

- Every lever, public or macro, moves 10-year average wellbeing by at most ±0.4 points for a ±10%
  nudge; sweeps classify as linear or flat, except the assumed adjustment speed
  (`wellbeingAnchorRate`, now profiled), which is non-monotone over 0.5x-1.5x with a 0.1-point span
  (faster adjustment moves countries toward targets that lie on both sides of their start). "All
  global" distribution adds +0.6 to the poor-8 mean (legacy: +58). These are small because the
  transfers are small and the displacement channel is mild under `DEFAULT_MACRO`, not because the
  model has been shown to be robust; small responses are a property of these assumptions.
- The transition is close to wellbeing-neutral under `DEFAULT_MACRO` because productivity gains
  (+55% GDP at 78% adoption) roughly offset the labour-share fall (0.60 → 0.34) in the income
  anchor, and re-employment at 12 months keeps the displaced pool near 2 pp. That is a statement
  about the Korinek-calibrated "substantial" scenario, not about AI in general; the "extreme"
  parameters (automationShare 0.9, reemploymentMonths 18) are one slider away and are the case to
  review next.
- No thresholds, no crisis rule, no clamp or floor active in the reviewed region (checked every month).

Stress review, stage 4 slice 2 (`profile:default -- --model=evidence-anchored`, "stress" switch;
the model's own wellbeing coefficients, only the displacement coefficients change):

| Case | US wellbeing 5 y / 10 y | US unemployment peak | US labour share 10 y | avg wellbeing 10 y | poor-8 10 y |
|---|---|---|---|---|---|
| base (`DEFAULT_MACRO`: automation 0.5, re-employment 12 mo) | 69.6 / 70.3 | 7.0% (yr 3) | 0.343 | 59.3 | 43.5 |
| Korinek extreme (automation 0.9, re-employment 18 mo) | 68.3 / 68.9 | 11.5% (yr 4) | 0.343 | 59.0 | 43.5 |
| extreme, re-employment 60 mo | 66.5 / 64.7 | 21.2% (yr 7) | 0.343 | 58.2 | 43.5 |
| extreme, 60 mo, adoption growth ×2 | 63.9 / 62.8 | 28.2% (yr 5) | 0.285 | 57.7 | 43.5 |

(Recomputed on `countries-wb-2026-09` with the peak taken over every month; the legacy-table rows are
in the migration report.)

- The size of the displacement response is set by two assumptions, not established limits: the
  unemployment coefficient (0.45 index points per pp, so a 24 pp excess lowers the target by ~11
  points) and the assumed adjustment speed (wellbeing lags the target by ~5 points at the
  unemployment peak; a faster speed would show more of the drop sooner). Worst case here US −7.5 at
  10 y. These rows are a description of the model under stated coefficients, not a bound on how bad a
  transition could be; the coefficient and speed ranges have not been swept jointly.
- The income anchor barely moves: labour income falls ~20% against the no-AI path in the
  harshest case (GDP 136k × 0.285/0.60 = 65k vs 81k), which the log slope turns into −1.4 index
  points. Capital income, which rises with GDP, is not in the anchor and benefits nobody in this
  model — an omission, disclosed, not a finding about who gains.
- Poor-8 wellbeing does not respond at all: those countries have almost no operating
  corporations, so almost no adoption (the "countries with no operating corporation never adopt"
  limitation above), not resilience.
- US `aiAdoption` passes Korinek's 2030 extreme value (0.45) within 5 years in every case; this
  engine's adoption is corporation-driven and is not the same quantity as their task share m × d.
  No transfer-side protection is visible: US UBI stays near 12 USD/month, so `ubiEffect` ≈ 0.01.

In-sample retrospective reconstruction of the candidate (`npm run hindcast`, 2015-2025, 106
countries; the anchor was fitted on this span, so this is not validation):

| Run | corr ΔWB | MAE (index) | note |
|---|---|---|---|
| legacy + anchor, AI off | 0.473 | 4.53 | headline gate (HC-1, HC-2) |
| anchored, AI off | 0.473 | 4.53 | identical by construction: with no adoption and no transfer both reduce to the same anchor (pinned as a limiting-case test) |
| legacy, AI on | 0.244 | 25.35 | the flow model collapses over a decade that did not collapse |
| anchored, AI on | 0.488 | 4.48 | mean change +1.0 vs actual +2.6; GDP-growth MAE 28.6%, GDP-change correlation −0.14 |
| persistence (predict no change) | 0.000 | 4.68 | the comparator to beat |

Outcome by outcome: the anchored-AI-on run beats persistence on wellbeing by 0.20 index points of
MAE (0.020 ladder points) in-sample (0.25 on the legacy table), and does badly on GDP growth. That supports only the narrow
statement that switching AI on in the candidate does not blow up an in-sample wellbeing fit, which
the legacy default does. It supports no predictive or causal claim; that would need frozen
calibration and data vintages scored on temporal or country holdouts against the same comparators.

Status: **candidate**. It is offered as a preset so the two wellbeing models can be compared side
by side; switching the default is the owner's decision after external review.

**Verdict (legacy default):** the default is a coherent, deterministic, conserving mechanism model whose numbers
are assumptions. It qualifies as the *illustrative default* with this card attached. It does not
qualify as a reviewed default until C5 is recalibrated with evidence and the displacement
assumption is either sourced or bounded.

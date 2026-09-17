# Forecast paths and one matched diagnostic round

Date: 16 September 2026 (US Eastern). Research branch only; no production model change.

The new round did not beat the existing country-offset forecast or achieve a 20% reduction in wellbeing error. Omitting health improved the original health specification by only 0.00106 ladder points at the 2025 endpoint. The tested saturating-income feature reduced the rich-country penalty but worsened overall accuracy. This is a limited/negative result, not a new winning model.

## What the percentage means

For each outcome and horizon, `skill = 1 - model MAE / persistence MAE`. MAE is mean absolute prediction error. Persistence holds each country's own 2018 value constant. Positive skill means less error; negative skill means more error. It is not improvement over the legacy simulator, a percentage of happiness, or variance explained.

- Wellbeing: absolute error in 0–10 Cantril ladder points, equally weighted across available country/year observations. There is no population weighting.
- Income: absolute GDP-per-person error divided by that country's 2018 GDP per person, multiplied by 100. Units are percentage points of origin GDP. The graphs instead display underlying levels in constant-2015 US dollars.
- `endpoint` uses only 2025: 97 observed countries for either outcome. `pooled` uses all available 2019–2025 country/year observations: 681 ladder and 691 GDP observations. Missing targets are excluded separately.
- There is no combined wellbeing/income score. The bold weights were selected for wellbeing, not GDP.

For 2025 wellbeing, the existing offset model's error is 0.3513185 versus persistence 0.3890000: 9.69% less error. A 20% reduction requires 0.3112 or lower on this same endpoint test. For the pooled test, the corresponding threshold is about 0.23180. These are different objectives and must not be interchanged.

## Registered diagnostic, not an untouched test

The original outcomes and rich-country failures were already known when this round was designed. Committing new predictions before scoring them does **not** restore an untouched test set.

The protocol was committed at `d68147b`; implementation, fits, internal checks and five prediction sets at `fa55c5590752cf0c144c65b8c28c04f1a5fca988`. Exactly one new scored invocation produced `score-receipt.json` and `scores.json` at 2026-09-17T02:39:38Z. The scorer refuses existing artifacts and requires all study inputs to be committed before opening outcomes. Full hashes are in the protocol and freeze manifest. No original frozen result was altered or rescored through its original scoring command.

The matched two-by-two design switches health on/off and log income versus `log(GDP / (GDP + k))`. The saturation scale `k` is the median training-cutoff GDP, estimated within each training fold. All four variants share first-difference fitting, no intercept, normalized ridge penalty 0.1, identical GDP extrapolation, and 0.8 damping. Omitting health refits the GDP coefficient. A fifth prediction averages the four variants with fixed equal weights. No weight optimization followed the score.

Only 2015–2018 data were used in fits. Internal checks fit through 2016 for 2017–2018 and through 2017 for 2018. They are short-horizon development checks, not a substitute for the seven-year endpoint. All historical ladder and health clamp counts were zero, so caps did not cause this round's small responses.

## Results ledger

All entries below are **exploratory diagnostics on known outcomes**. None is promoted to a qualified production default.

| Entry | 2025 ladder MAE | Error reduction vs persistence | Pooled ladder MAE | Richest-quarter endpoint skill |
|---|---:|---:|---:|---:|
| Health + log income (control) | 0.362696 | 6.76% | 0.274834 | -10.48% |
| Log income only | 0.361637 | 7.03% | 0.274581 | -10.77% |
| Saturating income + health | 0.370222 | 4.83% | 0.280387 | -0.32% |
| Saturating income only | 0.369784 | 4.94% | 0.280216 | -0.45% |
| Equal four-model average | 0.365326 | 6.09% | 0.277203 | -4.10% |

Negative richest-quarter skill means worse than persistence. Quartiles are fixed by 2018 income, 25 origins each; score denominators exclude unavailable outcomes.

### Wellbeing MAE at every horizon

| Entry | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Health + log income (control) | 0.11574 | 0.19023 | 0.28819 | 0.30548 | 0.32115 | 0.34481 | 0.36270 |
| Log income only | 0.11560 | 0.19004 | 0.28819 | 0.30571 | 0.32101 | 0.34435 | 0.36164 |
| Saturating income + health | 0.11837 | 0.19580 | 0.29441 | 0.31097 | 0.32642 | 0.35105 | 0.37022 |
| Saturating income only | 0.11830 | 0.19566 | 0.29430 | 0.31094 | 0.32625 | 0.35081 | 0.36978 |
| Equal four-model average | 0.11696 | 0.19276 | 0.29111 | 0.30784 | 0.32331 | 0.34760 | 0.36533 |

### GDP MAE and skill at every horizon

All four variants and the fixed average have identical GDP paths by design.

| Horizon | Observations | MAE, percentage points of 2018 GDP | Error reduction vs persistence |
|---|---:|---:|---:|
| 2019 | 99 | 1.31827 | 49.85% |
| 2020 | 99 | 7.32112 | -43.28% |
| 2021 | 99 | 4.64536 | 21.43% |
| 2022 | 99 | 5.28510 | 36.35% |
| 2023 | 99 | 6.06109 | 40.52% |
| 2024 | 99 | 7.68178 | 40.53% |
| 2025 | 97 | 9.26199 | 40.74% |
| pooled | 691 | 5.92963 | 31.45% |

### Internal checks (development only)

| Entry | Ladder MAE | Country/horizon observations |
|---|---:|---:|
| Health + log income (control) | 0.132605 | 298 |
| Log income only | 0.132519 | 298 |
| Saturating income + health | 0.134084 | 298 |
| Saturating income only | 0.134274 | 298 |

Internal persistence MAE: 0.135299. Small development differences did not establish a large long-horizon gain.

### Countries moving the new result most

For the fixed four-model average at the 2025 endpoint, positive numbers mean a reduction in absolute ladder error relative to persistence. Dividing by 97 gives each country's contribution to the overall MAE improvement. Five largest improvements and five largest deteriorations are shown; all countries are in the score artifact.

| Country | Individual absolute-error reduction |
|---|---:|
| India (IND) | +0.13828 |
| Nepal (NPL) | +0.13627 |
| Moldova (MDA) | +0.13434 |
| Vietnam (VNM) | +0.13136 |
| Philippines (PHL) | +0.12185 |
| Yemen (YEM) | -0.20284 |
| Bangladesh (BGD) | -0.14293 |
| Ethiopia (ETH) | -0.14253 |
| Myanmar (MMR) | -0.12817 |
| Pakistan (PAK) | -0.09784 |


## Reading the weather-style chart

The report provides individual country paths, dark observations, thin models, a bold ensemble, and a shaded range of displayed models. The two outcomes are visible separately. Historical mode compares 2018 forecasts with observed 2019–2025 outcomes. Future mode begins at observed 2025 values and projects to 2032. Separating the views avoids pretending a missed historical forecast joins the latest observation.

The default bold line is 75% country offsets plus 25% Claude's decaying offsets, the lowest endpoint MAE in the earlier 583-recipe catalog. Its roughly 10.2% historical advantage was selected on those known outcomes, not established by a new test. Alternatives show the simple 50/50 pair and the fixed new diagnostic average. The graph does not recommend these weights as optimal future or GDP weights.

Future paths use **unchanged 2018 fits**. The offset adapter calls the original forecasting function and reproduces its saved historical predictions exactly. Decay and health reconstructions match within floating-point tolerance; the health maximum ladder discrepancy is 1.78e-15 points. The future health variants retain old health trends; governance stays at its old background value. No policy intervention or AI transition shock is applied. These are illustrative implications of frozen models, not updated operational forecasts.

94 of 100 origins have both 2025 observations and get forward paths. Haiti, Belarus, Bhutan, UAE, Lebanon, and Yemen are excluded from forward projection; no older starting observation is substituted. Historical masks remain separate by target.

The model range is **not a calibrated probability band**. Related models share data and assumptions; all can miss together. The default US historical view deliberately shows the common upward forecast missing the later wellbeing decline. Across-country average improvements do not guarantee country-specific improvements.

## What should happen next

1. Stop optimizing this already-examined 2019–2025 period. Keep the offset model as the research reference and the simple two-model blend as a candidate, not a proven upgrade.
2. Obtain a longer annual wellbeing panel with sample sizes/standard errors and its release history. The present target uses overlapping trailing three-year averages; distinguish underlying wellbeing change from survey noise and smoothing. Preserve source versions and availability dates.
3. Freeze an evaluation plan over new countries/periods or genuinely future observations before opening outcomes. Develop with rolling origins and horizons matching the intended use; report all tried specifications. A new origin scored on already-seen outcomes remains retrospective.
4. Test a compact state-space or partially pooled country-trend model against persistence and the existing offset reference, with uncertainty about survey measurements. Limit candidate count before evaluation. Add health/social variables only when they provide reproducible incremental skill; a larger variable list does not guarantee 20%.
5. Keep policy-causal evidence separate. Forecasting country wellbeing under continuing trends does not show that an intervention will produce the same change.

There is no basis here for promising 20%. It remains a possible research outcome, not an expected consequence of more testing. The next useful step is better data and a test that can still fail independently, rather than more combinations on the same period.

Method references: [forecast combinations](https://otexts.com/fpp3/combinations.html), [rolling-origin evaluation](https://otexts.com/fpp3/tscv.html), and [the three-year-average ladder target](https://ourworldindata.org/grapher/happiness-cantril-ladder).

## Reproducibility and verification

`data/evaluation/diagnostic-health-income-2018-v1/` contains the protocol, calibration, predictions, internal validation, manifest, single score/receipt, and plotted paths. `scripts/evaluation/forecast-paths/README.md` gives display-only rebuild commands. Do not rerun `score_once.py`.

Verified locally: `npm run check` (1,321 tests in 101 files plus the repository checks and production build), nine new Python checks, JavaScript syntax, historical-to-future controls, ensemble selection, missing-origin behavior, touch values, line toggles, and phone-sized layout down to 320 pixels. The pre-existing build warns about large chunks. No deployment was performed.

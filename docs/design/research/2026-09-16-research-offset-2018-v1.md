# Country offsets and within-country GDP changes

External 2019–2025 results are **pending**. This entry is frozen for a controller-owned, one-time comparison after every family member and the separate long-run forecast is frozen. No external outcome, original prediction, original score, full hindcast panel, or other agent output was read during development. This is retrospective exploratory development informed by the previously disclosed aggregate miss, not a blinded or archived-as-of forecast. Authorship is an automated research agent, not an independent human/domain-expert review.

## Question and alternatives

A pooled association between income, institutions, and country ladder levels need not describe the destination toward which an individual country moves. Persistent differences can reflect omitted stable conditions or reporting patterns. But keeping each origin residual forever can also preserve sampling error; partial reversion might help. This protocol therefore compares retention of all, half, and none of each country's origin offset, with four annual adjustment rates. It does not assume its assigned diagnosis is correct.

[Bell and Jones (2015)](https://doi.org/10.1017/psrm.2014.7) distinguish within-unit and between-unit relationships and discuss limitations of choosing fixed effects by default. This motivates separate slopes, not a claim that the proposed forecast is causal or automatically better. [Liu, Moon and Schorfheide (2017)](https://arxiv.org/abs/1709.10193) study forecasting short panels with heterogeneous coefficients and cross-sectional shrinkage. Our small deterministic grid is not their empirical Bayes estimator. [Hyndman and Athanasopoulos](https://otexts.com/fpp3/tscv.html) describe rolling origins and multi-step validation: every validation forecast here is fitted only to earlier observations.

No paper's fitted country coefficients or numeric outcomes enter this method. No World Happiness Report post-2018 regression or ranking tables were consulted.

## Registration and exact inputs

Protocol commit: `e8e6e72700ba32576269901885f27c7dab7574c9`, made before any fitting or validation execution. The protocol has no amendments. All code, calibration, internal losses, and predictions were then generated before the external gate.

- Protocol: `data/evaluation/research-offset-2018-v1/protocol.json`.
- Numerical readers: only `data/evaluation/level-holdout-2018/train.json` and `origin.json` in that directory.
- Original training has 101 background countries and 399 paired observations over 2015–2018. Forecast origin has 100 countries; 28 of the 128-country roster are excluded by the existing origin rules. The protocol reproduces every included ID and excluded ID/reason.
- Baseline, source/default files, old holdout artifacts, lockfile and application behavior are untouched. The shared dependencies are read-only.
- No extra numerical data, borrowed coefficients, future covariates, or future-dependent deletion.

## Registered model

First fit the pooled level anchor in ladder units:

`A_it = a + b_between * ln(GDP_it) + c * governance_i`.

Separately estimate `b_within` by least squares on country-demeaned ladder and log GDP, using paired training rows only. No year effects are included; common shocks and time-varying confounding can affect this predictive association. Frozen 2015 governance cannot identify a within-country institutional-change slope.

For each country at the forecast origin, set `e_i0 = ladder_i0 - A_i0`. Forecast GDP using a mean annual log-growth rate from adjacent observed training years. The candidate rate is zero, the pooled rate, an equal average of local and pooled rates, or the local rate. A missing local rate uses the pooled training rate. Growth is damped by `0.9^(h-1)` each year and the initial annual log-growth rate is clipped to `[-0.10, 0.10]`.

For each future year, use

`target_i,h = A_i0 + w * e_i0 + b_within * ln(GDP_i,h / GDP_i0)`

`ladder_i,h = clamp((1-lambda)*ladder_i,h-1 + lambda*target_i,h, 0, 10)`.

The complete ladder grid is `w ∈ {1, 0.5, 0}` crossed with `lambda ∈ {0, 0.1, 0.25, 1}`. All 12 labels are reported; the three zero-adjustment labels are identical persistence forecasts. No extra candidates were tried. Full retention removes the static pooled-anchor error; partial retention challenges whether shrinking that error helps. The GDP slope for change is estimated within countries even in the zero-offset ablation, so this ablation is not an exact rerun of the original production model.

## Internal selection and its limits

Fold 1 trains through 2016 and forecasts 2017 and 2018, with 199 training rows and 99 origin countries. Fold 2 trains through 2017 and forecasts 2018, with 299 training rows and 100 origin countries. Predictions are generated before validation targets are read by the internal metric functions. Forecast GDP, never realized validation GDP, drives each ladder forecast.

There are 199 matched horizon-one observations and 99 matched horizon-two observations for each outcome and every candidate; no additional internal target was missing. Each horizon receives half of the selection loss, with equal weighting of its observed country/fold rows. GDP mode is selected first by cumulative-growth percentage-point mean absolute error (MAE), using the fold's origin GDP denominator. The ladder candidate is then selected by ladder MAE with that GDP mode fixed. Exact ties follow protocol enumeration order.

These are two forecast origins, not 298 independent tests. Countries recur and 2018 appears at two horizons. Reusing the same validation set for both selections makes the winning loss optimistic. The maximum validated horizon is two years; the final endpoint is seven years. No confidence interval or claim of statistical significance is made.

GDP equal-horizon selection MAEs were 4.664226 percentage points for persistence, 2.896580 for pooled growth, **2.390190 for half-local growth**, and 2.691271 for local growth. Every denominator, horizon metric, fold calibration, selected-match error and missing-target record is retained in `internal-validation.json`.

The ladder selection losses below are in ladder points, averaging the one- and two-year MAEs equally:

| Origin offset retained | Adjustment 0 | Adjustment 0.1 | Adjustment 0.25 | Adjustment 1 |
|---|---:|---:|---:|---:|
| All | 0.148934 | 0.148487 | 0.147860 | **0.145651** |
| Half | 0.148934 | 0.147146 | 0.154802 | 0.244308 |
| None | 0.148934 | 0.152346 | 0.189657 | 0.447154 |

The selected internal gain over persistence is only **0.003283 ladder points** under this selection criterion. The selected pooled internal MAE is 0.132185 versus 0.135299 for persistence; this is a different weighting from the equal-horizon selection loss. These quantities are training-period selection diagnostics, not 2025 or external pooled results.

Full offset retention with adjustment 1 wins the registered grid, but half retention with adjustment 0.1 also improves on internal persistence. Thus these observations do not establish that every degree of reversion is harmful. The within-country GDP slope rises from 0.552943 in the first fold to 0.680436 in the second and 0.918883 in the full fit, which cautions against treating it as stable over seven more years.

## Frozen fit, ranges and interpretation

The final training-only pooled coefficients are intercept 0.5569374801661462, log-GDP slope 0.5241191645216621, and governance slope 0.8224203899439249. The separately fitted within-country log-GDP slope is 0.918883296565691. The in-training lag correlation of pooled anchor residuals is 0.965173 across 298 adjacent pairs. This descriptive correlation uses coefficients estimated over the full training period, so it is not an out-of-sample test or proof of equilibrium persistence.

The frozen choice is half-local GDP growth, full origin offset retention, and annual adjustment 1. It simplifies to origin ladder plus the within-country slope times projected log-GDP change. In particular, the selected path does not converge toward the pooled country anchor; the anchor cancels algebraically. This is a distinct research model and does not alter the simulation's default calibration or dynamics.

There are exactly **700 predictions: 100 countries × seven years, 2019–2025**. All eight original `Prediction` fields are present in `predictions.json` under `{rows: [...]}`. GDP is positive and every numeric value is finite. Across the final 700 rows, raw and output ladder range is **3.253984763722423–7.879439239619823**; GDP range is **501.4573010601658–115232.53460360423** constant-2015 USD per person. There are zero lower ladder clamps, zero upper ladder clamps, and zero initial GDP-rate clips. These are forecast ranges, not observed outcome ranges. All internal candidate clamp counts and ranges are recorded separately.

Keeping origin offsets also retains transient origin shocks, and GDP damping is a fixed design choice rather than an estimated long-run law. The four-year panel cannot establish long-run well-being dynamics. GDP revisions and later-vintage historical estimates mean these inputs are not what a forecaster was necessarily able to retrieve in 2018.

## Verification and files

The focused Vitest suite has **11 passing synthetic tests** covering within-country slope recovery; immunity to stable intercept shifts; exact persistence; offset invariance; temporal stripping and future-data rejection; historical background dates; rate/ladder cap counts; missing-local-growth fallback; singular fits; complete candidate reporting; and tie-breaking. A focused TypeScript check passed. The generator validates input hashes, unchanged registered protocol, 100-country identity, 28 existing exclusions, 700 unique country/year rows, finite values and positive GDP. Deterministic regeneration is checked before freeze. Full repository tests and external scoring belong to the controller after freeze.

Reproduction from the repository root, using the configured Node 22 runtime:

```sh
/private/tmp/history-node22/package/bin/node node_modules/vitest/vitest.mjs run scripts/evaluation/attempts/research-offset-2018-v1/model.test.ts
/private/tmp/history-node22/package/bin/node node_modules/typescript/bin/tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck --types node scripts/evaluation/attempts/research-offset-2018-v1/model.ts scripts/evaluation/attempts/research-offset-2018-v1/run.ts scripts/evaluation/attempts/research-offset-2018-v1/model.test.ts
/private/tmp/history-node22/package/bin/node --import tsx scripts/evaluation/attempts/research-offset-2018-v1/run.ts
```

The generator reproduces training-only artifacts; it does not score external outcomes. `source-hashes.json` binds original train/origin bytes, registered protocol, model/generator/tests, existing lockfile and output bytes. `calibration.json` records coefficients, selected settings, growth rates, offsets and cap counts. The ledger entry is `docs/design/research/entries/research-offset-2018-v1.json`.

## External evaluation pending

The primary comparison is **2025 endpoint ladder MAE**, with model-minus-persistence MAE. The controller will also publish all horizons and pooled ladder errors, GDP cumulative-growth percentage-point errors, fixed origin-income quartiles, and identical outcome masks and exclusions. Historical aggregate pooled errors are not endpoint accuracy. All five registered methods are published regardless of their result; choosing the best afterward remains exploratory. No post-score candidate, coefficient, cohort, horizon or feature change is authorized for this frozen entry.

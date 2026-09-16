# Registered damped country trend attempt

External result: **pending the controller’s family freeze and single heldout scoring call**. No heldout data, previous country errors, or future country features were read by this entry. Predictions are frozen for all 100 origin countries and seven years (700 rows). This is retrospective automated-agent research; the known aggregate prior miss and later-vintage historical inputs prevent a blinded or archived-as-of-2018 claim.

## Method and primary question

For ladder and natural-log GDP separately, estimate each country’s ordinary least-squares slope using observed 2015–2018 calendar years. Anchor forecasts at the exact 2018 observation. Shrink the slope toward zero or the equal-country mean slope, then multiply it by the cumulative damping sum. Forecast GDP is never a ladder predictor, so neither equation asserts that GDP causes wellbeing.

The primary external comparison will be 2025 ladder mean absolute error (MAE), against persistence with identical observed-country masks. Pooled 2019–2025 MAE is a separate secondary statistic. GDP error is cumulative growth error in percentage points relative to origin GDP. The controller must also publish every horizon and origin-income quartile; sort 2018 GDP then id and take floor(index*4/100). All 28 frozen roster exclusions remain in the protocol.

The registered protocol is [protocol.json](../../../data/evaluation/research-damped-2018-v1/protocol.json), committed as 7d40306fdf677d756042e75ca2fa56afc839c5fe before any fit or validation execution. There were no protocol amendments. The finite search has 30 nominal triples per outcome (25 generic forecast forms including explicit duplicates), with a predeclared deterministic tie rule.

## Training-only internal selection

The first fold trains on 2015–2016 and predicts 2017 and 2018; the second trains on 2015–2017 and predicts 2018. Country slopes and pooled slopes are recomputed from each fold’s past. Selection minimizes pooled ladder MAE or GDP cumulative growth MAE, independently. Country reuse and repeated 2018 targets create dependence. These selected errors are optimistic internal estimates and cannot establish seven-year accuracy.

| Outcome | Selected rule | Valid internal records | Selected MAE | Persistence MAE | Difference |
| --- | --- | ---: | ---: | ---: | ---: |
| Ladder, points | pooled target, country weight 0.5, damping 0.8 | 298 | 0.12562730 | 0.13529866 | -0.00967135 |
| GDP growth, percentage points | pooled target, country weight 0.5, damping 0.98 | 298 | 2.11697738 | 4.15018800 | -2.03321063 |

Every candidate, skipped internal pair, per-fold and per-horizon score, and clamp is preserved in internal-validation.json. Full calibration retains the transformed observations, sample sizes, country slopes, pooled slopes, and selected settings for both outcomes. Numerical provenance records the calculation for every country/year/outcome.

## Range handling and coverage

Ladder forecasts are clamped to 0–10 after trend extrapolation. The selected final forecast produced 0 clamps, listed with raw values in numerical-provenance.json. GDP uses exponentiation without growth caps or bias correction; invalid output fails generation. Missing trend data use the predeclared target slope, without dropping any final origin country. All 399 paired training rows and 101 background countries are retained as available. Only 100 have frozen valid 2018 origin outcomes.

## Evidence and limits

[Hyndman and Athanasopoulos, methods with trend](https://otexts.com/fpp3/holt.html) describes gradually diminishing trend contributions. This entry uses that forecast shape and its cited practical damping range; country OLS slopes and cross-country shrinkage are our declared simplification, not an estimated Holt state-space model. [Their time-series cross-validation chapter](https://otexts.com/fpp3/tscv.html) motivates predicting later observations from earlier data and evaluating relevant horizons.

Only four annual observations are available per complete country. Global shrinkage is selected from two short origins, with no independent-country validation, no uncertainty intervals, and no direct evidence for the seven-year endpoint. The inherited panel may contain later revisions and annual-label interpretation issues; no source vintage was repaired. Long-lived structural changes are not forecast. Both outcomes flatten asymptotically; this can understate long-run economic growth. No result has yet established superiority to persistence. All five alternatives must be published regardless of sign; picking the best remains exploratory.

## Reproduction and checks

Run from the repository root, using the supplied Node 22 executable and no added packages:

```sh
/private/tmp/history-node22/package/bin/node --test scripts/evaluation/attempts/research-damped-2018-v1/model.node-test.mjs
/private/tmp/history-node22/package/bin/node scripts/evaluation/attempts/research-damped-2018-v1/run.mjs --verify
```

The first command uses synthetic and permitted training/origin fixtures only. The second reconstructs every entry artifact in memory and checks exact bytes against the frozen files. The fixed runner reads only the registered train/origin inputs, its own protocol/code/test files, and its own output files during verification. Full repository checks and heldout scoring belong to the controller after the family freeze gate.

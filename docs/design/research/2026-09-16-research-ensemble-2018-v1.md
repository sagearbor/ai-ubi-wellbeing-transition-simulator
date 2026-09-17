# Conservative ensemble: frozen, external scoring pending

Entry: `research-ensemble-2018-v1`; family: `five-approaches-20260916`. Automated research worker, independent implementation; no independent human/domain review is implied. Base: `0ca2eda3ea5db518499abebda1de1367d4e1ab7e`. Protocol registration commit: `2fee937281751947567ab856047c41ad3cbdba4a`, committed before fitting or internal validation. No amendments were made.

The registered selection chose **75% persistence plus 25% damped own-country trend** for both ladder and log-GDP. The smoother and pooled-drift components received zero weight. This is the outcome of the complete declared grid, not a post-validation change to the ensemble design. All **700 predictions are frozen for 100 original countries**, with **zero ladder clamps**. External 2019–2025 outcomes have not been read, hashed, or scored by this worker. The controller owns the final manifest, score receipt, family registry, full repository checks and publication.

## Hypothesis and method

Most country-level differences persist. A modest combination of persistence, a short past-level smoother, a country trend and shared drift might reduce noise or capture limited change without pulling countries toward a cross-sectional income line. [Forecast combinations](https://otexts.com/fpp3/combinations.html) motivates trying simple mixtures; it does not establish their accuracy on this panel.

The four components are implemented independently here, without reading other research workers' outputs. P is the latest origin value; S is two-thirds latest plus one-third the most recent earlier available value; T is P plus the country's ordinary least squares annual slope times D(h); M is P plus the equal-country median slope times D(h). D(h) is the sum of 0.8 raised to powers 1 through h, with damping fixed before fitting. This uses the bounded extrapolation idea from [damped trends](https://otexts.com/fpp3/holt.html), but is not a fitted Holt smoother. With the selected weights, the seven-year increment is just 0.7902848 times the fitted annual slope.

Slopes use real calendar years and available 2015–origin observations. With fewer than two past observations, the smoother equals persistence and the own slope is zero; a pooled slope may still exist. No values are interpolated. Ladder is modeled directly; GDP is modeled on the natural-log scale and exponentiated, so the GDP mixture is geometric on levels. GDP is forecast exclusively from its own past. Neither realized future GDP nor a future feature enters ladder or GDP predictions. Final ladder forecasts are clamped to 0–10 with counts; GDP has no cap and must be finite and positive.

## Temporal validation and every candidate

[Temporal cross-validation](https://otexts.com/fpp3/tscv.html) uses only data preceding each forecast. Origin 2016 trains on 2015–2016 and predicts 2017 and 2018; origin 2017 trains on 2015–2017 and predicts 2018. Every fit is recomputed from the fold's history. Supplying a later-year observation to the fitter throws an error. Internal fold eligibility uses valid origins among the frozen training background countries, without filtering on the final 2018 cohort.

Each outcome has a separate candidate choice. Selection minimizes the equal-weight mean of the three cell mean absolute errors (MAEs), then prefers greater persistence weight within 1% of the minimum; subsequent ties use score then registered index. GDP errors are percentage points of cumulative growth relative to the fold's GDP origin. This loss is **not the pooled country-row MAE**. The 298 validation observations per outcome reuse countries and some targets: they are not 298 independent samples. The paired source partition leaves 99, 99 and 100 scored countries in the three cells, with identical candidate and persistence masks.

Weights below are ordered P, S, T, M; twelve candidates were declared before validation. Lower internal MAE is better. The selected index is zero-based, as in the machine artifacts.

| Index | Weights | Ladder selection MAE | GDP selection MAE, pp |
|---|---|---:|---:|
| 0 | 1, 0, 0, 0 | 0.135375 | 4.154131 |
| 1 | 0.875, 0.125, 0, 0 | 0.137174 | 4.249632 |
| 2 | 0.75, 0.25, 0, 0 | 0.139039 | 4.346624 |
| 3 | 0.875, 0, 0.125, 0 | 0.131590 | 3.886066 |
| 4 (selected) | 0.75, 0, 0.25, 0 | 0.128583 | 3.622364 |
| 5 | 0.875, 0, 0, 0.125 | 0.135174 | 3.914551 |
| 6 | 0.75, 0, 0, 0.25 | 0.134972 | 3.685108 |
| 7 | 0.75, 0.125, 0.125, 0 | 0.132982 | 3.982012 |
| 8 | 0.75, 0.125, 0, 0.125 | 0.136965 | 4.013172 |
| 9 | 0.75, 0, 0.125, 0.125 | 0.131348 | 3.644537 |
| 10 | 0.625, 0.125, 0.125, 0.125 | 0.132748 | 3.741803 |
| 11 | 0.5, 0.25, 0.125, 0.125 | 0.134280 | 3.839896 |

| Forecast cell | Observed countries | Selected ladder MAE | Persistence ladder MAE | Selected GDP MAE, pp | Persistence GDP MAE, pp |
|---|---:|---:|---:|---:|---:|
| 2016 → 2017 | 99 | 0.099483 | 0.104051 | 2.884989 | 3.287299 |
| 2016 → 2018 | 99 | 0.180870 | 0.189566 | 5.499348 | 6.196059 |
| 2017 → 2018 | 100 | 0.105397 | 0.112510 | 2.482754 | 2.979036 |

Across the three equally weighted cells, selected ladder MAE is **0.128583**, versus **0.135375** for persistence. GDP is **3.622364** versus **4.154131** percentage points. Pooled internal MAEs are separately **0.128506 versus 0.135299** for ladder and **3.618539 versus 4.150188** for GDP. These are selection-data results, not the requested external result. Short smoothing alone lost internally; this outcome remains visible in the full grid.

## Frozen artifacts and external result

- `data/evaluation/research-ensemble-2018-v1/protocol.json`: original registered recipe and all rules.
- `calibration.json`: chosen weights, all country slopes/levels, pooled slopes and clamp counts.
- `internal-validation.json`: every candidate, fold fit, denominator, MAE, root mean squared error and bias.
- `predictions.json`: exactly 700 finite rows with original names and origin values.
- `source-provenance.json`: allowed input/code identities, parent source metadata and all 28 origin exclusions.
- `integrity.json`: SHA-256 bindings for protocol, sources, code, calibration, validation and predictions.
- `docs/design/research/entries/research-ensemble-2018-v1.json`: machine-readable pending-external ledger.

External result: **pending**. The controller will score once only after all five approaches and the separate long-run entry have immutable numeric freezes. Primary outcome is 2025 endpoint ladder MAE against the same-country persistence mask. It must also publish every 2019–2025 horizon, pooled metrics, GDP cumulative-growth errors, origin-income quartiles, coverage, exclusions and country contributions. Every entry is reported regardless of sign. The common scorer is reused; this worker did not modify or execute it.

## Limits and corrections

Only two forecast origins and horizons one and two fit inside four years. This cannot validate seven-year extrapolation or identify stable combination weights. Countries recur across folds, fitted trends can be noisy, and choosing the lowest validation score is optimistic. No uncertainty interval or significance claim is made.

The frozen sources contain 101 eligible background countries and 399 paired rows; the final origin contains 100 countries with 28 exclusions from a 128-country roster. The brief's 106/22 count is incorrect. The old published 0.3175 versus 0.2897 ladder MAEs are pooled country-year values, not 2025 endpoint metrics. Those old aggregate results and the structural hypothesis were known in advance. Source years are historical but values are revised 2026-vintage data, not an archive available in 2018. This is a prospectively frozen recipe on retrospective data, not blinded independent confirmation. Best-of-five selection is exploratory; a new period or cohort is needed for confirmation. Nothing here validates AI, transfers, universal basic income mechanisms, or causal wellbeing claims.

## Verification

Eight synthetic Vitest tests passed. They cover future-row rejection, duplicate/invalid rows, exact persistence and persistent country differences, calendar gaps, geometric GDP combination, missing-history fallbacks, missing origin rejection, median drift, damping/clamping, conservative tie rules and invariance of earlier-fold fits to later-target perturbations. The new three TypeScript files also passed a targeted compiler check. Reproduction regenerated all numeric artifacts in memory and matched their exact committed-candidate bytes. A separate original common-evaluator coverage check confirms all 700 rows preserve the original origin.

Run these read-only checks from this worktree using the existing Node 22 runtime:

```sh
/private/tmp/history-node22/package/bin/node node_modules/vitest/vitest.mjs run scripts/evaluation/attempts/research-ensemble-2018-v1/model.test.ts
/private/tmp/history-node22/package/bin/node --import tsx scripts/evaluation/attempts/research-ensemble-2018-v1/run.ts --verify
/private/tmp/history-node22/package/bin/node node_modules/typescript/bin/tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck --types node --resolveJsonModule --esModuleInterop scripts/evaluation/attempts/research-ensemble-2018-v1/model.ts scripts/evaluation/attempts/research-ensemble-2018-v1/model.test.ts scripts/evaluation/attempts/research-ensemble-2018-v1/run.ts
```

The generation command refuses to overwrite an existing freeze. Verification runs only the registered training-time calculation; it never reads external outcomes. No full repository check, external score, application change, dependency installation, push, pull request or merge was performed by this worker.

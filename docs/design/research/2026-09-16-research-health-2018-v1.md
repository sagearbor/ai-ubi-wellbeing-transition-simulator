# Health and income changes — frozen, external scoring pending

This entry adds 2015–2018 life expectancy to a small ladder-change model. It is the user's requested additional-data extension beyond PR23's exact-input rule: it preserves the original outcomes, all 100 forecast countries and all 28 original exclusions, but does not use the same predictor inputs. Differences from other methods cannot be attributed to the health feature alone because the model form also differs. No matched health-only ablation was registered.

The registered ridge model predicts annual ladder differences from annual log-GDP and life-expectancy differences, with no intercept. Each fold computes its own predictor root-mean-square scales from training pairs only. The complete regularization grid was 0.1, 1 and 10. Future log-GDP and life expectancy follow country slopes estimated from pre-origin observations with fixed annual damping 0.8. Forecast ladder changes use those forecast covariate changes. Actual later income and health never enter a forecast. Missing health would produce zero health change, preserving the country. A synthetic test covers that fallback even though this source vintage is complete for the fitting and forecast cohorts.

Registration preceded health retrieval and fitting. Internal validation used a 2016 origin to predict 2017–2018 and a 2017 origin to predict 2018. The 2016 fold had 99 origin countries and the 2017 fold had 100, because the original target availability differs by year. All 298 observed fold rows were scored against persistence on identical masks. This is temporal validation for countries reused across years, not independent-country validation; repeated 2018 observations under two origins are not independent evidence.

| Registered lambda | Internal ladder MAE | Persistence MAE | Observed fold rows |
|---:|---:|---:|---:|
| 0.1, selected | 0.132605 | 0.135299 | 298 |
| 1 | 0.133550 | 0.135299 | 298 |
| 10 | 0.134912 | 0.135299 | 298 |

The small internal improvement is exploratory and cannot establish seven-year skill. The final fit uses 101 background countries, 399 paired ladder/GDP levels and 298 consecutive-year differences. Its coefficients in original units are about 0.836932 per log-GDP unit and -0.013700 per life-expectancy year. The negative health coefficient is an unstable short-panel association, not evidence that longer life reduces wellbeing. No sign constraint, coefficient repair or unregistered candidate was added. Model residuals and source interpolation make causal interpretation especially inappropriate.

There are exactly 700 frozen predictions, with no missing-health country fallback and no ladder or health-bound corrections in this source vintage. Predictions follow the original `Prediction` shape. `forecast-covariates.json` separately records forecast health/income changes and raw ladder values, so future-feature substitution and bounds can be audited. The endpoint primary metric remains 2025 ladder MAE. Pooled and every-horizon 2019–2025 errors, origin-income quartiles and GDP cumulative-growth errors will be reported by the controller after every entry is frozen. External results are still pending; no held-out scoring was run here.

## What the health measure means

The [World Bank life-expectancy indicator](https://databank.worldbank.org/metadataglossary/world-development-indicators/series/SP.DYN.LE00.IN) estimates years lived if the current period's mortality rates persisted. It is a mortality-based population measure; it is not a person's realized lifespan and does not account for nonfatal ill health. The [WHO healthy-life-expectancy definition](https://www.who.int/data/gho/data/indicators/indicator-details/GHO/gho-ghe-hale-healthy-life-expectancy) adjusts years for illness and disability. These measures are related but not interchangeable, and neither is a subjective ladder response.

The [WHR 2025 statistical appendix, health-variable definitions](https://files.worldhappiness.report/WHR25_Ch02_Appendix_B.pdf) describes a healthy-life-expectancy predictor and retrospective interpolation/extrapolation. It also describes using unadjusted life expectancy to fill some health-adjusted series. That explanatory construction does not establish an origin-available forecasting advantage. This entry uses only the explicitly identified unadjusted World Bank life-expectancy measure; it does not reconstruct or claim to reproduce WHR's healthy-life-expectancy variable.

The [World Bank API date-range documentation](https://datahelpdesk.worldbank.org/knowledgebase/articles/898581-api-basic-call-structures) supports bounded observation requests. The exact health URL is:

`https://api.worldbank.org/v2/country/all/indicator/SP.DYN.LE00.IN?date=2015:2018&source=2&format=json&per_page=20000`

The response was retrieved at 2026-09-16T21:05:46.711Z and reports source last updated 2026-07-13. All 1,060 response rows fall within 2015–2018; this includes API countries and aggregates, while model fitting selects only the original training IDs. Exact bytes, source metadata, timestamps, row counts and SHA256 hashes are saved. Observation dates are not publication dates: revised and sometimes interpolated/modelled health series retrieved in 2026 are not an archived 2018 information set. The World Bank explicitly cautions that some annual UN series interpolate five-year observations and may smooth real events.

Temporal-fold logic follows the rationale in [Forecasting: Principles and Practice](https://otexts.com/fpp3/tscv.html). Damping uses its [damped-trend form](https://otexts.com/fpp3/holt.html), with fixed 0.8 and historical OLS slopes rather than fitted Holt smoothing. Four annual observations provide limited leverage to distinguish a stable health relationship from common trends or measurement effects.

## Registration, exposure and verification

- Long-run objective protocol: `41fe91c`, 2026-09-16 16:57:53 ET. Its 1960–1980 numeric artifacts froze at `af07c67`, 17:02:28 ET, before new health retrieval and the later WHR excerpt exposure.
- Original health protocol and full candidate grid: `6c6cdb2`, 17:04:29 ET, before new health retrieval, validation or fitting.
- Around 17:05 ET, a `web.find` request for a health-variable definition unexpectedly returned broader WHR PDF excerpts, including contemporary regression coefficients, several ladder-ranking values, and 2021 healthy-life-expectancy country values. Those sections were not sought as data, but the agent saw them. An earlier WHO definition search also returned aggregate global 2000–2021 longevity trends. This is postperiod-literature exposure; this entry must not be described as blind or as having clean unexposed holdout status.
- Exposure-only amendment `1b8512e`, 17:05:34 ET, records that limitation. The original equations, grid, tie rule, cohort, fixed damping and metrics did not change. Candidate selection was then mechanical using only authorized 2015–2018 numeric inputs.
- No further web research followed that disclosure. No 2019–2025 World Bank health series or original held-out outcome file was read or scored. No long-run numeric artifact was rerun after primary-health exposure; its predictions, calibration, internal validation and cohort remain byte-identical to `af07c67`.
- Nine health synthetic checks pass through one Vitest wrapper: ridge normal equations, fold-tail perturbation invariance, missing-pair retention, missing-origin fallback, damped forecasts, zero-change persistence, time-window rejection, tie rule and explicit bounds. A second wrapper runs six objective-entry checks. Targeted Vitest: 2 files, 2 wrappers, 15 underlying checks passed.
- The long-run test filenames were adapted for repository Vitest discovery after numeric freeze. Only test integration and its source hashes changed; no long-run coefficient or prediction changed.

Commands from the repository root:

```sh
node node_modules/vitest/vitest.mjs run scripts/evaluation/attempts/research-health-2018-v1/model.test.ts scripts/evaluation/attempts/research-objective-1980-v1/model.test.ts
node scripts/evaluation/attempts/research-health-2018-v1/run.mjs
```

The fetcher refuses to overwrite pinned raw responses. The runner consumes only the two original authorized training/origin files and this entry's date-limited health response. Full repository checks, the shared freeze gate, external scoring and PR publication belong to the controller. All results should be published regardless of sign; no post-score model revision is authorized under this protocol. Authorship and checks are automated and are not independent domain-expert review.

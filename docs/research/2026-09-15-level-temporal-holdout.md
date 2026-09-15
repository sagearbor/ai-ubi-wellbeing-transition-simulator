# Existing level model: frozen 2018-origin temporal holdout

The first registered run performs worse than persistence on wellbeing: MAE 0.317533 versus 0.289744 Cantril ladder points, a model-minus-persistence difference of +0.027789. The result is published without tuning. It is evidence about retrospective out-of-fit baseline performance, not causal policy evidence or validation of the current conditional-world default.

Protocol `level-ai-off-2018-origin-v1` was committed at `0b06312` before this fit or its scores. Training years are 2015–2018, the nominal end-of-observation-year origin is 2018, and forecast horizons are 2019–2025. Model form, growth, adjustment rate, split and feature mapping were selected after the evaluation years were already known. Historical values were downloaded in 2026 and may have been revised. Annual observation labels do not establish that data were publicly available at the origin. This is neither a blind experiment nor an archived-as-of-2018 forecast.

## Sources and exclusions

The repository roster supplies only immutable ISO3 country IDs and names. All numeric backgrounds are separate official World Bank responses: population (`SP.POP.TOTL`) in 2015; Government Effectiveness, Rule of Law and Control of Corruption governance **estimates** in 2015; and latest observed Gini (`SI.POV.GINI`) within 2010–2015. Gini is divided by 100, population by one million. Governance is exactly `clamp(0.5 + 0.2 * mean(GE.EST, RL.EST, CC.EST), 0, 1)`, without the application's 2024-derived rescaling.

World Bank source 3 now serves the registered WGI estimate concepts under `GOV_WGI_GE.EST`, `GOV_WGI_RL.EST`, and `GOV_WGI_CC.EST`. The pinned official indicator catalogue describes them as estimates approximately −2.5 to +2.5. Separate `.SC` scores on a 0–100 scale are not used. The WGI API reports release update 2026-03-18; revised methodology and historical re-estimation remain limitations. Raw API responses, exact URLs, retrieval timestamps, release dates and SHA-256 hashes are in `data/evaluation/level-holdout-2018/sources/`. Blank ISO3 source rows are never heuristically matched.

There are 128 roster countries, 101 with all required historical backgrounds, and 100 with both 2018 origin outcomes. All 27 background exclusions and the additional missing-origin country remain listed. No future-availability condition selects the cohort. Training contains 399 paired country-years and 113 explicitly excluded roster/year rows. Missing Gini, population or any governance component excludes the country; no fallback or cross-country imputation is used.

The existing pinned WHR/Gallup ladder panel (via OWID) and World Bank constant-2015-US-dollar GDP-per-person panel supply outcomes. They remain unchanged. Preparation physically writes `train.json`, `origin.json`, and `test-outcomes.json` before the fitting process starts. The fitting process imports no engine/default calibration and reads only the registered protocol and training payload. The prediction process reads only the protocol, origin and frozen fit. Scoring separately reads predictions and held-out outcomes.

## Model and calibration

This uses `stepSimulationPure` for all 84 monthly steps in the existing anchored level model. Only the three original OLS anchor coefficients are fitted: intercept 5.569374801665757, log GDP 5.2411916452159915, governance 8.224203899441955. The training R² is 0.6702101524923816 and RMSE is 5.618484241833294 on the 0–100 index. Classical independent-row standard errors are not presented as forecast uncertainty.

Annual baseline GDP growth is 2%; monthly wellbeing adjustment is 0.02. AI adoption and AI growth are zero. There are no corporations, hence no corporate contribution or transfer channel; this avoids importing contemporary corporate numeric snapshots. The same immutable coefficient object is passed explicitly on every monthly engine call. Calibration, protocol, origin, predictions, source files, parameters and test artifacts have separate recorded identities.

Archetypes use the existing GDP/governance rule, exported without changing arithmetic. Inactive structural fields are explicit neutral assumptions: cognitive share 0.5, natural unemployment 0.05, zero policy taxes/incentives, no displacement stock. Tests vary these fields, transfer/unemployment effect coefficients, productivity/automation coefficients, archetype, Gini, population and dataset selection while obtaining identical GDP/ladder predictions. Contemporary dataset world population is only a divisor of the zero transfer pool. No current numerical country feature enters the fit or trajectory.

## Untuned scores

Each outcome is scored separately on its observed country-years. Model and persistence have exactly the same mask. GDP error is cumulative growth percentage points relative to each country's observed 2018 GDP.

| Outcome | Observed / expected | Model MAE | Persistence MAE | Model RMSE | Persistence RMSE | Model signed bias |
|---|---:|---:|---:|---:|---:|---:|
| Ladder points | 681 / 700 | 0.317533 | 0.289744 | 0.458776 | 0.413166 | −0.080807 |
| GDP growth percentage points | 691 / 700 | 7.511378 | 8.649982 | 10.365204 | 12.209339 | +2.949620 |

Wellbeing observation counts by year 2019–2025 are 99, 98, 97, 96, 97, 97, 97. GDP counts are 99, 99, 99, 99, 99, 99, 97. Missing outcomes remain explicit rows with null errors and a reason. Removing 2025 observations never removes earlier scores. Per-country and per-horizon MAE, RMSE, bias, missingness and denominators are in `scores.json` and the UI artifact `experience.json`. Empty metrics are null with a reason. There is no accuracy pass threshold, uncertainty interval or claim of independent country-year errors.

## Reproduction and verification

From the repository root after installing its existing locked dependencies:

```sh
node --import tsx scripts/evaluation/run.ts all
npx vitest run scripts/evaluation/holdout.test.ts simulation/pure.test.ts simulation/appEngineParity.test.ts
npm run typecheck
node --import tsx scripts/hindcast/export-experience.ts --check
```

The CLI runs `prepare`, `fit`, `predict`, `score`, `package` as distinct processes; each stage can be invoked separately. It uses pinned data, not fresh downloads. The protocol hash is checked against the preregistered value. The combined artifact records hashes of the exact materialized inputs and outputs; integrity tests reproduce values and detect source drift. Tests also prove future-outcome perturbations cannot change training, cohort, fit or predictions, reject future-dated backgrounds/training observations, and confirm every-step frozen calibration.

Before changing `simulation/pure.ts`, six representative dataset/model combinations were captured over twelve months using full-output SHA-256 hashes. Both omitted override and explicit current coefficients reproduce every pre-edit hash. Existing historical `experience.json.report` remains exactly unchanged; only source hashes were refreshed. The historic export's authoritative reconstruction check passes.

The source change invalidates the prior qualification manifest even though default arithmetic is unchanged. Fresh source-bound qualification is a separate required task; the old certificate is not reused. This evaluation does not test disabled AI, transfer, training, migration or other policy effects and cannot support evidence labels for them.

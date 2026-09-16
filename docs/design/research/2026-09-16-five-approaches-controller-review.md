# Five-approach forecasting experiment: controller review

Registered family: `five-approaches-20260916`. Base: `0ca2eda3ea5db518499abebda1de1367d4e1ab7e`. This is research only: production defaults, old evaluation artifacts and published targets are unchanged. All five short methods and the separate long-horizon objective entry must freeze before any new external scoring. Five automated agents used five branches/worktrees, in two waves because only three worker slots were available.

## Corrections to the supplied brief

PR #23 (`5fa9aa68c811aa7f7281c0dfdcf0ff67b7c15875`) was checked against the files. The frozen origin cohort contains **100 countries and 28 exclusions**, not 106 and 22. The old 0.3175 versus 0.2897 ladder-point error is **pooled country-year MAE**, not the 2025 endpoint. Our family registers the 2025 endpoint as primary and requires pooled and every-horizon results alongside it; an endpoint win cannot be presented as a pooled win.

The 0.02 monthly adjustment closes 81.677% of a fixed initial gap in 84 months (`1-.98^84`). That arithmetic alone does not prove the diagnosis: the anchor also moves with income, observed country residuals may evolve, and persistence is noisy. The methods test different limited hypotheses rather than accepting that all mean reversion must fail.

The health approach is an explicitly authorized **additional-data extension**: it uses pre-2019 life expectancy, unlike PR23's strict identical-input entries. It is comparable on outcomes and cohort but cannot claim identical input availability. No observation after the applicable origin is a predictor. The long entry predicts life expectancy and income separately, never translating either into ladder points.

## What was checked before outcomes

The controller read each protocol and implementation, checked temporal folds, scaling/imputation boundaries, forecast GDP instead of future observed GDP, units, caps, cohort coverage and origin identities. Synthetic tests probe failure cases. Independent Python arithmetic reconstructs selected model forecasts from allowed inputs without importing submitted model implementations; each audit states its scope. Reproducing arithmetic checks software, not forecasting validity. Hyperparameter selection remains exploratory within a four-year development window and two overlapping origins.

Full repository checks are run only after all numerical forecasts freeze. Original holdout files are checked byte-for-byte against the base. The common evaluator reuses the original short scoring code and adds endpoint, pooled, horizon, origin-income groups and country contribution summaries. A committed source-binding manifest and six-entry registry precede scoring. An exclusive receipt is created before opening outcomes; repeat invocations are refused. Software controls demonstrate the recorded workflow; they cannot prevent a person with repository access from reading outcomes elsewhere or rewriting git history.

## Scientific interpretation limits

- These are current-vintage retrospective data, not archived information actually available in 2018 or 1980. Revisions, publication lags and changed country definitions remain.
- The old failure and general post-period knowledge were known before registration. A controller definition search inadvertently returned later-period WHR tables; no numerical values were supplied as parameters or used to change the assigned approaches. The health worker separately records unsolicited post-period literature exposure after its recipe registration. Neither exercise is described as blinded.
- Five attempts form one declared exploratory family. All results, including losses, will be published. Choosing the best after scoring consumes the test for that choice. No fresh independent confirmation, significance claim, confidence interval or production qualification follows from winning this comparison.
- The health coefficient is an observational forecasting coefficient. Its selected sign is slightly negative. It must not become an assertion that lowering life expectancy would improve wellbeing. Forecast equations here are not identified policy-effect equations.
- A persistence win is only one benchmark. The long objective trend especially faces a weak long-run baseline for quantities that commonly trend; undamped trends and additional published comparators belong in a future registered experiment, not a post-score replacement in this one.
- A missing 2025 objective target is unscored. A 2024 or pooled result cannot replace its registered endpoint. Coverage is reported per target/year on exactly the same model and baseline mask.
- The fixed roster excludes countries due to the original background requirements, including Gini even for methods that do not need it. Retaining it preserves comparability but does not establish global representativeness. A broader-cohort experiment must be separately registered.
- These runs cannot validate disabled AI, UBI or bill-specific causal mechanisms. No application default is being promoted here.

## Primary methodological sources

[Rolling-origin validation](https://otexts.com/fpp3/tscv.html) supports keeping all fitting before each forecast origin. [Damped trends](https://otexts.com/fpp3/holt.html) motivate explicit limits on extrapolating noisy recent trends; the submitted simple trend formulas are not advertised as full fitted Holt state-space models. [Forecast combinations](https://otexts.com/fpp3/combinations.html) motivate the conservative ensemble. [World Happiness Report FAQ](https://www.worldhappiness.report/faq/) distinguishes associations from causal effects; life expectancy at birth is also distinct from its healthy-life-expectancy variable. [World Bank life expectancy](https://data.worldbank.org/indicator/SP.DYN.LE00.IN) and [API query documentation](https://datahelpdesk.worldbank.org/knowledgebase/articles/898581-api-basic-call-structures) support explicit indicator units, date restrictions and missingness checks. Method-specific sources and exposure records live in each committed protocol.

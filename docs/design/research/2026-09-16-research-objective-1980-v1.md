# 1980 objective-proxy reconstruction — frozen, external scoring pending

This is a separate objective reconstruction of period life expectancy and real GDP per person. It does not predict or reconstruct a Cantril ladder score. The complete method was registered in `41fe91c` before numeric source retrieval, fitting, validation or new short-horizon health-data exposure.

The method fits each country's 1960–1980 linear time slope separately: years for life expectancy and natural-log constant-2015 USD for GDP. It adds the fixed damped trend (annual damping 0.95) to the observed 1980 origin. Damping is a declared assumption; it was not selected against later outcomes. Life expectancy is explicitly bounded to 0–120 years; the 12,600 frozen rows required no bounds correction. There are 140 countries and two targets over 45 horizons. The current World Bank metadata lists 217 nonaggregate countries/economies; 77 lack the registered origin/history requirements. The cohort file also records all 78 metadata aggregate exclusions. No later availability was consulted.

This uses the damped-trend form described in [Forecasting: Principles and Practice](https://otexts.com/fpp3/holt.html), but uses a historical OLS slope rather than estimating a Holt smoothing model. The [World Bank API](https://datahelpdesk.worldbank.org/knowledgebase/articles/898581-api-basic-call-structures) supports explicit date ranges; every numeric observation response here requests only 1960:1980 and is checked before fitting. Exact response bytes, SHA256 digests, retrieval timestamps and source last-updated fields are saved under the entry's data directory.

Life expectancy measures survival under a period's mortality rates. It does not measure years lived in full health or subjective wellbeing. The [World Bank indicator metadata](https://databank.worldbank.org/metadataglossary/world-development-indicators/series/SP.DYN.LE00.IN) warns that some annual UN series are interpolated from five-year periods. These are revised estimates retrieved in 2026, not a preserved 1980 information set; publication delays, changing country borders and current-country survivorship remain limitations. A 45-year forecast also cannot anticipate wars, institutional changes, epidemics or policy shifts from this simple trend alone.

A fixed 1975-origin diagnostic used only 1960–1975 for fitting and 1976–1980 for validation, with 1,270 observed country-target-years. It was not a selection step. Full diagnostic values and skipped earlier origins are recorded in `internal-validation.json`. The endpoint primary metrics will be 2025 life-expectancy MAE in years and 2025 GDP cumulative-growth error in percentage points relative to origin GDP, reported separately. Every annual horizon and pooled errors will accompany them. Each comparison uses matching persistence masks; missing 2025 outcomes must remain missing rather than silently moving the endpoint.

## Exposure and implementation log

- Before registration, the agent saw the allowed short-horizon train/origin schema and a few leading 2015–2018 ladder/GDP rows. None chose the fixed long model or its parameters.
- After registration, a WHO definition search unexpectedly returned a snippet describing global aggregate 2000–2021 longevity/healthy-life-expectancy trends. No country trajectory was fetched, passed to the model or used to revise the method. This is retrospective research, not a blinded exercise.
- Long-run forecasts were frozen before fetching the separate 2015–2018 health extension. The scripts are isolated and have no import of the short-horizon entry.
- Initial sandbox DNS prevented the read-only API fetch; network-approved retry succeeded. The first model execution rejected repeated empty ISO codes on World Bank aggregate rows before fitting. Ignoring empty identifiers fixed parsing, consistent with the registered nonaggregate-ID cohort; no model or parameter changed.
- Six synthetic Node tests pass: slope arithmetic, GDP transformation, input/fit time rejection, validation-tail perturbation invariance, history/origin eligibility and explicit life-expectancy bounds.

Run locally from the repository root:

```sh
node --test scripts/evaluation/attempts/research-objective-1980-v1/model.checks.mjs
node scripts/evaluation/attempts/research-objective-1980-v1/run.mjs
```

The fetcher refuses to overwrite raw files. Rerunning the model uses the pinned responses and requires no network. External scoring is pending the controller's all-entry freeze gate. Publish the result regardless of sign; no refitting follows that score. Authorship and review so far are automated, not independent human or domain-expert validation.

## Controller-only future outcome contract

After all entries freeze, request these exact targets using the official World Bank API and save response/provenance hashes:

- `https://api.worldbank.org/v2/country/all/indicator/SP.DYN.LE00.IN?date=1981:2025&source=2&format=json&per_page=20000`
- `https://api.worldbank.org/v2/country/all/indicator/NY.GDP.PCAP.KD?date=1981:2025&source=2&format=json&per_page=20000`

Both responses have `[metadata, rows]`, with `countryiso3code`, `date`, `indicator.id` and nullable `value`. Compare only IDs frozen in `cohort.json`. Predictions use `objective-predictions/1` with `rows` containing `id,name,target,unit,year,horizon,originYear,originValue,prediction,rawPrediction`. GDP metric error is `100*(prediction-actual)/originValue`; life-expectancy error is `prediction-actual`. Persistence error replaces prediction with originValue. API pagination/completeness, validity and missingness must be checked independently by the scorer. Neither future URL has been requested by this agent.

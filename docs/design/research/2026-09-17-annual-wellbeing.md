# Annual wellbeing study — 17 September 2026

This is a limited demonstration in eight countries chosen before data collection: USA, India, Germany, United Kingdom, Brazil, Japan, South Africa, and China. Pooled results describe this preselected cohort, not the global panel. It is a latest-vintage retrospective annual comparison, not a real-time forecasting claim or an untouched holdout. The outcome period has appeared in earlier project work. Annual target values were transcribed from rendered World Happiness Report / Gallup chart marks using visible linear-axis ticks, rounded to three decimals, and spot-checked against visible annual tooltips for all eight countries. These are public-chart transcriptions, not the original downloadable Gallup annual microdata or full machine-readable panel. Three-year averages are not used.

Four parsimonious candidates were frozen before one scoring run. All six methods, including persistence and a damped annual trend, use identical rows within each mode. Coefficients are trained through 2016 for conditional replay and expand through t−1 for each rolling forecast. The conditional replay is a sequence of one-year reconstructions with observed previous-year outcomes and realized target-year drivers; it is not a free-running 2016-origin path.

Drivers are World Bank log constant-dollar GDP per capita, total life expectancy, and modeled unemployment. Total life expectancy is not WHR healthy life expectancy. No same-survey support/freedom/corruption variables or fitted Figure 2.1 factor contributions are used. Even date-restricted features are revised retrospective vintages, with original release availability unknown.

Frozen commit: `9a49e76562acc0b1229e32a7f88f18c7ce62f79b`. Initial training: 2005–2016. Eligible initial cohort: 8 countries. All country paths and row-level cutoffs are in `data/evaluation/annual-wellbeing-20260917/paths.json`.

## All candidate losses

MAE is in native 0–10 ladder points. Positive reduction means improvement over persistence; negative reduction means worse. Change MAE is algebraically the same as level MAE when both use the same observed t−1 anchor at horizon one. It is therefore not independent evidence of dynamic skill. Direction and change-correlation results are also reported.

| Mode | Method | Rows | Level/change MAE | Reduction vs persistence | Direction accuracy | Change correlation |
|---|---|---:|---:|---:|---:|---:|
| conditional | change_ridge | 61 | 0.2467 | -7.51% | 52.5% | 0.120 |
| conditional | country_offset | 61 | 0.3831 | -66.96% | 50.8% | 0.266 |
| conditional | residual_carry | 61 | 0.2553 | -11.27% | 52.5% | 0.231 |
| conditional | shrinkage_change | 61 | 0.2345 | -2.20% | 52.5% | 0.120 |
| conditional | persistence | 61 | 0.2294 | 0.00% | 0.0% | undefined (constant) |
| conditional | damped_trend | 61 | 0.2685 | -17.01% | 45.9% | -0.231 |
| rolling | change_ridge | 69 | 0.2276 | -0.91% | 58.0% | 0.304 |
| rolling | country_offset | 69 | 0.3074 | -36.31% | 49.3% | 0.240 |
| rolling | residual_carry | 69 | 0.2318 | -2.78% | 49.3% | 0.240 |
| rolling | shrinkage_change | 69 | 0.2228 | 1.21% | 58.0% | 0.304 |
| rolling | persistence | 69 | 0.2255 | 0.00% | 0.0% | undefined (constant) |
| rolling | damped_trend | 69 | 0.2723 | -20.73% | 47.8% | -0.306 |

Direction uses three classes (up/down/flat), with only a 1e−9 numerical equality tolerance. Every scored country-year is in that denominator. Persistence always predicts flat and thus abstains on nonzero moves; its zero directional accuracy on changing outcomes is not evidence of useful candidate forecasts. `metrics.json` separately reports observed ties, direction-call coverage, accuracy when called, matched-origin direction wins/losses/ties, and absolute-error wins/losses/ties. Nominal paired sign-test probabilities ignore serial and country dependence and are descriptive only.

## Predetermined examples

Countries below were named before scoring. Every eligible country is available in the paths artifact. Missing examples are stated rather than silently replaced.

| Country | Rolling rows | Persistence MAE | Change ridge MAE | Country offset MAE | Residual carry MAE | Shrinkage MAE | Damped trend MAE |
|---|---:|---:|---:|---:|---:|---:|---:|
| USA | 9 | 0.1552 | 0.1615 | 0.2473 | 0.1579 | 0.1584 | 0.1894 |
| IND | 9 | 0.4443 | 0.3938 | 0.5588 | 0.4349 | 0.4066 | 0.5526 |
| DEU | 9 | 0.1874 | 0.2067 | 0.2017 | 0.1822 | 0.1971 | 0.2186 |
| GBR | 9 | 0.1611 | 0.1809 | 0.1901 | 0.1518 | 0.1633 | 0.1628 |
| BRA | 9 | 0.1728 | 0.1974 | 0.2382 | 0.1754 | 0.1851 | 0.1762 |
| JPN | 9 | 0.1702 | 0.1402 | 0.1598 | 0.1404 | 0.1521 | 0.2295 |
| ZAF | 9 | 0.2379 | 0.2601 | 0.4172 | 0.2687 | 0.2470 | 0.2923 |
| CHN | 6 | 0.2998 | 0.3061 | 0.5154 | 0.3984 | 0.2976 | 0.3989 |

## Coverage and limitations

Conditional rows: 61 across 8 countries. Rolling rows: 69 across 8 countries. All methods within a mode share the exact mask and origin; modes can differ because conditional reconstruction requires actual target-year drivers.

No missing target or driver is filled. A valid previous year and the year before that are required; gaps remove those dependent predictions. Country inclusion requires five complete 2005–2016 observations. This is a preselected eight-country demonstration with further missingness restrictions, not a population-representative country sample. Broader annual target access and the annual WHR social-predictor panel were unavailable through the public downloads; the source-access constraint, rather than a forecast result, determined this narrowed scope. No population weights are used. Macroeconomic features and country offsets cannot establish causal wellbeing effects, and annual country-mean survey noise is not separately modeled.

Exactly one descriptive scoring run was allowed. All registered candidates are published; no candidate was retuned after outcome comparison. No prior evaluation namespace was changed.

## Reproduction and checks

`python -m unittest discover -s scripts/evaluation/annual-wellbeing -p "test_*.py" -v`

`python scripts/evaluation/annual-wellbeing/run.py` requires committed protocol, code, and input and refuses to overwrite an existing scoring receipt. Preserve the original receipt: a further model comparison needs a new registered study.

Six synthetic tests establish own-target and future-target invariance, target-year driver exclusion from rolling forecasts, historical-only offsets, frozen cohort selection, exact prediction/missingness counts, and the same-origin change-error identity.

## Sources

WHR / Gallup attribution applies to the target chart transcriptions. Their redistribution license has not been independently verified and is not asserted to be the repository code license or World Bank CC BY. World Bank drivers have their own CC BY attribution in source provenance.

- [United States annual score](https://data.worldhappiness.report/country/USA) — Official public World Happiness Report dashboard / Gallup Analytics; visible annual tooltips
- [India annual score](https://data.worldhappiness.report/country/IND) — Official public World Happiness Report dashboard / Gallup Analytics; rendered annual point coordinates with displayed axis ticks and tooltip spot-checks
- [Germany annual score](https://data.worldhappiness.report/country/DEU) — Official public annual-score chart coordinates; tooltip spot-check
- [United Kingdom annual score](https://data.worldhappiness.report/country/GBR) — Official public annual-score chart coordinates; tooltip spot-check
- [Brazil annual score](https://data.worldhappiness.report/country/BRA) — Official public annual-score chart coordinates; tooltip spot-check
- [Japan annual score](https://data.worldhappiness.report/country/JPN) — Official public annual-score chart coordinates; tooltip spot-check
- [South Africa annual score](https://data.worldhappiness.report/country/ZAF) — Official public annual-score chart coordinates; tooltip spot-check
- [China annual score](https://data.worldhappiness.report/country/CHN) — Official public annual-score chart coordinates; tooltip spot-check
- [NY.GDP.PCAP.KD](https://api.worldbank.org/v2/country/all/indicator/NY.GDP.PCAP.KD?date=1960:2025&source=2&format=json&per_page=20000) — Fresh public World Bank annual series; latest-vintage retrospective values
- [SP.DYN.LE00.IN](https://api.worldbank.org/v2/country/all/indicator/SP.DYN.LE00.IN?date=1960:2025&source=2&format=json&per_page=20000) — Fresh public World Bank annual series; latest-vintage retrospective values
- [SL.UEM.TOTL.ZS](https://api.worldbank.org/v2/country/all/indicator/SL.UEM.TOTL.ZS?date=1960:2025&source=2&format=json&per_page=20000) — Fresh public World Bank annual series; latest-vintage retrospective values

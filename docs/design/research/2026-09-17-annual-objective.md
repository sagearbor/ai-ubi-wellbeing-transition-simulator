# Annual objective forecasting benchmark

This is a separate annual benchmark for real GDP per person, unemployment and period life expectancy. It does not estimate a wellbeing ladder. The finite protocol in `data/evaluation/annual-objective-20260917/protocol.json` is committed before numeric data retrieval and scoring; it fixes four methods, all nonaggregate World Bank economies, 20-year trailing histories and one- and five-year rolling forecast horizons. All results, including losses to persistence, will be published without retuning.

This is a latest-vintage retrospective study, not a claim about what a forecaster truly knew at each historical date. Existing repository files already include later GDP/life data. The agent read file names, the prior fetcher and methodological note before registration. Complete newly retrieved responses are loaded during cleaning, including future observations relative to early origins; no claim that those outcomes were withheld is made. Numeric fitting must use only the 20-year prefix ending at each origin, verified with future-tail perturbation tests.

The [World Bank API](https://datahelpdesk.worldbank.org/knowledgebase/articles/898581-api-basic-call-structures) supplies annual observations. [GDP metadata](https://databank.worldbank.org/metadataglossary/world-development-indicators/series/NY.GDP.PCAP.KD) specifies constant 2015 US dollars. [Unemployment metadata](https://databank.worldbank.org/metadataglossary/world-development-indicators/series/SL.UEM.TOTL.ZS) describes modeled ILO estimates, including imputed data, from 1991 onward; those are estimates rather than uniformly direct measurements. [Life-expectancy metadata](https://databank.worldbank.org/metadataglossary/world-development-indicators/series/SP.DYN.LE00.IN) concerns period survival and warns that some annual UN series are interpolated from five-year data. Apparent smoothness can therefore reflect source estimation. These source transformations cannot be undone by this benchmark. Country comparisons and rankings of modeled unemployment levels are not warranted.

The damped-trend forecast form follows the mechanism described in [Forecasting: Principles and Practice](https://otexts.com/fpp3/holt.html), using a simple OLS slope rather than a fitted Holt model. The remaining methods are persistence, fixed target-specific growth/trend/mean-reversion shrinkage, and an autoregression on annual changes with fixed shrinkage. They are predictive mechanisms, not a causal policy model. No GDP/unemployment accounting identity or ladder mapping is used.

GDP scoring uses error as a percentage of origin GDP so rich economies do not dominate solely through dollar scale; dollar levels remain available for plots. Unemployment errors use percentage points and life expectancy errors use years. Metrics are never pooled across unlike targets. Change MAE equals level MAE after subtracting the same origin, so it is reported for interpretability rather than as independent evidence. Direction accuracy excludes actual ties and counts predicted ties as wrong. Persistence thus has zero direction accuracy among actual nonzero changes by definition; this is not by itself evidence of useful prediction.

## Fixed comparison results

The protocol was frozen in `5e843c7`; implementation and data were committed before the sole comparison (`93eb346`, recorded in the receipt). There was no parameter tuning after viewing scores. Full output contains 42,966 country-target-year observations, retaining nulls, and 151,272 forecast rows. Country metadata defines 217 countries/economies and excludes 78 aggregate entries. All four methods use exactly matching scored rows within each target/horizon. Positive skill means lower error than persistence; negative means worse. Cells below show mean absolute error (MAE), then skill versus persistence.

| Target and horizon | Scored country-years | Countries | Persistence MAE | Damped trend MAE; skill | Target shrinkage MAE; skill | Ridge changes MAE; skill |
|---|---:|---:|---:|---:|---:|---:|
| GDP, one year | 7,346 | 202 | 3.930 | 3.476; +11.56% | 3.354; +14.66% | 3.349; +14.79% |
| GDP, five years | 6,550 | 198 | 14.153 | 12.012; +15.13% | 11.787; +16.72% | 11.675; +17.51% |
| Life expectancy, one year | 9,729 | 217 | 0.524 | 0.424; +19.04% | 0.418; +20.18% | 0.427; +18.54% |
| Life expectancy, five years | 8,861 | 217 | 1.675 | 1.160; +30.78% | 1.157; +30.92% | 1.168; +30.28% |
| Unemployment, one year | 2,791 | 187 | 0.572 | 0.646; **−12.92%** | 0.649; **−13.52%** | 0.566; +1.09% |
| Unemployment, five years | 2,043 | 187 | 1.612 | 2.047; **−26.95%** | 1.792; **−11.15%** | 1.706; **−5.84%** |

GDP MAE is in percentage points of origin GDP; life expectancy MAE is in years; unemployment MAE is in percentage points. Five-year rows measure cumulative origin-to-target errors, not annual errors. The table combines no unlike units into a score. The candidate with the smallest observed loss is not an independently confirmed winner; all candidates and country results remain published.

The GDP and longevity mechanisms improve pooled error, but unemployment is not broadly solved. The small one-year unemployment gain for ridge changes is 0.0062 percentage points, and this method beats persistence in only 74 of 187 countries while losing in 113. At five years every unemployment candidate loses. GDP ridge changes wins in 154 of 202 countries at one year and 129 of 198 at five years. Life target shrinkage wins in 201 of 217 countries at one year and 191 of 217 at five years. Country-equal errors, all annual errors, direction counts and every per-country result are included in `metrics.json` so pooled averages do not conceal the failures.

## Coverage and interpretation

GDP has at least one value for 213 countries/economies, with 2,789 missing country-years across the full 1960–2025 grid. Life expectancy has some coverage for all 217, with 251 missing country-years and no observed 2025 values. Unemployment covers 187, begins in 1991, and leaves 7,791 missing grid cells, mostly before that series begins. Twenty consecutive prior observations make unemployment's first one-year scored forecast 2011 and its first five-year scored endpoint 2015. GDP/life one-year scoring begins in 1980 and five-year scoring begins in 1984. Life scoring ends in 2024; the missing 2025 outcome is not silently replaced by an earlier year.

The eight predefined examples—United States (`USA`), India (`IND`), Germany (`DEU`), United Kingdom (`GBR`), Brazil (`BRA`), Japan (`JPN`), South Africa (`ZAF`) and China (`CHN`)—all have complete GDP paths from 1960 through 2025, life paths from 1960 through 2024 and unemployment paths from 1991 through 2025 in this snapshot. Their earlier unemployment and 2025 life observations remain null. These examples were specified before scoring; they were not chosen because a candidate looked successful there.

Missing-outcome forecasts retained but unscored, per method: GDP 20 at one year and 25 at five years; life 217 at either horizon; unemployment 5 at one year and 14 at five years. All missing training histories skip every method at that origin. Explicit forecast bounds affect 29 unemployment predictions; no GDP or life predictions required bounds. The coverage file reports those counts by country/method. No historical observation was changed.

A connected one-year predicted level line represents a sequence of annually updated forecasts, each receiving actual history through its own cutoff. It is not a single prediction made in 1979. A five-year predicted line likewise connects endpoints from different origins. Plot actual levels for context and origin-to-target changes for diagnosis; a close level line alone is not evidence of meaningful gain over persistence. The exported fields identify the cutoff and horizon of every point.

Current-country identities, historical border changes, source imputation/interpolation and revisions limit interpretation. The historical data may incorporate information published later than each forecast origin, even though the fitter excludes later rows. A feature-cutoff test therefore establishes computational time separation, not a historically authentic information set. GDP series revisions, modeled unemployment and smoothed longevity can make this benchmark easier than real-time forecasting. The overlapping five-year forecasts and annual origins are dependent; these are descriptive errors, with no significance claims or independent replication. No model uncertainty intervals were estimated.

## Reproducibility and export contract

Sources were downloaded on 2026-09-17; exact URLs, UTC timestamps, SHA256 digests and World Bank response revision dates are in `provenance.json`. The original JSON bytes and official metadata are under `raw/`. Attribution: World Bank World Development Indicators, with underlying national accounts, ILO, UN and national statistical sources specified in each metadata file. The [indicator metadata](https://databank.worldbank.org/metadataglossary/world-development-indicators/series/SL.UEM.TOTL.ZS) lists CC BY 4.0; [licensing terms](https://datacatalog.worldbank.org/int/public-licenses#cc-by) apply.

- `paths.json`: all countries, target/unit mappings, flat `observations` and `predictions` arrays. Observation values retain native units and nulls. Each prediction carries country, target, unit, origin year, training start/cutoff, horizon, method, mode, origin value, raw/bounded prediction, actual, actual change and predicted change. `changeUnits` defines the changes separately from native levels. GDP changes are percentages of origin GDP; the other changes use native differences.
- `example-paths.json`: the same schema restricted to the eight fixed illustration countries; source rows remain available for every economy in the full file.
- `metrics.json`: all 24 target/horizon/method pooled comparisons, country-equal summaries, every country result and target-year summaries. Direction accuracy denominators exclude actual changes with magnitude at most 1e-12 in scoring units, with predicted ties counted as wrong. Counts are explicit.
- `coverage.json`: each country/target's observed span, missing years, skipped origins, missing endpoints and bound counts, plus official aggregate exclusions.
- `score-receipt.json`: the sole execution's code/protocol provenance and output digests. `run.py` refuses a second scoring execution or output overwrite.

Run checks from the repository root:

```sh
python -m unittest discover -s scripts/evaluation/annual-objective -p 'test_*.py'
python scripts/evaluation/annual-objective/verify.py
```

Python requires NumPy; acquisition uses only the standard library. Eight synthetic behavior tests cover future-tail perturbation, missing-history refusal, valid-history eligibility, invalid GDP, log/native arithmetic, explicit clipping and independently checked normalized scoring/direction ties. The exported-evidence audit checks every row's cutoff, exact history, units, matched method mask, arithmetic and source/output hashes without fitting or rerunning the study. The acquisition script can verify pinned files without downloading again; source endpoints may change if used for a future study.

The first public API attempt failed under the network sandbox; the same read-only fetch succeeded with network approval. An implementation denominator guard was aligned exactly with the frozen protocol before scoring. Accidental Python bytecode was removed before scoring and is ignored. No post-score model or parameter change was made. Earlier evaluation artifacts were neither edited nor rescored.

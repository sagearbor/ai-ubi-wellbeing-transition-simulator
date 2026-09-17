# Annual wellbeing and long economic histories: evidence review

Reviewed 2026-09-17. This is a literature and source audit, not a new empirical result. The companion machine-readable inventory is `data/evaluation/annual-literature-20260917/sources.json`. Dataset access and public release status were checked on this date. No restricted Gallup dataset was acquired.

## What the evidence supports

Annual historical reconstruction is a reasonable research objective. A close reconstruction using observed annual inputs does not establish that the same path could have been forecast before those inputs became known. Nor does either exercise identify the wellbeing effect of an AI or transfer policy.

The reviewed sources do **not** establish a generally reliable model of future annual national Cantril-ladder changes. They do support testing small dynamic models against persistence, separating within-country changes from differences between countries, and showing uncertainty. Stronger published forecasting results for other outcomes have narrower samples and horizons than the simulator's global policy scenarios.

| Label on a chart | Information allowed | What success establishes |
|---|---|---|
| In-sample fit | Target years help estimate coefficients and country effects | Descriptive fit only |
| Out-of-period conditional reconstruction | Fit before the cutoff; supply later observed predictors; hide later target values | Transport of an association given realized inputs |
| Annual rolling forecast | At every origin, use only information available by that origin; forecast later inputs too | Forecast skill at the stated horizon and information set |
| Causal policy scenario | An intervention and defensible identification or explicit structural assumptions | A conditional policy claim, separately justified |

These distinctions follow the ex-ante/ex-post treatment in [Hyndman and Athanasopoulos, §7.6](https://otexts.com/fpp3/forecasting-regression.html). If revised modern data replace the historical release vintage, label the exercise **pseudo-out-of-sample with revised data**, even when the split is chronological.

## Annual data: verified facts and access limits

The [WHR data-sharing page](https://www.worldhappiness.report/data-sharing/) offers Figure 2.1's three-year means, confidence intervals, and explanatory contributions. The regression panel is different. Current [OWID Cantril metadata](https://ourworldindata.org/grapher/happiness-cantril-ladder) explicitly defines its 2025 value as the 2023–2025 average. OWID also says original providers' licensing applies to third-party data; its own CC BY label does not automatically relicense Gallup data.

The old official annual URL, [WHR 2023 Table 2.1 spreadsheet](https://happiness-report.s3.amazonaws.com/2023/DataForTable2.1WHR2023.xls), returned HTTP 403 to a direct request on 2026-09-17. No alternate-host or access-control workaround was attempted. A historically published URL is not a currently verified download. An independently authorized source or Gallup institutional permission is still needed before claiming the full annual regression panel is available.

**Public annual target access was subsequently confirmed.** On the official [Finland country dashboard](https://data.worldhappiness.report/country/FIN), the root agent selected **Annual score** and read the visible 2025 tooltip: **7.811**, versus **7.764** for the three-year score. The study is extracting a predetermined eight-country sample from visible chart tooltips. This establishes a limited annual target route, not a public bulk download or the annual social-predictor panel. Extraction uses the visible interface, without hidden application state or undocumented APIs. Record country, year, displayed precision, acquisition date and annual mode; leave unconfirmed points missing. Public display by itself does not establish unrestricted redistribution rights.

The [WHR 2026 statistical appendix, §§1–3](https://files.worldhappiness.report/WHR26_Statistical_Appendix.pdf) documents an unbalanced annual survey panel, 2005/06–2025, from the January 2026 Gallup release. Its variable definitions matter:

| Quantity | Meaning and relevant limitation |
|---|---|
| Life ladder | National annual mean of survey responses on a 0–10 scale; some country-years absent |
| Social support | Proportion reporting someone to count on in trouble |
| Freedom | Proportion satisfied with freedom to choose their life |
| Corruption | Reported business/government corruption; not interchangeable with institutional trust |
| Generosity | Donation measure residualized against income; preprocessing itself needs a training boundary |
| Healthy life expectancy | WHO series available through 2021; later years extrapolated, some missing values interpolated |
| GDP per capita | Constant-2021 PPP dollars; 2025 extended using economic growth forecasts |

Thus an annual row need not contain independently measured annual health or income. Preserve observed, imputed, extrapolated, and forecast flags. Do not use Figure 2.1's fitted contribution columns as raw explanatory measurements, or include its outcome-derived residual as a predictor.

[WHO's HALE definition and comparability warning](https://www.who.int/data/gho/indicator-metadata-registry/imr-details/7752) distinguish expected years in full health from total years alive. WHO warns that its 2000–2021 release is not directly comparable with previous HALE estimates. World Bank `SP.DYN.LE00.IN` is **total** life expectancy and cannot silently replace HALE under the same coefficient.

An openly downloadable secondary check is [ONS annual personal wellbeing](https://www.ons.gov.uk/peoplepopulationandcommunity/wellbeing/datasets/headlineestimatesofpersonalwellbeing), including UK and subnational life satisfaction. It measures another question, population, and often April–March period. It is useful as an explicitly separate target, not a replacement global Cantril series.

## Original empirical results and their actual scope

| Source | Sample and design | Reported result | Permissible interpretation |
|---|---|---|---|
| [Helliwell et al., WHR 2026, Table 2.1](https://www.worldhappiness.report/ed/2026/international-evidence-on-happiness-and-social-media/) | 2,365 observations, 155 countries, 2005–2025; pooled OLS with year effects | Adjusted R² 0.762; log-income coefficient 0.297 | Updated descriptive fit, with no annual forecast test. Footnote 20 confirms restricted annual regression-panel access |
| [Helliwell et al., WHR 2025, Table 2.1](https://www.worldhappiness.report/ed/2025/caring-and-sharing-global-analysis-of-happiness-and-kindness/) | 2,234 country-year observations, 155 countries, 2005–2024; pooled OLS with year effects, country-clustered errors | Adjusted R² 0.761 with six predictors | In-sample levels fit; no held-out annual forecast horizon. Footnote 14 restricts annual panel access; footnote 15 says unemployment has not been significant in their country equation. Country effects change slow-moving health estimates. |
| [Helliwell et al., WHR 2024, Table 2.1](https://www.worldhappiness.report/ed/2024/happiness-of-the-younger-the-older-and-those-in-between/) | 2,103 country-year observations, 155 countries, 2005–2023 | Adjusted R² 0.757; log-income coefficient 0.349 | A reproducible specification reference once matching inputs are available; not evidence of predicting three-quarters of annual changes |
| [Stevenson and Wolfers (2008), BPEA](https://www.brookings.edu/wp-content/uploads/2016/07/2008a_bpea_stevenson.pdf) | Multiple international surveys; cross-sections and repeated observations over decades | Positive income–wellbeing association, including time changes; authors describe time-series evidence as noisier and less decisive | Supports considering log income, not a universal annual forecast elasticity |
| [Oparina, Layard and Clark (2025), working paper](https://www.brookings.edu/wp-content/uploads/2025/01/20250116_CSDP_Easterlin_WorkingPaper.pdf) | Gallup 2009–2019, over 150 countries; individual and country analyses | Income association differs by income group and social controls; rich-country coefficient loses significance with controls | Evidence against assuming one invariant income response. Not a temporal forecast contest; controls may also be mediators |
| [De Neve et al. (2018), Review of Economics and Statistics, DOI 10.1162/REST_a_00697](https://www.hbs.edu/ris/download.aspx?name=THE+ASYMMETRIC+EXPERIENCE+OF+POSITIVE.pdf) | Gallup over 150 countries, US BRFSS 2.3 million respondents, Eurobarometer over four decades | Wellbeing more than twice as sensitive to negative versus positive growth | Motivation for a prespecified recession asymmetry test; not proof of forecast improvement or a policy multiplier |
| [Lucas et al. (2004), Psychological Science, DOI 10.1111/j.0963-7214.2004.01501002.x](https://pubmed.ncbi.nlm.nih.gov/14717825/) | 15-year German longitudinal study, more than 24,000 individuals | Incomplete average recovery after unemployment, including after reemployment | Supports persistent non-income job-loss costs at individual level; national unemployment-to-ladder coefficient and future AI applicability remain unestablished |
| [Ball, Leigh and Loungani (2013), IMF WP/13/10](https://www.imf.org/external/pubs/ft/wp/2013/wp1310.pdf) | US since 1948; 20 advanced economies, annual 1980–2011 comparisons | Strong output–unemployment fit in many countries; materially different country coefficients | Okun relationship is a candidate reconstruction component. Fitted RMSE/R² and two-sided trend estimates are not real-time forecast scores |
| [Stock and Watson (2002), JBES, DOI 10.1198/073500102317351921](https://www.princeton.edu/~mwatson/papers/Stock_Watson_JBES_2002.pdf) | 215 US predictors; eight monthly outcomes; simulated real-time forecasts 1970–1998; 6, 12, 24 months | Dynamic-factor forecasts outperform tested autoregressions, small VARs and leading-indicator models over that sample | Genuine temporal prediction evidence for those macro outcomes, using a revised historical dataset. Does not validate annual global GDP, unemployment, or wellbeing skill |
| [Raftery, Chunn, Gerland and Ševčíková (2013), Demography, DOI 10.1007/s13524-012-0193-x](https://link.springer.com/article/10.1007/s13524-012-0193-x) | 158 countries; male period life expectancy in five-year periods; train 1950–1995, evaluate 1995–2005, 316 predictions; generalized HIV epidemics excluded | MAE 1.07 years; over 40% below UN comparator; 80% intervals covered 82%, 95% intervals covered 92% | Stronger documented temporal validation, with imperfect 95% calibration. Neither an annual-change nor HALE result; no transferable guarantee for pandemic shocks |
| [An, Jalles and Loungani (2018), IMF WP/18/39](https://www.imf.org/-/media/files/publications/wp/2018/wp1839.pdf) | GDP forecast histories for 63 countries, 1992–2014; forecasts revised before and during target year | Recession magnitude missed until late; official and private forecasts behave similarly | Adversarial evidence against promising accurate turning points from smooth projections |

The WHR R² measures combine between-country level differences and within-country changes. Stable country offsets can explain much of the former while missing the latter. Report both separately. A paper's use of the words “predictive power,” “effect,” or “Granger causality” does not change its validation design or identify an intervention.

## Public sources for longer annual histories

| Series | Official source and coverage checked | Use and cautions |
|---|---|---|
| Real GDP per person | [WDI constant-2015 US dollars](https://databank.worldbank.org/metadataglossary/world-development-indicators/series/NY.GDP.PCAP.KD), `NY.GDP.PCAP.KD`; annual reference period 1960–2025, country coverage varies | Long within-country volume trajectories; do not equate market-exchange-rate levels with PPP living standards |
| PPP income | [WDI constant-2021 PPP](https://data.worldbank.org/indicator/NY.GDP.PCAP.PP.KD), `NY.GDP.PCAP.PP.KD`; displayed range 1990–2025 | Suitable contemporary international level comparison; freeze vintage and actual country-year mask |
| Very long GDP histories | [Maddison Project Database 2023](https://www.rug.nl/ggdc/historicaldevelopment/maddison/releases/maddison-project-database-2023?lang=en); 169 countries through 2022; [release DOI](https://doi.org/10.34894/INZBF2) | Historical reconstruction, not uniformly observed annual national accounts. Cite country source papers for graphs, as the release requests |
| Unemployment | [WDI/ILO modelled series](https://databank.worldbank.org/metadataglossary/world-development-indicators/series/SL.UEM.TOTL.ZS), `SL.UEM.TOTL.ZS`; annual 1991–2025 | Preserve ILO reported/imputed flags when using [original ILO data](https://ilostat.ilo.org/dataviz/weso/). Model-generated labels can already use GDP; apparent prediction then partly replicates their model |
| Total period life expectancy | [WDI](https://data.worldbank.org/indicator/SP.DYN.LE00.IN), `SP.DYN.LE00.IN`, displayed 1960–2024; [UN WPP 2024](https://population.un.org/wpp), annual estimates from 1950, projections to 2100 | [WPP 2024 estimation ends in 2023](https://population.un.org/wpp/assets/Files/WPP2024_Summary-of-Results.pdf); later values can be projections. A WDI date is not proof of direct observation. Keep source, estimate/projection status, sex, and period/cohort definition |
| Healthy life expectancy | [WHO HALE](https://www.who.int/data/gho/data/indicators/indicator-details/GHO/gho-ghe-hale-healthy-life-expectancy-at-birth) | The WHR health construct; shorter record and modelled disability/mortality inputs. Evaluate separately from total life expectancy |

GDP per capita is not household disposable income, unemployment is not nonemployment, and period life expectancy is not a newborn cohort's forecast lifetime. Longer historical records do not make the joint wellbeing panel longer than its observed target. Joining to early macro data cannot create measured pre-2005 Cantril values.

For the limited eight-country annual target extraction, the companion study uses WDI log real GDP, **total** life expectancy and modelled unemployment, because the annual Gallup social inputs remain unavailable. This is an admissible reduced-information experiment. Refit every coefficient and name those features accurately. It is not a WHR six-factor replication; its failure would not falsify the value of unavailable social measurements. Conversely, matching macro-only history would not validate the causal policy layer. Eight preselected countries support an illustrative benchmark, not a global performance claim.

## Three bounded modelling approaches

These are proposed experiments, not published performance claims.

1. **Annual conditional panel reconstruction.** With a verified annual target and permitted inputs, fit a small regularized country-intercept model and a first-difference alternative. Separate within-country deviations from country means. Use only pre-cutoff data for coefficient selection, scaling, missing-value rules, generosity residualization, and country offsets. Supply realized annual predictors after cutoff and label the curve accordingly. Include unemployment as an ablation, not an assumed universal penalty. Compare against an unchanged-country baseline on the identical target mask. This first asks whether measured annual social inputs explain the movements the user wants to see.

2. **Small dynamic or state-space annual forecast.** Compare persistence and damped local trend with a pooled autoregression using a few lagged predictors. If justified by enough data, add a latent country state and survey measurement error. [Harvey (1989)](https://www.cambridge.org/core/books/forecasting-structural-time-series-models-and-the-kalman-filter/CE5E112570A56960601760E786A5E631) supplies the state-space framework, not a wellbeing accuracy guarantee. A filter uses past data; a full-sample smoother borrows the future and belongs only in the descriptive panel. Estimate survey error when sample errors are available; otherwise show a sensitivity range rather than an invented known variance. With roughly twenty annual observations per country, partial pooling and few parameters are preferable candidates to many country-specific lags. Dynamic fixed-effects estimation is not automatically unbiased; [Arellano and Bond (1991)](https://doi.org/10.2307/2297968) requires explicit moment assumptions and specification tests, not automatic causal status.

3. **Separate long-history macro/health forecasts.** Model log real GDP growth, unemployment changes or bounded unemployment dynamics, and life expectancy independently before feeding distributions into wellbeing. Start with autoregression/drift benchmarks; test a small output–unemployment relationship with country heterogeneity. Avoid future-informed detrending. For total life expectancy, compare a damped annual trend with a partially pooled gains model motivated by demographic forecasting. Forecast all downstream inputs jointly enough to preserve major dependence. Historical GDP does not validate an AI scenario, and demographic forecast performance does not validate HALE or ladder performance.

## A test that can answer the user's graph question

Use the same annual target panel in four adjacent charts: observed versus fitted history, conditional reconstruction, rolling one-year forecasts, and fixed-origin multi-year forecasts. Mark origin, target period, predictor availability, and missing years. Annual one-step predictions can form a more responsive path because each origin receives another actual observation; label this updating explicitly. Do not present them as one uninterrupted multi-year prediction made at the first origin.

Following [rolling-origin evaluation](https://otexts.com/fpp3/tscv.html), choose models inside earlier time folds, then preserve a later untouched block. Score one-, three-, and five-year horizons separately when data support them. Freeze the eligible-country mask before looking at outcomes, publish exclusions, and include both equal-country and population-weighted summaries. If annual data end earlier, shorten the scored interval rather than substitute rolling means.

Use ladder-point MAE/RMSE, change-error MAE, error relative to persistence, per-country and recession-period errors, direction accuracy with a clearly defined treatment of zero changes, and interval coverage/width. Use paired country/time-aware resampling for uncertainty where feasible. A high pooled correlation can coexist with poor annual tracking. Smoothed observations or in-sample offsets should never be rewarded as forecast improvements.

## Adversarial checks before claiming progress

- **Time semantics:** survey year, release year, and three-year window end are distinct. Adjacent rolling means share observations; a one-step baseline already knows much of the window.
- **Hidden future input:** actual future social support or GDP makes reconstruction conditional. Holdout-year fixed effects, two-sided trend filters, and full-series interpolation leak later information.
- **Target-derived inputs:** fitted contributions and a “Dystopia + residual” column can reconstruct their own target arithmetically. Exclude them.
- **Revision leakage:** later PPP rebasing, revised demographic estimates, and learned imputation rules are not necessarily known at the forecast origin.
- **Level/change confusion:** a good country ranking is compatible with predicting none of its annual movement. Inspect country-centered and first-difference errors.
- **Causal transport:** individual unemployment evidence does not directly set an aggregate AI-displacement coefficient. Income, health and social support may mediate each other; conditioning choices change the estimand.
- **Noise and crisis selection:** survey gaps may concentrate in conflict; complete-case success can conceal precisely the hard countries. A visible zigzag can be measurement error.
- **Tuning on display:** selecting countries, blend weights, or “good-looking” paths after viewing the test block consumes that block. Keep the result exploratory.

## Corrections to earlier repository guidance

`docs/design/research/wellbeing-frameworks.md` needs these corrections when its owner revises it:

| Earlier claim | Verified correction |
|---|---|
| Full explanatory panel begins in 2019 | Original WHR regressions use annual data from 2005 onward; availability/missingness is a separate issue |
| OWID provides a freely reusable annual ladder backbone | Current series is a three-year mean; third-party licence terms still apply |
| Doubling income equals one log unit | Natural-log doubling is `ln(2) = 0.6931`; with coefficient 0.349 the associated change is about 0.242 ladder points, holding other terms fixed |
| Six-factor coefficients can be dropped directly into a policy equation | They describe observational associations with specific constructs, samples and vintages; policy transport requires additional assumptions |

The newer `docs/design/reviews/2026-09-16-forecast-paths.html` already identifies the target as a trailing three-year average. That correct caveat should remain attached to those existing results; this review does not retroactively relabel them as annual forecasts.

## Independent audit of the annual objective benchmark

Reviewed `scripts/evaluation/annual-objective/{model.py,run.py,fetch.py,test_model.py}`, the frozen protocol, provenance, score receipt and saved outputs in the separate objective worktree on 2026-09-17. The receipt records protocol commit `5e843c7`, scoring code commit `93eb346ebe6a8c6b1a5c6d63b7fd46bb6770b4ed`, and one completed comparison. **No P1 or P2 implementation defect was found in the audited scope.** The scorer was not rerun; models and hyperparameters were not changed.

- All 12 hash comparisons passed: four saved outputs, seven source files and the protocol matched their recorded hashes.
- Read-only arithmetic independently reproduced all 24 saved pooled metric rows from 151,272 saved forecasts, including GDP normalization by origin, persistence error, skill, direction/tie handling and missing-outcome counts.
- All 37,818 country/target/origin/horizon sets contained the same four methods, actual value and origin value. Saved cutoffs and horizon arithmetic were consistent. Code fits only exact 20-year histories ending at the origin; missing histories skip all methods.
- Registration precedes data retrieval. Formula definitions agree with implementation. The current result note acknowledges revised data, source modelling, overlapping horizons, exploratory method selection and unemployment failures. Country-equal scores and all losing methods remain available.

**Interpretation concern for downstream charts (P2 if presented as turning-point skill):** high direction percentages should not be advertised without their class composition. Among scored nonzero actual changes, GDP rises in 72.11% of one-year and 75.02% of five-year cases; life expectancy rises in 83.12% and 87.93%, respectively. All candidate direction accuracies are below these unconditional upward frequencies. These are descriptive counts from the fixed saved outcomes, not a newly fitted or selected contestant. The existing note does not claim turning-point success. Persistence's zero direction accuracy is mechanically imposed by counting its ties as wrong.

The audit verifies the saved calculation, not real-time information availability, causal validity, or independent replication. Source interpolation and revisions may already contain later information even though the prediction code excludes later rows. No uncertainty about performance was quantified in the benchmark.

# Income + life-expectancy changes — sealed external result

Entry `research-health-2018-v1`. Base `0ca2eda`. Protocol `6c6cdb2dbe638a88097abae1d826abee0dec8116`; numerical freeze `c0a39243de8abc1d6fc3a5c2ade094b91a49978d`. Scoring commit `5e8fb0bd0f9895f64ce9a4d816309eb341f664a2`; receipt completed `2026-09-16T21:24:44.038Z`.

These are exploratory retrospective comparisons from one declared family of five. All five forecasts froze before any new test scoring. All five results are published, including essentially null gains. No parameter, input, country, horizon or model was changed after scoring. Selection of a winner now requires new confirmation; it is not an independent validation sample. No default or application behavior changed.

**Target-definition correction discovered after scoring:** the pinned OWID happiness indicator is a trailing three-year survey average, dated by its final year. It is not a single-year survey score. Adjacent windows overlap, including early origin/test windows; the 2025 endpoint covers 2023–2025, separate from the 2016–2018 origin window. Frozen protocols remain unchanged as the audit record. [Provider definition](https://ourworldindata.org/grapher/happiness-cantril-ladder).

Skill = 1 − model MAE / persistence MAE; positive means lower error. MAE is mean absolute error. Missing outcomes are excluded identically from both methods, never replaced with predictions or zero. Countries receive equal weight; pooled results weight observed country-year cells, not population. Origin-income quartiles use frozen 2018 GDP, with 25 countries in each group before outcome missingness. GDP errors are cumulative growth percentage points relative to origin GDP, **not** percent errors relative to realized GDP.

## Wellbeing result — ladder points

| Scope | Observed / expected | Model MAE | Persistence MAE | Skill |
| --- | --- | --- | --- | --- |
| 2025 endpoint | 97 / 100 | 0.362696 | 0.389000 | +6.76% |
| Pooled available years | 681 / 700 | 0.274834 | 0.289744 | +5.15% |

| Window ending / year | Observed / expected | Model MAE | Persistence MAE | Skill |
| --- | --- | --- | --- | --- |
| 2019 | 99 / 100 | 0.115738 | 0.122147 | +5.25% |
| 2020 | 98 / 100 | 0.190235 | 0.202133 | +5.89% |
| 2021 | 97 / 100 | 0.288195 | 0.301773 | +4.50% |
| 2022 | 96 / 100 | 0.305479 | 0.317573 | +3.81% |
| 2023 | 97 / 100 | 0.321147 | 0.335619 | +4.31% |
| 2024 | 97 / 100 | 0.344814 | 0.364608 | +5.43% |
| 2025 | 97 / 100 | 0.362696 | 0.389000 | +6.76% |

| Origin income quartile | 2025 observed | 2025 model MAE | 2025 persistence MAE | 2025 skill | Pooled skill |
| --- | --- | --- | --- | --- | --- |
| origin-income-Q1 | 23 | 0.368449 | 0.389783 | +5.47% | +2.30% |
| origin-income-Q2 | 24 | 0.492771 | 0.547417 | +9.98% | +8.17% |
| origin-income-Q3 | 25 | 0.396148 | 0.445000 | +10.98% | +8.01% |
| origin-income-Q4 | 25 | 0.199080 | 0.180200 | -10.48% | -3.93% |

## GDP result — cumulative growth error percentage points

| Scope | Observed / expected | Model MAE | Persistence MAE | Skill |
| --- | --- | --- | --- | --- |
| 2025 endpoint | 97 / 100 | 9.261990 | 15.629918 | +40.74% |
| Pooled available years | 691 / 700 | 5.929630 | 8.649982 | +31.45% |

| Window ending / year | Observed / expected | Model MAE | Persistence MAE | Skill |
| --- | --- | --- | --- | --- |
| 2019 | 99 / 100 | 1.318272 | 2.628829 | +49.85% |
| 2020 | 99 / 100 | 7.321123 | 5.109767 | -43.28% |
| 2021 | 99 / 100 | 4.645361 | 5.912207 | +21.43% |
| 2022 | 99 / 100 | 5.285104 | 8.303168 | +36.35% |
| 2023 | 99 / 100 | 6.061095 | 10.190963 | +40.52% |
| 2024 | 99 / 100 | 7.681784 | 12.916027 | +40.53% |
| 2025 | 97 / 100 | 9.261990 | 15.629918 | +40.74% |

| Origin income quartile | 2025 observed | 2025 model MAE | 2025 persistence MAE | 2025 skill | Pooled skill |
| --- | --- | --- | --- | --- | --- |
| origin-income-Q1 | 24 | 13.720993 | 20.809815 | +34.06% | +26.19% |
| origin-income-Q2 | 25 | 11.035189 | 17.723692 | +37.74% | +29.25% |
| origin-income-Q3 | 24 | 7.906000 | 15.478511 | +48.92% | +38.11% |
| origin-income-Q4 | 24 | 4.311894 | 8.420414 | +48.79% | +34.23% |

## Interpretation

This is an additional-input experiment, not strict identical-input compliance with PR23. Pre-2019 World Bank life expectancy is used; all future covariates are predicted from past data.

Post-period literature excerpts were inadvertently exposed after method registration; the protocol records timing and categories. Do not call the result blinded.

The fitted life-expectancy coefficient is slightly negative, and the strongest income-only approach is better on ladder MAE. Different equations and GDP forecasts prevent attributing the difference to adding health; no causal or incremental-health benefit is established.

The frozen origin is 100 countries; 28 of the original 128 roster were excluded by the original protocol. Ladder has 681 observed and 19 missing cells; GDP has 691 observed and 9 missing cells. Both have 97 observed countries at 2025. Full row-specific missingness and the 28 origin exclusions remain in the score artifact.

## Countries moving wellbeing error

Positive contribution reduces aggregate MAE; negative contribution makes it worse. Each endpoint contribution divides the country's absolute-error improvement by the common observed endpoint count. Pooled contributions use the common observed country-year count. Each list shows both tails; the complete country table is in scores.json.

### 2025 endpoint contributors

| Tail | Country | Contribution to MAE improvement |
| --- | --- | --- |
| Largest gains | Romania (ROU) | 0.00161829 |
| Largest gains | China (CHN) | 0.00154798 |
| Largest gains | Moldova (MDA) | 0.00154755 |
| Largest gains | Vietnam (VNM) | 0.00150024 |
| Largest gains | India (IND) | 0.00140214 |
| Largest losses | Myanmar (MMR) | -0.00126652 |
| Largest losses | Ethiopia (ETH) | -0.00128415 |
| Largest losses | Bangladesh (BGD) | -0.00136835 |
| Largest losses | Malta (MLT) | -0.00139767 |
| Largest losses | Yemen (YEM) | -0.00201588 |

### Pooled years contributors

| Tail | Country | Contribution to MAE improvement |
| --- | --- | --- |
| Largest gains | Romania (ROU) | 0.00111527 |
| Largest gains | Moldova (MDA) | 0.00107075 |
| Largest gains | Vietnam (VNM) | 0.00103801 |
| Largest gains | China (CHN) | 0.00095945 |
| Largest gains | Nepal (NPL) | 0.00087050 |
| Largest losses | Pakistan (PAK) | -0.00059745 |
| Largest losses | Turkey (TUR) | -0.00059775 |
| Largest losses | Malta (MLT) | -0.00086628 |
| Largest losses | Ethiopia (ETH) | -0.00088850 |
| Largest losses | Yemen (YEM) | -0.00118027 |

## Countries moving GDP error

Positive contribution reduces aggregate MAE; negative contribution makes it worse. Each endpoint contribution divides the country's absolute-error improvement by the common observed endpoint count. Pooled contributions use the common observed country-year count. Each list shows both tails; the complete country table is in scores.json.

### 2025 endpoint contributors

| Tail | Country | Contribution to MAE improvement |
| --- | --- | --- |
| Largest gains | China (CHN) | 0.21685982 |
| Largest gains | Bangladesh (BGD) | 0.21055920 |
| Largest gains | Moldova (MDA) | 0.20604366 |
| Largest gains | India (IND) | 0.20488546 |
| Largest gains | Ethiopia (ETH) | 0.20061012 |
| Largest losses | Bolivia (BOL) | -0.07716495 |
| Largest losses | Estonia (EST) | -0.10216266 |
| Largest losses | Ukraine (UKR) | -0.10985200 |
| Largest losses | Sri Lanka (LKA) | -0.12312237 |
| Largest losses | Myanmar (MMR) | -0.18231302 |

### Pooled years contributors

| Tail | Country | Contribution to MAE improvement |
| --- | --- | --- |
| Largest gains | China (CHN) | 0.14139317 |
| Largest gains | Bangladesh (BGD) | 0.14067718 |
| Largest gains | Ethiopia (ETH) | 0.13415017 |
| Largest gains | Vietnam (VNM) | 0.12909314 |
| Largest gains | Ireland (IRL) | 0.11788044 |
| Largest losses | Ukraine (UKR) | -0.04984896 |
| Largest losses | Bolivia (BOL) | -0.05194863 |
| Largest losses | Lebanon (LBN) | -0.05228548 |
| Largest losses | Sri Lanka (LKA) | -0.08292774 |
| Largest losses | Myanmar (MMR) | -0.10994101 |

## Reproduction and integrity

The model recipe, internal validation, calibration and 700 forecast rows remain in `data/evaluation/research-health-2018-v1/`. The existing pending-external note is preserved as the freeze-era record; this result report supersedes its status. `score-receipt.json` and `scoring-manifest.json` bind inputs, implementation and the single score. `family-artifacts-20260916.test.ts` verifies those hashes without fitting or rescoring. To inspect the recorded results, run `cat data/evaluation/research-health-2018-v1/scores.json`; do not invoke the one-shot scorer again.

`npm run check` passed locally on this branch before scoring. Final PR CI will independently execute the complete checks including the added artifact integrity tests. The old holdout is byte-identical to base, and no pre-existing tracked file was modified.

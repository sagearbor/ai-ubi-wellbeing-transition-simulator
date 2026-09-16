# 75% persistence + 25% damped trend — sealed external result

Entry `research-ensemble-2018-v1`. Base `0ca2eda`. Protocol `2fee937281751947567ab856047c41ad3cbdba4a`; numerical freeze `0c1fef8003f179d6c9a9dda1aee65ed1a8cbb005`. Scoring commit `89e7d4b101260c7dde1aa8029a5b8299ac05feed`; receipt completed `2026-09-16T21:24:43.958Z`.

These are exploratory retrospective comparisons from one declared family of five. All five forecasts froze before any new test scoring. All five results are published, including essentially null gains. No parameter, input, country, horizon or model was changed after scoring. Selection of a winner now requires new confirmation; it is not an independent validation sample. No default or application behavior changed.

**Target-definition correction discovered after scoring:** the pinned OWID happiness indicator is a trailing three-year survey average, dated by its final year. It is not a single-year survey score. Adjacent windows overlap, including early origin/test windows; the 2025 endpoint covers 2023–2025, separate from the 2016–2018 origin window. Frozen protocols remain unchanged as the audit record. [Provider definition](https://ourworldindata.org/grapher/happiness-cantril-ladder).

Skill = 1 − model MAE / persistence MAE; positive means lower error. MAE is mean absolute error. Missing outcomes are excluded identically from both methods, never replaced with predictions or zero. Countries receive equal weight; pooled results weight observed country-year cells, not population. Origin-income quartiles use frozen 2018 GDP, with 25 countries in each group before outcome missingness. GDP errors are cumulative growth percentage points relative to origin GDP, **not** percent errors relative to realized GDP.

## Wellbeing result — ladder points

| Scope | Observed / expected | Model MAE | Persistence MAE | Skill |
| --- | --- | --- | --- | --- |
| 2025 endpoint | 97 / 100 | 0.383189 | 0.389000 | +1.49% |
| Pooled available years | 681 / 700 | 0.285136 | 0.289744 | +1.59% |

| Window ending / year | Observed / expected | Model MAE | Persistence MAE | Skill |
| --- | --- | --- | --- | --- |
| 2019 | 99 / 100 | 0.115792 | 0.122147 | +5.20% |
| 2020 | 98 / 100 | 0.196224 | 0.202133 | +2.92% |
| 2021 | 97 / 100 | 0.293629 | 0.301773 | +2.70% |
| 2022 | 96 / 100 | 0.310802 | 0.317573 | +2.13% |
| 2023 | 97 / 100 | 0.335025 | 0.335619 | +0.18% |
| 2024 | 97 / 100 | 0.365961 | 0.364608 | -0.37% |
| 2025 | 97 / 100 | 0.383189 | 0.389000 | +1.49% |

| Origin income quartile | 2025 observed | 2025 model MAE | 2025 persistence MAE | 2025 skill | Pooled skill |
| --- | --- | --- | --- | --- | --- |
| origin-income-Q1 | 23 | 0.384770 | 0.389783 | +1.29% | -2.41% |
| origin-income-Q2 | 24 | 0.523642 | 0.547417 | +4.34% | +4.71% |
| origin-income-Q3 | 25 | 0.434319 | 0.445000 | +2.40% | +4.12% |
| origin-income-Q4 | 25 | 0.195770 | 0.180200 | -8.64% | -4.40% |

## GDP result — cumulative growth error percentage points

| Scope | Observed / expected | Model MAE | Persistence MAE | Skill |
| --- | --- | --- | --- | --- |
| 2025 endpoint | 97 / 100 | 13.846357 | 15.629918 | +11.41% |
| Pooled available years | 691 / 700 | 7.678620 | 8.649982 | +11.23% |

| Window ending / year | Observed / expected | Model MAE | Persistence MAE | Skill |
| --- | --- | --- | --- | --- |
| 2019 | 99 / 100 | 2.210503 | 2.628829 | +15.91% |
| 2020 | 99 / 100 | 5.397418 | 5.109767 | -5.63% |
| 2021 | 99 / 100 | 5.251606 | 5.912207 | +11.17% |
| 2022 | 99 / 100 | 7.089076 | 8.303168 | +14.62% |
| 2023 | 99 / 100 | 8.741496 | 10.190963 | +14.22% |
| 2024 | 99 / 100 | 11.338483 | 12.916027 | +12.21% |
| 2025 | 97 / 100 | 13.846357 | 15.629918 | +11.41% |

| Origin income quartile | 2025 observed | 2025 model MAE | 2025 persistence MAE | 2025 skill | Pooled skill |
| --- | --- | --- | --- | --- | --- |
| origin-income-Q1 | 24 | 18.880301 | 20.809815 | +9.27% | +10.50% |
| origin-income-Q2 | 25 | 15.999407 | 17.723692 | +9.73% | +9.25% |
| origin-income-Q3 | 24 | 13.304422 | 15.478511 | +14.05% | +12.91% |
| origin-income-Q4 | 24 | 7.111586 | 8.420414 | +15.54% | +13.35% |

## Interpretation

The small aggregate gain does not establish a practically reliable advantage or statistical significance. Training-window model selection remains optimistic.

The frozen origin is 100 countries; 28 of the original 128 roster were excluded by the original protocol. Ladder has 681 observed and 19 missing cells; GDP has 691 observed and 9 missing cells. Both have 97 observed countries at 2025. Full row-specific missingness and the 28 origin exclusions remain in the score artifact.

## Countries moving wellbeing error

Positive contribution reduces aggregate MAE; negative contribution makes it worse. Each endpoint contribution divides the country's absolute-error improvement by the common observed endpoint count. Pooled contributions use the common observed country-year count. Each list shows both tails; the complete country table is in scores.json.

### 2025 endpoint contributors

| Tail | Country | Contribution to MAE improvement |
| --- | --- | --- |
| Largest gains | Honduras (HND) | 0.00218553 |
| Largest gains | Bulgaria (BGR) | 0.00211910 |
| Largest gains | Hungary (HUN) | 0.00173944 |
| Largest gains | Portugal (PRT) | 0.00156835 |
| Largest gains | Romania (ROU) | 0.00142251 |
| Largest losses | Malaysia (MYS) | -0.00143392 |
| Largest losses | Pakistan (PAK) | -0.00143881 |
| Largest losses | Argentina (ARG) | -0.00155042 |
| Largest losses | Brazil (BRA) | -0.00176959 |
| Largest losses | Algeria (DZA) | -0.00326624 |

### Pooled years contributors

| Tail | Country | Contribution to MAE improvement |
| --- | --- | --- |
| Largest gains | Bulgaria (BGR) | 0.00146621 |
| Largest gains | Hungary (HUN) | 0.00120196 |
| Largest gains | Portugal (PRT) | 0.00108514 |
| Largest gains | Romania (ROU) | 0.00098424 |
| Largest gains | Honduras (HND) | 0.00077785 |
| Largest losses | Moldova (MDA) | -0.00073395 |
| Largest losses | Brazil (BRA) | -0.00074498 |
| Largest losses | Pakistan (PAK) | -0.00089178 |
| Largest losses | Malaysia (MYS) | -0.00099213 |
| Largest losses | Algeria (DZA) | -0.00133919 |

## Countries moving GDP error

Positive contribution reduces aggregate MAE; negative contribution makes it worse. Each endpoint contribution divides the country's absolute-error improvement by the common observed endpoint count. Pooled contributions use the common observed country-year count. Each list shows both tails; the complete country table is in scores.json.

### 2025 endpoint contributors

| Tail | Country | Contribution to MAE improvement |
| --- | --- | --- |
| Largest gains | Romania (ROU) | 0.05136449 |
| Largest gains | China (CHN) | 0.05039748 |
| Largest gains | Bangladesh (BGD) | 0.04902987 |
| Largest gains | Moldova (MDA) | 0.04804652 |
| Largest gains | India (IND) | 0.04779386 |
| Largest losses | Finland (FIN) | -0.01806169 |
| Largest losses | Bolivia (BOL) | -0.01877225 |
| Largest losses | Ukraine (UKR) | -0.02642920 |
| Largest losses | Sri Lanka (LKA) | -0.02949086 |
| Largest losses | Myanmar (MMR) | -0.04283398 |

### Pooled years contributors

| Tail | Country | Contribution to MAE improvement |
| --- | --- | --- |
| Largest gains | China (CHN) | 0.03418770 |
| Largest gains | Bangladesh (BGD) | 0.03326455 |
| Largest gains | Romania (ROU) | 0.03213681 |
| Largest gains | Ethiopia (ETH) | 0.03179915 |
| Largest gains | Vietnam (VNM) | 0.03153361 |
| Largest losses | Ukraine (UKR) | -0.00961680 |
| Largest losses | Bolivia (BOL) | -0.01251811 |
| Largest losses | Lebanon (LBN) | -0.01274943 |
| Largest losses | Sri Lanka (LKA) | -0.02004802 |
| Largest losses | Myanmar (MMR) | -0.02608186 |

## Reproduction and integrity

The model recipe, internal validation, calibration and 700 forecast rows remain in `data/evaluation/research-ensemble-2018-v1/`. The existing pending-external note is preserved as the freeze-era record; this result report supersedes its status. `score-receipt.json` and `scoring-manifest.json` bind inputs, implementation and the single score. `family-artifacts-20260916.test.ts` verifies those hashes without fitting or rescoring. To inspect the recorded results, run `cat data/evaluation/research-ensemble-2018-v1/scores.json`; do not invoke the one-shot scorer again.

`npm run check` passed locally on this branch before scoring. Final PR CI will independently execute the complete checks including the added artifact integrity tests. The old holdout is byte-identical to base, and no pre-existing tracked file was modified.

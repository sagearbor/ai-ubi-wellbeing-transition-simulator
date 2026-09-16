# Shrunk country trends — sealed external result

Entry `research-damped-2018-v1`. Base `0ca2eda`. Protocol `7d40306fdf677d756042e75ca2fa56afc839c5fe`; numerical freeze `130bc0e66ecbff50457baf114a9a20540c37a940`. Scoring commit `3eb6382360d8db8dfecb5f5fa81cd1d90f635c73`; receipt completed `2026-09-16T21: 24: 43.980Z`.

These are exploratory retrospective comparisons from one declared family of five. All five forecasts froze before any new test scoring. All five results are published, including essentially null gains. No parameter, input, country, horizon or model was changed after scoring. Selection of a winner now requires new confirmation; it is not an independent validation sample. No default or application behavior changed.

**Target-definition correction discovered after scoring:** the pinned OWID happiness indicator is a trailing three-year survey average, dated by its final year. It is not a single-year survey score. Adjacent windows overlap, including early origin/test windows; the 2025 endpoint covers 2023–2025, separate from the 2016–2018 origin window. Frozen protocols remain unchanged as the audit record. [Provider definition](https://ourworldindata.org/grapher/happiness-cantril-ladder).

Skill = 1 − model MAE / persistence MAE; positive means lower error. MAE is mean absolute error. Missing outcomes are excluded identically from both methods, never replaced with predictions or zero. Countries receive equal weight; pooled results weight observed country-year cells, not population. Origin-income quartiles use frozen 2018 GDP, with 25 countries in each group before outcome missingness. GDP errors are cumulative growth percentage points relative to origin GDP, **not** percent errors relative to realized GDP.

## Wellbeing result — ladder points

| Scope | Observed / expected | Model MAE | Persistence MAE | Skill |
| --- | --- | --- | --- | --- |
| 2025 endpoint | 97 / 100 | 0.386806 | 0.389000 | +0.56% |
| Pooled available years | 681 / 700 | 0.286360 | 0.289744 | +1.17% |

| Window ending / year | Observed / expected | Model MAE | Persistence MAE | Skill |
| --- | --- | --- | --- | --- |
| 2019 | 99 / 100 | 0.112140 | 0.122147 | +8.19% |
| 2020 | 98 / 100 | 0.193250 | 0.202133 | +4.39% |
| 2021 | 97 / 100 | 0.293218 | 0.301773 | +2.83% |
| 2022 | 96 / 100 | 0.313783 | 0.317573 | +1.19% |
| 2023 | 97 / 100 | 0.338104 | 0.335619 | -0.74% |
| 2024 | 97 / 100 | 0.372054 | 0.364608 | -2.04% |
| 2025 | 97 / 100 | 0.386806 | 0.389000 | +0.56% |

| Origin income quartile | 2025 observed | 2025 model MAE | 2025 persistence MAE | 2025 skill | Pooled skill |
| --- | --- | --- | --- | --- | --- |
| origin-income-Q1 | 23 | 0.408300 | 0.389783 | -4.75% | -8.54% |
| origin-income-Q2 | 24 | 0.488203 | 0.547417 | +10.82% | +10.09% |
| origin-income-Q3 | 25 | 0.425555 | 0.445000 | +4.37% | +7.07% |
| origin-income-Q4 | 25 | 0.230941 | 0.180200 | -28.16% | -16.15% |

## GDP result — cumulative growth error percentage points

| Scope | Observed / expected | Model MAE | Persistence MAE | Skill |
| --- | --- | --- | --- | --- |
| 2025 endpoint | 97 / 100 | 9.496954 | 15.629918 | +39.24% |
| Pooled available years | 691 / 700 | 6.923902 | 8.649982 | +19.95% |

| Window ending / year | Observed / expected | Model MAE | Persistence MAE | Skill |
| --- | --- | --- | --- | --- |
| 2019 | 99 / 100 | 1.493169 | 2.628829 | +43.20% |
| 2020 | 99 / 100 | 8.559069 | 5.109767 | -67.50% |
| 2021 | 99 / 100 | 6.132437 | 5.912207 | -3.73% |
| 2022 | 99 / 100 | 6.527320 | 8.303168 | +21.39% |
| 2023 | 99 / 100 | 7.463114 | 10.190963 | +26.77% |
| 2024 | 99 / 100 | 8.847232 | 12.916027 | +31.50% |
| 2025 | 97 / 100 | 9.496954 | 15.629918 | +39.24% |

| Origin income quartile | 2025 observed | 2025 model MAE | 2025 persistence MAE | 2025 skill | Pooled skill |
| --- | --- | --- | --- | --- | --- |
| origin-income-Q1 | 24 | 13.337554 | 20.809815 | +35.91% | +17.40% |
| origin-income-Q2 | 25 | 8.126263 | 17.723692 | +54.15% | +30.89% |
| origin-income-Q3 | 24 | 7.571984 | 15.478511 | +51.08% | +30.13% |
| origin-income-Q4 | 24 | 9.009126 | 8.420414 | -6.99% | -13.02% |

## Interpretation

The small aggregate gain does not establish a practically reliable advantage or statistical significance. Training-window model selection remains optimistic.

The frozen origin is 100 countries; 28 of the original 128 roster were excluded by the original protocol. Ladder has 681 observed and 19 missing cells; GDP has 691 observed and 9 missing cells. Both have97 observed countries at 2025. Full row-specific missingness and the 28 origin exclusions remain in the score artifact.

## Countries moving wellbeing error

Positive contribution reduces aggregate MAE; negative contribution makes it worse. Each endpoint contribution divides the country's absolute-error improvement by the common observed endpoint count. Pooled contributions use the common observed country-year count. Each list shows both tails; the complete country table is in scores.json.

### 2025 endpoint contributors

| Tail | Country | Contribution to MAE improvement |
| --- | --- | --- |
| Largest gains | Bulgaria (BGR) | 0.00447014 |
| Largest gains | Portugal (PRT) | 0.00336863 |
| Largest gains | Romania (ROU) | 0.00307696 |
| Largest gains | Mongolia (MNG) | 0.00235674 |
| Largest gains | Serbia (SRB) | 0.00231926 |
| Largest losses | Malaysia (MYS) | -0.00263591 |
| Largest losses | Argentina (ARG) | -0.00286892 |
| Largest losses | Pakistan (PAK) | -0.00310955 |
| Largest losses | Brazil (BRA) | -0.00330724 |
| Largest losses | Algeria (DZA) | -0.00630055 |

### Pooled years contributors

| Tail | Country | Contribution to MAE improvement |
| --- | --- | --- |
| Largest gains | Bulgaria (BGR) | 0.00303640 |
| Largest gains | Portugal (PRT) | 0.00233075 |
| Largest gains | Romania (ROU) | 0.00187111 |
| Largest gains | Mongolia (MNG) | 0.00163063 |
| Largest gains | Serbia (SRB) | 0.00160470 |
| Largest losses | Nigeria (NGA) | -0.00157087 |
| Largest losses | Brazil (BRA) | -0.00167154 |
| Largest losses | Malaysia (MYS) | -0.00182378 |
| Largest losses | Pakistan (PAK) | -0.00203314 |
| Largest losses | Algeria (DZA) | -0.00282611 |

## Countries moving GDP error

Positive contribution reduces aggregate MAE; negative contribution makes it worse. Each endpoint contribution divides the country's absolute-error improvement by the common observed endpoint count. Pooled contributions use the common observed country-year count. Each list shows both tails; the complete country table is in scores.json.

### 2025 endpoint contributors

| Tail | Country | Contribution to MAE improvement |
| --- | --- | --- |
| Largest gains | China (CHN) | 0.32971361 |
| Largest gains | Bangladesh (BGD) | 0.32269186 |
| Largest gains | India (IND) | 0.31636942 |
| Largest gains | Ethiopia (ETH) | 0.31160567 |
| Largest gains | Vietnam (VNM) | 0.30960466 |
| Largest losses | Bolivia (BOL) | -0.17422132 |
| Largest losses | Estonia (EST) | -0.20630181 |
| Largest losses | Ukraine (UKR) | -0.21056791 |
| Largest losses | Sri Lanka (LKA) | -0.22533058 |
| Largest losses | Myanmar (MMR) | -0.29122253 |

### Pooled years contributors

| Tail | Country | Contribution to MAE improvement |
| --- | --- | --- |
| Largest gains | China (CHN) | 0.17927996 |
| Largest gains | Bangladesh (BGD) | 0.17781229 |
| Largest gains | Vietnam (VNM) | 0.16431037 |
| Largest gains | Ireland (IRL) | 0.15793520 |
| Largest gains | Ethiopia (ETH) | 0.15786846 |
| Largest losses | Finland (FIN) | -0.08497107 |
| Largest losses | Ukraine (UKR) | -0.09248921 |
| Largest losses | Bolivia (BOL) | -0.09736382 |
| Largest losses | Sri Lanka (LKA) | -0.12550956 |
| Largest losses | Myanmar (MMR) | -0.14988986 |

## Reproduction and integrity

The model recipe, internal validation, calibration and 700 forecast rows remain in `data/evaluation/research-damped-2018-v1/`. The existing pending-external note is preserved as the freeze-era record; this result report supersedes its status. `score-receipt.json` and `scoring-manifest.json` bind inputs, implementation and the single score. `family-artifacts-20260916.test.ts` verifies those hashes without fitting or rescoring. To inspect the recorded results, run `cat data/evaluation/research-damped-2018-v1/scores.json`; do not invoke the one-shot scorer again.

`npm run check` passed locally on this branch before scoring. Final PR CI will independently execute the complete checks including the added artifact integrity tests. The old holdout is byte-identical to base, and no pre-existing tracked file was modified.

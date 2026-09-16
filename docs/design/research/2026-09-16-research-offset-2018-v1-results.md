# Retained country offsets + income change — sealed external result

Entry `research-offset-2018-v1`. Base `0ca2eda`. Protocol `e8e6e72700ba32576269901885f27c7dab7574c9`; numerical freeze `5baaca179bc8921c2ca2896d2999cb1e348ca6be`. Scoring commit `b576fec2ff3ee15488c36ed38176334aefb4d64c`; receipt completed `2026-09-16T21: 24: 43.966Z`.

These are exploratory retrospective comparisons from one declared family of five. All five forecasts froze before any new test scoring. All five results are published, including essentially null gains. No parameter, input, country, horizon or model was changed after scoring. Selection of a winner now requires new confirmation; it is not an independent validation sample. No default or application behavior changed.

**Target-definition correction discovered after scoring:** the pinned OWID happiness indicator is a trailing three-year survey average, dated by its final year. It is not a single-year survey score. Adjacent windows overlap, including early origin/test windows; the 2025 endpoint covers 2023–2025, separate from the 2016–2018 origin window. Frozen protocols remain unchanged as the audit record. [Provider definition](https://ourworldindata.org/grapher/happiness-cantril-ladder).

Skill = 1 − model MAE / persistence MAE; positive means lower error. MAE is mean absolute error. Missing outcomes are excluded identically from both methods, never replaced with predictions or zero. Countries receive equal weight; pooled results weight observed country-year cells, not population. Origin-income quartiles use frozen 2018 GDP, with 25 countries in each group before outcome missingness. GDP errors are cumulative growth percentage points relative to origin GDP, **not** percent errors relative to realized GDP.

## Wellbeing result — ladder points

| Scope | Observed / expected | Model MAE | Persistence MAE | Skill |
| --- | --- | --- | --- | --- |
| 2025 endpoint | 97 / 100 | 0.351319 | 0.389000 | +9.69% |
| Pooled available years | 681 / 700 | 0.272122 | 0.289744 | +6.08% |

| Window ending / year | Observed / expected | Model MAE | Persistence MAE | Skill |
| --- | --- | --- | --- | --- |
| 2019 | 99 / 100 | 0.114832 | 0.122147 | +5.99% |
| 2020 | 98 / 100 | 0.188946 | 0.202133 | +6.52% |
| 2021 | 97 / 100 | 0.287967 | 0.301773 | +4.58% |
| 2022 | 96 / 100 | 0.309441 | 0.317573 | +2.56% |
| 2023 | 97 / 100 | 0.319709 | 0.335619 | +4.74% |
| 2024 | 97 / 100 | 0.337125 | 0.364608 | +7.54% |
| 2025 | 97 / 100 | 0.351319 | 0.389000 | +9.69% |

| Origin income quartile | 2025 observed | 2025 model MAE | 2025 persistence MAE | 2025 skill | Pooled skill |
| --- | --- | --- | --- | --- | --- |
| origin-income-Q1 | 23 | 0.367663 | 0.389783 | +5.67% | +2.05% |
| origin-income-Q2 | 24 | 0.445462 | 0.547417 | +18.62% | +12.32% |
| origin-income-Q3 | 25 | 0.361217 | 0.445000 | +18.83% | +11.39% |
| origin-income-Q4 | 25 | 0.236006 | 0.180200 | -30.97% | -14.95% |

## GDP result — cumulative growth error percentage points

| Scope | Observed / expected | Model MAE | Persistence MAE | Skill |
| --- | --- | --- | --- | --- |
| 2025 endpoint | 97 / 100 | 8.727932 | 15.629918 | +44.16% |
| Pooled available years | 691 / 700 | 6.443659 | 8.649982 | +25.51% |

| Window ending / year | Observed / expected | Model MAE | Persistence MAE | Skill |
| --- | --- | --- | --- | --- |
| 2019 | 99 / 100 | 1.475737 | 2.628829 | +43.86% |
| 2020 | 99 / 100 | 8.395072 | 5.109767 | -64.29% |
| 2021 | 99 / 100 | 5.763046 | 5.912207 | +2.52% |
| 2022 | 99 / 100 | 5.992923 | 8.303168 | +27.82% |
| 2023 | 99 / 100 | 6.732629 | 10.190963 | +33.94% |
| 2024 | 99 / 100 | 8.064419 | 12.916027 | +37.56% |
| 2025 | 97 / 100 | 8.727932 | 15.629918 | +44.16% |

| Origin income quartile | 2025 observed | 2025 model MAE | 2025 persistence MAE | 2025 skill | Pooled skill |
| --- | --- | --- | --- | --- | --- |
| origin-income-Q1 | 24 | 12.961289 | 20.809815 | +37.72% | +21.79% |
| origin-income-Q2 | 25 | 9.049272 | 17.723692 | +48.94% | +29.88% |
| origin-income-Q3 | 24 | 6.489369 | 15.478511 | +58.07% | +36.54% |
| origin-income-Q4 | 24 | 6.398410 | 8.420414 | +24.01% | +5.39% |

## Interpretation

The aggregate winner loses against persistence in the highest-income quartile: endpoint skill -30.97%. Do not qualify a universal default from the aggregate gain.

With selected full residual retention and adjustment 1, the forecast simplifies to origin ladder plus fitted within-country log-income change. Cross-sectional governance and intercept cancel; the test does not establish their policy effects.

The frozen origin is 100 countries; 28 of the original 128 roster were excluded by the original protocol. Ladder has 681 observed and 19 missing cells; GDP has 691 observed and 9 missing cells. Both have97 observed countries at 2025. Full row-specific missingness and the 28 origin exclusions remain in the score artifact.

## Countries moving wellbeing error

Positive contribution reduces aggregate MAE; negative contribution makes it worse. Each endpoint contribution divides the country's absolute-error improvement by the common observed endpoint count. Pooled contributions use the common observed country-year count. Each list shows both tails; the complete country table is in scores.json.

### 2025 endpoint contributors

| Tail | Country | Contribution to MAE improvement |
| --- | --- | --- |
| Largest gains | China (CHN) | 0.00210976 |
| Largest gains | Romania (ROU) | 0.00207503 |
| Largest gains | India (IND) | 0.00204376 |
| Largest gains | Moldova (MDA) | 0.00204076 |
| Largest gains | Vietnam (VNM) | 0.00199951 |
| Largest losses | Ireland (IRL) | -0.00178488 |
| Largest losses | Malta (MLT) | -0.00181883 |
| Largest losses | Myanmar (MMR) | -0.00188994 |
| Largest losses | Ethiopia (ETH) | -0.00198630 |
| Largest losses | Bangladesh (BGD) | -0.00208028 |

### Pooled years contributors

| Tail | Country | Contribution to MAE improvement |
| --- | --- | --- |
| Largest gains | Romania (ROU) | 0.00129597 |
| Largest gains | Moldova (MDA) | 0.00128411 |
| Largest gains | Vietnam (VNM) | 0.00125816 |
| Largest gains | China (CHN) | 0.00121232 |
| Largest gains | Nepal (NPL) | 0.00119004 |
| Largest losses | Myanmar (MMR) | -0.00086028 |
| Largest losses | Turkey (TUR) | -0.00091841 |
| Largest losses | Pakistan (PAK) | -0.00093886 |
| Largest losses | Malta (MLT) | -0.00104515 |
| Largest losses | Ethiopia (ETH) | -0.00124984 |

## Countries moving GDP error

Positive contribution reduces aggregate MAE; negative contribution makes it worse. Each endpoint contribution divides the country's absolute-error improvement by the common observed endpoint count. Pooled contributions use the common observed country-year count. Each list shows both tails; the complete country table is in scores.json.

### 2025 endpoint contributors

| Tail | Country | Contribution to MAE improvement |
| --- | --- | --- |
| Largest gains | China (CHN) | 0.25717594 |
| Largest gains | Bangladesh (BGD) | 0.25317350 |
| Largest gains | India (IND) | 0.24823374 |
| Largest gains | Vietnam (VNM) | 0.24227256 |
| Largest gains | Ethiopia (ETH) | 0.24049738 |
| Largest losses | Bolivia (BOL) | -0.13579024 |
| Largest losses | Estonia (EST) | -0.14885145 |
| Largest losses | Ukraine (UKR) | -0.16671085 |
| Largest losses | Sri Lanka (LKA) | -0.17144842 |
| Largest losses | Myanmar (MMR) | -0.22763103 |

### Pooled years contributors

| Tail | Country | Contribution to MAE improvement |
| --- | --- | --- |
| Largest gains | China (CHN) | 0.15339659 |
| Largest gains | Bangladesh (BGD) | 0.15261505 |
| Largest gains | Ethiopia (ETH) | 0.14516218 |
| Largest gains | Vietnam (VNM) | 0.14209557 |
| Largest gains | Ireland (IRL) | 0.12833640 |
| Largest losses | Iraq (IRQ) | -0.07591632 |
| Largest losses | Ukraine (UKR) | -0.07625311 |
| Largest losses | Bolivia (BOL) | -0.08262555 |
| Largest losses | Sri Lanka (LKA) | -0.10424057 |
| Largest losses | Myanmar (MMR) | -0.12629610 |

## Reproduction and integrity

The model recipe, internal validation, calibration and 700 forecast rows remain in `data/evaluation/research-offset-2018-v1/`. The existing pending-external note is preserved as the freeze-era record; this result report supersedes its status. `score-receipt.json` and `scoring-manifest.json` bind inputs, implementation and the single score. `family-artifacts-20260916.test.ts` verifies those hashes without fitting or rescoring. To inspect the recorded results, run `cat data/evaluation/research-offset-2018-v1/scores.json`; do not invoke the one-shot scorer again.

`npm run check` passed locally on this branch before scoring. Final PR CI will independently execute the complete checks including the added artifact integrity tests. The old holdout is byte-identical to base, and no pre-existing tracked file was modified.

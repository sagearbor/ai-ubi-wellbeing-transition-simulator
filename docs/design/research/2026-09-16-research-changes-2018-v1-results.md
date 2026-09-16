# Strongly regularized change regression — sealed external result

Entry `research-changes-2018-v1`. Base `0ca2eda`. Protocol `dcf05639d28fbe497d18956f138dd96981a60aa8`; numerical freeze `e437ec74361856f63da5d7d1846c3f1725dd2f63`. Scoring commit `1f96c4995eafec40b2c923fc8b0f6a085f29ac72`; receipt completed `2026-09-16T21: 24: 43.946Z`.

These are exploratory retrospective comparisons from one declared family of five. All five forecasts froze before any new test scoring. All five results are published, including essentially null gains. No parameter, input, country, horizon or model was changed after scoring. Selection of a winner now requires new confirmation; it is not an independent validation sample. No default or application behavior changed.

**Target-definition correction discovered after scoring:** the pinned OWID happiness indicator is a trailing three-year survey average, dated by its final year. It is not a single-year survey score. Adjacent windows overlap, including early origin/test windows; the 2025 endpoint covers 2023–2025, separate from the 2016–2018 origin window. Frozen protocols remain unchanged as the audit record. [Provider definition](https://ourworldindata.org/grapher/happiness-cantril-ladder).

Skill = 1 − model MAE / persistence MAE; positive means lower error. MAE is mean absolute error. Missing outcomes are excluded identically from both methods, never replaced with predictions or zero. Countries receive equal weight; pooled results weight observed country-year cells, not population. Origin-income quartiles use frozen 2018 GDP, with 25 countries in each group before outcome missingness. GDP errors are cumulative growth percentage points relative to origin GDP, **not** percent errors relative to realized GDP.

## Wellbeing result — ladder points

| Scope | Observed / expected | Model MAE | Persistence MAE | Skill |
| --- | --- | --- | --- | --- |
| 2025 endpoint | 97 / 100 | 0.388945 | 0.389000 | +0.01% |
| Pooled available years | 681 / 700 | 0.289585 | 0.289744 | +0.05% |

| Window ending / year | Observed / expected | Model MAE | Persistence MAE | Skill |
| --- | --- | --- | --- | --- |
| 2019 | 99 / 100 | 0.122053 | 0.122147 | +0.08% |
| 2020 | 98 / 100 | 0.201929 | 0.202133 | +0.10% |
| 2021 | 97 / 100 | 0.301486 | 0.301773 | +0.10% |
| 2022 | 96 / 100 | 0.317310 | 0.317573 | +0.08% |
| 2023 | 97 / 100 | 0.335491 | 0.335619 | +0.04% |
| 2024 | 97 / 100 | 0.364523 | 0.364608 | +0.02% |
| 2025 | 97 / 100 | 0.388945 | 0.389000 | +0.01% |

| Origin income quartile | 2025 observed | 2025 model MAE | 2025 persistence MAE | 2025 skill | Pooled skill |
| --- | --- | --- | --- | --- | --- |
| origin-income-Q1 | 23 | 0.389749 | 0.389783 | +0.01% | +0.01% |
| origin-income-Q2 | 24 | 0.547011 | 0.547417 | +0.07% | +0.08% |
| origin-income-Q3 | 25 | 0.443867 | 0.445000 | +0.25% | +0.19% |
| origin-income-Q4 | 25 | 0.181542 | 0.180200 | -0.74% | -0.26% |

## GDP result — cumulative growth error percentage points

| Scope | Observed / expected | Model MAE | Persistence MAE | Skill |
| --- | --- | --- | --- | --- |
| 2025 endpoint | 97 / 100 | 9.839553 | 15.629918 | +37.05% |
| Pooled available years | 691 / 700 | 7.027677 | 8.649982 | +18.76% |

| Window ending / year | Observed / expected | Model MAE | Persistence MAE | Skill |
| --- | --- | --- | --- | --- |
| 2019 | 99 / 100 | 1.394471 | 2.628829 | +46.95% |
| 2020 | 99 / 100 | 8.609350 | 5.109767 | -68.49% |
| 2021 | 99 / 100 | 6.166665 | 5.912207 | -4.30% |
| 2022 | 99 / 100 | 6.555079 | 8.303168 | +21.05% |
| 2023 | 99 / 100 | 7.609382 | 10.190963 | +25.33% |
| 2024 | 99 / 100 | 9.076044 | 12.916027 | +29.73% |
| 2025 | 97 / 100 | 9.839553 | 15.629918 | +37.05% |

| Origin income quartile | 2025 observed | 2025 model MAE | 2025 persistence MAE | 2025 skill | Pooled skill |
| --- | --- | --- | --- | --- | --- |
| origin-income-Q1 | 24 | 13.746766 | 20.809815 | +33.94% | +15.23% |
| origin-income-Q2 | 25 | 7.928286 | 17.723692 | +55.27% | +32.14% |
| origin-income-Q3 | 24 | 8.312437 | 15.478511 | +46.30% | +27.18% |
| origin-income-Q4 | 24 | 9.450360 | 8.420414 | -12.23% | -13.69% |

## Interpretation

The endpoint improvement is 0.00005477 ladder points: effectively a tie for practical purposes, not a meaningful predictive breakthrough. The internal procedure chose strong shrinkage (lambda 100); that near-persistence result is retained.

The frozen origin is 100 countries; 28 of the original 128 roster were excluded by the original protocol. Ladder has 681 observed and 19 missing cells; GDP has 691 observed and 9 missing cells. Both have97 observed countries at 2025. Full row-specific missingness and the 28 origin exclusions remain in the score artifact.

## Countries moving wellbeing error

Positive contribution reduces aggregate MAE; negative contribution makes it worse. Each endpoint contribution divides the country's absolute-error improvement by the common observed endpoint count. Pooled contributions use the common observed country-year count. Each list shows both tails; the complete country table is in scores.json.

### 2025 endpoint contributors

| Tail | Country | Contribution to MAE improvement |
| --- | --- | --- |
| Largest gains | Iceland (ISL) | 0.00004052 |
| Largest gains | Cyprus (CYP) | 0.00003762 |
| Largest gains | Slovenia (SVN) | 0.00003485 |
| Largest gains | Estonia (EST) | 0.00003467 |
| Largest gains | Poland (POL) | 0.00003346 |
| Largest losses | Malta (MLT) | -0.00003993 |
| Largest losses | Denmark (DNK) | -0.00004036 |
| Largest losses | Finland (FIN) | -0.00004120 |
| Largest losses | Ireland (IRL) | -0.00004819 |
| Largest losses | Yemen (YEM) | -0.00006240 |

### Pooled years contributors

| Tail | Country | Contribution to MAE improvement |
| --- | --- | --- |
| Largest gains | Iceland (ISL) | 0.00002302 |
| Largest gains | Slovenia (SVN) | 0.00001977 |
| Largest gains | Estonia (EST) | 0.00001967 |
| Largest gains | Lithuania (LTU) | 0.00001851 |
| Largest gains | Latvia (LVA) | 0.00001618 |
| Largest losses | Australia (AUS) | -0.00001762 |
| Largest losses | Malta (MLT) | -0.00002105 |
| Largest losses | Norway (NOR) | -0.00002144 |
| Largest losses | Netherlands (NLD) | -0.00002178 |
| Largest losses | Yemen (YEM) | -0.00003040 |

## Countries moving GDP error

Positive contribution reduces aggregate MAE; negative contribution makes it worse. Each endpoint contribution divides the country's absolute-error improvement by the common observed endpoint count. Pooled contributions use the common observed country-year count. Each list shows both tails; the complete country table is in scores.json.

### 2025 endpoint contributors

| Tail | Country | Contribution to MAE improvement |
| --- | --- | --- |
| Largest gains | China (CHN) | 0.39388532 |
| Largest gains | Vietnam (VNM) | 0.36743629 |
| Largest gains | Bangladesh (BGD) | 0.34996593 |
| Largest gains | Albania (ALB) | 0.33888924 |
| Largest gains | Ethiopia (ETH) | 0.33486518 |
| Largest losses | Bolivia (BOL) | -0.18399139 |
| Largest losses | Estonia (EST) | -0.23279743 |
| Largest losses | Ukraine (UKR) | -0.23625152 |
| Largest losses | Sri Lanka (LKA) | -0.24433220 |
| Largest losses | Myanmar (MMR) | -0.34163524 |

### Pooled years contributors

| Tail | Country | Contribution to MAE improvement |
| --- | --- | --- |
| Largest gains | China (CHN) | 0.20581468 |
| Largest gains | Bangladesh (BGD) | 0.20213786 |
| Largest gains | Vietnam (VNM) | 0.18156781 |
| Largest gains | Ireland (IRL) | 0.16965875 |
| Largest gains | Tajikistan (TJK) | 0.16264231 |
| Largest losses | Iraq (IRQ) | -0.09398891 |
| Largest losses | Bolivia (BOL) | -0.10063210 |
| Largest losses | Ukraine (UKR) | -0.10336810 |
| Largest losses | Sri Lanka (LKA) | -0.13302842 |
| Largest losses | Myanmar (MMR) | -0.17191724 |

## Reproduction and integrity

The model recipe, internal validation, calibration and 700 forecast rows remain in `data/evaluation/research-changes-2018-v1/`. The existing pending-external note is preserved as the freeze-era record; this result report supersedes its status. `score-receipt.json` and `scoring-manifest.json` bind inputs, implementation and the single score. `family-artifacts-20260916.test.ts` verifies those hashes without fitting or rescoring. To inspect the recorded results, run `cat data/evaluation/research-changes-2018-v1/scores.json`; do not invoke the one-shot scorer again.

`npm run check` passed locally on this branch before scoring. Final PR CI will independently execute the complete checks including the added artifact integrity tests. The old holdout is byte-identical to base, and no pre-existing tracked file was modified.

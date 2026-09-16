# Five frozen approaches — complete comparison

These are exploratory retrospective comparisons from one declared family of five. All five forecasts froze before any new test scoring. All five results are published, including essentially null gains. No parameter, input, country, horizon or model was changed after scoring. Selection of a winner now requires new confirmation; it is not an independent validation sample. No default or application behavior changed.

**Target-definition correction discovered after scoring:** the pinned OWID happiness indicator is a trailing three-year survey average, dated by its final year. It is not a single-year survey score. Adjacent windows overlap, including early origin/test windows; the 2025 endpoint covers 2023–2025, separate from the 2016–2018 origin window. Frozen protocols remain unchanged as the audit record. [Provider definition](https://ourworldindata.org/grapher/happiness-cantril-ladder).

Skill = 1 − model MAE / persistence MAE; positive means lower error. MAE is mean absolute error. Missing outcomes are excluded identically from both methods, never replaced with predictions or zero. Countries receive equal weight; pooled results weight observed country-year cells, not population. Origin-income quartiles use frozen 2018 GDP, with 25 countries in each group before outcome missingness. GDP errors are cumulative growth percentage points relative to origin GDP, **not** percent errors relative to realized GDP.

## All results, including negligible gains

| Approach | 2025 ladder MAE | 2025 skill | Pooled ladder MAE | Pooled skill | 2025 GDP skill | Pooled GDP skill |
| --- | --- | --- | --- | --- | --- | --- |
| Retained country offsets + income change | 0.351319 | +9.69% | 0.272122 | +6.08% | +44.16% | +25.51% |
| Shrunk country trends | 0.386806 | +0.56% | 0.286360 | +1.17% | +39.24% | +19.95% |
| Strongly regularized change regression | 0.388945 | +0.01% | 0.289585 | +0.05% | +37.05% | +18.76% |
| Income + life-expectancy changes | 0.362696 | +6.76% | 0.274834 | +5.15% | +40.74% | +31.45% |
| 75% persistence + 25% damped trend | 0.383189 | +1.49% | 0.285136 | +1.59% | +11.41% | +11.23% |

Persistence ladder MAE: 0.389000 at 2025 (97 observed countries), 0.289744 pooled (681 observed country-years). GDP persistence MAE: 15.629918 at 2025 (97 countries), 8.649982 pooled (691 country-years). The original 128-country roster yields 100 eligible origins and 28 exclusions.

## What this establishes

The country-offset approach is the strongest of these five on both registered wellbeing summaries, improving each of the seven horizons. It preserves country-specific starting differences and adds modest predicted-income changes. Its GDP endpoint error is also lower than persistence, but its 2020 GDP error is 64.3% higher. A pre-2019 trend did not forecast the pandemic shock. This is an honest gain on the frozen comparison, not proof of universal or causal accuracy.

**The aggregate winner is 31.0% worse than persistence in the richest origin-income quartile at 2025.** The health approach also loses there (10.5% worse). Neither should replace the default automatically. The health entry does not isolate the contribution of health; it changes the forecasting equation and GDP path too. Its negative life-expectancy coefficient must not be wired to a policy lever. The near-zero change-regression gain should be treated as practically negligible.

The separate 1980-origin experiment has no 2025 life-expectancy observations, so that primary target remains unscored. Secondary life-expectancy pooled MAE is 3.666440 years versus 6.487478 persistence (43.5% lower); its 2024 endpoint is 6.002504 versus 11.671736 years. GDP 2025 MAE is 143.457656 versus 161.691122 cumulative-growth percentage points (11.3% lower), still a very large error. Do not treat those secondary/proxy findings as ladder qualification.

## Next research, without reusing this test as a fresh holdout

1. Correct data labels in a separate implementation PR: display survey-window ending years and actual publication timing; leave frozen experiment records intact.
2. Obtain a licensed annual survey panel with a documented observation process and more pre-origin history. Pre-register an observation model for rolling averages if keeping the current target.
3. Design a new, explicitly exploratory temporal study of high-income failures and income-health interactions. Use stronger simple baselines and country-level uncertainty; do not silently tune and re-advertise this consumed test.
4. Reserve genuinely new outcomes or an independently governed untouched evaluation set for confirmation before default promotion.
5. Keep forecasting and causal policy mechanisms separate. To assess a bill, support each mechanism with identified evidence and show sensitivity; forecast fit cannot establish that a bill causes its projected result.

## Review map

| Branch | Entry | Protocol commit | Numeric freeze |
| --- | --- | --- | --- |
| codex/research-offset-20260916 | research-offset-2018-v1 | e8e6e72700ba | 5baaca179bc8 |
| codex/research-damped-20260916 | research-damped-2018-v1 | 7d40306fdf67 | 130bc0e66ecb |
| codex/research-changes-20260916 | research-changes-2018-v1 | dcf05639d28f | e437ec743618 |
| codex/research-health-20260916 | research-health-2018-v1 | 6c6cdb2dbe63 | c0a39243de8a |
| codex/research-ensemble-20260916 | research-ensemble-2018-v1 | 2fee93728175 | 0c1fef8003f1 |
| codex/research-health-20260916 | research-objective-1980-v1 | 41fe91cbf847 | af07c67c3883 |

Each branch contains its own detailed `*-results.md` with all horizon errors, origin-income groups, both tails of country contributions, source bindings and a scored ledger entry. The health branch also holds the long objective entry. All five branch checks passed before scoring. Final CI includes a no-rescoring test of frozen hashes and receipts. No main merge, production deployment or default change is part of these PRs.

## GitHub review links

- [Offset — PR #24](https://github.com/sagearbor/ai-ubi-wellbeing-transition-simulator/pull/24)
- [Damped — PR #25](https://github.com/sagearbor/ai-ubi-wellbeing-transition-simulator/pull/25)
- [Changes — PR #26](https://github.com/sagearbor/ai-ubi-wellbeing-transition-simulator/pull/26)
- [Health — PR #27](https://github.com/sagearbor/ai-ubi-wellbeing-transition-simulator/pull/27)
- [Ensemble — PR #28](https://github.com/sagearbor/ai-ubi-wellbeing-transition-simulator/pull/28)

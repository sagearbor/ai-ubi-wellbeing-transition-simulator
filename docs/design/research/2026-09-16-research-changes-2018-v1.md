# Predicting changes with a small ridge regression

Entry `research-changes-2018-v1`, family `five-approaches-20260916`. This is a retrospective exploratory experiment by an automated agent, not independent human/domain-expert review. **External scoring is pending.** No 2019–2025 outcomes or other methods' predictions/results were read in developing or freezing this method.

The model uses changes in wellbeing instead of moving observed wellbeing toward a cross-sectional equilibrium. Internal validation selected the strongest of four registered penalties, leaving predictions very close to persistence. All four candidates were slightly worse than persistence on the pooled internal ladder metric. This is a negative internal finding, not evidence that a seven-year external forecast has already failed or succeeded.

## Registration and information boundary

The full `forecast-protocol/1` was committed as `dcf05639d28fbe497d18956f138dd96981a60aa8` before fitting, internal validation, or running training-data tests. There were no protocol amendments and no adaptive grid expansion. Model, protocol, source, and output hashes are in `data/evaluation/research-changes-2018-v1/provenance.json`. The protocol stores the entire 100-country origin roster and all 28 exclusions. The note and ledger travel with the final forecast freeze commit; the controller records its immutable identity before opening the collective scoring gate.

Only the existing `data/evaluation/level-holdout-2018/train.json` and `origin.json` supplied numerical observations. The training file has 101 background-eligible countries and 399 paired country-year observations from 2015–2018. It supplies 298 adjacent-year changes after removing five unavailable transitions: Laos 2016/2017, and Timor-Leste 2016/2017/2018. Missing years are not bridged. The original 2018 origin fixes the 100 forecast countries, producing 700 rows for 2019–2025. Timor-Leste's missing origin remains an original exclusion, not a new model exclusion.

The earlier published 0.3175 versus 0.2897 comparison is pooled country-year mean absolute error (MAE), not 2025 endpoint error. Its existence is prior information, so this new work is not blinded. Later data vintages revise historical observations, and year labels do not establish historical publication availability.

## Hypothesis and references

Within-country changes may be more relevant to forecasting changes than cross-sectional level relationships. Stevenson and Wolfers (2008) report associations between growth and changes in subjective wellbeing. This motivates testing the feature; it does not establish a causal effect or out-of-sample forecast performance. No literature coefficient was copied. [Primary research summary and paper](https://www.brookings.edu/articles/economic-growth-and-subjective-well-being-reassessing-the-easterlin-paradox/).

Ridge regression penalizes coefficient magnitude and can trade some estimation bias for reduced variance with correlated predictors. The small candidate grid reflects the very short time series; the original ridge result does not guarantee this forecast will improve. [Hoerl and Kennard, 1970](https://homepages.math.uic.edu/~lreyzin/papers/ridge.pdf).

Temporal validation fits all preprocessing and parameters on years before the forecast origin's targets, and evaluates genuine multistep forecasts. [Hyndman and Athanasopoulos, §5.10](https://otexts.com/fpp3/tscv.html). These sources informed methods only; no benchmark country outcomes were searched on the web.

## Equations and fixed choices

For country `i` and adjacent year `t`, the response is `L(i,t) − L(i,t−1)`. Four predictors are `log(G(i,t)/G(i,t−1))`, `log(G(i,t−1))`, frozen 2015 governance, and frozen 2010–2015 Gini divided by 100. Predictor means and population standard deviations use only the current training transition rows. Missing governance/inequality uses their training-row median, or 0.5 if the entire column is absent. Required GDP and ladder endpoints are never imputed. A zero standard deviation becomes 1.

With an intercept appended to the standardized predictors `Z`, coefficients minimize `mean((y − Zb)^2) + λ sum(b²)`. The intercept is deliberately penalized too, so large penalties shrink the entire annual increment toward zero. The only candidates are λ = 0.1, 1, 10, 100. There are no interactions, nonlinear variants, country intercepts, lagged-ladder effects, equilibrium targets, or post-trial feature searches.

GDP is forecast separately. Its annual log-growth rate is `(n_i × mean_i + 2 × pooled_mean)/(n_i + 2)`, using only adjacent past GDP observations. The two pooled pseudo-observations are fixed, not tuned. No country history uses the pooled mean; no GDP history anywhere uses zero growth. Rates are clamped to [−0.1, 0.1], then `GDP(h) = GDP(origin) × exp(h × rate)`. During validation, realized validation-year GDP is never a ladder covariate, including the second forecast step.

At each forecast step, the regression sees this predicted growth, the predicted starting log GDP, and frozen governance and inequality. Its predicted increment is added to the previous predicted ladder, starting at the observed origin. Ladder is clipped to [0, 10] each step; no other increment or horizon damping is applied. Clip and fallback events are recorded. There were zero final ladder clips, zero fitted GDP growth clips, zero final feature imputations, and zero origin-country GDP-history fallbacks.

## Internal validation results

The first fold fits 2015–2016 and forecasts 2017 and 2018 from 99 countries with paired 2016 outcomes: 198 scored ladder forecasts. The second fits 2015–2017 and forecasts 2018 from 100 countries: 100 forecasts. The two different-origin forecasts of 2018 both count. Normalizers, medians, GDP rates, and coefficients are refitted inside each fold. Country reuse is appropriate for this forecasting question but is not independent-country validation.

The selection metric is pooled ladder MAE across these 298 country/fold/horizon forecasts, with exact model/persistence masks. A tie within 1e−12 favors larger λ. This same internal evidence selects the penalty, so the selected error is tuning evidence, not an unbiased generalization estimate.

| Ridge penalty | Internal ladder MAE | Persistence MAE | Model minus persistence |
|---:|---:|---:|---:|
| 0.1 | 0.136869680 | 0.135298658 | +0.001571022 — worse |
| 1 | 0.135836376 | 0.135298658 | +0.000537718 — worse |
| 10 | 0.135359902 | 0.135298658 | +0.000061244 — worse |
| **100 — selected** | **0.135306884** | **0.135298658** | **+0.000008226 — worse** |

The 2016-origin fold slightly worsens ladder MAE at the selected penalty (0.146833003 versus 0.146808081); the 2017-origin fold slightly improves it (0.112485168 versus 0.112510000). These tiny differences cannot establish practical improvement. The grid boundary selection is retained exactly as registered; there is no expansion to stronger penalties or switch to a new method.

The independent GDP forecast has internal cumulative-growth MAE of 2.162598136 percentage points versus persistence's 4.150188005, across the same 298 observed GDP targets. Errors are `100 × (predicted GDP − actual GDP)/origin GDP`, which equal cumulative-growth errors relative to the origin. GDP settings were fixed before validation and were not selected using these errors.

The final standardized coefficients in feature order are:

| Term | Coefficient |
|---|---:|
| Penalized intercept | 0.00016343278623164343 |
| Annual log GDP change | 0.0002786377249883397 |
| Starting log GDP | 0.00007925643043719198 |
| Frozen governance | 0.00013797695756713954 |
| Frozen Gini fraction | −0.000044455531505788736 |

These are predictive coefficients, not causal effect estimates. Strong shrinkage makes the final ladder forecasts nearly persistence. The short history limits inference about trend reversals, shocks, serial dependence, and seven-year stability; no seven-year validation horizon exists inside this training window. No confidence intervals or independent significance claims are made.

## External results and publication gate

**Pending; no external score has been run by this agent.** The primary external comparison is 2025 endpoint ladder MAE against persistence, with pooled and every-horizon errors also reported. GDP cumulative-growth errors and frozen origin-income quartiles are secondary. Quartiles sort 2018 origin GDP then country ID, assigning `floor(index × 4 / 100)`; no future data determines grouping.

The controller must freeze all five approaches and the additional long-run proxy before invoking the external scorer once for each entry. Every success and failure must be published. No post-score refitting, candidate expansion, changed cohort, or relabeled primary metric is permitted. Comparing five methods and highlighting their best result remains exploratory.

## Reproduction and verification

From the repository root, with Node.js 22 and the existing dependencies:

```sh
node node_modules/vitest/vitest.mjs run scripts/evaluation/attempts/research-changes-2018-v1/model.test.ts
node scripts/evaluation/attempts/research-changes-2018-v1/run.mjs
```

The environment used `/private/tmp/history-node22/package/bin/node`. The runner checks the committed protocol, exact input hashes, training-year boundary, and fixed origin roster before fitting. Its only numerical file readers are the two allowlisted historical inputs; the pure model module has no I/O. Outputs are deterministic and retain the original `Prediction` row shape.

The targeted suite has 12 tests: a known linear system, penalized-intercept solution, strict 2016/2017 leakage perturbations, missing-feature imputation, missing-transition fallback, empty-history persistence, explicit clamps, independent GDP shrinkage and analytical ladder recurrence, boundary rejection, paired scoring masks, registered grid/tie behavior, and exactly 700 deterministic historical-input rows. Whole-repository checks are reserved for the controller after the scoring gate; none were used to inspect external outcomes here.

All changes are new entry-specific files. No production/default model, previous holdout artifact, configuration, dependency, source panel, or published target changed.

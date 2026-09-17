# Country-offset holdout entry (Claude Code attempt), 16 September 2026

Registered protocol: `data/evaluation/offset-2018/protocol.json` (`level-country-offset-2018-v1`),
committed and pushed **before** any scoring run. Artefacts: `fit.json`, `predictions-{fitted,retained}.json`,
`scores-{fitted,retained}.json`, `summary.json`. Tests: `scripts/evaluation/offset/offset.test.ts`.

## Hypothesis

The published entry (`level-holdout-2018`) relaxes every country toward a cross-sectional anchor at
0.02/month and keeps no country-specific offset, so about 82% of each country's distance from the
regression line closes over 84 months. Observed national ladder values move very little, so the model
walks countries away from where they stay and loses to persistence. Retaining the origin-year offset,
decayed at a rate estimated from training transitions, should recover the difference.

## What was fitted, and on what

Only one new scalar. The three anchor coefficients are **reused unchanged** from the frozen 2015–2018
fit. The offset decay `rho` is estimated from training gap transitions alone — `gap = ladder*10 −
anchor(gdp, governance)` for 2015–2018 — as a pooled least-squares fit of `gap(t+lag)` on
`rho^lag · gap(t)` for lags 1–3, combined as a pair-count-weighted geometric mean:

- lag 1: rho 0.9379 (293 pairs), lag 2: 0.9314 (196), lag 3: 0.9239 (99) → **rho = 0.93336**.

Stability across lags is the reason for trusting it rather than a single lag. No 2019–2025 observation
was read at any point before scoring.

## Internal validation (training window only, before registering)

Fitting on 2015–2016 and predicting 2017–2018 from a 2016 origin, using the modelled 2%/year GDP path:
`rho = 0` (the published form) scored skill **−2.05** against persistence; `rho ≈ 0.9–1.0` scored
between −0.01 and +0.02. That is what the registered form is based on: the offset, not the decay's
third decimal.

## Single scored run (2018 origin → 2019–2025), one run, no iteration

Pooled over all observed country-years (n = 681 wellbeing rows, identical mask and comparator as the
published entry):

| Entry | wellbeing MAE | persistence | skill | GDP MAE | persistence |
|---|---|---|---|---|---|
| Published `level-holdout-2018` | 0.3175 | 0.2897 | −0.096 | 7.511 | 8.650 |
| **This entry, fitted rho = 0.93336** | **0.2716** | 0.2897 | **+0.063** | 7.511 | 8.650 |
| This entry, rho = 1 (declared secondary) | 0.2816 | 0.2897 | +0.028 | 7.511 | 8.650 |

Wellbeing by horizon, fitted variant (model MAE vs persistence MAE, skill):

| Year | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|---|---|
| model | 0.119 | 0.187 | 0.273 | 0.281 | 0.316 | 0.350 | 0.380 |
| persistence | 0.122 | 0.202 | 0.302 | 0.318 | 0.336 | 0.365 | 0.389 |
| skill | +0.024 | +0.076 | +0.095 | +0.116 | +0.059 | +0.041 | +0.023 |

The fitted variant beats persistence at every horizon; the endpoint margin (0.380 vs 0.389) is the
smallest of the seven. Bias is −0.050 ladder points (slightly low). GDP predictions are byte-identical
to the published entry by construction, so the GDP numbers are not new evidence.

## What this does and does not establish

- It **does** show the published entry's loss came from discarding the country offset, not from the
  anchor itself, and that a one-parameter repair fitted on training data alone reverses the sign of the
  skill score on an untouched test period.
- It is **not** forecasting skill: the test period is past, the outcome vintages are current revisions,
  and the model form was chosen after seeing that period exist (`modelFormChosenAfterTestPeriod: true`).
- It is **not** causal evidence, and says nothing about AI displacement, transfers or wellbeing policy.
  Those channels are off in this evaluation.
- Margins are small in absolute terms: 0.018 ladder points pooled, 0.009 at the endpoint, on a 0–10
  scale. Both entries share one partition, so their errors are not independent.
- The published entry stands unchanged; nothing in `data/evaluation/level-holdout-2018/` was edited.

## Suggested next checks (not run here)

Longer horizons (origin 2006 → 2007–2025), multiple origins, and the objective-proxy series described
in `2026-09-16-next-holdout-attempt.md`. Wiring the offset into the app engine
(`simulation/pure.ts` anchored mode) is a separate, deliberate change with its own re-qualification,
and should follow only if the owner accepts this result.

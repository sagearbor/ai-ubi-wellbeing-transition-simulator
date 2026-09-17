# Independent comparison of saved forecast attempts

The rendered report is `docs/design/reviews/2026-09-16-independent-combination-review.html`.
Download the HTML from GitHub and open it locally; all styles, controls, and data are embedded.

## Evidence status

This is a **post-hoc descriptive comparison**, not another registered holdout run.
The finite catalog was recorded in commit `a2b1a01`, after the individual outcomes and
Claude's suggested pair were already known. It covers all 511 nonempty equal-weight
subsets of nine forecasts and 72 further 25/75 pairs. There are 583 distinct recipes,
not 583 independent tests or all possible real-valued weightings.

No original experiment, frozen scorer output, simulator equation, or default is edited.
The script reads saved forecasts and the original frozen observations, verifies hashes,
and writes only under `data/evaluation/comparison-20260916/`. It never invokes the
original one-shot scoring entry points. Repeating this descriptive analysis does not
produce fresh confirmation; selection on known outcomes remains post-hoc.

## Reproduce

Python 3 standard library, generated with Python 3.14.6:

```sh
python3 -m unittest discover -s scripts/evaluation/comparison-review -p 'test_*.py'
python3 scripts/evaluation/comparison-review/analyze.py
python3 scripts/evaluation/comparison-review/render.py
```

Other Python/platform versions may differ at floating-point roundoff. The archived
full-precision CSV/JSON is authoritative; the portable HTML embeds rounded display
values (9 decimal places). Its CSV button exports that display precision.

The analyzer checks all individual MAE/RMSE/bias and persistence MAE values against
the saved score sets within 1e-10. Predictions join by country/year, not file order.
GDP errors are percentage points of **origin** GDP. Missing target observations are
masked identically for every recipe and comparator. All blend weights average levels,
with the same weights on both outputs. Income quartiles use origin GDP only.

Country-block resampling keeps all years for a sampled country; it does not quantify
future macro shocks, data revisions, survey error, or the selection cost of searching.
The full outputs include country contributions for original forecasts, the offset pair,
and each scope/target winner, plus the signed-error correlation matrices.

The long objective experiment is separate. Its primary, pooled and 2024 summary values
were checked against archived scored rows; its raw observations were not re-fetched.

## Main findings

- #24 country offsets wins the registered 2025 ladder endpoint: 0.351319 MAE.
- Claude's fitted decay wins pooled ladder MAE by only 0.000516 points.
- The proposed 50/50 offset pair helps pooled error, but slightly worsens 2025 error
  versus #24. Its GDP result also worsens versus #24.
- Best endpoint ladder recipe in this catalog: 75% #24 + 25% Claude fitted decay,
  0.349455 MAE. Best pooled: 75% #24 + 25% original model, 0.260920 MAE.
- #24 loses to persistence by 31.0% in the richest origin-income quartile at the endpoint.
- Health's incremental wellbeing contribution is unisolated; its GDP forecast does not
  use health. No run here validates AI, health-policy, or transfer effects.

Do not promote a post-hoc winner to production without a separately protected evaluation.

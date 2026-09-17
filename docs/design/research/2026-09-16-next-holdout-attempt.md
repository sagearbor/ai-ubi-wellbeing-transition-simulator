# Next step: beat persistence honestly on wellbeing (two independent attempts)

Status at `main` (16 September 2026): the frozen temporal holdout
(`data/evaluation/level-holdout-2018/`) reports the level model **worse than persistence** on
wellbeing — mean absolute error **0.3175** ladder points against **0.2897** — and better than
persistence on GDP (7.51 vs 8.65 percentage points). That result stands, stays published, and must
not be refit, rescored or re-partitioned.

This document defines the next attempt and the rules that keep it honest. Two implementers (Claude
Code and GPT-6/Codex) work **in separate branches**, then their submissions are scored once.

## Why the current model loses

`scripts/evaluation/predict.ts` starts every country at its observed 2018 ladder value and relaxes it
at 0.02/month toward a **cross-sectional** anchor, `intercept + lnGdp·ln(GDP pc) + governance·gov`
(`simulation/pure.ts`, `wellbeingAnchor`). Over 84 months about 82% of the gap to that line is closed.
Country-specific offsets from the line are large and persistent (the anchor's own fit RMSE is ≈0.57
ladder points), so the model walks each country away from where it actually stays. Persistence wins
by doing nothing.

That diagnosis is a hypothesis about the loss, not a licence to adopt any particular repair.

## Rules (both implementers)

1. **Do not touch the 2018 holdout artefacts.** No change to `data/evaluation/level-holdout-2018/*`,
   its protocol, partition, scoring code or the published numbers. `npm run check` must stay green.
2. **Development data is 2015–2018 only** (the existing `train.json` partition and the same
   background vintages). You may hold out years or countries *inside* that window as often as you
   like. Any use of 2019–2025 outcomes before submission invalidates the entry.
3. **Register before you score.** Write `data/evaluation/<your-id>/protocol.json` in the existing
   `forecast-protocol/1` shape, committed **before** the scoring run, declaring: the model form, every
   fitted quantity, the fitting years, the origin year, the test years, the outcome definitions, the
   comparator (persistence) and the scoring rule. Reuse `scripts/evaluation/` code paths.
4. **One scored submission.** Run the 2018→2025 scoring once, commit predictions and scores, and stop.
   No "try again with a tweak" after seeing the score. If you want a second idea, register it as a
   separate entry *before* scoring the first.
5. **Report the miss if you miss.** A second published failure is a fine outcome and is more useful
   than a tuned win.
6. **No new claims.** Beating persistence on a retrospective reconstruction is not forecasting skill,
   not causal evidence, and says nothing about AI or UBI mechanisms. Keep the UI wording honest.

## What counts as the result

Primary: mean absolute error on the 2025 wellbeing endpoint across the same 106-country cohort,
against persistence on the same cohort. Also report, because a single endpoint number hides a lot:

- MAE at each horizon 2019…2025, not just the endpoint;
- skill score `1 − MAE_model / MAE_persistence`;
- the same numbers for GDP;
- error by country group (the 22 excluded countries stay excluded);
- a short note on which countries move the score most.

## Candidate directions (not prescriptions)

- **Country offset.** Keep each country's 2018 deviation from the anchor (fully, or decaying), so the
  model predicts *changes* rather than pulling everyone to a cross-sectional line.
- **Slower adjustment.** Fit the adjustment rate on 2015–2018 instead of assuming 0.02/month.
- **Predict the change directly.** Regress 2015→2018 ladder changes on GDP growth and levels, and
  apply that to the test period.
- **Shrinkage.** A weighted blend of persistence and anchor, with the weight fitted on training years.
- **Honest null.** If nothing beats persistence on 2015–2018 internal validation, say so and submit the
  best candidate anyway.

## Longer horizons: how far back can this go?

A 7-year test is short. Going further is limited by the outcome data, not by the engine.

- **Wellbeing (same instrument).** The WHR Cantril ladder panel begins with the Gallup World Poll in
  2005–2006. The longest defensible test with the same instrument is **origin 2006, test 2007–2025**
  (19 years, including the 2008 crisis and COVID), on the countries polled from the start (roughly
  70–90, fewer than the current 106). Fitting years would be 2006 only, or 2006–2008 with a later
  origin; state which, and keep the comparator persistence from the same origin.
- **Several origins.** Registering origins 2006, 2010 and 2014 against the same end year shows how
  error grows with horizon and is much harder to win by luck than one endpoint.
- **Before 2005.** No global ladder panel exists. Longer series use different instruments and scales:
  Eurobarometer life satisfaction (1973–, ~10 European countries, 4-point scale), the US General
  Social Survey happiness item (1972–, 3-point), World Values Survey waves (1981–, sparse), Japan's
  life-in-nation surveys (1958–). These can support a **separate** long-run test for a few countries;
  they must not be spliced into the ladder panel or scored against it.
- **GDP.** World Bank GDP per person reaches back to 1960, so a long-run **GDP-only** reconstruction
  (e.g. origin 1980) is feasible now and would test the macro path much harder than 2018–2025. Report
  it as its own entry; it says nothing about wellbeing skill.
- **Objective proxies reach much further back.** GDP per person, life expectancy, infant mortality,
  child survival and years of schooling exist from 1960 in the World Bank panel and from the 19th
  century in Maddison/Gapminder/Human Mortality Database reconstructions. They support genuinely long
  tests — origin 1960 or 1900 — of the macro and demographic parts of the model, and a composite
  objective index (HDI-style) can be scored as **its own declared target** with its own persistence
  baseline.
  **Caveat that must stay visible:** these are not the ladder. They correlate with it across countries
  at a point in time, but they move differently over decades — the Easterlin pattern is exactly that
  income can rise for generations while reported life satisfaction stays flat. So a proxy test can
  validate the income/health machinery, and it can never be reported as evidence that the model
  predicts wellbeing. Score it separately, label it separately, and never map a proxy result onto the
  ladder scale.
- **Vintages.** Older WHR/World Bank values have been revised repeatedly. Record the vintage actually
  used and do not present a revised series as what was knowable at the origin.

Recommended: whoever attempts this should register **both** the 2018 re-run and a 2006-origin entry,
so the short and long horizons are reported together.

## Deliverables per entry

- `data/evaluation/<id>/protocol.json` (committed first), plus predictions, scores and source
  provenance in the same shape as the 2018 entry.
- A short `docs/design/research/<date>-<id>.md`: the hypothesis, what was fitted, internal-validation
  results, the single scored result, and what it does not establish.
- A ledger entry recording the outcome, including a miss.
- A PR that does not modify the existing holdout or any published target.

## Comparison

The owner compares entries on the reported numbers above. Ties, or both entries losing to
persistence, are legitimate outcomes. The entry with the better endpoint MAE is not automatically
adopted: an entry that wins by adding many fitted quantities on four years of data should be treated
sceptically, and the horizon curve and skill score matter more than a third decimal place.

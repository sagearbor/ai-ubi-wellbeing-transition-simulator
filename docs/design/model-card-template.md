# Model card (template)

One page. Filled in for every model that is offered as a "Start from" option, and required before a
model is called the reviewed default (v3 plan, stage 3). Keep it honest and short; if a row cannot
be filled, write "not modelled" or "unknown", never leave it blank.

```
Model:            <id and name>            Version: <git commit or model file hash>
Maintainer:       <person>                 Reviewed: <date, by whom, or "unreviewed">
```

## Scope
- Geography and populations: <e.g. 128 countries as recipients; US only for labour detail>
- Dates and step: <2026 to 2045, monthly>
- Outcomes it can report: <list>
- Policy mechanisms it can represent: <list, with the parameter or hook each one maps to>
- Unsupported regions and outcomes: <stated, not estimated>

## Causal structure
- How each public lever reaches each outcome, in one line per lever.
- Important channels that are missing: <e.g. no demand feedback; no fiscal financing>
- External assumptions the results depend on: <e.g. AI adoption path is exogenous>

## Accounting
- Flows actually modelled (household, firm, public) and their units.
- Funding boundary: <who pays for every transfer; "not financed" if not modelled>
- Identities enforced: <e.g. money conservation test AT-6>

## Constraints and limits
| Limit | Kind (accounting / capacity / assumption / evidence boundary / numerical) | Equation or parameter | Provenance |
|---|---|---|---|

## Reviewed input region
- Parameter ranges within which results are reviewed, and joint restrictions.
- What happens outside the region: <marked extrapolation; not a claim>
- This region is a review boundary, not a probability distribution.

## Evidence
| Relationship | Kind (causal / associational / calibrated / elicited / assumed) | Population and dates it applies to | Source |
|---|---|---|---|

Count: <n> relationships, of which <k> are assumptions or guesses.

## Response review
- Small-nudge check (±1%, ±10% on each reviewed lever): <largest absolute response and where>
- Binding constraints found: <list>
- Threshold or regime-switch behaviour: <where, and whether it is a rule or an artefact>
- Solver failures or non-finite results encountered: <none / list>
- Unresolved discrepancies: <list>

## Evaluation
- Implementation checks: <tests and identities that pass>
- Reproduction (if this transcribes a published model): <which outputs match, tolerances, departures>
- Historical reconstruction: <what was fitted on which data; errors vs a persistence baseline>
- Policy-effect benchmarks: <cases, mapped how, discrepancy>
- Fitting history: <which parameters were tuned to which targets, and when>

## Known failures and open questions
- <one line each; a failure listed here is worth more than a pass hidden elsewhere>
```

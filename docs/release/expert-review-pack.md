# Expert review drafts — not sent

Use the verified beta URL and exact release/commit when available. Accompany each note with `docs/design/model-card-default.md`, `docs/design/reference-ledger.md`, the relevant equation note, and a small reproducible bundle. Do not attach confidential text or credentials. The public URL must first be checked to run the reviewed release.

## Korinek and co-authors

We are building an open-source simulator for comparing AI-transition assumptions and policies. It includes a port of your 2026 model, with equation and numerical reproduction notes in `docs/design/research/korinek-2026-model.md`. Could you inspect whether the timing, equilibrium conditions and calibration preserve your intended interpretation? Our separate wellbeing bridge is explicitly illustrative; we are not treating successful equation reproduction as evidence for that bridge. We would value one concrete discrepancy or missing mechanism to correct.

## Jones and Marinescu

Our Alaska PFD case separates income and spending mechanisms and records how the published employment result maps into the model. Could you assess whether `docs/design/research/alaska-pfd-case.md` represents the identified policy contrast honestly, especially what cannot be extrapolated to large nationwide transfers or an AI transition? We want to prevent a reproduced historical target from being mistaken for out-of-sample policy validation.

## Cash-transfer wellbeing researchers

Our cash-transfer notes distinguish source studies from assumed transport to other populations. Could you review the transfer-to-wellbeing functional form and identify which coefficient, income normalization or external-validity assumption is least defensible? The new historical test leaves policy channels off and does not validate them. Its wellbeing forecast also underperforms persistence; we preserve that result and welcome a better separately specified evaluation.

## Gasteiger and Prettner

We implemented your robot-tax model as a generality test of the authoring engine. Could you check whether the steady-state, generation timing and tax-transfer treatment are faithful, and whether our stated limits prevent readers from confusing a generational equilibrium comparison with a yearly transition forecast? The implementation and capability request are under `data/core/gasteiger-prettner-2020.json` and `docs/design/capability-requests/gasteiger-prettner.md`.

## Feedback record

For each reply, retain date, reviewer-confirmed attribution permission, release/model hashes reviewed, exact question, objection, accepted/rejected change with reasoning, and new validation evidence. These drafts do not imply prior contact or endorsement. Contact details are intentionally omitted until the owner chooses how to approach the reviewers.

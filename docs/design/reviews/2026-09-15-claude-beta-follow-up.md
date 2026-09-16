# Response to Claude's PR20 beta review

Reviewed input: Claude report for `a064c2c676b2158afea7705e0e9a31668adbd642`, relayed by the owner on 2026-09-15. This follow-up stays on `codex/policy-evidence-readiness`, leaving PR20 available for comparison. Current implementation and verification are recorded in [beta delivery readiness](2026-09-15-beta-delivery-readiness.md); GitHub CI is reported separately when available.

| Concern | Independently checked status | Action |
|---|---|---|
| Financial Paste a policy loses model | Reproduced in code at cb29ab2 | Fixed in `e10c831`: exact current experiment and policy entry use the validated share contract; independent lifecycle review passed. Actual browser checks passed. |
| App-built model called user file | Confirmed in Lab initialization/banner | Fixed in `e10c831`: identity-verified catalog origin is distinct from arbitrary file claims; forged-origin probes refused. |
| No software license/citation | Confirmed | Owner requested maximum reuse freedom; add MIT and valid CITATION.cff, preserving third-party rights. |
| Apple earnings release unaudited | Confirmed; audited values agree | Implemented in `a315438`: separately identified v2 uses audited 10-K; v1 retained, subject to numerical-runtime compatibility. |
| NVIDIA FY2025 period older | Confirmed | Expose period end in selector; do not substitute another fiscal period under old identity. |
| Amazon returns uncollected | Buybacks expressly zero; dividends zero by audited equity reconciliation | Implemented in `a315438`: reported repurchases zero, derived dividends zero, without changing allocation equations. |
| Raw provider JSON shown | Already fixed at `69a420f` | Actual new candidate HTTP 403 shows safe permission message and manual recovery. |
| Compressed JSX | Confirmed | Formatted in `e10c831`. |
| Phone history nav wraps | Confirmed | Compact History label in `e10c831`; actual mobile navigation and axe check passed. |
| History only in-sample | Superseded by this branch | New frozen retrospective holdout; primary wellbeing result worse than persistence, not blind external validation. |
| AI live extraction unverified | Still true for candidate | Existing origin restriction blocks localhost; finish on an approved release origin. Older public live success is separate evidence. |
| Beta vs publication | Beta scope reasonable; publication advice incomplete | Add actual release/user/expert/archival gates and current JOSS requirements. |

A financial source can be accurate while the behavioural response remains assumed. Global company cash assigned to a chosen resident cohort is a disclosed scenario, not an observed transfer. Training response parameters are assumptions. A new label or passing software test cannot repair absent causal evidence.

No expert messages, releases, journal submissions or deployments are performed by preparing these materials. See `docs/release/three-step-delivery.md` for concrete delivery steps and remaining external gates.

Additional check: compatible security patches removed all production audit findings and all high findings in development dependencies. Two moderate development package flags remain for one Vitest advisory requiring a major upgrade. Fresh source-bound accounting review, unchanged frozen numerics, strict old-runtime refusal and the final 1,257-test software gate passed. Audit counts do not establish exploitability of every advisory.

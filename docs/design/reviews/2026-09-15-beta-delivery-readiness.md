# Beta delivery readiness — 15 September 2026

This follow-up is implemented on `codex/policy-evidence-readiness` in [draft PR21](https://github.com/sagearbor/ai-ubi-wellbeing-transition-simulator/pull/21), stacked on the unchanged PR20 candidate `a064c2c`. Final application change: `84075ba`. It has not been merged or deployed. The public website is not evidence that these changes are live.

**Software checks pass; the remaining live AI/deployment gate is not verified.** The intended release is a bounded research beta, not a validated policy forecasting service. Claude's concrete UI/provenance/license concerns were valid and have been addressed.

## What changed

| Concern | Result | Evidence |
|---|---|---|
| Financial policy link opened an unrelated training model | Exact edited scenario A travels to Lab with policy focus; ordinary mounted drafts survive navigation | `e10c831`, [continuity review](2026-09-15-beta-continuity-review.md), actual browser record below |
| App-built model mislabeled as user import | App-built label requires full catalog/source/model identity; file metadata cannot grant it | `components/lab/importState.ts`, `src/financials/presentation.ts`, independent tamper probes |
| Financial source defects | Default v2 uses audited Apple source; Amazon repurchases are reported zero and dividends explicitly derived zero; NVIDIA's earlier fiscal period is visible | `a315438`, [financial review](2026-09-15-beta-financial-revision-review.md) |
| Reproducibility through source revision | V1 bytes and six real old captures remain immutable; edits and links retain their collection | Data hash and full-model tests; actual v1 reopen/edit and old-source display |
| Missing license/citation/contributor path | MIT selected for broad reuse; valid CITATION.cff, third-party notices and contribution guidance added | `LICENSE`, `CITATION.cff`, `CONTRIBUTING.md`, `THIRD_PARTY_NOTICES.md` |
| Raw provider error and unclear evidence | Safe failure preserves text; visible Google disclosure; quoted settings, response assumptions and unavailable effects remain separate | Real provider failure, manual comparison and negative UI probes |
| Mobile navigation / accessibility | Compact primary navigation; keyboard-scrollable history tables; accurate native Draft A/B selector semantics | `cb29ab2`, `e10c831`, `941c8c4`, actual axe and keyboard checks |
| Unsupported financial variable form | Exact financial model now explains unavailable targets and the model-file route; supported authoring/removal still work | `84075ba`, [fix report](2026-09-15-beta-authoring-fix.md), [final review](2026-09-15-beta-final-review.md), actual browser checks |
| Known dependency vulnerabilities | Compatible production and build-tool repairs; strict numerical identity retained | `10142e8`, [dependency report](2026-09-15-beta-dependency-refresh.md) |

## Verification actually performed

- Node 22 `npm run check` after the selector repair: **1,257 tests / 90 files passed**, plus all included validators, ledger checks and production build. Log retained locally at `/private/tmp/beta-final-full-check.log`. The final authoring-affordance repair subsequently passed 39 focused tests, typecheck and a fresh production build; its four new tests also passed independent re-review. Exact final-commit GitHub CI is linked in the pull request checks.
- Final authoring browser check: the financial route exposes clear instructions, no impossible form and a working model download. The supported income model successfully creates and removes an overlay without error alerts; financial equations, hooks and source identities are untouched.
- The first hosted CI run at `35e6d35` failed eight command-integration tests at the default five-second deadline (5.132–6.007 seconds); 90 other files passed. The scoped harness repair `e54a435` adds bounded child execution and explicit timeout/error rejection while retaining every tamper assertion. Focused tests and typecheck pass. [Diagnosis and review](2026-09-15-beta-ci-packaging.md); consult [PR21 checks](https://github.com/sagearbor/ai-ubi-wellbeing-transition-simulator/pull/21/checks) for the final hosted result.
- Final production audit: **zero vulnerabilities**. Full audit: **two moderate package flags for one development-only Vitest advisory**, not a clean whole-project audit. The standalone mock plugins are not configured here; `npm test` runs non-browser tests. A maintained Vitest line (at least 4.1.11) needs a separately verified major upgrade. See the [primary advisory](https://github.com/advisories/GHSA-82fw-gwwq-j7x9).
- All nine frozen evaluation artifacts remain byte-identical. Full historical outputs are identical before/after the patches under the same Node runtime. Node 22 versus Node 26 has tiny last-digit differences in twelve AI-on sensitivity fields; cross-runtime bit identity is not claimed. No tolerance, cohort, target, observation or coefficient was changed to pass.
- Fresh unchanged qualification suite: **383 cases passed**, then independent review recomputed all raw case hashes, **61 monthly identities and 7,808 country-month allocations**. `e399b4f` activates only those exact baseline source/allocation identities; macro/wellbeing remain illustrative. [Independent review and scoped activation](2026-09-15-beta-security-qualification-review.md).
- The reference ledger still has **four misses** and explicitly unverified/outside-model entries. The known AT-3 directional miss and eleven already-existing normalized oracle-error warnings remain recorded; their statuses and published targets were not rewritten.
- Actual patched-browser manual policy run: 20 million USD converts once to 20,000,000; 200 paired draws, seed 1; reopening reproduces **all 288 stored values with maximum deviation zero**. The automated author is labeled as an agent, with no human review/completeness attestation. Unsupported employment/AI-risk targets remain unavailable; quoted coverage is not claimed to be complete operative handling.
- Actual invented-quote and conflicting-setter probes each block execution/export and hide stale results. Exact financial A/B, origin labels, source corrections, old collection handling and draft retention were exercised through the browser.
- Actual mobile checks: published page zero axe violations/incomplete checks; repaired Policy panel zero violations/incomplete checks. History has zero violations and one incomplete contrast check for horizontally clipped table cells. These are scoped checks, not whole-product accessibility certification.

[Browser evidence, recorded bundles and before/after checks](evidence/beta-delivery-2026-09-15/README.md).

## Compatibility decision

The security patch changes the numerical convention from mathjs 15.1.0 to 15.2.0. The actual new financial experiment changes only its numericalHash compared with the same prepatch experiment. Old policy bundles and financial files receive explicit refusal; the current financial experiment is preserved. We do not ship the vulnerable old runtime or falsify its stored identity. Old collection data remain available to code that constructs a new experiment on the patched runtime.

## Three delivery steps

| Step | Prepared now | Still required |
|---|---|---|
| Research beta | Reviewed software, reproducible scenarios, visible evidence limits, feedback route and release/rollback procedure | Exact merged-release CI; authorized-origin live AI smoke test; actual deployment/promotion; observed first-time users |
| Expert feedback | Specific draft questions and reproducibility pack | Owner-authorized contact and actual responses; none were sent or invented |
| Archive / publication | MIT, citation metadata and methods outline | Human authors/affiliations, third-party distribution review, actual archive DOI, demonstrated research use and editorial eligibility; not verified |

[Concrete three-step delivery instructions](../../release/three-step-delivery.md) · [Expert review drafts](../../release/expert-review-pack.md) · [Methods outline](../../release/methods-outline.md).

The real patched-candidate AI request was attempted, but Google still rejects localhost with its existing website restriction. The UI preserves the source and manual recovery works. A successful call from the older public application is separate evidence; it does not pass this candidate's gate. This machine has no `gcloud` executable; no deployment or traffic promotion was attempted. The owner accepts browser-side key architecture, so no gateway is imposed by this work.

The first frozen wellbeing result remains worse than persistence (0.317533 versus 0.289744 ladder points). That result cannot honestly be fixed by relabeling or retuning this held-out score. Accurate financial inputs and successful code execution also do not establish causal policy effects.

## Decisions made during this work

- Retain old source data but refuse old numerical-runtime bundles after the security patch. Cost: earlier review-build shares need an explicitly new experiment; silent replay would misrepresent the software used.
- Treat the three delivery steps as prepared until their external evidence exists. Cost: the release is gated while the authorized AI/deployment/user/expert/archive checks are outstanding; no success is fabricated.
- Patch compatible build/dev dependencies now, despite an extra qualification run; defer only the separately verified major Vitest upgrade. Cost: one development advisory remains documented, so the whole-project audit is not called clean.

The final GitHub PR and exact CI run are reported in the pull request and delivery message. The [final integration review](2026-09-15-beta-final-review.md) records the original finding and the bounded fix verdict.

# Forensic Analysis: policy-evidence follow-up integration

**Domain Lens:** Principal simulation/software engineer reviewing scientific evidence boundaries, artifact identity, and interactive result state.

**Decision: APPROVED as a research-review branch. No blocking integration defect found.** This is automated code/evidence review, not acceptance of causal policy forecasts, deployment approval, or confirmation of successful live candidate AI extraction.

**Scope:** `a064c2c` through `11e6841`, plus the working README, policy-evidence handoff and readiness documentation inspected on 2026-09-15. Task 1 numerical/default-equivalence review, Task 2 independent accounting recomputation, and Task 3 implementation review were read and relied upon rather than repeated wholesale. Root-owned final browser, GitHub and credential checks remain separately attributed.

## Executive Summary

The branch integrates the frozen retrospective test, fresh accounting qualification, and policy evidence presentation without expanding their scientific claims. Current artifact hashes and focused integration tests pass; the poor primary held-out result remains prominent. The candidate's successful live AI extraction remains an explicitly unfinished release check because its configured credential rejected the localhost origin.

## Claim Verification

| Claim | Verdict | Evidence/Reasoning |
|---|---|---|
| The displayed holdout uses current pinned artifacts | Verified | Independently hashed all 44 packaged source entries and all nine artifact entries: zero mismatches. `HeldoutExperience.tsx` imports the actual packaged JSON and displays its scores, masks and provenance. |
| The primary held-out result is worse than persistence | Verified | Current artifact: 681 observed of 700 eligible country-years; model MAE 0.3175333128080816 versus persistence 0.2897439060205584. README and interface preserve the direction and scale. |
| This is a legitimate out-of-fit retrospective test, with limited inference | Verified within reviewed scope | Separate fit/predict/score interfaces and committed protocol; prior independent numerical review covers temporal separation and execution. UI and documents disclose revised vintages, post-period model choice, and excluded financial/conditional-world/policy claims. |
| Existing scientific defaults were not silently changed | Verified by diff and prior independent numerical review | Production numerical diff is an optional finite-validated coefficient override and export of the existing archetype helper. Default fallback remains intact; prior review reproduced default hashes and historical outputs. No financial arithmetic or target change appears in the branch diff. |
| Fresh qualification does not promote the whole model | Verified | Current source check passes; actual baseline months 0–60 remain reviewed only for conditional accounting. Targeted tests retain illustrative macro/wellbeing and rejection of modified/imported identities. |
| Policy evidence follows the active current result | Verified | `PolicyPanel.tsx:210–240,990–1001` resolves current model/overlays, selects the active draft, and requires the existing successful current run key before displaying the inventory. Source declarations explicitly confer no scientific acceptance. |
| Authorship and provider errors preserve boundaries | Verified | Author edits use `withEdit`; lifecycle tests confirm invalidated attestations. Extraction catch uses fixed public messages rather than raw provider errors. No new logging or share-state owner is introduced. |
| Zero-result shortcut describes the correct draft | Verified | Corrected selected-draft/entity wording and two-draft component regression pass; helper uses chronological order and displayed quantiles. |
| Public live tests establish candidate live success | Flawed if asserted; not asserted in reviewed documents | Retained documents explicitly distinguish older public core-0.2.0 extraction from candidate core-0.3.0 manual execution and actual HTTP403 origin refusal. Successful candidate extraction remains unverified. |

## Internal Consistency Issues

No new blocking inconsistency found. The previous selected-draft wording defect is corrected at `11e6841`. Readiness text still contains root-owned in-progress verification entries; those are explicitly pending, not evidence of completed work. This review does not certify later edits or future CI results.

## Best Practices Violations

No new blocking violation found. Compact one-line JSX in the history and policy inventory makes maintenance and future evidence review harder, but does not justify a production fix wave for this branch.

## Unaddressed Failure Modes

- Successful end-to-end candidate AI extraction is not verified. Complete it on an existing authorized development credential/origin before calling that release check passed; preserve website restrictions.
- A source URL, a model's declared source kind, manual draft success, or accounting conservation cannot establish empirical policy effects. The branch correctly keeps these limits visible.
- Root reports a full gate at `69a420f` (1,210 tests, 86 files, validators/build), targeted checks/build after `11e6841`, and exact replay of 288 candidate result values. These are root-owned observations, not independently repeated browser/full-suite evidence in this final review.
- Historical evaluation is retrospective and uses revised data. It does not independently validate current default-world forecasts or disabled policy channels. Existing AT-3 limitation remains outside this integration's correction scope.

## Recommendations

1. Publish the research-review branch with these evidence boundaries and exact final SHA/CI status. No production-code fix wave is required by this review.
2. Finalize root-owned browser/readiness documentation with observed results and explicit unfinished candidate live extraction status; do not substitute public/manual/parser evidence.
3. Require a successful authorized-origin candidate extraction smoke test before marking the live AI release check complete. This is a release limitation, not a blocker to publishing reviewable research work.

## Independent Verification Performed

`node node_modules/vitest/vitest.mjs run scripts/evaluation/packaging.test.ts simulation/qualificationAcceptance.test.ts components/lab/PolicyPanel.lifecycle.test.tsx components/lab/PolicyResults.test.tsx src/policy/presentation.test.ts services/policyExtractionError.test.ts src/history/holdout.test.tsx` — **41 tests passed in seven files**. Tests include actual package-command refusal before overwrite for stale artifact/source links, baseline qualification and modified-input rejection, authorship lifecycle, selected-draft wording, and fixed provider-error mapping.

`npm run qualification:source-check` — passed with source identity `4b16b1021edd2a084d0d7990d675e941e36e6f54d2b3c90127aca8668e47ef60`.

Independent SHA-256 comparison of packaged sources and artifact references — **44 sources and nine artifact hashes matched**. No production files were edited. Existing server-rendered chart-size and Node deprecation warnings occurred without test failure.

## Confidence Assessment

**High for this bounded research-branch integration approval.** Current artifact identities and targeted runtime/presentation checks support it, together with the earlier independent task reviews. Confidence does not extend to successful candidate live extraction, untested deployment, causal effectiveness, or forecast reliability.

## Scoped accessibility rereview — `cb29ab2`

**Accepted; research-review approval retained.** Reviewed only `11e6841..cb29ab2` in `components/history/HeldoutExperience.tsx`, addressing root's actual mobile `scrollable-region-focusable` finding. All three new scrollable table wrappers now have `tabIndex={0}`, `role="region"`, and distinct descriptive accessible labels. Both reusable table call sites supply the required label. The existing `.history-experience :focus-visible` rule supplies a three-pixel visible outline; no focus trap or custom keyboard interception is introduced.

The change affects focus/accessible naming only. Table data, chart values, artifact imports, scientific disclosures, and result semantics are unchanged. Independently reran `node node_modules/vitest/vitest.mjs run src/history/holdout.test.tsx`: three tests passed. Root owns the rebuilt actual-browser axe rerun; this code review does not assert its result. No further code correction is requested.

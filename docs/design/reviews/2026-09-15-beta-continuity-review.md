## Forensic Analysis: Beta financial-to-Lab continuity

**Domain Lens**: Principal engineer reviewing React lifecycle behavior, reproducible scientific-model identity, and provenance boundaries.

**Reviewed scope**: `cb29ab2..e10c831` (`Preserve financial scenarios in policy and authoring handoffs`), against Task 1 of `docs/superpowers/plans/2026-09-15-beta-delivery-readiness.md`. Reviewed source and ran checks in an isolated `git archive e10c831` snapshot at `/private/tmp/alignment-beta-review-tQjay0`; ongoing source-data and release-document edits in the shared checkout are excluded. This is a new review of the Claude PR20 follow-up, not a repeat approval of the earlier holdout work.

### Executive Summary

**APPROVE for this bounded code scope.** No blocking correctness, provenance, or state-loss defect was found. The exact financial experiment now supplies scenario A to the policy/authoring handoffs, explicit A/B links remain independent, and uploaded models cannot acquire the separate app-built origin label through their metadata. Browser/mobile verification remains with the coordinating reviewer; this verdict does not assert that the complete beta delivery or publication work is finished.

### Claim Verification

| Claim | Verdict | Evidence/Reasoning |
|-------|---------|--------------------|
| Edited financial A survives “Paste a policy” | Verified | `PublishedExperience.tsx:580` serializes the current experiment with side A and `entry=policy`; `App.tsx:228` and `App.tsx:235` initialize the exact experiment and one-time entry request. The existing stateful transition test edits NVIDIA A before following the resulting URL and checks exact model identity. |
| Explicit A/B links preserve independent models | Verified | `PublishedExperience.tsx:283` retains the per-scenario side; share validation rebuilds and checks both model hashes. Continuity tests check nondefault NVIDIA/GBR inputs and the exact B model. Existing worker-result roundtrip tests also pass. |
| App-built origin is separate from imported experimental status | Verified | `importState.ts:38` constructs origin only after validating a pinned experiment and rebuilding its model. `LabTab.tsx:149` explicitly copies only model/overlays from initial file-like imports. The app-built note does not grant scientific curation or causal validity. |
| File metadata or rewritten hashes cannot self-promote an altered model | Verified | The file classifier omits `origin`/`financialOrigin`; `LabTab.tsx:263` replaces imports without retaining that flag. `verifiedFinancialOrigin` also requires the actual model hash and complete catalog-model recognition. Independent forged-package, replacement-import, equation/invariant/value tampering probes pass. |
| Stale identities fail closed | Verified | Existing tests reject stale data/collection/engine/model identities. Independent probes also reject stale recipient and numerical-convention pins without selecting a financial model or showing its origin claim. |
| Entry discovery preserves existing Lab work | Verified, bounded | `LabTab.tsx:294` changes the model only for the explicit training-fixture request. Repeated policy and author requests open/focus their target without changing the selected model or edited overlays. App retains the mounted Lab at `App.tsx:1895`; full browser draft retention is a separate integration check. |
| Research-beta, feedback and fiscal-period labels exist | Verified | `App.tsx:1348` supplies the beta notice and repository issue link; `PublishedExperience.tsx:371` includes fiscal year and period end. The History button is compact with a descriptive accessible name at `App.tsx:1339`. Mobile rendering is not established by string-render tests. |
| Worker reports 104 tests in nine files and typecheck | Verified | Independently reproduced at the exact reviewed commit: 9 test files passed, 104 tests passed, and `tsc --noEmit` exited 0. |

### Internal Consistency Issues

No blocking inconsistency found. The app-built note describes model origin; the retained experimental labels describe review status. Those are compatible claims, and exported/uploaded model files remain experimental.

One nonblocking discovery issue: the “Explore uncertainty” action now correctly preserves the financial model, which declares no parameter distributions. Its destination is therefore a disabled “Uncertainty — deterministic: uncertainty off” control (`LabTab.tsx:571`). The numerical behavior is honest, but the initiating action could set this expectation more clearly.

### Best Practices Violations

None verified in the changed continuity/provenance paths. The allowlisted entry parser, exact source/model checks, `noopener noreferrer` on new-tab handoffs, and metadata stripping avoid the specific regression and provenance failures under review. The formatter expansion of `PublishedExperience.tsx` does not introduce a new model calculation in this diff.

### Unaddressed Failure Modes

- Actual DOM focus, scroll positioning, mobile navigation, and preservation of text typed into a mounted Policy panel require the coordinator's browser check. The lifecycle probes use the repository's hook-host test approach and do not claim to replace that check.
- Deterministic financial scenarios cannot produce uncertainty bands without an explicit authoring change that declares ranges. No distributions should be invented to make the discovery link active.
- This review establishes source identity continuity, not the accuracy of the observations, causal effects, successful live AI extraction, deployment, or publication readiness. Data revision and release documents were deliberately outside the pinned review.

### Recommendations

1. Accept the bounded implementation at `e10c831`; no code fix is required by this review before the separate integration/browser gate.
2. Optional small copy improvement: explain beside “Explore uncertainty” that the exact financial model currently has no declared ranges, or label the action “Inspect uncertainty limits.” Preserve the exact experiment and deterministic behavior.
3. Retain the ordinary mounted-Lab draft check and mobile/entry-focus checks in the coordinator's final browser evidence.

### Verification Evidence

Run against unmodified tracked source from `e10c831`:

```sh
npm run test -- components/published/PublishedExperience.test.tsx components/published/PublishedExperience.continuity.test.tsx components/guided/App.transitions.test.tsx components/lab/LabTab.import.test.tsx components/lab/LabTab.test.tsx components/lab/LabTab.policy.test.tsx components/lab/navigation.test.ts src/financials/share.test.ts src/financials/presentation.test.tsx
npm run typecheck
```

Result: **104/104 tests passed across 9/9 files; typecheck exited 0.** Server rendering emitted Recharts container-size warnings, so these checks do not establish browser chart geometry.

Ten additional adversarial cases were then appended only to the temporary snapshot's stateful transition test: two repeated-entry cases, identical-model file replacement, forged package metadata/provenance, four model-tampering cases with recomputed hashes, and two additional stale-pin cases. `npm run test -- components/guided/App.transitions.test.tsx --silent` passed **23/23 tests**: 13 existing plus 10 independent probes. Log: `/private/tmp/alignment-beta-review-tQjay0/adversarial-test.log`. No application source or committed test was edited by this reviewer.

### Confidence Assessment

**High for the bounded code/provenance verdict**, supported by source tracing, reproduced checks and adversarial lifecycle probes. Browser usability remains unverified by this reviewer and should be assessed separately before claiming the whole delivery is complete.

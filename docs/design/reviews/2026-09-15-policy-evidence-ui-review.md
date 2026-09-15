# Forensic Analysis: Task 3 visible evidence and policy boundaries

**Domain Lens:** Principal engineer reviewing evidence presentation, result identity, asynchronous state, and safe provider errors.

## Executive Summary
Reviewed commit `69a420f` against `698ba61`, all 12 implementation files, Task 3 brief, and implementation report. One bounded P2 wording defect needs correction before full spec approval: the selected draft’s zero-change notice can contradict the other draft’s visible differences. Otherwise the code and focused validation support the intended boundaries; no production edits were made by this reviewer.

## Claim Verification

| Claim | Verdict | Evidence/Reasoning |
|---|---|---|
| Held-out view binds actual evaluation artifact | Verified | Direct JSON import; overall scores, cohort, rows, masks, exclusions, and provenance used directly. All 200 country/outcome series independently checked for ordered test years and finite-or-null values. |
| Primary poor result and retrospective scope remain prominent | Verified | HeldoutExperience.tsx:25–32 leads with pooled worse-than-persistence result, frozen fit/origin/test years, revised-vintage limits, and exclusions of policy/financial/conditional-world claims. |
| Units and missingness are honest | Verified | GDP levels use actual level fields, errors explicitly growth percentage points; ladder 0–10 contrasted with reconstruction 0–100. Nulls break observed paths and show Not scored. |
| Actual draft/model inventory avoids scientific endorsement | Verified | PolicyPanel.tsx:990–1001 gated by activeFresh; actual scenarioModel and active draft supplied. Source classifications explicitly unreviewed; unsupported mechanisms not zero effects. |
| First changed year respects displayed entity and quantiles | Verified | Independent probes confirm hidden entities ignored, p5 changes detected, fixed steady-state outputs respected; existing tests confirm chronology over magnitude. |
| Zero-change notice accurately describes all visible values | Flawed | PolicyResults.tsx:117 says shown differences are zero while table at lines 135–162 shows both drafts. See finding below. |
| Authorship does not promote human review | Verified | Lifecycle tests show AI author survives name editing and author-kind changes invalidate review/completeness. |
| Provider failures expose no raw provider payload through catch | Verified | Fixed-message mapper; actual catch calls it; no logging added. Fake error tests cover referrer refusal, key, rate, refusal, network, generic redaction. Manual/source state path unchanged. |
| Active stale state and bundle protections preserved | Verified | Same activeFresh/run-key gates retained; focused active view/state/bundle tests pass. |
| Qualification identity unchanged | Verified | Source check passed: 4b16b1021edd2a084d0d7990d675e941e36e6f54d2b3c90127aca8668e47ef60. |

## Internal Consistency Issues

### P2 — Scope the zero-change notice to the selected draft

**Location:** `components/lab/PolicyResults.tsx:117` (helper invocation at line 64; both-draft table at lines 135–162).

**Reproduction:** Render current A and B entries with years `[2026, 2029]`, active A, selected 2029, one displayed output/entity. A differences at all shown quantiles are `[1, 0]`; B differences are `[1, 7]`. Static rendering displays “shown differences are zero in 2029” alongside B’s `+7 [+7, +7]`. I ran and asserted this reproduction successfully.

**Cause:** The helper correctly examines only `first.result` (active A), but the resulting text makes an unqualified assertion about the shown differences, including a table showing A and B.

**Minimal fix:** Say “For selected draft {first.label} and the displayed entity, the shown differences are zero…” and add a two-draft rendering regression test. Preserve helper semantics and chronological selection; do not select a different draft or strongest effect.

## Best Practices Violations

No additional blocking code-quality defect identified. The new JSX and helpers use unusually compressed lines, which makes future audits harder, but that is a maintainability observation rather than a functional rejection.

## Unaddressed Failure Modes

Actual desktop/mobile layout and live AI extraction remain root-owned. This review does not establish successful live extraction on the local preview address. It also does not repeat already accepted Task 1/2 scientific review or qualify the broader model. SDK/browser-generated network diagnostics are outside the application catch’s control; no application logging of provider errors was introduced.

## Recommendations

1. Apply the selected-draft wording fix and regression test above.
2. Complete root-owned actual browser checks and final gate.

## Validation Performed

- Four focused new/changed test files: 24 tests passed.
- Existing activeRunView, policyState, and bundle suites: 36 tests passed.
- Independent actual-artifact probe: 100 countries × two outcomes, years ordered and finite-or-null presentation values.
- Independent synthetic first-change probes: hidden entity ignored, p5 change recognized, fixed steady-state retained.
- Independent two-draft static-render reproduction: contradiction verified.
- Qualification source check passed with unchanged identity above.
- Existing SSR chart size warnings and Node deprecation warnings occurred; no new failure.

## Confidence Assessment

**High** for this bounded code review and the reproduced finding. **Spec approval pending the single P2 correction; code quality otherwise approved.** Browser usability and successful live extraction remain separately unverified by this reviewer.


## Scoped rereview — commit `11e6841` against `69a420f`

**Outcome: Task 3 spec and code quality approved. No remaining findings in this bounded review.**

The P2 defect is fixed: the notice explicitly names selected draft `{first.label}` and displayed entity `{entity}`. The new actual-component static-render regression reproduces A zero/B +7 in 2029 and asserts both the correctly scoped wording and chronological 2026 shortcut. I independently reran it successfully.

The history polish changes title, rounds displayed aggregate numbers to three decimal places, and moves the full aggregate table after the figure. It preserves the artifact-backed pooled worse-than-persistence finding and 100-country origin cohort above the figure, along with frozen-fit dates, retrospective/revised-data caveats and excluded-model-scope caveats. Rounding does not change the underlying values, sign, ranking, masks, per-row values, or downloaded artifact. The new title describes persistence accurately. The full aggregate table still provides observed/eligible counts and outcome masks; this diff contains no raw artifact edits.

Independent rerun: `npm run test -- components/lab/PolicyResults.test.tsx src/history/holdout.test.tsx` — two files, four tests passed. Existing SSR chart-size and Node deprecation warnings only.

Root reports the prior full gate passed 1,210 tests across 86 files plus checks/build; actual browser replay compared 288 values with zero deviation and verified author-kind edits invalidate stale results, rerunning restores results, and the first-changed-year action selects 2026. These are root-owned observations, not independently repeated in this scoped code review.

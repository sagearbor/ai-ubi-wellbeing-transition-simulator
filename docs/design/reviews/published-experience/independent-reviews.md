# Independent review records

These reports describe bounded review work and its limits; reproduce the code and sources rather than treating approval as proof.


---

## task-1-review.md

### Spec Compliance

- ✅ Spec compliant for Task 1 at `0255a1e`, reviewed against `1655b58`. Financial observations, named interfaces, exact resident conversion, single-year CoreModel, ten requested outputs, negative-base convention, and executable accounting/capacity constraints are implemented. No legacy engine, qualification, hash/share owner, or published target changes appear in the diff.
- ⚠️ Cannot verify from this task diff: eventual UI display of issuer-specific deductions, preservation of old shared links and mounted Lab state, or exact exported-model identity across the future UI/Lab integration. These are later-task/controller checks, not missing Task 1 implementation.
- ⚠️ Test chronology and execution results are reported in `task-1-report.md`; the review package contains test code but not raw command logs. I did not rerun the reported 88-test covering suite or typecheck. The test assertions themselves exercise the existing worker and engine rather than mocking financial answers (`src/financials/model.test.ts:11`, `:98`, `:104`).

### Strengths

- `src/financials/model.ts:35`: converts both source observations from millions to dollars once. Equations at `:47`–`:56` conserve the split, retain negative raw cash flow, constrain completions by funding/capacity/eligibility/residents, constrain placements by completion success and openings, and divide resident payments by twelve and the exact population.
- `src/financials/model.ts:73`: immutable-value invariant supplements constructor validation, so a Lab parameter overlay cannot silently replace source observations. All financial variable hooks are disabled (`:57`); accounting and recipient constraints remain executable (`:74`–`:84`).
- `src/financials/cohorts.ts:5`: selects only observed existing country populations, validates positive safe-integer counts, and uses raw people rather than rounded legacy millions. The unsourced Taiwan exclusion is explicit (`:15`).
- `data/financials/fy2025-v1.json:5` and `docs/design/research/reported-company-financials.md:7`: collection coverage, worldwide parent consolidation, unlike fiscal periods, nominal units, issuer-specific investment definitions, and unavailable fields are explicit. The source cash-flow difference is correctly distinguished from issuer-defined free cash flow, idle cash, and AI-attributable money.
- `src/financials/model.test.ts:20`, `:51`, `:73`, `:98`, `:104`: meaningful assertions cover the Apple annual/monthly example, negative source cash flow, overlay failures, pinned observations, and decimal conservation across all six company scales. Assumptions above resident population are capped explicitly rather than silently altering the inputs.

### Independent Claim Verification

| Claim | Verdict | Evidence |
|---|---|---|
| Apple annual cash observations and signed distributions | Verified | Official PDF page 3 reports 111482 operating cash, 12715 cash investment, 112010 net income, 15421 dividends, 90711 repurchases in millions; explicitly unaudited. [Apple statements](https://www.apple.com/newsroom/pdfs/fy2025-q4/FY25_Q4_Consolidated_Financial_Statements.pdf). |
| Microsoft six financial fields | Verified | Annual income and cash-flow statements match all six pinned figures, including cash repurchases 18420 and investment 64551. [Microsoft report](https://www.microsoft.com/investor/reports/ar25/index.html). |
| Alphabet six financial fields | Verified | Income statement and cash-flow statement match 402836 revenue, 132170 net income, 164713 operating cash, 91447 investment, 10049 dividends, 45709 cash repurchases. [Alphabet filing](https://www.sec.gov/Archives/edgar/data/1652044/000165204426000018/goog-20251231.htm). |
| Amazon observed fields and gross investment deduction | Verified | Printed pages 36–37 match 716924 revenue, 77670 net income, 139514 operating cash, and 131819 gross purchases. The separate 3499 proceeds explain the difference from issuer free cash flow. Null distributions are explicitly uncollected, not asserted zero. [Amazon filing](https://www.sec.gov/Archives/edgar/data/1018724/000101872426000004/amzn-20251231.htm). |
| Meta six financial fields and lease exclusion | Verified | Income and printed cash-flow page 92 match all six fields; finance-lease principal 2524 is separate. [Meta filing](https://www.sec.gov/Archives/edgar/data/1326801/000162828026003942/meta-20251231.htm). |
| NVIDIA six financial fields and combined investment definition | Verified | Income statement and printed cash-flow page 56 match all six fields. Investment 3236 explicitly combines equipment and intangible assets; principal payments 129 are separate. Direct SEC retrieval succeeded independently, closing the controller's failed-PDF-access concern. [NVIDIA filing](https://www.sec.gov/Archives/edgar/data/1045810/000104581025000023/nvda-20250126.htm). |
| Apple derived base and monthly calculation | Verified by inspection | `src/financials/model.ts:47`–`:56` implies 98767000000 dollars annual base and 9876700000 / 12 / 340003797 monthly dollars per person at the specified scenario. The matching worker assertions are at `src/financials/model.test.ts:20`. |

### Issues

#### Critical (Must Fix)

- None found.

#### Important (Should Fix)

- None found.

#### Minor (Nice to Have)

- None requiring a change in this task.

### Focused Checks Beyond the Diff

- Named risk: declared invariants or disabled hooks might not be enforced by the existing engine. Inspected `src/core/engine.ts:244`–`:280`, `:397`, and `:870`–`:888`: overlays cannot replace invariants or existing equations; no-hook targets produce diagnostics; nonfinite final values and failed invariants return failed results. This corroborates the model's reliance on existing execution semantics. Initial targeted search included a nonexistent `src/core/overlay.ts`; overlay handling is actually in `engine.ts` and was checked there.
- Named risk: copied source excerpts might merely repeat invented numbers or incorrect cash-flow definitions. Independently opened the six original official documents above and checked the relevant statement rows, particularly NVIDIA's combined investment line and Meta/NVIDIA cash repurchases. No source-value disagreement found.
- No focused adversarial execution was necessary: the inspected code did not raise an unanswered behavioral doubt beyond the reported tests. No production files, git state, published evidence, or baseline results were changed. This review artifact is the only write.

### Assessment

**Task quality: Approved.**

**Reasoning:** The small authored model cleanly reuses the existing engine, separates observations from assumptions, and expresses the necessary hard limits without policy effects after accounting. Source checks corroborate the financial inputs; confidence is high for the task-scoped equations and provenance, with later UI/Lab and legacy-preservation checks explicitly outside this verdict.


---

## task-2-review.md

### Spec Compliance

- ❌ One interpretation issue: `components/history/HistoryExperience.tsx:89` applies the common-GDP-growth explanation to AI-on sensitivities, where the stored results contradict it. All other reviewed Task 2 requirements are implemented.
- ⚠️ Cannot verify from this task diff: route wiring, actual lazy chunk separation, responsive browser appearance, interaction and download behavior. Controller/Task 3 should verify these; the component is lazy-loadable but imports its JSON synchronously within its own module (`components/history/HistoryExperience.tsx:2`, `docs/design/research/historical-experience.md:35`).
- ⚠️ Suite/typecheck/qualification passes are recorded in `task-2-report.md:19–23`; not independently rerun, per review instructions.

### Strengths

- `scripts/hindcast/export-experience.ts:39–65` invokes the actual existing CLI and captures complete file-backed stdout, with temporary-file cleanup. No second model implementation.
- `scripts/hindcast/export-experience.ts:15–36,89–93` hashes transitive local sources and compares the complete fresh artifact, detecting stale sources and edited non-headline results. Direct read-only verification found all 30 stored hashes match current files; mutation tests cover both rejection paths (`src/history/history.test.ts:19–28`).
- `scripts/hindcast/export-experience.ts:70–86` retains all five required variants and exact historical target assertions. Structured inspection of `data/hindcast/experience.json:1` verified identical 106-country cohorts across five runs, 22 exclusions each, eleven annual states, matching series endpoints, copied initial observations and 15 null observations per run. Recomputed country errors and cohort MAEs agree with stored scores.
- `src/history/types.ts:32–39` keeps persistence at the observed start, preserves missing observations, and rejects unknown countries. Recomputed wellbeing persistence MAE is exactly 4.679433962264151; UI zero-growth GDP persistence MAE is 24.873275783881926 percentage points (`components/history/HistoryExperience.tsx:54`).
- `components/history/HistoryExperience.tsx:60–61,94–99` clearly states same-span fitting, observed 2015 initialization, separate legacy scope, source-vintage limitations, no causal validity, and retains all-country/missing-data detail without accuracy badges.
- `components/history/HistoryExperience.tsx:42–50,79–80,92` breaks observed paths at nulls and exposes an annual table; observed/model/persistence are labeled separately. Baseline values and USA endpoint agree with the task brief (`data/hindcast/experience.json:1`).

### Issues

#### Critical (Must Fix)

- None found.

#### Important (Should Fix)

- `components/history/HistoryExperience.tsx:89`: the unconditional sentence says cross-country GDP growth correlation is not meaningful because modeled growth is effectively common across countries. That is true for AI-off runs (21.899441999476245–21.899441999476622%), but false for AI-on (21.899441999476245–86.10529906453972%) and anchored AI-on (21.899441999476245–89.8018721172638%). The explanation sits inside the selected-run cohort section, so changing the selector presents an incorrect scientific interpretation of those results. Keep correlation omitted, but restrict the common-growth rationale to AI-off selections; describe AI-on cases simply as sensitivity reconstructions that do not establish predictive/causal validity. Update the corresponding broad statement in `docs/design/research/historical-experience.md:44` if necessary. This is an overbroad brief-mandated rationale, not a reason to change the engine or data.

#### Minor (Nice to Have)

- None required for this task gate.

### Assessment

**Task quality:** Needs fixes.

**Reasoning:** Artifact production, freshness gating, preserved targets and numerical presentation are coherent and well tested in the reviewed code. One unconditional scientific explanation needs to follow the selected run before approval.

**Focused checks performed:** Read supplied code diff once; inspected structured artifact without dumping its minified line; recomputed hashes, cohort consistency, endpoint errors, aggregate errors and persistence using read-only Node scripts. Outside-diff inspection was limited to the concrete risks of incorrect variant labels/corporate-UBI defaults and incorrect endpoint/annual-series semantics: `scripts/hindcast/run-hindcast.ts:145–183` and `validation/hindcast.ts:340–359,405–450` confirm harness settings and conversions. No production files, git state, services, or observation data changed; this report is the sole written artifact.


---

## task-2-rereview.md

ADDRESSED — scoped spec compliance and quality approved.

- `components/history/HistoryExperience.tsx:89`: common-growth rationale now depends on selected `run.aiOff`. AI-on selections show the sensitivity/predictive/causal limitation instead. GDP correlation remains omitted.
- `docs/design/research/historical-experience.md:44`: correctly distinguishes common AI-off growth from heterogeneous AI-on growth.
- No new breakage found in the fix diff; only presentation wording and documentation changed.
- Read `review-27be6aa..56d738b.diff` and updated `task-2-report.md`; six passing tests and typecheck are reported. No suites repeated, no review scope expansion. Browser/integration verification remains with controller.


---

## task-3-review.md

# Task 3 independent review

**Approved** — reviewed `68a9693..5dc2c8d`. No actionable correctness or specification findings in the requested interface scope.

Read the Task 3 brief, controller integration notes, implementation report, packaged diff, and relevant production code and focused tests. This was an independent read-only production review; only this review report was written. Financial source/history audit was excluded because Tasks 1/2 already have independent approval.

- **Routing and state:** App preserves existing recognized hash owners and explicit legacy tabs, selects the financial view from a validated financial payload, fails visibly on invalid financial payloads, and supports the history destination. Ordinary published/Lab navigation retains mounted state; world state remains owned by App. Exact model links open a new tab and do not overwrite the original Lab draft.
- **Exact sharing and files:** URL and experiment-file reopening share the same validator. Collection, recipients, data content, engine, numerical conventions and both model hashes are checked before exact model reconstruction. Both scenario inputs, common recipient cohort and active view survive the payload. Side B selects the exact B model for Lab initial imports. Exact model downloads use the existing complete model package export mechanism.
- **Worker/result semantics:** Scenario jobs use the actual lab-point protocol with independent lanes and model-hash identities. The publication gate rejects pending, stale, failed, semantically unsuccessful, error-diagnostic, incomplete and nonfinite output. Current failures have explicit recovery messaging and do not present old numerical results as current.
- **Controls and interpretation:** Both scenarios independently edit policy/training assumptions with a shared report/cohort. Reported fields remain readonly. Annual cash-flow bridge, resident monthly equivalent, annual budget, completions, gross placements, capacity/opening constraints and unused training money are explicitly labeled. Shareholder uses are presented as competing uses; financial allocation is not portrayed as a world trajectory or net-welfare result.
- **Integration changes:** Lab start navigation no longer opens the unrelated nested importer; targeted disclosures still open. Policy wording changes preserve substantive counts, dispositions and failure statuses. About distinguishes the world model card from the financial model.

Reviewed the focused route, share roundtrip, exact-model and semantic-result tests as supporting evidence. Did not repeat the controller-owned full test command or real-browser acceptance checks; this approval covers code/specification review, and final handoff still requires those controller checks to pass.


---

## final-review.md

# Broad final independent review

**Needs one bounded fixwave** — reviewed completed branch `5dc2c8d` against `8c65b9efa9c4add5fb3777506c5a885c5c6ac7d3`. Two presentation findings below; no numerical, engine, historical-target, or qualification changes requested.

## Findings

1. **P2 — Preserve observation provenance in the exact-model Lab.** `src/financials/model.ts:67–69` passes three pinned observations into Lab with no `source.kind`; `components/lab/labState.ts:81–93` defaults these to assumed, and `components/lab/AssumptionsPanel.tsx:64–71` renders them as editable number inputs. Reproduction: open the default Apple exact model A in Model Lab and inspect Assumptions. The panel says **10 of 10 parameters are assumptions**, all three reported cash/population inputs carry **assumed · assumption**, and their chip meaning says **Nothing measured it**. Changing one offers an ordinary edit that subsequently violates the pinned-observations invariant. This contradicts the required visible distinction between observations and choices. The invariant protects results, so this is a labeling/usability defect, not silent arithmetic corruption.

   Independent server render of the actual AssumptionsPanel confirmed `count={assumptions:10,total:10}`, ten assumed chips, and the operating-cash input `value="111482000000"` without readOnly/disabled. Minimal fix: a narrowly scoped presentation helper identifying the authored financial model and its three pinned observation parameters; show reported/source observation chips, retain source provenance, render those values read-only with a pinned explanation, and count the remaining seven inputs as assumptions. Avoid guessing that every absent kind is observed, or treating every sourced parameter as immutable. The legacy EvidenceKind enum has no reported category; do not misclassify these as causal, fitted, or associational merely to reuse its colors. No core enum, engine, qualification manifest or model-equation change is needed. Add focused coverage for reported counts/read-only fields and unchanged generic Lab behavior.

2. **P3 — Give the labeled allocation container a group role.** `components/published/PublishedExperience.tsx:65` uses `aria-label="Allocation of proposed policy budget"` on a generic div. The controller's real-browser accessibility scan reported zero violations but flagged these A/B nodes under the incomplete `aria-prohibited-attr` rule; markup inspection corroborates the missing semantic role. Minimal fix: add `role="group"` to the existing allocation div so the name labels a supported grouping. No redesign or additional accessibility sweep is needed; inspect the changed rendered nodes in scoped verification.

## Scope and evidence

Read the specification, SDD progress and all task review/rereview reports, the integrated diff and relevant production/test code. Broad integration attention covered App routing/mount preservation, independent scenarios, bounded versioned sharing, exact-model handoff, current-worker-result gating, financial provenance and accounting boundaries, historical variant labeling, annual missingness, artifact reproduction and legacy isolation. Existing source audits were not repeated. No further concrete regressions were found within this bounded review.

The controller reports fresh `npm run check` exit 0, 1,155 tests across 80 files, validators and build passing; real-browser independent A/B arithmetic, history/back state preservation, independent share replay, exact B new-tab Lab import, 390px layout, Amazon allocation/capacity/openings, and download/upload replay passed. Those checks are controller evidence, not claimed as independently rerun here. Independent execution was limited to the targeted actual Lab server render proving finding 1. Controller source-report DOM verification also resolved accessibility-snapshot float rounding as a display-tool artifact, not an application defect.

Only this review report was written. No production changes, commit, service changes or subagents. After the one fixwave, perform scoped rereview of these two findings and their direct tests; do not reopen approved source or numerical work without new evidence.


---

## final-rereview.md

# Scoped final rereview

**Approved — both findings addressed, none open.** Reviewed `3d8393d` through `final-fix.diff` and the appended Task 3 report. Review limited to the two final-review findings and their direct implementation/tests.

- **P2 addressed:** `src/financials/presentation.ts` reconstructs the pinned financial model from its record, cohort and scenario values, then compares complete normalized model hashes. Only the three matching displayed observation values receive observation treatment. `AssumptionsPanel` renders them read-only with source links and a pinned explanation; its explicit verified set excludes them from the assumption count, yielding seven of ten. Generic absent-kind behavior remains unchanged. Tests cover all six companies, raw/resolved models, a non-default cohort/scenario, three readonly fields, an editable policy input, source links, altered model/source/equation/invariant/value rejection and a differing displayed overlay value. No core EvidenceKind, model equations, financial source or qualification changes occur in this fix.
- **P3 addressed:** the allocation container now has `role="group"` alongside its accessible name. The rendered comparison test asserts both named groups.

The reported focused verification is 37 passing tests across three files, plus typecheck and diff whitespace checks. Those commands were not redundantly rerun; the controller is running the final full check and owns browser verification. No additional concerns found in these direct fixes. No broader review, new scope, production edits, commits or subagents; this rereview report is the only write.

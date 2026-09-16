## Forensic Analysis: Financial evidence revision and collection identity

**Domain Lens**: Principal engineer for reproducible scientific software, with financial-statement provenance scrutiny.

### Executive Summary

**PASS for the bounded financial revision; no blocking defect found.** Reviewed `ce17f4d..a315438` against `docs/design/research/financial-source-corrections-2026-09-15.md` and the worker report. Independent source inspection, immutable-byte checks, and adversarial probes support the implementation; this is not release, browser, deployment, or AI-functionality approval.

### Claim Verification

| Claim | Verdict | Evidence/Reasoning |
|-------|---------|--------------------|
| Original v1 observations remain unchanged | Verified | No v1 data diff. SHA-256 is `fa0017ef898082cb7289448a2fc7e174a39039c8b67bd9683aacc8ea7bc64dba`. |
| Fixtures are the actual six pre-revision captures | Verified | Both `/private/tmp/financial-v1-experiments.json` and `src/financials/fixtures/v1-experiments.json` have SHA-256 `12bb8f688e1e087aeda1bfa6d3edceb08b9924c42c6ac818690c890d8c909d6b`; all six pass original identity validation. |
| New work defaults to separately identified v2 | Verified | `src/financials/catalog.ts:11`, `src/financials/share.ts:22` and `:33` select v2 only by default, with independent collection data hashes. |
| Apple retains all six values with audited locators | Verified | `data/financials/fy2025-v2.json:25` onward agrees with the official filing: income statement page 29 and cash-flow statement page 33. No numerical changes. |
| Amazon zero dividends are explicitly derived | Verified | `data/financials/fy2025-v2.json:264` retains `reportedValue: null`, adds `derivedValue: 0`, and documents the retained-earnings reconciliation. The UI labels the inference derived at `components/published/PublishedExperience.tsx:480` and `:489`. |
| Amazon zero repurchases have affirmative evidence | Verified | `data/financials/fy2025-v2.json:273` cites Note 8, page 62, which expressly reports no 2025 repurchases. |
| Existing v1 identity survives published edits and links | Verified in source and component coverage | `components/published/PublishedExperience.tsx:314`, `:317`, `:324`, `:369`, `:395` propagate the saved collection; `src/financials/share.ts:78` uses it for exact models. Browser integration remains below. |
| App origin requires complete matching model content | Verified | `src/financials/presentation.ts:20` and `:29` compare complete normalized model hashes; `components/lab/importState.ts:56` checks within the declared collection, then verifies data/model hash and fiscal year. Imported JSON does not copy origin. |
| Allocation equations and runtime remain unchanged | Verified | No changes to `src/financials/model.ts`, package lock or engine in this diff. Installed mathjs is 15.1.0. Separate calculation probes pass. |
| Deterministic uncertainty wording is honest | Verified | `components/published/PublishedExperience.tsx:603` says “Inspect uncertainty”; `:608` explains ranges are absent. No invented ranges appear in financial model construction. |

The six Apple values and printed-page references were independently checked in the [official Apple FY2025 filing](https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm). Amazon’s retained-earnings reconciliation and explicit repurchase disclosure were independently checked in the [official Amazon FY2025 filing](https://www.sec.gov/Archives/edgar/data/1018724/000101872426000004/amzn-20251231.htm). The dividend inference remains an inference, not a quoted cash-flow amount.

### Internal Consistency Issues

No blocker found. V1 Apple uses the original unaudited release; v2 uses the audited filing. Amazon’s changed ancillary fields correctly change the collection hash without changing its allocation-model hash, because shareholder-return figures do not enter that model. NVIDIA remains the earlier FY2025 period, with the exact end date visible in the selector.

### Best Practices Violations

No introduced violation requiring a fix was demonstrated in this bounded review. The separate dependency remediation must not be mistaken for work completed here: mathjs remains 15.1.0.

### Unaddressed Failure Modes

Browser integration is not established by these probes or by the worker’s mocked-state/server-rendered tests. Release verification still needs actual browser checks for:

1. Open an original v1 file/link, edit each scenario, company and recipient cohort, switch Explore/Compare, then download/reopen and inspect the retained collection and source.
2. Follow policy, author and uncertainty links in new tabs; verify exact scenario A, v1/v2 source identity, intended destination and preservation of the existing tab’s work.
3. Open a tampered identity through actual upload and URL entry; verify visible refusal without replacing an already open valid experiment.
4. Inspect current Amazon derived-zero labels, old Amazon missing-value labels, Apple audited/unaudited source distinction and NVIDIA period at desktop and narrow viewport widths.
5. Confirm the uncertainty destination exposes the absence of ranges without suggesting stochastic results were produced.

### Recommendations

No financial implementation correction is required from this review. Complete the browser checks above as part of release verification.

When the queued numerical-runtime security patch lands, preserve both immutable files exactly. The original fixtures must then fail with an incompatible-runtime explanation at `src/financials/share.ts:47`; do not regenerate their pins or weaken validation. New experiments explicitly built against v1 and v2 on the patched runtime can test revision behavior separately. This review does not approve the still-old dependency for release.

### Confidence Assessment

**High for the reviewed financial-data and identity logic; browser integration unverified.** Independent temporary probe `/private/tmp/beta-financial-review-probe.ts` ran successfully with:

- 72 allocation executions: six companies × two revisions × policy shares 0, 0.1 and 1 × both scenarios, checked against independently calculated budget, completions, spending, unspent training and monthly-payment expectations.
- 30 tampered collection/data/runtime/recipient pin cases rejected.
- 10 model mutations rejected even after recomputing their retained model hash: equation, invariant, source, parameter source, observation, scope, time, outputs, added variable and uncertainty metadata.

Command: `node --import tsx /private/tmp/beta-financial-review-probe.ts` from `/private/tmp/alignment-policy-evidence`. Result: `{"runs":72,"checkedPinRejections":30,"checkedRehashedModelMutations":10,"status":"passed"}`. The worker’s reported 126 tests/typecheck were inspected as reported evidence, not represented as a fresh rerun by this reviewer. No production code or tracked tests were modified.

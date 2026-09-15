## Forensic Analysis: Task 6 active policy presentation and lifecycle

**Domain Lens**: Principal React engineer reviewing asynchronous ownership, scenario identity, and scientific-result presentation.

### Executive Summary

**Spec verdict: CHANGES REQUIRED. Code-quality verdict: CHANGES REQUIRED.** Reviewed commit `2a9b5d814add0bd9bcd515a83041dd7032489017`, bounded to Task 6 brief, report, supplied `0fdf34d..2a9b5d8` diff and its integration points. The core active-policy handoff and paired-attempt guards are substantially correct, but Futures link hydration is absent, a partial equation link silently opens defaults, bundle ownership starts after file I/O, and operative coverage is omitted from alternate results.

### Claim Verification

| Claim | Verdict | Evidence/Reasoning |
|-------|---------|--------------------|
| Lab state survives ordinary navigation and policy Charts uses policy data | Verified in wiring; parent browser corroborates | App 1871–1874 retains Lab with native hidden wrapper; Charts uses ActivePolicyResultView. Parent browser on this commit retained S.3877 source, model, native 2026–2029 calendar and values. |
| Hidden callbacks do not recapture world selection | Verified in wiring | App 217 only selects policy family while activeTab is lab; callback identity updates with activeTab. Unsupported view switch leaves Lab mounted but hidden. |
| Latest paired attempt overrides prior successful presentation | Verified in wiring | PolicyPanel 230 requires attempt ready plus result.ok and exact runKey. Start/refusal/failure/cancel change attempt; callbacks and progress use gate ownership. |
| Missing/failed B cannot display successful A | Verified in wiring | Stored slots retained at 216–224; explicit slot lookup in both callers; PolicyResults accepts only its selected fresh successful entry. |
| Deferred extraction ignores changed context/unmount | Verified in wiring, bounded | Context captured before extraction await, checked before application; extraction gate revoked on unmount. These protections do not extend to the earlier bundle file read. |
| All recognized share owners hydrate/validate | Flawed | Futures never consumes payload; empty #scenario returns before validation. |
| Alternate view carries operative coverage | Flawed | coverageText omits cov.operative.text. |
| Numerical source gate unchanged | Verified | Changed files are presentation/tests only; source-check returns 950d3fb43937e507c4a2cf67599c92105430a320c337712851a5067a28f3291e. |

### Internal Consistency Issues

1. **P1 — Futures routing does not reopen the shared scenario.** `components/lab/navigation.ts:7` now gives #futures ownership to the Futures tab, but `App.tsx:1877–1891` passes only graph/interventions/importPanel, and `components/futures/FuturesTab.tsx:71–75` always initializes empty sliders, no interventions, and graph.endYear. No production caller references `parseFuturesHash`, `extractFuturesHashParam`, or `decodeFuturesState`; only their utility definitions/tests exist. A valid link with frontier-agi=1.25, dividend-fund and year=2035 and malformed #futures=bad both open the unrelated defaults. This directly contradicts the report's reliance on an existing owning validator. **Minimal fix:** consume and validate the payload in the visible owner, initialize its actual state, validate against graph/intervention identities, and show an owner error instead of default imported results when invalid. Add a real component hydration/error regression, not another route-only assertion.

2. **P2 — Empty equation share silently opens default editor.** `components/lab/navigation.ts:6` recognizes #scenario=, but `components/ModelEditor.tsx:109–110` returns when `extractScenarioHashParam` returns null. `src/services/scenarioShare.ts:174–178` deliberately returns null for an empty recognized payload. The owner therefore shows fresh default equations without an import error. **Minimal fix:** distinguish unrelated hash from recognized empty payload at the owner; surface an import failure for the latter. The direct parser probe confirms route=models/edit while ownerPayload=null.

3. **P2 — Alternate coverage drops the operative disposition result.** `components/lab/PolicyPanel.tsx:250` concatenates cov.text, cov.source.text and cov.completeness.text but omits cov.operative.text. The same string becomes the active view coverage at 256. For the real S.3877 fixture the visible string says 79 of 79 clauses quoted/excluded and 10 unresolved provisions, while the actual operative result says **68 unresolved clauses** and partial scenario. These are different denominators and meanings; the generic limitation does not preserve the omitted context. **Minimal fix:** include cov.operative.text beside comparison numbers and carry it to Charts; explicitly keep quote coverage and operative disposition coverage distinct. Parent browser artifact `/private/tmp/stage35-policy-charts-2a9b5d8.json` corroborates the omission, and this review independently ran coverage() on the fixture.

### Best Practices Violations

4. **P2 — Bundle file reading lies outside request ownership.** `components/lab/PolicyPanel.tsx:505–510` starts file.text() without capturing a token/context. Ownership and context are first captured in openBundleText at 432–434, after that await. Reproduction schedule: select bundle A; delay its file.text(); start a newer manual/example draft or choose/read bundle B; resolve A's read last. A starts a fresh gate generation, revokes newer work, captures the *new* context, and may replace its model/source/draft/results at 487–498. The worker-await guards cannot reject it because their captured context is already the newer state. An unmount before file reading completes similarly does not prevent the callback starting new work. **Minimal fix:** capture owner token and context synchronously when the file is selected, check before parsing/worker starts and after each await, and revoke on replacement/unmount. Keep one owner across the whole operation instead of granting fresh ownership after file I/O. Add controlled File.text() tests that invoke the actual input callback.

### Unaddressed Failure Modes

- **Secondary robustness concern:** bundle validation/reopen awaits at PolicyPanel 463 and 477 lack catch/finally; onFile discards openBundleText's promise at 509. A rejected Runner promise becomes unhandled and can leave “Re-running the bundle…” visible. The shipped worker runner normally resolves structured outcomes, so this is a narrower injected-runner/exception-path concern than finding 4. Paired-run rejection handling is present and correct. Fix with ownership-aware error handling as part of the file-operation correction.
- No additional blocker found in native calendar/steady-state use, selected stale table columns, no-mapped-effects structural wording, source-unavailable link wording, author review versus independent scientific evidence, qualification resolver consumption, default preset ordering, global-only dividend wording, or conditional stance/group suppression. Numerical and source-hash files were not changed.
- Panel z-index and full accessible share-link changes look coherent in source. Browser click stacking, mobile behavior and clipboard fallback remain the parent's browser responsibility; this report does not claim independent browser execution.

### Recommendations

1. Fix actual Futures hydration/error handling and the empty equation-link case.
2. Extend bundle ownership across File.text() and catch owned asynchronous failures.
3. Carry operative coverage into the active view and add an S.3877 content assertion.
4. Add component-level regressions for these paths. Existing helper tests are useful, but do not exercise owner mounting, input file callbacks or coverage composition.

### Confidence Assessment

**High** confidence in the four findings: directly traced production call sites, parser execution, and fixture coverage output support them. **Medium** confidence in overall browser lifecycle readiness pending the parent's remaining browser flows; no browser interaction was duplicated here.

Checks executed in this review:

- Verified HEAD at 2a9b5d8 and inspected supplied task diff, brief, report, design section 9/stage 5 and referenced architecture map.
- `npm run qualification:source-check`: passed, exact hash above.
- Direct TS runtime route/parser probe: recognized empty equation payload returns null; valid Futures payload decodes requested changes; malformed Futures payload decodes null. Source tracing shows neither Futures result is consumed by the component.
- Direct TS runtime coverage probe on S.3877: operative text is “79 of 79 source clauses have explicit operative dispositions; 68 unresolved, 0 outside model — partial scenario; unsupported effects are not zero effects”; composed presentation omits this text.
- `git diff --name-only 0fdf34d..2a9b5d8`: presentation/tests only. No production edits made. Existing plan-file modification was already present and left untouched.
- Parent reports full npm check passed at the actual commit (1,017 tests and all commands); not rerun here. Parent browser evidence is explicitly attributed above, not represented as this review's execution.

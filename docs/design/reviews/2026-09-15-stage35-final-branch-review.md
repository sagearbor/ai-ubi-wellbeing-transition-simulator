## Forensic Analysis: stages 3–5 whole-branch integration
**Domain Lens**: Principal simulation engineer; numerical contracts, scientific provenance, recipient units and UI result ownership.

Reviewed branch `/private/tmp/alignment-stage35`, base `436a16e` through `08c28a6`, read-only. No production edits or browser operations.

### Executive Summary
**Overall spec verdict: changes required. Overall quality verdict: changes required for three bounded P2 presentation/contract findings below; no P0/P1 numerical defect established by this review.** The conditional accounting implementation and supported policy replay substantially satisfy the approved narrowed design, but two population displays and the upload explanation contradict actual execution. **Task 7 integration verdict: code/CI/metadata scope passes; final acceptance remains conditional on these fixes, coordinator browser evidence and fresh GitHub CI.** This is not a verdict that broader causal Stage 3 qualification has been achieved.

### Findings

1. **P2 — Imported population scenarios use the wrong denominator in the world dividend headline.** `simulation/appState.ts:216–218` divides `state.globalFund` by the static dataset population. Conditional allocation and the ledger correctly use the actual complete supplied roster, which is allowed to differ in an unreviewed imported scenario. A real encode/decode share probe doubling USA population succeeds, marks `importedUnverified=true`, and produces ledger/global-recipient dividend `0.24307317416993857` USD/person/month, while `headlineStats` reports `0.254176478554286`. The UI therefore overstates the current result even though imported accounting was recomputed correctly. **Minimal fix:** for conditional states use the actual roster population or recomputed conditional summary; preserve historical legacy semantics. Add a population-changing share/import-to-headline regression that compares headline, ledger and resident allocation.

2. **P2 — Country detail displays population one million times too small.** `components/CountryDetailPanel.tsx:284` renders `(country.population / 1e6).toFixed(1) + 'M'`, but the engine's population unit is already millions. The actual default USA value is `340.0038`; the visible expression gives `0.0M`. This inherited defect remains exposed in the newly accepted conditional country-detail path and directly misstates its recipient denominator. **Minimal fix:** render the millions value directly with a clear label, or convert to persons before using a persons formatter. Check a real default country in the component. No allocation arithmetic defect follows from this display bug.

3. **P2 — Models intro promises execution the new capabilities refuse.** `App.tsx:2194–2200` says custom equations replace built-ins on every step and advanced hooks retain defaults. `simulation/capabilities.ts:13–16` instead refuses all uploaded hooks for conditional/anchored modes and refuses unsupported optional demand/reputation/Gini hooks unless their source is the permitted default expression. Direct resolution with the current default plus an upload returns `Uploaded wellbeing hooks are unsupported by this output definition; select a legacy flow model or remove the upload.` **Minimal fix:** scope the intro to supported legacy flow execution and explain the conditional/anchored refusal and optional-hook limits accurately; direct general equation authors to Model Lab. Do not broaden numerical support to match the prose.

### Claim Verification
| Claim | Verdict | Evidence/Reasoning |
|---|---|---|
| Default qualification is narrow accounting, not causal macro/wellbeing approval | Verified in code/document | Exact identities, source freshness, recomputed derived-output checks and imported marker gate `resolveQualification`; acceptance explicitly limits 61 baseline snapshots and retains illustrative/unsupported classifications. |
| Conditional transfers use actual recipient populations | Verified in allocation; flawed in one reader | `allocateConditional` uses complete destinations and actual population; the headline discrepancy is finding 1. |
| Unsupported custom hooks cannot silently execute under default labeling | Verified execution; flawed explanation | Explicit `RunScopeError`/capability refusal, but finding 3 misdescribes it. |
| Policy results and replay retain model/draft/numerical identity | Verified for inspected contracts and targeted checks | Bundle export pins model/draft/overlays/source; reopen checks numerical conventions, draw identity, scope/shape and all quantiles. Source-only import remains experimental and clears completeness authority. |
| CI runs the complete validation chain | Verified configuration | `.github/workflows/ci.yml` invokes `npm run check`; script includes typecheck, all tests, anchor/Futures/Korinek/core/cases, live ledger and gated build. |
| Clean checkout proves raw artifact arithmetic | Not claimed, correctly | Metadata tests check current declared header, ordered hash payload, accepted linkage/counters/61 identities; they do not read raw evidence. Acceptance says so explicitly. |
| Ledger timeout weakens semantic assertions | No evidence of weakening | The one expensive deletion-counterexample timeout is 120 seconds; failure assertions and target tolerances remain. |

### Internal Consistency Issues
The three findings above are the concrete inconsistencies. Reviewed cross-module paths included default initialization/evaluation/stepping, paired zero-contribution inputs, supported US horizon checks, save refresh, world share decoding, conditional display adapters, active-policy ownership and stale-result gating, source-only bundle import authority, and bundle numerical identity. No additional blocking inconsistency established.

### Best Practices Violations
All confirmed issues are P2: a display must use the same denominator as its executor, population units must remain explicit through presentation, and authoring help must describe refusal behavior accurately. Known browser-side provider key exposure is an accepted limitation for this review, not a newly imposed gate.

### Unaddressed Failure Modes and Limits
- A direct `runMonths` probe with a negative elapsed duration at month 2 returns the input-only array. Current inspected UI callers do not generate that request; optional API hardening, not a merge blocker or one of the three required fixes.
- No browser acceptance was performed here; coordinator owns it.
- The 504 MB raw evidence was not regenerated or independently streamed again. Prior independent numerical review remains separately attributed, not recast as work performed here.
- No live provider request, cloud deployment, GitHub status or merge was verified by this reviewer.
- Exact baseline accounting acceptance does not transfer to changed inputs; source hashes establish identity, not empirical quality.

### Recommendations
1. Resolve the three P2 findings in one bounded wave and run scoped regressions.
2. Complete coordinator browser acceptance and refresh the acceptance record's pending gates with actual evidence.
3. Require fresh full GitHub CI before the authorized merge; preserve reported empirical/legacy misses and exclusions.

### Checks Actually Run
- Direct actual-default initialization: USA population `340.0038` million, current detail expression `0.0M`.
- Direct default capability refusal with an uploaded equation-set object.
- Actual world share encode/decode with doubled USA population: imported marker true; actual roster population `7783.355799999998` million; headline versus ledger/resident discrepancy reproduced above.
- `npx vitest run build/qualificationMetadata.test.ts components/lab/activeRunView.test.tsx src/policy/replayIdentity.test.ts --reporter=dot`: **3 files, 44 tests passed** (3.01 seconds). This specifically covers metadata tampering, active result ownership and numerical replay identity.
- Inspected solver absolute residual/stagnation logic, through-variable dependency handling, final training invariants, raw model bounds, retained-cell/work budgets and async queue reservation; no fresh failure demonstrated.
- Working tree remained clean at inspection.

### Confidence Assessment
**High** in the three reproducible findings and Task 7 configuration/metadata conclusions. **Medium** in broad branch readiness pending their fixes and coordinator release gates; this review deliberately does not substitute code inspection or previously reported suites for an independent full raw-artifact or browser rerun.

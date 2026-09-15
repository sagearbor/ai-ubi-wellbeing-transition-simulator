## Forensic Analysis: Task4 round1,51fd31a..4bee00c
**Domain Lens:** Principal numerical-simulation and application-state engineer.

### Executive Summary
**Spec verdict: PASS for the scoped Task4 corrections. Quality verdict: PASS.** All five numbered findings and the focused UI/seek/autosave findings are addressed. Independently repeated the original numerical/snapshot probes and ran21 focused tests; no blocking regression found in the fix diff. This is Task4 software acceptance, not empirical qualification or approval of later artifacts.

### Claim Verification
| Prior finding | Verdict | Evidence |
|---|---|---|
|1. Nonzero snapshot counterfactual resets macro state | Addressed / Verified | `simulation/run.ts:192` evaluates current snapshot; initializer186 rejects nonzero month. App share420 and counterfactual rebuild `simulation/appState.ts:154` use evaluator. Independent month12 probe retains unemployment0.06308014549224672 in both arms; next month both0.06404422350710445. Focused tests also cover reference mode. |
|2. Nonfinite aggregate accounting/headline | Addressed / Verified | `simulation/conditionalWorld.ts:22` checks sums, allocation normalizes population share,242 normalizes weighted mean,307 rejects nonfinite composed output. Independent two1e308 request probe now throws aggregate requested;128 populations1e308 now throws destination population. Representable1e305 populations test returns finite result. |
|3. Invalid hidden macro state and postconditions | Addressed / Verified | Validator28 checks baseline/prior adoption/pool/workforce/labor/unemployment domains before and after macro calculation. Independent USA.displacedPool=-10 now rejects before output. Targeted tests exercise import/evaluate/step for8 invalid cases and post-macro GDP overflow. |
|4. Unsupported Charts displacement/crisis and mixed map values | Addressed / Verified by source + presentation tests | `App.tsx:1959` guards the entire legacy displacement/crisis panel; series construction also conditional-guarded. `WorldMap.tsx:305`–312 uses common conditional selector for label/number/color/bar and displays outside-scale qualifier. |
|5. Missing raw adoption/cap activation | Addressed / Verified | `simulation/conditionalWorld.ts:173` emits raw/actual/cap/activation/kind. Independent aiGrowthRate100 probe: raw11.644588767821618, actual0.999, cap0.999, capActive=true, kind=numerical-cap. |
|Actual-funded top contributors | Addressed / Verified | `simulation/presentation.ts:4` common actual selector; list138 uses funded ranking. Render/helper test ranks amount-request Apple correctly even with dormant contributionRate0. |
|Modeled source label/units | Addressed / Verified | Corporation detail181 and list428 name modeled source and2015 USD/month. |
|Dormant share displayed/enabled in amount mode | Addressed / Verified | Detail262 hides slider for amount mode; explicit request-type switch remains. List437/512 shows active request/funding, amount mode omits dormant percent, sort uses requested amount. Bulk action says it switches to share. |
|Month0 chart/conditional label | Addressed / Verified | `historyThroughCurrent` appState327 includes anchor/current once; App1009/1910 uses it for data/overlay. MotionChart327/410 label conditional output and single-point dots are enabled. Observed ladder is not spliced into conditional series. |
|Seek before snapshot anchor | Addressed / Verified | appState70 rejects before cached point lookup. Independent month12-base seek0 rejects; targeted cached variant passes. |
|Autosave removes prior recovery/repeats same payload | Addressed / Verified | appState338 never removes saved entry; App1075 supplies no conditional fallback. Test verifies one conditional attempt and preserved previous recovery; legacy optional reduced retry retained. |

### Internal Consistency Issues
No remaining blocking inconsistency found in this fix diff. Initialization and current-snapshot reevaluation now have distinct named APIs and call sites. Chart caption correctly limits the difference to the illustrative recipient-side mapping. Full-roster null headlines are no longer coerced into zero in3D.

### Best Practices Violations
No new blocking violation identified. Finite validation is conservative: nonrepresentable scenarios are rejected rather than claiming a finite estimate; normalized arithmetic avoids unnecessary overflow where a finite output is representable. Validation does not claim imported inputs have verified empirical or replay provenance.

### Unaddressed Failure Modes
No unresolved finding from the requested round1 list. Browser interaction and broad historical replay checks are coordinator-owned; this reviewer did not independently browse or repeat the full973-test suite. Existing qualification/model-card/Lab-navigation tasks remain outside this review.

### Recommendations
Accept Task4 corrections once coordinator browser and legacy checks are recorded. Preserve the new adversarial tests and keep importedUnverified status in downstream qualification logic.

### Validation Actually Run
- `npm test -- simulation/conditionalAdversarial.test.ts components/ConditionalPresentation.test.tsx`:2files,21tests passed. Existing server-render chart-size warning only.
- Independent standalone node/tsx reruns: request overflow, population overflow, invalid pool, raw adoption cap, month12 paired/current + next-month unemployment, pre-anchor seek. Outcomes above.
- Read fix diff and appended task report; inspected affected execution, comparison, presentation and persistence call sites. No production edits.
- Coordinator reported separate legacy comparison against pre-Task4 commit7ce0687: zero differences across1,806,103 existing leaves in organic121states, anchored121states, reference61states; additional metadata only. Source log `/private/tmp/stage35-legacy-compare-core-baseline.log`. This is coordinator evidence, not a rerun by this reviewer. The older436a16e comparison had small prior solver differences and must not be described as bitwise identical.

### Confidence Assessment
**High** for resolution of numerical/state findings and scoped source-level UI guards, supported by independent reproductions and focused tests. Browser-level verification remains explicitly attributed to the coordinator.

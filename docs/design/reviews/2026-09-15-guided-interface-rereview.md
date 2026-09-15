## Forensic Analysis: Guided fix round 1
**Domain Lens**: Principal frontend engineer reviewing scientific scope labels and state transitions.

### Executive Summary
**Spec verdict: pass for the three original P2 corrections. Code-quality verdict: pass for this scoped fix wave.** All three original findings are addressed at `ab5216853f4d926d0caba47b0f9b78ddd4e765d5`; I found no new actionable, reachable P1/P2 defect in the correction diff. Production-browser acceptance remains with the coordinator; the old 4182 build is not evidence for these fixes.

Reviewed `3f09bb5..ab52168`, isolating the production correction diff with `7441c8e..ab52168` after the separately reviewed core merge. Read Task 8 fix brief and appended implementation report. No production files were edited or subagents used.

### Claim Verification
| Claim | Verdict | Evidence/Reasoning |
|---|---|---|
| P2 #1: map comparison has a real exit | Verified | `App.tsx:611–613` clears comparison mode; the visible native button is rendered in world navigation. Normal Map/Charts/Corporations routes also clear it at `591–594`. Stateful tests exercise both routes and preserve the main run identity. |
| Comparison restrictions disappear after exit | Verified | Re-ran the transition test that enables comparison, installs valid legacy hooks incompatible with the conditional comparator, exits, and successfully advances the actual main run to month one. |
| P2 #2: explicit dividend action works from incompatible models | Verified | `App.tsx:572–580` explicitly initializes the default reference/corporations/dataset via the reset pathway, clears uploaded config, and disables comparison. Ordinary Explore/home does not call that reset. Both legacy and anchored transitions pass. |
| Already-valid conditional edits survive dividend exploration | Verified | The compatible path avoids resetting either run; the stateful test asserts exact object identity for edited main and paired runs after the action. |
| Destructive-to-current-state meaning is visible before reference entry | Verified in rendered output/code | ExploreIntro changes the action name to `Start conditional dividend reference` and explains new month zero/removing uploaded equations. Unsupported-state actions include `Save current scenario`. |
| P2 #3: context labels the actual model family | Verified for supported states | ScenarioContext consumes model/state/upload/error inputs; conditional labeling/review is gated; anchored/legacy/uploaded output has separate text. US reference retains January 2030 horizon. Independent rendering probes over every actual legacy preset initial state passed. |
| Related comparison-entry crash is guarded | Verified | `App.tsx:597–604` resolves the intended comparator with the active compiled hooks before enabling comparison. Incompatible entry returns a visible guided error and leaves the main run untouched; the real-App callback test passes. |
| Scientific/core inputs unchanged by this branch relative to reviewed core | Verified | No output from `git diff --name-only eb80fbf ab52168 -- simulation types.ts constants.ts data package.json package-lock.json`. `eb80fbf` is an ancestor. |

### Internal Consistency Issues
No remaining actionable P1/P2 issue found within this correction scope. The refactored `clearModelConfig` now accepts an optional reference object; both existing button/error-banner callers were correctly changed to wrappers, preventing a click event from being mistaken for that object.

The reset passes the reference model, corporation roster and dataset directly into `resetAll`, avoiding dependence on the newly scheduled React state updates. The comparison guard constructs its model using the same default-plus-preset composition as the existing comparison effect.

### Best Practices Violations
No additional release-blocking violation. The eight new transition tests host real App handlers and simulation code, but mock React hooks and do not mount the child component tree in a browser DOM. They provide meaningful state-transition coverage; they do not establish focus, keyboard visibility, layout or real React reconciliation correctness. The coordinator's production-browser checks remain necessary.

### Unaddressed Failure Modes
A separate defensive probe deliberately removed `outputDefinition` from an otherwise conditional snapshot. Its expected `Output definition unavailable` assertion failed: because DEFAULT_MODEL also carries `wellbeingMode: anchored`, `ScenarioContext.tsx:31` falls through to the provisional-level label. I did not establish a supported application route producing that corrupt snapshot; initialization and persisted conditional reconstruction generate the output definition. This is recorded as a nonblocking defensive observation, not a new reachable defect or reason to reopen the original P2. If hardened later, constrain the anchored branch to `!capabilities.conditional` so the intended final fallback is reachable for incomplete conditional output.

No fresh browser tests were claimed in this re-review; the coordinator owns the corrected 4183 production build acceptance. Broad policy cancellation/failed-B/mobile/share coverage from the original acceptance task is not re-certified by this scoped fix review.

### Recommendations
1. Accept the three original P2 fixes, subject to the coordinator's corrected production-browser check.
2. Keep the eight stateful tests and existing allocator/route tests.
3. Verify final ancestry/doc-only carry-forward and the final build identity before presenting the comparison; do not substitute the old 4182 artifact.

### Independent Verification
- `npm test -- components/guided/App.transitions.test.tsx components/guided/guided.test.tsx`: **32 tests passed**, two files. This includes all eight new stateful tests. Existing server-rendered Recharts dimension warnings remain.
- `npm run typecheck`: **passed**.
- `git diff --check 7441c8e ab52168`: **passed**.
- Reviewed-core ancestry and unchanged scientific paths: **passed** as above.
- Independent Node/tsx rendering assertions: supported default conditional context retains reviewed/conditional wording when deliberately supplied a reviewed qualification; all seven actual legacy/anchored/US-reference initial states refuse conditional wording and reviewed authority even under that deliberately injected qualification; an incompatible uploaded-hook state displays unsupported calculation and refuses reviewed authority. **Passed.** The synthetic qualification injection tests presentation gating only and makes no claim about actual resolver review status.
- The separately reported complete suite of 1,086 tests/full check was not rerun here; it remains implementer evidence pending the coordinator's final verification.

### Confidence Assessment
**High** for resolution of the three original findings and absence of additional actionable defects in the bounded correction diff. Browser accessibility/layout and full lifecycle acceptance remain bounded by the coordinator's independent checks.

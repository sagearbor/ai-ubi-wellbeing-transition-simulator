## Forensic Analysis: Guided interface at 3f09bb5
**Domain Lens**: Principal frontend engineer reviewing scientific model interfaces, state ownership, and evidence labeling.

### Executive Summary
**Spec verdict: changes requested. Code-quality verdict: changes requested.** The new funding adapter correctly delegates allocation to the production helper, and independent hand-calculated probes passed. Three concrete P2 issues remain in navigation and model-specific presentation; none is one of the separately owned core corrections.

Reviewed `/private/tmp/alignment-guided`, diff `08c28a6..3f09bb5`, against the guided design and Task 8/9 briefs. No production files were edited. Browser session `forensic-guided-35` used `http://127.0.0.1:4182/?tab=compare`; the served script was independently observed as `/assets/index-Da049lUr.js`. The coordinator supplied its SHA and frozen commit identity; I did not independently rehash the served bytes.

### Claim Verification
| Claim | Verdict | Evidence/Reasoning |
|---|---|---|
| Selected-corporation accounting delegates to the real allocator | Verified | `fundingView.ts:10` calls `allocateConditional` over the supplied roster and selected corporation. Independent below/at/above/zero probes passed. |
| Eligibility remains visible at zero request | Verified | The adapter builds eligible destinations from route, not positive receipts; independent zero test retained both eligible countries and the full population. |
| Reserved source remains explicit | Verified | Independent source 10 / available 4 probe returned reserved 6; `FundingFlow.tsx` renders its own branch, label and table row. |
| Old hash owners take precedence over welcome | Verified at helper level | Re-ran all 24 guided tests, including all four recognized hash-owner cases and legacy tab names. Actual failed/reopened share browser flow is coordinator-owned, not independently claimed here. |
| Map comparison remains reversible | Flawed | Only surviving setter call enables it; no off action exists. Browser round trip retained Scenario B. Finding 1. |
| Dividend action opens a working dividend path after model changes | Flawed | It only switches result family/destination; it cannot select/initialize the required conditional model. Finding 2. |
| Context describes the actual active output family | Flawed | The unconditional context text labels a legacy model's output as a conditional wellbeing index. Finding 3. |
| Full cancellation, policy B failure, mobile and keyboard behavior is independently verified here | Not claimed | Relevant existing lifecycle code was inspected, but this review did not independently replay those complete browser flows. The coordinator is running separate acceptance tests. |

### Internal Consistency Issues

#### 1. P2 — Restore an exit from world map comparison
- **Location:** `App.tsx:1472` (new `onMapCompare` handler), with removed toggle in the header diff and state declaration at `App.tsx:242`.
- **Scenario:** Open Compare → Compare world maps. The sidebar now shows `COMPARISON SCENARIO B`. Return through Explore → Map; comparison remains enabled. There is no visible action to return to a single map. Repository search finds the setter declaration and only `setComparisonMode(true)`; no false/toggle invocation survives.
- **Impact:** The user is trapped in split-map mode until reload. Charts and Corporations retain comparison-mode warnings, and the extra comparison run still participates in stepping/seek guards (`App.tsx:409–410`, `805`, `827–828`). Navigation to a noncomparison destination does not clear it.
- **Independent browser evidence:** DOM probe after the round trip returned `comparisonSidebar:true`, visible message `COMPARISON: FREE MARKET OPTIMISM`, and only the primary `Compare` button among controls named for comparison/exit/single/stop. That primary button opens the guided Compare page and does not disable comparison.
- **Minimal fix:** Add an explicit `Exit map comparison`/`Single map` action that calls `setComparisonMode(false)`. Preserve the comparison model/settings for later reuse. Add a mounted transition test proving enter → exit restores the single-map view and removes comparison-only stepping restrictions.

#### 2. P2 — Make the dividend entry work from an active legacy/custom world model
- **Location:** `App.tsx:219` (`openDividend`), used by `components/guided/ExploreIntro.tsx:3` and the active-policy return action in `GuidedExperience.tsx:51`.
- **Scenario:** In Map, select `Organic Incentive Model (legacy, illustrative)`, then Explore → Explore a dividend. The model remains Organic Incentive, the funding flow is absent, and the page continues to say `The funding-flow journey requires the conditional world model. Your active model and inputs have been preserved.` Repeated clicks do not change this.
- **Impact:** The primary entry action does not deliver its named task after a valid model change. Users must discover the old Map/sidebar preset route to recover the intended dividend experience. The same handler is used by `Explore world dividend instead` after a policy comparison.
- **Evidence:** Browser tested the exact sequence; `openDividend` only sets result family, clears share error, opens Explore and tries to focus a corporation selector that does not exist in this state. It never selects or initializes a conditional model.
- **Minimal fix:** Preserve the current model on ordinary Explore navigation, but make the explicit dividend action open/restore a compatible conditional world run and its paired zero-contribution run when the active model cannot support funding. An explicitly labeled `Open conditional dividend reference` action in the unsupported-state panel is also sufficient if the primary action leads to it clearly. Keep custom/legacy work recoverable and retain deep-link precedence on initial load. Test this transition from a legacy model and from an active incompatible uploaded model.

#### 3. P2 — Gate scientific context wording by the actual model capability
- **Location:** `components/guided/ScenarioContext.tsx:4`, invoked unconditionally for every world model at `components/guided/GuidedExperience.tsx:52`.
- **Scenario:** Select the Organic Incentive legacy model, then open Explore. Its visible context reads `Month 0 · monthly-flow snapshot, not elapsed payments. Macro paths and the conditional wellbeing index are illustrative.` The same page subsequently explains that the conditional funding journey is unavailable for this model.
- **Impact:** The header gives a different output definition from the active model, undermining the explicit acceptance criterion that unsupported models must not appear to be dividend/conditional runs. The unreviewed badge does not repair an incorrect output-family label.
- **Evidence:** Independently captured browser context: `Organic Incentive Model (legacy, illustrative)Your scenario · accounting unreviewedMonth 0 · monthly-flow snapshot, not elapsed payments. Macro paths and the conditional wellbeing index are illustrative.` The component receives only name/month/qualification and has no capability/actual output-definition input.
- **Minimal fix:** Pass model capabilities and the active output definition into ScenarioContext. Show conditional monthly-flow/index wording only for conditional runs; show the actual legacy/custom scope otherwise. Preserve the current reviewed/unreviewed distinction. Test context text for conditional, legacy and unsupported uploaded-equation states.

### Best Practices Violations

The new JSX compresses long handlers and whole sections into single lines, which makes state-transition defects harder to spot and precise review citations less useful. This is a maintainability observation, not an additional release-blocking finding. More substantively, the new tests exercise route helpers and server rendering but do not exercise mounted App navigation transitions, allowing Findings 1 and 2 to pass all 24 tests.

### Unaddressed Failure Modes

The report above does not certify every policy-loading/cancel/failed-B/native-calendar path, all imported formats, or keyboard/mobile behavior. I inspected the preserved result-family guards and persistent Lab wrapper and found no additional concrete defect there within this review. The existing three core P2 fixes are intentionally excluded. No empirical, causal, forecast, or usability-improvement claim is made.

### Recommendations

1. Fix the three P2 findings before accepting the interface branch.
2. Cover the actual mounted state transitions with focused tests; retain the existing allocation tests.
3. Run the coordinator's final production-browser acceptance and complete check on the final integrated commit. Do not treat this head's tests as proof for a later changed build.

### Independent Verification Details

- Re-ran `npm test -- components/guided/guided.test.tsx`: **24 tests passed**, one file. Server-rendered Recharts size warnings were emitted; no test failed.
- Ran a separate Node/tsx assertion probe against the production adapter, independent of its existing test assertions. Synthetic scenario: stock 1,000 billion USD, adoption 0.8, available share 0.4, two recipient countries with populations 10 and 30 million. Hand-calculated source = 10, available = 4, reserved = 6.
  - Share request 25%: requested/funded 2.5, unfunded 0, unused 1.5; 62.5 USD/person/month.
  - Amount request 4: funded 4, unfunded 0, unused 0; 100 USD/person/month.
  - Amount request 20: funded 4, unfunded 16, unused 0; 100 USD/person/month.
  - Zero share: funded 0, unused 4, still two eligible countries and 40 million recipients.
  - HQ route: denominator 10 million and 250 USD/person/month at the 2.5 billion request.
  - Every receipt sum reconciled to selected-corporation funded amount. These are constructed accounting probes, not empirical outcomes.
- Inspected code for the new navigation layer, form/control state, funding view and geometry, persistent Lab mounting, qualification propagation, actual update/paired-run callbacks, share ownership and modal keyboard handling.
- `git status --short` remained empty in the reviewed worktree.

### Confidence Assessment
**High confidence in the three reported findings and the bounded numerical assertions. Medium confidence in overall interface acceptance**, because broad cancellation/share/mobile acceptance is delegated to the coordinator's separate browser verification and was not repeated here.

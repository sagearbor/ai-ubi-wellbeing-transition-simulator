## Forensic Analysis: Task 4, 7ce0687..51fd31a
**Domain Lens**: Principal numerical-simulation and application-state engineer.

### Executive Summary
**Spec verdict: FAIL. Quality verdict: FAIL; changes required.** The new execution discriminator, separate conditional outputs, explicit source/money assumptions and ordinary accounting are substantial improvements. Bounded adversarial execution nevertheless reveals nonfinite published totals, invalid accepted economic state, and incorrect snapshot counterfactual initialization. UI guards remain incomplete after51fd31a. No production files were modified.

### Claim Verification
| Claim | Verdict | Evidence/Reasoning |
|---|---|---|
| Source fixture conserves24.375 and exposes excess requests | Verified | Targeted test covers12.1875/24.375/36.5625 requests and all3 routes. |
| All accepted finite inputs yield finite accounting | Flawed | Two1e308 amount requests publish Infinity totals; large positive finite populations with zero contributions publish NaN headline. |
| Conditional wellbeing never feeds corporate/macro behavior | Verified within tested scope | Independent executor contains no such read;12-month mutation test passed. |
| Static month0 GDP/mapping agrees with month1 | Verified within default reduced form | Targeted static test passed. |
| Complete roster and out-of-scale headline handled | Verified for ordinary inputs | Roster rejection/full-roster unavailable tests passed; overflow exception below. |
| Snapshot import preserves current conditions | Flawed in paired integration | Main import recomputes and preserves requests; initialization of paired arm resets unemployment/displaced pool. |
| US reference horizon atomic at both sides | Verified | Direct, advance, replay, runMonths, cached seek, both comparison orders passed. |
| Unsupported uploads cannot silently run | Verified for parser+engine; UI source inspected |0/-50 rejected on new and anchored modes; capability disables stepping and shows alert. No independent browser-upload claim. |
| Supported displays use conditional values and no unsupported zeros | Flawed | Map/motion points do use raw values; Charts displacement/crisis panel still consumes legacy zeros. |
| Prior legacy equations preserved | Plausible/partially verified | Diff retains legacy executor; run/appState tests pass. No independent historical golden-output comparison performed. |

### Internal Consistency Issues

1. **High — nonzero-month imported snapshot counterfactual resets macro state.** `App.tsx:419` calls `initializeConditionalOutputs(fresh,noCorporateUbiInputs(...))` on shared current snapshots. `simulation/appState.ts:157` uses the same initializer for rebuilt counterfactuals; `simulation/run.ts:188` passes initialize=true. `simulation/conditionalWorld.ts:112`–116 re-infers baseline, sets unemployment=natural, displacedPool=0 and last adoption=current. Real probe: default run at month12 USA unemployment0.06308014549224672; `rebuildCounterfactual(r,[],12,{model:DEFAULT_MODEL}).paired` unemployment0.039 at month12, GDP both73923.79238677846. Thus the plotted difference includes changed unemployment conditions, not just removed transfers, and subsequent macro evolution differs. **Fix:** distinguish true month-zero initialization from same-snapshot zero-transfer evaluation; clone/pin contribution/request then evaluateOnly, preserving economic fields. Test share reopen at month12 with displaced pool and subsequent step, including reference scenario.

2. **High — aggregate finite accounting is not enforced.** `simulation/conditionalWorld.ts:191`–211 uses unchecked weighted sums, population sums and budget sums. Real probes: on a normal initial run, set first2 corporations' requests to `{kind:'amount',monthlyBillions:1e308}`; evaluateOnly succeeds with requested=Infinity/unfunded=Infinity and headline56.399139733693175. Set every country.population=1e308 and every contributionRate=0; evaluation succeeds with populationMillions=Infinity, rawPopulationWeighted=NaN, value=NaN, invalidCountryCount=0. JSON subsequently converts these nonfinite outputs to null. **Fix:** reject nonrepresentable aggregate totals before publishing; use stable normalized weighted means and allocation arithmetic, and verify every budget/receipt/accounting/summary field. Include finite-extreme probes independent of normal fixture values.

3. **High — accepted imported economic state can produce impossible unemployment.** `simulation/conditionalWorld.ts:122`–140 checks pre-step unemployment but not displacedPool/lastAiAdoption/gdpNoAi; no post-macro unemployment validation. `simulation/pure.ts:101`–108 consumes the pool and applies only an upper cap. Real probe: initialize default, set USA.displacedPool=-10, advance one month. Returns unemployment=-9.124420616400444, raw cognitive unemployment=-14.74071067161362 and valid headline56.32272302778143. The snapshot importer evaluateOnly also leaves such hidden state available for continuation. **Fix:** validate all macro state inputs and postconditions (finite/nonnegative pool, positive baseline, adoption bounds, consistent permitted labor/unemployment domains) before accepting import/step. Unverified is not permission for mathematically invalid state.

4. **High — Charts still reports unsupported legacy displacement/crisis results.** `App.tsx:1020`–1026 derives displacement gaps from legacy fields. `App.tsx:1962` onward renders “Displacement Gap by Country”, “Lost wages minus UBI received” and `{state.countriesInCrisis} in crisis` without a conditional capability guard. Conditional executor spreads initial state, never updates those gap/crisis fields; initialCountryData sets gaps0. This is a concrete remaining instance of the same zero-as-result defect the followup fixed in compact map rows. **Fix:** capability-guard/remove these results for conditional mode or implement an explicitly declared supported measure. Preserve the supported conditional wellbeing/chart flow values. Map hover also uses old wellbeing for bar width/color at `components/WorldMap.ts:305`–308 while numeric text uses raw conditional output; align the whole display.

5. **Medium — raw adoption/cap activation is lost.** `simulation/conditionalWorld.ts:133` applies Math.min(.999,raw) without retaining raw or activation. Real probe model.aiGrowthRate=100 gives USA adoption0.999 with macroDiagnostics containing only unemployment/cognitive cap flags. **Fix:** retain raw adoption and flag/cap reason, exposing it beside macro diagnostics; distinguish numerical cap from genuine source exhaustion. The unemployment raw fields are implemented successfully in `simulation/pure.ts:106`.

### Best Practices Violations

- **Medium:** `components/CorporationList.tsx:136` still selects top5 contributors by aiRevenue*contributionRate, while row actual amounts correctly use sourceBudget.actual at248. Amount-request scenarios can omit their largest actual contributor. Sort by actual using the same selector as display.
- **Medium:** source pool is still titled “AI Revenue” in corporation list427/detail181 despite the modeled-source-pool contract. This implies an observed/revenue estimate without the source label at the value. Use the conditional output name and monetary unit locally.
- **Medium:** month0 mapping exists but Charts receives only history and is obscured by “Waiting for Data” at `App.tsx:1911`; no month0 conditional point/reference marker in MotionChart. Axis at `components/MotionChart.tsx:408` remains “Wellbeing Index”. At minimum label conditional output locally and include current/base month0 snapshot, retaining observed initial ladder separately if displayed. Qualification/model-card later work is not demanded here.

### Unaddressed Failure Modes

- `seekInHistory([],0,{model},month12Base)` returns month12 silently (`simulation/appState.ts:74`). App currently preguards this, but helper does not enforce claimed snapshot anchor semantics; reject requested months before base consistently.
- Conditional autosave quota fallback retries identical full-history payload (`App.tsx:1063`) and then removes the prior autosave at1080. Existing fallback wording claims history reduction that does not occur for conditional saves. Prefer preserving last successful recovery and reporting quota failure.
- Large-input acceptance tests currently prove individual finiteness, not closure of composed sums/products.

### Recommendations

Must fix findings1–5, remaining unsupported results, and amount-based ranking before Task4 approval. Add bounded adversarial regression tests with independently specified expected invariants; rerun existing targeted suite. Keep later qualification artifacts/model card/Lab navigation outside this review's acceptance scope. No architectural objection to the separate executor sharing macro primitives under the coordinator ruling.

### Validation Actually Run

`npm test -- simulation/conditionalWorld.test.ts simulation/appState.test.ts simulation/run.test.ts components/ModelUpload.test.tsx src/services/scenarioShare.test.ts` —5files,65tests passed. Real standalone `node --import tsx --input-type=module` probes produced all numeric values above. Source inspected for actual App callbacks, chart wiring, upload guard, share decode and save refresh; no browser test claimed. The passing tests do not cover the adversarial failures.

Minimal reproduction structure (run from `/private/tmp/alignment-stage35` under node/tsx): import DEFAULT_MODEL from constants.ts, initialRun/initOptionsFor/replayTo/advanceRun from simulation/run.ts, conditionalWorld from simulation/conditionalWorld.ts, rebuildCounterfactual from simulation/appState.ts; set `r=initialRun(undefined,undefined,initOptionsFor(DEFAULT_MODEL))`. Apply each mutation named above independently to structuredClone(r); call `conditionalWorld({state:r.state,corporations:r.corporations,model:DEFAULT_MODEL},false,true)` for aggregate probes, advanceRun for displaced-pool/adoption probes, rebuildCounterfactual for snapshot probe.

### Confidence Assessment
**High** confidence in the numerical/state blockers (executed); **high** in remaining chart guard defect (direct unconditional JSX + unchanged source fields). Legacy historical reproducibility and real file-upload/browser interactions remain only partially verified, not newly certified by this review.

### Coordinator browser corroboration and control follow-up

Coordinator independently observed Apple amount-mode12.1875 => paid12.1875/unfunded0/unused12.1875 and36.5625 => paid24.375/unfunded12.1875/unused0; compact map unsupported cards are absent after51fd31a. This is coordinator evidence, not my browser session.

**Medium UX/control consistency:** Contribution Rate remains enabled and displays10% alongside Monthly amount. Source inspection confirms `components/CorporationDetailPanel.tsx:104`–106 explicitly switches fundingRequest.kind to share on slider change: the slider is not disconnected, but silently replaces the selected request mode. Render the rate slider only for share mode, or make switching modes explicit; do not present an inactive percentage as the current funding request. Amount input/type controls are at252–253; unconditional rate slider is270–279.

The same dormant-percent issue is confirmed in the table: `components/CorporationList.tsx:436` names the column Contribution Rate, and511 unconditionally renders corp.contributionRate*100. Amount mode therefore presents10% despite requested36.5625 and funded24.375/source24.375. Represent the active amount request and actual funding (or clearly label dormant percentage); sorting at81–83 must follow the declared active measure. This is current-policy meaning, not cosmetic redesign.

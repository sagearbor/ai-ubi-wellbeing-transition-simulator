## Forensic Analysis: Task5 fix round1, 41ca252

**Domain Lens:** Principal simulation engineer / quantitative methods reviewer. Scoped independent re-review of05cbcd1..41ca252, appended Task5 report, two priorP1findings and nearby regressions. No production edits or subagents.

### Executive Summary

**Spec verdict: PASS for this scoped qualification change. Code-quality verdict: PASS.** Both priorP1findings are resolved in the supported Vite pipeline. The regenerated artifact independently passes the complete arithmetic/allocation/mapping audit and supports **reviewed-conditional source/allocation accounting for the exact default month0–60points**, subject to root's actual browser and final local-record/integration checks. Root has now reported61/61actual Chrome identities matching, with zero derived-output failures; activation of accepted runtime status is still a distinct integration check. The intentionally pending record is correct at this stage.

This report does not claim that the entire repository check passes: root reports a separate stale model-card test and relative-link rendering issue under repair. Neither changes the numerical/qualification assessment here.

### Claim Verification

| Claim | Verdict | Evidence |
|---|---|---|
| Exact authored inputs remain exact | Verified | Identity excludes only country.conditionalWellbeing and state.conditionalSummary; all model/economic/accounting/workforce/money/import/history fields retained. No rounding function introduced. |
| Derived illustrative values checked separately | Verified | evaluateConditionalSnapshot recomputes mapping. Fixed1e-10absolute numerical tolerance, exact keys/booleans/status/null semantics, finite numbers required. Independent adversarial probes pass. |
| Genuine browser default is eligible | Verified for identity/checks by root | Root Chrome153/Vite comparison matches61/61identities, zero derived-check failures, expected executing-source digest. Pending-record refusals only. |
| Builds enforce source freshness | Verified | npm prebuild plus Vite buildStart/generateBundle gates. Independent real Vite build succeeds clean and rejects comment-only stale source in a temporary copied checkout. |
| Dev changes invalidate authority | Verified | Independent real Vite server/watch/transform probe produces one full reload and new actual-source marker after comment-only source mutation. |
| Static local source closure | Verified within declared contract |33source entries match separate SHA256 recomputation; reachable mathParser included. Static relative imports/exports and literal dynamic imports traversed. Dependency declarations/lockfile included; no installed-byte audit claim. |
| Regenerated full artifact reconciles | Verified independently |383cases,23,363monthly snapshots,2,990,464country rows,1,845,677corporation budgets. Complete recipient allocations and mapping components recomputed separately in Python. |

### Original Findings Resolved

**P1 browser identity:** `simulation/qualification.ts` now hashes actual inputs/economic snapshot separately from two explicitly derived illustrative structures. It recomputes those structures before accepting a result and compares them with fixed absolute tolerance1e-10. The tolerance does not apply to model controls, corporate values, workforce assumptions or other actual inputs. Exact type/key/validity checks prevent using numerical tolerance to hide missing fields or invalid full-roster summaries. Accounting fields stay exact. The observed platform issue involved only these excluded illustrative fields; the solution matches the actual failure rather than quantizing all values.

**P1 source freshness:** `build/qualificationSources.ts`, `build/qualificationSourcePlugin.ts`, `simulation/sourceFreshness.ts`, `vite.config.ts` and package scripts now connect the executing-source digest to qualification. Both npm and direct Vite builds check actual files; dev edits invalidate the transformed marker and reload clients. Outside the supported transform, sourceFreshness returns null and reviewed status fails closed. A source edit changes the actual structural identity even if the baseline numbers do not change. The source gate does not need the504MBlocal raw artifact. Accepted metadata remains trusted local authority, distinct from imported scenario metadata.

### Independent Validation

1. Ran `npm test -- simulation/qualification.test.ts build/qualificationSources.test.ts build/qualificationSourcePlugin.test.ts`:3files,8tests pass. Includes accepted-record61month roundoff cases and real1e-12workforce /1e-10money change rejection. Did not rerun the whole passing141test suite.
2. Independently tested missing/extra mapping fields, NaN, flipped validity, wrong coverage count, null valid headline, and1e-8material mapping corruption: identity remains the actual input identity, but derived check rejects each. Tiny1.42e-14mapping variation passes. Untransformed Node resolver refuses source freshness.
3. `/private/tmp/qualification-vite-rereview.ts` runs **actual Vite build and dev transforms/watch handling**, not merely direct hook mocks. Temporary directory contains only the33reachable source files and three small authority JSON files, no raw artifact. Clean build passes; neutral comment edit changes actual hash, triggers one dev full reload, and stale direct build throws. Probe uses a canonical realpath and middleware mode; early fixture attempts used a macOS temp-path alias and uninitialized/port-listening server setup, causing harness-only URL/permission failures before the corrected probe passed. No repository source was altered.
4. Independent Python SHA256 check verifies all33current source-file contents and aggregate structure hash.
5. Re-ran complete independent Python streamed audit using `/private/tmp/independent-profile-rereview.py`; output `/private/tmp/independent-profile-rereview-output.json`. Recomputed every budget from corporate inputs; every global/customer/HQpopulation allocation; all country income, denominator, transfer-ratio/log term, assumed unemployment loss and raw sums; all aggregate accounting, country roster/population coverage, full-roster validity and constraint lists.383cases completed,23,363monthly snapshots,2,990,464country rows,1,845,677budgets,8,945invalid country rows correctly retained/flagged. Ordered case hashes match the new manifest. This rerun establishes arithmetic evidence for the regenerated version rather than inheriting the old payload's acceptance.
6. Generated `node --import tsx scripts/response-profile.ts --check` separately passes in12.808seconds, with zero missing/incomplete/altered/duplicated/calculation/accounting/output failures. Supplementary generated evidence only.

### Frozen Artifact Identity

- Path: `/private/tmp/alignment-stage35/tmp/qualification/world-conditional-v1-profile.jsonl.gz`.
- Bytes:504,339,990.
- Compressed SHA256: `4c59f2189699ffcf78e7846c7dacd833150a0ed975a6aa8cdf75b9cfe629bea5`.
- Header: `dcf73208986c869ae213556b807cd1c5566197bb1634a9faccc4a1b9849631d5`.
- Payload: `058ec0443bf0b28616b97805a86da8a2652d96ff5ae39c98219bd1ffbb58e084`.
- Structure: `950d3fb43937e507c4a2cf67599c92105430a320c337712851a5067a28f3291e`.

Case definitions and numerical equations are unchanged; new source/input identities rebind the regenerated record. Prior numerical examples and their interpretations remain consistent with the new independent stream.

### Internal Consistency / Best Practices / Failure Modes

No remaining blocking finding in the scoped fixes. Identity retains conservative exact economic/accounting snapshots; other future runtime differences outside the excluded illustrative structures may still fail closed. This is preferable to silently widening the reviewed domain. The static graph resolver is not a claim to resolve arbitrary computed imports, runtime external code or installed package bytes. Current checked entrypoints use the supported local import forms; lockfile plus code/data pinning is appropriately described as a reproducibility boundary, not exhaustive runtime attestation.

A tolerance-checked illustrative value remains illustrative, even when its computation is accepted. Raw validity booleans and null headline semantics remain exact; a country cannot cross the0/100mapping boundary merely by borrowing the tolerance. ImportedUnverified and uploaded equations remain disqualifying. The reviewed region remains a finite exact set, with no sampled-grid interpolation or empirical probability interpretation.

### Recommendations / Acceptance Scope

Root may accept the exact61default monthly input identities in a trusted local record for **conditional source/allocation accounting only**, after verifying the activated accepted resolver in the real browser and final active-view integration. Root already reports61/61actual browser identity/check matches; this report does not itself claim activation occurred. No additional numerical/artifact repair is required by this re-review.

Keep macro and conditional wellbeing illustrative. Realized wellbeing timing, transfer-induced macro/demand feedback, total welfare, empirical corporate capacity and full national accounts remain unestimated/unsupported. AvailableShare1 and the market-cap/adoption source construction remain explicit scenario conventions, not profits or validated transfer capacity. Broad empirical causal Stage3qualification is not established.

### Confidence Assessment

High confidence in the scoped software fixes and frozen accounting evidence: targeted adversarial checks, real Vite freshness behavior, independent full-record recomputation and root's exhaustive actual-browser comparison agree. Final full-product test/model-card fixes and accepted-record/browser integration remain root-owned release checks.

### Adjacent Model-card Repair: 3e75694

**Scoped spec: PASS. Scoped quality: PASS.** Reviewed0e38c75..3e75694(diff limited toModelCardTab renderer/test). The introduction now correctly names the default conditional world model and archived legacy evidence. Relative links resolve against the actual `docs/design/model-card-default.md`document URL, so research, response and legacy links reach their correct repository paths. Parent paths and fragments have explicit tests; external web links remain external; non-web protocols are refused and generated href attributes are escaped. The source is trusted checked-in Markdown, and the unchanged raw-HTML escaping remains present.

Ran `npm test -- components/modelcard/ModelCardTab.test.tsx`:1file,5tests pass. Tests render the actual card's scope and evidence links, independently exercise the scrollable-table renderer with a fixture, check relative/parent/fragment/external and blocked-protocol behavior, and render the actual component introduction. Separately verified all three relative document destinations exist in this repository. No qualification source/equation/hash change or additional blocking finding. GitHub main must contain these paths when links are published; this code does not itself publish the branch.

### Final Acceptance Metadata: 562582a

**Scoped final spec: PASS. Scoped final quality: PASS.** Reviewed3e75694..562582a. The trusted local qualification record activates exactly61unique month0–60baseline identities and no other sampled-case region. Independently compared the allowed list against both the manifest baseline list and the baseline's61identity fields in the gzipped raw artifact; they match exactly. Evidence hash remains058ec0443bf0b28616b97805a86da8a2652d96ff5ae39c98219bd1ffbb58e084; source hash remains950d3fb43937e507c4a2cf67599c92105430a320c337712851a5067a28f3291e. The named preserved review report exists and contains those reviewed identities' artifact/source hashes. Local authority is a trusted checked-in record, not an attestation supplied by an imported scenario; the report path is an audit pointer rather than a cryptographic report-content signature.

Documentation accurately names independent **automated** numerical/accounting review, excludes human or empirical approval and whole-grid region acceptance, and retains illustrative macro/wellbeing plus unsupported timing/demand/net-welfare scope. The change makes no new numerical model or raw-artifact claim. The new acceptance tests exercise the actual committed record and Vite-transformed source marker rather than replacing them with mock acceptance values.

Ran `npm test -- simulation/qualificationAcceptance.test.ts components/modelcard/ModelCardTab.test.tsx`:2files,8tests pass. This checks all61actual baseline monthly resolver outputs, separate illustrative statuses, exact whitelist/evidence binding and refusals for tiny real-money/workforce changes, imported flags, supplied equations and material derived corruption. Updated real model-card rendering tests still pass. No blocking finding. Root's activated Chrome-state and final product integration checks remain separate evidence; this addendum does not claim they have finished.

Root subsequently reported the activated Chrome/Vite probe at562582a:61/61accounting states are reviewed-conditional, all macro/wellbeing statuses remain illustrative, and separate money+1e-10, workforce+1e-12, importedUnverified, supplied-equation and raw+.01corruptions return unreviewed. Executing-source hash is unchanged; raw browser evidence is `/private/tmp/stage35-browser-accepted-562582a.json`. This completes the root-owned activated-browser qualification gate as reported; the full repository check is still running at the time of this addendum.

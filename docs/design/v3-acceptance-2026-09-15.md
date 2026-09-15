# v3 acceptance — stages 3–5 integration, 2026-09-15

This record describes the implementation branch `codex/complete-v3-stages-3-5`, including Task 6 corrections at `e529c73`. It is not a deployment or merged-main claim. Recorded automated browser evidence is limited to the builds and flows named below; independent whole-branch review and GitHub checks/merge remain coordinator-owned and pending in this record.

| v3 stage | Accepted implementation scope | Evidence and remaining limits |
|---|---|---|
| 1. Repair experience | Complete run state and explicit upload execution/refusal; failed, cancelled and superseded policy attempts cannot reuse successful output. | Runtime and replay reviews plus the recorded browser flows linked below. Legacy equations retain their declared limitations. |
| 2. Constraints and authoring | Supported equation/stock/flow/aggregate/scalar-solve capabilities, training invariants, shared execution budgets and explicit unsupported-input refusal. | Runtime review and full core validator; unsupported mathematics and geographic mappings remain unsupported. |
| 3. Qualify default | **Conditional source/allocation accounting only**, for exactly 61 baseline snapshots, months 0–60, of `world-conditional-v1`. Meaningful funding/allocation controls, complete response inventory and source-bound review are implemented. | Independent automated numerical/accounting review, not human or empirical approval. Macro and conditional wellbeing remain illustrative. Broad empirical causal qualification is **not established**. Changed scenarios and imported snapshots do not inherit reviewed status. |
| 4. Evidence and generality | Published-reference reproduction, an independently selected data-only model within declared capabilities, and a mapped Alaska case retain explicit discrepancies and classifications. | Existing numerical/reference/ledger validators remain mandatory. Alaska is not a universal transfer dose-response; historical reconstruction does not validate conditional policy effects. No new empirical fit is claimed. |
| 5. Policy exploration and sharing | Supported source → dispositions → assumptions → paired run → native Charts/Compare → link/bundle → reopen paths preserve scenario/model status and execution limits. Unsupported views explain their missing mapping. | All operative clauses have explicit bookkeeping; this does **not** mean all effects are modeled or legally verified. Example S.3877 retains 68 unresolved clauses. Quotation coverage and operative disposition coverage are separate. Recorded browser coverage remains bounded to the named inputs and builds. |

## Evidence actually reviewed

- [Runtime re-review](reviews/2026-09-15-stage35-runtime-rereview.md): execution/resource limits and refusal behavior.
- [Policy re-review](reviews/2026-09-15-stage35-policy-rereview.md): missing links and duplicate dispositions remain invalid/unresolved; semantic completeness still requires identified review.
- [Replay final review](reviews/2026-09-15-stage35-replay-final-review.md): parsed legacy imports retain experimental provenance through replay/re-export; reproduced values do not promote scenario authority.
- [Qualification re-review](reviews/2026-09-15-stage35-qualification-rereview.md): independent streamed recomputation of all 383 cases, 23,363 monthly states, 2,990,464 country rows and 1,845,677 corporation budgets. Scope remains accounting only.
- [Active-policy re-review](reviews/2026-09-15-stage35-active-policy-rereview.md): actual intake/callback ownership, Futures/scenario hydration and visible operative coverage. Its lifecycle harness is not a browser.
- [Browser checks](reviews/2026-09-15-stage35-browser-checks.md): automated Chrome/Vite default qualification and fixed-build supported-flow checks, with untested sources, delivery environments, live provider extraction and human usability stated explicitly.
- [Default model card](model-card-default.md), [conditional response report](conditional-response-v1.md) and [reference ledger](reference-ledger.md) retain scientific and reproduction limits.

## Qualification integrity and reproducibility

The accepted evidence payload is `058ec0443bf0b28616b97805a86da8a2652d96ff5ae39c98219bd1ffbb58e084`; the source structure is `950d3fb43937e507c4a2cf67599c92105430a320c337712851a5067a28f3291e`.

Clean-checkout `npm run check` runs typechecking, all unit/integration tests, anchor/Futures/Korinek/core/policy-case validators, the complete live reference ledger, and the production build. The build's source gate checks the current local import closure and lockfile against the frozen source manifest. `build/qualificationMetadata.test.ts` reconstructs the current profile header and ordered declared case roster without executing cases. It checks header hash, case count, ordered case-hash payload, acceptance linkage, all expected audit counters/zero failures and 61 unique baseline identities. Deliberate missing, changed and reordered hashes must fail even when the saved audit says pass.

These bounded checks establish **metadata consistency**, not the raw artifact's bytes or arithmetic. The gitignored raw artifact is not available automatically on GitHub. To repeat its streamed verification locally from the repository root:

```bash
node --import tsx scripts/response-profile.ts --check
```

If raw evidence is absent, regenerate it locally, compare the resulting manifests against the accepted version, and then check:

```bash
node --import tsx scripts/response-profile.ts --freeze
node --import tsx scripts/response-profile.ts --check
git diff -- data/qualification docs/design/conditional-response-v1.md
```

`--freeze` writes evidence/report files; it is not review or permission to accept changed hashes. Do not use `--refresh-structure` to turn stale implementation into accepted evidence. The reviewed compressed artifact is 504,339,990 bytes with SHA256 `4c59f2189699ffcf78e7846c7dacd833150a0ed975a6aa8cdf75b9cfe629bea5`. Runtime/platform differences can fail closed. There is no arbitrary-platform bitwise reproduction claim or installed-package-byte attestation; fixed roundoff tolerance applies only to explicitly recomputed illustrative derived values, not actual inputs/accounting.

The expensive ledger deletion counterexample has a bounded 120-second timeout after a prior concurrent GitHub run exceeded 30 seconds. Its semantic assertions and numerical tolerances are unchanged. A timeout remains a failing check, not a numerical success.

## Source, key and historical limits

Source quotation offsets and content-bound reviewer attestations provide auditable bookkeeping, not legal completeness or reviewer authentication. A source citation does not establish an effect coefficient. Links omit policy source text and reopen with source coverage unknown; bundles retain source and rerun numerical outputs within their declared contract. Imported world snapshots recompute current accounting but cannot certify supplied macro history or regain reviewed status from saved badges.

The core works without an AI-provider key. Optional Gemini summary/critique/extraction uses the configured provider; a successful manual/example flow does not prove a live extraction request. `GEMINI_API_KEY` is embedded in the client build under the current architecture. No secret was added or rotated and no key-backed service verification is claimed by this integration task.

The monthly source convention (market capitalization × adoption × 0.15 / 12, with an assumed available share) is not measured distributable profit. Corporate costs, demand/transfer-to-macro feedback, realized wellbeing timing and net welfare remain unestimated. The additive unemployment term does not establish independence from the associational anchor. Legacy models retain assumed dynamics and known limitations rather than inheriting conditional accounting acceptance.

The Alaska case uses the published outcome denominator, period and inference; reported discrepancies stay visible. The historical AI-off reconstruction compares 106 countries, with MAE 4.53 versus persistence 4.68; the 335-observation/120-country anchor fit is a different sample. These in-sample comparisons do not validate causal AI or transfer effects. See [Alaska source mapping](research/alaska-pfd-case.md) and [hindcast data notes](../../data/hindcast/README.md).

The complete local check passed on 2026-09-15. Anchor results remain 5 of 6: accounting passes; the documented AT-3 directional/equilibrium expectation remains a reported failure, not a required accounting gate. The ledger retains 312 live targets, 311 computed, with 4 misses, 13 not-checked, 2 not-verified and 6 outside-model. No targets or tolerances were changed to obtain a pass. Existing Node deprecation, server-rendering chart and large-bundle warnings remain.

## Release gates still requiring coordinator completion

| Gate | State |
|---|---|
| Complete local `npm run check` on integrated branch | Passed: 73 files / 1,054 tests, all required validators, live ledger and build; initial sandbox IPC restriction resolved by approved rerun |
| Final production-browser supported flows and accepted default status | Passed within the recorded automated scope: Chrome/Vite `562582a` accepted all 61 default accounting points; fixed production build `e529c73` covered supported policy, Futures and world flows, bundle/link reopen and invalid-owner refusal. No live Gemini request, arbitrary-source/browser delivery, human usability study or accessibility certification. |
| Independent whole-branch review and resolution of blocking findings | Pending coordinator review |
| Fresh GitHub CI, pull request and merge SHA | Pending; no main/release claim |
| Cloud deployment and live demo update | Not performed by this work |

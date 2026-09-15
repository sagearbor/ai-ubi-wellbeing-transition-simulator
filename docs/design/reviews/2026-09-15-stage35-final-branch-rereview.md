## Forensic Analysis: scoped final branch corrections
**Domain Lens**: Principal simulation engineer reviewing recipient units, presentation contracts and release evidence.

### Executive Summary
**PASS: all three original P2 findings are ADDRESSED at `eb80fbf6fb19088e6188698646933e16aa82b5e0`.** No new blocking defect found within the bounded fix diff from `08c28a6`. Overall spec/quality approval is restored within the previously approved conditional accounting and supported policy scope; Task 7 code/CI/metadata approval remains intact. Final rendered corrections and fresh GitHub CI/merge remain coordinator-owned gates.

### Claim Verification
| Original finding | Verdict | Evidence |
|---|---|---|
| Imported conditional dividend uses static population | ADDRESSED | `simulation/appState.ts:212` uses recomputed `conditionalSummary.populationMillions` for conditional states; the prior dataset denominator remains for legacy states. Actual share round trip below now agrees with ledger and global resident receipts. |
| Country detail divides millions by one million again | ADDRESSED | `components/CountryDetailPanel.tsx:284` renders `country.population.toFixed(1)` with explicit `million`; actual component regression renders USA `340.0 million`. |
| Models intro promises refused custom hooks | ADDRESSED | `App.tsx:2194` scopes execution to supported legacy flows, states conditional/anchored refusal, explains that changed optional demand/reputation/Gini hooks are refused, and directs general authoring to Model Lab. Checked against unchanged `simulation/capabilities.ts:13–16`; no support expansion. |

### Internal Consistency Issues
None introduced by the scoped corrections. Both conditional save refresh and share decoding recompute the conditional summary from the validated actual roster before this reader uses it. The fix therefore uses the same population as the allocation ledger, while preserving the old legacy denominator. Existing imported-unverified status is retained.

### Best Practices Violations
No unresolved violation established within this fix diff. README and acceptance edits narrow stale claims and attribute browser evidence to named builds; they do not claim deployment or broad empirical qualification.

### Unaddressed Failure Modes
The previous optional negative-duration `runMonths` hardening observation was not part of the three required fixes and remains non-blocking. This scoped review did not repeat the full raw numerical audit, all 1,054 tests, provider requests or browser work. The fix report's full-check result is attributed evidence, not a newly rerun suite here. UI branch `3f09bb5` is excluded.

### Checks Actually Run
- `npx vitest run simulation/units.test.ts components/CountryDetailPanel.test.tsx --reporter=dot`: **2 files, 8 tests passed**, including existing legacy headline behavior and actual component rendering.
- Independent direct `encodeSharePayload` → `decodeSharePayload` probe with USA population doubled: imported marker remains true, roster population `7783.355799999998` million, headline and ledger both `0.24307317416993857` USD/person/month; USA global receipt per resident `0.24307317416993843` (roundoff only). Assertions passed.
- `node --import tsx scripts/qualification-source-check.ts`: passed with unchanged hash `950d3fb43937e507c4a2cf67599c92105430a320c337712851a5067a28f3291e`.
- `git diff --exit-code 08c28a6..eb80fbf -- data/qualification docs/design/conditional-response-v1.md data/ledger/reference-targets.json`: empty, passed.
- `git diff --check 08c28a6..eb80fbf`: passed.
- HEAD verified and working tree clean. No production edits or subagents used.

### Recommendations
Complete the coordinator's final rendered-correction check and fresh GitHub CI, then proceed with the authorized merge. Preserve existing scientific, raw-evidence and provider limitations in final reporting.

### Confidence Assessment
**High** for closure of all three findings and absence of breakage in this narrow diff. This approval is scoped; it does not expand the original accounting acceptance or certify untested external delivery environments.

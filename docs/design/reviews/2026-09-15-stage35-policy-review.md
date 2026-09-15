## Forensic Analysis: Task 2 policy semantics, 244da02..8780cb5
**Domain Lens**: Principal engineer reviewing policy-model provenance, conservative unit conversion, and adversarial import validation.

### Executive Summary
The main N4 regressions are repaired and N11 quotation overlap no longer automatically supplies operative dispositions. However, AI extraction silently deletes missing operative links, allowing a partly represented clause to appear fully accounted for. **Not ready to proceed until Important finding I1 is fixed**; the small consistency fix M1 should accompany it.

### Claim Verification
| Claim | Verdict | Evidence/Reasoning |
|---|---|---|
| Worker/person and unknown-time identity conversions rejected | Verified | Independent unit probes reject worker→person, household→participant, USD→USD/month. Million USD/year→USD/month retains factor 83333.33333333333. |
| Explicit assumptions persist and invalid ones block entry points | Verified | Existing regression suite independently rerun; invalid assumptions reject direct/worker/reopening. Editor exposes basis and reason; manifest conversion includes warning. |
| Quote coverage distinct from operative coverage | Verified | N11 whole-source quote gives quotation coverage only when no dispositions exist; linked unresolved/outside provisions preserve partial status. |
| Parser preserves all operative links | Flawed | I1: missing links silently filtered, retaining linked status and full-effect explanation. |
| Bookkeeping complete iff every clause validly accounted | Flawed | M1: duplicate disposition yields 2/3 accounted yet text says complete. |
| Source/mapping/disposition edits invalidate review | Verified | Independently changed source title, mapping curve, operative disposition after bound named attestation; each attested flag becomes false. |
| Worked example remains honestly partial | Verified | Independently computed 79 clauses, 79 dispositions, 68 unresolved; no attestation. Existing tests verify 10 nonoperative items, dependencies and actual source. |
| 131 tests/typecheck pass | Verified | Commands below reproduced exact counts and exit zero. |
| Task1 paired budget guard unchanged | Verified | Inspected draft.ts diff: coverage/conversion additions only; combined budget preflight untouched. |

### Internal Consistency Issues / Findings

**Critical: none found.**

**Important I1 — Extraction loses missing mechanism links while keeping full clause disposition.**
- Location: `services/policyExtract.ts:451`, using filtering helper at `services/policyExtract.ts:405`.
- Exact source: `SEC. 1. PAYMENTS.\n(a) Pay a training grant. Limit eligibility to displaced workers.\n(b) Tax robot profits.`
- Supply one mapped funding provision `fund` quoting whole source, setting training_budget. Supply dispositions `sec1(a)` linked to `["fund", "missing-eligibility"]` with reason `Grant and eligibility fully linked`; `sec1(b)` linked to `["fund", "missing-tax"]` with reason `Tax linked`.
- `parsePolicyExtraction` returns only `["fund"]` in both dispositions, `errors:[]`, `demoted:[]`, `droppedExclusions:[]`. `coverage` reports `2 of 2 ... 0 unresolved, 0 outside model — bookkeeping complete`; `validateDraft` returns no errors; `pairedRun` returns `ok:true`.
- This is not a demand that the parser prove legal semantics. Missing identifiers are objectively detectable evidence of an incomplete proposed association; discarding them erases that evidence and strengthens the proposal without review. Human completeness remains unattested, but automated bookkeeping still makes an unwarranted claim.
- Minimal fix: remap known IDs without filtering unknown ones so shared validation rejects them, or demote affected disposition to unresolved and retain missing IDs plus explanation. Add a parser test with one valid and one missing link, and ensure parsed result cannot claim bookkeeping complete or conceal the missing mechanism. Do not remove extraction.

**Minor M1 — Duplicate dispositions produce contradictory complete text.**
- Location: `src/policy/clauses.ts:356-369`.
- With three source clauses and valid linked dispositions for each, append a second disposition for sec1(a).
- `accounted` correctly becomes 2, but unresolved/outside use only the first match; output reads `2 of 3 ... 0 unresolved, 0 outside model — bookkeeping complete`.
- Validator correctly rejects duplicate, so execution is blocked; severity is limited to misleading displayed bookkeeping during invalid/imported draft editing.
- Minimal fix: derive all three lists/counts from one validated per-clause disposition result. At minimum require `accounted === clauses` before complete text and classify duplicate clauses unresolved/invalid. Regression should assert contradiction cannot render.

### Best Practices / Code Quality
The change is narrow, dependency-free, and central validation continues to enforce UI/direct/worker/bundle behavior. Explicit metadata and separately named review claims are appropriate. `operativeCoverage` uses several repeated linear searches and recomputes `sourceCoverage` after its caller already computed it; acceptable at the inspected worked-example scale, but one indexed pass would both simplify consistent validity rules and avoid repeated quote scanning. No observed runtime regression justifies blocking on optimization.

### Unaddressed Failure Modes and Limits
- Named human review is declared metadata rather than authenticated identity, as explicitly allowed. The program cannot establish that a free-text reason correctly accounts for every legal effect; this is not a defect by itself.
- A supplied valid disposition can deliberately assert that a whole clause is represented by a budget mapping. The UI still says semantic completeness requires identified review, so that is distinguishable from software certification. I1 is different: software itself discards a known broken link.
- Source-unavailable drafts retain unknown coverage; legacy drafts without dispositions remain executable partial scenarios. Invalid dispositions do not execute.
- No live provider or browser test performed; UI source and shared UI-state tests reviewed. No Task3/Task4 scope expansion.

### Verification Evidence
Ran in `/private/tmp/alignment-stage35`:
- `npx vitest run src/policy components/lab/policyState.test.ts services/policyExtract.test.ts src/workers` — 10 files, 131 tests passed.
- `npm run typecheck` — exit 0.
- `node --import tsx /private/tmp/stage35-policy-probes.ts` — independent probes described above. Script retained outside checkout for reproducibility.
- Independent malformed matrix: clauseDispositions null/object, string provisionIds, missing provision ID, nonexistent clause ID. All direct runs false, worker paired results false, bundle reopen cannot-open; no throws.
- Independent valid million-USD annual input conversion ran and bundle roundtrip reproduced.
- Independent linked unresolved and outside-model provisions produced respectively one unresolved and one outside-model clause with partial label.
- Independent mapping/source/disposition edits invalidate bound attestation.
- Read-only checkout/index/HEAD; no production modifications or subagents.

### Recommendations
1. Fix I1 and add exact parser regression.
2. Fix M1 with shared per-clause validity and regression.
3. Re-run targeted suite and typecheck; independently re-review the focused diff.

### Confidence Assessment
**High** confidence in the two reproduced findings and tested contracts. **Ready-to-proceed verdict: NO for 8780cb5**, pending I1; implementation is otherwise substantially sound within Task2 scope. No claim of legal completeness or browser usability verification.

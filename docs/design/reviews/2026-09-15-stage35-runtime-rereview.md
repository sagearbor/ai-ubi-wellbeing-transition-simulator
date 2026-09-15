# Task 1 scoped re-review — final disposition

**Final verdict at `244da02`: READY TO PROCEED TO TASK 2.** All five original findings and the sparse-array residual are resolved in this scoped review. The historical round-1 verdict below is retained as evidence; it is superseded by this final disposition. Full branch/application acceptance remains task 7 work.

Reviewed runtime changes `ae236e9..f56819d`; intervening documentation commits excluded. Read appended task-1 report. Read-only checkout review; no production/index/HEAD changes.

**Verdict at f56819d: NOT YET ready for task-1 acceptance.** All five original exact reproductions are fixed, with one adjacent raw-source accounting hole remaining. No numerical/reference regression found. Once the sparse-array check below is fixed and tested, the scoped review has no other known blocker to proceeding to task 2.

## Finding dispositions

| Original finding | Disposition | Independent evidence |
|---|---|---|
| Expanded graph memory omitted | Resolved | Original 900-variable/500-entity/one-step model now rejected at 68,850,500 conservative cells. Ten-entity dense positive control compiles without errors. Inspection confirms node/identifier-edge, solve-through/effects, and key-string costs before expansion. |
| Queued cancellation waits for unrelated active run | Resolved | Queued job cancelled after submission settles before paused active job is released; active job subsequently completes. New host/client test passes cancellation and supersession past cancellation grace without restarting worker. Queue cancellation preserves predecessor ordering. |
| Unary AST depth overflow | Resolved | Original 3001-character unary expression returns limit-exceeded without throw. A 251-character/251-token unary positive control executes successfully. Token/character limits precede parser; processing failures are caught. |
| Raw source cloned/hashed before limits | Original reproduction resolved; residual below | Oversized model with instrumented toJSON: point and ensemble fail with zero serialization calls. Raw checks occur before resolve clone and bounded failure manifest hashing. |
| Empty entities zero resource estimate | Resolved | Original 300-variable/5000-step/empty-ids direct run fails at 4,506,500 cells; fallback entity count is now one. |

## Important residual: sparse array length is not counted before JSON cloning

**Location:** `src/core/limits.ts:82–98` (`checkSourceSize`), consumed by `src/core/engine.ts:232` before its JSON clone.

The new raw-source inspection iterates object keys using `for ... in`. Empty array slots have no enumerable keys, but `JSON.stringify` emits a `null` for every slot. Thus sparse arrays are effectively free in the raw-source estimate despite their potentially large serialized allocation.

Independent reproduction:

```ts
const sparse = new Array(100000);
checkSourceSize([sparse]); // null: accepted
JSON.stringify(sparse).length; // 500001 characters, over the 250000 ceiling
```

Also verified `checkSourceSize([{...baseModel, variables: new Array(1000000)}]) === null`. In runModel, resolution clones before compileModel's variable-count check, so the later declaration limit cannot prevent this allocation. The case is a malformed direct API input (not a schema-valid ordinary model); public direct entry points were explicitly in scope, as with the original empty-entity failure. Only the small 100,000-slot serialization was allocated for proof; no memory-exhaustion experiment was run.

**Minimal fix:** account for array length/holes before iteration, or reject oversized arrays immediately with the source-limit diagnostic. Preserve counting of real element contents and repeated aliases. Test that a sparse array exceeding the source budget never reaches serialization and that a small dense ordinary fixture still passes.

## Verification

`node node_modules/vitest/vitest.mjs run src/workers/runner.test.ts src/core/engine.test.ts src/core/korinekFaithful.test.ts src/core/gasteigerPrettner.test.ts src/core/trainingIntegrity.test.ts validation/ledger.test.ts` — **241 passed, six files**.

Independent `node --import tsx --input-type=module` probes reran each original failure and nearby valid dense/unary cases. Published targets remain unchanged in reviewed runtime diff; faithful Korinek and GP tests passed.

**Confidence:** high for these scoped dispositions; no claim of full application/browser acceptance. Remaining per-realm/completed-result-retention limitations in the implementation report are accurately qualified.

## Final narrow round 2 — `f56819d..244da02`

The only production change charges `5 * array.length + 2` before enumerating array contents. This bounds JSON null expansion for holes, while populated values and keys continue contributing to the conservative estimate. The additional dense-array charge is conservative by design; the limit is not claimed to equal serialized JSON length.

Independent checks:

- Exact `checkSourceSize([new Array(100000)])` reproduction now returns `maxSourceChars`.
- New test verifies a million-slot sparse model is rejected by point and ensemble runners without invoking an instrumented serialization hook.
- Dense `Array(10).fill(0)` passes at an exact tightened allowance of 262 conservative characters and fails at 261.
- Under default allowance, dense zero arrays pass at 8,658 slots and fail at 8,659. The boundary is finite and monotonic.
- The ordinary minimal fixture still executes successfully.
- `node node_modules/vitest/vitest.mjs run src/workers/runner.test.ts components/lab/LabTab.test.tsx`: **46 passed** (27 worker, 19 Lab). Chart size warnings appeared in render tests; no failures. The Lab change only updates the exact expected invariant IDs to include the two previously reviewed training invariants, without weakening a numerical assertion.

No new issue found in this small correction. Previous 241-test/reference verification and five original finding dispositions remain applicable because round 2 changes no numerical equations, solver acceptance, target values or tolerances. **Ready to proceed**, with high confidence within the requested narrow scope.

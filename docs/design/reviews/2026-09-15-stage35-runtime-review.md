# Task 1 runtime integrity review

Reviewed `cbc12b6..ae236e9` in `/private/tmp/alignment-stage35`, independently of the implementation report. During review HEAD advanced to `4e51e96`; that later commit changes documentation/evidence only, and the runtime sources tested remain those of `ae236e9`. No checkout, index, HEAD, or production files modified by this review.

**Domain lens:** principal engineer reviewing numerical correctness, bounded execution, and asynchronous worker lifecycle.

**Ready to proceed: NO.** The numerical, training and ledger corrections are supported by tests and inspection. Combined resource enforcement remains bypassable, and queued cancellation creates a worker lifecycle regression. No Critical issue established; Important findings below need correction and focused regression coverage.

## Strengths and claim verification

| Claim | Verdict | Evidence |
|---|---|---|
| Solver no longer accepts endpoint-scaled jump as a root | Verified | Exact requested residual covered and passing; acceptance now uses absolute residual tolerance. |
| Steep root near zero remains reachable | Verified | Exact `1e12*(u-1e-15)` test passes at residualTol `1e-9`. |
| Stagnation no longer purports to prove a discontinuity | Verified | Floating-point midpoint equality returns no-convergence; evaluated nonfinite interior residual remains distinguished. |
| Negative/excess placements are invalid | Verified | Both requested effect multipliers fail invariant checks; fixture adds final-state checks rather than capping. |
| Either ledger success status needs current numerical evidence | Verified | Full-ledger deletion regression passes; success requires compute, finite non-skipped value, and tolerance success. |
| Original oversized entity/step/variable/draw request is refused | Verified | Added regression passes before result-array allocation. |
| Compilation and all direct entry points have conservative resource bounds | Flawed | Findings 1, 3–5. |
| Async serialization preserves responsive cancellation | Flawed | Finding 2. |

## Important findings

### 1. Compilation dependency edges are absent from retained-memory accounting

**Location:** `src/core/limits.ts:152–156`; expanded allocations in `src/core/engine.ts:437–497`.

The width formula counts variables but not their per-entity dependency Sets and strings. A valid model with 900 variables, 500 entities and one time step passes all new preflight checks while compiling 13,050,000 dependency edges. This defeats the advertised conservative 4M-cell/256MB bound before runtime arrays exist. The work formula does not limit this case either.

Reproduction construction (parameters `[]`, outputs `['v899']`, schemaVersion 1, ordinary id/name):

```ts
const variables = Array.from({length: 900}, (_, i) => ({
  id: 'v' + i,
  equation: i < 30 ? '1' : Array.from({length: 30}, (_, j) => 'v' + (i-j-1)).join('+')
}));
const model = {
  schemaVersion: 1, id: 'dense', name: 'dense',
  time: {start: 0, end: 0, step: 'year'}, parameters: [], variables,
  outputs: ['v899'], entities: {kind: 'region', ids: Array.from({length: 500}, (_, i) => 'e'+i)}
};
checkRunSettings({model}); // []
// 870 * 30 * 500 = 13,050,000 graph dependency edges.
```

JSON source is only 155,694 characters. To avoid intentionally stressing the machine, compiled the same graph at 30 entities: 27,000 graph nodes, zero compile errors, approximately 29.6MB heap increase. That is a small-scale observation, not a measured peak or a claim that the full 500-entity model was executed.

**Minimal fix:** budget graph nodes and dependency edges (including solve-through, effects, initial expressions and aggregate dependencies) before entity expansion; count their retained storage in the combined budget. Bound compilation time/interrupt checks too. Add the full-sized preflight regression and a smaller valid dense graph test.

### 2. Cancelling a queued job cannot acknowledge cancellation until unrelated work finishes

**Location:** `src/workers/execute.ts:207–212`; interaction with `src/workers/host.ts:31–35` and `src/workers/client.ts:154–164`.

`await previous` happens before any cancellation check. An already-cancelled second job stays pending behind a first paused job. The host cannot post its stopped acknowledgment until execution resolves. The client starts a 1.5-second stop-confirmation timer, so cancelling/superseding a queued lane while another lane runs longer than that forces a worker restart and resubmission of unrelated work. Serialization introduced this queue wait into the existing cancellation contract.

Verified with a one-draw job: first `executeAsync` uses `sliceMs:0` and an unresolved `pause`; after that pause is reached, submit second `executeAsync(job, {isCancelled:()=>true})`. It remained unsettled while first was held and returned `cancelled` only after first was released.

**Minimal fix:** make queued cancellation settle/acknowledge promptly while preserving the active reservation and queue ordering. Do not release a queued node in a way that lets following work bypass the active job. Test cancellation and supersession through the actual host/client protocol with an active job exceeding cancelGraceMs; assert no restart of the unrelated lane.

### 3. Bracket depth does not bound expression AST depth

**Location:** `src/core/limits.ts:139–142`; uncaught recursive transform/compile in `src/core/engine.ts:180–218`.

A direct CoreModel with equation `'-'.repeat(3000)+'1'` is below the new 4096-character limit and has bracket depth zero. Preflight returns `[]`, but `compileModel` and `runModel` throw `RangeError: Maximum call stack size exceeded`. This is a syntactically valid unary expression supported by the public direct runner. The JSON schema's equation limit is stricter (2000 characters), so this exact example is a direct-API counterexample, not a claim of a schema-validated upload bypass. Probes at 1000/1500/1900 unary operators succeeded.

**Minimal fix:** bound structural/token depth before recursive processing, or inspect AST safely before transform/toString/compile; catch failures and return diagnostics. Enforce the same expression policy across schema and direct APIs. Test unary chains and right-associated expressions in addition to parentheses.

### 4. Raw source limits run after the expensive copies they claim to prevent

**Location:** `src/core/engine.ts:650–654`, `resolveModel` at `:227`; worker preflight resolves before checking at `src/workers/execute.ts:30–32`.

The incremental source traversal in `checkRunSettings` is useful, but public runners first `JSON.stringify`/`JSON.parse` the entire base and resolve overlays. A rejected oversized run then stringifies the original model and overlays again in `manifestFor`. Thus the 250K source ceiling does not bound initial copies/hash work. Oversized imports or direct requests can allocate substantial duplicate source data before being refused; source/overlay resolution also remains outside cancellation checks. This is established by call ordering; I did not allocate a huge malicious input to demonstrate an out-of-memory event.

**Minimal fix:** bounded raw model/overlay inspection before clone/merge/hash, then a resolved combined check. Produce a bounded failure manifest for rejected source instead of serializing it again. Validation should also short-circuit resource failures before its extra literal-expression scan (`src/core/validate.ts:306`). Add tests instrumenting that oversized source never reaches cloning/compilation.

### 5. Empty entity arrays zero both memory/work estimates but the engine executes one entity

**Location:** `src/core/limits.ts:104` and `:153–156`; fallback in `src/core/engine.ts:331`.

`ids: []` yields entity count 0 for budgets, but compileModel falls back to `['_']`. Verified direct run with 300 constant variables and 5000 steps: preflight `[]`, run `ok:true`, 1,500,000 retained variable cells under `_`. Removing the entities field makes the identical workload correctly fail at 4,505,000 conservative cells. Since zero multiplies every estimate, draw/work limits are likewise bypassed in combined checks.

The upload schema rejects empty ids; this affects direct public runners, which the task explicitly includes. The observed case did not exhaust memory, but proves accounting and execution disagree.

**Minimal fix:** reject empty entity lists consistently or use the engine's actual fallback count in preflight. Add direct point/ensemble regressions; schema-only validation is insufficient.

## Minor findings

- `src/workers/host.ts` still says lanes interleave at slice boundaries, while the new execution queue serializes them. Update this explanation after the scheduling contract is settled.
- Tests cover two-job serialization but not queued cancellation, queue saturation/supersession, error release, dense compilation, or direct AST-depth failure. Add focused cases for the demonstrated failures rather than broad redundant suites.

## Verification performed

- `node node_modules/vitest/vitest.mjs run src/core/engine.test.ts src/core/trainingIntegrity.test.ts src/workers/runner.test.ts validation/ledger.test.ts`: **87 passed**.
- `node node_modules/vitest/vitest.mjs run src/core/korinekFaithful.test.ts src/core/korinek.test.ts src/core/gasteigerPrettner.test.ts`: **163 passed**. No published tolerance changed in reviewed diff.
- Independent `node --import tsx --input-type=module` probes: unary chain overflow, empty-entity budget mismatch and actual run, cancelled queued execution, dense graph preflight and reduced-size compilation.
- Scope limited to task 1 runtime and its immediate protocol interactions. No claim of full application/browser/integration verification.

**Confidence:** high in the demonstrated failures and reference-test results; medium in any absolute memory prediction, because JavaScript object sizes vary and full hazardous workloads were deliberately not allocated. Resolve Important findings before task-1 acceptance, then rerun targeted probes and the preserved references.

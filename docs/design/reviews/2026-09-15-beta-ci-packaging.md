# Hosted CI packaging integration deadline repair — 2026-09-15

## Trigger and diagnosis

The first hosted [CI run 35020019690](https://github.com/sagearbor/ai-ubi-wellbeing-transition-simulator/actions/runs/35020019690)
for draft PR #21 at `35e6d35` failed eight packaging integration cases at
Vitest's default 5,000 ms test deadline. The other 90 files passed; the run
reported 1,253 passing and eight failing tests across 91 files. The packaging
file took 54,775 ms. This is new hosted-runner evidence following the accepted
final review, not a reopening of the scientific or product design.

Exact per-case timings from the hosted log:

| Tampered input | Duration (ms) | Hosted result |
| --- | ---: | --- |
| `train.json` | 5,840 | 5,000 ms deadline exceeded |
| `origin.json` | 5,310 | 5,000 ms deadline exceeded |
| `frozen-fit.json` | 5,429 | 5,000 ms deadline exceeded |
| `predictions.json` | 5,607 | 5,000 ms deadline exceeded |
| `test-outcomes.json` | 5,998 | 5,000 ms deadline exceeded |
| `scores.json` | 5,520 | 5,000 ms deadline exceeded |
| `partition-provenance.json` | 6,007 | 5,000 ms deadline exceeded |
| `sources/GE.EST.json` | 5,132 | 5,000 ms deadline exceeded |
| `sources/provenance.json` | 3,206 | Passed |
| `sources/wgi-indicator-catalog.json` | 3,333 | Passed |
| `sources/catalog-provenance.json` | 3,226 | Passed |

All eight reported failures were `Test timed out in 5000ms`, not identity or
byte-preservation assertion failures. The installed Vitest 3.2.7 runner's
`withTimeout` checks elapsed time after synchronous callbacks return; therefore
blocking `spawnSync` can finish its assertions and still exceed the test deadline.
The former child invocation had no timeout of its own.

The unmodified focused suite passed locally on Node v22.23.2 in 12.55 seconds
(13 tests; command cases 1,061–1,159 ms). Hosted durations include fixture copying,
child startup/execution, assertions and cleanup; the log does not isolate those
costs. Runner contention or filesystem differences are plausible explanations
for the timing difference, not separately measured causes. The demonstrated
failure is the 5-second whole-case deadline applied to real-process integration
work that took up to 6.007 seconds on the hosted runner.

## Minimal repair

Only `scripts/evaluation/packaging.test.ts` changes executable behavior:

- Give the 11 real-command parameterized cases a 30,000 ms deadline. Other tests
  retain their existing default. This is about five times the largest observed
  hosted case, leaving headroom for runner variability.
- Bound each package child with a 20,000 ms `spawnSync` timeout and `SIGKILL`.
  This permits over three times the largest observed whole-case duration for
  the child alone and leaves 10 seconds within the test deadline for fixture
  work, assertions and cleanup. `SIGKILL` prevents an ignored termination signal
  from leaving the synchronous parent waiting indefinitely on that child.
- Require no process error, no termination signal and a non-null exit status
  before checking the existing nonzero status and exact
  `Package identity mismatch` substring. A timeout, startup error or killed
  child cannot count as the expected rejection.
- Preserve all 11 mutations, real artifact copies, real `tsx` package invocation,
  byte-for-byte output comparison and `finally` cleanup.

No mocks, retries, skips, global timeout changes, production changes, source-hash
inputs, frozen data, models, numerical tolerances or scientific targets change.

## Verification

Commands ran from the repair checkout on Node v22.23.2:

```sh
/private/tmp/history-node22/package/bin/node node_modules/vitest/vitest.mjs run scripts/evaluation/packaging.test.ts --reporter=verbose
/private/tmp/history-node22/package/bin/node node_modules/typescript/bin/tsc --noEmit
```

After the repair, the focused suite passed all 13 tests in 12.48 seconds
(12.08 seconds test execution). All 11 actual-command cases passed, taking
1,061–1,143 ms. TypeScript checking exited zero.

A separate one-off Node probe launched an idle child with the same `spawnSync`
timeout/kill mechanism and a shortened 100 ms deadline. It confirmed
`error.code === 'ETIMEDOUT'`, `signal === 'SIGKILL'`, and `status === null`;
each newly added normal-exit assertion rejects that outcome. This probe does not
replace or mock any of the 11 integration cases.

## Limits and next gate

The larger deadline deliberately allows slower real-process tests; it is not a
performance improvement. A hung package child can now consume up to 20 seconds
before failing. Synchronous fixture filesystem operations are not themselves
interruptible by Vitest's timer. No hosted success is claimed from local results:
the remaining gate is scoped independent review followed by the unchanged full
GitHub `npm run check` workflow on the updated PR head.

## Independent scoped review — 35e6d35..e54a435

**Domain lens:** Principal engineer reviewing process-failure assertions and CI integration-test coverage.

**Verdict: ACCEPTED.** This is a bounded harness repair supported by the new hosted timing evidence. No critical or important defect was found. It neither reopens the completed integration review nor establishes hosted success; the exact updated PR head still needs the normal GitHub workflow.

| Claim | Verdict | Evidence |
| --- | --- | --- |
| Failures were test deadlines | Verified in retained hosted log | Packaging reports eight `Test timed out in 5000ms` failures. The repair does not remove a numerical or identity assertion. |
| Deadline change is scoped | Verified | Only the 11 parameterized real-command cases receive 30 seconds; the two other cases and global configuration are unchanged. |
| A timeout cannot pass as expected rejection | Verified | The new assertions require `error === undefined`, `signal === null` and a non-null status before nonzero exit and the existing identity-mismatch message. Independent Node 22 probe produced `ETIMEDOUT`, `SIGKILL`, and null status; that result fails all three normal-exit requirements. |
| All rejection coverage remains | Verified | Same 11 mutations, real child invocation, specific error-message check, byte-for-byte output preservation and `finally` cleanup. Independently reran all 13 tests: passed. |
| Scientific source closure is unaffected | Verified | The diff changes only this test and this report. A direct probe confirms the test is absent from both evaluation and qualification source closures. No data, runtime, model, tolerance or target changes exist in this range. |

Independent execution used Node 22.23.2 and the focused verbose Vitest command above: **13 tests passed**, exit 0, 12.44 seconds total; command cases ranged from 1,055 to 1,134 ms. The separate short-deadline process probe used the same `spawnSync` timeout/SIGKILL mechanism and confirmed the expected failure fields. Worker typecheck is reported evidence and was not duplicated.

No coverage weakening or internal inconsistency found. The deadline raises permitted latency; it does not improve performance. Synchronous fixture I/O remains outside the child's timeout, as the report explicitly acknowledges. The 20-second child bound plus 30-second test deadline is reasonable headroom relative to the observed hosted cases; an unusually slow runner can still fail honestly.

**Recommendation:** push the reviewed repair and verify the unchanged full workflow against its exact hosted head. **Confidence: high for the scoped harness correctness; hosted outcome remains unverified until that run finishes.** No production edits, commits or pushes were performed by this reviewer.

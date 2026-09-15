# Task 2 report

Implemented historical reconstruction artifact and view in the assigned ownership paths. No App, economic harness, observations, core engine, financial module or qualification files edited. Package script additions were removed at the controller's instruction because `package.json` is pinned by legacy qualification; its diff is empty.

## Interface

- `components/history/HistoryExperience.tsx`: default `HistoryExperience(): React.ReactElement`, no props. Task 3 should lazy import and wrap in Suspense.
- `src/history/types.ts`: `HistoryArtifact`, `HistoryReport`, `HistoryMetric`, `annualRows`.
- `scripts/hindcast/export-experience.ts`: generates compact data using the actual `run-hindcast.ts --json` CLI; exports validation/check functions for tests. It does not mirror forecast computation.
- `data/hindcast/experience.json`: version 1, all five runs and 106 countries, annual observations/model outputs, exclusions, source provenance and parameters.

## Commands and results

All final commands run in `/private/tmp/alignment-published-data`:

1. `node --import tsx scripts/hindcast/export-experience.ts` — passed; wrote 740,865 bytes.
2. `node --import tsx scripts/hindcast/export-experience.ts --check` — passed; hashes and all harness results match.
3. `npm exec vitest run src/history/history.test.ts` — passed; 6 tests, 1 file. Includes full actual rerun, transitive hash manifest, stale source rejection, edited non-headline result rejection, missing series/run rejection, null observation gaps, persistence start, all countries and pinned baseline targets.
4. `npm run typecheck` — passed.
5. `npm run qualification:source-check` — passed; source hash `950d3fb43937e507c4a2cf67599c92105430a320c337712851a5067a28f3291e`.
6. `git diff -- package.json` — empty, legacy file preserved.

Artifact size 740,865 bytes, gzip 248,766 bytes; 30 source hashes. Existing Vitest discovery gates freshness through ordinary `npm run check` without script edits.

Exact pinned values retained: 106/128 countries, 2015–2025; headline wellbeing mean absolute error 4.532045217834075; persistence 4.679433962264151; USA modeled 2025 wellbeing 70.81445034207391, observed 68.16. Headline AI and UBI off.

## Findings and concerns

- Direct `tsx` CLI was blocked by sandbox IPC permissions. Standard `node --import tsx` works and is the documented command.
- Existing CLI uses `process.exit`, truncating piped JSON. Export captures stdout to a temporary file descriptor and removes it afterwards; no harness modifications.
- View intentionally omits GDP correlation, no green accuracy badge. Download retains the complete original harness report, including its existing test records; the page does not render their pass/fail badges.
- Browser screenshots, route integration and lazy chunk verification belong to Task 3; not claimed here.
- No fitting, target repinning, source observation edits, qualification changes, push, merge or deployment.

Commit: recorded in completion message; this report is included in the implementation commit.

## Review fix round 1

Accepted the review's correction: the common-GDP-growth explanation was too broad. The selected-run text now applies it only when `run.aiOff` is true. AI-on selections instead state that sensitivity reconstruction does not establish predictive or causal validity. GDP correlation remains omitted for every selection. The research note now distinguishes AI-off common growth from potentially heterogeneous AI-on growth. No model, observation or artifact changes.

Commands run in `/private/tmp/alignment-published-data`:

- `npm exec vitest run src/history/history.test.ts` — passed, 6 tests, 1 file (includes authoritative artifact freshness rerun).
- `npm run typecheck` — passed.

Fix commit: recorded in completion message; this report accompanies the fix.

## Post-publication clean-machine CI fix

Investigated GitHub Ubuntu/Node 22 run `35002901225` failure rather than regenerating outputs. Isolated Node 22.23.2 binary at `/private/tmp/history-node22/package/bin/node` reproduced twelve numeric differences from Node 26.8.2, all AI-on Thailand/India modeled wellbeing; maximum absolute difference 1.4210854715202004e-14. Exact path evidence: `/private/tmp/history-runtime-differences.json`. Math-function diagnostic evidence: `/private/tmp/history-math-diff.json`. Only `Math.pow` results differed; substituting its captured Node 26 results into the temporary Node 22 diagnostic process made the complete CLI report identical. Engine code was never edited.

Implemented the controller-approved 8-epsilon-scaled comparison solely for four modeled/derived country wellbeing fields. All observation values, GDP, aggregates, baseline targets, source hashes and remaining fields remain exact; differences include path and values. Stored artifact report is preserved exactly; its exporter source hash is the only metadata change. Added regression coverage for the twelve observed runtime differences and mutations to observation values at floating-point scale, modeled values, country errors, GDP and scores.

Exact verification from `/private/tmp/alignment-published-data`:

- Before the fix, `npm exec vitest run src/history/history.test.ts` — 7 passed, 1 failed: new actual-Node-22-difference regression failed as expected.
- After the fix, `npm exec vitest run src/history/history.test.ts` — 8 passed under Node 26.8.2.
- `/private/tmp/history-node22/package/bin/node node_modules/vitest/vitest.mjs run src/history/history.test.ts` — 8 passed under Node 22.23.2.
- `npm run typecheck` — passed.
- `node --import tsx scripts/hindcast/export-experience.ts --check` — passed under Node 26.
- `/private/tmp/history-node22/package/bin/node --import tsx scripts/hindcast/export-experience.ts --check` — passed under Node 22.
- Compared `HEAD:data/hindcast/experience.json` with the updated file using Node: `reportIdentical: true`; only changed hash key `scripts/hindcast/export-experience.ts`.

No dependencies/lockfile, economic engine, observations, targets or qualification changes. No push performed. Root owns push and fresh Ubuntu CI confirmation. Commit recorded in completion message.

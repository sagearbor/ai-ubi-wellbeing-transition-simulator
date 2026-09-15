# Task 2 — financial evidence revision and exact collection identity

Implemented 2026-09-15 on `codex/policy-evidence-readiness`, after `ce17f4d`.

## Changes

- Added default collection `reported-company-financials-fy2025-v2`. Apple now cites its audited FY2025 Form 10-K filed 2025-10-31, with printed-page 29/33 locators; all six figures are unchanged.
- Amazon repurchases are explicitly zero from Note 8, page 62. Dividends are zero **derived** from the complete audited retained-earnings reconciliation (172,866 + 77,670 = 250,536 million USD) and the cash-flow statement. Evidence retains `reportedValue: null` with `derivedValue: 0`; the UI labels the inference as derived and shows the reasoning.
- Retained NVIDIA FY2025 and the existing selector's exact end date (2025-01-26). No allocation equation, policy assumption, population, engine, package or lockfile changes.
- Catalog lookup, experiment pins/build/validation, exact-model reconstruction, current source display, and all company/cohort/scenario/view edits preserve the opened collection. New experiments default to v2. Saved v1 experiments display their actual old sources and missing fields.
- Model-origin recognition verifies the declared collection/data hash and complete model/source content. A current collection label cannot authenticate an old Apple source, and imported JSON cannot grant app origin. Both known collections retain reported-observation recognition.
- Renamed the financial action to **Inspect uncertainty** and explained that this deterministic model has no uncertainty ranges; a model file must add ranges before uncertainty comparison is available. No ranges were invented.

## Immutable replay evidence

The six actual pre-revision experiment payloads from `/private/tmp/financial-v1-experiments.json` were copied byte-for-byte into `src/financials/fixtures/v1-experiments.json`, without regeneration. Tests pin both original files' SHA-256 digests:

- Original v1 data: `fa0017ef898082cb7289448a2fc7e174a39039c8b67bd9683aacc8ea7bc64dba`.
- Captured experiment fixture: `12bb8f688e1e087aeda1bfa6d3edceb08b9924c42c6ac818690c890d8c909d6b`.

The v1 data bytes also match `e10c831:data/financials/fy2025-v1.json`. All six original payloads retain data hash `6cc262100734a0ba`, their original A/B model hashes, and their allocation outputs. V2 produces identical allocation series/binding outputs; only Apple's model source identity changes, while the collection's full data hash changes for every v2 experiment.

## Verification

Final verification at 2026-09-15 15:28 ET, **before dependency remediation**, using mathjs **15.1.0**, engine `core-0.3.0`, original numerical hash `df347a35887760b1`:

```sh
npx vitest run src/financials components/published components/guided/App.transitions.test.tsx
npm run typecheck
git diff --check
```

All **126 tests across 8 files passed**, typecheck passed, and diff whitespace checks passed. The tests cover exact old replay, unchanged allocation numerics, default v2, source/derived labels, full-model origin validation, invalid pins, and real component handlers for edits, view changes, file reopen, and exact policy/author/uncertainty links. Existing server-rendered chart dimension warnings do not fail tests. Log: `/private/tmp/beta-financial-final-tests.log`.

## Dependency follow-up boundary

The planned mathjs security patch changes numerical identity. Keep strict numerical-hash validation: historical-runtime fixtures must then fail honestly with an incompatible-runtime explanation. Preserve their original bytes as evidence; do not relabel them as executions of the patched runtime, bundle unsafe historical mathjs, or weaken pins. Revision behavior can be tested using explicitly newly built v1/v2 experiments on the patched runtime. Explicit user-visible migration can be a later feature if needed.

No push, deployment, package change, or browser verification was performed by this worker. The root's independent UI review and final release validation remain separate.

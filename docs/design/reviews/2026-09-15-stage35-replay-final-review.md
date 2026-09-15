## Forensic Analysis: Final Task 3 migration review, 5ff80f9

**Domain Lens**: Principal numerical-software engineer reviewing compatibility and replay provenance.

### Executive Summary

**Spec compliance: APPROVE. Code quality: APPROVE.** The legacy source-import status regression is resolved through the actual parsed intake used by the UI. Both previously reported P2 findings are now closed; no new blocker was found in this scoped migration review.

Reviewed `.superpowers/sdd/2026-09-15-complete-v3-stages-3-5/review-0c2bcf1..5ff80f9.diff` and actual changed implementation. No production edits or agents spawned.

### Claim Verification

| Claim | Verdict | Evidence |
|---|---|---|
| Legacy source-import bundle retains experimental status | Verified | Exact prior probe passed through parseBundleJson before reopen; restored kind experimental. |
| Subsequent exports retain migrated status and original reason | Verified | Next model export experimental; next bundle retains experimental provenance and original importWarnings; next bundle numerically reproduces. |
| Migration does not depend on English warning text | Verified | Independent untranslated nonempty-warning probe behaves identically. |
| Normal fixture path remains unchanged | Verified | Legacy fixture with no warnings and modern explicit fixture both restore fixture and export curated. |
| Modern source-import reason survives | Verified | Structured source-import retains kind/reason through replay and re-export. |
| Core numerical verification remains intact | Verified within scope | Existing numerical identity and bundle corruption suites pass; this commit does not alter execution-engine code. |

### Internal Consistency Issues

None identified in the scoped fix. `src/policy/provenance.ts:33-39` supplies the conservative compatibility fallback. The bundle parser installs it before the UI's status restoration; the model classifier uses the same helper. Existing structured provenance takes precedence, and actual model/overlay content checks remain responsible for preventing false fixture certification.

### Best Practices Violations

No blocking violation identified. The migration is narrow and retains original warning text instead of attempting to extract a new reason from an English sentence.

### Unaddressed Failure Modes

This reviewer did not perform a browser upload. The exact parser, numerical reopening, classification, and re-export path was executed independently. The coordinator additionally reports uploading the legacy shape at 5ff80f9 through the actual browser: experimental scenario, known fixture base, 288 stored values reproduced with zero deviation, and no alerts. This confirms the parsed UI intake migration as well as the earlier custom-overlay restoration check. Direct callers that intentionally bypass parseBundleJson remain responsible for using the documented intake normalization before restoring package metadata; the supported UI uses the parser.

### Recommendations

No further Task 3 fix requested. Proceed with integration work and its planned release checks.

### Executed Tests

- `npx vitest run components/lab/replayProvenance.test.tsx src/policy/replayIdentity.test.ts src/policy/bundle.test.ts` — **24 tests passed in 3 files**. Log: `/private/tmp/stage35-replay-final-tests.log`.
- Independent `node --import tsx --input-type=module` assertions exercised five complete parsed-intake/replay/re-export paths:
  1. Exact previous legacy source-import warning, absent structured provenance → experimental.
  2. Untranslated nonempty legacy warning, absent structured provenance → experimental.
  3. Legacy fixture, no warnings → fixture/curated.
  4. Current explicit fixture → fixture/curated.
  5. Current structured source-import → source-import/experimental.
- All five next policy bundles numerically reproduced; all retained warning arrays where present; model export classification retained expected provenance/status.
- Existing Node module.register deprecation warning only in independent probes; test suite retained existing SSR chart warnings.

The only working-tree change observed was the coordinator's browser-check document; this reviewer made no checkout edits.

### Confidence Assessment

**High** for resolution of the two scoped findings and preservation of exercised replay behavior. Approval is specific to Task 3 and this migration, not a claim that later integration or release work is complete.

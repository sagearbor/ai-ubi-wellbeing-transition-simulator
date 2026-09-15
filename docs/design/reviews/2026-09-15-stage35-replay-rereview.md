## Forensic Analysis: Task 3 provenance fix, 2b50d51..50fb8a9

**Domain Lens**: Principal numerical-software engineer reviewing portable replay and scenario provenance.

### Executive Summary

**Spec compliance: REQUEST CHANGES** for one nearby backward-compatibility regression. **Code quality: REQUEST CHANGES** for the same focused issue; the original custom-overlay P2 is resolved and the new structured provenance is otherwise an improvement. No numerical replay regression was found.

Read the supplied review diff, appended Task 3 report, actual changed source, and the coordinator's browser-check document. No production edits or subagents.

### Claim Verification

| Claim | Verdict | Evidence |
|---|---|---|
| Custom overlay remains experimental after valid replay | Verified | New SSR roundtrip test passes; independent bundle/classification/export probes pass. Coordinator additionally reports actual browser upload displaying experimental scenario + known base fixture and 288 values reproduced with zero deviation. |
| Model curation stays separate from scenario provenance | Verified | Custom scenario exports experimental while curatedMatch still identifies the unchanged base. |
| Edited same-id overlay cannot self-certify | Verified | Existing new regression test plus independent forged fixture-provenance probe. |
| New source-import reason survives sharing | Verified | Independent model-package, policy-bundle, and limited-link API roundtrips retain structured source-import reason. Source-import links remain intentionally disabled in the current UI. |
| Previously supported source-import bundles retain status | Flawed | Finding 1 below. |

### Internal Consistency Issues

**Finding 1 — P2: Migrate existing source-import bundle provenance before deriving fixture status.**

Changed location: `components/lab/PolicyPanel.tsx:423`; helper behavior `src/policy/provenance.ts:21-25`.

The previous implementation exported explicit source-import provenance in `importWarnings`, with no `provenance` field. Those bundles still have the supported `policy-bundle/2` schema and compatible numerical manifest. The fix removes the previous warning-based status override and passes only `bundle.provenance` to `scenarioProvenance`. For an unchanged fixture with no custom overlays, an absent provenance field is interpreted as fixture status. Therefore a bundle actually exported after explicit old-engine source import in the previous implementation now loses its experimental/source-import status when reopened. The warning text remains in the file, but the experimental scenario label disappears and the next export records fixture provenance. This violates the status persistence requirement even though numerical replay remains correct.

Exact runtime reproduction (executed with `node --import tsx --input-type=module` in the checkout):

```js
const draft = threeStatusDraft();
const legacy = buildBundle(training, [], draft,
  pairedRun(training, [], draft, {runs: 2}), {
    importWarnings: ['NEW experimental source import; not replay: Earlier numerical contract']
  });
delete legacy.provenance; // Exact prior-export shape: this field did not exist.
const rep = reopenBundle(JSON.parse(JSON.stringify(legacy)), () => training);
console.log(rep.status,
  scenarioProvenance(rep.model, rep.overlays, legacy.provenance));
// reproduced { kind: 'fixture' }
```

The current UI invokes precisely that helper expression at line 423. Before this fix, the same warning forced imported/experimental status. This probe exercises old-format numerical reopening and the exact classification used by the UI; I did not execute a browser upload of this legacy case.

Fix: normalize legacy bundle provenance at the intake boundary before current classification. Preserve legacy explicit-source status/reason conservatively, then emit structured provenance on re-export. A narrowly scoped legacy migration may interpret the historical marker once; ongoing logic can remain free of English-substring classification. Alternatively retain a conservative experimental fallback for unstructured historical import provenance, while preserving the reason. Do not silently upgrade such records to fixture status. Add a legacy `policy-bundle/2` roundtrip regression alongside the new-format tests.

### Best Practices Violations

The optional new provenance field lacks migration for the previously supported representation. This is the only newly identified blocker. Structured source-import provenance otherwise removes the fragile ongoing status dependency on English warning wording.

### Unaddressed Failure Modes

Actual browser handling of the legacy source-import bundle was not exercised here; the status outcome follows from the exact helper invocation in the callback. Coordinator browser evidence confirms the original custom-overlay case now works through the real restoration path. The prior browser source-import test was on the previous commit, so it does not cover this migration failure.

### Recommendations

1. Add the narrow legacy provenance normalization and regression test.
2. Re-run these focused tests; no broad numerical redesign or further unrelated test expansion is needed.

### Executed Tests

- `npx vitest run components/lab/replayProvenance.test.tsx src/policy/replayIdentity.test.ts src/policy/bundle.test.ts components/lab/LabTab.import.test.tsx` — **34 passed in 4 files**. Log `/private/tmp/stage35-replay-rereview-tests.log`; existing chart/deprecation warnings only.
- Independent runtime probes across custom overlay, forged fixture classification, structured source import, and normal fixture: bundle replay succeeds; next model-package classification and limited-link API reopening retain the expected provenance.
- Independent legacy source-import bundle probe: reproduces numerically but classifies as fixture (Finding 1).
- Working tree remained clean during this read-only review.

### Confidence Assessment

**High** confidence that the original finding is fixed and the legacy regression exists. **High** confidence in the exercised numerical guards; no execution-engine code changed in this fix. Both verdicts remain request changes solely until the legacy status persistence case is handled.

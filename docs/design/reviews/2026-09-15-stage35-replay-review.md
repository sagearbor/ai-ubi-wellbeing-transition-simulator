## Forensic Analysis: Task 3 numerical identity and portable replay

**Domain Lens**: Principal numerical-software engineer reviewing replay identity, adversarial input handling, and provenance restoration.

### Executive Summary

**Spec compliance: REQUEST CHANGES (one medium-severity status portability gap).** Numerical identity and replay verification meet the principal requirements in the exercised cases. **Code quality: REQUEST CHANGES (same focused regression; otherwise sound within reviewed scope).** A valid complete bundle on a known fixture with a custom imported overlay loses the experimental scenario label during UI restoration.

Reviewed task-3-brief.md, task-3-report.md, actual source, and `git diff 14f8469 e622b10`. The separately named `review-14f8469..e622b10.diff` was absent at the supplied checkout path; the exact commit diff was used instead. No production edits, PR, deployment, or agents spawned.

### Claim Verification

| Claim | Verdict | Evidence/Reasoning |
|---|---|---|
| Two and three draws have distinct identities | Verified | Independent runtime assertions and regression tests pass. |
| Deterministic optimization records requested/effective counts | Verified | Independent two/three requested runs each execute one; hashes differ and requestedRuns=2/effectiveRuns=1. |
| Draw index participates in identity | Verified | Individual draw 0/1 hashes differ; edited and rehashed policy firstIndex fails reopening. |
| Package hash/engine mismatch cannot replay | Verified | Wrong hash and old engine classify incompatible-package; corresponding rehashed policy bundles cannot-open. |
| Complete bundle replay validates actual values/settings | Verified | JSON roundtrip reproduces; 12 independent mutation probes refuse replay. |
| Explicit experimental source import exists | Plausible; code inspected | ModelImportPanel.tsx:63-64 requires checkbox, :82 retains reason, :97 excludes source import from curated selection. PolicyPanel.tsx:468-477 provides separate action, clears results/review/completeness, and records reason. Browser upload/click sequence not executed in this review. |
| Files cannot self-certify model curation | Verified for changed model | Changed model with requested curated status exports experimental; curatedMatch rejects changed content. |
| Status survives every complete-bundle restoration | Flawed | Finding 1 below: custom overlay experimental status is dropped. |
| Bundled review names are independently certified | Not claimed | Reopen adds explicit non-certification warning; attributed draft provenance is retained. |

### Internal Consistency Issues

**Finding 1 — P2: Preserve experimental overlay status when reopening a complete bundle.**

Primary changed location: `components/lab/PolicyPanel.tsx:404` (also :420). Related restoration code: `components/lab/LabTab.tsx:235-242`; `pickModel` at :216-223 resets importedOverlayIds, while the experimental-label predicate at :145 requires imported model status or an importedOverlayIds match.

The new opener derives `status` solely from `curatedMatch(vr.model)`. A fixture model plus an externally imported/custom scenario overlay matches the fixture model and is sent to `applyScenario` as curated. `applyScenario` separates unknown overlays into `split.custom`, calls `pickModel` (clearing importedOverlayIds), and installs only customOverlays. Consequently `status === 'curated'`, importedOverlayIds is empty, and `experimental` is false. This is independent of numeric replay success. The string-warning override only helps source imports carrying the literal `NEW experimental`; ordinary imported overlays have no such marker.

Reproduction:

1. Choose training-budget and import an overlay that changes its first parameter, e.g. an overlay `{id:'external-edit', parameters:[{id:training.parameters[0].id, value:training.parameters[0].value+1}]}`. Its originating import path marks it experimental.
2. Run a valid policy draft (the existing threeStatusDraft fixture works), export the complete bundle, reopen it.
3. Runtime probe of this exact bundle returned `reproduced`, its embedded model matched curatedMatch, and importWarnings was undefined. Following the source restoration path above makes the experimental predicate false.

The reproduction's bundle/replay/curation classification was executed; the final React state transition is established from code, not a browser click test. Previously, embedded bundles defaulted to imported, so the newly added curatedMatch branch exposes this regression.

Fix: preserve scenario provenance independently of base-model curation. At minimum, when restoring the curated fixture branch, mark non-fixture overlays as imported/experimental (with exact content checks for fixture overlays), retain warnings, and ensure the next export carries that status. Add one roundtrip test covering a known model plus a non-fixture overlay, checking the resulting UI label and subsequent export. This does not require broad redesign.

### Best Practices Violations

The experimental source-import classification relies on matching an English warning substring (`NEW experimental`) rather than structured provenance (`PolicyPanel.tsx:420`, `ModelImportPanel.tsx:97`). This is a maintainability concern related to Finding 1, not an additional blocker: ordinary status provenance has no equally reliable representation.

### Unaddressed Failure Modes

The source-import action is not exercised by the existing SSR/pure test coverage inspected here. Its code explicitly avoids replay adoption and removes review/completeness claims, but full user interaction coverage remains unverified. No additional numerical corruption acceptance was found in the bounded probes.

### Recommendations

1. Fix Finding 1 and test custom-overlay bundle status roundtrip before marking Task 3 complete.
2. Add an interactive test for old-engine source import, confirming results remain empty until the explicit new run and provenance survives re-export.
3. Prefer structured source-import provenance over parsing warning text when touching this code next.

### Executed Tests

- `npx vitest run src/policy/replayIdentity.test.ts src/policy/bundle.test.ts components/lab/LabTab.import.test.tsx` — **31 tests passed in 3 files**. Only existing Recharts SSR dimension warnings and Node module.register deprecation warnings.
- Independent `node --import tsx --input-type=module` assertions against actual source: valid JSON roundtrip reproduced; two/three ensemble identity distinct; per-draw index identity distinct; deterministic requested/effective counts recorded; changed model cannot export curated; wrong-hash/old-engine model packages incompatible.
- Independent bundle mutation probes, including rehashing edited manifests where relevant:
  - wrong model hash, old engine, firstIndex=1, effective draw count=3, seed=2, requested runs=3, unknown sampler — all `cannot-open`.
  - numeric corruption +1000, null numeric sample, string numeric sample — all `not-reproduced`.
  - tolerance absolute=10 and relative=-1 — both `cannot-open`.
- Independent valid custom-overlay bundle probe: `reproduced; inferred model status: curated; importWarnings: undefined`, supporting Finding 1 with the inspected restoration logic.
- `git status --short` — clean after read-only review (report written outside checkout).

### Confidence Assessment

**High** confidence in numerical checks tested and in the status-restoration code path. **Medium** confidence in complete UI source-import behavior because no browser upload/click test was executed. Numerical quality is strong; one focused portability regression prevents unqualified approval.

## Forensic Analysis: Task 1 frozen temporal holdout

**Domain Lens**: Principal simulation engineer and statistical reproducibility reviewer.

Reviewed commit `6b25ac2` against preregistration commit `0b06312`, read-only except this review. No production edits, refitting, or score tuning. Two provenance fixes are required; the recorded numerical experiment itself reproduces correctly.

### Executive Summary

The registered train/test isolation, historical backgrounds, frozen full-engine execution, cohort rules, units, and first untuned poor wellbeing result are supported by the implementation and independent numerical checks. Default outputs and the historical report remain unchanged. The packaging boundary is weaker than its reproducibility claims: it omits the actual fitter source and accepts mutually inconsistent prediction/score artifacts.

### Actionable findings

1. **P2 — Include the fitter implementation in source identity.** `scripts/evaluation/run.ts:68-70` starts with the historical harness's import closure and manually adds only the evaluation entry files. `scripts/evaluation/fit.ts:2` imports `scripts/countries/anchorFit.ts`, but the latter is absent from the committed `experience.json.sourceHashes`. This is the implementation that computes all three fitted coefficients; an edit to it does not invalidate this source manifest. Reproduction: inspect `Object.hasOwn(experience.sourceHashes, 'scripts/countries/anchorFit.ts')`, which is false. **Minimal fix:** include the fitter and preferably recursively close local imports from evaluation roots using the existing closure machinery. Add a test asserting dependency coverage, not only validating whichever hashes happen to be listed. Refresh metadata without changing the frozen fit or scores.

2. **P2 — Fail closed on inconsistent artifacts before packaging.** `scripts/evaluation/run.ts:65-74` hashes and embeds whatever files are present without verifying the identities those files record. This lets the documented independent `package` stage publish predictions different from the predictions actually scored. **Verified reproduction in an isolated archive of `6b25ac2`:** increment the first `predictions.json.rows[0].ladder` by 1 and invoke `node --import tsx scripts/evaluation/run.ts package`. It exits 0; packaged prediction is `7.908433187516931`, while the embedded scored prediction remains `6.908433187516931`; `scores.predictionsHash !== artifactHashes['predictions.json']`. The existing numerical reproduction test would subsequently detect this, but the packaging command itself emits a contradictory UI artifact. **Minimal fix:** before writing, validate protocol identities, frozen-fit→train, prediction→calibration/origin, score→prediction/test, and partition provenance→sources; also validate background/catalog provenance hashes. Add targeted stale-input tests proving package rejects without overwriting output. This requires no refit or score change.

### Claim Verification

| Claim | Verdict | Evidence/Reasoning |
|---|---|---|
| Protocol precedes this fit | Verified | Protocol bytes exactly match committed `0b06312`; registered SHA matches. This verifies repository ordering, not claims about unrecorded human experimentation. |
| Fit excludes 2019–2025 outcomes | Verified | `fit(Train)` imports pure fitter only, validates explicit 2015–2018 years; separate fit process reads the train artifact. Perturbation test passes. |
| Historical numeric background | Verified | Population and all WGI components are 2015, Gini within 2010–2015; fixed governance transformation uses no outcomes; roster supplies IDs/names only. |
| WGI concepts are estimates | Verified | Pinned source-3 catalogue labels the three GOV_WGI_*.EST indicators approximately −2.5 to +2.5. They are distinct from .SC scores. |
| Same full level engine | Verified | Every one of 84 monthly calls enters `stepSimulationPure`, with the same immutable fitted coefficient object; AI/transfers are zero. Independent recurrence agrees. |
| Default behavior unchanged | Verified | Nine targeted tests pass, including omitted/explicit-default equivalence. Independently restored pre-seam `pure.ts` from `0b06312` in a temporary archive and reproduced all stored pre-edit hashes exactly. |
| Existing observations/targets unchanged | Verified | Commit diff does not change pinned country/outcome datasets or target equations; historical `report` deep equality is exact. Only historical sourceHashes changed. |
| Cohort/missingness honest | Verified | 128 roster countries, 101 backgrounds, 100 origins; 399 train rows plus 113 exclusions; 681 ladder and 691 GDP scores out of 700 each. Outcome masks are independent and persistence-identical. |
| Numerical fitting/scoring correct | Verified | Independent modified Gram–Schmidt QR gives coefficients within 1.48e−12; independent scores reproduce published values. |
| Complete source/artifact identity | Flawed | Findings 1–2. Current values reproduce, but source closure and package validation are incomplete. |
| Blind/as-of/causal/default-world validation | Not claimed | Retrospective revised-2026 vintage, known model form, nominal annual origin, and disabled policy-channel limits are clearly disclosed. |

### Internal Consistency Issues

Only the two provenance findings above are actionable within Task 1. No contradiction was found between the committed scientific result and the research disclosure. The poor primary result is the first paragraph of the disclosure and remains exact in stored scores: wellbeing model MAE `0.3175333128080816`, persistence `0.2897439060205584`.

### Best Practices Violations

The source identity must include the actual numerical fitter, and packaging should validate relationships between artifacts before publishing them. These are integrity issues, not evidence that the current coefficients or scores are wrong.

### Unaddressed Failure Modes

A later fitter source edit can escape the current source-hash gate. Independently running pipeline stages can leave stale intermediate files that `package` currently accepts. Targeted tests cover normal full-pipeline reproduction, but do not currently enforce the packaging rejection boundary.

### Recommendations

Fix the two P2 integrity findings, regenerate identities/package only, and preserve the preregistered protocol, frozen coefficients, predictions, and first scores. Task 2's new qualification is an accepted planned dependency, not a Task 1 defect; do not repin an old qualification certificate. No request to change the retrospective/revised-vintage design or improve this score on the same test set.

### Independent Verification

- Node 22: `node node_modules/vitest/vitest.mjs run scripts/evaluation/holdout.test.ts` — all 9 tests passed.
- Independent Python QR: n=399; coefficients `[5.569374801665549, 5.241191645215925, 8.224203899443427]`; maximum difference from frozen coefficients `1.4725998198628076e-12`.
- Independent monthly GDP/ladder recurrence: maximum ladder error `8.881784197001252e-16`; GDP closed-form error under `5.24e-10` dollars.
- Independent ladder MAEs: `0.31753331280808195` versus `0.289743906020558`; GDP cumulative-growth MAEs: `7.511377553252144` versus `8.64998160201729`.
- Exact pre-seam output-hash capture comparison: true for all six dataset/model combinations over twelve months.
- Exact historical report equality: true. Historical changed top-level keys: sourceHashes only.
- Temporary stale-artifact package probe: exit 0, contradictory packaged and scored predictions, confirmed mismatched identity.

### Confidence Assessment

**High** confidence in the recorded numerical result and scope limitations. **Medium** reliability for the reusable publication pipeline until the two provenance fixes land. No broad test rerun was needed for this bounded review.

## Scoped rereview — afbeaa5

**Outcome: ACCEPT. Both original P2 findings are resolved.** This is a bounded check of the fixes against `6b25ac2`, not a fresh broad scientific review.

- **P2 source closure resolved:** `evaluationSourceHashes()` recursively follows the evaluation runner's local imports, including dynamic stage imports, the numerical fitter, and the integrity checker. The packaged `scripts/countries/anchorFit.ts` hash independently matches its bytes. The regression suite also exercises a previously unseen nested dependency and verifies that changing it changes the recorded hash.
- **P2 package identity resolved:** `assertPackageIdentities()` runs before publication and validates protocol, calibration/training, prediction/calibration/origin, score/prediction/test, partition/source, and background/catalog source identities. Repeated the original reproduction in an isolated archive of `afbeaa5`: incremented first predicted ladder by 1, then invoked the actual package command. It now exits 1 with `Package identity mismatch: scores → predictions`; existing experience.json remains byte-identical.
- **Independent targeted test run:** Node 22 `scripts/evaluation/packaging.test.ts`: all 13 tests passed, including 11 actual-command stale-input rejection cases with unchanged output bytes.
- **No numerical changes:** Independently compared Git blobs between `6b25ac2` and `afbeaa5`: protocol, train, origin, frozen fit, predictions, test outcomes, scores, pre-edit default capture, and partition provenance are all byte-identical. The original untuned poor wellbeing score is preserved.

No remaining finding within this scoped rereview. Proceed to the planned source-bound qualification refresh; no refit or retuning is needed.

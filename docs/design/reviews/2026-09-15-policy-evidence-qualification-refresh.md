# Fresh qualification evidence after the frozen coefficient seam

Implementation source: `afbeaa5`. Independent scoped review accepted this evidence at
`docs/design/reviews/2026-09-15-policy-evidence-qualification-review.md`.
This refresh does not carry forward the previous review's acceptance.

## Scope and source change

The 33-file qualification source closure changes only `constants.ts` (exports
the existing archetype lookup) and `simulation/pure.ts` (optional validated,
readonly frozen anchor coefficients; omitted coefficients retain the existing
defaults). Neither the response-profile generator nor its 383-case suite changed.
Published targets, default coefficients, equations, and frozen holdout results
were not edited by this task.

Old structure: `950d3fb43937e507c4a2cf67599c92105430a320c337712851a5067a28f3291e`.
New structure: `4b16b1021edd2a084d0d7990d675e941e36e6f54d2b3c90127aca8668e47ef60`.

The requested scope is conditional source/allocation accounting for the exact
61 default baseline monthly identities only. The other sampled cases do not
become an accepted parameter region. Corporate scale and availableShare remain
assumptions. Macro and wellbeing remain illustrative; realized timing, demand
feedback and net welfare remain unsupported. Empirical support is not established.

## Reproduction and verification

Run in the repository root, using its installed locked dependencies:

```sh
node --import tsx scripts/response-profile.ts --model=world-conditional-v1 --refresh-structure
node --import tsx scripts/response-profile.ts --model=world-conditional-v1 --freeze
node --import tsx scripts/response-profile.ts --model=world-conditional-v1 --check
npm run qualification:source-check
node node_modules/vitest/vitest.mjs run simulation/qualification.test.ts build/qualificationSources.test.ts build/qualificationSourcePlugin.test.ts scripts/evaluation/holdout.test.ts
node node_modules/vitest/vitest.mjs run validation/conditionalProfile.test.ts simulation/conditionalWorld.test.ts simulation/conditionalAdversarial.test.ts
node --import tsx scripts/hindcast/export-experience.ts --check
```

The full raw gzip remains local and ignored at
`tmp/qualification/world-conditional-v1-profile.jsonl.gz`. The committed small
evidence manifest contains all case hashes, the audit and 61 baseline identities.
The clean-checkout source check requires the small committed artifacts only.
The raw checker requires the retained or regenerated gzip.

Fresh generation exited 0 after 115.096 seconds. The independent-of-generation
raw checker exited 0 after 13.626 seconds with `verified: true`. Both audits
counted 383 expected, attempted and completed cases, with zero missing,
incomplete, altered, duplicate, failed, accounting-failed or output-failed cases.
The source check exited 0 for the new structure hash.

- Raw bytes: `504339788`.
- Raw gzip SHA-256: `01f0e8777a6381c26fce93fba1db9754aeca8032ef07b45e4a691035f4cb1a87`.
- Header hash: `dcf73208986c869ae213556b807cd1c5566197bb1634a9faccc4a1b9849631d5`.
- Payload hash: `8a939fa066115ce58af8de632ebf5fa698886f512b7b07ee2024e5dc9035cac5`.
- Baseline identities: 61 entries, all unique, recorded in the evidence manifest.

The payload, case hashes and baseline identities differ from the old artifact:
the identity deliberately includes the changed structure hash. The generated
numeric Markdown report is byte-identical to its prior generated content after
removing the manually appended old acceptance paragraph. This is consistent
with the unchanged default arithmetic, not new empirical validation.

The initial targeted test run passed 17 tests across four files, including exact
pre-edit default output captures and omitted/explicit-default coefficient
equivalence. The historical direct checker exited 0: “Historical artifact:
hashes and all harness results match.” Logs are retained locally under
`tmp/qualification/policy-evidence-*`.

The profile/accounting/adversarial run exited 0 with 36 tests across three files
passing. It covers failed/omitted cases, incorrect effects/units, nonfinite
diagnostics and conditional accounting invariants.

The independent reviewer accepted conditional source/allocation accounting for
exactly the manifest's 61 baseline identities after reproducing the full baseline
case hash, all 61 monthly identities and 7,808 country-month allocations. The
record now names that new review and activates only those identities. The
acceptance test and current model-card link point to the actual new report.
The evidence manifest's `independentReview: pending` is its generation-time
state; the separately reviewed qualification record supplies current authority.
Root-owned browser verification remains separate.

After activation, `npm run typecheck` and `npm run qualification:source-check`
both exited 0. `node node_modules/vitest/vitest.mjs run
simulation/qualificationAcceptance.test.ts components/modelcard/ModelCardTab.test.tsx`
exited 0 with all eight tests passing. This exercises all 61 actual default
monthly accepted states, illustrative macro/wellbeing boundaries, altered-input
refusals, exact current review/evidence binding and model-card rendering.

# Forensic Analysis: refreshed conditional accounting qualification

**Domain Lens:** Principal simulation engineer and numerical/accounting reviewer.
**Reviewer:** Independent automated Astra numerical/accounting review.
**Decision:** ACCEPTED for conditional source/allocation accounting at the exact 61 default baseline monthly identities (months 0–60) in the evidence manifest identified below. This is an automated independent review, not a human review or empirical validation.
**Reviewed implementation:** `afbeaa5`, plus the fresh Task2 qualification artifacts inspected on 2026-09-15.

## Executive Summary

The new evidence is bound to the current 33-file source closure. Independent recomputation reproduced the complete baseline raw-case hash, every baseline identity, and all 7,808 country-month allocations. The source and snapshot gates fail closed in the targeted checks; no blocker was found within the accepted scope.

The other 322 sampled cases do not become an accepted parameter region. Macro and wellbeing remain illustrative, empirical support is not established, and this decision does not certify holdout validity, forecasts, realized timing, demand feedback, or net welfare.

## Claim Verification

| Claim | Verdict | Evidence/Reasoning |
|---|---|---|
| Evidence binds current execution sources | Verified | Independently called `sourceManifest(process.cwd())`; its hash equals the new structure and evidence hashes. Source closure diff contains only `constants.ts` and `simulation/pure.ts`. |
| Existing case suite retained | Verified | Rebuilt current header from `runConditionalProfile({cases:[]})`; exact header hash matches raw and manifest. Header contains 383 distinct expected IDs; 383 case hashes recombine to the payload hash. Generator, ranges and profile source are unchanged. |
| Raw baseline reflects a fresh current execution | Verified | Read the raw header/base from gzip, checked base line SHA-256, then reran `profileConditionalCase(conditionalCases()[0])`; exact serialized full-case SHA-256 matches. |
| All baseline monthly inputs are current | Verified | Independently advanced `DEFAULT_MODEL` from month 0 through 60 and matched `qualificationIdentity` at every month to the 61 unique manifest identities. |
| Source and allocation arithmetic conserves money | Verified within scope | Separately calculated source as market cap × adoption ÷ 80, available/requested/funded amounts, source decomposition, and route population shares for every default month; compared all 7,808 country-month receipts with raw evidence and funded totals. |
| Whole raw suite passes existing audit | Verified computational audit, not independent scientific replication | Inspected checker implementation and fresh worker log: 383 attempted/completed, zero missing/incomplete/altered/duplicates/failures/accounting failures/output failures, exit 0. Avoided a redundant second full-suite pass; independent recomputation covered the accepted baseline region. |
| Runtime rejects altered or unreviewed points | Verified | Targeted identity tests exercise all 61 months and altered corporate/country/import/equation/derived values. Source/plugin tests exercise numerically neutral source edits and direct-build rejection. |
| Scientific capability or targets expanded | No expansion found | Scope/capability implementation is unchanged. New source changes export an existing archetype function and add optional finite-validated readonly anchor coefficients with default fallback; Task1 default-equivalence review is separate. |

## Exact evidence identities

- Structure SHA-256: `4b16b1021edd2a084d0d7990d675e941e36e6f54d2b3c90127aca8668e47ef60`.
- Payload SHA-256: `8a939fa066115ce58af8de632ebf5fa698886f512b7b07ee2024e5dc9035cac5`.
- Independently reproduced baseline case SHA-256: `e428fc89229cdc2b45c966cf55ccdd7ab7c31c8413dd5d95e9f63b4e86be8ca7`.
- Raw: `tmp/qualification/world-conditional-v1-profile.jsonl.gz`, independently checked size 504,339,788 bytes.
- Raw file SHA-256 reported by refresh worker: `01f0e8777a6381c26fce93fba1db9754aeca8032ef07b45e4a691035f4cb1a87` (file-wide checksum not independently repeated here).
- Accepted identity list: exactly `baselineRunIdentities` in `data/qualification/world-conditional-v1-evidence.json` with the payload hash above; 61 entries and 61 unique values.

At months 0, 1, 12, 24 and 60, the independently checked modeled monthly source is 250.13262500000005 and funded amount is 25.742256250000004 billion constant-2015 USD. These are conditional assumption outputs, not measured profits or benefits.

## Internal Consistency Issues

No blocking inconsistency found in the accepted scope. The pending acceptance record is intentionally not treated as a failure: this review supplies the decision required before updating that record. The old acceptance paragraph was removed from the regenerated response report rather than silently reused.

## Best Practices Violations

No new blocking violation found. Authority remains local to the supported build/dev pipeline and exact snapshot identity. The static source closure binds repository source plus locked dependency declarations; it is not an installed dependency byte audit or a hostile-local-filesystem security guarantee.

## Unaddressed Failure Modes and Limits

Corporate scale and availableShare remain assumptions, not measured distributable profits. Computational consistency does not establish causal or predictive accuracy. The absolute tolerance of 1e-10 applies only to recomputed derived illustrative mappings; authored inputs remain exact. Raw evidence is retained locally rather than committed, so independent full-suite reproduction requires regeneration or that retained file. Nonbaseline inputs remain unreviewed even if sampled elsewhere in the 383-case grid.

## Verification performed

Both commands below exited 0 during this review:

```sh
node --import tsx tmp/qualification/independent-refresh-probe.ts
node node_modules/vitest/vitest.mjs run simulation/conditionalWorld.test.ts simulation/qualification.test.ts build/qualificationSources.test.ts build/qualificationSourcePlugin.test.ts validation/conditionalProfile.test.ts
```

The local review probe reads and binds the retained raw baseline, reproduces its entire serialized case hash, advances the default model independently, and recomputes accounting and population allocation arithmetic. Result: 383 expected distinct cases, 61 matching monthly identities, 7,808 matching country-month allocations. Targeted tests: 27 passed across five files, including below/at/above funding exhaustion across all three routes, unit checks, input tampering and stale source tests. Source mutations were confined to temporary test directories.

Full-profile reproduction and raw checking use the unchanged commands:

```sh
node --import tsx scripts/response-profile.ts --model=world-conditional-v1 --refresh-structure
node --import tsx scripts/response-profile.ts --model=world-conditional-v1 --freeze
node --import tsx scripts/response-profile.ts --model=world-conditional-v1 --check
npm run qualification:source-check
```

The refresh worker's full raw-check log was inspected at `tmp/qualification/policy-evidence-raw-check.log`; it reports `verified:true` and the exact payload/structure hashes above.

## Recommendations

1. Set the acceptance record to accepted with reviewer `Independent automated Astra numerical/accounting review`, this report path, these exact source/evidence hashes, and exactly the manifest's 61 baseline identities.
2. Update the acceptance regression test to require this actual report and run it after recording the acceptance.
3. Keep all existing illustrative and unsupported capability labels unchanged. Any later source, evidence, or baseline identity change requires renewed qualification.

## Confidence Assessment

**High for the narrow source/allocation accounting decision.** Exact current baseline replication and independent arithmetic support this conclusion. No empirical support or broader scientific reliability rating is conferred.

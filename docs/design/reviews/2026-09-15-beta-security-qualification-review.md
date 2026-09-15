# Forensic Analysis: beta dependency repair and fresh accounting qualification

**Domain Lens:** Principal application-security engineer and simulation/accounting reviewer.

**Reviewer:** Independent automated Astra security/numerical review.

**Reviewed change:** `a315438..10142e8`, inspected on 2026-09-15 in `/private/tmp/alignment-policy-evidence`.

**Verdict 1 — ACCEPTED within the repair scope.** Compatible dependency repairs preserve strict expression/runtime guards, refuse immutable old-runtime financial captures, preserve historical evidence, truthfully refresh source provenance, exercise patched YAML protections, and add accurate adjacent Google Gemini disclosure. No blocking regression found. This is not certification that the whole project has no vulnerabilities.

**Verdict 2 — ACCEPTED only for the new exact 61 default baseline monthly source/allocation accounting identities (months 0–60)** in the evidence manifest with structure/payload hashes below. This is an independent automated review, not human review or empirical validation. The pending/empty authority record is deliberate and is not a defect; this report supplies the scoped decision needed before activation.

## Executive Summary

Independent recomputation reproduced the complete raw baseline case, all 61 exact identities using a separately implemented canonical serialization, and all 7,808 country-month allocations using separate accounting arithmetic. All 383 raw case-line hashes, the entire gzip checksum, the 33-file source closure, both immutable financial fixtures, and all nine frozen historical/holdout witnesses were verified.

The remaining two moderate development-package flags represent one Vitest advisory. Acceptance does not extend to other sampled inputs, macro/wellbeing interpretation, causal support, successful live AI extraction, deployment, forecasts, realized timing, induced demand, or net welfare.

## Claim Verification

| Claim | Verdict | Evidence/Reasoning |
|---|---|---|
| Dependency repair avoids a major upgrade | Verified | Programmatic comparison of both lockfiles found 58 changed existing package versions, all within their prior major; includes platform/tool dependencies. Direct changes are ajv 8.20.0, js-yaml 4.3.2 and mathjs 15.2.0. |
| Strict expression and runtime gates remain intact | Verified | No changes to `src/core/engine.ts` or policy bundle runtime guards; inspected expression allowlist and numerical-conventions checks. 21 adversarial and 11 bundle tests independently passed. |
| Old runtime is explicitly refused | Verified | `src/financials/share.ts:47` adds the explicit incompatibility error ahead of the unchanged full pin comparison. Actual old capture bytes remain unchanged; financial tests refuse them and distinguish newly built current-runtime v1/v2 experiments. Published file-open test preserves current state on refusal. |
| YAML parser handles tested hostile inputs | Verified, bounded | Three independently rerun tests exercise excessive nesting, excessive merge work, executable tags, duplicate keys and normal YAML. Parser uses patched js-yaml defaults. This is not a general unlimited-input denial-of-service guarantee. |
| Provider disclosure matches extraction | Verified | `PolicyPanel.tsx:612` states that pasted text/model details go to Google Gemini and manual drafting is local. `services/policyExtract.ts:145` builds that prompt and line 476 sends it with the Google client. No live external request made during review. |
| Packaging changes preserve historical evidence | Verified | Recursive JSON comparison found only `/sourceHashes/package-lock.json` changed in each historical/holdout experience record. Every current source pin independently matches its file. All nine frozen witness hashes match. |
| Runtime variation was not mislabeled patch drift | Verified for retained controls | Independently compared saved Node 22 pre/post reports: exact JSON equality. Worker reports same-runtime Node 26 equality to its preserved witness. Node 22-versus-26 last-bit differences are not evidence of dependency drift and no tolerances were changed. The Node 26 regeneration was not repeated in this review. |
| New source closure is fresh | Verified | Independently hashed all 33 pinned files and reconstructed the manifest hash; compared with current closure discovery. Only package.json and package-lock.json closure entries differ from the previous structure. |
| New baseline and allocations are reproducible | Verified within accepted scope | Full-case SHA-256 exact; independently serialized monthly identities exact; separate source/budget/allocation arithmetic checked 61 months × 128 countries. |
| Entire parameter region is reviewed | Flawed if claimed | The remaining 322 cases are computational coverage, not an accepted input region. Only the manifest's exact 61 baseline identities are accepted. |

## Exact evidence identities

- Structure SHA-256: `6d3da294a002ee6ee0000c31d2b1af1723901287e6c5806c35c04d4d4f204206`.
- Payload SHA-256: `66feccd9efd7393646a2ce64b249901c97381237527c3d869cc4753dab33fa73`.
- Header SHA-256: `dcf73208986c869ae213556b807cd1c5566197bb1634a9faccc4a1b9849631d5`.
- Independently reproduced baseline case SHA-256: `1604ecca16b1ebeb9bec38b9cb0cb137818daf384dae4dd7c8d7f72652873d2a`.
- Independently computed gzip SHA-256: `e87dce0adfae2dfc38a56681b73bca7e3b2edca03a006d903e93b0ba406c5cf3`.
- Raw gzip: `tmp/qualification/world-conditional-v1-profile.jsonl.gz`, 504,339,058 bytes.
- Accepted identities: exactly the 61 unique `baselineRunIdentities` entries in `data/qualification/world-conditional-v1-evidence.json` bound to the hashes above.

The independent probe streams every raw JSONL case and recomputes all 383 line hashes and their payload hash. It regenerates the header and full baseline through current execution, then separately removes only the defined derived fields and canonicalizes each default monthly snapshot without calling `qualificationIdentity` or `qualificationInputText`. It computes modeled monthly source as market cap × adoption ÷ 80, reconstructs every budget field and destination-population allocation, and checks raw receipts plus current run receipts and aggregates. Maximum absolute arithmetic discrepancy was `1.7763568394002505e-15` billion constant-2015 USD/month; the independent check used fixed absolute `1e-10`. This comparison threshold does not change production tolerances; case and identity hashes matched exactly.

## Internal Consistency Issues

No blocking inconsistency found in this scope. The regenerated manifest is pending, its authority identities are empty, and old acceptance prose was removed rather than transferred. Generated response-report numerical content is unchanged. Existing source-only interpretation remains essential: source pins certify repository source and dependency declarations, not installed dependency bytes or an old-runtime result's reproduction.

Both immutable fixtures independently match their recorded checksums: financial v1 data `fa0017ef898082cb7289448a2fc7e174a39039c8b67bd9683aacc8ea7bc64dba`, and saved experiments `12bb8f688e1e087aeda1bfa6d3edceb08b9924c42c6ac818690c890d8c909d6b`.

## Best Practices Violations

**Moderate, residual development dependency:** the recorded full audit has two affected package flags (`vitest`, `@vitest/mocker`) for one advisory, [GHSA-82fw-gwwq-j7x9](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9). The primary advisory confirms patched 4.1.11 and a maintained 5.x fix, requiring a major upgrade from installed 3.x. Its unauthenticated exposure is standalone mocker/interceptor integration with a reachable development server; repository search found no such integration or Vitest browser usage outside dependency metadata. This bounds observed exposure but does not certify all environments safe.

The inspected post-repair production audit records zero vulnerabilities; the full audit is **not clean**. Those are recorded audit results, not a fresh network audit performed by this reviewer. No broad claim is made that every prepatch advisory was reachable.

## Unaddressed Failure Modes

Corporate source scale and available share are authored assumptions. Arithmetic consistency does not establish distributable profits, measured benefits, or causal/predictive validity. Macro and wellbeing stay illustrative. Raw evidence is retained locally rather than committed. Source closure is not protection from a malicious local dependency installation. Independent full historical regeneration was not repeated; preserved witnesses, exact packaging diffs and retained same-runtime controls were checked. AT-3 remains a miss; targets, cohorts, outcomes, coefficients and tolerances were not altered by this repair.

## Verification Performed

Independent probe: `tmp/qualification/beta-independent-security-review.ts`; output: `/private/tmp/beta-independent-security-review.log`. Node v22.23.2; exit 0; 383 raw cases, 61 exact independently constructed identities, 7,808 allocations.

Independent tests: 68 passed across seven files: parser security, core adversarial, financial share, published revisions, source manifest, source plugin and policy bundle. Logs: `/private/tmp/beta-independent-security-tests.log` and `/private/tmp/beta-independent-bundle-tests.log`. These are targeted checks, not a repeat of the worker's 260-test suite.

Worker final raw-check log `/private/tmp/beta-security-raw-check.log` was inspected: expected/attempted/completed 383, zero missing/incomplete/altered/duplicate/failing cases, zero accounting/output failures, exact current structure/payload. All nine checksums in `/private/tmp/beta-predependency-frozen-hashes.json` were independently recalculated against current files. Node 22 comparison used `/private/tmp/beta-prepatch-node22-report.json` and `/private/tmp/beta-postpatch-node22-report.json`.

## Recommendations

1. Activate only this report's exact structure/evidence hashes and the manifest's 61 baseline identities, with reviewer `Independent automated Astra security/numerical review` and this report path.
2. Run the acceptance/source checks after activation; retain unchanged illustrative and unsupported capability labels. Any source/evidence/identity change requires renewed qualification.
3. Track the separately verified Vitest major upgrade; keep the residual advisory explicit. Final browser, live-provider behavior, CI and deployment are outside this review.

## Confidence Assessment

**High for the bounded repair and exact baseline accounting acceptance.** Direct diff inspection, preserved witnesses, independent full-baseline replication and separate arithmetic support the decision. No broader empirical, security, or deployment certification is conferred.

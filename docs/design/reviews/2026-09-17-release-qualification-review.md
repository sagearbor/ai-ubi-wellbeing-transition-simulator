# Forensic Analysis: release metadata and refreshed conditional accounting qualification

**Domain Lens:** Principal build-integrity engineer and simulation/accounting reviewer.

**Reviewer:** Independent automated Astra release/accounting review.

**Reviewed on:** 2026-09-17, in `/private/tmp/alignment-combination-review`, against `origin/main` commit `2187ce27ec4090aaba3dcd38d4380583aff8c35a`. The reviewed working-tree source is identified by the exact 35-file structure hash below; this report does not approve every other change in the working tree.

**Verdict — ACCEPTED for exactly the 61 default baseline monthly source/allocation accounting identities (months 0–60) listed below, bound to this report's structure and evidence hashes.** This is independent automated review, not human approval or empirical validation. It does not accept the remaining 322 cases as a reviewed input region, nor qualify macroeconomic or wellbeing outputs.

## Executive Summary

The final pinned source changes add release identity metadata and its Vite registration. Both package files, simulation equations, authored inputs, profiling code, and qualification guards are unchanged. Independent verification reproduced the complete current baseline, separately constructed all 61 input identities, and checked 4,819 corporation-month budgets and 7,808 country-month allocations with separate arithmetic.

Every current raw case hash matches the new evidence manifest. All 383 captured cases exactly match the authenticated previous artifact after removing only the source-bound monthly identity fields. All 140 tracked files under `data/evaluation/` match their `origin/main` bytes, and all 144 source/data binding entries across six research scoring manifests match their referenced files. No historical evaluation was regenerated or rescored in this review.

## Claim Verification

| Claim | Verdict | Evidence/Reasoning |
|---|---|---|
| The source refresh is necessitated by release metadata | Verified | The closure expands from 33 to 35 files, adding only `build/releaseIdentity.ts` and `build/releaseIdentityPlugin.ts`. Only the existing pin for `vite.config.ts` changes. Every current file hash and the aggregate structure hash were independently recalculated. |
| Package files preserve configuration and frozen scoring bindings | Verified | `package.json` and `package-lock.json` are byte-identical to `origin/main`. The package SHA-256 is `1140ff24493d0300954fccf775b6603ed21d39e885d5e732975074fda8880e86`, matching all six research scoring manifests. Every one of their 144 binding entries was independently checked; repeated paths in different manifests count as separate entries. |
| Release metadata does not modify economic execution | Verified within inspected implementation | The new plugin resolves/loads only `virtual:release-identity`, publishes `/release.json`, and emits `release.json`. Its helper reads Git/package identity and stages source archives. Neither module imports economic code or transforms simulation modules. The only Vite changes are the import and plugin registration. |
| Release metadata preserves captured numerical outputs | Verified for all retained cases | Separately hashed every captured case after deleting only `months[*].identity`; all 383 match the previous raw artifact exactly. No numerical fields were rounded, dropped or compared with tolerance for this check. |
| Evidence is internally complete and source-bound | Verified | Streamed 383 unique cases, months 0–60 in order for each, no recorded case failure, exact case-input hashes and expected IDs, every line hash, payload hash, header, raw byte count and current source closure. |
| The exact baseline is reproducible | Verified | Re-running the complete production baseline yields the identical case-line SHA-256. A separate serializer also reconstructs all 61 exact monthly identities without calling the production identity/serialization functions. |
| Baseline budgets and allocations satisfy the declared accounting | Verified, bounded | Separate source, available/requested/funded, reserved/unfunded/slack, destination-population and channel arithmetic checks 79 corporations and 128 countries at each of 61 months. Raw snapshots, current run receipts, allocation channels and ledger aggregates agree. |
| Historical evaluation witnesses are preserved | Verified | Independently compared all 140 tracked `data/evaluation/**` files with their `origin/main` bytes, including score receipts; no added untracked files in that directory. |
| The full scenario grid, macro effects or wellbeing are approved | Flawed if claimed | Computational coverage and numerical preservation do not establish empirical validity or approval outside the 61 exact default accounting points. |

## Exact Evidence Identities

| Artifact | SHA-256 |
|---|---|
| Structure | `c347dced7c5634b9aabbb517fb7aec2f86f69ceab8a7cd942ca893458a1fc894` |
| Payload | `0e09841fb2f7afecfb93846f38c18d37cb40a4a77772902be188378210a6cced` |
| Header | `dcf73208986c869ae213556b807cd1c5566197bb1634a9faccc4a1b9849631d5` |
| Reproduced baseline case | `2d3ebdce2965a98e3b59581b4223fdc1a60885a326b08e2c52590b4e82ab1267` |
| Current raw gzip | `29ba03b00827c7bdb0edccda5eef4c098bfcfa86c28024273149f37d761d7b49` |
| Ordered 61-identity JSON array | `59a35e8637920272d96bcc7afef2ab4fba85a0a8360701156f067f59ebde1832` |
| Previous raw gzip, authenticated before comparison | `e87dce0adfae2dfc38a56681b73bca7e3b2edca03a006d903e93b0ba406c5cf3` |
| Frozen evaluation path-to-SHA-256 witness map | `96159635445876548b5939d3d42effe3f4ec6f5142bce5ea4995b9dc303ed391` |

Current raw artifact: `tmp/qualification/world-conditional-v1-profile.jsonl.gz`, **486,580,654 bytes**. The gzip hash identifies retained compressed bytes; the payload hash binds the ordered 383 case-line hashes. The header is separately bound. The prior gzip checksum matches the [2026-09-15 independent review](2026-09-15-beta-security-qualification-review.md), and every previous case-line hash also matches the evidence manifest committed in `origin/main`.

The 61 identities are ordered by month and exactly equal `baselineRunIdentities` in `data/qualification/world-conditional-v1-evidence.json` for the hashes above. They are explicitly enumerated at the end of this report to bound activation.

## Internal Consistency Issues

No blocking inconsistency was found in the final snapshot. The initial review checked preservation of evaluation bytes but did not check every research source binding. Integration tests exposed that the two added package aliases violated the research manifests’ exact `package.json` pin despite leaving the economics unchanged. The aliases were removed, both package files now match `origin/main` byte-for-byte, and this repeated independent review checks all six manifests and their 144 binding entries. This final revision supersedes the earlier same-day qualification snapshot and identity list.

At the final probe the authority record is deliberately pending with an empty identity list and previous hashes. It must not grant reviewed status until activation uses the exact new identities and hashes. The freshly generated evidence's own `independentReview: "pending"` is a generation-time label, not the activation authority; this review does not rewrite it.

The generated response report differs from `origin/main` only by removal of the old acceptance paragraph. Its numerical tables are unchanged. A source-neutral build addition still changes the source-bound input identities, so previous acceptance cannot be transferred by retaining the old identity list.

## Best Practices Violations

No new blocking violation was found in the scoped source-closure changes. The existing source-freshness guard remains unchanged and was exercised independently. The new metadata plugin has no generic source transformation hook; its virtual module is separate from the existing execution-source marker.

This review does not constitute a dependency security audit, deployment review, credential-handling review, or verification of every change in the release branch. Earlier security findings are neither rescanned nor resolved by this acceptance.

## Unaddressed Failure Modes

Corporate source scale, available share and monetary provenance remain authored assumptions. Arithmetic consistency does not establish distributable profits or measured policy benefits. Macro and wellbeing remain illustrative; realized timing, induced demand, transfer-to-macro feedback, net welfare, empirical probability and predictive/causal validity remain unsupported.

The independent baseline probe uses current simulation execution to obtain complete snapshots and checks accounting with separate arithmetic. It does not independently implement or validate macro dynamics. Full-case replication through the production profiler is a reproducibility check, not independent validation of that profiler. The comparison of all 383 cases proves preservation of captured values, not correctness or approval of the other 322 cases.

Source closure binds repository source and dependency declarations, not installed dependency bytes or a deployed artifact. Raw evidence and the probe logs are retained locally rather than committed. The historical evaluation check verifies preservation of existing bytes, not the validity of the scores. History UI changes, browser behavior, live provider behavior, final build, and deployment are outside this review.

## Verification Performed

Independent probe: `tmp/release-verification/independent-qualification-review.ts`. It was written after inspecting the prior probe and the production source; it extends the checks to separate allocation channels, raw corporation budgets, ledger aggregates, all current/previous case captures, exact package preservation/Vite diff constraints, all frozen evaluation witnesses, and all research scoring-manifest bindings. It does not invoke `qualificationIdentity`, `qualificationInputText`, `canonicalJson`, `sourceBudget`, `allocateConditional`, or `auditConditionalProfile` for its independent identity/arithmetic assertions.

Probe command, run from the review checkout:

```sh
/private/tmp/history-node22/package/bin/node --import tsx tmp/release-verification/independent-qualification-review.ts
```

**Node v22.23.2; exit 0.** Results: 35 current source files; 383 current raw cases and 383 unchanged numerical captures; 61 unique independently constructed identities; 4,819 corporation-month budgets; 7,808 country-month allocations; 140 unchanged frozen evaluation files; 144 matching binding entries across six frozen research scoring manifests. Maximum absolute arithmetic discrepancy was `3.552713678800501e-15` billion constant-2015 USD/month. The independent arithmetic threshold was fixed absolute `1e-10`; no production tolerance or frozen artifact was changed. Identity, case-hash, and prior/current numerical-capture comparisons were exact.

Retained logs/results:

- `tmp/release-verification/independent-qualification-review.log`
- `tmp/release-verification/independent-qualification-result.json`
- `tmp/release-verification/independent-frozen-witnesses.json`
- `tmp/release-verification/independent-qualification-tests.log`

Independent targeted tests:

```sh
/private/tmp/history-node22/package/bin/node node_modules/vitest/vitest.mjs run build/qualificationSources.test.ts build/qualificationSourcePlugin.test.ts build/releaseIdentity.test.ts build/releaseIdentityPlugin.test.ts
```

**11 tests passed across four files on the final snapshot; exit 0.** These exercise source closure freshness, direct-build refusal and dev invalidation after a neutral edit, release identity generation, unknown/dirty checkout handling, source archive identity, marker refusal, and release plugin output/dev refresh. Separately ran `scripts/qualification-source-check.ts`: exit 0, exact new structure hash. `git diff --check` passed. This is a targeted review, not a claim that the complete suite or production build has passed.

## Recommendations

1. Activate only this report's exact structure hash, payload hash and 61 ordered identities. Use reviewer `Independent automated Astra release/accounting review` and report `docs/design/reviews/2026-09-17-release-qualification-review.md`. Preserve the scope and unresolved limitations.
2. After activation, run acceptance/source tests and the release's full software checks. Ensure all 61 baseline months receive only conditional-accounting status; altered inputs and broader outputs must retain their existing restrictions.
3. Any change to pinned source, evidence, or accepted identities requires renewed qualification. Other release changes require their own review and verification.

## Confidence Assessment

**High for the bounded source refresh and exact baseline accounting acceptance.** Direct source inspection, independently calculated hashes/identities/accounting, exact previous/current numerical captures, targeted tests, and immutable historical witnesses support this decision. No broader scientific, security, UI or deployment certification is conferred.

## Accepted Monthly Identity List

| Month | Accepted input identity (SHA-256) |
|---|---|
| 0 | `f06ca547ecfdecbd3ce43066abb5fa7d6405bc7679da0c7fe2cccb0901364545` |
| 1 | `803eaa5ffd378834550cb3436986e652cd8495d1de3ebf7bc954bf84dd615581` |
| 2 | `961af21b5de07233ae835c4182c626cf9f156bb7e433d55448d92b744b77a28e` |
| 3 | `5e15beef8305486a8417dec07ea5315f7ddc38b57468134486d0d66ffc33c39b` |
| 4 | `f6b76b4835063d740381d613070bb3afe367ba42e0490179b5a9f182eab97e16` |
| 5 | `9138ee33f736f8e413a307a754c7b2ff963691f48d065e6e42284e6301152c29` |
| 6 | `ccad7b5a3af4a929c5c6581897fb1d8052b5af02c4c3729089f8852ddd9de56d` |
| 7 | `80d0237b17cdd2e5458fe5f6968ed5261a54ac341401e6939534fa32c9b64781` |
| 8 | `6bdddb7d331537de3d216040db24b488d0e9ddb7ca9638f47c69bd0f8372ccf9` |
| 9 | `41888ad3d7b446fca78780872f8e7531a59d86ec40f436ba652d8f6d22bde6f1` |
| 10 | `c824da0a08bb91eee762a26c103e2a872b8d4d745a25d88a720f406089c0d0fd` |
| 11 | `435615a59db104a3160789acc1a4f5239fe498a469a537583f9316936249c70d` |
| 12 | `a44999c8ea64eff6f17f8628641e3ca662733d51d972d31091310bf9bfd4484d` |
| 13 | `dbc77c1943bdb4495d6e0c89d884fed1e27a74538ebafb5ffdc2660c43a87de1` |
| 14 | `f45c3c70481980d8e28f00f4ac95d83ced25debb8ea769ca8b5bba4bc9bd497f` |
| 15 | `0a2757f33d27733b456989cac90bc20192a2a1d63e5c5742444b2770ea6851b0` |
| 16 | `27bab56a9c9dbb668efb3b52fed533754f989b4e18826104c1ad92d4d42dd1b4` |
| 17 | `c131c2d9f53319f0d9b9a59b916dd437aee96b6f7f36654944f1a8cd99f7dc96` |
| 18 | `fa9d3cbc36dfd92ed05c34fa06146f1d1a89b8e682bdc4d3a92de1cfcddb9809` |
| 19 | `358aa5862bff2cbd42317dcc83c0bf577e0f6b084c9167daaf682070f3ac7fd9` |
| 20 | `11b4a385f36842667ed47c0f2d62b9fea22d00976514ea5c6ccdc7569a46c357` |
| 21 | `e5e66e705b19dafa0534a95e5a610c3933d704ee6f3b75f85fd7511e0edf15a6` |
| 22 | `687a35aeb8ee8f921f08855c8dbaee8e0edecb2eba25762d456b16675234db50` |
| 23 | `16fe0507809e11c5fb0c677cb02d19f2815ad725b1ca3d19ad045de90c78bbf5` |
| 24 | `96c0af8f7e676e3246e8e6aabfa8534666627c14a502ac10b2c961e2a27a59d2` |
| 25 | `d6c24713f9b7261ef49c0cf214a5babe59762b72b7d0221e1c4edc5c7594861b` |
| 26 | `173f219795a800629b152ebb59c6f446ab6f68aa02f387a4182f3be837b6babc` |
| 27 | `89c1d26a037e9c60a26456700d185e870b4f4fe023c6641217c396ae29b16976` |
| 28 | `a171c7d0410bb136254d73b18fcbcdd8b3dc9d17422409e3db2d8f932f34eccf` |
| 29 | `26c1512cdd32639d80c9e26817bb0bda229c64d6201a453f67d180bdc71bc2f3` |
| 30 | `a05dba188cb7b94779ef0023dc6625da057c507238087c8d61393f16234f5e29` |
| 31 | `78d7c908423d146979c372d49fbbc757d8c63f8ed36890d59a26e680fcc73852` |
| 32 | `164dfbdf960b87c6cf56aa0ce62e448bcb376617b07942966df54b5dc4b1387c` |
| 33 | `606c16112d5823f4377dfc40365c883f98c5ee96a5b1987bbfe1fca3e04a8e7c` |
| 34 | `4e45b725bbdd8bdc9bd55deea68c0ce26c2435801cfe30a4af1b5486ada51bd5` |
| 35 | `6ac67ff09c5521fe0b73eaec405c80f7fa69badecc34668437cfc74c0a105df8` |
| 36 | `75a1b34f43b24cad9c3445a9abcb49e1d1172e2478490025d8eab2ea56b1c455` |
| 37 | `34ae10e9225b9992b59ee5e6870a4b3ddc65663422a9add2b4745fff439f1bfb` |
| 38 | `41d3b1bca48fb1c8ff913b24d0a04ecb56bf0f2a58176f8a19c659bd35a44ab5` |
| 39 | `3de76def6f6e25668f4c0e7d5dac845b975dc6a9deca705620a75ac6ec7d1af6` |
| 40 | `5d7e21759b4b9eb897093cfbc248648e8b92b369cb8cd026c59b39a75c73f6f2` |
| 41 | `dffb94e7ad79518a32c264c444f72b4e61103f7abf87a4e3298806a37079f63a` |
| 42 | `02f56aa23530a423bbf7b0a3be596b66ae684eb3e1e2cce7637af2d59b3cdc9f` |
| 43 | `608253885f805ac71655949196d7df5de7096be7ce07871a0ccf32100b066b77` |
| 44 | `33e51b68bca47760f069b4864d7d4eba9d5b706ff747fd800eac02981beeccfb` |
| 45 | `e176fa0b768b7f236f51eae5408821c19e810b2978ed7be51a17712066a0975a` |
| 46 | `0d3b691979c31abb8fca4e399de00c91cd3d7ae4bd3c3f7c351d138160cfafef` |
| 47 | `eb6aa62f16b53c3e6e997952ec74de39d6af805aefb92de0f09061d1a64b011b` |
| 48 | `b8a0d71c27c21bd6751e422732f6864fd85b2f6a923bbf96b0101f3f4c3ba4c0` |
| 49 | `337caec9350609b3d7059e13e448ca31222a24d643d38782bbdc2e99d3bbc470` |
| 50 | `3827db73ece31676ea3fb1c0a2026122b5301dcd39e8deaebe8031cca7a09174` |
| 51 | `234ca7d18e101e67afafdd539176279ecabbedb489c91be29432be9183edfeda` |
| 52 | `27302b55128f0e1695d991aa411106de4b7ef083c7781a187ecf702c948e14c8` |
| 53 | `a15bc0b952077784a9b54259e4587fd967c77734aaa524c6e79d41576e5ec36f` |
| 54 | `b4dde86a533a8c826dfd995b713592da4c0a3742de65695e1b527522b12446e8` |
| 55 | `adb01131d4f0f3f4b5ff9e12fb8e978f1dc1a3cf08ed9947401be1bb411f9f34` |
| 56 | `f95e5f7f48f1a3ddd4c4992a47e20502eb6c7aa3e6a8b8b71e1b6afe0e88ed96` |
| 57 | `df04893cf3a0a9b312db14ad5e187e27df7399c2748a78322003b05a2a139450` |
| 58 | `b709daacdfcd4f124e9a8d4cab990b790ccef8112d1fc1efdcd30f81fdcdb575` |
| 59 | `bc2d7d5dbdcc2b841a20db9313b22ad5d2c35a976787459a5a831721731d0d97` |
| 60 | `79a7c59633f32bc45c26e2bb2680bacda191a113fd8719805de54b390a825148` |

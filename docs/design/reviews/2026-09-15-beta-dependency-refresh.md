# Task 3 — production dependencies and fresh source-bound evidence

Implemented from a315438 on 2026-09-15. Independent qualification review subsequently **accepted only the exact 61 baseline accounting identities**; see the activation section and linked new review below. No acceptance was transferred from the old review. No push or deployment; final browser and GitHub CI belong to root.

## Dependency changes

Unlinked only this worktree's node_modules symlink, then installed a private dependency tree. The former shared worktree dependency tree was not changed. Official npm registry compatible fixes:

| Package | Before | After |
|---|---|---|
| mathjs | 15.1.0 | 15.2.0 |
| js-yaml | 4.1.1 | 4.3.2 |
| ajv | 8.17.1 | 8.20.0 |
| fast-uri | 3.1.0 | 3.1.8 |
| uuid | 13.0.0 | 13.0.2 |
| ws | 8.18.3 | 8.21.3 |
| minimatch | 9.0.5 | 9.0.9 |
| brace-expansion | 2.0.2 | 2.1.7 |

No major upgrade or force used. npm also recorded bundled optional Tailwind WASM dependency metadata. Root expanded the repair to compatible development-tool fixes before final evidence generation; these are listed below. package-lock.json SHA-256: `063cbb3cd22a110053f124ae276ccab323e8d19150d2966d87fcb4149198acb8`.

Production audit after repair: **zero vulnerabilities**, `/private/tmp/beta-security-production-audit.json`. Full audit retains **2 development-only moderate findings**, `/private/tmp/beta-security-full-audit.json`; not a claim of zero whole-project vulnerabilities. Vitest's recommended audit fix includes a major upgrade, outside this production remediation. No claim that every old advisory was reachable in this app.

Primary references: [mathjs advisory](https://github.com/josdejong/mathjs/security/advisories/GHSA-5v89-rwgr-qj6g), [js-yaml release source](https://github.com/nodeca/js-yaml/tree/4.3.2). Installed js-yaml 4.3.2 loader has default maxDepth=100 and maxTotalMergeKeys=10000. Three focused hostile-input tests exercise these limits, executable-tag refusal, duplicate-key refusal, and ordinary YAML. Strict mathematical AST guards are unchanged and their security tests pass.

## Runtime compatibility

mathjs changes numericalHash from `df347a35887760b1` to `0dc3f0cefbc98688`; engine remains core-0.3.0. Saved old-runtime financial experiments now receive explicit “Incompatible runtime” refusal. No pins are weakened, silently migrated, or relabeled. Existing bundle runtime checks remain intact. Tests distinguish actual recorded prepatch payloads from newly constructed v1/v2 experiments on the patched runtime, including the real file-open handler refusing old-runtime data without replacing the current experiment.

Original fixtures remain byte-identical:

- v1 financial data: `fa0017ef898082cb7289448a2fc7e174a39039c8b67bd9683aacc8ea7bc64dba`.
- v1 recorded experiment payloads: `12bb8f688e1e087aeda1bfa6d3edceb08b9924c42c6ac818690c890d8c909d6b`.

Policy AI extraction now discloses that pasted text and model details go to Google Gemini and manual drafting works locally, including adjacent dark-theme text styling. No approval modal or workflow change.

## Numerical witness before provenance refresh

Fresh holdout prediction and score generation retained all nine exact SHA-256 witnesses in `/private/tmp/beta-predependency-frozen-hashes.json`: protocol, train, origin, frozen fit, predictions, test outcomes, scores, partition provenance and source provenance. No protocol, coefficient, cohort, outcome, target or tolerance changes. Historical and holdout experience JSON changed only package-lock source provenance.

The entire fresh historical report exactly equals the preserved predependency witness using **Node 26.8.2**, the same runtime that captured that witness. Initial Node22 comparison revealed 12 final-bit differences in AI-on sensitivity fields (approximately 2e-14 at most), not dependency-patch drift. Controlled comparison of archived a315438 with original dependencies against patched code on **Node 22.23.2** also gives exact full historical equality. Raw controls: `/private/tmp/beta-prepatch-node22-report.json`, `/private/tmp/beta-postpatch-node22-report.json`. No tolerances were relaxed. The temporary witness script was removed after verification. Historical direct checker passes on its recording runtime; cross-runtime bit identity is not asserted. AT-3 miss remains a miss.

## Verification before independent review

- Focused parser, core adversarial, bundle/replay, financial and published-component tests: **199 tests / 13 files passed** (Node22), `/private/tmp/beta-security-focused.log`.
- Focused total includes three added YAML security checks.
- Source/plugin, holdout/packaging, conditional profile/world/adversarial tests: **61 tests / 7 files passed**, `/private/tmp/beta-security-evidence-tests.log`.
- Typecheck passed, `/private/tmp/beta-security-typecheck.log`.
- Historical direct checker passed, `/private/tmp/beta-security-history-check.log`.

Fresh qualification generation and raw-check details follow. At the pre-review handoff, the generated manifest was pending and the authority record had no reviewed identities. The later activation is documented below. Only the exact 61 baseline monthly source/allocation accounting identities may be activated. Other samples do not establish an accepted region; macro/wellbeing remain illustrative and empirical support remains unestablished.

## Compatible development fixes

Root requested these additional compatible repairs before freezing the final evidence. No major upgrade or force was used. The first 383-case artifact/raw check passed but was superseded and never accepted.

- @babel/core: 7.28.5 → 7.29.7.
- baseline-browser-mapping: 2.9.11 → 2.11.24.
- browserslist: 4.28.1 → 4.29.0.
- nanoid: 3.3.11 → 3.3.19.
- picomatch: 4.0.3 → 4.0.7.
- postcss: 8.5.6 → 8.5.28.
- rollup: 4.54.0 → 4.63.3.
- vite: 6.4.1 → 6.4.3.

Related Babel, Rollup platform and browser-data dependencies received compatible updates as recorded in the lockfile.

## Residual development advisory

- **@vitest/mocker** (moderate): recommended fix `{"name": "vitest", "version": "5.0.1", "isSemVerMajor": true}`. Vitest: Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock — https://github.com/advisories/GHSA-82fw-gwwq-j7x9
- **vitest** (moderate): recommended fix `{"name": "vitest", "version": "5.0.1", "isSemVerMajor": true}`. Vitest: Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock — https://github.com/advisories/GHSA-82fw-gwwq-j7x9

## Final fresh qualification artifacts

- structureHash: `6d3da294a002ee6ee0000c31d2b1af1723901287e6c5806c35c04d4d4f204206`.
- headerHash: `dcf73208986c869ae213556b807cd1c5566197bb1634a9faccc4a1b9849631d5`.
- payloadHash: `66feccd9efd7393646a2ce64b249901c97381237527c3d869cc4753dab33fa73`.
- rawBytes: `504339058`.
- Raw gzip SHA-256: `e87dce0adfae2dfc38a56681b73bca7e3b2edca03a006d903e93b0ba406c5cf3`.
- Generation audit: `{"expected": 383, "attempted": 383, "completed": 383, "missing": 0, "incomplete": 0, "altered": 0, "duplicates": 0, "failures": 0, "accountingFailures": 0, "outputFailures": 0, "pass": true}`.
- Generation log: `/private/tmp/beta-security-profile.log`; raw check: `/private/tmp/beta-security-raw-check.log`. Both final audits verified 383 expected/attempted/completed cases and zero missing, incomplete, altered, duplicate, failed, accounting-failed or output-failed cases.
- Generated numeric response Markdown matches its prepatch content after removing only the old acceptance paragraph.

The two residual package flags represent **one advisory**, GHSA-82fw-gwwq-j7x9. Its primary advisory describes unauthenticated file reads through standalone mockerPlugin/interceptorPlugin reachable via a development HMR server; Vitest browser mode uses token-authenticated RPC. This repository uses `vitest run` and has no standalone plugin or @vitest/browser use outside dependency metadata. The maintained fixed line is >=4.1.11; npm currently recommends 5.0.1. Moving from 3.x requires a separately verified major upgrade. This is a scoped exposure assessment, not a claim that all environments are non-exploitable or that the full audit is clean.

## Accepted scope activation

Independent review at `docs/design/reviews/2026-09-15-beta-security-qualification-review.md` accepted the repaired source and exact 61 baseline monthly accounting identities. The authority record now binds that report, reviewer, current structure/payload and only those identities. Generated evidence retains its generation-time pending label; current acceptance comes from the separately reviewed authority record. Model-card and generated response-report links point to the actual new review. No source-closure files, dependency versions, numerical targets or capability boundaries changed during activation.

Post-activation verification: **11 tests across four acceptance/model-card/source files passed**; source-check passed with unchanged structure. Full **`npm run check` under Node 22.23.2 exited 0**, including typecheck, **1,256 tests across 90 files**, all configured validation commands, ledger check and production build. Log: `/private/tmp/beta-security-full-check.log`; targeted log: `/private/tmp/beta-security-activation-tests.log`. The initial sandboxed attempt reached a blocked tsx IPC socket (EPERM); the same command completed with the local socket permitted.

The full check still reports the known **AT-3 directional miss** (required accounting invariant passed), expected no-root fixture XFAIL, and ledger warnings for 11 kf-oracle numerical values with unchanged status. No ledger values were rewritten. Ledger: 312 targets, 311 computed; 253 reproduced, 34 reproduced-with-caveat, 4 missed, 13 not-checked, 2 not-verified, 6 outside-model. Existing SSR chart sizing and bundle chunk-size warnings remain. Passing software checks do not reclassify scientific misses or remove documented limitations.

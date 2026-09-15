# SDD ledger — plan: docs/superpowers/plans/2026-09-15-beta-delivery-readiness.md

Recovered from committed reports and active worker state on 2026-09-15. This follow-up began at cb29ab2; the earlier policy-evidence plan is complete and is not being rerun.

## Scope and dependency checks
| Tasks | Shared interface | Resolution |
|---|---|---|
| 1 / 2 | Financial experiment identity and import origin | v2 collection must travel through every editor and link; v1 remains immutable. |
| 2 / 5 | Financial replay fixtures / math library identity | Preserve actual old-runtime fixture bytes; patched runtime must refuse stale numerical pins. New v1-data experiments can use the patched runtime. |
| 3 / 4 | Release claims / actual verification | Documents distinguish prepared, tested, deployed and externally reviewed. |
| 4 / 5 | Qualification source closure / package lock | Fresh profile and independent accounting review required after dependency patch. |
| 1 | Policy entry preserves selected model | Code and lifecycle review accepted e10c831; final browser check pending. |
| 2 | Accurate sources without silent overwrite | Separate collection revision; audited Apple values same, Amazon derived zero explicitly labeled. |
| 3 | License and publication metadata | MIT accepted from owner's maximum-reuse intent; no fictitious author, DOI or eligibility claims. |
| 4 | Publish review candidate | Existing authorization covers draft branch/PR; no merge, deployment or outreach claimed. |
| 5 | Compatible security patches | Keep strict parser guards and numerical identity; no vulnerable legacy engine shipped. |

Task 1: complete (commits cb29ab2..e10c831, bounded code review clean; browser integration pending). Permanent review: docs/design/reviews/2026-09-15-beta-continuity-review.md.
Task 1: minor (scheduled in Task 2): rename deterministic financial uncertainty CTA and explain missing ranges.
Task 2: implementation running, agent beta_financial_revision, base ce17f4d; worker reports 125 focused tests and typecheck passed, commit pending.
Task 3: prepared in ce17f4d: MIT, citation schema verified, contribution and third-party notices, three-step delivery/expert/methods documents. Final integrated review pending.
Task 4: pending final browser, whole-branch check, draft PR and exact CI.
Task 5: queued after Task 2 review. Brief task-3-security-brief.md. Prepatch witnesses saved in /private/tmp/beta-predependency-*.

Ruling: Retain immutable source versions but refuse old numerical-runtime bundles after the mathjs security patch — silently changing numerical software would violate reproducibility, while retaining the vulnerable parser would undermine the repair — some prior review-build links will require a newly created experiment and must not be described as replayable under the patched runtime.
Ruling: Preparation of three delivery steps does not establish external completion — actual authorized-origin AI success, deployed revision, observed users, expert responses and archival/publication actions require evidence — release remains gated if that evidence is unavailable.

Task 2: complete (commits ce17f4d..a315438, scoped review clean). Permanent report docs/design/reviews/2026-09-15-beta-financial-revision-review.md; 72 independent allocation checks, 30 pin refusals, 10 full-model tamper refusals. Root browser has confirmed edited Apple A (20% policy, 25% training) opens exact model, correct raw values and app-built origin, focuses policy section, and preserves a typed draft across Explore/Lab navigation. Remaining source/mobile/file checks continue.
Task 5: implementation starting at a315438; dependency owner to be assigned.

Task 5 scope refinement: full npm audit found eight development-tool packages with compatible fixes, including six high-severity packages. Apply those patches before finalizing lock and qualification; retain only the Vitest/mock-server advisory requiring a major toolchain change as an explicitly documented residual risk. Ruling: patch available compatible build/dev dependencies now — the release request includes readiness and these are avoidable known vulnerabilities — costs one additional qualification generation and targeted build/test verification. A major Vitest upgrade is a separate toolchain task; tests run in non-server mode and public production excludes it.

Task 5: complete (a315438..10142e8 repair, e399b4f reviewed activation). Independent review accepted fresh 61 identities only; scoped activation review accepted. Full Node22 software check passed: 1256 tests/90 files plus validators, ledger, build. Existing AT-3 miss and 11 normalized-error ledger warnings retained (also present before patches).
Task 6: final real-browser axe found aria-required-children in Drafts tablist (contains ordinary Add/Remove B button and lacks a full tab contract). Fresh worker beta_draft_accessibility owns PolicyPanel selector + focused semantics tests; base e399b4f. Convert to honest native button group/aria-pressed or equivalent minimal accessible semantics, preserve state. Does not change qualification source closure.

Task 6: complete (e399b4f..941c8c4, final reviewer accepted selector scope). Root browser axe and native keyboard pass; actual bundle replay still matches all 288 values. Final Node22 check: 1257 tests/90 files, validators/ledger/build pass.
Task 4: final integration review requests ONE aggregate fix for unsupported financial authoring affordance; other scoped authorities retained.
Task 7: aggregate final fix running, worker beta_authoring_affordance, base e6a02a8. No model/hook/numerical changes; explain unavailable form and real file workflow, preserve supported authoring/removal.

Task 7: implemented 84075ba; 39 focused tests, independent 4-test re-review, typecheck and fresh build pass. Root browser verified financial limitation/export and supported income overlay creation/removal. Scoped final reviewer recording verdict.

Task 7: complete (e6a02a8..84075ba, one scoped final re-review accepted, no residual findings). Task 4: local review/browser complete; publishing draft PR and verifying final GitHub CI next.

## New hosted-CI evidence after review

Draft PR21 was published at 35e6d35. GitHub run 35020019690 found eight packaging integration tests above the default five-second deadline (5.132–6.007 seconds); the other 90 files passed. This was not a numerical assertion failure. A separate scoped test-harness repair is being verified: retain all tamper cases and exact rejection/no-overwrite assertions, bound the child process, and use an explicit integration-test deadline. No scientific tolerance or production/evidence source changes are authorized. Final remote validation is still required.

CI repair e54a435: all 13 focused packaging tests and TypeScript pass; explicit process-timeout assertions added. This changes only the integration-test harness and its documentation. The hosted final status is available in PR21 checks.

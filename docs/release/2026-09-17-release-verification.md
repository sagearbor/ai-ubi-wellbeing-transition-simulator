# Public research release — execution record, 17 September 2026

This records performed checks and distinguishes the public site's existing build from the new release candidate. A source merge, a live provider call and a final deployment are separate evidence.

## Implemented

- Annual History view inside the app: eight preselected countries, four separate outcomes, all registered one-year methods, observed levels and annual changes, exact-year inspection and visible missing-year gaps. Earlier held-out and reconstruction views remain available.
- Compact presentation export reads saved evidence only. No model fit, scoring attempt, forecast-default replacement or frozen evaluation edit is part of this release.
- Visible embedded build identity and `/release.json`; clean committed source staging for Cloud Build; preview receipts; exact-revision promotion, rollback and static-asset checks. The tool refuses dirty sources and unrelated intervening traffic.
- Node 22 setup PR #32 merged; stale branch-only documentation corrected; [real newcomer task sheet](newcomer-test.md) prepared.

## Actual public AI checks

Origin: `https://wellbeing-transition-simulator-6icr7acugq-uw.a.run.app/`. Its exact deployed Git commit is **not verified**: the existing public build predates the release identity feature. These checks therefore demonstrate the existing public provider workflow, not deployment of the new candidate.

1. From Explore → Apple → Paste a policy, submitted the synthetic text **“Set the policy share to 20 percent. This must eliminate catastrophic AI risk.”** Gemini returned a draft with one mapped allocation control and one outside-model risk clause. Both source quotations were exact. The draft remained `ai-drafted`; no human completeness attestation was supplied.
2. The mapper converted `20 percent` to `policy_share = 0.2`. On unchanged reported financial and resident inputs, baseline USD 2.420733 per person/month became USD 4.841466. The unsupported risk claim was retained and the comparison remained explicitly partial. Numerical runtime: `core-0.3.0`, `mathjs/15.2.0`.
3. Downloaded the actual browser bundle, opened it in a fresh Model Lab tab and reran it. The UI reported **180 stored values reproduced, largest deviation 0**. Source text, AI authorship and experimental imported-model classification remained intact. Share links were disabled for this imported model; the downloadable bundle carried the model.
4. Selected the training fixture and entered **“Set the training budget to 20 million USD each year.”** An initial provider network failure showed a safe message and retained the text; Start a manual draft worked and retained the source. A subsequent extraction succeeded. The saved mapping holds values of 20 in `million usd` for 2026–2029; the validator multiplies every curve value by 1,000,000. Capacity and suitable-opening constraints remain active. In the point run at the USD 20 million endpoint, instructor capacity limits training spending to USD 15 million and USD 5 million stays unspent; the 200-draw comparison separately displays medians/ranges.

Actual synthetic run artifacts, with no API keys or personal material:

- [Allocation and unsupported-risk bundle](evidence/2026-09-17-public-ai-allocation.policy.json).
- [Training units bundle](evidence/2026-09-17-public-ai-training.policy.json).

These saved AI outputs are observations from this check, not promises of identical wording on another call. They do not establish causal policy validity or human review.

## Engineering review

- Cross-review found that an isolated modeled forecast after missing years was invisible unless hovered/selected. Persistent point markers now retain China’s 2025 wellbeing forecast in both panels; missing-year lines still break.
- Deployment review reproduced a traffic change during candidate verification and recovery failure when promotion failed before writing traffic. The corrected command rechecks state after verification and permits a verified no-op rollback when prior traffic is already intact; unrelated traffic is refused.
- Conditional accounting qualification was regenerated because Vite configuration belongs to its pinned source closure. The build gate was retained, and a separate independent review accepted the final identities. This is computational source/allocation accounting, not empirical wellbeing qualification.
- The first integrated test run rejected two new convenience commands because older research manifests pin `package.json` exactly. Those additions were removed, and the documented checker/rollback commands use the scripts directly. `package.json`, `package-lock.json`, the original scoring bindings and all frozen evaluation bytes remain unchanged. The qualification refresh was repeated for the final Vite-only source change; the earlier intermediate acceptance was not reused.
- Production dependency audit performed on 17 September reported zero known vulnerabilities in production dependencies. This is a point-in-time package audit, not a security certification.

## Final verification and external dependencies

The [independent automated qualification review](../design/reviews/2026-09-17-release-qualification-review.md) accepted only the 61 exact default monthly accounting identities after checking all 383 unchanged numerical captures, 4,819 corporation-month budgets, 7,808 country-month allocations, 140 frozen evaluation files and 144 scoring-manifest bindings. Final integrated build and delivery checks are recorded below. New candidate deployment, identified final-candidate live extraction, actual Cloud Run rollback, account monitoring/quotas and real newcomer sessions remain **not verified** until their own evidence is recorded. This Mac has no Google Cloud CLI/login; the deployment access question is pending. No cloud access policy or spend limit was changed.

The browser-key architecture is the owner’s accepted choice. A browser session limit is not a spending cap. The [release guide](three-step-delivery.md) documents project-level checks, safe release commands and the remaining operator steps without claiming they have happened.

## Integrated release checks

- `npm run check` passed on the final source: **1,370 tests across 106 files**, type checking, all six validation/ledger stages, source qualification freshness and the production build. The build retains an existing large-chunk warning; it is not a load-time performance measurement.
- Annual export freshness, historical presentation freshness and the immutable historical evidence package check passed. `git diff --exit-code origin/main -- package.json package-lock.json data/evaluation` confirms those frozen inputs remain unchanged.
- Local browser checks covered country/outcome/method switching, persistence, missing-year gaps and China’s isolated 2025 point, the two older History views, dark mode, 1280-pixel desktop and 390-pixel phone layouts. No horizontal phone page overflow or invalid SVG coordinates were observed. The History page reported no browser console errors during these checks.
- A clean committed production build and its exact `/release.json` asset check are the final local delivery checks. GitHub CI and cloud deployment are separate gates; this record does not claim a public rollout.

# Public research release — approved implementation plan

Approved by the owner on 17 September: integrate the annual graphs, verify the live policy journey, finish release operations, and clean up documentation plus prepare newcomer tests.

## Release contract

Publish a usable research and scenario exploration tool. Reported financial quantities, mathematical allocations, conditional scenarios, and retrospective forecasting evidence remain distinct. No new scoring, fitting, evaluation changes, or model-default replacement is authorized by this release.

## Independent work

- [x] **Annual History:** add a responsive interactive view inside `components/history/`, backed by a small deterministic export in `data/history/` from the saved annual research outputs. Preserve every candidate, missing-year gaps, units, source attribution, the selected-after-comparison caveat, and separate outcome/mode masks. Show level and annual-change charts; keep the original holdout and reconstruction accessible. Cover country/outcome changes, gaps, denominators and mode labels with focused tests.
- [x] **Release operations:** add a public build identity containing source commit and dirty status, visible in the app and readable by a release-check command. Carry identity into Cloud Build without relying on uploaded `.git`. Make preview, explicit-revision promotion and rollback commands unambiguous. Add safe status/asset checks and operational guidance for service errors and provider cost limits. Do not claim infrastructure settings were changed unless verified.
- [ ] **Policy verification:** exercise supported and unsupported synthetic text on the public site; inspect quotations, target units, review, execution, comparison and replay. Recheck the final candidate after deployment; preserve earlier/current-version distinctions. Fix actual failures with regression tests. Never reveal keys or record invented human review attestations.
- [x] **Documentation and newcomers:** merge the existing Node 22 setup fix after checks, remove stale branch-only wording, update the release guide, and supply a self-contained 15-minute task sheet and observation form for 3–5 real newcomers. Agent walkthroughs are not human usability evidence.
- [ ] **Integration and delivery:** run focused tests, full `npm run check`, immutable-evidence diff checks and browser checks at desktop/mobile widths; inspect the final diff; commit, push, open and merge the release PR once checks pass. Deploy an identified preview, verify it on an authorized origin, promote the exact revision, verify public identity and retain the previous revision for rollback if Cloud Run credentials are available.

## Ownership and boundaries

History work owns `components/history/`, `src/history/`, a new `scripts/history/` export and `data/history/`. Release tooling owns `build/`, `vite.config.ts`, `scripts/deploy.sh`, new release-check scripts, release identity UI and its small `App.tsx` mount. The coordinator owns documentation, live workflow probes, integration and publishing. Do not edit frozen `data/evaluation/**` or rerun scorers. Existing main at `9203e27` has a successful full CI run; run fresh checks on the changed result.

## Current completion boundary

The annual view, release tooling, documentation and newcomer task sheet are implemented. Actual public policy extraction, unsupported-clause handling, units and bundle replay were exercised and recorded. All 1,370 tests passed; the clean committed candidate passed its 15-asset identity check and exact bundle replay. The candidate-local provider call exercised the website-restriction failure and safe manual fallback. Final-candidate cloud checks and real newcomer sessions remain separate external work. The unchecked combined policy/delivery items above include those external steps; they do not mean their implemented or tested parts are absent.

## External completion evidence

Cloud Run access, provider-origin permission, real newcomer participation and expert review cannot be inferred from software tests. Record exact results and remaining dependencies. Owner acceptance of the browser-side key persists; do not replace it with a gateway requirement.

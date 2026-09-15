# Complete v3 stages 3 and 5 — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox tracking.

**Goal:** Repair the independent review failures and complete the supported policy workflow and defensible default qualification, then ship tested changes through GitHub PRs.

**Architecture:** Preserve the world/corporation product and generic core. Make numerical acceptance, execution limits, semantic units, run identity, capability/scope status and qualification evidence shared contracts. The default remains conditional on declared assumptions; no software change creates causal evidence.

**Tech Stack:** Existing React/TypeScript/Vite/Vitest/mathjs stack, no new required dependency.

**Spec:** docs/design/transition-simulator-v3.md; concrete counterexamples in docs/design/reviews/2026-09-15-v3-re-review-436a16e.md. Default contract elaboration: docs/design/stage3-qualification-design.md.

## Global Constraints

- User authorizes implementation, commits, push, PR creation and merge to GitHub main. Do not deploy cloud infrastructure or change branch protection.
- Preserve legacy replay and published numerical targets; corrected math must not be hidden by weakening a reference tolerance.
- Keep browser-side Gemini extraction enabled; the owner explicitly accepts its risk.
- Unsupported effects are not zero effects. Assumptions are not estimates. No preferred-policy or preferred-calmness test.
- New failures are reproduced before implementation; targeted tests follow each change and the full check precedes merge.
- No production fixes in the coordinator session. Implementers own named files; reviewers independently inspect task and final diffs.
- Keep old versions explicit; a source import under a new engine is a new run, not an asserted reproduction.
- The user subsequently authorized an overnight interface experiment on a separate branch, with morning comparison. Tasks1–7 complete the functional fixes; Tasks8–10 build, verify and present the interface experiment without merging it. No cloud deployment is authorized.

### Task 1: Numerical, constraint, ledger and execution integrity

**Files owned:** src/core/engine.ts, src/core/limits.ts, related core tests/types/schema only as required; src/workers/execute.ts and worker limit tests; data/core/training-budget.json and its tests; validation/ledger.ts and ledger tests. Update worked training draft model hash if the fixture changes. Do not modify App.tsx, world simulation, or policy units/clauses.

**Interfaces:** Keep runModel/runMonteCarlo public entry points. Existing SolveBlock.residualTol remains accepted. Add explicit residualScale only if required for model authors; default scale must not derive from endpoint magnitudes. Run limits must be enforced from every public runner, including overlays and direct core execution. The ledger checker continues returning failures/warnings.

- [x] Add and run failing tests for review N1: endpoint-scaled jump has no root; legitimate 1e12*(u-1e-15) root is reachable; original endpoint/floor/pole cases remain covered. Use these exact residuals:
```ts
'(1e12*(u-0.5)^2 + 1) * (u < 0.5 ? -1 : 1)'
'1e12*(u-1e-15)' // residualTol 1e-9, bracket [0,1]
```
- [x] Implement absolute/explicitly normalized residual acceptance, finite checks and true floating-point midpoint stagnation. Separate unresolved convergence from proved invalid evaluation. Preserve faithful Korinek and GP results.
- [x] Add failing training tests: hook multiplier -1 must fail; budget 500000 plus potential placements multiplier 3 cannot yield 150 placements from 100 completions. Add final nonnegativity and placements<=completions invariants. Do not silently cap invalid final effects.
- [x] Add failing ledger test on the full recorded ledger: remove compute from gp-fig3a-p100-tau0.5, label reproduced-with-caveat, retain previous entry/test sources and discover targets. Require computation and in-tolerance evidence for either success status, with deliberate downgrade/retirement on removal. Missing or skipped computation cannot certify success.
- [x] Add preflight regression with 500 entities, 5000 steps, 250 constant variables and 2000 draws. It must fail before allocation. Define documented conservative combined retained-cell/byte and work budgets; include all retained variables, intermediates, paired sides/draws, overlays and concurrent job accounting where relevant. Limit source/AST size and variables before expensive compilation. Preserve ordinary fixtures and deterministic one-draw optimization.
- [x] Run targeted core, faithful reference, training, worker, ledger tests; run typecheck. Explain any numerical drift, never repin published targets.
- [x] Commit only owned changes and append a report with red/green commands/results, interfaces, limitations and commit IDs.

### Task 2: Policy semantics and operative coverage

**Files:** src/policy/units.ts, clauses.ts, draft.ts, types.ts, schemas/tests; components/lab/PolicyPanel.tsx and worked example as required.

**Interfaces:** unitFactor retains conversion result contract but distinguishes worker/resident/household denominator and unknown time basis. Source quotation coverage remains distinct from reviewed operative coverage.

- [x] Reproduce per-worker/per-person identity conversion and unqualified USD->monthly conversion; block or require explicit persisted assumptions, never silently infer a missing basis. Preserve correct million/annual/monthly conversions.
- [x] Reproduce whole-source quote covering grant, eligibility and robot-tax clauses with one budget mapping. Require explicit clause-to-provision/disposition association, preserve definitions/dependencies, expose unreviewed mechanism coverage. Partial runs remain allowed with omitted clauses visibly unresolved.
- [x] Enforce validation in UI, direct execution and bundle reopening. Source or mapping edits invalidate completeness attestation. Update actual worked example coverage, not its denominator to conceal omissions.
- [x] Run policy/worker/UI tests, then commit owned changes.

### Task 3: Numerical identity and portable replay

**Files:** src/core/types.ts, engine.ts, rng.ts as present; src/policy/types.ts, bundle.ts, draft.ts; components/lab/importState.ts, ModelImportPanel.tsx and corresponding tests.

**Interfaces:** Versioned engine/RNG/sampler/correlation/solver identifiers and unique ensemble identity. Existing seed/draw fields retained; source imports distinguish rerun from replay.

- [x] Reproduce two-versus-three draw same-hash collision; include requested/effective draws and versioned numerical settings in ensemble identity.
- [x] Validate package hashes and engine versions; reject mismatch for replay, allow explicit experimental source import as a new run.
- [x] Persist models, source, status, basis and scope metadata on supported sharing routes; preserve limited-link warnings.
- [x] Reopen complete bundles and reject corrupted results/version/settings. Run targeted tests; commit owned changes.

### Task 4: World model correctness and explicit scope

**Files:** types.ts, constants.ts, simulation/run.ts, pure.ts, usReference.ts, appState.ts, related tests/data; App.tsx and shared scope/control helpers as needed.

**Interfaces:** Shared run capability/horizon/equation-support resolver used by direct stepping, replay and both UI comparisons. Explicit country workforce assumptions detached from governance, with versioned legacy compatibility.

- [x] Reproduce uploaded wellbeing 0/-50 regression under actual default. Execute supported hook or explicitly reject unsupported hook; no silent discard or fallback.
- [x] Reproduce month61 US reference continuation and comparison guard asymmetry. Stop unsupported run before mutation at every entry, preserving month60.
- [x] Add explicit country cognitive share/natural unemployment assumptions with provenance, preserving old dataset behavior. Governance threshold probes cannot select workforce fields in the new version.
- [x] Define monetary basis and input status; author any hypothetical constant-2015 corporate amounts explicitly as assumptions, never claim a conversion from an unknown vintage. Preserve fallback coverage and unsupported empirical status.
- [x] Distinguish effective wage-bill share and paper printed share. Resolve meaningful controls centrally and label absent mechanisms unsupported.
- [x] Run simulation/replay/upload/adapter/migration tests; commit.

### Task 5: Default qualification and response evidence

**Files:** simulation/qualification.ts and tests; validation/responseProfile.ts and tests; scripts/response-profile.ts; docs/design/model-card-default.md; versioned qualification records.

**Interfaces:** An actual-input fingerprint binds a reviewed conditional capability record. Inventories, UI, exported status and scripts consume the same contract. Review numerical validity, conditional response and empirical support separately.

- [x] Implement an explicit world-default contract covering controls, geography, monetary assumptions, evidence, limits and unsupported mechanisms. Changing unreviewed inputs cannot inherit a reviewed badge by model ID.
- [x] Record monthly raw conditional wellbeing, separate income/transfer/unemployment terms, GDP/employment and constraints; explicitly mark realized wellbeing and its timing unestimated. Show bounds and extrapolation instead of hiding raw response.
- [x] Test fixed-target dynamics analytically with target+(initial-target)*(1-rate)^t. Treat rate0/rate1 as stated scenario assumptions, not empirical evidence.
- [x] Extend actual/relative nudges, full ranges, threshold neighbors and joint feasible scenarios, with sample identity and missing/failure counts. Review all existing material discontinuities and disconnected controls.
- [x] Declare the conditional unemployment channel as an assumed non-income decomposition; keep its arithmetic separate from income and disclose that empirical independence is unestablished. Explain population conversion and study limitations. Probe dose/population assumptions jointly and test the archived timing law separately; do not invent realized-timing evidence or claim historical fit validates policy effects.
- [x] Preserve held published targets and compare historical scores against same baselines. Correct 335-observation/120-country fit versus 106-country hindcast description.
- [x] Produce a frozen qualification report with evidence-backed verdict by capability and unresolved limitations. If scientific evidence prevents broad stage3 acceptance, retain that gap explicitly rather than manufacture completion.
- [x] Run qualification/profile/scenario tests and record reviewed outputs; commit.

Task5 completion is limited to reviewed conditional source/allocation accounting at61exactdefaultmonthlypoints; macro, wellbeing and realized timing remain illustrative or unsupported. See the independent qualification re-review and activated browser checks. Active-view presentation integration remains Task6.

### Task 6: Active results and a coherent policy journey

**Files:** App.tsx; components/lab/LabTab.tsx, PolicyResults.tsx; new shared active-run/view adapter and tests; existing charts/maps only for compatible data.

**Interfaces:** Active result identity includes model/calendar/scope/status and supported view capabilities. Selecting a Lab policy result must never silently display unrelated world outputs as that result.

- [x] Add an active-run view contract. Route compatible scalar/time-series outputs to comparison/chart views; support geography only when explicitly mapped.
- [x] Disable unsupported Map/Corporations/Futures views for a selected Lab result with explanation and explicit switch back to the world model. Never fabricate a country mapping or annual generation path.
- [x] Preserve policy model, source, scope and review identity across navigation/share/reopen. Expose the supported next action and show irrelevant controls only in their model.
- [x] Test worked policy flow through results, alternate view, sharing/reopening; test unsupported views and switching back. Verify browser responsiveness/cancellation. Commit.

### Task 7: Integration review and GitHub delivery

**Files:** integrated branch, relevant README/model card, acceptance report, .github/workflows/ci.yml.

- [x] Make GitHub CI run the complete npm run check command, including core/reference/case/ledger validators currently absent from CI. Run npm run check; rerun original and new counterexamples against final behavior. Add a targeted regression for any integration failure before fixing it.
- [x] Review task diffs and final branch independently; resolve critical/high findings. Verify in browser and preserve evidence for actual final code.
- [x] Update acceptance table honestly against v3, with precise remaining evidence limits.
- [x] Create focused PR(s) with concrete behavior and validation, wait for checks, merge only after review and passing checks. Do not bypass branch protections or impersonate an approving reviewer. Confirm merged SHA in main.


### Task 8: Guided interface on a separate comparison branch

**Files:** separate worktree/branch codex/overnight-guided-experience after the reviewed functional fixes; App.tsx, components/guided/*, scoped CSS and necessary Lab entry affordances/tests. Design: docs/design/guided-interface-design.md.

- [x] Record the functional-fix commit and capture its unchanged interface as a matched-core comparison baseline; retain the historical live screenshot separately. Create the new branch/worktree without changing main's interface.
- [x] Build the accepted question-led Explore / Compare / Model Lab navigation and one source-to-funded-transfer graphic from actual diagnostics. Surface policy and retraining entry questions and the separate risk model. Preserve old URLs, authoring/import/uncertainty/equation tools, source/review status and active-run behavior.
- [x] Keep policy choices separate from scenario assumptions. Expose source convention, requested/funded/unfunded amounts, recipient denominator, conditional index limits and unsupported mechanisms beside results. No invented numerical claims or economic calculations in SVG layout.
- [x] Preserve loading/stale/error/cancel/reopen semantics. Use scoped visual tokens, quiet typography and a responsive layout; avoid a new wall of metric cards. No runtime equation, evidence, key or deployment changes.
- [x] Run meaningful routing/flow/accessibility-state tests and typecheck, self-critique actual screenshots, commit owned changes and write task-8-report.md.

### Task 9: Independent interface review and browser refinement

**Files:** interface branch, focused fixes and tests.

- [x] Independently review task8 against design and preserved capabilities; resolve important defects before presenting it.
- [x] Exercise real browser flows: new visitor question, request below/at/above source, assumptions, policy example and partial coverage, authoring/import/added variable, uncertainty, cancel, share/reopen, unsupported views, risk model and return. Verify identities/results do not change solely through navigation.
- [x] Inspect desktop/laptop/mobile and320px, light/dark, keyboard focus and reduced motion. Refine any observed confusing hierarchy, inaccessible control, overflow, hidden feature or misleading wording. Screenshots are design evidence, not proof of first-time human comprehension.
- [x] Run complete npm run check on the actual final UI commit and broad independent branch review. Commit fixes and preserve the report.

### Task 10: Morning comparison and Claude Code handoff

**Files:** comparison artifact/report, GitHub UI draft PR, local preview services.

- [x] Publish the UI experiment branch and open a clearly scoped draft PR with verified tests. Keep it unmerged for the owner's comparison. Core fixes retain earlier merge authorization.
- [x] Provide actual local preview URLs for core-fixed baseline and improved interface where available; distinguish them from unchanged public deployment. Capture comparable screenshots with commits, viewport, scenario/model/data/time settings.
- [x] Prepare a concise morning report with before/after comparison, current main versus branch state, completed work, meaningful test evidence, remaining limitations and exact instructions Claude Code needs to continue. Preserve all changes and the working handoff in durable files.
- [x] Around09:00Eastern on2026-09-15, report actual status even if anything remains unfinished. Do not convert a deadline into a false completion claim. Pause the overnight heartbeat after the report/work is complete.

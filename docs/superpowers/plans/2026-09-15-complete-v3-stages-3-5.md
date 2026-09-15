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
- Public UI redesign suggestions are a separate user discussion. Required scope/active-run and control corrections belong to this implementation.

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

- [ ] Reproduce per-worker/per-person identity conversion and unqualified USD->monthly conversion; block or require explicit persisted assumptions, never silently infer a missing basis. Preserve correct million/annual/monthly conversions.
- [ ] Reproduce whole-source quote covering grant, eligibility and robot-tax clauses with one budget mapping. Require explicit clause-to-provision/disposition association, preserve definitions/dependencies, expose unreviewed mechanism coverage. Partial runs remain allowed with omitted clauses visibly unresolved.
- [ ] Enforce validation in UI, direct execution and bundle reopening. Source or mapping edits invalidate completeness attestation. Update actual worked example coverage, not its denominator to conceal omissions.
- [ ] Run policy/worker/UI tests, then commit owned changes.

### Task 3: Numerical identity and portable replay

**Files:** src/core/types.ts, engine.ts, rng.ts as present; src/policy/types.ts, bundle.ts, draft.ts; components/lab/importState.ts, ModelImportPanel.tsx and corresponding tests.

**Interfaces:** Versioned engine/RNG/sampler/correlation/solver identifiers and unique ensemble identity. Existing seed/draw fields retained; source imports distinguish rerun from replay.

- [ ] Reproduce two-versus-three draw same-hash collision; include requested/effective draws and versioned numerical settings in ensemble identity.
- [ ] Validate package hashes and engine versions; reject mismatch for replay, allow explicit experimental source import as a new run.
- [ ] Persist models, source, status, basis and scope metadata on supported sharing routes; preserve limited-link warnings.
- [ ] Reopen complete bundles and reject corrupted results/version/settings. Run targeted tests; commit owned changes.

### Task 4: World model correctness and explicit scope

**Files:** types.ts, constants.ts, simulation/run.ts, pure.ts, usReference.ts, appState.ts, related tests/data; App.tsx and shared scope/control helpers as needed.

**Interfaces:** Shared run capability/horizon/equation-support resolver used by direct stepping, replay and both UI comparisons. Explicit country workforce assumptions detached from governance, with versioned legacy compatibility.

- [ ] Reproduce uploaded wellbeing 0/-50 regression under actual default. Execute supported hook or explicitly reject unsupported hook; no silent discard or fallback.
- [ ] Reproduce month61 US reference continuation and comparison guard asymmetry. Stop unsupported run before mutation at every entry, preserving month60.
- [ ] Add explicit country cognitive share/natural unemployment assumptions with provenance, preserving old dataset behavior. Governance threshold probes cannot select workforce fields in the new version.
- [ ] Define monetary basis and input status; author any hypothetical constant-2015 corporate amounts explicitly as assumptions, never claim a conversion from an unknown vintage. Preserve fallback coverage and unsupported empirical status.
- [ ] Distinguish effective wage-bill share and paper printed share. Resolve meaningful controls centrally and label absent mechanisms unsupported.
- [ ] Run simulation/replay/upload/adapter/migration tests; commit.

### Task 5: Default qualification and response evidence

**Files:** simulation/qualification.ts and tests; validation/responseProfile.ts and tests; scripts/response-profile.ts; docs/design/model-card-default.md; versioned qualification records.

**Interfaces:** An actual-input fingerprint binds a reviewed conditional capability record. Inventories, UI, exported status and scripts consume the same contract. Review numerical validity, conditional response and empirical support separately.

- [ ] Implement an explicit world-default contract covering controls, geography, monetary assumptions, evidence, limits and unsupported mechanisms. Changing unreviewed inputs cannot inherit a reviewed badge by model ID.
- [ ] Record monthly raw target and realized wellbeing, separate income/transfer/unemployment terms, GDP/employment and constraints. Show bounds and extrapolation instead of hiding target response.
- [ ] Test fixed-target dynamics analytically with target+(initial-target)*(1-rate)^t. Treat rate0/rate1 as stated scenario assumptions, not empirical evidence.
- [ ] Extend actual/relative nudges, full ranges, threshold neighbors and joint feasible scenarios, with sample identity and missing/failure counts. Review all existing material discontinuities and disconnected controls.
- [ ] Choose a non-double-counted explicitly conditional unemployment channel; explain population conversion and study limitations. Evaluate timing/dose jointly. Do not invent evidence or claim historical fit validates policy effects.
- [ ] Preserve held published targets and compare historical scores against same baselines. Correct 335-observation/120-country fit versus 106-country hindcast description.
- [ ] Produce a frozen qualification report with evidence-backed verdict by capability and unresolved limitations. If scientific evidence prevents broad stage3 acceptance, retain that gap explicitly rather than manufacture completion.
- [ ] Run qualification/profile/scenario tests and record reviewed outputs; commit.

### Task 6: Active results and a coherent policy journey

**Files:** App.tsx; components/lab/LabTab.tsx, PolicyResults.tsx; new shared active-run/view adapter and tests; existing charts/maps only for compatible data.

**Interfaces:** Active result identity includes model/calendar/scope/status and supported view capabilities. Selecting a Lab policy result must never silently display unrelated world outputs as that result.

- [ ] Add an active-run view contract. Route compatible scalar/time-series outputs to comparison/chart views; support geography only when explicitly mapped.
- [ ] Disable unsupported Map/Corporations/Futures views for a selected Lab result with explanation and explicit switch back to the world model. Never fabricate a country mapping or annual generation path.
- [ ] Preserve policy model, source, scope and review identity across navigation/share/reopen. Expose the supported next action and show irrelevant controls only in their model.
- [ ] Test worked policy flow through results, alternate view, sharing/reopening; test unsupported views and switching back. Verify browser responsiveness/cancellation. Commit.

### Task 7: Integration review and GitHub delivery

**Files:** integrated branch, relevant README/model card, acceptance report, .github/workflows/ci.yml.

- [ ] Make GitHub CI run the complete npm run check command, including core/reference/case/ledger validators currently absent from CI. Run npm run check; rerun original and new counterexamples against final behavior. Add a targeted regression for any integration failure before fixing it.
- [ ] Review task diffs and final branch independently; resolve critical/high findings. Verify in browser and preserve evidence for actual final code.
- [ ] Update acceptance table honestly against v3, with precise remaining evidence limits.
- [ ] Create focused PR(s) with concrete behavior and validation, wait for checks, merge only after review and passing checks. Do not bypass branch protections or impersonate an approving reviewer. Confirm merged SHA in main.


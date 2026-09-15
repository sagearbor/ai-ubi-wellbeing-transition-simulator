# Published-data Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. The controller dispatches one implementer per task and reviewers; implementers never spawn agents.

**Goal:** Deliver a polished, source-grounded allocation experiment, honest historical graphs and portable GitHub comparison.
**Architecture:** New authored CoreModel uses the existing worker and Lab. Pinned financial observations and existing historical reconstruction artifacts feed a new guided front door. Legacy world engine remains unchanged.
**Tech Stack:** Existing React, TypeScript, Recharts, mathjs core and Vitest; no new dependencies.
**Spec:** docs/superpowers/specs/2026-09-15-published-experience.md

## Global Constraints

- Preserve old share/hash owners and model results. Never silently overwrite a mounted Lab draft.
- Reuse the existing core engine and worker runner; do not change the legacy economic engine or its qualification source manifest to implement the new experiment.
- Never change published-paper targets, historical observations or existing qualification evidence to obtain a passing check.
- Financial observations, derived quantities and policy assumptions must be distinguishable beside the results.
- No API secrets, new paid services, cloud deployment or merge. Publish a separate review branch and draft PR.
- Implementers own their assigned files, are not alone in the codebase, and must not revert others' work. No worker-spawned subagents.

### Task 1: Financial observations and an authored allocation model

Read the financial/arithmetic requirements in the spec. Own new files under data/financials/, src/financials/, docs/design/research/reported-company-financials.md and scripts/financials/ if needed. Do not modify existing core engine, constants, qualification or App. This deliverable is independent data plus core model compilation, suitable for later UI and Lab.

Interfaces to produce (exact exported names; shared TS types live in src/financials/types.ts):
```ts
// src/financials/catalog.ts
export const financialRecords: FinancialRecord[];
export function financialRecord(id: string): FinancialRecord; // reject unknown
// FinancialRecord: id, companyId, companyName, fiscalYear, periodStart, periodEnd,
// currency:'USD', unit:'million-USD', revenue:number|null, netIncome:number|null,
// operatingCashFlow:number, cashCapitalInvestment:number, cashCapitalInvestmentLabel:string, cashCapitalInvestmentNote:string, dividends:number|null,
// repurchases:number|null, sourceUrl, sourceTitle, retrievedAt, evidence: line-item provenance.
// src/financials/model.ts
export const defaultFinancialScenario: FinancialScenario;
export function createFinancialModel(record: FinancialRecord, scenario: FinancialScenario): CoreModel;
// FinancialScenario: policyShare:number [0,1], trainingShare:number [0,1],
// recipientCountry:string, costPerCompletion:number >0, instructorCapacity:number >=0,
// eligibleTrainees:number >=0, placementRate:number [0,1], suitableOpenings:number >=0.
// Export sourced recipient cohorts and all display metadata the UI needs.
```

- [ ] Add pinned official FY2025 annual data for Apple, Microsoft, Alphabet, Amazon, Meta, Nvidia. Verify original statements (not financial aggregators); retain bounded source evidence and report dates so a reviewer can independently check. Use SEC/offical investor reports. Apple known official FY2025 source https://www.apple.com/newsroom/pdfs/fy2025-q4/FY25_Q4_Consolidated_Financial_Statements.pdf values USD millions: OCF111482, cashPP&E12715, revenue416161, netIncome112010, dividends15421, repurchases90711. Other figures must be researched, not guessed. A retrieval failure is explicit and another accessible official report is the fallback. Document parent consolidation, cash-capex definition and collection coverage.
- [ ] Pin resident counts from the existing sourced country dataset, with exact year/source and conversion millions to people. Support USA and existing country ids, no invented recipient list. Nominal company money remains nominal; no GDP ratios.
- [ ] Write behavioral tests before implementation: Apple's derived annual base equals 98767 million USD; policyShare=.1 and trainingShare=0 yields 9876.7 million annual dividend; monthly/person divides once by12 and actual resident count; zero policy yields zero; 100% training with tiny instructor capacity shows unused money; zero openings yields zero placements; placementRate>1, unknown country, negative/nonfinite cost and missing financial inputs reject. No arbitrary maximum hides a response.
- [ ] Implement CoreModel with explicit scalar inputs/parameters, public source metadata, a single fiscal-year point (or start=end supported time), outputs named source_cash_flow, allocatable_base, policy_budget, dividend_spend, training_budget, completions, actual_training_spend, unspent_training, placements, monthly_dividend_per_person. Use dollars internally, source recorded in millions converted once. Invariants conserve budget and prevent capacity/openings/recipient violations. No policy hooks after hard accounting limits. Raw negative cash flow visible; explicit nonnegative allocation convention documented.
- [ ] Tests execute createFinancialModel via existing worker execute/runModel and assert real outputs/invariant errors. Run covering tests and typecheck. Commit and report exact exported interfaces, source selection, tests, concerns. No implementation of shared UI yet.

### Task 2: Reproducible historical reconstruction artifact and view

Own new files scripts/hindcast/export-experience.ts, data/hindcast/experience.json, src/history/, components/history/, docs/design/research/historical-experience.md. May add script/check command to package.json; don't edit existing economic harness or observations or App. Read spec Historical page and appearance.

Interfaces:
```ts
// components/history/HistoryExperience.tsx
export default function HistoryExperience(): React.ReactElement;
// Data artifact records version, producing command, model and fit scope,
// exact source hashes, coverage, aggregates and annual series for all existing runs/countries.
```

- [ ] Inspect validation/hindcast.ts and scripts/hindcast/run-hindcast.ts and reuse the actual harness; no second forecasting implementation. Generate static artifact reproducibly, with check mode refusing stale hashes/results. Use compact JSON and lazy UI import. Show all existing AI/UBI variants in labeled selector.
- [ ] Verify baseline matches existing rerun: 106/128 countries, 2015–2025, wellbeing MAE4.532045217834075 vs persistence4.679433962264151; AI/UBI off; USA modeled2025 wellbeing70.81445034207391 vs observed68.16. Don't repin assertions to new numbers. Artifact includes exclusions and actual per-year observations, not merely endpoints.
- [ ] Create responsive actual/model/persistence chart for country and metric selection (wellbeing index / constant-2015 GDP per person), selected country's endpoint error and aggregate cohort scores; accessible data table and data download. Label observed units, annual dates, missing gaps. GDP no meaningful cross-country correlation because model growth is effectively common. Persist baseline is computed from available start observations and identified as a baseline.
- [ ] Keep prominently visible: 'Historical reconstruction, not an out-of-sample forecast'; anchor fitted using2015–2025; legacy world model, not new financial allocation; headline omits AI/UBI. Explain observation-vintage limitation and no causal validation. Expose model/data identifiers and reproducible command in details. No green pass/fail accuracy badge.
- [ ] Write meaningful artifact source/stale/missing-series tests, run them and typecheck; do not add snapshot styling tests. Commit; report exported interface and artifact size.

### Task 3: Polished guided experience, real comparison and exact handoff

Own components/published/, components/guided/ navigation integration, App.tsx, components/lab/LabTab.tsx jump behavior, stylesheets and src/financials/share.ts plus focused tests. Consume Task1's actual catalog/model/types and Task2's HistoryExperience; consult their reports for exact interfaces. Don't modify financial observations, core equations or historical output to change displayed results.

- [ ] Replace fresh/default Explore body with PublishedExperience, with top navigation Explore / Compare / Check against history / Model Lab. Respect existing hash owners and explicit legacy tab routes. Keep old guided world journey available as 'World scenarios' with its state intact, never misidentify new financial results as world output. Preserve mounted Lab draft and normal experiment navigation.
- [ ] New published UI uses existing runner.run('financial-experience', {kind:'lab-point', ...}) according to actual protocol, with useRunnerJob or equivalent cancellation/identity management. Pending/error runs cannot show prior outputs as current. Exact current CoreModel is downloadable and opens in Model Lab through existing bundle/link mechanism in a new tab so Lab state isn't silently overwritten. Source/model data load lazily where practical.
- [ ] Implement the spec's coherent visual design, real company/year selector, readable cash-flow statement bridge and allocation waterfall, sliders/numeric inputs for policy share and split, recipient country, plain source/derived/assumption labels. Show annual and monthly units exactly and source next to figure. Financial statement fields remain readonly; advanced training assumptions editable. Show distributions and buybacks as competing historical uses, not extra available money. Surface insufficient capacity/jobs and unspent budget as explanation of why more money won't help under those assumptions.
- [ ] Compare two independently editable scenarios using the same selected financial record, recipient cohort and input definitions; include useful defaults (all cash vs a training split) but label all training assumptions. Include source and budget differences, payments, gross placements and binding constraints. No aggregate net-welfare score. Side A/B changes retain state when toggling views. Do not call two fixed legacy baselines arbitrary comparison.
- [ ] Add bounded versioned share encoding, pinned financial/recipient dataset identifiers, both scenario inputs and active view. Validate types, ranges, finite numbers, unknown/stale versions, malformed links; fail explicitly without falling through to apparently shared defaults. Preserve URL hash owner's behavior. A complete JSON download and exact model export remain usable without server. Share must reopen independently with identical computed outputs.
- [ ] Show historical page under ?tab=history and nav. Add direct routes/actions for Paste a policy, Import a model, Add a variable, Explore uncertainty, World scenarios, AI risk. Training starts a friendly allocation view; 'open training equations' goes to correct exact model, JSON importer stays closed. Fix Lab jumpTo('start') opening unrelated nested importer; only intended targeted disclosure opens.
- [ ] Update plain-language status wording where this journey touches old guided context, without hiding actual failures or implying tests are empirical validation. Give clear single-period time basis, rather than irrelevant animation.
- [ ] Test state and route contracts, share roundtrip/malformed values, worker stale states and exact model handoff; run targeted tests/typecheck. Browser checks by controller cover desktop/mobile/dark/light, company changes, training capacity wall, editable A/B, share roundtrip, history and existing policy routes. Commit; report interfaces, checks and any unimplemented requirement.

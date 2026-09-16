# Published-data experience — GitHub comparison handoff

Date: 2026-09-15. Branch: `codex/published-data-experience`.

This candidate makes published company figures the starting point, gives users two editable allocations, exposes real constraints, and makes historical misses visible. It reuses the existing generic CoreModel worker. It does not claim that reliable accounting proves a policy will improve wellbeing.

## What to compare

| Version | Exact baseline | State |
|---|---|---|
| Main before this design | `d6d0b34b8d4a8c901c453e50e2a0dc0422768f77` | Main; deployed app identity not verified |
| Earlier guided redesign, PR #19 | `8c65b9efa9c4add5fb3777506c5a885c5c6ac7d3` | Preserved comparison branch |
| Published-data candidate | Resolve `origin/codex/published-data-experience`, record its full SHA | Separate review branch; no merge or deployment |

The new PR is stacked on the earlier redesign to show the focused change. Review the full candidate against main as well before deciding what to merge. The public Cloud Run URL has not been updated by this work. Localhost previews are local to the computer running them; GitHub is the portable handoff.

## Start here

1. **Explore:** Apple FY2025 and United States residents. Click **Try an allocation**, change the policy share, and see the monthly equivalent update. The adjacent statement bridge and report link explain the source.
2. **Compare:** independently edit A and B using the same company and resident cohort. Change training capacity or job openings to expose a real modeled limit. Unspent money stays visible.
3. **Check against history:** observed values, model reconstruction and persistence baseline; country, measure and run selectors; all 106 scored countries and 22 exclusions; annual data and complete download.
4. **Model Lab:** open the exact current financial model in a new tab. Import other models, add variables, inspect equations, work with policy text, or explore uncertainty using existing tools.
5. **Follow the question further:** world trajectories and AI risk remain available and explicitly identify their separate model families. They do not inherit this financial allocation result.

## Numerical and evidence contract

The annual allocation base is `max(0, operating cash flow − cash capital investment)`. The raw difference remains visible. This is a disclosed allocation convention, before shareholder dividends and repurchases; it is not AI-attributable profit, idle cash or a claim that a government can collect it without consequences.

All six companies have source URLs, statement locations, fiscal periods and nominal USD units in `data/financials/fy2025-v1.json`. NVIDIA's investment deduction includes intangibles. Amazon and Meta use different issuer free-cash-flow conventions; their source notes explain the differences. Apple's selected annual figures are from its explicitly **unaudited** consolidated earnings-release statements. Missing values mean uncollected, never zero. Private companies and subsidiaries are not guessed or separately counted. Unlike fiscal periods must not be summed into a common-year total.

The recipient count uses the exact sourced population, not rounded millions. The initial US cohort is 340,003,797 residents from 2024. Apple's 10% cash-only allocation must equal:

- Annual base: **$98,767,000,000**.
- Proposed annual resident allocation: **$9,876,700,000**.
- Monthly equivalent per resident: **$2.420732770032369**.

Training completions are limited by funding, instructor capacity, eligibility and resident population. Gross placements are limited by the assumed placement rate and suitable openings. These are user-declared scenario constraints, not newly estimated labor-market facts. The model does not estimate net jobs, investment responses, tax incidence or causal wellbeing effects. Dollars and people are conserved under the authored model's invariants, including adverse overlays.

The historical graph reproduces the existing world-model harness. Its headline AI/UBI-off reconstruction has 2025 wellbeing mean absolute error **4.5320 index points**, versus **4.6794** for persistence, across 106 equally weighted countries. The US endpoint is 70.81445 modeled versus 68.16 observed. These are endpoint errors, not accuracy across every annual point. The wellbeing anchor was fitted on the same 2015–2025 span and the starting state uses 2015 observations. The observations were retrieved later. This is **not a held-out forecast**, causal evidence, or historical validation of the new financial allocation. All sensitivity runs and exclusions remain visible. Frozen calibration, historical data vintages and genuine holdouts are still missing.

## Reproduce on another computer

Use a clean checkout or separate worktree; preserve existing local work. No API key is needed for the financial experiment, manual policy workflow, history, tests or build.

```sh
git fetch origin
git worktree add --detach ../simulator-published-review origin/codex/published-data-experience
cd ../simulator-published-review
git rev-parse HEAD
npm ci
npm run check
node --import tsx scripts/hindcast/export-experience.ts --check
npm run dev -- --host 127.0.0.1 --port 3005 --strictPort
```

Open the local address Vite prints. Use `?tab=history` for the historical graph. Start the prior redesign in another clean worktree on another port for comparison. Existing optional Gemini extraction embeds the browser key when configured; this work does not add a gateway or put a key in the repository.

## Implementation and review map

| Responsibility | Files |
|---|---|
| Published statement data and provenance | `data/financials/fy2025-v1.json`, `docs/design/research/reported-company-financials.md` |
| Source/cohort validation and authored equations | `src/financials/catalog.ts`, `cohorts.ts`, `model.ts` |
| Bounded, pinned file/link replay and exact model reconstruction | `src/financials/share.ts` |
| New UI and current-worker-result gate | `components/published/`, `App.tsx` |
| Historical artifact and generation/check | `data/hindcast/experience.json`, `scripts/hindcast/export-experience.ts`, `src/history/history.test.ts` |
| Historical graph and full cohort | `components/history/`, `docs/design/research/historical-experience.md` |
| Design and acceptance | `docs/superpowers/specs/2026-09-15-published-experience.md` |
| Controller verification and final review disposition | `docs/design/reviews/2026-09-15-published-experience-verification.md` |

Each implementation task received an independent review. The financial review checked the six original company reports. The historical review recomputed the artifact's source hashes, cohorts, errors and baseline. The UI review examined routing, state, hash ownership and exact worker-result handling. The final broad review found the Lab observation-label issue and one allocation-container accessibility role issue; both were fixed in `3d8393d` and the scoped rereview approved them with no open findings. Final `npm run check` passed 1,169 tests in 81 files, all validators and the production build.

## Deliberate boundaries and design rulings

- **Preserve comparison:** separate branch and draft PR; earlier redesign, main and public deployment untouched. A discarded branch is the rollback.
- **One existing authoring engine:** the real-data allocation is an authored CoreModel, not another custom simulation engine. Its fiscal-year scope is explicit. Other solver/model families remain separate rather than receiving invented financial-to-macro equations.
- **Traceable source collection:** six public consolidated groups initially, rather than a large guessed roster. This limits coverage but makes each observation auditable.
- **Exact sharing:** new versioned `#finance` owner pins data, engine conventions and both model hashes; bad or stale shares fail rather than quietly migrate. Existing hash owners remain intact. Full authored-model files can be downloaded separately.
- **No evidence reset:** legacy core/world calculations, lockfile, published targets and qualification records are unchanged. The historical artifact uses the existing outputs without tuning. Direct Node commands avoid changing pinned package metadata merely to add a script.
- **Corrected statements:** identical modeled country GDP growth applies to the AI-off historical case only; the AI-on sensitivities differ. Source audit wording was narrowed from “audited groups” because Apple's selected release is explicitly unaudited. Browser accessibility snapshots rounded large number-input values, but exact DOM values and engine results were unchanged; that was a tool-display artifact.

Remaining product work should be driven by user testing and scientific priorities. The main scientific gap is a defensible link from a funded allocation to economic behavior and wellbeing, with held-out evidence. It should be visible as missing, not filled with impressive-looking guessed equations. Existing broader world scenarios remain exploratory and do not solve that gap.

# Beta final-review fix: authoring capability

Bounded response to the important authoring finding in `2026-09-15-beta-final-review.md`. No additional findings or scope were introduced.

## Changes

- `components/lab/AddVariableForm.tsx`: when the model exposes zero eligible equation targets, replace creation controls with an explicit unavailable explanation and the concrete “Equations and files” → “Advanced: model file” → “Export model + overlays (JSON)” route. Explain editing inputs/equations with units/sources, importing through the existing import panel, and the experimental status and independent review needed for the changed model. Keep existing overlay removal outside the conditional. Keep supported-model creation unchanged.
- `components/published/PublishedExperience.tsx`: rename the exact-scenario authoring link to “Inspect extension options”; its URL and scenario identity are unchanged.
- `components/lab/AddVariableForm.test.tsx`: four focused checks cover absent controls and concrete instructions, real supported-form application with an engine-valid overlay, and working removal callbacks with and without eligible targets.
- Three existing `components/published/PublishedExperience*.test.tsx` files: update link-label expectations while retaining exact scenario/source handoff checks.
- `docs/release/three-step-delivery.md`: optional stale future-tense wording corrected to describe the completed security patch.

## Verification

Runtime: `/private/tmp/history-node22/package/bin/node` (Node 22.23.2).

- Focused Vitest run over the new authoring test and three existing published tests: 39 tests / four files passed.
- Typecheck identified two errors in the new test's engine invocation, corrected before completion: options must contain `overlays`; diagnostics use `level`.
- Re-ran the corrected new authoring test: four tests passed, including real engine validation of the submitted overlay.
- Final `node node_modules/typescript/bin/tsc --noEmit`: passed.
- Existing server-rendered chart size warnings occurred during published continuity checks; assertions passed.

## Scope and remaining verification

No equations, financial hooks, financial identities, datasets, numerical runtime, qualified source files, or frozen results changed. Financial start/end behavior is untouched. No full-suite duplication, build, browser interaction, deployment or publication was performed by this worker. Root owns the actual financial-route and supported-income-example browser checks and the single scoped re-review. The local handler test uses a minimal state hook mock, not a browser DOM.

Model export/edit/import guidance is verified against the existing component labels; arbitrary edited models still require validation and appropriate scientific review. This fix makes no claim that a new financial extension has been implemented or qualified.

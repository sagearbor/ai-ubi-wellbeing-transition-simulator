# Historical reconstruction experience

The page presents the legacy world's 2015–2025 retrospective reconstruction. It does not validate the new financial allocation model, establish causality, or estimate held-out forecast accuracy. The 2015 state copies observed wellbeing and gross domestic product (GDP) per person, and the wellbeing anchor uses the same 2015–2025 span. Headline artificial intelligence (AI) displacement and universal basic income (UBI) channels are both off.

## Reproduce the artifact

Run in the repository terminal:

```sh
node --import tsx scripts/hindcast/export-experience.ts
node --import tsx scripts/hindcast/export-experience.ts --check
npm exec vitest run src/history/history.test.ts
npm run typecheck
npm run qualification:source-check
```

The exporter invokes the existing `scripts/hindcast/run-hindcast.ts --json` entry point. No simulation or forecasting equations are copied into the exporter or view. File-backed stdout is deliberate: the existing CLI calls `process.exit`, which can truncate large JSON when stdout is a pipe. A temporary file is removed after capture.

Artifact version 1 includes the full report, all five existing runs, 106 scored countries, annual series including null observations, 22 excluded countries with reasons, baseline scores, model parameters and diagnostics. SHA-256 hashes cover 30 local source files: the CLI's recursively imported dependencies (including country JSON and type declarations), observation files, exporter and lockfile. Check mode reruns the authoritative CLI and compares both hashes and the complete results. A normal Vitest test performs this same freshness check, so `npm run check` exercises it without changing the legacy-pinned `package.json` or qualification manifest.

No generated timestamp is added: unchanged sources produce identical bytes. Size: 740,865 bytes compact JSON, 248,766 bytes gzip with the local Node runtime. The view must be loaded through `React.lazy`, keeping this data out of the initial entry chunk.

## Preserved published values

- Scored countries: 106 of 128; endpoints 2015 and 2025, eleven annual states and 120 monthly steps.
- Headline wellbeing mean absolute error: 4.532045217834075 index points.
- Persistence wellbeing mean absolute error: 4.679433962264151 index points.
- USA modeled 2025 wellbeing: 70.81445034207391; observed: 68.16.
- The exporter refuses changed values rather than accepting newly fitted targets.

Mean absolute errors concern the endpoint or decade-long change, with equal country weights. The GDP score is the absolute error in decade-long growth percentage points. Persistence holds each country's observed 2015 level constant; its GDP growth error is computed against zero growth from the actual harness endpoint results. Annual data are not pooled into these aggregate endpoint scores.

## View interface and behavior

```tsx
const HistoryExperience = React.lazy(() => import('./components/history/HistoryExperience'));
// Render inside a Suspense boundary; component has no props.
```

`components/history/HistoryExperience.tsx` exports the default `HistoryExperience(): React.ReactElement`. `src/history/types.ts` exports typed artifact metadata plus `annualRows(run, countryId, metric)`; it has type-only engine imports and performs no engine execution in the browser.

The country selector contains all 106 scored countries. The run selector exposes the headline and all four alternative runs, retaining their exact harness settings. The measure selector chooses wellbeing index (Cantril ladder multiplied by ten) or constant-2015 US dollars per person. A responsive SVG shows modeled, observed and persistence series with null gaps, an accessible description, distinct colors and dashed baseline. A labeled annual table exposes each value and missing observation. Another table includes all 106 countries sorted by absolute wellbeing miss. Download exports the complete artifact across every run, country and year, not only the displayed selection.

Visible boundaries identify the same-span fit and copied start, modest improvement over persistence, omitted shocks, and separate legacy model. Source details expose observation URLs and retrieval vintages, model identifiers, hashes and exact commands. GDP correlation is omitted for every selection. In AI-off runs, modeled growth is effectively common across countries, making cross-country correlation uninformative. AI-on runs can have heterogeneous growth; their sensitivity reconstructions still do not establish predictive or causal validity. No accuracy pass/fail badges are rendered, even though the unmodified harness report retains its existing test records in the downloaded artifact.

The page defines scoped light/dark colors, native labeled controls, focus outlines, reduced-motion behavior and locally scrolling wide tables. Application routing, lazy loading and browser screenshots belong to integration Task 3.

## Remaining evidence limitations

Source vintages were retrieved after the modeled decade and do not represent information available in 2015. Population, governance and related background attributes retain legacy constants rather than a full historical panel. Frozen calibration and data vintages evaluated on temporal/country holdouts remain future work. This implementation fits nothing and changes no observations, economic engine, financial model or qualification evidence.

## Cross-runtime numeric reproducibility

A clean Ubuntu/Node 22 CI run exposed an overly strict byte comparison against the artifact produced on macOS/Node 26. Local Node 22.23.2 versus 26.8.2 reproduction found twelve differing numeric leaves, solely AI-on modeled wellbeing for Thailand and India, with absolute differences from 3.552713678800501e-15 to 1.4210854715202004e-14 index points. Observations, aggregate scores, source hashes and fixed headline values were identical. Instrumenting `Math.sin`, `Math.pow`, `Math.log`, `Math.log2` and `Math.log10` found differing `Math.pow` outputs; substituting only the captured Node 26 `Math.pow` outputs into the Node 22 diagnostic run made the entire report identical. This isolated rounding in the displacement-friction calculation, without editing the engine.

The freshness check therefore permits at most `8 * Number.EPSILON * max(1, abs(stored), abs(fresh))` only at country `predictedWellbeingSeries`, `predictedWellbeingEnd`, `predictedWellbeingChange` and `wellbeingError` leaves. This is below 1.8e-13 points on the 0–100 wellbeing scale. Every observation, GDP value, aggregate score, parameter, baseline target, identifier and source hash remains exact. Mismatches outside the bound report the precise path and stored/fresh values. This is a comparison tolerance, not rounding or regeneration of published output values.

Regression tests retain the twelve observed runtime differences, reject even a floating-point-scale edit to an observation, and reject larger modeled edits plus changed country errors, GDP and aggregate scores. The original artifact report remains bit-for-bit identical; only its exporter source hash changed. Node 22 and Node 26 targeted tests and direct exporter checks pass locally. A fresh Ubuntu CI run remains the final platform confirmation.

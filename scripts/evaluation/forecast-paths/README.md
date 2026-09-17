# Forecast paths and the matched health/income diagnostic

The new diagnostic is complete. **Do not rerun `score_once.py`.** It has one committed-before-scoring prediction set and one score receipt. The comparison uses an already-known outcome period and is explicitly exploratory.

Open `docs/design/reviews/2026-09-16-forecast-paths.html` for the interactive historical and forward paths. The report is self-contained. The companion research note is `docs/design/research/2026-09-16-health-income-diagnostic.md`.

## Rebuild the display without a new score

From the repository root, with Node 22 and the installed package dependencies:

```sh
node --import tsx scripts/evaluation/forecast-paths/forward-offset.ts
python3 scripts/evaluation/forecast-paths/build_paths.py
python3 scripts/evaluation/forecast-paths/render_paths.py
```

The optional conversation companion uses the same data. `render_inline.py` takes an absolute output filename; it preserves six decimals for display and omits unused fields. The canonical JSON artifacts retain full precision.

## Verification

```sh
python3 -m unittest discover -s scripts/evaluation/forecast-paths -p 'test_*.py'
node --check scripts/evaluation/forecast-paths/chart.js
npm run check
```

The Python checks cover model restrictions, frozen hashes, exact propagation of the diagnostic ensemble, missing-origin exclusion, score masks, and reproduction of the original offset forecast. They do not rescore or refit.

## Boundaries

- Historical scores measure absolute error for wellbeing and income separately; no combined welfare score.
- Forward paths are 2025-origin projections using unchanged 2018 calibrations, not a new fit or an operational forecast.
- The default bold line was chosen after seeing the 2025 outcomes. Its historical advantage is not independent evidence that its future paths are best.
- No AI or policy shock is applied. Forecast accuracy does not establish a policy's causal effect.
- Displayed model spread is not a probability interval.
- The production model, original evaluation files, and reference-target ledger are unchanged. This diagnostic has its own research ledger in the note and its own append-only receipt.

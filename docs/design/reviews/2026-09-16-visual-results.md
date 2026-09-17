# Which forecasts are good—and which are bad?

**Start with this graph. Green means less prediction error than holding each country at its 2018 value. Red means more error.** These are results on the historical test, not promises about the future.

![Wellbeing model comparison: the selected blend has 10.2 percent less error, the country-offset model 9.7 percent less error, and the original model 19.2 percent more error.](figures/2026-09-16-forecast-paths/01-wellbeing-good-bad.png)

**My recommendation:** keep country offsets as the research reference. The bold blend is a candidate; its weights were chosen after seeing these outcomes. The new tests did not produce a better model or a 20% wellbeing improvement.

## Did the lines follow reality?

**Dark = observed. Bold blue = the selected blend.** The US example shows a miss; India shows an improvement. An overall average can hide either.

![Historical US and India wellbeing paths, comparing observations with individual forecasts and the bold ensemble.](figures/2026-09-16-forecast-paths/03-history-versus-forecasts.png)

## Where the overall improvement breaks down

The models below improve the overall score but **make predictions worse for the richest quarter of countries**.

![Green overall improvements contrasted with red errors among the richest quarter of countries.](figures/2026-09-16-forecast-paths/02-rich-country-limit.png)

## What they project into the future

These start from observed 2025 values and use the unchanged earlier fits. **They are illustrative projections, not verified future predictions.** No AI shock or proposed policy is applied.

![Model projections for US and India wellbeing through 2032, showing multiple paths and a bold blend.](figures/2026-09-16-forecast-paths/04-future-paths.png)

## Income is a different result

Income forecasts can beat a flat baseline by much more than wellbeing forecasts. **We do not combine these into one success score.**

![Income forecasts improve on persistence, with the country-offset model reducing endpoint error by about 44 percent.](figures/2026-09-16-forecast-paths/05-income-good-bad.png)

<details>
<summary>What is measured, and what is still uncertain?</summary>

- The first chart uses the **2025 endpoint**, with 97 observed countries. Wellbeing error is measured in points on the 0–10 life-evaluation ladder. It is not a percentage of happiness.
- “10% less error” means one tenth less average absolute prediction error than persistence. Persistence keeps each country's 2018 level unchanged.
- Results that average **all seven years** answer a different question and can rank models differently. They are in the full research note.
- The blend was selected from combinations after the outcomes were known. Its historical advantage is not independent proof of future performance.
- The new round was also designed after earlier outcomes were known. Its predictions were frozen before one new score, but the period is no longer an untouched test set.
- The country examples are illustrative. The overall graph covers every available country; no score was recalculated by selecting only these examples.
- The graph images use saved results. Generating this page did not train models or invoke another scoring run.
- These research findings have not changed the production app.

[Full research note](../research/2026-09-16-health-income-diagnostic.md) · [Interactive HTML source](2026-09-16-forecast-paths.html) · [PR #33](https://github.com/sagearbor/ai-ubi-wellbeing-transition-simulator/pull/33)

</details>

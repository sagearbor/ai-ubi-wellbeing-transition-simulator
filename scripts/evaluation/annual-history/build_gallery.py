"""Build a GitHub-native graph gallery from saved experiment artifacts."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
REV=ROOT/'docs/design/reviews'
PAGES=REV/'annual-history-20260917'
PAGES.mkdir(parents=True,exist_ok=True)
W=json.loads((ROOT/'data/evaluation/annual-wellbeing-20260917/paths.json').read_text())
O=json.loads((ROOT/'data/evaluation/annual-objective-20260917/metrics.json').read_text())
F='figures/annual-history-20260917/'
EXAMPLES=['USA','IND','DEU','GBR','BRA','JPN','ZAF','CHN']
COUNTRIES={c['id']:c for c in W['countries']}
LABELS={'gdp':'Income per person','life_expectancy':'Life expectancy','unemployment':'Unemployment'}
BEST={t:min([r for r in O['pooled'] if r['target']==t and r['horizon']==1 and r['method']!='persistence'],key=lambda r:r['mae'])['method'] for t in LABELS}

def verdict(v):
    return f"{'GOOD' if v>0 else 'BAD'}: {abs(v):.1f}% {'less' if v>0 else 'more'} error than repeating last year"

for cid in EXAMPLES:
    c=COUNTRIES[cid];id=cid.lower()
    parts=[f"# {c['name']}: annual historical predictions",'',
      '[Back to the main visual review](../2026-09-17-annual-history-graphs.md)','',
      '**Black = observed/source estimate. Blue = highlighted model. Dashed gray = repeat the last observation.** The blue candidate was selected by the whole study’s pooled error, not chosen separately to flatter this country. Every forecast point updates from previous-year information; this is not one uninterrupted forecast from 1960.','',
      'Each figure includes a **change panel**: that is where missed spikes become visible. The GOOD/BAD label refers to average error on identical observations, not proof of reliable future or policy effects.','']
    for target,label in LABELS.items():
        stat=next(r for r in O['countries'] if r['country']==cid and r['target']==target and r['horizon']==1 and r['method']==BEST[target])
        parts += [f"## {label}",'',f"**{verdict(stat['skill']*100)}.**",'',f"![{c['name']} {label}: annual levels and changes](../{F}objective-{id}-{target}.png)",'']
    stat=W['metrics']['rolling']['byCountry'][cid]['shrinkage_change']
    parts += ['## Wellbeing: one-year forecast','',f"**{verdict(stat['percentMAEReductionVsPersistence'])}.** This is the annual 0–10 life-evaluation survey score, not a blend of GDP, lifespan and unemployment.",'',f"![{c['name']} annual wellbeing forecast and annual changes](../{F}wellbeing-{id}-rolling.png)",'',
      '## Wellbeing: reconstruction using known annual conditions','',
      '**Conditional replay:** the model receives the actual target-year GDP, life-expectancy and unemployment inputs, plus observed previous-year wellbeing. Coefficients stay frozen at 2016. This is a sequence of one-year reconstructions, not an advance forecast of those conditions. Missing requirements cause gaps.','',
      'Its scoring years and fitting rule differ from the forecast above; do not read the two pooled errors as a controlled test of the value of knowing the inputs.','',f"![{c['name']} conditional annual wellbeing reconstruction](../{F}wellbeing-{id}-conditional.png)",'',
      '**Sources:** World Bank annual constant-2015-dollar GDP per person, total life expectancy and modeled ILO unemployment; World Happiness Report / Gallup public annual chart transcriptions. Latest revised source data, not historical release vintages. Life-expectancy observations stop at 2024; unemployment starts in 1991 and its forecast test starts in 2011. Missing values are not interpolated by these experiments.','',
      '[Methods, full results, sources and limitations](../2026-09-17-annual-history-graphs.md#methods-and-checks)','']
    (PAGES/f'{id}.md').write_text('\n'.join(parts))
links=' · '.join(f"[{COUNTRIES[c]['name']}](annual-history-20260917/{c.lower()}.md)" for c in EXAMPLES)
text=f'''# Annual historical predictions — see what works and what misses

**Open a country to see the graphs directly on GitHub. No download or local server is needed.**

{links}

![Annual forecast error improvements and country limitations]({F}00-annual-results.png)

The long-history tests find useful improvements for **GDP per person and life expectancy**. **Annual happiness swings remain unsolved** in this test: the best fixed candidate reduces average error by only **1.21%**, and is worse in **five of the eight** preselected countries. Unemployment’s small one-year gain also hides more country losses than wins.

This research branch adds **40 country charts and three overview images**. It does not change the production app, earlier frozen experiments or model defaults. Both experiments were specified before their one scored comparison; all candidates and losses remain published.

## Start with these two graphs

For US GDP, the upper panel looks close. The lower panel shows why that is not enough: the model misses the sharp falls and rebounds. It improves the long-run average error while still missing major turning points.

![United States GDP: historical levels and annual changes]({F}objective-usa-gdp.png)

For US wellbeing, forecasts now move every year, but they often follow the previous observation. The bold model still has **2.0% more error than simply repeating last year**. Annual updates solve the straight-line presentation problem; they do not by themselves solve prediction.

![United States annual happiness: observed scores, forecasts, and changes]({F}wellbeing-usa-rolling.png)

## Explore the eight countries

{links}

Each country page shows **income, lifespan, unemployment, annual wellbeing forecasts and a separate wellbeing reconstruction with known annual drivers**. Countries were chosen before the results. Every registered candidate appears, not only the highlighted one. The observed histories go back to **1960 for GDP and lifespan**, **1991 for unemployment**, and **2005/06 for wellbeing**, where the source contains a value. Forecast scoring starts later because training history is required.

## Which approaches helped?

![All three objective-model candidates at one-year and five-year horizons]({F}objective-overview.png)

The lowest-error registered candidates give these descriptive results:

- **GDP per person:** **14.8% less error at one year**, **17.5% less at five years**. The one-year candidate improves **154 of 202** scored economies; 48 are worse.
- **Life expectancy:** **20.2% less error at one year**, **30.9% less at five years**. The one-year candidate improves **201 of 217** economies; 16 are worse. Some source history is itself modeled or interpolated, which limits what close agreement establishes.
- **Unemployment:** only **1.1% less error at one year**; **113 of 187** countries get worse. **Every candidate loses at five years**; even the least-bad is **5.8% worse** than persistence.

These are errors on three separate targets and units. **There is no combined “happiness accuracy” score.** Best-candidate selection used the same published comparisons; it is not independently confirmed or evidence that these gains will persist.

![Annual wellbeing candidates: forecast and conditional replay results]({F}wellbeing-overview.png)

For wellbeing, the best rolling candidate is a fixed **50% annual-change model / 50% persistence** blend. Its error is **0.22279 versus 0.22551 ladder points**: just **0.00272 points** less error across 69 scored country-years. Only India, Japan and China improve under this particular globally selected blend. The country-offset model is substantially worse.

Giving the frozen-2016 model actual target-year GDP, lifespan and unemployment does **not** produce a successful annual reconstruction: all four registered candidates lose to persistence on their own common mask of 61 observations. The conditional and forecast modes have different masks and fitting cutoffs, so their pooled errors are not a controlled comparison of input quality.

## What changed from the previous straight lines?

The earlier graph asked: **“Standing in 2018, what would happen through 2025 without new observations?”** Smooth long-range expected paths can be legitimate answers to that question. Its wellbeing observations were **three-year averages**.

These graphs ask: **“After observing last year, how well could we estimate the next year?”** Each point is a new forecast using earlier dated observations. We separately test **“Given the actual annual conditions, can the model reconstruct this year’s wellbeing?”** The new wellbeing target uses **individual survey years**, so real annual variation is visible.

The new scores are therefore **not comparable to the old 5–9% gains**: target definitions, countries, horizons and baselines changed. A rolling curve can follow the level closely while remaining poor at the changes. The change panels expose that. Known historical recessions or the pandemic have not been inserted into earlier forecasts after the fact.

## What the literature supports

The research agent found established explanatory, dynamic and forecasting methods. It did **not** find evidence of a universal equation that accurately anticipates each country’s annual happiness shocks. In the 2026 World Happiness Report, six-factor regression explains much of **between-country and over-time variation together**; that reported fit is not a test of future annual changes. GDP, social support, healthy life expectancy, freedom, generosity and corruption are not interchangeable with the three macro inputs tested here. See the [official statistical appendix](https://files.worldhappiness.report/WHR26_Statistical_Appendix.pdf) and the [independent literature review with exact samples and horizons](../research/2026-09-17-annual-literature-review.md).

The full annual research predictor panel currently requires Gallup-approved access. We used publicly displayed annual country scores for the eight predetermined examples, with saved rendered-chart coordinates, three-decimal transcription and tooltip spot-checks. That allowed an honest small demonstration, **not a replication of the full WHR model**. Source rounding is not measurement accuracy; annual survey noise is not separately estimated here. [WHR data access](https://www.worldhappiness.report/data-sharing/), [public annual dashboard](https://data.worldhappiness.report/map).

Good historical tracking is a useful requirement for a simulator, but it cannot establish that a proposed AI policy causes the modeled change. A weather-style fan should eventually show uncertainty that has been checked for coverage; the spread of several similar models alone is not a calibrated probability range. Forecasts using realized future predictors must remain separately labeled. [Forecast evaluation](https://otexts.com/fpp3/accuracy.html), [forecasting with external predictors](https://otexts.com/fpp3/forecasting-regression.html).

## What I would do next

1. **Keep separate outcome tracks.** Use GDP, unemployment, longevity and reported wellbeing as distinct outputs. The new GDP and lifespan models are promising research benchmarks; do not silently turn them into the wellbeing equation or replace production defaults from this comparison.
2. **Get the annual social-predictor panel and reproduce the published wellbeing model.** That is a more substantive next step than another grid of blend weights. Fit only the declared training years, compare within-country annual changes, carry survey uncertainty, and retain the same-masked persistence baseline. Access and redistribution permissions need to be established before releasing that larger dataset.
3. **Register the next model and genuinely fresh evaluation before looking at its results.** The periods here have already been inspected. Use remaining unexamined data or a prospective next-release test, and compare against stronger simple baselines as well as persistence. Reconstruct historical publication lags/revisions before calling anything a real-time backtest.
4. **Evaluate turning points and uncertainty explicitly.** Simple upward drift already gets many GDP and lifespan directions right. Forecast bands and shock probabilities need their own calibration and tests. Future pandemics or wars cannot be scheduled into forecasts by hindsight.
5. **Validate policy effects separately.** Use published causal policy evidence for interventions, with applicability and uncertainty visible; annual forecasting skill alone cannot authorize a UBI, tax or AI-alignment effect.

No further scoring or tuning was done to chase a better headline after these results.

## Methods and checks

**Local checks passed:** 14 new Python research tests, independent saved-evidence audits, 43 image integrity checks, 83 gallery links, and the complete `npm run check` (1,321 application tests plus validators and production build). All 116 pre-existing evaluation files are unchanged from the previous review commit. These software checks do not establish forecasting accuracy.

- [Coordinated plan](../research/2026-09-17-annual-history-plan.md), [objective study and every candidate](../research/2026-09-17-annual-objective.md), [wellbeing study and every candidate](../research/2026-09-17-annual-wellbeing.md), [independent literature and code audit](../research/2026-09-17-annual-literature-review.md).
- **Objective scoring:** exact prior 20 observed years; fixed candidates; rolling one- and five-year endpoints. GDP errors are percentages of origin-year GDP; unemployment errors are percentage points; lifespan errors are years. Training-year dates exclude the target, but latest source revisions can contain later information. The five-year tests have overlapping, dependent origins.
- **Wellbeing scoring:** eight countries chosen before collection; training begins in 2005 and initial fit ends in 2016; rolling fits end in each prior year. Conditional coefficients stay frozen at 2016 and use actual target-year drivers plus observed prior-year wellbeing. No missing values are filled. China has no 2022 annual target, which also prevents several lag-dependent forecasts.
- **All methods use identical scoring rows within a target, horizon and mode.** Mean absolute error reduction is `100 × (1 − model MAE / persistence MAE)`. At a common one-year origin, change error equals level error algebraically; these are not two independent wins.
- **Evidence audits:** the objective export has 151,272 prediction rows, including 37,818 matched four-method forecast sets. The wellbeing export has 780 predictions in 130 matched six-method sets. An agent separate from each implementer checked source hashes, cutoffs, masks, units and score arithmetic without rerunning the scorers. See the [wellbeing audit artifact](../../../data/evaluation/annual-literature-20260917/wellbeing-audit.json).
- **Source attribution:** [World Bank real GDP per capita](https://data.worldbank.org/indicator/NY.GDP.PCAP.KD), [life expectancy](https://data.worldbank.org/indicator/SP.DYN.LE00.IN), [modeled unemployment](https://data.worldbank.org/indicator/SL.UEM.TOTL.ZS), and World Happiness Report / Gallup public annual charts. World Bank and Gallup source terms are separate from the repository’s code license.
- **Prior artifacts:** previous frozen evaluation namespaces remain unchanged. A separate old research-note correction fixes the arithmetic `ln(2) ≈ 0.693`, not one, and corrects its unsupported annual-data-access claim. These documentation corrections change no model output.

### Read-only verification and graph reproduction

The Python studies use Python 3.12, NumPy 2.5.3 and Matplotlib 3.10.8. In a Python environment with those dependencies, run from the repository root:

```bash
python -m unittest discover -s scripts/evaluation/annual-objective -p 'test_*.py' -v
python -m unittest discover -s scripts/evaluation/annual-wellbeing -p 'test_*.py' -v
python scripts/evaluation/annual-objective/verify.py
python scripts/evaluation/annual-history/verify_gallery.py
python scripts/evaluation/annual-history/render_objective.py
python scripts/evaluation/annual-history/render_wellbeing.py
python scripts/evaluation/annual-history/build_gallery.py
npm run check
```

The plotting scripts read frozen outputs; they do not fit or call either scorer. The study runners deliberately refuse another scored run in the same registered namespace. Do not delete their receipts to rerun them. Full source bytes, protocol history and receipts are retained for review.
'''
(REV/'2026-09-17-annual-history-graphs.md').write_text(text)
print('Wrote main visual report and8country graph pages.')

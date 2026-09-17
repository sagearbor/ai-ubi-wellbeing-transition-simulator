# Annual historical tracking: coordinated research plan

Registered before integration or comparison of the new studies, 17 September 2026.

## Question

Can models follow year-to-year historical changes in wellbeing, real GDP per person, unemployment and life expectancy better than a forecast that repeats the last observed value? Can a separate conditional replay explain changes when the historical drivers are supplied?

The user asked for annual country graphs, long historical coverage, and an independent literature review. This is a research branch. Previous frozen experiments, model defaults and production code remain unchanged.

## Parallel work

1. `annual-literature-20260917`: primary literature, exact annual/rolling measurement definitions, accessible source inventory, distinction between reconstruction and predictive evidence.
2. `annual-wellbeing-20260917`: genuine annual ladder observations, conditional reconstruction and rolling one-year forecasts. No substitution of three-year averages for annual targets. Each protocol specifies fixed candidate formulas before scoring.
3. `annual-objective-20260917`: World Bank annual GDP, unemployment, and life expectancy, using rolling one- and five-year origins and predetermined simple benchmarks. Series coverage is explicit rather than fabricated back to 1960.
4. Root integration: independent checks of masks, time cutoffs, metrics and source definitions; reproducible country plots and a GitHub-readable visual report.

## Interpretation rules

- A retrospective reconstruction using actual target-year drivers is **conditional replay**, not a forecast made before that year.
- A rolling forecast for year t uses only observations through its origin, with feature dates checked. Current-vintage revisions mean it is not an archived real-time forecast.
- In-sample fit, retrospective conditional replay, rolling forecast and frozen long-horizon forecast must never share an unlabeled score.
- Publish every registered candidate, including losses. Do not retune on evaluation results or select the best-looking country plots after scoring.
- Always show persistence. Close level curves may simply copy last year's observation. Show year-to-year changes too, with direction accuracy and denominators, and compare errors on identical masks.
- Do not average unlike target units. GDP comparison uses country-origin normalization; ladder points, unemployment percentage points and lifespan years stay separate.
- Do not present unexplained survey noise or modelled/interpolated health series as precisely measured annual physical outcomes.
- Do not claim causal policy validity from accurate historical tracking.

## Display commitments

Predetermined country examples: United States, India, Germany, United Kingdom, Brazil, Japan, South Africa and China, retaining missing-data gaps. The report will expose all eligible countries and show the whole-cohort result. Any selected best/median/worst diagnostic examples are additional, explicitly labelled, and cannot replace the predetermined examples.

The primary delivery is a Markdown report with embedded images that render directly on GitHub, requiring no download or local server. Include green/red error-reduction charts, annual observed-versus-model lines, change panels, and precise source/period/mode labels. The existing interactive report can remain as background; an additional interactive viewer is optional if it improves access without delaying the primary graphs.

## Verification before publishing

Check frozen-file hashes remain unchanged; verify each study's committed protocol, finite predictions, cutoff rules, scoring masks, undefined-metric handling and actual-source provenance. Independently recompute published metrics from saved rows without invoking either study's one-shot scorer. Spot-check several country/year calculations. Inspect rendered graph files for legibility, units, missingness and misleading curve connections. Run appropriate research tests and repository checks before pushing the review branch and opening a PR. Do not merge automatically.

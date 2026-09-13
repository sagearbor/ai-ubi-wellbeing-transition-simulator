# Policy-Effect Validation: What It Would Take to Make This Simulator Credible

Research memo for the AI-UBI Wellbeing Transition Simulator. Question: if we want to eventually claim
"policy X in state A vs. state B does Y to income/employment/wellbeing," what does the empirical
literature actually support, what public-data test cases exist to check a model against, and what
would a defensible validation harness look like. This is a research document, not a build plan —
no code changes were made.

---

## 0. The one distinction that matters most

**Causal inference from historical data** (DiD, synthetic control, RDD, event studies) answers: *given
what actually happened, what was the effect of a specific, already-implemented policy on a specific
outcome, in the population actually exposed to it?* It is backward-looking, and its credibility rests
on a *design* (a natural experiment) that approximates randomization. It cannot run before a policy
happens, and says nothing about counterfactuals never tried, or responses under conditions unlike the
historical sample (e.g. mass AI-driven displacement, which has no historical analogue).

**Forward simulation** (what this repo does) is a structural/reduced-form model — equations with
parameters — run forward to project what *would* happen under a hypothetical policy. It is only as
good as (a) whether its functional forms are right and (b) whether its parameters match reality. It
can simulate anything, including scenarios with zero precedent, but nothing forces it to be right.

The only way to connect the two: require the forward simulator, initialized on historical pre-treatment
conditions, to *reproduce* the causally-identified effect sizes from natural experiments. That
reproduction exercise is "backtesting"/"validation" — necessary but not sufficient. Passing it proves
the model isn't obviously wrong in situations resembling the past; it proves nothing about genuinely
novel AI-era scenarios (Section 6).

---

## 1. Causal inference methods: what each needs, pitfalls, implementations

### 1.1 Difference-in-differences (DiD)

**What it needs:** a treated group and a comparison group, observed both before and after treatment,
where — absent treatment — the two groups' outcomes would have trended in parallel ("parallel trends").
Classic 2x2 design; extends to many units/many time periods.

**Pitfalls:**
- *Parallel trends is untestable directly* — you can only eyeball pre-trends (necessary, not
  sufficient), and pre-testing on pre-trends itself biases inference (see arXiv:2510.26470, "Valid
  Inference when Testing Violations of Parallel Trends").
- *Staggered adoption with heterogeneous treatment effects breaks standard two-way-fixed-effects
  (TWFE)* — TWFE implicitly uses already-treated units as controls for later-treated units, which can
  sign-reverse estimates. The key fixes: Goodman-Bacon 2021 decomposition, Callaway & Sant'Anna 2021
  group-time ATT, Sun & Abraham 2021 interaction-weighted estimator, de Chaisemartin & D'Haultfœuille —
  see survey at arXiv:2112.04565.
- Anticipation effects and spillovers to "control" units both violate the design (SUTVA); see
  arXiv:2512.21176 on DiD under unknown interference.

**Implementations:** R is the reference ecosystem — `did` (Callaway & Sant'Anna), `fixest` (Sun-Abraham,
two-way FE with clustering), `bacondecomp`, `DIDmultiplegt`. Python: `linearmodels` (basic panel FE
DiD), `differences` (a Callaway-Sant'Anna port), `pyfixest` (fast fixed-effects, growing DiD support).
**JavaScript/TypeScript: no maintained implementation exists.** A JS/TS simulator that wants to run
these tests itself would need to either shell out to Python/R, reimplement a basic 2x2/event-study DiD
(tractable — it's just OLS with fixed effects and cluster-robust SEs) or use this as the argument for a
Python validation *sidecar* rather than porting the stats into the app.

### 1.2 Synthetic control method (SCM)

**What it needs:** one (or few) treated units, a "donor pool" of untreated units, and a long enough
pre-treatment period to fit weights that make the weighted combination of donors track the treated
unit's pre-treatment outcome and predictors closely. Popularized by Abadie & Gardeazabal (2003, Basque
terrorism) and Abadie, Diamond & Hainmueller (2010, California Prop 99 tobacco tax) and (2015, German
reunification).

**Pitfalls:** overfitting in the donor-weight optimization when the pre-treatment window is short
relative to the number of donors/predictors; no standard closed-form inference — significance is
usually assessed via in-space placebo tests (run the same procedure on untreated donors and see how
extreme the real treated-unit gap is) and in-time placebo tests; sensitive to donor pool composition
(a bad match set gives an unconvincing synthetic control); interpolation bias when the treated unit is
an outlier relative to the donor pool.

**Implementations:** R `Synth` (original), `gsynth`, `tidysynth`, `scpi` (Cattaneo et al., proper
uncertainty quantification — arXiv:2202.05984). Python: **`pysyncon`** — classic, robust
(Amjad/Shah/Shen), augmented (Ben-Michael/Feller/Rothstein), and penalized SCM in one package
([GitHub](https://github.com/sdfordham/pysyncon), [docs](https://sdfordham.github.io/pysyncon/synth.html));
**`SyntheticControlMethods`** ([PyPI](https://pypi.org/project/SyntheticControlMethods/)); **`SparseSC`**
for many-donor high-dimensional settings. No maintained JS package.

### 1.3 Regression discontinuity (RDD)

**What it needs:** treatment assignment determined by a running variable crossing a known cutoff (e.g.
income threshold for a benefit, birthdate cutoff, vote-share threshold). Compares outcomes for units
just above vs. just below the cutoff.

**Pitfalls:** manipulation of the running variable around the cutoff (test with McCrary/Cattaneo-Jansson-
Ma density tests); bandwidth choice trades off bias and variance — must use data-driven optimal
bandwidth selectors, not ad hoc ones; results are *local* to the cutoff (LATE at the threshold) and do
not necessarily generalize to units far from it — a serious limitation for state policy work where
almost no policies are assigned by a sharp, exogenous running-variable cutoff (fuzzy RDD, where the
cutoff only shifts the *probability* of treatment, is more common and needs an IV-style two-stage
setup).

**Implementations:** the reference toolkit is **`rdrobust`** (Calonico, Cattaneo, Farrell, Titiunik,
Masini) — available for Stata, R, **and Python** ([PyPI](https://pypi.org/project/rdrobust/), [package hub](https://rdpackages.github.io/rdrobust/)), plus companion packages `rddensity` (manipulation
testing) and `rdlocrand` (local randomization inference). No JS port.

### 1.4 Event studies

**What it needs:** a well-defined event date and a model of what the outcome "would have done" absent
the event (for financial event studies, a market/factor model estimated in a clean pre-event window;
for policy event studies, this collapses into a dynamic/staggered DiD specification with leads and
lags around treatment).

**Pitfalls:** event-date precision (anticipation/leakage before the "official" date contaminates the
pre-period); confounding events in the same window; policy-econometrics "event study" plots of dynamic
treatment effects inherit all the staggered-DiD problems above unless built with a heterogeneity-robust
estimator. Walkthroughs: ["The Effect," ch. 17](https://theeffectbook.net/ch-EventStudies.html),
[bookdown ch. 39](https://bookdown.org/mike/data_analysis/sec-event-studies.html).

**Implementations:** same toolchain as DiD (`did`, `fixest` in R; `linearmodels`/`pyfixest` in Python).

### 1.5 Causal-inference "meta" frameworks

**DoWhy** (Microsoft/PyWhy) provides a four-step workflow — model (DAG) → identify → estimate → refute —
with a refutation API (placebo treatment, random common cause, sensitivity analysis) that's the closest
thing to a general "sanity check my causal claim" tool ([arXiv:2011.04216](https://arxiv.org/pdf/2011.04216),
[pywhy.org](https://www.pywhy.org/)). It hands estimation off to **EconML** (heterogeneous/conditional
treatment effects via double-ML, causal forests) — relevant if the simulator wants "effect varies by
state characteristics" rather than one national ATE. **CausalML** (Uber) offers a similar CATE toolkit.
None replace DiD/SCM/RDD; they organize assumptions and test robustness once a design is picked.

---

## 2. Natural experiments with public data: a validation catalog

Each entry: intervention → measured effect (with citation) → where the underlying data live. These are
candidates for "validation cases" in Section 5.

### 2.1 State minimum wage changes (Card & Krueger and successors)

- **Card & Krueger (1994/2000)**: NJ raised its minimum wage $4.25→$5.05 on 4/1/1992; PA did not. 410
  fast-food restaurants surveyed before/after. NJ employment rose ~13% *relative to* PA — no employment
  loss, contra the standard competitive-labor-market prediction. [NBER w4509](https://www.nber.org/papers/w4509);
  Neumark-Wascher reanalysis and reply: [AER 2000](https://www.aeaweb.org/articles?id=10.1257%2Faer.90.5.1397).
  Replication data/code: davidcard.berkeley.edu.
- **Modern synthesis**: Cengiz, Dube, Lindner & Zipperer (2019, QJE) use a bunching event-study design
  across 138 U.S. state minimum-wage changes 1979–2016: near-zero net employment effects up to ~median
  wage, losses concentrated only well above it. The most-cited modern robustness check, and a strong
  target because it spans dozens of state-level natural experiments with a uniform design.
- **Data**: BLS QCEW (state/county employment and wages, quarterly, free); minimum-wage histories via
  DOL and the Cengiz et al. replication package (openICPSR).

### 2.2 EITC expansions

- **1986/1990/1993 federal EITC expansions**, via DiD comparing single mothers to single childless
  women. Eissa & Liebman (1996): 1986 expansion raised single-mother employment **2.8 pp** relative to
  childless women ([NBER w5158](https://www.nber.org/papers/w5158)). Meyer & Rosenbaum (2001): cumulative
  1984–96 expansions raised unmarried-mother employment **7.2 pp**. Hoynes & Patel (2018): the 1993
  expansion alone raised employment **6.1 pp** among lower-educated unmarried mothers
  ([NBER w28041](https://www.nber.org/system/files/working_papers/w28041/revisions/w28041.rev0.pdf)).
  Curated summary: [Policy Impacts Library](https://policyimpacts.org/policy-impacts-library/1986-expansion-of-the-earned-income-tax-credit-eitc/).
- **Data**: CPS ASEC (income/labor force by state, via IPUMS-CPS); IRS SOI state-level EITC claims.

### 2.3 Medicaid expansion (Oregon 2008 lottery; ACA 2014 state expansions)

- **Oregon Health Insurance Experiment**: a 2008 Medicaid lottery among low-income adults — the
  cleanest RCT-grade natural experiment in U.S. health policy. Winning raised coverage ~25pp. Year-1:
  more utilization, reduced financial strain and depression; **no significant effect on physical health
  or labor-market outcomes**. [NBER w17190](https://www.nber.org/papers/w17190) (Finkelstein et al.).
  Public replication data via NBER/ICPSR.
- **ACA state Medicaid expansion (2014–)**: 39 states + DC expanded, several did not — used in dozens
  of DiD studies of coverage, financial security, and (mixed evidence) health/labor supply. Good for a
  *state-vs-state* case since the treatment/control split is at state level, matching this simulator's
  target granularity.
- **Data**: CDC BRFSS (state-level health and coverage, annual), Census SAHIE (Small Area Health
  Insurance Estimates), KFF state Medicaid expansion tracker.

### 2.4 Kansas 2012 tax cuts ("Brownback experiment")

- Kansas cut the top individual rate 6.45%→4.9% and zeroed pass-through business income tax in 2012,
  explicitly framed as a real-world test of supply-side theory. Result: Kansas underperformed neighbors
  and the U.S. on job growth (+28,000 jobs Jan 2014–Apr 2017 vs. +35,000 in smaller-labor-force
  Nebraska), and lost enough revenue that the legislature reversed most cuts in 2017. See [Tax Policy
  Center](https://taxpolicycenter.org/taxvox/brownback-tax-cut-experiment-ends-kansas),
  [Brookings](https://www.brookings.edu/articles/the-kansas-tax-cut-experiment), [Wikipedia](https://en.wikipedia.org/wiki/Kansas_experiment).
  Contested counter-read: [Tax Foundation](https://taxfoundation.org/blog/kansas-experiment-kansas-tax-cuts-critique/)
  — useful *because* it's contested, a good stress test for whether a simulator bakes in one side's view.
- **Data**: BLS state employment/QCEW, Census Annual Survey of State Government Tax Collections, Kansas
  Dept. of Revenue.

### 2.5 California Proposition 13 (1978)

- Capped property tax at 1% of assessed value, annual reassessment growth at 2% unless sold. Cut
  property tax revenue **~53%** immediately; produced a documented "lock-in effect" (owners stay put to
  avoid reassessment) — NBER Digest summary of Wasi & White: [nber.org/digest/apr05](https://www.nber.org/digest/apr05/lock-effect-californias-proposition-13);
  40-years-later retrospective: [PPIC](https://www.ppic.org/publication/proposition-13-40-years-later/).
  Single-state, long-horizon case with no clean comparison state — best matched via synthetic control
  against a donor pool of other high-growth states.
- **Data**: California State Board of Equalization tax collections; Zillow/FHFA county housing turnover.

### 2.6 Alaska Permanent Fund Dividend (1982–present)

- The longest-running unconditional, universal, permanent cash-transfer program with public payout data
  back to 1982 (varies ~$1,000–$3,000+/year per resident). Jones & Marinescu (2022, AEJ:EP; NBER w24312)
  use synthetic control on the CPS: **no effect on overall employment**, but part-time work rose
  **1.8 pp (17% relative)** — interpreted as general-equilibrium demand effects offsetting the standard
  labor-supply-reduction prediction from individual cash-transfer studies. [NBER paper](https://www.nber.org/system/files/working_papers/w24312/w24312.pdf),
  [AEA published version](https://www.aeaweb.org/articles?id=10.1257%2Fpol.20190299). This is arguably
  **the single best validation case for a UBI-focused simulator**: it is UBI, it is real, it has 40+
  years of data, and it already comes with a synthetic-control estimate to match against.
- **Data**: Alaska Dept. of Revenue PFD Division (historical payout amounts, public); CPS (BLS/Census)
  for employment.

### 2.7 UBI / cash-transfer pilots

- **Stockton SEED (2019–2021)**: RCT, $500/month unconditional to 125 residents for 24 months. Full-time
  employment rose to more than double the control group's rate; reduced anxiety/depression and income
  volatility; <1% of spending on alcohol/tobacco. [SEED report](https://www.stocktondemonstration.org/press-landing/guaranteed-income-increases-employment-improves-financial-and-physical-health).
  Small N (125 treated) — useful for wellbeing-channel calibration, not macro/GE effects.
- **Finland Basic Income Experiment (2017–2018)**: RCT, 2,000 unemployed given €560/month vs. control.
  Employment effect small/mixed (~6 more employed days/year, confounded by a concurrent 2018 activation-
  model reform); *large* wellbeing gains — higher life satisfaction, lower psychological strain, 55% vs.
  46% self-rated good/very good health. [Government results](https://valtioneuvosto.fi/en/article/-/asset_publisher/1271139/perustulokokeilun-alustavat-tulokset-hyvinvointi-koettiin-paremmaksi-ensimmaisena-vuonna-ei-tyollisyysvaikutuksia),
  [full report](https://julkaisut.valtioneuvosto.fi/bitstreams/f2041c17-878d-490c-8c5f-f12ab5cbd70b/download).
  Best available case for calibrating "UBI decouples wellbeing from employment status," central to this
  simulator's thesis.
- **GiveDirectly Kenya (2016– , world's largest/longest UBI RCT)**: ~23,000 people, 195 villages, three
  arms (lump sum / 2-yr UBI / 12-yr long-horizon UBI) vs. control. No increase in "idleness" — recipients
  worked comparably or more, became more entrepreneurial; lump-sum income rose ~50% vs. control.
  [2023 results](https://www.givedirectly.org/2023-ubi-results), [NPR coverage](https://www.npr.org/sections/goatsandsoda/2023/12/07/1217478771/its-one-of-the-biggest-experiments-in-fighting-global-poverty-now-the-results-ar).
  Different regime (rural low-income Kenya) — an out-of-distribution stress test, not a U.S.-state analogue.
- **Baby's First Years (U.S., RCT since 2018)**: 1,000 low-income mothers, $333/mo vs. $20/mo
  unconditional cash. 1-year result: causal change in infant brain activity (EEG, high-frequency power)
  — [PNAS 2022](https://www.pnas.org/doi/10.1073/pnas.2115649119). **4-year follow-up found NO
  significant effect** on its four pre-registered primary outcomes — [NBER w33844](https://www.nber.org/papers/w33844),
  [4-yr article](https://pmc.ncbi.nlm.nih.gov/articles/PMC12861262/). This null result is itself
  valuable: a pre-registered RCT failing to replicate its own earlier finding is a good discipline check
  against cherry-picking only "cash transfers work" evidence.

### 2.8 2021 expanded Child Tax Credit (monthly, fully refundable)

- Part of the American Rescue Plan, paid monthly July–Dec 2021. Census SPM child poverty fell to **5.2%**
  in 2021 from 9.7% in 2020 — the largest single-year drop on record — with the CTC expansion credited
  with lifting **2.1 million children** out of poverty (5.3M people total). [Senate JEC/Census sourcing](https://www.jec.senate.gov/public/index.cfm/democrats/2022/11/the-expanded-child-tax-credit-dramatically-reduced-child-poverty-in-2021),
  [Columbia CPSP brief](https://povertycenter.columbia.edu/sites/default/files/content/Publications/Child-Tax-Credit-Expansion-on-Employment-CPSP-2021.pdf).
  **Contested employment effect**: Corinth, Meyer, Stadnicki & Wu (NBER w29823) project large negative
  labor-supply effects from a *permanent* expansion; Bastian and others, using the actual 2021 policy's
  realized data, find effects small at most — [Wiley PAM 2023](https://onlinelibrary.wiley.com/doi/full/10.1002/pam.22528).
  This live dispute between credentialed teams is itself a good harness case for testing whether CI-based
  scoring (Section 5), not a single point estimate, is what gets reported.
- **Data**: Census SPM public-use files (IPUMS-CPS ASEC), IRS advance-CTC payment statistics by
  state/county (public, 2021–22).

---

## 3. Public data APIs for state-level series

| Source | Coverage | Access | Rate limits / licence |
|---|---|---|---|
| **FRED** (St. Louis Fed) | 800,000+ series aggregating BLS/BEA/Census/OECD/World Bank/Treasury etc., incl. state-level series | Free API key, REST/JSON | 120 requests/60s documented limit, no monthly cap; redistribution allowed but check each series' own source-note licence before republishing values — [terms](https://fred.stlouisfed.org/docs/api/terms_of_use.html) |
| **BLS API v2** | CPS, QCEW, CES employment/wages/unemployment by state/county | Free registration | v1 (no key): 25 queries/day, 25 series/query; **v2 (registered): 500 queries/day, 50 series/query**, adds % change and more years — [guide](https://bd-econ.com/blsapi.html) |
| **Census API (ACS, SAHIE, SPM, etc.)** | Income, poverty, health insurance, demographics by state/county/tract | Free key | ~500 queries/IP/day without key (soft, enforceable), key recommended for anything above trivial use; misuse can get you blocked — [ToS](https://www.census.gov/data/developers/about/terms-of-service.html) |
| **BEA (Regional accounts)** | State/county GDP, personal income, regional price parities | Free key (email only, never expires) | Per-key rate limits enforced but not published as a fixed number; practical use is generous |
| **CDC BRFSS** | State-level health, "Healthy Days" HRQOL module, and (2017 wave only) an Emotional Support & Life Satisfaction module | Public microdata + summary tables | No API key; life-satisfaction module is not asked every year, so time-series use for wellbeing is thin — [CDC Life Satisfaction & Healthy Days](https://cdc.gov/mental-health/about-data/life-satisfaction.html) |
| **Gallup U.S. state well-being** | State-level life evaluation ("thriving/struggling/suffering," Cantril ladder) historically published via the Gallup-Healthways Well-Being Index (since 2008; methodology changed 2018 to mail/web) | Proprietary — published rankings free to read, underlying microdata is licensed/paid | No public API; usable only as periodic published snapshots, not a programmatic feed — [Gallup wellbeing topic](https://news.gallup.com/topic/well-being-index.aspx) |

Practical implication for this repo: FRED + BLS + Census/BEA cover income, employment, and GDP cleanly
and are free, keyed, and scriptable — a solid backbone for the income/employment legs of validation.
The wellbeing leg is the weak link: BRFSS Healthy Days is annual and state-representative but its
life-satisfaction question is not consistently asked, and Gallup's genuinely comparable state
life-satisfaction series is paywalled. A validation harness should treat "wellbeing" cases as
lower-confidence / wider-CI than income and employment cases for exactly this reason.

---

## 4. What "validated" means for existing policy simulators

- **Penn Wharton Budget Model (PWBM)**: publishes a [validation page](https://budgetmodel.wharton.upenn.edu/microsim/validation)
  comparing its microsim's demographic/economic distributions (100 runs) against CPS benchmarks, plus
  outside-academic review of assumptions. This is **distributional/calibration validation** (does the
  synthetic population look real), not **causal-effect backtesting** (did a past policy move outcomes
  as the model says) — an important distinction. Critics ([The American Prospect](https://prospect.org/economy/2023-04-10-penn-wharton-beltways-favorite-bogus-budget-model/))
  argue PWBM's elasticities are contestable even though the microsim mechanics are sound.
- **CBO**: publishes an annual [Economic Forecasting Record](https://www.cbo.gov/system/files/2025-07/61334-forecasts.pdf)
  scoring past forecasts against realized outcomes via mean absolute error and RMSE, decomposed into
  "centeredness" (bias) and "spread" (variance) — the closest thing here to genuine **prospective
  backtesting with a public scorecard**, though it scores macro forecasts, not individual-bill causal
  effects; those are acknowledged as "often quite difficult and sometimes impossible" to validate ex
  post since the no-bill counterfactual is never observed.
- **PolicyEngine** (open source, US/UK/CA/IL/NG tax-benefit microsim): validates by calibrating survey
  microdata to administrative/aggregate targets via ML reweighting, with a public calibration dashboard
  — see [policyengine-us](https://github.com/policyengine/policyengine-us) and the
  [JOSS paper](https://joss.theoj.org/papers/34b9f72df98e586d7e6a2448922407e7). Closest existing project
  in spirit to what this repo could become (open, inspectable, rules-engine style), though it computes
  *statutory* tax-benefit amounts deterministically rather than simulating *behavioral* response.
- **Tax Foundation (Taxes & Growth model)**: growth-optimistic elasticity assumptions produce
  systematically larger growth/revenue effects than CBO/JCT — a cautionary example of "validation"
  meaning internal consistency with chosen elasticities, not a public backtest. See
  [Equitable Growth's critique](https://equitablegrowth.org/the-tax-foundations-score-of-the-tax-cuts-and-jobs-act/)
  vs. [Tax Foundation's defense](https://taxfoundation.org/blog/dynamic-scoring-stands-criticism/).

**Takeaway**: none of these four organizations publish a clean "predicted effect vs. measured causal
effect, scored against a pre-registered baseline" record for policy *effects* (as opposed to macro
*forecasts*, which CBO does score). That gap is exactly what Section 5 proposes filling — it would be a
distinguishing, credibility-building feature rather than something to copy from elsewhere.

---

## 5. A proposed validation harness

### 5.1 A library of validation cases

Each case is a structured record, not free text, so it can be run programmatically:

```yaml
id: alaska-pfd-1982
intervention:
  type: universal_cash_transfer
  amount_per_capita_per_year: "varies 1982-present, ~$1,000-$3,100"
  region: Alaska
  start_date: 1982-01-01
comparison:
  design: synthetic_control
  donor_pool: [other US states, CPS-derived]
  source_study: "Jones & Marinescu 2022, AEJ:Economic Policy"
outcomes:
  - {name: employment_rate, measured_effect: "~0 pp (not significant)", ci_95: [-0.5, 0.5]}
  - {name: part_time_share, measured_effect: "+1.8 pp (+17% relative)", ci_95: [0.9, 2.7]}  # illustrative
data_sources:
  - {name: CPS, api: BLS/Census, series: [...]}
  - {name: Alaska PFD Division, url: "https://pfd.alaska.gov/Division-Info/Summary-of-Applications-and-Payments"}
replication_package: null
confidence: high   # RCT/synthetic-control, long panel, published CI
```

Populate the library with the six cases in Section 2 to start (see the ranked list at the end), then
expand. Every case needs: (1) a specific outcome series, not a vague "the economy," (2) a comparison
design (what's the counterfactual), (3) a **published effect size with its own uncertainty interval** —
not just a point estimate, because grading a point-prediction against a point-estimate treats the
original study's sampling error as if it doesn't exist.

### 5.2 A scoring rule

Two outcome types need two different scores:

- **Point/interval outcomes** (income change in dollars, employment-rate change in pp): score by
  whether the simulator's predicted effect falls inside the *union* of its own stated uncertainty and
  the published study's 95% CI, and report a normalized error `(predicted - measured) / measured_se`
  so partial credit is possible rather than pure pass/fail. Track this across all cases as an aggregate
  RMSE/MAE, the same two summary statistics CBO already uses for its own forecast scorecard — that
  makes the simulator's track record legible to people already familiar with how CBO reports itself.
- **Probabilistic/directional claims** ("wellbeing will rise," "employment effect will be positive"):
  score with a **Brier score** against the realized binary/discretized outcome, exactly as Metaculus does
  for its community forecasts (documented track record ~0.111 Brier across thousands of resolved
  questions — see [Metaculus FAQ](https://www.metaculus.com/faq/)). This is the right tool when the
  simulator is only confident enough to state a direction/probability rather than a magnitude — which,
  for genuinely novel scenarios, will often be the honest thing to do (see Section 6).

Both scores should be published per-case (not just aggregated) — an aggregate score lets a few easy
cases hide failure on the hard ones, exactly the failure mode a "not a toy" tool needs to avoid.

### 5.3 Keeping it honest: pre-registration and no peeking

The single biggest threat to a validation harness's credibility is silent parameter-tuning to the test
set — i.e., hand-fitting `displacementRate` or `gdpScaling` until the Alaska and Card-Krueger cases score
well, which would prove nothing about the model's genuine predictive power. Concretely:

1. **Version-pin every claim.** Every scored run records the exact git commit / model-config hash,
   timestamped before the case's outcome was inspected. A version's score is immutable once recorded;
   re-tuning requires a new version and a new score, never an edit to the old one.
2. **Hold out a subset.** Split the library into a "development" set builders can tune against and a
   "held-out" set whose outcomes stay unsurfaced until a model version is frozen and logged — the same
   discipline ML benchmarks and forecasting tournaments use against leaderboard overfitting.
3. **Pre-register the mapping, not just the parameters.** Before running a held-out case, write down
   which simulator inputs correspond to the real-world intervention (e.g. "Alaska PFD → set
   `distributionStrategy: hq-local`, `contributionRate` calibrated to $X/person/year") — choosing this
   mapping after seeing the outcome lets modelers quietly pick what fits.
4. **Publish failures.** A model that reports only the cases it passes is actively misleading — the CBO
   and Metaculus precedents work because they report everything, resolved or not, pass or fail.
5. **Re-run periodically as new data lands** — the Baby's First Years 4-year follow-up reversing its
   own 1-year finding is a reminder that "validated against early results" can later look wrong; show
   score history over time, not just the current value.

---

## 6. Honest limits: what this cannot claim about AI-era scenarios

Every case in Section 2 is a historical natural experiment. None of them involves the thing this
simulator is actually built to reason about: **large-scale, rapid AI-driven labor displacement combined
with a corporation-funded, blockchain-distributed UBI at national/global scale.** No such event has
happened. That means:

- **No validation case can test the model's core mechanism** — corporate voluntary contribution
  dynamics, game-theoretic cooperation/defection among firms, direct-to-wallet distribution bypassing
  states. The closest analogues (Alaska PFD, GiveDirectly, Finland) test *UBI receipt effects on
  wellbeing/employment*, not the *corporate contribution/game-theory* arm — no historical case exists
  of firms voluntarily funding a UBI-like pool at scale. That mechanism is unvalidatable by definition;
  the tool should say so rather than implying it inherits the UBI-outcome literature's credibility.
- **Extrapolation risk compounds with horizon.** A model tuned to reproduce 1990s minimum-wage effects
  or a 1982–2020 Alaska panel, used prospectively, must extrapolate into a labor-market regime with
  different automation elasticities than any it was fit on. Passing backtests shows the model isn't
  *obviously* broken in-sample; it does not bound out-of-sample error, because that regime doesn't yet
  exist to measure.
- **Precedent: forecasting platforms don't pretend precision on unresolved questions.** Metaculus and
  Good Judgment track calibration only on *resolved* questions; overconfidence is measurable only in
  retrospect — Metaculus's resolved-AI-question track record is notably worse-calibrated than its
  all-domain average ([Rethink Priorities](https://rethinkpriorities.org/research-area/an-examination-of-metaculus-resolved-ai-predictions/),
  [LessWrong analysis](https://www.lesswrong.com/posts/oJ6wXoBqxJjHhPLLu/an-examination-of-metaculus-resolved-ai-predictions-and)).
  The honest analogue here is to **tag every output** as (a) interpolating within the validated
  historical range, (b) extrapolating beyond it along a validated mechanism, or (c) simulating a
  mechanism with no historical case at all — and distinguish those visually in the UI, the way
  Metaculus marks a question "open" rather than implying false resolved-accuracy.
- **Claim the tool can honestly make**: "under conditions resembling documented natural experiments,
  our income/employment/wellbeing mechanisms reproduce measured effects within published CIs in N of M
  cases." **Claim it cannot make**: "this is what a corporate-funded global UBI will do once AI
  displaces X% of jobs" — a projection under a never-validated mechanism, and should be labeled as such
  everywhere it appears.

---

## Ranked recommendations

1. **Stand up the validation-case library and scoring harness before adding new simulation mechanics** —
   right now the simulator's forward equations have no empirical anchor at all; even 6 cases with honest
   CIs is a bigger credibility jump than any new feature.
2. **Treat income and employment as scoreable now (FRED/BLS/Census-backed); treat wellbeing as
   low-confidence** until a real state-level life-satisfaction time series is secured — BRFSS's
   life-satisfaction module isn't asked consistently and Gallup's comparable series is paywalled, so
   don't let the UI imply wellbeing predictions carry the same evidentiary weight as employment ones.
3. **Build the statistical layer as a Python sidecar (pysyncon, rdrobust, linearmodels/pyfixest, DoWhy),
   not a JS port** — there is no maintained JS/TS implementation of DiD, SCM, or RDD, and reimplementing
   Callaway-Sant'Anna-quality staggered-DiD correctness in-house is a multi-month research project, not
   a library swap.
4. **Explicitly wall off the corporate-contribution / game-theory mechanism as "unvalidated by
   construction"** in documentation and UI — it is the model's central novel claim and also the one
   piece with zero natural-experiment precedent; conflating it with the UBI-outcome evidence above would
   be the single biggest credibility risk.
5. **Publish score history, not just current scores, and pre-register model-version freezes** before
   scoring against any held-out case — the CBO forecast-record and Metaculus track-record precedents both
   derive their credibility from publishing everything over time, not from a one-time "validated" badge.

## Six best first validation cases

1. **Alaska Permanent Fund Dividend (1982–present)** — the only long-running, real-world, universal
   cash-transfer program; directly on-thesis for a UBI simulator; synthetic-control estimate already
   published (Jones & Marinescu 2022) to match against.
2. **Cengiz, Dube, Lindner & Zipperer (2019) 138-state-episode minimum-wage bunching study** — dozens of
   state-level natural experiments in one uniform design, ideal for testing whether the simulator's
   labor-market response to a policy shock is state-comparable and dose-responsive.
3. **Finland Basic Income Experiment (2017–2018)** — RCT-grade, and the best available case for the
   simulator's specific claim that UBI raises wellbeing independent of employment effects.
4. **Oregon Health Insurance Experiment (2008 Medicaid lottery)** — true randomization, a clean
   "no effect on labor supply, real effect on financial strain/depression" result to test against a
   wellbeing model that shouldn't overstate income-transfer effects on employment.
5. **2021 expanded Child Tax Credit** — recent, state-and-national administrative data available (IRS
   advance-CTC by state, Census SPM), and its contested employment-effect literature is a useful
   discipline test for whether the harness reports genuine uncertainty rather than a false-precision
   point estimate.
6. **Kansas 2012 tax cuts** — a single-state "policy experiment" explicitly billed as such by its own
   architects, with a clear comparison-state design (Kansas vs. Nebraska/neighbors) and an unambiguous,
   well-documented negative result — good for testing whether the simulator can produce a *negative*
   or null finding rather than only ever recovering positive effects.

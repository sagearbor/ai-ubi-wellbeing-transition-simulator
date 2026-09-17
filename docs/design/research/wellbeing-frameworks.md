# Wellbeing Measurement Frameworks — Research Report

**Purpose:** identify established wellbeing frameworks the simulator could adopt or add, beyond the World Happiness Report (WHR) Cantril ladder we currently hindcast against, with an eye to (a) data we can actually download and bind to per country/year, and (b) equations/elasticities we can drop directly into `simulation/pure.ts` as parameters.

**Scope note:** the simulator needs a single 0–100 scoreable number per country *plus* decomposable drivers (income, employment, inequality, transfers). That constraint eliminates frameworks that are qualitative, non-country-comparable, or have no reusable regression structure, no matter how conceptually rich they are.

### Quick-reference comparison

| # | Framework | Countries | Years | Bulk download | Licence | Verdict |
|---|---|---|---|---|---|---|
| 1 | Bhutan GNH Index | 1 (Bhutan) | 2007/08, 2010, 2015, 2022 | PDF report only, no API | Government/OPHI publication, free to read; no stated open-data licence | Reference only — not adoptable as data |
| 2 | OECD Better Life Index / How's Life? | ~38 OECD + accession/partner | 2004/05–present, biennial report | OECD Data Explorer, SDMX REST API, CSV/JSON | OECD Terms and Conditions (free reuse, attribution) | Adopt for OECD-country cross-check |
| 3 | WHR / Cantril ladder (in use) | 140–160+ | 2005–present (full panel from 2019) | XLSX/CSV at worldhappiness.report/data-sharing; OWID mirror | WHR: free for research/attribution use; OWID mirror: CC BY | Keep as backbone |
| 4 | WELLBYs | N/A (a unit, not a survey) | N/A | N/A — applied to WHR/other life-satisfaction panels | Academic/HM Treasury public guidance, free to use | Adopt as second output unit |
| 5 | Social Progress Index | 170+ | 2011–present | Premium tier for bulk historical panel; free mirror via QoG Institute | Social Progress Imperative terms (site browsing free); QoG mirror academic use; EU-SPI variant CC BY 4.0 | Adopt as income-independent decomposition layer |
| 6 | HDI | ~193 | 1990–present | CSV/Excel bulk download, hdr.undp.org | UN open-data terms, free reuse with attribution | Cheap sanity-check column only |
| 6 | GPI | inconsistent (mostly US states + scattered academic global estimates) | inconsistent | No standardized global panel | Varies by source (mostly academic, no unified licence) | Not adoptable — no consistent panel |

---

## 1. Bhutan Gross National Happiness (GNH) Index

**What it measures:** a multidimensional sufficiency index across 9 domains — psychological wellbeing, health, education, time use, cultural diversity & resilience, good governance, community vitality, ecological diversity & resilience, and living standards — built from 33 indicators and 124 variables.

**Construction:** the Centre for Bhutan and GNH Studies, with the Oxford Poverty and Human Development Initiative (OPHI), applies the **Alkire-Foster (AF) counting/sufficiency method** (the same family of methods behind the global Multidimensional Poverty Index). Each of the 33 indicators has a "sufficiency" cutoff; a person is counted as GNH-**happy** if they are sufficient in ≥66% of the (weighted) indicators. The national index blends the proportion of people who are happy with the intensity of sufficiency among those who are not-yet-happy — structurally identical to the M0 adjusted headcount ratio used in MPI.

**Coverage:** Bhutan only, four waves (2007/08, 2010, 2015, 2022). 2022 survey: ~11,525 respondents across all 20 dzongkhags; national GNH value 0.781 (up from 0.756 in 2015, 0.743 in 2010).

**Data availability:** the 2022 survey report (PDF, ~300pp) is downloadable from the Centre for Bhutan & GNH Studies (bhutanstudies.org.bt) and mirrored by OPHI. There is **no cross-country panel** — this is a single-nation instrument with no equivalent data collected anywhere else, so it cannot be hindcast or projected for other countries.

**Licence:** published as a government/OPHI research report; freely readable and citable, but there is no stated open-data licence, no machine-readable microdata release, and no API. Reuse would mean manually transcribing tables out of a PDF.

**Assessment:** **Not adoptable as data**, but the *domain structure and sufficiency-counting method* are worth stealing conceptually — it is the clearest example of a policy government actually uses to score multidimensional wellbeing with named domains and explicit weights. Useful as a design reference for how to define domain weights in the simulator's own wellbeing index documentation; not usable as an input series since it exists for exactly one country.

Sources: [OPHI — Gross National Happiness](https://ophi.org.uk/gross-national-happiness) · [OPHI — GNH 2022 report](https://ophi.org.uk/publications/Bhutan-GNH-2022) · [2022 GNH Survey Report (PDF)](https://bhutanstudies.org.bt/wp-content/uploads/2025/01/2022-GNH-Survey-Report_compressed-1.pdf) · [OECD — Bhutan's GNH Index](https://www.oecd.org/en/publications/well-being-knowledge-exchange-platform-kep_93d45d63-en/bhutan-s-gross-national-happiness-gnh-index_ff75e0a9-en.html) · [BhutanWiki — GNH methodology](https://www.bhutanwiki.org/articles/gnh-survey-methodology-and-limitations)

---

## 2. OECD Better Life Index / How's Life?

**What it measures:** the OECD Well-being Framework covers **11 dimensions** of current material and quality-of-life conditions — housing, income, jobs, community, education, environment, civic engagement/governance, health, life satisfaction, safety, work-life balance — plus, in the *How's Life?* report series, additional indicators of inequality and of resources for *future* wellbeing (natural, economic, human, social capital). The interactive **Better Life Index** lets the public assign their own weights to the 11 dimensions; the underlying data does not impose a single official aggregate score (deliberately, to avoid a contested single number).

**Coverage:** the 38 OECD member countries plus accession/partner countries (Brazil, South Africa now included; Argentina, Bulgaria, Croatia, Indonesia, Peru, Romania being added). Time series generally from 2004/2005 onward, updated with each biennial *How's Life?* edition (latest: *How's Life? 2024*, 6th edition, 80+ indicators).

**Data availability:** all series are published on the **OECD Data Explorer** (`data-explorer.oecd.org`) under the "Society → Well-being and beyond GDP" topic, with a documented **SDMX-based REST API** (JSON/CSV/SDMX-ML output, query builder generates the API call directly from the UI). No registration required.

**Licence:** OECD data is free to reuse under the **OECD Terms and Conditions** for its statistical databases (attribution required; generally treated as CC BY 4.0-equivalent, though the exact clause should be re-checked per dataset since OECD licensing terms have varied slightly across products over time).

**Assessment:** **Worth adding** as a secondary validation/decomposition source for the ~38-50 countries it covers, specifically because (a) it has a genuine, versioned, queryable API rather than a static PDF, and (b) its dimensions map cleanly onto simulator concepts we already track (jobs/displacement, income, inequality-adjacent "resources for future wellbeing"). Its weakness for us is coverage — it excludes most of the Global South, where the AI/UBI transition story is arguably most consequential. Use as an **OECD-country cross-check**, not a global backbone.

Sources: [OECD Better Life Index](https://www.oecd.org/en/data/tools/oecd-better-life-index.html) · [OECD Well-being Data Monitor](https://www.oecd.org/en/data/tools/well-being-data-monitor.html) · [How's Life? 2024](https://www.oecd.org/en/publications/how-s-life-2024_90ba854a-en.html) · [OECD Data Explorer / API docs](https://www.oecd.org/en/data/insights/data-explainers/2024/09/api.html) · [OECD Better Life Index — Wikipedia](https://en.wikipedia.org/wiki/OECD_Better_Life_Index)

---

## 3. World Happiness Report / Gallup Cantril Ladder (what we already use)

**What it measures:** the Cantril **Self-Anchoring Striving Scale** — "imagine a ladder with steps numbered 0 to 10, where 10 is the best possible life for you and 0 the worst; on which step do you feel you personally stand?" It is a single-item *life evaluation* (a cognitive/global judgment), not a momentary-affect measure.

**Coverage:** Gallup World Poll has run since 2005/2006 in 140–160+ countries and territories, with roughly 1,000 respondents per country per year via telephone or face-to-face interviews (nationally representative sampling, weighted). The WHR reports 3-year rolling averages (e.g., 2022–2024) to stabilize small annual samples. Full explanatory-variable panel is complete from 2019 onward; pre-2019 years have ladder scores and ranks only for some variables.

**Known critiques (worth stating honestly in-repo):**
- **Small per-country samples** (~1,000/year) rolled into multi-year averages — noisy for smaller or fast-changing countries, and RDD telephone sampling under-covers populations with poor phone/telecom infrastructure.
- **Single-item measure** — a global life evaluation captures a hedonic/status-linked judgment and is argued to miss eudaimonic dimensions (purpose, meaning, virtue).
- **Cultural response bias** — self-reported life evaluation may be shaped by individualist vs. collectivist norms around self-presentation, complicating cross-cultural comparability.
- **Correlational, not causal**, regression — the six-factor model (below) is explanatory/accounting, not identified causal effects; the WHR itself is explicit about this.

**The six-factor regression (directly reusable as a wellbeing equation):** the WHR fits, across the pooled country-year panel,
```
Ladder = β0 + β1·ln(GDP per capita) + β2·SocialSupport + β3·HealthyLifeExpectancy
              + β4·FreedomToMakeLifeChoices + β5·Generosity + β6·PerceptionsOfCorruption + ε
```
Reported coefficients (WHR Table 2.1, OLS with time and/or country effects; magnitudes are stable across recent report years, quoted from the widely-cited specification):

| Factor | Coefficient (β) | Sign/interpretation |
|---|---|---|
| Log GDP per capita | **0.349** | + (diminishing-returns income effect, already logged) |
| Social support (0–1, "someone to count on") | **2.563** | + (largest single driver — a 1-unit shift in the binary-support share moves the ladder ~2.6 points) |
| Healthy life expectancy at birth (years) | **0.028** | + (small per-year coefficient, but life-expectancy ranges span ~30 years across countries → large aggregate contribution) |
| Freedom to make life choices (0–1) | **1.378** | + |
| Generosity (residual of donation rates) | **0.487** | + |
| Perceptions of corruption (0–1) | **−0.733** | − |

These six factors typically explain ~70–75% of cross-country variance in the ladder score; the residual ("Dystopia + residual" in WHR terminology) is not attributed to unmeasured national factors, deliberately, to avoid implying causality. **This regression is the single most directly reusable equation in this whole survey** — it is already expressed in country-year panel form, coefficients are public, and 4 of its 6 inputs (GDP, life expectancy, freedom/governance proxies, corruption perception) already have public global panels (World Bank, UNDP, Transparency International) that could feed a simulator wellbeing sub-model even for non-WHR-surveyed countries.

**Data availability:** WHR publishes the full panel (ladder score + all six factors + standard errors) as an Excel/CSV download at `worldhappiness.report/data-sharing/`, refreshed annually with the March report; mirrors exist on Kaggle (`unsdsn/world-happiness`) and Our World in Data (`happiness-cantril-ladder`, CC BY). Gallup's own raw microdata requires a paid Gallup Analytics subscription; the WHR's aggregated country-year panel is free.

**Licence:** the WHR aggregated panel is published for free reuse with attribution to the report and Gallup as the underlying data source (research/non-commercial framing; check current-year report for exact wording). The Our World in Data mirror is unambiguously **CC BY**, which is the cleanest licence to cite if redistributing derived figures from this repo.

**Assessment:** **Keep as backbone** (already in use) — it's the only genuinely global, annually-updated, free panel with an attached explanatory regression. Its critiques should be documented in-repo as known limitations, not silently ignored, and its regression should be exposed as a swappable/citable formula rather than baked in as unexplained magic numbers.

Sources: [WHR FAQ](https://www.worldhappiness.report/faq/) · [WHR Data Sharing](https://www.worldhappiness.report/data-sharing/) · [World Happiness Report — Wikipedia](https://en.wikipedia.org/wiki/World_Happiness_Report) · [Our World in Data — Cantril ladder](https://ourworldindata.org/grapher/happiness-cantril-ladder) · [Kaggle mirror](https://www.kaggle.com/datasets/unsdsn/world-happiness) · [ORF — critiques of WHR](https://www.orfonline.org/expert-speak/the-unbearable-sadness-of-being-happy) · [Debate on Gallup World Poll strengths/limitations](https://www.afterbabel.com/p/a-debate-on-the-strengths-limitations)

---

## 4. WELLBYs (Wellbeing-Adjusted Life Years)

**What it is:** a unit defined by Layard, Frijters, De Neve and collaborators (Happier Lives Institute / LSE Centre for Economic Performance) — **1 WELLBY = a 1-point increase in life satisfaction (0–10 scale) for 1 person for 1 year**. It is explicitly designed as the wellbeing analogue of a QALY (Quality-Adjusted Life Year), so cost-effectiveness of any policy or transfer can be expressed as **cost per WELLBY**, directly comparable across health, welfare, and income interventions.

**Formula:** `WELLBYs generated = Δ(life satisfaction) × (years affected) × (people affected)`. Aggregating over a population/time period gives a stock of WELLBYs comparable to a national income aggregate.

**UK Treasury Green Book adoption:** HM Treasury's 2021 *Wellbeing guidance for appraisal: supplementary Green Book guidance* formally endorses WELLBYs for UK government cost-benefit analysis. It sets a **recommended monetary value of £13,000 per WELLBY (2019 prices)**, with a sensitivity range of **£10,000 (low, QALY-willingness-to-pay-derived) to £16,000 (high, equivalent-income-derived)**; inflation-updated estimates put the current value near **£15,000–£15,300**. This is the only G7 government that has an official shadow price for a life-satisfaction point, which makes it a credible external anchor for "what is a point of wellbeing worth" if the simulator ever wants to convert its 0–100 index into a monetized welfare aggregate.

**Elasticities / effect sizes (from the WELLBY literature, useful as simulator parameters):**
- **Income (arithmetic corrected 2026-09-17):** doubling income adds **ln(2) ≈ 0.693 natural-log units**, not one. With the cited WHR log-GDP coefficient of 0.349 (§3), the equation associates doubling GDP per person with **0.349 × ln(2) ≈ 0.242 ladder points**, holding its other predictors fixed. One natural-log unit means multiplying income by e ≈ 2.718. This is a conditional association from that regression, not an identified causal effect of a transfer or a forecast of national wellbeing.
- **Unemployment:** longitudinal/panel meta-analyses find unemployment has a robust *negative, only-partially-adapting* effect on life satisfaction, distinct from (and larger than) the pure income-loss effect — i.e., there's a non-pecuniary "scarring" cost of joblessness itself, and repeated unemployment spells compound (people who have ever been unemployed report persistently lower life satisfaction than the never-unemployed, and the repeatedly-unemployed report the lowest of all). This is the standard empirical justification in UBI/AI-displacement modeling for **not** treating a lost job as equivalent to its foregone income alone — the simulator's `displacementFriction` term should plausibly include both an income-loss component and a separate, only slowly-adapting non-pecuniary unemployment penalty.
- **Inequality:** the Gini coefficient is negatively associated with average life satisfaction in cross-country/OECD panels, with the effect concentrated among lower-income groups and moderated by perceived economic opportunity (inequality "bites" harder where social mobility is perceived as low) — relevant to how the simulator's `gdpScaling` parameter for UBI distribution interacts with wellbeing outcomes.

**Licence:** WELLBYs are a unit definition and a published UK government methodology, not a dataset — there is nothing to "download," only a formula and a price to apply to whatever life-satisfaction panel you already have (e.g., the WHR panel in §3). The HM Treasury guidance PDF and the academic papers defining the unit are freely citable public documents.

**Assessment:** **Adopt** — WELLBYs are the best available bridge between "a 0–100/0–10 wellbeing index" (what we already compute) and "a monetizable, policy-comparable unit" (what a UBI-cost-effectiveness argument needs). Recommend exposing a `wellbyValue` config parameter (default £13,000/2019, adjustable) so the simulator can report cumulative WELLBYs generated by a scenario and their £/$ monetary equivalent, alongside the existing 0–100 index.

Sources: [OECD — The WELLBY Well-being Valuation Method in the UK](https://www.oecd.org/en/publications/well-being-knowledge-exchange-platform-kep_93d45d63-en/the-wellby-well-being-valuation-method-in-the-united-kingdom_60c1396c-en.html) · [Nature — "The WELLBY: a new measure of social value and progress" (Frijters et al. 2024)](https://www.nature.com/articles/s41599-024-03229-5) · [HM Treasury — Wellbeing guidance for appraisal: supplementary Green Book guidance (PDF)](https://assets.publishing.service.gov.uk/media/60fa9169d3bf7f0448719daf/Wellbeing_guidance_for_appraisal_-_supplementary_Green_Book_guidance.pdf) · [Happier Lives Institute — The WELLBY](https://www.happierlivesinstitute.org/the-wellby/) · [State of Life — "What's a WELLBY and what is it worth?"](https://www.stateoflife.org/news-blog/2024/10/4/whats-a-wellby-and-what-is-it-worth) · [WHR 2021 — Living long and living well: the WELLBY approach](https://www.worldhappiness.report/ed/2021/living-long-and-living-well-the-wellby-approach/) · [Meta-analysis — unemployment and wellbeing, longitudinal evidence](https://www.researchgate.net/publication/362496277_The_relationship_between_unemployment_and_wellbeing_an_updated_meta-analysis_of_longitudinal_evidence) · [East Germany 20-year longitudinal unemployment study](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7652576/)

---

## 5. Social Progress Index (Social Progress Imperative; Porter & Stern)

**What it measures:** an explicitly **non-economic** composite — deliberately excludes GDP/income entirely, on the premise that social progress should be measured independent of, then correlated against, economic performance. Three dimensions:
1. **Basic Human Needs** (nutrition & basic medical care, water & sanitation, shelter, personal safety)
2. **Foundations of Wellbeing** (access to basic knowledge, access to information & communications, health & wellness, environmental quality)
3. **Opportunity** (personal rights, personal freedom & choice, inclusiveness, access to advanced education)

— 12 components total, built from **57 unique third-party indicators** (all outcome measures, not spending/input measures, by design).

**Coverage:** the 2025/2026 Global SPI covers **170+ countries** (>99% of world population), annually, with a back-series to **2011**. This is the broadest country coverage of any framework in this report except HDI.

**Data availability:** the public site (`socialprogress.org`) provides country profiles and an interactive explorer for free; a **downloadable full panel (2011–2025, all components/indicators)** exists but is gated behind the "Premium" tier reserved for sponsors/supporters — the free tier gives country-by-country browsing, not bulk download. A usable **free bulk alternative** exists via the University of Gothenburg's Quality of Government (QoG) Institute data finder, which republishes SPI as a downloadable dataset (`datafinder.qog.gu.se/dataset/spi`). An EU regional variant (EU-SPI 2.0, 2024) is published under **CC BY 4.0** with full open data for European NUTS regions.

**Licence:** browsing the public site is free with no explicit restrictive licence stated; the bulk historical CSV panel is a **paid Premium** product for sponsors/supporters, so a production pipeline should plan on the QoG Institute mirror (academic/research reuse terms) or the EU regional variant (explicit **CC BY 4.0**) rather than assuming free bulk access to the flagship global dataset.

**Assessment:** **Worth adding**, specifically because it is (a) genuinely global in coverage — better than OECD, comparable to HDI — and (b) structurally decomposable into a needs/foundations/opportunity hierarchy that maps well onto a "drivers" panel the simulator could expose per country (distinct from the single-number WHR ladder). The main friction is the Premium paywall for bulk historical download from the primary source; the QoG mirror resolves this for most purposes. Because it deliberately excludes income, it pairs well as a **complement to, not a replacement for**, the WHR/WELLBY income-sensitive terms — combining both gives an income-driven wellbeing term (WHR/WELLBY) and an income-independent social-conditions term (SPI).

Sources: [Social Progress Imperative — Methodology](https://www.socialprogress.org/methodology) · [Global Social Progress Index 2025/2026](https://www.socialprogress.org/social-progress-index-2025-2) · [Social Progress Index — Wikipedia](https://en.wikipedia.org/wiki/Social_Progress_Index) · [SPI Time Series](https://www.socialprogress.org/social-progress-index-time-series) · [QoG Institute — SPI dataset (free bulk download)](https://datafinder.qog.gu.se/dataset/spi) · [EU Regional SPI 2.0 2024 (CC BY 4.0)](https://ec.europa.eu/regional_policy/sources/work/spi_2024/EUSPI_2024_working%20paper.pdf)

---

## 6. Human Development Index, Genuine Progress Indicator, and other indices

**Human Development Index (HDI) — UNDP.**
Composite of three normalized sub-indices: a **Life Expectancy Index**, an **Education Index** (mean years of schooling + expected years of schooling), and an **Income Index** (log-transformed GNI per capita). Published annually since 1990 for ~193 countries back to 1990 (and a back-extended series to 1870 for many countries via the UNDP/academic reconstructions) — **the single broadest country-year coverage of any index here**. Freely downloadable as CSV/Excel from `hdr.undp.org` (UNDP Human Development Report Office), no API but a clean bulk-download data bank; explicit UN open-data terms. **Assessment:** worth adding as a cheap, near-universal-coverage cross-check variable (it already substantially overlaps with two of the WHR's six factors — GDP and life/health), but on its own it's a *development* index, not a *wellbeing* index — it says nothing about subjective experience, inequality within a country (see Inequality-adjusted HDI variant, which does correct for this), or freedom/social support. Low marginal value beyond what WHR + World Bank data already give the simulator, except as an easy sanity-check column.

**Genuine Progress Indicator (GPI).**
Starts from personal consumption expenditure and adjusts with ~24 factors — subtracting costs of crime, pollution, resource depletion, commuting, and adding unpaid household/volunteer labor and adjusting for income distribution. Best known from US state-level implementations (Maryland, Vermont, others) and academic global reconstructions; **no single authoritative, regularly-updated global panel exists** — estimates are scattered across academic papers with inconsistent methodology, and there is active academic debate calling for a standardized "GPI 2.0." **Assessment: not adoptable** in current form — no downloadable, consistently-methodologized global country-year panel exists to bind to. Interesting conceptually (it is the closest existing index to "GDP minus externalities," which resonates with this simulator's displacement-friction concept) but not implementable without doing the index construction ourselves, which is out of scope.

**Other indices worth one line each:**
- **Legatum Prosperity Index** — 12 pillars (similar structure to SPI), ~170 countries, free country profiles at `prosperity.com`, bulk data less openly downloadable than SPI; redundant with SPI for our purposes.
- **World Bank Human Capital Index** — narrowly focused on health+education productivity potential, not wellbeing per se; useful only as a labor-market/human-capital input feeding *into* a wellbeing equation, not as a wellbeing output itself.
- **Happy Planet Index (New Economics Foundation)** — combines wellbeing, life expectancy, inequality, and ecological footprint into one ratio; conceptually interesting for an AI-abundance-and-ecology narrative, but has had inconsistent update cadence and small analytical following — lower priority.
- **Gallup-Sharecare Wellbeing Index / OECD PISA-style subnational surveys** — rich for the US and a few countries only; not global.

---

## 7. Empirical elasticities usable as simulator parameters

| Parameter | Estimate | Source / context |
|---|---|---|
| **Income / life satisfaction association** (level–log coefficient) | **≈0.3–0.35** points (0–10 scale) per natural-log unit; **≈0.208–0.243 per doubling** | WHR log-GDP coefficient 0.349 (§3); WELLBY literature benchmark "0.3 useful benchmark for effect of log income on wellbeing" ([Cambridge — *Wellbeing*, ch. 13, Income](https://www.cambridge.org/core/books/wellbeing/income/CB44D2AB5EFCEFAAFA85148E204E7F10)). Doubling is ln(2), not one log unit; the association is not automatically a causal policy coefficient. |
| **Unemployment → life satisfaction** (own effect, longitudinal) | effect size ≈ **−0.22** (standardized, longitudinal meta-analysis); persistent/scarring — repeated unemployment compounds and does not fully adapt over decades | [Meta-analysis of longitudinal unemployment-wellbeing studies](https://www.researchgate.net/publication/362496277_The_relationship_between_unemployment_and_wellbeing_an_updated_meta-analysis_of_longitudinal_evidence); [20-year East Germany panel](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7652576/) |
| **Inequality (Gini) → life satisfaction** | negative and significant in OECD/cross-country panels; effect concentrated among lower-income deciles, moderated by perceived opportunity | [Economic Freedom, Income Inequality and Life Satisfaction in OECD Countries](https://link.springer.com/article/10.1007/s10902-017-9905-7); [Income Inequality Is Associated with Stronger Social Comparison Effects](https://pmc.ncbi.nlm.nih.gov/articles/PMC4718872/) |
| **Cash transfers (GiveDirectly, rural Kenya, unconditional, RCT)** | recipients **+0.17 SD** life satisfaction (≈+6.7% self-reported satisfaction); **+0.26 SD** on a broader psychological-wellbeing index; **2.0 WELLBYs generated per $1,000 donated** (HLI cost-effectiveness estimate) | [J-PAL evaluation](https://www.povertyactionlab.org/evaluation/improving-economic-and-psychological-well-being-through-unconditional-cash-transfer); [Haushofer & Shapiro, QJE 2016](https://academic.oup.com/qje/article-abstract/131/4/1973/2468874); [Happier Lives Institute — the WELLBY](https://www.happierlivesinstitute.org/the-wellby/) |
| **Cash transfers (GiveDirectly, Malawi, "Paying for Happiness")** | large, statistically significant subjective-wellbeing gains from a large-scale unconditional transfer program; magnitude broadly consistent with Kenya RCT | [Paying for Happiness: Malawi (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6088229/) |
| **Finland Basic Income Experiment (2017–18, RCT, 2,000 unemployed recipients)** | recipients reported significantly higher life satisfaction, less mental strain/depression/loneliness than control; small positive employment effect (+6 days employed over the period, on a base of 78 days) — i.e., wellbeing gains **did not come at a labor-supply cost**, a directly relevant finding for AI-displacement UBI framing | [Finland Toolbox — 2017–2018 results](https://toolbox.finland.fi/life-society/finlands-basic-income-experiment-2017-2018/); [Ministry of Social Affairs and Health — results release](https://stm.fi/en/-/perustulokokeilun-tulokset-tyollisyysvaikutukset-vahaisia-toimeentulo-ja-psyykkinen-terveys-koettiin-paremmaksi) |
| **Stockton SEED ($500/month, 24 months, US)** | reduced income volatility; improved mental health (less depression/anxiety, less fatigue); full-time employment rate **more than doubled** vs. control (i.e., again no negative labor-supply effect) | [Results for America case study](https://catalog.results4america.org/case-studies/guaranteed-income-stockton); [Penn Today — health results during pandemic](https://penntoday.upenn.edu/news/guaranteed-income-improved-peoples-health-during-pandemic) |

**Methodological caveat:** none of the elasticities above are estimated from a single unified randomized design — the income and inequality coefficients come from observational cross-country/panel regressions (correlational, subject to omitted-variable and reverse-causality concerns, e.g. happier people may earn more), while the cash-transfer figures come from genuine RCTs but in specific (mostly low/middle-income or small US-city) contexts that may not generalize to a national-scale AI-driven UBI rollout. Treat every number in this table as a **plausible planning parameter with a wide uncertainty band**, and expose it as an adjustable constant rather than a hardcoded literal, so scenario authors can stress-test sensitivity to the elasticity assumption itself.

**Cross-cutting note for the simulator:** all three UBI/cash-transfer natural experiments above (Kenya, Finland, Stockton) find **positive wellbeing effects with neutral-to-positive labor-supply effects** — directly contradicting the "UBI kills work incentive" prior baked into some displacement-friction models. This is strong external validation for keeping `displacementFriction` and `ubiBoost` as separable, not offsetting, terms in the wellbeing equation, and for not penalizing simulated UBI recipients with an implicit "laziness" tax.

---

## 8. Implementation notes (how to actually bind to this data)

A few concrete pointers for whoever picks this up, since "worth adopting" is only useful if paired with a real ingestion path:

- **WHR panel (§3):** the CSV/XLSX at `worldhappiness.report/data-sharing/` has one row per country-year with columns for `Life Ladder`, `Log GDP per capita`, `Social support`, `Healthy life expectancy at birth`, `Freedom to make life choices`, `Generosity`, `Perceptions of corruption`. This maps almost 1:1 onto a `WHRFactors` TypeScript interface — country code, year, the six factors, and the ladder score — and can be checked into `constants.ts` or loaded at build time as a static JSON fixture (it's a small file, low tens of KB per year).
- **OECD (§2):** the Data Explorer's "Developer API" button generates a ready-to-copy SDMX REST URL for any filtered view (e.g., a specific indicator × country × year selection); the response can be requested as CSV directly (`...&format=csvfile`) which avoids needing an SDMX parser. Because coverage is limited to OECD members, this is best wired in as an optional per-country override/enrichment layer, not a required data source, so the simulator degrades gracefully for the 150+ countries OECD doesn't cover.
- **WELLBY (§4):** no ingestion needed — this is a derived metric. Implementation is `wellbys = Δladder_or_life_satisfaction × years × population`, then `monetaryValue = wellbys × wellbyPrice` where `wellbyPrice` defaults to the Green Book's £13,000 (2019) figure, ideally inflation-adjusted and currency-configurable so it isn't silently GBP-only for a global simulator.
- **SPI (§5):** the QoG Institute dataset finder exposes the panel as a plain downloadable CSV (`datafinder.qog.gu.se/dataset/spi`) with documented variable codebooks — this is the most practical free route to a multi-year, multi-component SPI panel without the Premium paywall, and its component-level columns (basic needs / foundations / opportunity, and the 12 sub-components) can be surfaced as a "drivers" breakdown alongside the existing wellbeing index in the UI.
- **HDI (§6):** UNDP's Human Development Report Office publishes a "Data Center" bulk download (composite indices + the underlying life-expectancy/education/income sub-indices) as CSV; useful as a single low-effort sanity-check column since it needs no API integration, just a periodic manual refresh.

---

## Ranked recommendation

1. **Adopt WELLBYs as a second output unit.** Add a `wellbyValue` parameter (default £13,000 @ 2019 prices / ~£15,300 today, per HM Treasury Green Book) so the simulator can report cumulative WELLBYs and a monetized £/$ welfare equivalent alongside the existing 0–100 index — this is the highest-leverage addition because it turns "wellbeing went up" into a policy-comparable, defensible number, and both the unit definition and a government-validated price already exist off the shelf.
2. **Expose any WHR six-factor replication as a named, citable formula**, with coefficients and report vintage explicit. **Access correction, 2026-09-17:** annual public dashboard scores and three-year ranking averages are different targets; the full annual Gallup research panel requires permission, so the earlier claim of an unrestricted free annual panel was unsupported. See the [annual literature and data-access review](2026-09-17-annual-literature-review.md). A replication of the cited coefficients (0.349 / 2.563 / 0.028 / 1.378 / 0.487 / −0.733) measures explanatory fit, not independent forecasting or causal policy validity.
3. **Add Social Progress Index as a second, income-independent decomposition layer**, pulled via the QoG Institute's free bulk mirror — its 170+-country coverage rivals HDI, its Basic-Needs/Foundations/Opportunity structure gives users a driver breakdown the single-number Cantril ladder can't, and because it excludes income entirely it is genuinely complementary (not redundant) with WHR/WELLBY.
4. **Wire in the empirical elasticities from §7** (income ≈0.3/log-point, unemployment ≈−0.22 SD persistent, inequality negative-and-opportunity-moderated, cash-transfer +0.17–0.26 SD) as the actual coefficients behind `displacementFriction` and `ubiBoost`, replacing any hand-tuned constants — and treat the Finland/Stockton/Kenya finding of **no negative labor-supply effect from UBI** as a testable anchor/regression-test case for the game-theory module.
5. **Do not build GNH, GPI, or HDI ingestion pipelines.** GNH has no cross-country data at all (single nation, 4 waves); GPI has no standardized global panel to bind to; HDI is broad but adds little marginal signal beyond what WHR + World Bank GDP/life-expectancy series already give the simulator — at most, pull HDI as a single cheap sanity-check column, not a modeled input.

# Evidence review: cash transfers, unemployment, and subjective wellbeing

Purpose: the simulator maps a monthly cash transfer (UBI, USD/person/month) to a change in a
0-100 wellbeing index (10x the Cantril ladder, 0-10). The current coefficient
(`ubiBoost * 0.20`, see `simulation/pure.ts`) is unsourced and, per the model card's response
review, produces roughly **+58 index points (+5.8 Cantril points)** from a "global" distribution
switch that moves per-capita UBI in poor countries by only about **USD 16/month** — implausible
against the literature below. This note collects real, citable effect sizes for (1) cash
transfers -> wellbeing and (2) unemployment -> wellbeing, to ground a recalibration. Numbers not
independently confirmed from a primary source are marked **not verified**; do not treat those as
citable figures, only as directional evidence.

## Part 1 — Cash transfers and subjective wellbeing

| # | Study | Population / dates | Transfer | Outcome | Effect size | Link |
|---|---|---|---|---|---|---|
| 1 | Haushofer & Shapiro 2016, *QJE* | Rural western Kenya, GiveDirectly, ~2011-2013 | One-time, USD 404 PPP vs USD 1,525 PPP, lump-sum or 9 monthly installments | Psychological wellbeing index (life satisfaction, happiness, stress/cortisol, depression/CES-D) at ~9 months | Significant increase in the aggregate psychological wellbeing index; direction and significance confirmed by IPA/J-PAL summaries. Exact SD effect size **not verified** here (primary PDF was not machine-readable; secondary sources give qualitative "large increase" only) | [QJE abstract](https://academic.oup.com/qje/article-abstract/131/4/1973/2468874), [IPA summary](https://poverty-action.org/impact-unconditional-cash-transfers-general-welfare-kenya) |
| 1b | Haushofer & Shapiro 2018 (HS18), 3-year follow-up | Same sample, +3 years | Same transfers | Assets, consumption, psychological wellbeing, food security | Assets ~40% higher persisted at 3 years; GiveDirectly's own re-analysis flags that persistence of the *psychological wellbeing* result specifically is less robust and may be confounded by spillovers onto comparison households — treat wellbeing persistence as **not confirmed**, only assets persistence is | [GiveDirectly's take on HS18](https://www.givedirectly.org/our-take-on-hs18-revisited/) |
| 2 | Banerjee, Faye, Krueger, Niehaus, Suri 2023, NBER/*AEA* | Siaya & Bomet, Kenya; 14,474 households, 295 villages; transfers began 2018, long-term arm runs 12 years | ~USD 0.75/adult/day (~USD 22.50/month); arms: long-term UBI (12y, 44 villages), short-term UBI (2y, 80 villages), lump-sum (71 villages), control (100 villages) | Food security, physical and mental health, social wellbeing | "Modest but positive" impacts on food security and physical/mental health reported across arms; magnitude in SD or ladder points **not verified** here | [Main paper (PDF)](https://econweb.ucsd.edu/~pniehaus/papers/UBI_main_paper.pdf), [J-PAL evaluation](https://www.povertyactionlab.org/evaluation/effects-universal-basic-income-during-covid-19-pandemic-kenya) |
| 3 | Finland basic income experiment (Kela; Kangas et al.) | 2,000 unemployed adults, randomized from Kela's unemployment-benefit rolls, Jan 2017-Dec 2018 | EUR 560/month, tax-exempt, unconditional, no job-search requirement | Life satisfaction (0-10), mental strain, depression, loneliness | Life satisfaction **7.3 (basic-income group) vs 6.8 (control)** — a 0.5-point gap on the 0-10 scale — plus lower reported mental strain/depression/loneliness. Employment effect was small (+6 employed-days). Caveat: survey response-rate problems mean the evaluators themselves could not fully rule out non-response bias driving part of this gap | [Kela/VATT/STM press release](https://valtioneuvosto.fi/en/article/-/asset_publisher/1271139/perustulokokeilun-alustavat-tulokset-hyvinvointi-koettiin-paremmaksi-ensimmaisena-vuonna-ei-tyollisyysvaikutuksia), [Hiilamo 2022 critique](https://journals.sagepub.com/doi/10.1177/13882627221104501) |
| 4a | Stockton SEED | 125 treatment / 200 control, Stockton CA, Feb 2019-Jan 2021 | USD 500/month, unconditional, 24 months | Kessler-10 psychological distress, depression, anxiety, full-time employment | Lower anxiety/depression on K10 vs control over time (direction confirmed by multiple summaries); exact point/percentage change **not verified** (source PDF not machine-readable). Full-time employment reported ~12 pp higher than control | [SEED preliminary findings](https://www.stocktondemonstration.org/), [UPenn SP2 summary](https://sp2.upenn.edu/study-guaranteed-income-improved-peoples-health-during-pandemic/) |
| 4b | Baby's First Years | ~1,000 low-income US mothers of newborns, ongoing since 2018 | USD 333/month (high-cash) vs USD 20/month (control) | Maternal stress, mental health, happiness, material hardship | **Null result**: high-cash group showed no statistically significant improvement in maternal wellbeing/mental health/happiness vs the USD 20 control, despite higher family income, more child-directed spending and more enriching parent-child time | [Nature Communications 2025](https://www.nature.com/articles/s41467-025-62438-x), [ScienceDirect (maternal employment)](https://www.sciencedirect.com/science/article/abs/pii/S0047272724000951) |
| 5 | Alaska Permanent Fund Dividend | All Alaska residents, annually since 1982 (USD ~1,000-3,800/yr, i.e. an irregular annual, not monthly, transfer) | Variable annual dividend from oil-revenue fund | Poverty, labor supply, (subjective wellbeing not the focus of found studies) | No causal subjective-wellbeing/life-satisfaction study was located in this search — **evidence gap, not verified either way**. Labor-market study found no employment effect and a +1.8pp rise in part-time work; poverty-reduction studies exist but do not report SWB | [Jones & Marinescu 2022, AEJ:Policy](https://www.aeaweb.org/articles?id=10.1257%2Fpol.20190299), [Berman 2024, poverty](https://onlinelibrary.wiley.com/doi/full/10.1002/pop4.398) |
| 6 | Egger, Haushofer, Miguel, Niehaus, Walker 2022, *Econometrica* | Western Kenya; >10,500 households, 653 villages; ~2014-2017 | One-time ~USD 1,000/household (nominal; implied local fiscal shock >15% of local-area GDP) | Consumption/assets for recipients; spillovers to non-recipient households and firms; local price levels | Large positive spillovers on non-recipients (not just recipients), a local transfer multiplier of ~**2.5**, and **minimal price inflation** even at a shock this large relative to the local economy — relevant to whether the simulator's implicit assumption (UBI raises wellbeing with no offsetting local price/GE effects) is defensible at this scale | [Econometrica (open)](https://onlinelibrary.wiley.com/doi/full/10.3982/ECTA17945), [NBER WP](https://www.nber.org/papers/w26600) |
| 7 | McGuire, Kaiser & Bach-Mortensen 2022, *Nature Human Behaviour* | Meta-analysis: 45 studies, 116,999 participants, low- and middle-income countries, studies from ~2000-2020 | Varies by study (this is the pooled dose-response estimate) | Subjective wellbeing and mental health, average ~2-year follow-up | Pooled **Cohen's d = 0.13 (95% CI 0.09-0.18)** for subjective wellbeing, **d = 0.07 (95% CI 0.05-0.09)** for mental health. Paper states transfer value, "both relative to previous income and in absolute terms, is a strong predictor of effect size" — i.e. a genuine dose-response, larger transfers (relative to income) buy more wellbeing, with diminishing returns implied by the small pooled average across mostly-large-relative-to-income LMIC transfers | [Nature Human Behaviour](https://www.nature.com/articles/s41562-021-01252-z), [PubMed](https://pubmed.ncbi.nlm.nih.gov/35058643/), [HLI summary](https://www.happierlivesinstitute.org/report/cash-transfers-systematic-review-and-meta-analysis/) |

**Secondary-source dose-response detail (not verified against primary text):** the Happier Lives
Institute's public summary of study #7 reports approximate moderator coefficients of ~0.08 SD per
USD 100 PPP transfer (absolute), ~0.10 SD per doubling of prior income (relative), unconditional
transfers ~0.04 SD larger than conditional ones, and a fade-out of ~0.02 SD/year after the
transfer ends. These are cited here as directional only — I could not open the primary Nature PDF
(paywalled) or the SocArXiv preprint content to confirm the coefficients directly, so treat them
as **not verified** in the strict sense and do not hard-code them without independent
confirmation.

### Implications for the model (cash transfers)

- **(a) Level-effect rule of thumb.** The best-supported single number is McGuire et al.'s pooled
  d = 0.13 SD for subjective wellbeing, from a literature of *transfers that were mostly large
  relative to recipient income* (the QJE/Econometrica Kenya transfers were on the order of many
  months of consumption; Finland's EUR 560/month was roughly half of Finland's minimum
  unemployment benefit at the time). Converting via a life-satisfaction SD of roughly 1.8-2.2
  points on a 0-10 scale (typical of LMIC populations in World Happiness Report data) gives
  **~0.25-0.3 Cantril-ladder points** for a "typical" transfer in this literature — not per 10% of
  income, but per transfer of the size these studies actually used (often 10-100%+ of household
  income/consumption, sustained for months). A defensible functional form is **saturating in
  transfer/income** (diminishing ladder-points per additional dollar as the ratio rises), consistent
  with the "per doubling of income" scaling reported for study #7: e.g. `Δladder ≈ k · ln(1 +
  transfer/income)` with k chosen so that a transfer equal to prior income (a doubling) yields
  roughly the pooled 0.13 SD ≈ 0.25-0.3 ladder-point effect. That implies **k ≈ 0.35-0.45**
  ladder points per "doubling," i.e. a transfer worth 10% of household income (ln(1.1) ≈ 0.095)
  would move the ladder by roughly **0.03-0.04 points**, not the tens of points the current
  `* 0.20` coefficient can produce for a few-dollar UBI in a poor country.
- **(b) p5-p95 range.** Using the meta-analysis's own 95% CI (d = 0.09 to 0.18 SD) and the SD
  conversion above: roughly **0.16-0.4 Cantril-ladder points** for a transfer of the size typical
  in the reviewed studies (large relative to income). This is a range on the *pooled, dose-blind*
  average effect, not a range on the dose-response slope itself — the true k above is less certain
  than this range suggests, since it depends on secondary-source moderator coefficients that are
  not independently verified.
- **(c) Horizon and persistence.** Effects are visible within months (Haushofer & Shapiro measured
  at ~9 months; Finland's gap was measured within the 2-year experiment). The meta-analysis's
  average follow-up is ~2 years, so the pooled 0.13 SD is not a long-run steady-state number.
  Whether it persists beyond that is genuinely unsettled: GiveDirectly's own re-analysis of HS18
  found asset gains persisting at 3 years but flagged the wellbeing persistence as less certain;
  Baby's First Years (2 years, USD 333/month, richer-country context) found **no** significant
  wellbeing effect at all; the only trial designed to test true long-run persistence (Banerjee et
  al.'s 12-year GiveDirectly UBI arm) is still running. Treat "does a sustained transfer keep
  producing a wellbeing gain for 5-10 years" as **not established** either way.
- **(d) What the evidence does not cover.** (i) Rich-country UBI at national scale and permanent
  duration — every large, well-identified study here is a time-limited pilot (2-24 months, one
  county/region) except the still-running 12-year Kenya arm and the multi-decade Alaska PFD, for
  which no rigorous SWB study was found. (ii) General-equilibrium/price effects at the scale the
  simulator models (a *global*, simultaneous transfer to 100+ countries) — the closest analogue
  (Egger et al., study #6) is a regional-economy shock in Kenya, not a global one, though its
  finding of large spillovers and minimal inflation is at least evidence against a naive "UBI
  just gets priced away" objection at *that* scale. (iii) Permanent vs. temporary transfers are
  conflated in nearly all of this evidence; only Alaska's PFD is genuinely permanent, and it has
  no SWB study. A model card should honestly tag this relationship as **"calibrated to evidence
  from short-to-medium-run cash-transfer pilots in Kenya, the US, and Finland; not validated for
  a permanent, simultaneous, 100+-country transfer."**

## Part 2 — Unemployment and subjective wellbeing

| Study | Population / dates | Design | Finding | Link |
|---|---|---|---|---|
| Winkelmann & Winkelmann 1998, *Economica* | Working-age men, German Socio-Economic Panel (GSOEP), 1984-1989 waves | Individual fixed-effects panel | Unemployment has a large negative effect on life satisfaction that is much bigger than what the associated loss of income alone would predict — i.e. a large non-pecuniary/psychic cost. Exact point coefficient **not verified** here | [Economica abstract](https://onlinelibrary.wiley.com/doi/abs/10.1111/1468-0335.00111) |
| Clark & Oswald 1994, *Economic Journal* | British Household Panel Survey wave 1, cross-section, late 1980s/1991 | GHQ-12 psychological-distress score regressed on demographic/economic variables | Unemployment is associated with markedly higher GHQ distress than almost any other single life event/status tested in their equations (bigger than separation/divorce in their sample). Exact GHQ-point magnitude **not verified** here | [IDEAS/RePEc](https://ideas.repec.org/a/ecj/econjl/v104y1994i424p648-59.html) |
| Lucas, Clark, Georgellis & Diener 2004, *Psychological Science* | >24,000 individuals, German SOEP, up to 15 years (1984-1999-ish waves) | Panel study of life satisfaction (0-10) before/during/after unemployment spells | Satisfaction drops sharply around job loss, partially rebounds after reemployment, but **does not return to the pre-unemployment baseline on average** — a scarring/set-point-shift result. Prior unemployment does not blunt the reaction to a later spell (no habituation) | [SAGE journal page](https://journals.sagepub.com/doi/10.1111/j.0963-7214.2004.01501002.x) |
| Di Tella, MacCulloch & Oswald 2001, *AER*; 2003, *Review of Economics & Statistics* | ~250,000 Europeans/Americans, Eurobarometer + US surveys, 1970s-1990s | Country/region-year panel; regional or national unemployment rate as a macro regressor alongside personal employment status | Aggregate unemployment rate lowers happiness of people who are **still employed** — a "fear of job loss" spillover distinct from the direct effect on the unemployed themselves. The coefficient on the unemployment rate is roughly twice the coefficient on the inflation rate in their happiness equations | [AER 2001](https://www.aeaweb.org/articles?id=10.1257%2Faer.91.1.335), [ReStat 2003](https://direct.mit.edu/rest/article-abstract/85/4/809/57422) |
| Kassenboehmer & Haisken-DeNew 2009, *Economic Journal* ("You're Fired!") | German SOEP, 1984-2006 (entry-unemployment sample 1991-2006) | Fixed-effects + plant-closure instrument for causal identification | Large, statistically significant **causal** negative effect of entering unemployment on life satisfaction (bigger than naive correlational estimates), strongest when triggered by an (exogenous) plant closure rather than other reasons; pronounced for women in both East and West Germany. Exact point effect **not verified** here | [Economic Journal abstract](https://academic.oup.com/ej/article-abstract/119/536/448/5089549) |
| **Meta-analyses** | | | | |
| Paul & Moser 2009, *J. Vocational Behavior* | 237 cross-sectional + 87 longitudinal studies | Meta-analysis of mental-health outcomes (distress, depression, anxiety, psychosomatic symptoms, subjective wellbeing, self-esteem) | Overall effect size **d = 0.51** (unemployed report more distress than employed), pooled across outcome types | [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0001879109000037) |
| McKee-Ryan, Song, Wanberg & Kinicki 2005, *J. Applied Psychology* | 104 studies, 437 effect sizes | Meta-analysis of psychological and physical wellbeing during unemployment | Unemployed have lower psychological/physical wellbeing than employed; unemployment duration and sample type (school-leavers vs. mature workers) moderate the mental-health effect; the *current* unemployment rate and benefit generosity did **not** moderate it | [Semantic Scholar](https://www.semanticscholar.org/paper/Psychological-and-physical-well-being-during-a-McKee-Ryan-Song/7139911aa02a992f3c528e747e725eb8c4cf08ae) |

**Numeric anchor** (IZA World of Labor's summary of German SOEP 1984-2011, ages 20-60 — a
secondary summary of the primary panel, cited here as the clearest single quantified figure
found): the raw gap in mean life satisfaction (0-10 scale) between unemployed and employed
individuals is about **1.3 points**; a **1 percentage-point rise in the (regional) unemployment
rate** is associated with roughly a **0.04-point fall** in the mean life satisfaction of people
who remain employed (the Di Tella-style spillover); duration of unemployment shows little
habituation effect; satisfaction has not returned to its pre-unemployment level even 4 years
after the spell (scarring), consistent with Lucas et al. above. [IZA World of Labor](https://wol.iza.org/articles/unemployment-and-happiness/long)

### Implication (unemployment)

Combining the two pieces above (direct effect on the newly-unemployed share of the population,
plus the aggregate fear/spillover on everyone else) gives a rough estimate of the fall in a
country's **mean** ladder score per 1 percentage-point rise in the unemployment rate:

- Direct term: 1pp of the population newly unemployed × a *causal* (not raw-gap) individual
  effect of very roughly 0.4-1.3 ladder points (the causal Kassenboehmer & Haisken-DeNew estimate
  is not itself quantified here, so this uses the IZA 1.3-point raw gap as an upper bound and a
  fraction of it as a lower bound) ≈ **0.004-0.013 points**.
- Spillover term: the Di Tella-style aggregate effect (~0.04 points per 1pp, already
  population-wide) ≈ **0.04 points**.
- **Total ≈ 0.04-0.05 points fall in national mean life satisfaction per 1pp rise in
  unemployment**, with a **p5-p95 range of roughly 0.03-0.10 points/pp** given (i) this combines a
  German panel estimate with a Eurobarometer/US aggregate estimate rather than one unified causal
  study, (ii) no LMIC-specific estimate of the spillover term was found, and (iii) the direct-term
  causal magnitude is not independently quantified here. This is an order-of-magnitude planning
  number, not a citable point estimate.

## Sources

- [Haushofer & Shapiro 2016, QJE (abstract)](https://academic.oup.com/qje/article-abstract/131/4/1973/2468874)
- [Haushofer & Shapiro 2016, IPA summary](https://poverty-action.org/impact-unconditional-cash-transfers-general-welfare-kenya)
- [GiveDirectly's take on HS18 (3-year follow-up)](https://www.givedirectly.org/our-take-on-hs18-revisited/)
- [Banerjee, Faye, Krueger, Niehaus, Suri 2023 (PDF)](https://econweb.ucsd.edu/~pniehaus/papers/UBI_main_paper.pdf)
- [J-PAL evaluation summary, Kenya UBI](https://www.povertyactionlab.org/evaluation/effects-universal-basic-income-during-covid-19-pandemic-kenya)
- [Finland basic income experiment, official results (Kela/VATT/STM)](https://valtioneuvosto.fi/en/article/-/asset_publisher/1271139/perustulokokeilun-alustavat-tulokset-hyvinvointi-koettiin-paremmaksi-ensimmaisena-vuonna-ei-tyollisyysvaikutuksia)
- [Hiilamo 2022, critique of the Finland experiment](https://journals.sagepub.com/doi/10.1177/13882627221104501)
- [Stockton SEED demonstration site](https://www.stocktondemonstration.org/)
- [UPenn SP2 summary of SEED health findings](https://sp2.upenn.edu/study-guaranteed-income-improved-peoples-health-during-pandemic/)
- [Baby's First Years, Nature Communications 2025](https://www.nature.com/articles/s41467-025-62438-x)
- [Baby's First Years, maternal employment, ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0047272724000951)
- [Jones & Marinescu 2022, Alaska PFD labor-market effects, AEJ:Policy](https://www.aeaweb.org/articles?id=10.1257%2Fpol.20190299)
- [Berman 2024, Alaska PFD and poverty, Poverty & Public Policy](https://onlinelibrary.wiley.com/doi/full/10.1002/pop4.398)
- [Egger, Haushofer, Miguel, Niehaus, Walker 2022, Econometrica](https://onlinelibrary.wiley.com/doi/full/10.3982/ECTA17945)
- [Egger et al. 2022, NBER working paper](https://www.nber.org/papers/w26600)
- [McGuire, Kaiser & Bach-Mortensen 2022, Nature Human Behaviour](https://www.nature.com/articles/s41562-021-01252-z)
- [McGuire et al. 2022, PubMed record](https://pubmed.ncbi.nlm.nih.gov/35058643/)
- [Happier Lives Institute summary of McGuire et al. 2022](https://www.happierlivesinstitute.org/report/cash-transfers-systematic-review-and-meta-analysis/)
- [Winkelmann & Winkelmann 1998, Economica](https://onlinelibrary.wiley.com/doi/abs/10.1111/1468-0335.00111)
- [Clark & Oswald 1994, Economic Journal (RePEc record)](https://ideas.repec.org/a/ecj/econjl/v104y1994i424p648-59.html)
- [Lucas, Clark, Georgellis & Diener 2004, Psychological Science](https://journals.sagepub.com/doi/10.1111/j.0963-7214.2004.01501002.x)
- [Di Tella, MacCulloch & Oswald 2001, American Economic Review](https://www.aeaweb.org/articles?id=10.1257%2Faer.91.1.335)
- [Di Tella, MacCulloch & Oswald 2003, Review of Economics and Statistics](https://direct.mit.edu/rest/article-abstract/85/4/809/57422)
- [Kassenboehmer & Haisken-DeNew 2009, Economic Journal](https://academic.oup.com/ej/article-abstract/119/536/448/5089549)
- [Paul & Moser 2009, Journal of Vocational Behavior](https://www.sciencedirect.com/science/article/abs/pii/S0001879109000037)
- [McKee-Ryan, Song, Wanberg & Kinicki 2005, Journal of Applied Psychology](https://www.semanticscholar.org/paper/Psychological-and-physical-well-being-during-a-McKee-Ryan-Song/7139911aa02a992f3c528e747e725eb8c4cf08ae)
- [IZA World of Labor, "Unemployment and happiness"](https://wol.iza.org/articles/unemployment-and-happiness/long)

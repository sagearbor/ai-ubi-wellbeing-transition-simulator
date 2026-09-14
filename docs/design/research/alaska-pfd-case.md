# Case: Alaska Permanent Fund Dividend (PFD) and the labour market

Primary source: Damon Jones & Ioana Marinescu, "The Labor Market Impacts of Universal and Permanent Cash
Transfers: Evidence from the Alaska Permanent Fund".

## Editions actually read (all fetched and text-extracted on 2026-09-13)

| Tag used below | Edition | Where obtained |
|---|---|---|
| **AEJ** | *American Economic Journal: Economic Policy* 14(2), May 2022, pp. 315–340, doi:10.1257/pol.20190299 (final published typeset article) | https://home.uchicago.edu/~j1s/Jones_Alaska_2022.pdf (the AEA PDF link is paywalled; this is the journal's typeset PDF, with running heads "VOL. 14 NO. 2", pp. 315–340) |
| **AEJ-OA** | AEJ Online Appendix, dated "May 2021", printed pp. 42–78 | https://www.aeaweb.org/articles/materials/16517 |
| **WP** | NBER Working Paper 24312, "February 2018, Revised January 2020", 72 printed pages | https://www.nber.org/system/files/working_papers/w24312/w24312.pdf |
| **DOR** | Alaska Dept of Revenue, PFD Division, "Summary of Dividend Applications & Payments" | https://pfd.alaska.gov/Division-Info/summary-of-dividend-applications-payments (the URL in the task and in the paper now returns 404; this is the current URL) |
| **I4R** | Bacher, Herrera-Rodriguez, Marino Fages, Stips, "A replication of Jones & Marinescu (2022)", Oslo Replication Games, Oct 2022 (linked from the AEA article page as a "Public (Legacy) Comment", posted 2/26/2025) | https://felixstips.github.io/files/Oslo_Jones_Marinescu.pdf |

**The AEJ edition is the one to use.** Its empirical tables (Tables 1–4, 6) match the WP number for number.
Its **calibration (Table 5) is different**, though: it uses a higher MPC, a different kappa and a
per-household PDV, so the predicted micro/macro effects roughly triple. See section 4. Page numbers
below are the printed page numbers.

Units: the paper reports outcomes as **proportions** (e.g. 0.018). 1 pp = 0.01. Hours are in hours/week.
Anything marked "derived" is arithmetic I did on the paper's reported numbers. The authors did not report it.

---

## Summary table (headline specification: AEJ Table 2, synthetic control, average Alaska minus synthetic Alaska over 1982–2014)

| Outcome | Estimate | Relative effect | Inference (as reported: permutation p-value; 95% CI from inverted permutation test; pre-fit) | Sample / denominator | Period | Source location |
|---|---|---|---|---|---|---|
| **Employment rate** (employment / population) **[headline]** | **+0.001** (= +0.1 pp) | Not reported. Derived: +0.16% of the 1977–81 Alaska mean 0.639 (AEJ Table 1) | p = **0.942**; 95% CI **[−0.030, 0.033]**; 1,836 placebos; pre-RMSE 0.005; RMSE percentile 0.322 | Civilians age 16+ (all persons 16+ in the state), IPUMS monthly CPS basic survey, survey-weighted state-year means; self-employed working for pay count as employed | Pre 1977–1981; post 1982–2014 | AEJ Table 2 col 1, p. 327; text pp. 324, 326–327; WP Table 2 p. 36 |
| **Part-time rate** (part-time workers / population) **[headline]** | **+0.018** (= +1.8 pp) | **+17%** relative to the pre-period average part-time rate (reported). Check: 0.018/0.103 = 17.5% | p = **0.020**; 95% CI **[0.004, 0.032]**; 1,836 placebos; pre-RMSE 0.003; RMSE percentile 0.252 | Same monthly CPS sample, 16+. **Denominator is the population, not the employed** ("part-time employment as a share of the population") | Pre 1977–1981; post 1982–2014 | AEJ Table 2 col 2, p. 327; text pp. 316, 327–328; abstract p. 315 |
| Labour-force participation (secondary) | +0.012 (= +1.2 pp) | Not reported. Derived: +1.7% of Alaska pre mean 0.712 | p = 0.331; 95% CI [−0.019, 0.042]; 1,836 placebos; pre-RMSE 0.013; **RMSE percentile 0.903 (poor fit; authors down-weight)** | Monthly CPS, 16+, active labour force / population | 1977–1981 / 1982–2014 | AEJ Table 2 col 3, p. 327; text p. 327 |
| Hours worked last week (secondary) | −0.796 hours/week | Not reported. Derived: −2.1% of Alaska pre mean 37.980 | p = 0.084; 95% CI [−1.751, 0.191]; **1,734 placebos**; pre-RMSE 0.394; **RMSE percentile 0.753 (poor fit; authors down-weight)** | CPS-MORG (NBER), **employed respondents only**, "hours worked last week at all jobs" | Pre **1979**–1981; post 1982–2014 | AEJ Table 2 col 4, p. 327; text p. 329; data p. 323 |
| Part-time rate, married women | +0.035 (+3.5 pp) | Not reported | p = 0.001; CI [0.016, 0.054]; RMSE pct 0.680 | Monthly CPS, married women 16+ | 1982–2014 | AEJ Table 3 col 11, p. 330; text p. 329 |
| Part-time rate, all women | +0.022 | Not reported | p = 0.032; CI [0.003, 0.042]; RMSE pct 0.291 | Women 16+ | 1982–2014 | AEJ Table 3 col 10, p. 330 |
| Part-time rate, all men | +0.008 | Not reported | p = 0.192; CI [−0.004, 0.019]; RMSE pct 0.259 | Men 16+ | 1982–2014 | AEJ Table 3 col 4, p. 330 |
| Employment rate, all men | +0.029 | Not reported | p = 0.093; CI [−0.008, 0.065]; RMSE pct 0.972 (poor fit) | Men 16+ | 1982–2014 | AEJ Table 3 col 1, p. 330 |
| Employment rate, all women | −0.019 | Not reported | p = 0.234; CI [−0.055, 0.017]; RMSE pct 0.978 (poor fit) | Women 16+ | 1982–2014 | AEJ Table 3 col 7, p. 330 |
| Employment rate, **tradable** sectors | −0.048 | Not reported | p = 0.005; CI [−0.072, −0.025]; **RMSE pct 0.997 (very poor fit)** | Monthly CPS, employment in tradable industries / population (Mian–Sufi definitions) | 1982–2014 | AEJ Table 6 col 1, p. 336 (WP Table A.8, p. 50) |
| Part-time rate, tradable | +0.015 | Not reported | p = 0.119; CI [−0.007, 0.038]; RMSE pct 0.865 | as above | 1982–2014 | AEJ Table 6 col 2, p. 336 |
| Employment rate, **non-tradable** (incl. construction) | +0.002 | Not reported | p = 0.859; CI [−0.024, 0.027]; **RMSE pct 0.995 (very poor fit)** | as above | 1982–2014 | AEJ Table 6 col 3, p. 336 |
| Part-time rate, non-tradable | −0.007 | Not reported | p = 0.670; CI [−0.040, 0.025]; RMSE pct 0.595 | as above | 1982–2014 | AEJ Table 6 col 4, p. 336 |
| Employment rate, common weights (robustness) | +0.032 | Not reported | p = 0.040; CI [0.003, 0.065]; RMSE pct 0.312 | Joint emp + PT weights | 1982–2014 | AEJ Table 4 col 1, p. 331 |
| Part-time rate, common weights (robustness) | +0.011 | Not reported | p = 0.101; CI [−0.006, 0.028]; RMSE pct 0.312 | Joint weights | 1982–2014 | AEJ Table 4 col 2, p. 331 |

How to read "RMSE percentile": it ranks Alaska's pre-period fit among all placebo fits, and lower means a
better fit. The authors focus on outcomes where this rank is low. Employment and part-time are the two
outcomes "at or below the thirty-second percentile" (AEJ p. 322). "Better controls could be found for
Alaska than for at least 68 percent of other states" (AEJ p. 316).

---

## 1. Treatment definition

- **Treated unit:** the whole state of Alaska, one unit in a panel of the 50 states plus DC. Universality means there is "no natural within-state control group", "We therefore need to consider the entire state as the unit of observation" (AEJ p. 316).
- **What "treatment" is:** the start of annual PFD payments. "Since 1982, a portion of the returns to the fund have been distributed to residents of Alaska in the form of the Alaska Permanent Fund dividend" (AEJ p. 319). The treatment is **on/off (dividend regime introduced)**. It is **not** a dose-response in dividend size: the estimand is the average post-period gap (AEJ p. 321, alpha-hat_1 = mean over t = T0+1..T).
- **Timing:** "Because the Alaska Permanent Fund dividend was initiated in June 1982, we aggregate the data into years defined as twelve-month intervals beginning in July and ending in June" (AEJ pp. 322–323). The true treatment year is t = 1982 (AEJ p. 322, eq. 4). The figures mark 1981 as "the last year before the introduction" (AEJ p. 324).
  - How year labels map to July–June intervals: data run July 1977–June 2015 (AEJ p. 323) and figures are labelled 1977–2014, so label *t* ≈ July *t* to June *t*+1. **Inferred, NOT VERIFIED** (the paper does not state the label convention).
- **Pre-period:** 1977–1981 for monthly-CPS outcomes and 1979–1981 for MORG hours (AEJ Table 1 notes, p. 325). Separate Alaska CPS data exist only from 1977. Six 1977 months (Feb, Mar, Apr, Jul, Sep, Nov) are missing for Alaska and were dropped for all states (AEJ p. 323).
- **Post-period:** 1982–2014, averaged (AEJ Table 2 title and notes, p. 327).
- **Eligibility (AEJ p. 319):** at least 12 months of residence. People incarcerated in the prior year for a felony are ineligible. Non-citizen permanent residents and refugees are eligible. "Each adult and child receiving a separate payment, generally around October of the year, via direct deposit."
- **Dividend formula (AEJ p. 319):** "approximately 10 percent of the average returns to the fund during the last 5 years, spread out evenly among the current year's applicants."
- **Dividend amounts reported in the paper:**
  - Nominal: "as low as $331 in 1984 ... generally exceeded $1,000 since 1996 and peaked in 2015 at $2,072" (AEJ p. 319).
  - Figure 1 (AEJ p. 320) plots nominal USD and "Real payout in 2014 Anchorage USD" by year. **Per-year real values are NOT VERIFIED.** The figure gives no numeric table. AEJ-OA Appendix D (p. 77) says real values use DOR data deflated with BLS CPI-U (file RealAlaskaFundPayout.xlsx in the replication package, not read).
  - Average per-capita dividend: **$1,495 (2010 dollars)**, "Authors' calc." (AEJ Table 5, p. 333; WP Table 5, p. 39).
  - Average household: "about $3,900 per year" (AEJ pp. 317, 335). The PDV calculation uses **$3,962 per household per year**, giving a **PDV of $119,309** over a 79-year lifespan at 3% interest (AEJ pp. 332–333). The WP instead used a per-person PDV of $45,000 from $1,495/yr (WP p. 22 fn 16).
- **Dividend as share of household income:** **not reported (NOT VERIFIED).** The closest figure reported is the **ratio of total dividend payments to total labour income, 0.0725** ("Using data from the BLS", AEJ p. 334; Table 5 p. 333).
- **Nearby policy change:** "Alaska repealed its income tax in 1980" (AEJ p. 332). A placebo that treats 1980 as the treatment year, using pre-1982 data, finds no effect on employment or part-time work (AEJ-OA Table A.8, p. 52: emp +0.001, p = 0.908; PT −0.005, p = 0.379; LFP −0.016, p = 0.190; hours +1.151, p = 0.059, 153/153/153/51 placebos). This check is **only in the AEJ edition**. It is not in the WP.

### DOR annual dividend amounts (nominal USD per eligible applicant), 1982–2019

Source: DOR table, fetched 2026-09-13, column "Dividend Amount". "Applications Paid" and "Total Disbursed" are from the same table.

| Year | Dividend | Apps paid | Total disbursed | | Year | Dividend | Apps paid | Total disbursed |
|---|---|---|---|---|---|---|---|---|
| 1982 | $1,000.00 | 470,897 | $470,897,000.00 | | 2001 | $1,850.28 | 586,848 | $1,085,833,117.44 |
| 1983 | $386.15 | 458,213 | $176,938,949.95 | | 2002 | $1,540.76 | 590,031 | $909,096,163.56 |
| 1984 | $331.29 | 482,135 | $159,726,504.15 | | 2003 | $1,107.56 | 596,176 | $660,300,690.56 |
| 1985 | $404.00 | 519,413 | $209,842,852.00 | | 2004 | $919.84 | 599,992 | $551,896,641.28 |
| 1986 | $556.26 | 533,315 | $296,661,801.90 | | 2005 | $845.76 | 597,639 | $505,459,160.64 |
| 1987 | $708.19 | 530,594 | $375,761,364.86 | | 2006 | $1,106.96 | 595,166 | $658,824,955.36 |
| 1988 | $826.93 | 519,724 | $429,775,367.32 | | 2007 | $1,654.00 | 600,278 | $992,859,812.00 |
| 1989 | $873.16 | 508,710 | $444,185,223.60 | | 2008 | $2,069.00 | 616,484 | $1,275,505,396.00 |
| 1990 | $952.63 | 498,447 | $474,835,565.61 | | 2009 | $1,305.00 | 624,888 | $815,478,840.00 |
| 1991 | $931.34 | 512,764 | $477,557,623.76 | | 2010 | $1,281.00 | 637,873 | $817,115,313.00 |
| 1992 | $915.84 | 523,099 | $479,074,988.16 | | 2011 | $1,174.00 | 644,959 | $757,181,866.00 |
| 1993 | $949.46 | 528,399 | $501,693,714.54 | | 2012 | $878.00 | 641,644 | $563,363,432.00 |
| 1994 | $983.90 | 535,178 | $526,561,634.20 | | 2013 | $900.00 | 634,366 | $570,929,400.00 |
| 1995 | $990.30 | 542,397 | $537,135,749.10 | | 2014 | $1,884.00 | 637,289 | $1,200,652,476.00 |
| 1996 | $1,130.68 | 546,651 | $618,087,352.68 | | 2015 | $2,072.00 | 641,561 | $1,329,314,392.00 |
| 1997 | $1,296.54 | 555,289 | $719,954,400.06 | | 2016 | $1,022.00 | 638,178 | $652,217,916.00 |
| 1998 | $1,540.88 | 565,657 | $871,609,558.16 | | 2017 | $1,100.00 | 633,005 | $696,305,500.00 |
| 1999 | $1,769.84 | 573,324 | $1,014,691,748.16 | | 2018 | $1,600.00 | 639,247 | $1,022,795,200.00 |
| 2000 | $1,963.86 | 583,633 | $1,146,173,503.38 | | 2019 | $1,606.00 | 633,243 | $1,016,988,258.00 |

Also on the same DOR page (outside the requested range): 2020 $992; 2021 $1,114; 2022 $3,284; 2023 $1,312; 2024 $1,702; 2025 $1,000.

Caveats on the DOR series:
- The paper's statements match DOR: 1984 = $331 (DOR $331.29) and a 2015 peak of $2,072.
- The 2008 figure ($2,069) is commonly reported as including a one-time $1,200 energy "Resource Rebate", and 2022 ($3,284) as including a $662 energy relief payment. **Neither split is shown on the DOR page, so both are NOT VERIFIED.** Check before using these years as a dose.
- The paper accessed this table in 2017 (AEJ-OA p. 77). Later revisions, if any, are NOT VERIFIED.

---

## 2. Outcomes and denominators

Sample and survey:
- **Employment, part-time, LFP:** IPUMS-CPS **monthly basic survey** (all months, not March-only). Persons **age 16+**. Survey-weighted and collapsed to state × (July–June) year means for 50 states + DC. July 1977–June 2015, 48,686,169 observations (AEJ pp. 322–323).
- **Hours:** NBER CPS-MORG, "reported hours worked last week at all jobs", **employed respondents only**. July 1979–June 2015, 7,206,411 observations (AEJ p. 323).
- **March ASEC:** used only in the migration robustness check (AEJ-OA App. B, p. 62).

Definitions:
- **Employment rate:** "employment-to-population", where "the self-employed working for pay are also counted as employed" (AEJ p. 324).
- **Part-time rate:** "part-time employment as a share of the population" (AEJ p. 327). Also "the share of all Alaskans who work in part-time jobs" (AEJ p. 316). **The hours threshold behind "part-time" (e.g. <35 usual hours, or the IPUMS status variable used) is not stated in the paper: NOT VERIFIED.** It would be in the replication do-files (data_IPUMS_main.do, not read).
- **LFP:** "active labor force" share of the population (AEJ p. 323; Table 2 col 3).
- **Earnings:** deliberately not analysed. Pre-period fit for hourly earnings is at the 98th percentile (AEJ p. 323 fn 4).

Pre-period levels for Alaska, 1977–81 (AEJ Table 1, p. 325):

| Variable | Alaska | Synthetic Alaska |
|---|---|---|
| Employment rate | 0.639 | 0.639 |
| LFP | 0.712 | 0.706 |
| Part-time rate | 0.103 | 0.104 |
| Hours last week (MORG, 1979–81) | 37.980 | 37.935 |

Headline estimates: see the summary table. The authors' framing is "In our preferred specification, we do not detect any effect ... on employment, i.e., the extensive margin. We do, however, estimate a positive increase of 1.8 percentage points, or 17 percent, in the share of all Alaskans who work in part-time jobs" (AEJ p. 316).

Inconsistency in the source: AEJ p. 324 (and WP p. 16) says "virtually no difference—0.001 percentage points". The table value 0.001 is a proportion, i.e. 0.1 pp, and the introduction says "a 0.1 percentage point increase in employment in our main specification" (AEJ p. 316). **Use 0.1 pp.**

Inference, exactly as defined (AEJ pp. 321–322):
- **p-value:** the share of placebo estimates whose |alpha-hat_st| ≥ |alpha-hat for Alaska, 1982|. The placebos are all 50 states + DC × placebo treatment years 1978–2013, each fitted on up to 5 pre-years. That gives 1,836 placebos (= 51 × 36, derived) for CPS outcomes and 1,734 (= 51 × 34, derived) for hours. The test is two-tailed.
- **95% CI:** from inverting the permutation test, i.e. the set of alpha* with p > 0.05 after subtracting alpha* from Alaska's post-period outcomes.
- Employment: "Just over 94 percent of the placebos generate a larger estimate" (AEJ p. 327). The mean placebo difference is −0.002 (AEJ p. 325).
- Part-time: "the actual difference in Alaska is generally found near the upper limit of placebo differences". The effect "grows over time" and is small in the first years (AEJ pp. 327–329).

Heterogeneity (AEJ Table 3, p. 330, full):

| Group | Employment: est | p | 95% CI | RMSE pct | Part-time: est | p | 95% CI | RMSE pct |
|---|---|---|---|---|---|---|---|---|
| All men | 0.029 | 0.093 | [−0.008, 0.065] | 0.972 | 0.008 | 0.192 | [−0.004, 0.019] | 0.259 |
| Married men | 0.032 | 0.081 | [−0.008, 0.071] | 0.609 | 0.003 | 0.571 | [−0.008, 0.014] | 0.845 |
| Unmarried men | −0.004 | 0.846 | [−0.045, 0.037] | 0.981 | 0.012 | 0.190 | [−0.008, 0.031] | 0.466 |
| All women | −0.019 | 0.234 | [−0.055, 0.017] | 0.978 | 0.022 | 0.032 | [0.003, 0.042] | 0.291 |
| Married women | 0.015 | 0.364 | [−0.020, 0.050] | 0.735 | 0.035 | 0.001 | [0.016, 0.054] | 0.680 |
| Unmarried women | 0.007 | 0.697 | [−0.032, 0.046] | 0.966 | 0.003 | 0.743 | [−0.019, 0.026] | 0.286 |

The authors' reading: the part-time rise "may be driven by adjustments among married women", and "Among all groups, the extensive margin responses are at best marginally significant" (AEJ p. 329).

By age (AEJ-OA Table A.1, p. 45):
- 55+: employment +0.046 (p = 0.020, CI [0.005, 0.086], RMSE pct 0.895); part-time +0.015 (p = 0.053, CI [−0.000, 0.030]).
- Under 55: employment +0.009 (p = 0.494); part-time +0.013 (p = 0.105).
- Authors: "do not imply a particularly more negative labor-supply response among the older group" (AEJ p. 329).

Short run, 1982–1985 only (AEJ-OA Table A.5, p. 49; 357 placebos, 255 for hours):
- Employment +0.026 (p = 0.104, CI [−0.009, 0.061])
- Part-time +0.003 (p = 0.669)
- LFP +0.021 (p = 0.092)
- Hours +0.372 (p = 0.306)
- "the confidence intervals include zero in all cases" (AEJ p. 331).

---

## 3. Comparison design

- **Method:** synthetic control (Abadie–Gardeazabal 2003; Abadie–Diamond–Hainmueller 2010). Weights are non-negative and sum to 1 (AEJ pp. 320–321).
- **Donor pool:** the other 49 states + DC. A different synthetic control is fitted for each outcome (AEJ p. 321; p. 329 "we allow a different set of control states to be chosen, depending on the outcome variable").
- **Predictors (X):** pre-period averages of share female; age shares (16–19, 20–24, 25–64, 65+); education shares (<HS, HS, some college+); five industry-group shares; plus the pre-period average of the outcome (AEJ p. 321, p. 323, p. 324).
- **V matrix:**
  - AEJ: a regression-based method, eq. (3) on p. 321.
  - WP: the iterative minimisation of pre-period MSPE, eq. (4) on WP p. 10.
- **Pre-period fit (the paper calls it RMSE; same concept as RMSPE)**, AEJ Table 2, p. 327:

| Outcome | Pre-RMSE | Percentile |
|---|---|---|
| Employment | 0.005 | 0.322 |
| Part-time | 0.003 | 0.252 |
| LFP | 0.013 | 0.903 |
| Hours | 0.394 | 0.753 |

- **Synthetic Alaska weights** (AEJ-OA Table A.9, p. 53; identical in WP Table A.10, p. 52):

| Outcome | Weights |
|---|---|
| Employment | Utah 0.428, Wyoming 0.342, Washington 0.092, Nevada 0.079, Montana 0.034, Minnesota 0.025 |
| Part-time | Nevada 0.729, Wyoming 0.160, Louisiana 0.060, Maryland 0.033, DC 0.019 |
| LFP | Nevada 0.373, Minnesota 0.306, Wyoming 0.301, Wisconsin 0.020 |
| Hours | Wyoming 0.384, Oklahoma 0.358, DC 0.248, Nevada 0.011 |

### Robustness checks (estimate / p / 95% CI / RMSE percentile)

| Check | Employment | Part-time | LFP | Hours | Source |
|---|---|---|---|---|---|
| Main (Table 2) | 0.001 / 0.942 / [−0.030, 0.033] / 0.322 | 0.018 / 0.020 / [0.004, 0.032] / 0.252 | 0.012 / 0.331 / [−0.019, 0.042] / 0.903 | −0.796 / 0.084 / [−1.751, 0.191] / 0.753 | AEJ p. 327 |
| Common weights (emp + PT jointly) | 0.032 / 0.040 / [0.003, 0.065] / 0.312 | 0.011 / 0.101 / [−0.006, 0.028] / 0.312 | — | — | AEJ Table 4, p. 331 |
| In-space placebos only (51 placebos, year fixed at 1982) | 0.001 / 0.980 / [−0.062, 0.064] / 0.275 | 0.018 / **0.059** / [−0.001, 0.038] / 0.294 | 0.012 / 0.431 / [−0.041, 0.065] / 0.882 | −0.796 / 0.118 / [−1.681, 0.165] / 0.706 | AEJ-OA Table A.2, p. 46 |
| Last pre-year outcome as predictor (Kaul et al.) | −0.002 / 0.880 / [−0.034, 0.031] / 0.610 | 0.017 / 0.034 / [0.001, 0.032] / 0.199 | 0.034 / 0.038 / [0.004, 0.066] / 0.979 | −0.703 / 0.151 / [−1.786, 0.345] / 0.435 | AEJ-OA Table A.3, p. 47 (WP Table A.4 has emp/PT only) |
| Longer pre-period from 1970 (Census) | 0.030 / 0.047 / [0.000, 0.061] / 0.662 | — (not comparable) | — | — | AEJ-OA Table A.4, p. 48 |
| Longer pre-period from 1960 (Census) | 0.030 / 0.052 / [−0.001, 0.061] / 0.564 | — | — | — | AEJ-OA Table A.4, p. 48 |
| Oil production / GDP added as predictor | 0.025 / 0.097 / [−0.006, 0.058] / 0.335 | 0.009 / 0.141 / [−0.004, 0.023] / 0.298 | 0.018 / 0.169 / [−0.013, 0.048] / 0.932 | −0.824 / 0.082 / [−1.776, 0.176] / 0.881 | AEJ-OA Table A.6, p. 50 |
| Avg net migration 1977–81 as predictor | 0.008 / 0.548 / [−0.022, 0.039] / 0.216 | 0.015 / 0.038 / [0.002, 0.029] / 0.224 | 0.014 / 0.278 / [−0.018, 0.043] / 0.867 | −0.772 / 0.092 / [−1.723, 0.227] / 0.783 | AEJ-OA Table B.1, p. 64 |
| Annual net migration 1977–81 as predictors | −0.006 / 0.658 / [−0.040, 0.027] / 0.695 | 0.011 / 0.068 / [−0.001, 0.024] / 0.161 | −0.007 / 0.581 / [−0.040, 0.025] / 0.975 | −0.792 / 0.085 / [−1.733, 0.164] / 0.842 | AEJ-OA Table B.2, p. 65 |
| DD vs Washington only (permutation inference) | −0.008 / 0.617 / [−0.042, 0.026] | 0.008 / 0.276 / [−0.007, 0.022] | — | — | AEJ-OA Table C.1, p. 74 |
| 1980 placebo (income-tax repeal) | 0.001 / 0.908 | −0.005 / 0.379 | −0.016 / 0.190 | 1.151 / 0.059 | AEJ-OA Table A.8, p. 52 |

Migration adjustment (AEJ-OA Table B.3, p. 67; averaged 1982–1985):

| Outcome | 12 months | March only | March, reassigned to prior-year state |
|---|---|---|---|
| Employment | 0.026 (p 0.104) | 0.067 (p 0.029) | 0.050 (p 0.029) |
| Part-time | 0.003 (p 0.669) | −0.008 (p 0.436) | 0.004 (p 0.662) |

The table title says "1982–2014" but its column 1 reproduces Table A.5 (1982–85) and the notes are templated. **Treat the period as NOT VERIFIED.**

Source text to flag verbatim: on the in-space placebo check, both editions say "Our conclusions are changed significantly, although this leads to wider confidence intervals" (AEJ p. 330; WP p. 20). From context this is almost certainly a typo for "not changed". The numbers show the part-time p-value rising to 0.059, i.e. **not significant at 5% with in-space placebos alone**.

Independent replication (I4R, pp. 2–6):
- The Stata package reproduces Table 2 after fixing three code typos and two missing input files.
- Re-estimation in R (tidysynth / Synth):
  - Employment 0.004 (p 0.593)
  - Part-time 0.017 (p 0.008)
  - LFP 0.027 (p 0.052)
  - Hours −0.442 (p 0.142)
- Adding covariates (GDP pc, oil GDP, net migration, government spending) shrinks the part-time effect to 0.003–0.011, not significant. Employment moves to about +0.023 to +0.026 (p ≈ 0.08–0.10).
- Augmented SCM: employment 0.015, part-time 0, LFP 0.018, hours −1.331.
- Synthetic DiD: employment 0.002, part-time 0.002, LFP −0.008, hours −0.08 (SEs 0.004 / 0.003 / 0.004 / 0.07).
- I4R conclusion: "The main result of no negative employment response holds throughout all replication attempts. Although the results for other outcomes are less robust..." (I4R p. 7). They also flag the short pre-period (5 years) vs long post-period (33 years) as "perhaps the main weakness", citing Abadie 2021 (I4R p. 4).

---

## 4. Mechanism interpretation

- **Preferred interpretation:** "the null employment effect could be explained by a positive general equilibrium response offsetting a negative income effect. The unconditional cash transfer results in consumption increases that stimulate labor demand" (AEJ p. 316). The authors state plainly: "we do not directly test this channel" (AEJ p. 316). The evidence offered is indirect, of two kinds.

### (a) Calibration of micro vs macro effects (AEJ Section V.C, pp. 332–335; Table 5, p. 333)

**AEJ edition (use this):**

| Parameter | Value | Source cited |
|---|---|---|
| Income effect | −0.02 EPOP per $140K (Cesarini et al. 2017) | AEJ Table 5 |
| MPC | **0.5** (Kueng 2018's 0.25 "scaled up for durables") | AEJ p. 334 |
| Home bias eta | 0.69 (Nakamura–Steinsson 2014) | AEJ Table 5 |
| Labour share (1−alpha) | 0.667 | AEJ Table 5 |
| Multiplier M | 1.8 (Chodorow-Reich 2019) | AEJ Table 5 |
| kappa | **0.9** | AEJ Table 5 |
| beta | 1.9 jobs per $100K (Chodorow-Reich 2019) | AEJ Table 5 |
| EPOP | 0.66 | AEJ Table 5 |
| Per-capita PFD | $1,495 (2010 $) | AEJ Table 5 |
| PDV lifetime household dividends | **$119,309** | AEJ Table 5 |
| Dividends / labour income | 0.0725 | AEJ Table 5 |

Predicted effects:
- **Micro (income effect) = −0.017** (−1.7 pp)
- **Macro v1 (Chodorow-Reich, Nenov, Simsek) = +0.010**
- **Macro v2 (Chodorow-Reich 2019 spending multiplier) = +0.010**
- **Net = −0.007** "(= −0.017 + 0.01), which is not far from our main estimate in Table 2, but lower than the positive employment effects we estimate in other specifications" (AEJ p. 335).

Derived checks:
- −0.02 × 119,309 / 140,000 = −0.0170.
- 0.69 × 0.5 × 1.9 × 1,495 / 100,000 = 0.0098.
- v1 reproduces as [M/(1+kappa)] × (1−alpha) × eta × MPC × 0.0725 × EPOP = 0.0104. The "M" symbol drops out in PDF text extraction, so this reading of the formula is inferred.

**WP (Jan 2020) calibration, superseded (WP Table 5, p. 39; pp. 22–24):**
- Parameters: MPC 0.25, kappa 1.2, PDV $45,000 per person.
- Effects: micro −0.006, macro +0.005 (both versions), net −0.001.
- Do not mix these with AEJ values.

Multiplier reading: "our estimates imply a state-level fiscal multiplier on par with—or possibly greater than—those in the literature ... they imply a slightly higher lower bound on the national output multiplier than 1.7" (AEJ p. 335). Footnote 7 (AEJ p. 335) expects *smaller* macro effects in Alaska "because the policy is not countercyclical".

### (b) Tradable vs non-tradable sectors (AEJ Table 6, p. 336; text p. 335)

- Tradable: employment −0.048 (p 0.005); part-time +0.015 (p 0.119).
- Non-tradable (includes construction; Mian–Sufi / Di Maggio–Kermani definitions): employment +0.002 (p 0.859); part-time −0.007 (p 0.670).
- Authors: "While the preperiod match is relatively poor, we find reductions in the employment rate and increases in the part-time rate only among the tradable sectors ... This result, albeit suggestive, is consistent with an increase in consumption of nontradable goods contributing to a positive labor-demand effect."
- **The RMSE percentiles are 0.997 and 0.995 for the two sector employment fits, i.e. worse than nearly all placebos.** This is weak evidence.

### Other observations

- **Intensive margin:** "the results suggest that there is a reduction in labor supply on the intensive margin", but "we cannot rule out the possibility that the increase in part-time work represents workers moving into the labor force on a part-time basis" (AEJ p. 317, p. 329). The common-weights specification "impl[ies] that on net, the number of workers in full-time jobs increased" (AEJ p. 330).
- **Alternative reading, dividend too small:** the authors argue against it. The household PDV of about $119,000 is larger than most Cesarini et al. lottery prizes (90% of winners got ≤ $1,400 one-time), and Cesarini et al. find little nonlinearity (AEJ pp. 317, 335).

---

## 5. Funding boundary

- **Fund origin:** 1970s North Slope oil revenue. After a windfall of nearly $900 million "was quickly spent", voters established the Permanent Fund (AEJ p. 319).
- **Constitutional rule** (quoted only in the WP, pp. 6–7, Art. IX §15): "At least twenty-five percent of all mineral lease rentals, royalties, royalty sale proceeds, federal mineral revenue sharing payments and bonuses received by the State shall be placed in a permanent fund..."
- **Fund size:** $64.9 billion as of June 2018 (WP p. 7); $65.1 billion as of September 2020 (AEJ p. 319).
- **Link to oil and the local economy:** the fund is a diversified portfolio. "Oil revenues as a share of the total value of the fund have decreased from 12.2 percent in 1982 to 0.6 percent in 2016 (Kueng 2018)". Dividends use 5-year return averaging, "the level of dividend payments in a given year are generally independent of the local Alaskan economy and contemporary oil production and revenue" (AEJ p. 319).
- **Taxes:** "While the Alaska Permanent Fund dividend is **not explicitly financed by taxes**, it is also not entirely a 'helicopter drop' of money: the dividend was introduced in 1982, but the discovery of the underlying reserves had already been established in the 1970s. Therefore, there are potentially other types of spending that were forfeited when the fund was committed to dividends" (AEJ p. 336).
  - Precision note: the paper does **not** literally say "no new tax on residents". Its wording is "not explicitly financed by taxes".
  - The state **repealed** its income tax in 1980, two years before the dividend (AEJ p. 332). So the fiscal regime moved *away* from taxing residents around the treatment date. The authors say this "might bias us against finding a negative effect of the dividend on employment", and their 1980 placebo shows no effect.
- **Why it matters for the estimate:** the treatment is a transfer *without an offsetting tax on the recipients*. The estimate therefore does not net out the labour-supply or deadweight effects of financing a UBI with taxes. The authors: "Our study speaks most closely to the likely labor market impacts of a small, universal cash transfer financed through a natural resource rent. A basic income financed through an increase in taxes would have to contend with any potential deadweight losses from such tax increases" (AEJ p. 337). They also list "how the mode of financing of a universal basic income affects its impact" as future research (AEJ p. 338).
- **Crowd-out check** (government spending shares as outcomes; AEJ-OA Table A.7, p. 51; pre-fit "less than ideal", AEJ p. 336):
  - Health/hospitals −0.006 (p 0.679)
  - Education −0.074 (p 0.011)
  - Highways +0.030 (p 0.032)
  - Welfare/transfers −0.018 (p 0.416, RMSE pct 0.381)
  - "we do not find a significant change in welfare and transfer spending ... also alleviates the concern that the dividends crowded out other forms of redistribution" (AEJ p. 336).

---

## 6. What the estimate does NOT say (limits stated by the authors, plus the ones that follow from their design)

1. **Small transfer only.** "Our study speaks most closely to the likely labor market impacts of a small, universal cash transfer" (AEJ p. 337). "Most universal basic income proposals involve amounts significantly higher ... [e.g.] $1,000 a month. The effect of a larger sum of money on the labor market is therefore uncertain" (AEJ p. 337). Future work should study "how these effects might scale with a significantly larger transfer" (AEJ p. 338).
2. **Resource-rent financing, not tax financing.** There are no tax-side distortions in the estimate (AEJ p. 337). Forgone public spending is possible, and the spending-share checks are "at best suggestive" (AEJ p. 336).
3. **The GE channel is not directly tested.** "While we do not directly test this channel" (AEJ p. 316). The tradable/non-tradable evidence is "only suggestive" with poor pre-fit (AEJ pp. 317, 335).
4. **Intensive margin is ambiguous.** The part-time rise could be full-time-to-part-time switching *or* new part-time entrants (AEJ p. 329). The hours and LFP results have poor pre-fit and "relatively less weight" (AEJ p. 329, p. 327).
5. **Not countercyclical, single state, small open economy.** Macro effects may differ elsewhere: expected to be smaller than in recession-era multiplier studies (AEJ p. 335 fn 7). "Where exactly this effect would fall in the United States is still an open question" (AEJ p. 337).
6. **Earnings and wages are not estimated** because of poor pre-fit (98th percentile; AEJ p. 323 fn 4). Prices and interactions with other welfare programmes are listed as open questions (AEJ p. 338).
7. **One average over 33 years with a 5-year pre-period.** The estimate is an average over 1982–2014, not a dose-response to year-to-year dividend size. The part-time effect "grows over time" and is near zero in 1982–85 (AEJ p. 327; OA Table A.5).
   - Randomisation-inference framing: "randomization is unlikely to describe the data-generating process in our setting" (AEJ p. 322).
   - I4R flags the short pre / long post window as the main weakness and shows estimates vary with post-period length and estimator (I4R pp. 4–6).
8. **Not a micro elasticity.** Feinberg & Kuehn (2018), using within-Alaska variation, find negative income effects on hours. The authors say that design captures micro, not macro, effects (AEJ p. 317). The two are different estimands.
9. **Migration.** There was a relative in-migration surge just before 1982. The adjustments are "qualitatively similar" but partial: the CPS is not a long panel, so recent in-migrants cannot be fully dropped (AEJ p. 332; OA App. B p. 62).

---

## Machine-readable headline estimates

```yaml
case_id: alaska-pfd-jones-marinescu
citation:
  authors: [Damon Jones, Ioana Marinescu]
  title: "The Labor Market Impacts of Universal and Permanent Cash Transfers: Evidence from the Alaska Permanent Fund"
  published: "American Economic Journal: Economic Policy 14(2): 315-340, May 2022"
  doi: 10.1257/pol.20190299
  working_paper: "NBER w24312, Feb 2018 rev. Jan 2020 (empirical tables identical; calibration Table 5 differs)"
  edition_used: AEJ 2022 (typeset PDF via home.uchicago.edu/~j1s/Jones_Alaska_2022.pdf) + AEJ online appendix (May 2021)
treatment:
  unit: state of Alaska (1 treated unit; donors = 49 other states + DC)
  definition: introduction of universal annual Permanent Fund Dividend (first paid 1982; initiated June 1982)
  treatment_year: 1982                    # AEJ p.322 eq.4
  year_definition: July-June twelve-month intervals   # AEJ pp.322-323
  pre_period: [1977, 1981]                # CPS outcomes; hours pre-period 1979-1981 (AEJ Table 1 notes p.325)
  post_period: [1982, 2014]               # AEJ Table 2 p.327
  dose:
    avg_per_capita_dividend_usd_2010: 1495          # AEJ Table 5 p.333
    avg_household_dividend_usd_per_year: 3962       # AEJ p.332 (text also says "about $3,900", p.317)
    pdv_lifetime_household_usd: 119309              # AEJ Table 5 p.333 (79 yrs, 3%)
    dividends_to_labor_income_ratio: 0.0725         # AEJ Table 5 p.333
    dividend_share_of_household_income: NOT VERIFIED   # not reported
    nominal_min: {year: 1984, usd: 331}             # AEJ p.319; DOR 331.29
    nominal_peak_through_2015: {year: 2015, usd: 2072}  # AEJ p.319; DOR 2072.00
  funding: Permanent Fund investment earnings (oil royalties origin, diversified); "not explicitly financed by taxes" (AEJ p.336)
  concurrent_policy: Alaska state income tax repealed 1980 (AEJ p.332); 1980 placebo null (AEJ-OA Table A.8 p.52)
method:
  estimator: synthetic control (ADH 2010), outcome-specific weights
  inference: permutation over 51 states x placebo years 1978-2013; two-tailed; CI by test inversion
  placebos: {cps_outcomes: 1836, hours: 1734}
headline:
  employment_rate:
    denominator: population age 16+ (monthly CPS basic, IPUMS)
    estimate: 0.001            # proportion; = +0.1 pp
    estimate_pp: 0.1
    relative_reported: null    # not reported
    relative_derived: 0.0016   # 0.001 / 0.639 Alaska pre-mean (derived, not reported)
    p_value: 0.942
    ci95: [-0.030, 0.033]
    pre_rmse: 0.005
    rmse_percentile: 0.322
    source: AEJ Table 2 col 1, p.327
  part_time_rate:
    denominator: population age 16+ (part-time workers / population)
    part_time_hours_threshold: NOT VERIFIED
    estimate: 0.018            # = +1.8 pp
    estimate_pp: 1.8
    relative_reported: 0.17    # AEJ p.316, p.328
    pre_mean_alaska: 0.103     # AEJ Table 1 p.325
    p_value: 0.020
    ci95: [0.004, 0.032]
    pre_rmse: 0.003
    rmse_percentile: 0.252
    source: AEJ Table 2 col 2, p.327
secondary:
  labor_force_participation:
    estimate: 0.012
    p_value: 0.331
    ci95: [-0.019, 0.042]
    rmse_percentile: 0.903     # poor fit
    source: AEJ Table 2 col 3, p.327
  hours_worked_last_week:
    population: employed only (CPS-MORG)
    estimate_hours: -0.796
    p_value: 0.084
    ci95: [-1.751, 0.191]
    rmse_percentile: 0.753     # poor fit
    source: AEJ Table 2 col 4, p.327
heterogeneity:
  part_time_married_women: {estimate: 0.035, p_value: 0.001, ci95: [0.016, 0.054], source: "AEJ Table 3 col 11 p.330"}
  part_time_all_women:     {estimate: 0.022, p_value: 0.032, ci95: [0.003, 0.042], source: "AEJ Table 3 col 10 p.330"}
  part_time_all_men:       {estimate: 0.008, p_value: 0.192, ci95: [-0.004, 0.019], source: "AEJ Table 3 col 4 p.330"}
  employment_tradable:     {estimate: -0.048, p_value: 0.005, ci95: [-0.072, -0.025], rmse_percentile: 0.997, source: "AEJ Table 6 col 1 p.336"}
  employment_nontradable:  {estimate: 0.002, p_value: 0.859, ci95: [-0.024, 0.027], rmse_percentile: 0.995, source: "AEJ Table 6 col 3 p.336"}
robustness_employment_range:
  common_weights: {estimate: 0.032, p_value: 0.040, source: "AEJ Table 4 p.331"}
  pre_from_1970:  {estimate: 0.030, p_value: 0.047, source: "AEJ-OA Table A.4 p.48"}
  oil_control:    {estimate: 0.025, p_value: 0.097, source: "AEJ-OA Table A.6 p.50"}
  dd_washington:  {estimate: -0.008, p_value: 0.617, source: "AEJ-OA Table C.1 p.74"}
robustness_part_time_fragility:
  in_space_placebos_only: {estimate: 0.018, p_value: 0.059, source: "AEJ-OA Table A.2 p.46"}
  common_weights:         {estimate: 0.011, p_value: 0.101, source: "AEJ Table 4 p.331"}
  oil_control:            {estimate: 0.009, p_value: 0.141, source: "AEJ-OA Table A.6 p.50"}
  i4r_more_covariates:    {estimate_range: [0.003, 0.011], source: "I4R Table 3 p.5"}
calibration_AEJ:            # AEJ Table 5 p.333 (supersedes WP values -0.006/+0.005/-0.001)
  micro_income_effect_epop: -0.017
  macro_effect_epop_v1: 0.010
  macro_effect_epop_v2: 0.010
  net_predicted_epop: -0.007
  mpc: 0.5
  kappa: 0.9
  multiplier: 1.8
  home_bias_eta: 0.69
  jobs_per_100k_beta: 1.9
validation_use_notes:
  - "Target is an average 1982-2014 level gap vs synthetic control, not a year-by-year path; part-time gap grows over time (near 0 in 1982-85: AEJ-OA Table A.5)."
  - "Transfer ~7% of aggregate labor income, resource-rent financed, no tax offset; do not extrapolate to tax-financed or $12k/yr UBI without the authors' own caveats (AEJ p.337)."
  - "Employment null is robust (I4R); part-time +1.8pp is significant in the main spec but fragile across specifications."
```

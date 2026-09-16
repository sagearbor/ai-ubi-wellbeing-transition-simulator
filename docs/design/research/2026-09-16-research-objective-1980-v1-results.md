# Separate objective-proxy experiment — 1980 origin to 1981–2025

Entry `research-objective-1980-v1`. Training 1960–1980 only; numeric freeze `af07c67c38830b64273e84677dd9723f90c934a4`. Fixed damping 0.95 was registered before fetching numeric series; no model selection. No ladder mapping.

**The primary2025 life-expectancy endpoint is unscored: the source has no 2025 values.** All140 countries remain in the forecast; they are not deleted. Pooled1981–2024 and the annual table are secondary results, not substitutes for the missing primary. GDP has 132 of 140 countries observed at 2025.

There was one failed command preflight: git-show exceeded Node's1 MiB output buffer while checking file bytes, before any score or receipt existed. The buffer was increased and a regression test added; `preflight-failure.json` records the recovery. Model/protocol/calibration/prediction/metrics were unchanged. The subsequent single scored run completed; this is not presented as first-invocation success.

140 of 217 current nonaggregate country identifiers met pre1981 availability requirements;77 were excluded. Current country borders, survivorship, revised data, life-table modeling/interpolation and publication timing prevent an archived1980 forecast claim. The trend method is compared only with persistence here; that can be a weak benchmark for long-run trending quantities.

## Life expectancy — years

| Scope | Observed / expected | Model MAE | Persistence MAE | Skill |
| --- | --- | --- | --- | --- |
| 2025 endpoint | 0 / 140 | not scored | not scored | undefined |
| Pooled available years | 6160 / 6300 | 3.666440 | 6.487478 | +43.48% |

| Window ending / year | Observed / expected | Model MAE | Persistence MAE | Skill |
| --- | --- | --- | --- | --- |
| 1981 | 140 / 140 | 0.284368 | 0.458911 | +38.03% |
| 1982 | 140 / 140 | 0.535645 | 0.895209 | +40.17% |
| 1983 | 140 / 140 | 0.675131 | 1.200080 | +43.74% |
| 1984 | 140 / 140 | 0.850624 | 1.574742 | +45.98% |
| 1985 | 140 / 140 | 1.034451 | 1.857151 | +44.30% |
| 1986 | 140 / 140 | 1.163140 | 2.136634 | +45.56% |
| 1987 | 140 / 140 | 1.318405 | 2.396024 | +44.98% |
| 1988 | 140 / 140 | 1.536326 | 2.708616 | +43.28% |
| 1989 | 140 / 140 | 1.703632 | 2.921614 | +41.69% |
| 1990 | 140 / 140 | 1.882152 | 3.155853 | +40.36% |
| 1991 | 140 / 140 | 2.178202 | 3.524181 | +38.19% |
| 1992 | 140 / 140 | 2.360790 | 3.837327 | +38.48% |
| 1993 | 140 / 140 | 2.459094 | 3.991814 | +38.40% |
| 1994 | 140 / 140 | 2.830988 | 4.433718 | +36.15% |
| 1995 | 140 / 140 | 2.790253 | 4.453619 | +37.35% |
| 1996 | 140 / 140 | 2.968154 | 4.739307 | +37.37% |
| 1997 | 140 / 140 | 3.198057 | 5.077603 | +37.02% |
| 1998 | 140 / 140 | 3.369789 | 5.265314 | +36.00% |
| 1999 | 140 / 140 | 3.449927 | 5.592217 | +38.31% |
| 2000 | 140 / 140 | 3.603196 | 5.925944 | +39.20% |
| 2001 | 140 / 140 | 3.793094 | 6.302414 | +39.82% |
| 2002 | 140 / 140 | 3.908143 | 6.595696 | +40.75% |
| 2003 | 140 / 140 | 3.991977 | 6.870739 | +41.90% |
| 2004 | 140 / 140 | 4.201261 | 7.186207 | +41.54% |
| 2005 | 140 / 140 | 4.305772 | 7.509931 | +42.67% |
| 2006 | 140 / 140 | 4.471153 | 7.817801 | +42.81% |
| 2007 | 140 / 140 | 4.567726 | 8.065198 | +43.36% |
| 2008 | 140 / 140 | 4.701641 | 8.259459 | +43.08% |
| 2009 | 140 / 140 | 5.056216 | 8.784485 | +42.44% |
| 2010 | 140 / 140 | 4.910216 | 8.760419 | +43.95% |
| 2011 | 140 / 140 | 5.117496 | 9.132084 | +43.96% |
| 2012 | 140 / 140 | 5.071304 | 9.240181 | +45.12% |
| 2013 | 140 / 140 | 5.235792 | 9.495391 | +44.86% |
| 2014 | 140 / 140 | 5.407224 | 9.770169 | +44.66% |
| 2015 | 140 / 140 | 5.360786 | 9.884887 | +45.77% |
| 2016 | 140 / 140 | 5.480043 | 10.075464 | +45.61% |
| 2017 | 140 / 140 | 5.553463 | 10.273636 | +45.94% |
| 2018 | 140 / 140 | 5.602592 | 10.497033 | +46.63% |
| 2019 | 140 / 140 | 5.865281 | 10.852631 | +45.96% |
| 2020 | 140 / 140 | 5.355551 | 10.145856 | +47.21% |
| 2021 | 140 / 140 | 5.425909 | 9.567579 | +43.29% |
| 2022 | 140 / 140 | 5.826910 | 11.077274 | +47.40% |
| 2023 | 140 / 140 | 5.918959 | 11.466871 | +48.38% |
| 2024 | 140 / 140 | 6.002504 | 11.671736 | +48.57% |
| 2025 | 0 / 140 | not scored | not scored | undefined |

| Origin income quartile | 2025 observed | 2025 model MAE | 2025 persistence MAE | 2025 skill | Pooled skill |
| --- | --- | --- | --- | --- | --- |
| 1 | 0 | not scored | not scored | undefined | +36.31% |
| 2 | 0 | not scored | not scored | undefined | +35.72% |
| 3 | 0 | not scored | not scored | undefined | +60.68% |
| 4 | 0 | not scored | not scored | undefined | +44.33% |

Positive contribution reduces aggregate MAE; negative contribution makes it worse. Each endpoint contribution divides the country's absolute-error improvement by the common observed endpoint count. Pooled contributions use the common observed country-year count. Each list shows both tails; the complete country table is in scores.json.

2025 endpoint: no observed targets.

### Pooled years contributors

| Tail | Country | Contribution to MAE improvement |
| --- | --- | --- |
| Largest gains | Oman (OMN) | 0.09384868 |
| Largest gains | Saudi Arabia (SAU) | 0.07047427 |
| Largest gains | Maldives (MDV) | 0.06928888 |
| Largest gains | Iran, Islamic Rep. (IRN) | 0.06456328 |
| Largest gains | Korea, Rep. (KOR) | 0.05528999 |
| Largest losses | Libya (LBY) | -0.02082726 |
| Largest losses | Kenya (KEN) | -0.02277346 |
| Largest losses | Botswana (BWA) | -0.03272548 |
| Largest losses | Eswatini (SWZ) | -0.03456877 |
| Largest losses | Central African Republic (CAF) | -0.03537384 |

## GDP — cumulative growth percentage-point error

| Scope | Observed / expected | Model MAE | Persistence MAE | Skill |
| --- | --- | --- | --- | --- |
| 2025 endpoint | 132 / 140 | 143.457656 | 161.691122 | +11.28% |
| Pooled available years | 6289 / 6300 | 64.633326 | 67.126945 | +3.71% |

| Window ending / year | Observed / expected | Model MAE | Persistence MAE | Skill |
| --- | --- | --- | --- | --- |
| 1981 | 140 / 140 | 4.536385 | 4.331402 | -4.73% |
| 1982 | 140 / 140 | 8.249572 | 6.831672 | -20.75% |
| 1983 | 140 / 140 | 11.515354 | 9.264251 | -24.30% |
| 1984 | 140 / 140 | 14.191282 | 11.518376 | -23.21% |
| 1985 | 140 / 140 | 16.875562 | 13.618944 | -23.91% |
| 1986 | 140 / 140 | 19.108273 | 15.248617 | -25.31% |
| 1987 | 140 / 140 | 21.247420 | 17.233369 | -23.29% |
| 1988 | 140 / 140 | 23.133957 | 19.997167 | -15.69% |
| 1989 | 140 / 140 | 25.289624 | 22.676796 | -11.52% |
| 1990 | 140 / 140 | 28.077853 | 25.164910 | -11.58% |
| 1991 | 140 / 140 | 31.183408 | 27.084180 | -15.14% |
| 1992 | 140 / 140 | 34.250710 | 29.079721 | -17.78% |
| 1993 | 140 / 140 | 37.002908 | 31.223405 | -18.51% |
| 1994 | 140 / 140 | 39.686406 | 34.222027 | -15.97% |
| 1995 | 140 / 140 | 42.080359 | 36.669908 | -14.75% |
| 1996 | 140 / 140 | 44.026784 | 39.325866 | -11.95% |
| 1997 | 140 / 140 | 46.557386 | 42.314171 | -10.03% |
| 1998 | 140 / 140 | 47.248946 | 43.727308 | -8.05% |
| 1999 | 140 / 140 | 49.697147 | 46.832520 | -6.12% |
| 2000 | 140 / 140 | 51.729929 | 50.683489 | -2.06% |
| 2001 | 140 / 140 | 53.546366 | 52.568371 | -1.86% |
| 2002 | 140 / 140 | 56.527222 | 55.152014 | -2.49% |
| 2003 | 140 / 140 | 59.970011 | 58.568007 | -2.39% |
| 2004 | 140 / 140 | 62.602125 | 62.655156 | +0.08% |
| 2005 | 140 / 140 | 64.887756 | 66.605158 | +2.58% |
| 2006 | 140 / 140 | 67.937653 | 72.547178 | +6.35% |
| 2007 | 140 / 140 | 71.801005 | 78.499001 | +8.53% |
| 2008 | 140 / 140 | 74.283383 | 81.510922 | +8.87% |
| 2009 | 140 / 140 | 75.665812 | 79.825237 | +5.21% |
| 2010 | 140 / 140 | 79.598195 | 85.654668 | +7.07% |
| 2011 | 140 / 140 | 84.208252 | 90.744798 | +7.20% |
| 2012 | 140 / 140 | 87.637170 | 93.302781 | +6.07% |
| 2013 | 140 / 140 | 91.176205 | 97.842637 | +6.81% |
| 2014 | 140 / 140 | 94.774974 | 102.675389 | +7.69% |
| 2015 | 140 / 140 | 99.173838 | 107.564169 | +7.80% |
| 2016 | 140 / 140 | 103.058679 | 112.413068 | +8.32% |
| 2017 | 140 / 140 | 106.922628 | 117.723839 | +9.18% |
| 2018 | 140 / 140 | 111.107911 | 122.690595 | +9.44% |
| 2019 | 140 / 140 | 115.467674 | 127.509533 | +9.44% |
| 2020 | 140 / 140 | 112.020641 | 117.233464 | +4.45% |
| 2021 | 140 / 140 | 118.348671 | 128.014286 | +7.55% |
| 2022 | 140 / 140 | 123.068482 | 135.656955 | +9.28% |
| 2023 | 139 / 140 | 126.951499 | 141.966471 | +10.58% |
| 2024 | 138 / 140 | 134.565006 | 150.174238 | +10.39% |
| 2025 | 132 / 140 | 143.457656 | 161.691122 | +11.28% |

| Origin income quartile | 2025 observed | 2025 model MAE | 2025 persistence MAE | 2025 skill | Pooled skill |
| --- | --- | --- | --- | --- | --- |
| 1 | 34 | 252.801552 | 261.078828 | +3.17% | +1.92% |
| 2 | 35 | 133.671625 | 152.899391 | +12.58% | +8.41% |
| 3 | 34 | 102.375900 | 132.029978 | +22.46% | +3.45% |
| 4 | 29 | 75.236911 | 90.553449 | +16.91% | +1.51% |

Positive contribution reduces aggregate MAE; negative contribution makes it worse. Each endpoint contribution divides the country's absolute-error improvement by the common observed endpoint count. Pooled contributions use the common observed country-year count. Each list shows both tails; the complete country table is in scores.json.

### 2025 endpoint contributors

| Tail | Country | Contribution to MAE improvement |
| --- | --- | --- |
| Largest gains | Korea, Rep. (KOR) | 2.11145161 |
| Largest gains | Malta (MLT) | 1.90815222 |
| Largest gains | Singapore (SGP) | 1.88560670 |
| Largest gains | Hong Kong SAR, China (HKG) | 1.21235729 |
| Largest gains | Malaysia (MYS) | 0.93640357 |
| Largest losses | Sao Tome and Principe (STP) | -0.74579216 |
| Largest losses | Gabon (GAB) | -1.51023426 |
| Largest losses | Saudi Arabia (SAU) | -2.04969521 |
| Largest losses | Libya (LBY) | -3.01097648 |
| Largest losses | Oman (OMN) | -3.17373354 |

### Pooled years contributors

| Tail | Country | Contribution to MAE improvement |
| --- | --- | --- |
| Largest gains | Korea, Rep. (KOR) | 1.17969776 |
| Largest gains | Singapore (SGP) | 1.01824374 |
| Largest gains | Hong Kong SAR, China (HKG) | 0.70571889 |
| Largest gains | Botswana (BWA) | 0.58810753 |
| Largest gains | Thailand (THA) | 0.54991556 |
| Largest losses | Gabon (GAB) | -0.86688763 |
| Largest losses | United Arab Emirates (ARE) | -1.01722143 |
| Largest losses | Saudi Arabia (SAU) | -1.14958720 |
| Largest losses | Oman (OMN) | -1.26939821 |
| Largest losses | Libya (LBY) | -1.62953382 |

## Scope and reproduction

Every target has separate masks, baseline and scores; no combined success metric exists. Supplementary GDP-level MAE, RMSE and bias are also in scores.json. The original freeze note remains a historical pending-status record; this document and the scored ledger supersede only that status. Read `data/evaluation/research-objective-1980-v1/scores.json` and its exclusive receipt; do not rerun the scorer. This research does not validate a wellbeing index, AI transition, UBI policy or life-expectancy intervention.

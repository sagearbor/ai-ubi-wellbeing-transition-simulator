# Country-data migration: `countries-legacy-v1` → `countries-wb-2026-09`

14 September 2026. Owner decision 4(b) of the independent review
(`docs/design/reviews/2026-09-14-v3-implementation-review-97f751d.md`): "Replace hand-entered
country data? Yes, through a versioned migration." This note publishes the before/after results.
Conventions and the dataset format are in `data/countries/README.md`; this note does not repeat
their justification.

**What changed.** The four country inputs of the world engine (population, GDP per capita, Gini,
governance) now come from a versioned, sourced dataset with a value, year, source and status per
field. The app default and every CLI use `countries-wb-2026-09`. The hand-entered table is frozen
as `countries-legacy-v1`; saves, autosaves and links written before the migration carry no dataset
id and reopen on it. Corporate revenue, market caps and adoption are unchanged and remain
assumptions.

**What did not change.** No invariant, published-paper target (Korinek KJ-1 to KJ-3, the faithful
Korinek port, Gasteiger–Prettner), hindcast threshold or case expectation was edited. Anchor tests
remain 5/6 with the same failure (AT-3, 0.578). The legacy dataset reproduces every pre-migration
output byte for byte.

## Conventions in one table

| Field | Before (`countries-legacy-v1`) | After (`countries-wb-2026-09`) |
|---|---|---|
| population | hand-entered millions, vintage undocumented | `SP.POP.TOTL` / 1e6, 2024 |
| gdpPerCapita | hand-entered, nominal US$, base year undocumented (~2019-2021) | `NY.GDP.PCAP.KD`, constant 2015 US$, latest 2018-2024 — the series the anchor was fitted on |
| gini | hand-entered 0-1 | `SI.POV.GINI` / 100, latest survey 2014-2024 |
| governance | hand-assigned 0-1, not a named index | institutional quality: `clamp(0.5668 + 0.2264 × mean(WGI GE, RL, CC), 0, 1)`, 2024; not democracy |
| wellbeing anchor | 7.454 + 5.103 ln gdp + 7.658 gov (R² 0.651, RMSE 5.73) | refit on the new governance, same 335 country-years: 2.877 + 5.991 ln gdp + 1.830 gov (R² 0.644, RMSE 5.78) |
| money | undocumented | read as constant 2015 US$; corporate figures not deflated (US deflator 2015→2024 = 1.289x), disclosed |

Coverage (from `npx tsx scripts/countries/compare-datasets.ts`):

| field | observed | legacy-unsourced | ids kept from the hand-entered table | observation years |
|---|---|---|---|---|
| population | 127 | 1 | TWN | 2024: 127 |
| gdpPerCapita | 126 | 2 | TWN, PRK | 2024: 124, 2022: 1 (SYR), 2018: 1 (YEM) |
| gini | 105 | 23 | CUB, HTI, BHS, TTO, VEN, GUY, TWN, PRK, SGP, KHM, BRN, TKM, SAU, AFG, JOR, OMN, KWT, BHR, AZE, MAR, DZA, NZL, PNG | 2024: 24, 2023: 35, 2022: 17, 2021: 10, 2020: 6, 2019: 4, 2018: 3, 2017: 3, 2014: 3 |
| governance | 128 | 0 | — (Taiwan matched by the WGI name "Taiwan, China") | 2024: 128 |

No value is `missing`. The two legacy GDP values (TWN 33,000, PRK 640) are on the old nominal
convention and are flagged as such in the file.

## Headline before/after

All "before" numbers are the pre-migration outputs, reproduced exactly with
`COUNTRY_DATASET=countries-legacy-v1`. "After" is the default.

### Response profile base rows

`npm run profile:default -- --model=evidence-anchored` (the default preset) and
`-- --model=organic-incentive` (legacy flow preset):

| preset | horizon | avg wellbeing | US wellbeing | poor-8 wellbeing | US adoption | crisis | inflow bn/mo |
|---|---|---|---|---|---|---|---|
| evidence-anchored | 0 | 58.8 → 58.8 | 68.2 → 68.2 | 36.8 → 36.8 | 0.010 → 0.010 | 0 → 0 | — |
| evidence-anchored | 5 y | 58.4 → **58.9** | 69.0 → **69.6** | 41.3 → **41.7** | 0.501 → **0.510** | 0 → 0 | 64.4 → 64.4 |
| evidence-anchored | 10 y | 58.6 → **59.3** | 69.5 → **70.3** | 43.0 → **43.5** | 0.773 → **0.784** | 0 → 0 | 58.3 → 58.3 |
| organic-incentive | 0 | 54.1 → **55.2** | 92.5 → **95.7** | 40.7 → 40.7 | 0.010 → 0.010 | 0 → 0 | — |
| organic-incentive | 5 y | 45.0 → **45.4** | 57.2 → **52.4** | 36.2 → **36.8** | 0.469 → **0.477** | 15 → 15 | 101.3 → **104.2** |
| organic-incentive | 10 y | 31.3 → **31.7** | 1.0 → 1.0 | 29.5 → **30.4** | 0.715 → **0.724** | 40 → 40 | 125.1 → **124.8** |

The anchored model's month-0 wellbeing comes from the WHR ladder, so it does not move. Its
10-year drift moves by less than one point everywhere; adoption is a little faster because the
adoption rule scales with GDP per capita and constant-2015 GDP is higher than the legacy nominal
figure for most countries (95 of 128). The legacy flow preset starts the US 3.2 points higher (the
unsourced `gdp/1200 + 40` rule reads the new GDP) and collapses the same way.

### Historical reconstruction (`npm run hindcast`, 2015-2025, 106 countries, in-sample)

| run | corr ΔWB before → after | MAE (index) before → after | GDP-growth MAE % |
|---|---|---|---|
| AI off (HC-1/HC-2 gate) | 0.485 → **0.473** | 4.48 → **4.53** | 17.33 → 17.33 |
| AI off, UBI on | 0.181 → **0.175** | 7.04 → **7.03** | 17.33 → 17.33 |
| AI on (legacy flow) | 0.249 → **0.244** | 25.55 → **25.35** | 27.50 → **27.73** |
| Anchored, AI off | 0.485 → **0.473** | 4.48 → **4.53** | 17.33 → 17.33 |
| Anchored, AI on | 0.499 → **0.488** | 4.43 → **4.48** | 28.39 → **28.64** |
| persistence (comparator) | 0.000 | 4.68 → 4.68 | — |

HC-1 (r ≥ 0.4) and HC-2 (MAE ≤ 5) still pass; thresholds untouched. The fit gets slightly worse
because the refitted anchor loses most of its governance term (see finding 1). The anchored AI-on
run still beats persistence by 0.20 index points of MAE — in-sample, not validation.

### Anchor tests (`npm run validate`)

| test | before | after |
|---|---|---|
| AT-1 displacement without UBI | pass, Δ −20.33 | pass, Δ −20.64 |
| AT-2 generous UBI prevents collapse | pass, ratio 1.065 | pass, ratio 1.027 |
| AT-3 prisoner's dilemma | **fail**, 0.578 | **fail**, 0.578 (unchanged; measurement artefact, model card) |
| AT-4 demand collapse triggers adaptation | pass, 10% → 27.1% | pass, 10% → 25.2% |
| AT-5 global distribution helps poor countries | pass, 41.8 vs 4.1 | pass, 45.7 vs 5.4 |
| AT-6 money conservation | pass, 0.00% | pass, 0.00% |
| total | 5/6 | 5/6 |

### Alaska structural check (`npm run validate:cases`)

| item | before | after |
|---|---|---|
| world engine, USA 24 months, unemployment without vs with transfers | 6.84% vs 6.84% | 6.91% vs 6.91% |
| classification | mechanism-absent | mechanism-absent (unchanged) |
| transfer in the check run, share of labour income | 0.84% | 0.79% |
| `alaska-pfd-calibration` core model | −0.7 pp (discrepancy −0.8 pp) | unchanged (does not read country data) |

The transfer share falls because US GDP per capita rises from 63,000 to 66,857 (constant 2015 US$).

### Korinek reduced form (`npm run validate:korinek`)

Unchanged: KJ-1 1.6 / 59.2 / 3.9, KJ-2 8.2 / 56.2 / 4.4, KJ-3 31.3 / 45.4 / 17.8 (GDP boost % /
labour share % / cognitive unemployment %), 3/3 within tolerance. The outcomes are relative to the
no-AI path, and the US keeps the `rich-democracy` archetype through which its calibration attaches
(finding 2).

### Stress review of `evidence-anchored`

| case | US wellbeing 5 y / 10 y | US unemployment peak | US labour share 10 y | avg wellbeing 10 y | poor-8 10 y |
|---|---|---|---|---|---|
| base (`DEFAULT_MACRO`) | 69.0 / 69.5 → **69.6 / 70.3** | 6.9% → **7.0%** (yr 3) | 0.347 → **0.343** | 58.6 → **59.3** | 43.0 → **43.5** |
| Korinek extreme (automation 0.9, re-employment 18 mo) | 67.7 / 68.1 → **68.3 / 68.9** | 11.4% → **11.5%** (yr 4) | 0.347 → **0.343** | 58.3 → **59.0** | 43.0 → **43.5** |
| extreme, re-employment 60 mo | 65.9 / 64.0 → **66.5 / 64.7** | 21.0% → **21.2%** (yr 7) | 0.347 → **0.343** | 57.5 → **58.2** | 43.0 → **43.5** |
| extreme, 60 mo, adoption growth ×2 | 63.4 / 62.1 → **63.9 / 62.8** | 27.9% → **28.2%** (yr 5) | 0.287 → **0.285** | 57.0 → **57.7** | 43.0 → **43.5** |

(Peaks are computed every month here; the model card's earlier table rounded the base peak to
6.8%, year 2.) The worst US 10-year drop from base is −7.5 points after, −7.4 before.

### Countries whose 10-year outcome moves most

Default preset (`evidence-anchored`); mean absolute change over 128 countries 1.07 index points.

| id | country | before | after | change | archetype before → after |
|---|---|---|---|---|---|
| GUY | Guyana | 58.7 | 66.3 | +7.6 | developing-fragile |
| UZB | Uzbekistan | 50.3 | 55.6 | +5.3 | developing-fragile |
| TUR | Turkey | 57.2 | 61.1 | +3.9 | authoritarian |
| AGO | Angola | 47.6 | 50.7 | +3.1 | failed-state → developing-fragile |
| SAU | Saudi Arabia | 62.5 | 65.5 | +2.9 | authoritarian → middle-stable |
| UKR | Ukraine | 53.1 | 50.3 | −2.8 | developing-fragile |
| TKM | Turkmenistan | 55.1 | 57.9 | +2.8 | failed-state |
| TJK | Tajikistan | 46.0 | 48.8 | +2.8 | failed-state |
| LBN | Lebanon | 51.4 | 54.1 | +2.7 | failed-state |
| AZE | Azerbaijan | 53.3 | 56.0 | +2.7 | developing-fragile → authoritarian |

Guyana's hand-entered GDP (9,000) predated its oil boom (33,035 in 2024); Uzbekistan (1,700 →
4,478), Turkey (8,500 → 15,395) and Tajikistan (850 → 1,496) were entered well below their
constant-2015 GDP; Turkmenistan, Lebanon, Angola, Saudi Arabia and Azerbaijan move mainly through
governance. Ukraine falls because its 2024 GDP (2,226, wartime) is below the hand-entered 3,700.
Across all countries constant-2015 GDP is above the hand-entered figure for 95 of 128.

Legacy flow preset (`organic-incentive`); mean absolute change 1.08:

| id | country | before | after | change | archetype before → after |
|---|---|---|---|---|---|
| GUY | Guyana | 42.2 | 60.7 | +18.5 | developing-fragile |
| CYP | Cyprus | 60.7 | 65.2 | +4.5 | middle-stable |
| BHS | Bahamas | 62.1 | 66.1 | +4.0 | middle-stable |
| PRK | North Korea | 27.3 | 30.9 | +3.6 | failed-state |
| BHR | Bahrain | 54.4 | 57.9 | +3.5 | developing-fragile → middle-stable |
| KAZ | Kazakhstan | 42.2 | 45.4 | +3.2 | authoritarian → developing-fragile |
| TKM | Turkmenistan | 32.5 | 35.7 | +3.2 | failed-state |
| AZE | Azerbaijan | 36.9 | 40.1 | +3.2 | developing-fragile → authoritarian |
| FIN | Finland | 81.4 | 78.3 | −3.1 | rich-democracy |
| UZB | Uzbekistan | 35.0 | 37.9 | +2.9 | developing-fragile |

### Archetype changes

21 of 128 countries change archetype under the unchanged rule. Counts before: authoritarian 8,
developing-fragile 51, failed-state 17, middle-stable 31, rich-democracy 21. After: 13, 46, 18,
30, 21.

| id | before → after | GDP pc before → after | governance before → after |
|---|---|---|---|
| MEX | developing-fragile → authoritarian | 8,300 → 10,284 | 0.55 → 0.392 |
| HND | developing-fragile → failed-state | 2,400 → 2,575 | 0.38 → 0.337 |
| PAN | middle-stable → developing-fragile | 15,000 → 17,123 | 0.65 → 0.524 |
| TTO | middle-stable → developing-fragile | 15,000 → 16,312 | 0.62 → 0.521 |
| BRA | developing-fragile → authoritarian | 6,700 → 9,567 | 0.52 → 0.485 |
| COL | developing-fragile → authoritarian | 5,300 → 6,865 | 0.55 → 0.494 |
| PER | developing-fragile → authoritarian | 6,100 → 6,732 | 0.50 → 0.459 |
| BOL | developing-fragile → failed-state | 3,100 → 3,046 | 0.45 → 0.350 |
| PRY | developing-fragile → authoritarian | 5,400 → 6,671 | 0.50 → 0.419 |
| SUR | developing-fragile → authoritarian | 4,700 → 7,246 | 0.52 → 0.488 |
| BLR | failed-state → authoritarian | 6,400 → 6,814 | 0.28 → 0.377 |
| BGR | middle-stable → developing-fragile | 10,000 → 10,127 | 0.62 → 0.549 |
| CHN | authoritarian → developing-fragile | 12,500 → 13,119 | 0.45 → 0.597 |
| KOR | middle-stable → rich-democracy | 31,000 → 37,048 | 0.85 → 0.827 |
| KAZ | authoritarian → developing-fragile | 9,000 → 11,873 | 0.48 → 0.544 |
| KGZ | developing-fragile → failed-state | 1,100 → 1,424 | 0.45 → 0.343 |
| SAU | authoritarian → middle-stable | 20,000 → 25,123 | 0.48 → 0.699 |
| ISR | rich-democracy → middle-stable | 43,000 → 41,882 | 0.82 → 0.765 |
| BHR | developing-fragile → middle-stable | 23,000 → 25,886 | 0.58 → 0.644 |
| AZE | developing-fragile → authoritarian | 4,200 → 5,876 | 0.38 → 0.484 |
| AGO | failed-state → developing-fragile | 1,800 → 2,799 | 0.28 → 0.372 |

The archetype still sets cognitive employment share and natural unemployment in the macro block,
so these reclassifications change those two inputs for the countries listed. The archetype names
are legacy labels for capacity bands, not regime classifications.

## Findings

1. **The governance term of the wellbeing anchor nearly vanishes on sourced data.** Refitted on
   WGI institutional quality, the governance coefficient falls from 7.66 (± 2.97) to 1.83
   (± 3.09) and the income slope rises from 5.10 to 5.99; R² 0.651 → 0.644. The WGI composite
   explains little of the ladder beyond income. The hand-entered column carried more
   ladder-related signal than institutional quality does (for example it rated Latin American
   countries, whose ladder scores are high for their income, well above the WGI). Any future
   claim that "institutions buffer the transition" in the anchored model now rests on a
   coefficient indistinguishable from zero.
2. **The US's Korinek calibration hangs on a governance threshold.** Cognitive share 0.62 and
   natural unemployment 3.9% (Korinek et al. 2026, US) reach the US only through the
   `rich-democracy` archetype (governance ≥ 0.80). The US sits at 0.824 after the migration (0.82
   before): a margin of 0.024. Under the WGI nominal-range transform `(mean + 2.5)/5` it would have
   been 0.727, the US, UK, France, Belgium, Austria and Israel would have lost the archetype, and
   KJ-1 to KJ-3 would have failed (GDP boost 1.2 / 6.0 / 22.7% against 1.6 / 8.3 / 32.4). That was
   one reason for choosing a transform that keeps the engine's thresholds on their original scale
   (`data/countries/README.md`); the underlying defect is that sourced US labour-market inputs are
   attached by an unsourced governance cut-off. Recommended follow-up: source cognitive share and
   natural unemployment per country (ILO occupation and unemployment series) instead of by archetype.
3. **Monetary convention.** GDP is constant 2015 US$; corporate money is undated and not deflated.
   Transfer-to-income ratios may be overstated by up to ~29% if corporate figures are 2024 dollars.
   No headline moves by more than hundredths of a point from this at current fund sizes; it stays
   open until corporate money is sourced.
4. **Gini vintage is uneven.** 23 countries keep a hand-entered Gini (no survey 2014-2024), and 9
   observed values are from 2014-2018. The Gini enters the legacy flow model only (UBI damper,
   friction).
5. **The governance clamp at 1 binds for four countries** (Norway, Denmark, Finland,
   Luxembourg; WGI mean above 1.92). The hand-entered maximum was 0.98. In the legacy flow model
   their displacement friction `(1 − g)^1.5` becomes exactly 0; in the anchored model the effect is
   at most 1.83 × 0.02 index points. Disclosed, not changed.
6. **Stale references outside this migration's scope** (not edited here): `data/hindcast/README.md`
   (generated by `scripts/hindcast/fetch-actuals.ts`) still describes `constants.ts` GDP as nominal;
   `data/core/korinek-2026.json` labels its `gdpPerCapitaStart` 63,000 as "constants.ts
   INITIAL_COUNTRIES, USA" (the default is now 66,857; the core model's outcomes are relative, so
   its tests are unaffected).

## Snapshots re-locked

Each is re-locked deliberately and points here; none is an invariant, published target or case
expectation.

| test | value before → after | note |
|---|---|---|
| `simulation/pure.test.ts` 6-month regression | avg wellbeing 58.02616 → 59.04923; USA adoption 0.134639 → 0.135445; global fund unchanged | pinned per dataset (`PINNED`), legacy values kept |
| `simulation/pure.test.ts` constant-crash equation | US 42.5 → 45.7138 | starts from `gdp/1200 + 40`; pinned per dataset |
| `simulation/anchored.test.ts` formula initial wellbeing | US 92.5 → 95.7138 | legacy 92.5 asserted on `countries-legacy-v1` |
| `simulation/counterfactual.test.ts` reviewer's probe (US 92.472 after one month) | unchanged | now runs explicitly on `countries-legacy-v1`, the table the review measured |
| `simulation/appState.test.ts` old-format save replay | compares with a legacy replay | old saves now reopen on legacy (the intended behaviour) |
| `src/services/scenarioShare.test.ts` round trips | sample scenario carries `countryDataset` | plus tests for legacy links and unknown ids |

## Reproducing

```bash
npx tsx scripts/countries/compare-datasets.ts                 # every table above except hindcast/validate/cases
npm run profile:default -- --model=evidence-anchored          # after
COUNTRY_DATASET=countries-legacy-v1 npm run hindcast          # before, byte-identical to pre-migration output
COUNTRY_DATASET=countries-legacy-v1 npx vitest run            # all tests on the legacy table (pinned per dataset)
npx tsx scripts/countries/build-dataset.ts --force            # refetch (network)
```

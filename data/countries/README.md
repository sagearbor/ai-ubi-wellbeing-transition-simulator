# data/countries

Versioned country datasets for the world engine. Owner decision 4(b) of the independent review
(`docs/design/reviews/2026-09-14-v3-implementation-review-97f751d.md`): replace the hand-entered
country table through a versioned migration, keep the old dataset for existing scenarios, and
publish before/after results (`docs/design/research/country-data-migration.md`).

| Dataset id | File | Status | Used by |
|---|---|---|---|
| `countries-wb-2026-09` | `wb-2026-09.json` | sourced (World Bank WDI + WGI), per-value year and status | the app default and every CLI (`COUNTRY_DATASET_ID`) |
| `countries-legacy-v1` | `legacy-hand-entered.json` | hand-entered, unsourced; frozen verbatim from `constants.ts` `COUNTRY_BASE_DATA` at commit `bb85a92` | saves, autosaves, `#share=` and `#scenario=` links written before the migration (they carry no dataset id); `COUNTRY_DATASET=countries-legacy-v1` in Node |

`constants.ts` builds `INITIAL_COUNTRIES` from the selected dataset with `countriesForDataset(id)`;
the derived fields (`archetype`, `socialResilience = governance`, `corruption = 1 - governance`,
national policy) are recomputed with the unchanged rules. Every run stamps
`SimulationState.countryDataset`; the engine reads the world population and the wellbeing-anchor
coefficients of that dataset, so a legacy run replays bit-for-bit
(`COUNTRY_DATASET=countries-legacy-v1 npm run hindcast` etc. reproduce the pre-migration output
byte for byte; verified for profile, hindcast, validate and validate:cases on 2026-09-14).

Rebuild: `npx tsx scripts/countries/build-dataset.ts --force` (network; refuses to write on any
fetch failure). Before/after tables: `npx tsx scripts/countries/compare-datasets.ts`. Integrity
tests (stored values re-derived from recorded raw inputs, anchor refits, transform constants):
`scripts/countries/countryDatasets.test.ts`.

## File shape

```json
{
  "datasetId": "countries-wb-2026-09",
  "referenceYear": 2024,
  "windows": { "population": [2018, 2024], "...": [] },
  "sources": { "SP.POP.TOTL": { "name": "...", "url": "...", "lastUpdated": "...", "retrievedAt": "..." } },
  "conventions": { "population": "...", "gdpPerCapita": "...", "gini": "...", "governance": "...", "money": "..." },
  "governanceTransform": { "intercept": 0.5668, "slope": 0.2264, "...": "..." },
  "wellbeingAnchor": { "intercept": 2.877, "lnGdp": 5.991, "governance": 1.83, "fit": {}, "before": {} },
  "countries": [
    { "id": "USA", "name": "United States",
      "population":   { "value": 340.0038, "year": 2024, "source": "SP.POP.TOTL", "status": "observed", "raw": 340003797 },
      "gdpPerCapita": { "value": 66856.51, "year": 2024, "source": "NY.GDP.PCAP.KD", "status": "observed", "raw": 66856.5131698371, "currentUsd": 86169.66 },
      "gini":         { "value": 0.418, "year": 2024, "source": "SI.POV.GINI", "status": "observed", "raw": 41.8 },
      "governance":   { "value": 0.824, "year": 2024, "source": "WGI", "status": "observed", "components": { "GE": 1.3599787, "RL": 0.9617896, "CC": 1.0868914 } } }
  ]
}
```

`status` is one of
`observed` (from the named source, `year` set), `legacy-unsourced` (no observation in the window:
the frozen hand-entered value is kept, `year` null, `note` says why) or `missing` (no value at all:
the loader throws rather than defaulting; no country is in this state today).

## Conventions (decided before mapping)

### Base year and monetary convention

- **Reference year 2024.** Each value is the latest observation in its window, and the year is
  recorded per value. 2024 is the latest year the WGI publishes and the latest year with GDP for
  124 of the 128 countries; taking 2025 would have mixed 2025 and 2024 GDP across countries.
- **GDP per capita in constant 2015 US$ (`NY.GDP.PCAP.KD`).** The wellbeing anchor was fitted on
  exactly this series (`data/hindcast/gdp-per-capita.json`), so the anchor now receives the input
  it was estimated on. The legacy table was nominal, base year undocumented (roughly 2019-2021
  current US$), which the anchor silently treated as constant 2015 US$. Same-year current US$ is
  stored as `currentUsd` for reference; the engine never reads it.
- **All model money is read as constant 2015 US$.** Transfers are computed from corporate revenue
  (billions) divided by population, and compared with GDP-based income in the anchored model.
  Corporate market caps and AI revenue remain unsourced assumptions with no documented vintage;
  they are **not deflated** in this migration. For scale: the US GDP deflator rose 1.289x between
  2015 and 2024 (`NY.GDP.DEFL.ZS`, recorded in the file). If the corporate figures are read as
  2024 US$, every transfer-to-income ratio is overstated by about 29%; at current fund sizes the
  transfer term moves wellbeing by hundredths of a point, so this does not change any headline,
  but it is an open inconsistency until corporate money is sourced and dated.

### Windows

| Field | Indicator | Unit in the engine | Window | Missing in window |
|---|---|---|---|---|
| population | `SP.POP.TOTL` | millions (value / 1e6) | 2018-2024 | keep hand-entered, `legacy-unsourced` |
| gdpPerCapita | `NY.GDP.PCAP.KD` | constant 2015 US$ per person per year | 2018-2024 | keep hand-entered, `legacy-unsourced` (flagged: nominal, different convention) |
| gini | `SI.POV.GINI` | 0-1 (value / 100) | 2014-2024 (survey-based; up to ten years before the reference year) | keep hand-entered, `legacy-unsourced` |
| governance | WGI `GE.EST`, `RL.EST`, `CC.EST` (all three, same year) | 0-1, see below | 2018-2024 | keep hand-entered, `legacy-unsourced` (flagged: legacy scale) |

Nothing is imputed, interpolated or carried across countries. WGI publishes Taiwan as
"Taiwan, China" with an empty ISO3 code; that one record is mapped to `TWN` by name (the only
name-based match). North Korea (`PRK`) and Taiwan have no World Bank GDP; Taiwan has no World Bank
population or Gini.

### Governance

**What `governance` means as the engine uses it.** Every use, read from the code:

| Use | Where | What it needs governance to express |
|---|---|---|
| Displacement friction `40 (1 - g)^1.5 (1 + 0.5 gini)` | `simulation/pure.ts` Phase 4 (legacy flow model) | how well institutions buffer a labour-market shock (safety nets, retraining, administration) |
| `corruption = 1 - g`, `socialResilience = g` | `constants.ts` enrichment | leakage and institutional resilience (neither is read by the current engine's money flows; direct-to-wallet has no leakage) |
| `allowsDirectWallet = g > 0.40` | `simulation/run.ts` initial state; `constants.ts` national policy at 0.40 | whether the state can administer or tolerate direct payments |
| Archetypes: failed-state `g < 0.35`; authoritarian `g < 0.50` and GDP > 5,000; rich-democracy GDP >= 35,000 and `g >= 0.80`; middle-stable GDP >= 10,000 and `g >= 0.60` | `constants.ts` `getArchetype` | institutional capacity bands; the archetype then sets cognitive employment share and natural unemployment |
| Wellbeing anchor `a + b ln(gdp) + c g` | `simulation/pure.ts` `wellbeingAnchor` | the part of life evaluations associated with institutions beyond income |

So the engine's `governance` is **institutional quality: state capacity, rule of law and control of
corruption**. It is **not democracy** and not political freedom: nothing in the engine reads
voice, elections or civil liberties. The archetype labels "rich-democracy" and "authoritarian" are
legacy names for capacity bands, not regime classifications (Singapore is a "rich-democracy" and
Brazil an "authoritarian" archetype under the rule; neither label is a claim about the regime).

**Mapping.** Governance is built from the mean of three WGI estimates that measure exactly that
construct — Government Effectiveness, Rule of Law, Control of Corruption — all from the same year.
Voice and Accountability (democracy) and Political Stability (violence) are deliberately excluded,
and no single effectiveness rank is substituted for the composite.

```
governance = clamp(0.5668 + 0.2264 × mean(GE, RL, CC), 0, 1)
```

The WGI estimates are on a standard-normal scale (about −2.5 to +2.5). The two constants are a
fixed location-scale transform, not a per-country fit: they match the mean and standard deviation
of the WGI mean to those of the hand-entered column over the 128 countries both cover (WGI 2024
vintage, computed once on 2026-09-14 and then fixed; a later WGI vintage is mapped with the same
constants). Every country value and every ordering comes from the WGI; only the scale is inherited.

*Why not the WGI nominal range `(mean + 2.5) / 5`.* That transform sits on a different scale from the
one the engine's fixed constants were written for: its mean is 0.07 lower and its spread 12%
narrower than the hand-entered column. Applied through the unchanged archetype thresholds it
reclassified 47 of 128 countries, most of them because of the scale rather than the data (Mexico
became a "failed-state" at 0.346; the United States, United Kingdom and France left
"rich-democracy", which would have silently removed the Korinek US calibration from the US).
Changing the scale would have changed the meaning of five hard-coded constants at once. With the
location-scale transform, 21 countries change archetype, and each change is a case where the WGI
disagrees with the hand rating (for example China 0.45 → 0.60, Saudi Arabia 0.48 → 0.70, Mexico
0.55 → 0.39). An OLS fit of the hand column on the WGI mean was also considered and rejected: it
shrinks the spread toward the hand-entered mean (regression dilution) and so imports the hand
column's noise into the scale; it reclassifies 19 countries.

In WGI units the engine's thresholds now read: 0.35 ↔ −0.96, 0.40 ↔ −0.74, 0.50 ↔ −0.30,
0.60 ↔ +0.15, 0.80 ↔ +1.03 (recorded in the file as `engineThresholdsInWgiUnits`).

### Wellbeing anchor

The anchor coefficients were fitted on the OLD governance column, so they are refitted on the new
governance values over the same data (ladder × 10 on ln `NY.GDP.PCAP.KD` and governance,
2015/2020/2025, same 335 country-years; `scripts/countries/anchorFit.ts`). Each dataset carries its
own coefficients and the engine never mixes them: a run on `countries-legacy-v1` uses the old ones.

| Dataset | intercept | ln GDP | governance (± OLS s.e.) | R² | RMSE (index points) |
|---|---|---|---|---|---|
| `countries-legacy-v1` (pre-migration, reproduced exactly by the refit) | 7.454 | 5.103 | 7.658 (± 2.97) | 0.651 | 5.73 |
| `countries-wb-2026-09` | 2.877 | 5.991 | 1.830 (± 3.09) | 0.644 | 5.78 |

The fit is almost as good, but the governance term nearly disappears: the WGI composite explains
little of the ladder beyond income (its coefficient is within one standard error of zero; the
standard errors ignore that each country appears three times, so they are if anything too small).
The hand-entered column carried more ladder-related signal than institutional quality does —
consistent with its larger departures from the WGI for Latin American countries, whose ladder
scores are high relative to their institutions. This is a finding about the old column, not a
reason to keep it.

### Frozen legacy table

`legacy-hand-entered.json` is the verbatim `COUNTRY_BASE_DATA` array at commit `bb85a92` (128
countries, same order), with `status: legacy-unsourced` and `year: null` on every value, plus its
anchor coefficients. Refitting on it reproduces 7.454 / 5.103 / 7.658 (tested). It must never be
edited: saves and links from before the migration depend on it.

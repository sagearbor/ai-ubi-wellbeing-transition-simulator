# data/provenance

> **Status 2026-09-14: countries migrated.** Owner decision 4(b) replaced the hand-entered country
> table with the versioned, sourced dataset `countries-wb-2026-09` (`data/countries/`,
> `docs/design/research/country-data-migration.md`). The table audited below is frozen as
> `countries-legacy-v1` (`data/countries/legacy-hand-entered.json`) and is still used for saves and
> links made before the migration. The measured numbers in this file describe that legacy table;
> reproduce them with `COUNTRY_DATASET=countries-legacy-v1 npm run provenance:countries`. Run on
> the default dataset, the same report now shows population and Gini identical to the reference
> (median gap 1.00x and 0.0 points), governance Spearman ρ 0.973 against GE alone (the dataset uses
> the GE/RL/CC mean), and GDP per capita median gap 1.23x — a convention difference, not an error:
> the dataset is constant 2015 US$ (`NY.GDP.PCAP.KD`), this reference is current US$
> (`NY.GDP.PCAP.CD`). Corporations are unchanged and remain hand-entered.

Provenance and reference-data audit for the two hand-entered tables in
`constants.ts`: `COUNTRY_BASE_DATA` (~128 countries) and `INITIAL_CORPORATIONS`
(~79 corporations). Every number in those tables was hand-entered without a
recorded source or retrieval date. This directory does **not** change any of
those values — replacing them is an owner decision (they feed a pinned engine
and pinned regression tests) — it only measures how far they sit from an
independent reference, so that decision can be made with numbers instead of a
guess.

Regenerate the reference data and report with:

```bash
npm run provenance:fetch      # writes data/provenance/country-reference.json (World Bank API; network required)
npm run provenance:countries  # prints the markdown report below, from the selected country dataset + reference file
```

`country-reference.json` is idempotent (skips if present; `-- --force` to
refetch) and is checked into git so the report is reproducible offline. The
comparison logic is pure and unit-tested independent of the network:
`validation/countryProvenance.ts` / `validation/countryProvenance.test.ts`.

## Countries — field-by-field provenance

| field | meaning | current source | reference series checked against | measured agreement | candidate replacement source |
|---|---|---|---|---|---|
| `population` | Country population, millions | Hand-entered, unsourced, date unknown | World Bank `SP.POP.TOTL` (Population, total), latest available year 2018-2024 | 127/128 matched; median \|log ratio\| **0.054** (typical gap **1.06x**); worst: Syria 0.69x (civil-war-era undercount vs. 2024 UN estimate), Yemen 0.74x, Iceland 0.78x | World Bank WDI `SP.POP.TOTL` (already fetched here) |
| `gdpPerCapita` | GDP per capita, current US$ | Hand-entered, unsourced, base year not documented | World Bank `NY.GDP.PCAP.CD` (GDP per capita, current US$), latest available year 2018-2024 | 126/128 matched; median \|log ratio\| **0.304** (typical gap **1.36x** — much looser than population); worst: Guyana 0.30x (constants predates its oil-boom GDP more than doubling since ~2020), Kyrgyzstan 0.44x, Albania 0.46x | World Bank WDI `NY.GDP.PCAP.CD`, or `NY.GDP.PCAP.KD` (constant 2015 US$, already used by `data/hindcast/gdp-per-capita.json`) if a fixed base year is wanted instead of nominal |
| `gini` | Inequality, stored 0-1 (constants.ts convention; e.g. 0.39 = "39") | Hand-entered, unsourced, date unknown | World Bank `SI.POV.GINI` (Gini index, 0-100), latest available year 2018-2024; constants value × 100 for comparison | 99/128 matched (29 missing — WB Gini is survey-based and not published annually for most countries); median \|diff\| **1.7 Gini points**, mean **2.4 points** — the closest-agreeing field of the three ratio/diff fields; worst: Suriname +17.8 pts, Belize +13.1 pts, India +9.5 pts | World Bank WDI `SI.POV.GINI`, or WID.world (World Inequality Database) for a longer, model-based series where WB has gaps |
| `governance` | Institutional quality, 0-1 (also backs `socialResilience` and `corruption = 1 - governance`) | Hand-entered, unsourced, date unknown; not documented as any named index | Worldwide Governance Indicators, Government Effectiveness estimate (`GOV_WGI_GE.EST`, WB source=3), latest available year 2018-2024. **Not level-comparable** (constants is 0-1, WGI is ≈ -2.5..+2.5 standard-normal units with no fixed mapping), so scored by **Spearman rank correlation**, not ratio/diff | 127/128 matched; **Spearman ρ = 0.931** — strong overall rank agreement, but with real outliers: China (constants rank 35th of 128, WGI rank 95th — constants rates China's governance much lower than WGI's bureaucratic-effectiveness estimate does), Saudi Arabia (rank 42nd vs. 91st), Mongolia (71st vs. 33rd, opposite direction) | World Bank WGI (`GOV_WGI_GE.EST`, or `GOV_WGI_RL.EST` / `GOV_WGI_CC.EST` as used here for the fallback chain) if the intent is bureaucratic effectiveness; Polity5 or V-Dem if the intent is closer to "democratic institutions" |
| `id`, `name`, `archetype`, `socialResilience`, `corruption` | Identifiers / derived fields | `id`/`name` are standard ISO3 + country name (not audited — negligible error risk); `archetype`, `socialResilience`, `corruption` are computed *inside* `constants.ts` from `gdpPerCapita`/`governance`, so their provenance is inherited from those two fields above, not independently sourced | n/a | n/a | n/a |

Not every constants country has a reference match: **TWN (Taiwan)** has no
World Bank record under any of the four indicators (WB reports it as part of
China for most series) and **PRK (North Korea)** has no GDP-per-capita record.
Twenty-nine countries (mostly small islands, Gulf states and a few
authoritarian states — e.g. CUB, HTI, TTO, PRK, SGP, MMR, KHM, BRN) have no
recent Gini observation at all; this is a World Bank data-availability gap,
not a `constants.ts` error, and those countries are simply excluded from the
Gini comparison (see `missingFromReference` in the report).

## Corporations — field-by-field provenance

No reference series were fetched for corporations in this audit — company
financials/market data would need a different pipeline (SEC filings, Bloomberg/
Yahoo Finance-style market-cap feeds) than the World Bank macro API used for
countries, and several fields (AI-specific revenue, contribution policy) have
no public reference at all. This table records what *would* need sourcing and
what candidate source each field would use, so a future audit slice can follow
the same pattern as `scripts/provenance/fetch-country-reference.ts`.

| field | meaning | current source | reference series to check against | measured agreement | candidate replacement source |
|---|---|---|---|---|---|
| `id`, `name` | Identifiers | Hand-entered | n/a | n/a | n/a |
| `headquartersCountry` | ISO3 of HQ country | Hand-entered, unsourced, date unknown | Public company HQ address | Not measured in this audit | Company 10-K/annual-report filings, Wikipedia infobox, or a company database (Crunchbase, OpenCorporates) |
| `operatingCountries` | ISO3 list of markets/customers | Hand-entered, unsourced, date unknown | Company segment-reporting geographies | Not measured in this audit | 10-K geographic revenue breakdown (usually a coarser list than country-level, so this would need a documented mapping rule) |
| `marketCap` | Company size, billions USD | Hand-entered, unsourced, date unknown | Public market capitalization | Not measured in this audit — but unlike `aiRevenue`, this field **does** have a straightforward public reference (a market-data API snapshot) and would be the cheapest of the corporation fields to audit next | Market-data API (e.g. a stock-quote provider) snapshot, dated |
| `aiRevenue` | Revenue attributed to AI automation, billions USD | Hand-entered, unsourced, date unknown | **None public.** Companies do not uniformly disclose an "AI revenue" line item, and where they do (e.g. cloud AI-services revenue call-outs) the definitions are inconsistent across companies and years | Not measured — **must be marked assumed**, not sourced, even after a future audit slice, unless the model's definition of "AI revenue" is narrowed to a specific disclosed metric | No general source; at best, hand-curated per-company earnings-call/10-K call-outs where a company discloses *something* AI-labelled, with a documented, company-specific mapping to this field |
| `aiAdoptionLevel` | 0-1, "how automated" the company is | Hand-entered, unsourced, date unknown | **None public.** This is a modeling construct, not a disclosed metric | Not measured — assumed | No general source; would need a proxy (e.g. AI-related capex share, headcount-per-revenue trend) documented as a proxy, not a direct measurement |
| `contributionRate`, `distributionStrategy`, `policyStance`, `reputationScore` | UBI-contribution policy and game-theory state | Simulation policy inputs / initial conditions, not empirical measurements — the model's premise (see `CLAUDE.md`, "Corporation-Centric UBI") is that these are *chosen*, not observed | n/a — these describe a counterfactual policy the simulator is exploring, not the present-day world | n/a — not applicable to compare against real data | n/a (these are scenario/policy assumptions by design, not facts to source) |

## Measured numbers (from `npm run provenance:countries`, reference retrieved 2026-09-14)

Full detail (worst 10 per field, full missing-ID lists) is in the report
output — reproduce with `npm run provenance:countries`. Headline numbers:

| field | matched / total | headline statistic | worst 3 |
|---|---|---|---|
| population | 127/128 | median \|log ratio\| 0.054 (≈1.06x typical gap) | SYR 0.69x, YEM 0.74x, ISL 0.78x |
| gdpPerCapita | 126/128 | median \|log ratio\| 0.304 (≈1.36x typical gap) | GUY 0.30x, KGZ 0.44x, ALB 0.46x |
| gini | 99/128 | median \|diff\| 1.7 Gini points | SUR +17.8pt, BLZ +13.1pt, IND +9.5pt |
| governance | 127/128 | Spearman ρ = 0.931 | CHN rank gap -60, SAU rank gap -50, MNG rank gap +38 |

**Reading these numbers**: population and governance-ranking are close to the
reference; GDP per capita is the loosest of the four (median country is off by
~36%, consistent with `constants.ts` mixing years/vintages with no documented
base year); Gini has good agreement where WB has data but a third of countries
have no recent WB Gini at all. None of this implies the `constants.ts` values
are "wrong" — several of the worst offenders (Guyana's oil-boom GDP, Suriname's
small-sample-survey Gini, China's WGI-vs-intuitive governance gap) are cases
where the *reference* itself is the more surprising number. It does mean any
of these four fields could be refreshed from World Bank data with a documented
year and source. The owner decided to do so (decision 4(b), 2026-09-14); see the status note at the
top of this file.

## Reference data source blocks

`country-reference.json` records, per field:

```json
{
  "field": "population",
  "description": "...",
  "units": "...",
  "yearRangeRequested": [2018, 2024],
  "source": { "name": "...", "url": "...", "retrievedAt": "2026-09-14", "lastUpdated": "..." },
  "countryCount": 217,
  "data": { "USA": { "year": 2024, "value": 340003797 }, "...": {} }
}
```

- **population**: World Bank WDI `SP.POP.TOTL`
- **gdpPerCapita**: World Bank WDI `NY.GDP.PCAP.CD`
- **gini**: World Bank WDI `SI.POV.GINI`
- **governance**: World Bank Worldwide Governance Indicators, `GOV_WGI_GE.EST`
  (Government Effectiveness estimate; source=3). This succeeded on the first
  try, so the `RL.EST` / `CC.EST` fallbacks documented in
  `scripts/provenance/fetch-country-reference.ts` were not needed — the
  indicator actually used is always recorded in
  `country-reference.json`'s `fields.governance.source.indicatorUsed`, so a
  refetch that falls back is self-documenting.

Per-country value is the **latest available observation in 2018-2024** — not
a fixed year — because `constants.ts` documents no base year for any of these
fields. `yearRangeRequested` and each observation's own `year` are recorded so
a reader can judge vintage mismatch (e.g. Guyana's GDP-per-capita gap above is
largely a 2018-vs-2024 vintage effect, not a units error).

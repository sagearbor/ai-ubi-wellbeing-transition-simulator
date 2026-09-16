# Reported company financials: FY2025 collection v1

Collected and verified on 2026-09-15 against official company statements and SEC filings. The pinned observations are in `data/financials/fy2025-v1.json`; each record retains the source URL/title, exact fiscal dates, report date, retrieval date, line-item locator, signed reported value, and a short source excerpt. `reportDate` means the dated report/auditor signature (or Apple's earnings publication), not necessarily the SEC acceptance date. No aggregator figures are used.

## Coverage and interpretation

This is a first collection of six separately consolidated public parents: Apple, Microsoft, Alphabet, Amazon, Meta and NVIDIA. Group totals include consolidated subsidiaries worldwide; Google, AWS and other subsidiaries are not counted again. The list does not represent all AI companies. Private businesses and unverified subsidiary accounts are excluded. The entire company's cash flow is observed, not cash attributable to AI. Select one parent and one fiscal period: these six unlike periods must not be summed or presented as a common calendar-year total.

All financial observations remain nominal USD millions of their own fiscal period. There is no inflation adjustment, GDP ratio, stock-market-capitalization proxy or assumption that a statement balance is unused cash. The model converts financial input millions to dollars once. Population has a separate observation year.

## Pinned values

USD millions; investment and distributions are positive cash outflow magnitudes. Null means not separately verified in this collection, not zero. Cash-flow statement signs are retained in each evidence row.

| Company | Fiscal period, inclusive | Revenue | Net income | Operating cash | Investment deducted | Shareholder dividends | Repurchases |
|---|---|---:|---:|---:|---:|---:|---:|
| Apple | 2024-09-29–2025-09-27 | 416,161 | 112,010 | 111,482 | 12,715 | 15,421 | 90,711 |
| Microsoft | 2024-07-01–2025-06-30 | 281,724 | 101,832 | 136,162 | 64,551 | 24,082 | 18,420 |
| Alphabet | 2025-01-01–2025-12-31 | 402,836 | 132,170 | 164,713 | 91,447 | 10,049 | 45,709 |
| Amazon | 2025-01-01–2025-12-31 | 716,924 | 77,670 | 139,514 | 131,819 | null | null |
| Meta | 2025-01-01–2025-12-31 | 200,966 | 60,458 | 115,800 | 69,691 | 5,324 | 26,248 |
| NVIDIA | 2024-01-29–2025-01-26 | 130,497 | 72,880 | 64,089 | 3,236 | 834 | 33,706 |

## Source selection and review locators

- [Apple official FY2025 Q4 statements](https://www.apple.com/newsroom/pdfs/fy2025-q4/FY25_Q4_Consolidated_Financial_Statements.pdf), published 2025-10-30: PDF page1 annual income column and page3 annual cash-flow column. These company-issued condensed statements explicitly say **unaudited**; they are not represented as an audited annual report. The annual figures are used, never the adjacent quarter column. [Apple's contemporaneous SEC earnings filing](https://www.sec.gov/Archives/edgar/data/320193/000032019325000077/aapl-20251030.htm) confirms the publication date.
- [Microsoft 2025 Annual Report](https://www.microsoft.com/investor/reports/ar25/index.html), auditor report dated 2025-07-30: Income Statements and Cash Flows Statements, FY2025 column. Repurchases are the cash-flow item18,420, not the equity-accounting component5,856.
- [Alphabet FY2025 Form10-K](https://www.sec.gov/Archives/edgar/data/1652044/000165204426000018/goog-20251231.htm), dated 2026-02-04: Consolidated Statements of Income and Cash Flows, final FY2025 column. Cash repurchases45,709 differ from the equity-statement45,398; the former is retained.
- [Amazon FY2025 Form10-K](https://www.sec.gov/Archives/edgar/data/1018724/000101872426000004/amzn-20251231.htm), dated 2026-02-05: printed pages36–37. Gross cash PP&E purchases131,819 are used. The company's own free-cash-flow calculation deducts128,320 after netting3,499 of sales and incentives; this model does not make that netting adjustment. It therefore derives7,695, not Amazon's headline11,194. Dividend and repurchase fields are null because no separately verified cash item was retained.
- [Meta FY2025 Form10-K](https://www.sec.gov/Archives/edgar/data/1326801/000162828026003942/meta-20251231.htm), auditor dated 2026-01-28: income statement and printed cash-flow page92. Deducting cash purchases alone gives46,109; Meta additionally deducts2,524 of finance-lease principal to reach its own43,585 free-cash-flow measure. Cash repurchases26,248 differ from the equity-statement26,264.
- [NVIDIA FY2025 Form10-K](https://www.sec.gov/Archives/edgar/data/1045810/000104581025000023/nvda-20250126.htm), dated 2025-02-26: income statement and cash-flow printed page56. Its reported investment line combines property, equipment **and intangible assets**. We preserve that combined3,236 instead of guessing a pure-PP&E split. Principal payments129 are a separate financing line and excluded. The derived difference60,853 therefore differs from NVIDIA's free-cash-flow measure60,724. Its FY2025 ended in January2025, considerably earlier than the other records.

Official statements were successfully read through the web tool. A supplementary direct Python request to SEC failed because the shell environment could not resolve the host; the successful official SEC browser retrieval was the fallback. No failed retrieval was replaced with guessed financial values. Bounded excerpts and row locators are retained rather than copying entire reports. Refreshing this collection is a reviewed new data version, not a live network request during an experiment.

## Cash investment definition

The default definition is reported operating cash flow minus cash purchases/additions of property, plant and equipment. Cash acquisition payments, investment-security purchases, noncash lease-financed investment and separately presented finance-lease principal are excluded. NVIDIA's combined PP&E/intangible item is an explicit collection exception approved during implementation; the schema therefore uses `cashCapitalInvestment`, `cashCapitalInvestmentLabel` and `cashCapitalInvestmentNote`, not a falsely uniform PP&E name.

This difference is before existing shareholder dividends and buybacks. A proposed resident-payment/training allocation may redirect current uses; the difference is not idle cash, a legal distributability determination, or an observed AI-generated surplus. For negative differences, `source_cash_flow` remains negative and `allocatable_base = max(0, source_cash_flow)` is an explicit convention.

## Sourced recipient cohorts

`src/financials/cohorts.ts` pins the existing `data/countries/wb-2026-09.json` dataset and only its population field. All127 observed populations are supported with their existing country IDs, exact years and World Bank `SP.POP.TOTL` provenance. Taiwan (`TWN`) has only a `legacy-unsourced` value and is explicitly unavailable; no invented replacement is supplied. The exported unavailable list explains this omission.

Use the source's `raw` people, and derive exact millions as `raw / 1,000,000`. The old engine's population display is rounded: USA340.0038 million would imply340,003,800 people, whereas the sourced raw value is340,003,797 people in2024. The new model uses340,003,797. This is not a forecast of2025 or current residents and does not use working-age population, citizens, eligible adults or households. [World Bank population source](https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=20000&date=2018:2024), retrieved2026-09-14; observation year is explicit on every cohort.

## Executable arithmetic and limits

`createFinancialModel` returns ordinary `CoreModel` data executed by the existing engine, browser-worker executor and Lab bundle machinery. Time is one point, start=end=fiscalYear. All ten output variables have hooks disabled; policy changes belong in explicit parameters before the accounting and capacity limits.

1. Raw source cash flow = operating cash dollars − cash investment dollars.
2. Allocation ceiling = max(0, raw source cash flow).
3. Policy budget = ceiling × policy share.
4. Training budget = policy budget × training share; resident dividend spend = policy budget − training budget.
5. Completions = min(training budget / cost, instructor capacity, eligible trainees, resident population).
6. Actual training spend = completions × cost; unspent training = training budget − actual spend.
7. Placements = min(completions × placement rate, suitable openings).
8. Monthly dividend/person = annual resident dividend spend /12 /resident population.

Completions/placements are continuous expected counts, not rounded individuals. Eligibility, capacity, openings and cost are annual scenario assumptions, never reported company facts. The default is10% policy share and0% training; other assumed defaults are cost$5,000, capacity100,000, eligible trainees1,000,000, placement rate50%, openings50,000. Unused training funds remain visible and are not redirected. Gross placements are not causal job creation, net employment or wellbeing effects.

Shares outside[0,1], nonpositive costs, negative capacities/openings and missing/nonfinite required observations fail before compilation. Arithmetic exceeding floating-point representability fails explicitly; no arbitrary slider maximum silently clips a result. Executable invariants cover valid scenario inputs, spending conservation, source limits, capacities, resident/opening limits and per-person accounting. Accounting allows a1e-6 dollar absolute or1e-12 relative floating-point tolerance; this is not additional spending authority. Lab overlays cannot change pinned observations without an explicit structural fork because a pinned-observations invariant checks exact source and resident values.

Apple's example:111,482−12,715=98,767 million dollars;10% and0% training allocates9,876.7 million annually;9,876,700,000 /12 /340,003,797 = approximately$2.420732770 per resident per month.

## Verification

`npx vitest run src/financials/model.test.ts src/financials/catalog.test.ts` executes the existing worker's `lab-point` jobs and engine overlays. It covers the Apple example, zero policies/openings, capacity and eligibility binding, excess eligibility constrained by residents, negative source flow, nonfinite arithmetic, rejected scenario inputs, immutable reported parameters, post-limit effect rejection, all six model schemas, exact source values and resident provenance. `npm run typecheck` covers the exported integration contract.

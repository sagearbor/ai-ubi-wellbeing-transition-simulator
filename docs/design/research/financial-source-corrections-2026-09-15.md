# Financial source corrections — 15 September 2026

Original v1 observations must remain immutable for exact saved-link replay. A new collection revision may improve evidence and fill previously uncollected fields; its identity must be separate. No allocation equation or numerical scenario assumption changes are required.

## Apple

The audited [FY2025 Form 10-K](https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm), filed October 31, 2025, confirms all six retained figures. Printed page 29 reports sales 416,161 and net income 112,010; page 33 reports operating cash 111,482, property/plant/equipment cash outflow 12,715, dividends 15,421 and repurchases 90,711 (USD millions). The independent auditor's opinion on pages49–50 covers these statements. Switch the new revision's source URL/title/date and locators to the audited filing. Keep the original unaudited-release provenance in v1. The allocation base remains USD 98.767 billion.

## Amazon

The [FY2025 Form 10-K](https://www.sec.gov/Archives/edgar/data/1018724/000101872426000004/amzn-20251231.htm), Note 8 on printed page 62, expressly reports no common-stock repurchases in 2025. This supports replacing the previously uncollected repurchases field with0 in the new revision.

The complete audited stockholders' equity statement on printed page 40 shows retained earnings 172,866 at 2024 end plus FY2025 net income 77,670 equals ending retained earnings 250,536, with no dividend distribution row or other retained-earnings movement. The cash-flow statement on page 36 has no dividend payment. Zero dividends is a reconciliation from these statements, not a separately printed dividend cash-flow line. Record that derivation explicitly; do not describe an omitted line as a quoted zero. These shareholder-return fields do not enter the allocation calculation.

## NVIDIA

The pinned FY2025 report covers 2024-01-29 through2025-01-26. Label the earlier period in the selector, rather than silently substituting FY2026 under a FY2025 identifier. This retains the observed USD 64,089 million operating cash flow and the exact earlier saved experiment. The [original filing](https://www.sec.gov/Archives/edgar/data/1045810/000104581025000023/nvda-20250126.htm) remains the source. Newer reporting periods can be added as distinct records in future; the current collection is a dated selection, not a claim to contain each company's latest report.

## Regression contract

The six original v1 experiments were saved from the actual pre-revision runtime to `/private/tmp/financial-v1-experiments.json`. Use them as fixed replay fixtures, not regenerated expected values. Verify old and new collection identities, unknown/tampered identity refusal, all original numerical allocations, source links, and correction labels. Current UI and model-origin verification must agree on which collection an experiment actually uses.

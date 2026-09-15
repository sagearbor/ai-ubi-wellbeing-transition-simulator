# Published experience: verification and review disposition

2026-09-15. Tested production code: `3d8393d3dc96c5a01a35901525dfd29db6c33e2c`. Documentation and screenshots are committed separately afterwards.

## Result

The three implementation tasks passed independent task reviews. The one broad final review found two presentation defects; both were fixed in `3d8393d` and passed scoped rereview. No open findings from those bounded reviews. This is not a claim that all scientific or user-experience questions are solved.

Fresh final `npm run check`: **exit 0; 81 test files, 1,169 tests passed**, with typecheck, all configured anchor/Futures/Korinek/core/policy-case validators, reference ledger and production build. The expected no-root fixture remains an expected failure, not an empirical success. Historical artifact regeneration/freshness runs within this test gate. The complete earlier gate at `5dc2c8d` also passed (1,155 tests); the additional 14 tests cover the final provenance fix.

No changes against `8c65b9e` to `package.json`, lockfile, `src/core`, `simulation`, existing country observations, published model targets or qualification evidence were needed. The new history artifact records existing outputs without re-fitting. The new allocation executes through the generic worker.

## Real-browser checks performed by the controller

| Probe | Observed result |
|---|---|
| Apple 10%, US, cash only | $2.42 per resident/month; exact underlying target $2.420732770032369 tested through the worker |
| Edit A to 20%, leave B at 10% with 20% training | A $4.84; B $1.94, $500 million training spent and $1.48 billion unspent at display precision |
| Navigate History and back | Both edits and results preserved |
| Copy link and open in a separate browser | Same A/B inputs and outputs |
| Exact B model link | Opens new Lab tab with matching authored model and B values; original experiment tab remains |
| Exact Lab reported observations after final fix | 111482000000, 12715000000 and 340003797 in actual DOM; read-only, with Apple/World Bank source links; seven editable assumptions |
| Amazon selection | 139514m − 131819m = 7695m annual base; 20% cash allocation displays $0.38/month |
| Training share 100%, instructor capacity 3, job openings 0 | Three completions, zero gross placements, unspent money remains visible |
| Real JSON download, switch company, upload saved file | Restored Amazon, both policies and B's edited capacity/openings |
| Unsupported share version; malformed finance hash with Lab route | Explicit error; no financial result substituted; unrelated hidden mounted Lab is not presented as a recovered experiment |
| Historical UI | Actual/model/persistence graph, USA endpoint 68.16 vs 70.81, country/metric/run controls, 106-country cohort and exclusions visible; GDP selector exercised |
| Production preview | Fresh default and history graph render from built assets; new favicon loads |
| Responsive | 1440×900 desktop and 390×844 mobile; light and dark; document width equals viewport width |
| Accessibility, final production Explore | axe 4.12.1 WCAG 2 A/AA: 0 violations, 0 incomplete checks; this is an automated page scan, not full accessibility certification |
| Browser JavaScript errors | None observed in tested routes |

Exact worker cancellation/semantic-failure gates, malformed/pinned share cases, legacy hash ownership and mounted Lab policy lifecycle also have passing automated tests. Not every legacy journey was manually replayed in this turn. Live Gemini extraction and public Cloud Run deployed revision are **not verified**. No API key was copied into this checkout or production build.

An automatic approval check temporarily rejected one local-browser probe because its reviewer model was at capacity. After confirming the command only read our isolated localhost page, the same probe was retried successfully. No action remains blocked and no permission control was bypassed.

## Review findings and disposition

1. **Historical GDP wording:** common country growth applies to AI-off, not AI-on. Fixed in `56d738b`, scoped rereview approved. No output values changed.
2. **Lab provenance:** generic missing-kind fallback called three published observations assumptions and offered edits that the invariant refused. Fixed in `3d8393d`: recognize the exact normalized authored model and unchanged current values, show reported/source/read-only fields, count seven assumptions. Tampered/unrecognized models retain the generic fallback. No source or core enum changes.
3. **Allocation accessibility:** labeled generic divs lacked a group role. Fixed in `3d8393d`; final production scan confirms no incomplete rule.

Source review verified original statement rows for all six companies, including NVIDIA's combined equipment/intangible purchase and Meta's separate lease principal. The historical reviewer recomputed all 30 source hashes and the cohort/error arithmetic. Review reports are retained in [independent reviews](published-experience/independent-reviews.md); passing review is not a substitute for reproducing the checks.

## Build and screenshots

Production entry: `/assets/index-D90Y7vzJ.js`. SHA-256: `21c2f3351976982834ab612dcb9c93f378c825ded89507ad51ef3e33c95d7f0f`. Local preview port 4185 serves this build. Source changes after the tested commit are documentation/screenshots only; the public Cloud Run app was not deployed.

- [Desktop entry](published-experience/desktop.png)
- [Editable allocation](published-experience/allocation.png)
- [Historical graph](published-experience/history.png)
- [Mobile](published-experience/mobile.png)
- [Mobile dark mode](published-experience/mobile-dark.png)

The chart makes a limitation visible: this historical model barely improves on persistence for the headline wellbeing error. Same-span fitting, missing shocks and later data vintages prevent calling that forecast validation. The new financial calculation demonstrates source-grounded accounting and explicit assumptions; economy-wide and wellbeing impacts still require defensible mechanisms and independent evidence.

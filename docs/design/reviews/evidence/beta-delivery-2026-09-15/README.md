# Actual browser evidence for the beta follow-up

These artifacts record specific executions, not deployment or scientific validation. Source was `a315438` for the first financial/UI checks. Numerical runtime was core-0.3.0 with mathjs 15.1.0 (`numericalHash=df347a35887760b1`), before the security patch. The later patched runtime is expected to refuse this old experiment's numerical pin. Retain the capture unchanged; do not relabel it as a patched-runtime result.

- `financial-v2-prepatch-browser.json`: downloaded through the actual Compare page after editing Apple scenario A to policy share 20%, training share 25%. B remained policy share 10%, training share 20%. This is a source-bound experiment, not an empirical observation of the proposed transfers.
- `financial-mobile-axe.json`: actual axe 4.12.1 WCAG 2 A/AA check on the revised published page, 390×844 dark viewport. Zero violations and zero incomplete checks. This is an automated page check, not a complete accessibility certification.

Browser interaction checked the following at `a315438`:

1. Default Apple links to the audited FY2025 SEC filing. Its unchanged financial difference is USD 98.767 billion; default resident payment is USD 2.42 per month.
2. Editing A to 20% policy and 25% training, then following **Paste a policy**, opens a new tab with that exact A model, its app-built illustrative label and policy section focus. DOM input values are exactly 111482000000 operating cash, 12715000000 cash investment, 340003797 residents, 0.2 policy share and 0.25 training share. Browser accessibility-tree float32 display rounding is not used as a numerical oracle.
3. Typed source text survives Explore → Model Lab navigation in the same mounted app. Scenario B's separate link gives 0.1 policy share and 0.2 training share.
4. Amazon v2 displays shareholder dividends as **derived**, USD 0.00, with the full retained-earnings reconciliation; repurchases are **reported**, USD 0.00, citing Note 8.
5. Opening the original captured Apple v1 experiment retains its original Apple earnings-release URL, original collection and 10% policy share. Editing company to NVIDIA and cohort to GBR retains v1 in the visible source and tool-link payload. NVIDIA's exact period end is 2025-01-26.
6. **Inspect uncertainty** opens the exact NVIDIA/GBR model and honestly shows deterministic uncertainty off; no ranges are invented.
7. At 390 pixels the four primary navigation labels share one row; document width equals viewport width. The beta notice and feedback link are visible. The period is shown in full below the company selector even when the native select truncates its selected label.

8. A financial file with a tampered `dataHash` is visibly refused: “The current experiment was not replaced.” The existing Apple/default 10% controls remain unchanged.
9. **Add a variable** opens the exact Apple scenario, selects `entry=author`, and focuses `lab-jump-author`. Original Amazon v1 still says “Not collected; not assumed zero” for both shareholder fields.

A browser wait for the accessibility label “Model Lab tools” timed out because it is not visible body text. The loaded page was inspected directly afterward; that test-driver wait is not counted as an application failure or success.

Later security/runtime checks and final validation are recorded in the parent beta delivery report when performed.

## Patched-runtime browser checks

Built from `10142e8`, then accounting activation at `e399b4f`; these policy/financial checks use core-0.3.0 + mathjs 15.2.0 (`numericalHash=0dc3f0cefbc98688`).

- `policy-patched-manual.bundle.json`: actual new manual draft, not a repinned old bundle. The automated author is an agent; no human review or completeness attestation is claimed. One quoted funding provision maps 20 million USD to 20,000,000 USD exactly once; a second provision records national unemployment and catastrophic AI-risk targets as outside-model. Two quoted clauses do not automatically establish operative-disposition completeness; the run is explicitly partial.
- Reopening this bundle through the UI independently reran and reproduced **all 288 stored values with largest deviation zero**, using 200 paired draws and seed 1. The first-changed-year action selected 2026. Spread is labeled as assumption draws, not confidence or forecast probability.
- `policy-invalid-quote.json` and `policy-conflicting-setters.json`: the invented 200-million quote and conflicting 20/30-million setters each disable run/export and hide stale results. The valid saved bundle was restored afterward.
- `candidate-patched-ai-failure.txt`: actual real-provider retry on the patched candidate; website restriction still blocks extraction, with safe message, preserved 200-character source and working manual recovery. No successful live extraction is claimed.
- `financial-patched-browser.json`: same actual edited Apple A/B as the prepatch capture; a field-by-field comparison changes **only** numericalHash. The app does not silently change the old saved file.
- `old-policy-runtime-refusal.txt` and `old-financial-runtime-refusal.json`: old real files are explicitly refused. The financial error states the current experiment was not replaced; its policy share stays at 10%.
- Downloading the full evaluation from the patched History page reproduces the committed current `experience.json` exactly after JSON parsing. `history-mobile-axe.json` records zero violations and one incomplete color-contrast check: two horizontally clipped aggregate-table cells have obscured backgrounds. This is recorded as incomplete, not a failed or passed contrast measurement.
- `policy-mobile-axe-before.json` identified invalid tablist children in the existing Draft A/B selector. That real finding led to `941c8c4`; its final browser rerun is recorded below when complete.

## Final accessibility repair

At `941c8c4`, the draft controls use a labeled native button group with pressed states. `policy-mobile-axe-after.json` records **zero violations and zero incomplete checks** for the Policy panel at 390×844. The actual Tab/Enter/Space check selects A then B, exposes exactly one pressed button and excludes Add/Remove actions from the selector group (`draft-keyboard.json`). Reopening the actual patched policy bundle again reproduced all 288 values exactly before this selector check.

Final `npm run check` on Node 22 after this code change passed **1,257 tests in 90 files**, all included validators, ledger status checks and production build. This is not a claim that all scientific targets are reproduced: the ledger retains four misses, and the known AT-3 directional failure remains visible.

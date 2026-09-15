# Policy evidence and evaluation follow-up — 15 September 2026

Status: implemented and independently reviewed on `codex/policy-evidence-readiness`. Final UI correction: `cb29ab2`. PR20 remains unchanged at `a064c2c676b2158afea7705e0e9a31668adbd642`; its GitHub CI passed. No deployment or merge in this follow-up.

## What the historical test actually found

The protocol was committed at `0b06312` before fitting or scoring. Fit only 2015–2018, start from 2018 observations, and evaluate 2019–2025 without refitting or injecting later observations. Use the existing full anchored level engine with AI and corporate transfers off. The optional frozen calibration input does not change default execution. All prior published observations, target values and default coefficients remain unchanged.

The first untuned wellbeing result is worse than persistence: model mean absolute error 0.3175333128080816 ladder points versus 0.2897439060205584. There are 681 observed country-years out of 700 for the fixed 100-country origin cohort. GDP cumulative-growth error is 7.511377553252149 percentage points versus persistence 8.6499816020173, over 691 observed country-years out of 700. Missing values do not become zero errors; missing endpoints do not remove earlier observations.

This is a retrospective temporal holdout, not an independently blinded forecast or a forecast archived in 2018. The model form was chosen after these years were known, and historical data use revised 2026 vintages. It does not test the financial allocation model, the current conditional world default, or disabled AI, transfer and training effects. Passing integrity tests does not make the poorer wellbeing forecast successful.

## Independent numerical review

Task1 implemented at `6b25ac2`, then fixed at `afbeaa5`. Independent review reproduced the fitting with a separate QR calculation, the monthly trajectories, scoring, all pre-seam default output hashes and exact historical report equality. It found two packaging defects: omitted fitter source identity and acceptance of mutually inconsistent prediction/score artifacts. Both were fixed; the original altered-prediction probe now fails before overwriting the UI artifact. Frozen protocol, fit, cohort, predictions and scores stayed byte-identical during these repairs.

Node22 and Node26 each passed 40 targeted evaluation/engine tests and the historical reconstruction checker; typecheck passed. The integration checks are recorded below; GitHub CI is reported on the follow-up PR. The subsequent accounting refresh passed all 383 cases and received independent numerical review; see `2026-09-15-policy-evidence-qualification-review.md`.

## Live AI and policy workflow

Actual public-site AI calls used `gemini-3.6-flash` and synthetic text only. A 20 million USD annual training budget mapped correctly. Adding a national unemployment target and elimination of catastrophic AI risk produced one mapped budget and two outside-model provisions, with no invented response coefficient. These public bundles identify core-0.2.0; the public deployment commit was not verified.

The candidate made a real request with its configured app credential. Google returned HTTP403 `API_KEY_HTTP_REFERRER_BLOCKED` for `http://127.0.0.1:4187/`. No restriction was weakened or spoofed. Successful live AI extraction in this candidate remains **not verified** unless an authorized development credential or preview origin is supplied and the end-to-end test is completed.

Candidate core-0.3.0 manual recovery worked: an invented quotation blocked running; a corrected quotation with 20 million USD converted once to 20,000,000 USD and produced a 200-draw paired comparison. This establishes execution under model assumptions, not empirical support for the policy response. Stable browser verification reproduced all 288 bundle values with largest deviation zero. Author-kind edits invalidate the current result until rerun; the final bundle identifies the actual automated author as an agent, with no human-review or completeness attestation. The actual candidate provider failure is shown as a plain website-permission message, preserves the 200-character source, and permits a manual draft.

Real browser bundles and provenance are in `docs/design/reviews/evidence/policy-evidence-2026-09-15/`. Public live tests and candidate manual tests are separately labeled.

## Integration verification and release scope

- `npm run check` at `69a420f`: 1,210 tests in 86 files, validators, reference ledger and production build passed. The known AT-3 failure remains a recorded miss; expected market-no-root XFAIL remains explicit. A green software gate is not a claim that all scientific targets pass.
- `11e6841`: selected-draft wording regression, held-out presentation tests, typecheck and build passed. Final independent integration review passed 41 focused tests and checked 44 source plus nine artifact hashes.
- `cb29ab2`: mobile browser testing found wide held-out tables were not keyboard focusable. All three new table containers now have keyboard focus, accessible names and existing visible focus styling. Three targeted tests and typecheck passed; the browser rerun is recorded in the evidence index.
- Fresh accounting qualification at `698ba61`: all 383 unchanged scenarios passed; independent recomputation accepted only the exact 61 default monthly accounting identities. Macro and wellbeing remain illustrative.
- Actual stable-browser probes: invented 200-million quotation against the 20-million source and conflicting 20/30-million setters both disabled running and exporting current results. The earlier valid bundle replayed all 288 values exactly. The chronological first-changed-year action selected 2026, without selecting the largest result.
- Actual history checks: US annual values match the packaged artifact; DR Congo's missing 2020/2021 observations remain unscored and break the observed graph line. GDP levels say constant-2015 US dollars; GDP errors use cumulative growth percentage points. Downloaded evaluation JSON equals the checked-in package exactly. All five old reconstruction variants remain available.
- Actual financial regression: Apple reported operating cash flow of USD 111.482 billion less USD 12.715 billion cash property/plant/equipment purchases still gives the USD 98.767 billion annual difference. The default 10% US resident allocation still displays USD 2.42 per person per month. These are financial arithmetic and a hypothetical allocation, not an AI-profit or causal wellbeing estimate.

Successful candidate live extraction remains **not verified** until an existing authorized origin/key configuration is supplied. The browser-side key architecture is the owner's accepted decision; this review does not introduce a gateway requirement. The actual website restriction still prevents completing the release smoke test. Public live successes, parser tests and manual runs are not substitutes.

The historical weakness also remains substantive: the first frozen wellbeing test underperforms persistence. There is no honest code change that can convert a proposal into an evidence-backed causal prediction without appropriate data and research. This branch is suitable for research review and bounded scenario exploration; it is not established as a reliable economic forecasting or policy-advice product.


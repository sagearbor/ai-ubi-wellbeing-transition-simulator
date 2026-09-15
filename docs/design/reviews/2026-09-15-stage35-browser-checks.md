# Browser checks for the stage 3/5 fixes

These are automated browser checks, not a first-time human usability study. Public production was inspected separately; no deployment was performed.

## Task 3, e622b10 plus documentation (2b50d51)

Local Vite app: `http://127.0.0.1:4173/?tab=lab`, isolated Chromium session `stage35-local`. No Gemini key was present in this local build; no live extraction call was made.

- Loaded the actual S. 3877 worked example. The page separately reported quotation coverage (79/79 clauses) and operative dispositions (79/79 assigned, 68 unresolved). It explicitly called the scenario partial and said unsupported effects are not zero effects.
- Clicked **Run paired comparison**. The result appeared, with bundle and memo download controls enabled. Clicked **Download bundle**; download action returned successfully. File contents/reopening were independently covered by code probes; the browser download destination was not inspected in this check.
- Generated an exported training model package from actual `buildModelExport`, changed only its engine declaration to `core-0.1.0`, then uploaded it through the actual model-file input. The page refused it: “This package cannot replay: engine core-0.1.0 is incompatible with core-0.3.0.”
- Checked **Import incompatible package as source for a NEW experimental run (not replay)** and clicked **Validate and load**. The picker and result displayed **experimental — not curated**; limited links were disabled for the imported model. The Lab started a new local model run after this explicit action. It did not claim reproduction of the incompatible package.
- The default completeness-attestation statement still describes quotation/exclusion coverage. Task 6 should make the wording explicitly require operative-clause review as well.

Full local `npm run check` passed at this code: 935 tests across 56 files, all numerical validators, ledger check and production build. Log: `/private/tmp/stage35-task3-full-check.log`. This does not constitute final release verification after later changes.

An axe WCAG 2 A/AA automated audit of the imported-model Lab state found one violation type with two nodes: interactive Hint buttons nested inside the Import and Model file disclosure summaries. One contrast check was incomplete because the parameter-assumption label overlapped another element. Captured in `/private/tmp/stage35-lab-a11y-before.json`; queued for the guided interface work. This is a baseline scan, not accessibility certification.

## Custom-overlay replay, 50fb8a9 plus documentation (0c2bcf1)

Generated a real complete bundle with the training fixture, an `external-edit` overlay increasing the first parameter by one, two paired draws and the test source text. Uploaded it through **Open a bundle** in the actual browser. The page displayed **Experimental scenario — not curated. Base model: known fixture.** and reported all 288 stored values reproduced with largest deviation zero. No alert appeared. This verifies the React restoration path for a new structured-provenance bundle; older warning-only provenance was separately found by the reviewer to require a migration fix.

## Legacy source-import provenance, 5ff80f9

Generated the previous supported bundle shape: compatible numerical manifest, no structured `provenance`, and the old `importWarnings` source-import marker. Uploaded through the actual bundle file input. The page displayed **Experimental scenario — not curated. Base model: known fixture.** and all 288 stored values reproduced with largest deviation zero. No alert appeared. Thus the compatibility intake preserves the experimental label as well as numerical reproducibility.

## Conditional world, 51fd31a

Fresh isolated browser `stage35-world`, `http://127.0.0.1:4173/`, default conditional model at month zero.

- Verified compact map no longer displays unsupported cooperation, race-risk, virtuous-cycle or crisis zeroes, and no longer advertises market pressure/default corporate adaptation controls. The main scope description now states fixed requests and source limits.
- Opened Corporations, selected Apple, switched Request type to Monthly amount. Requested 12.1875 billion constant-2015 USD/month: available24.375, funded12.1875, unfunded0, unused12.1875. Requested36.5625: available24.375, funded24.375, unfunded12.1875, unused0. The current contribution display updated immediately.
- The dormant10% contribution slider/column remains visible alongside amount mode. Code inspection clarified that moving the slider switches back to share mode; it is not ignored, but the current display is misleading. Independent review requested exclusive controls and correct amount-based ranking/columns.
- Global map dividend0.25417647855428593 is specifically the equal global-pool route, not all transfer receipts. Backend sourceAccounting actual/receipts are25.74225625 billion/month, while global-only pool is1.891925 billion. The existing tooltip makes this distinction; Task6 should name it directly at the value, and guided flow must use its declared aggregate or selected-corporation scope.

These checks do not accept the numerical/import issues independently found in the Task4 review. Those remain in the fix loop before completion.

## Task4 fix round1 browser check — 4bee00c

Charts at month0 renders the conditional-index point (13 chart dots in DOM across charts); no displacement-gap/crisis panel or waiting overlay appears. Caption states same economic conditions and zero funded transfers, and that the difference is not net welfare. Remaining scatter wording (correlation "may need tuning", unlabeled unweighted mean) is assigned to Task6.

Frozen build served locally on4175 avoids Vite reloads during source changes. Apple explicit amount36.5625 shows available24.3750/funded24.3750/unfunded12.1875/unused0.0000; dormant percent slider is absent, directory shows active amount and ranks Apple first by24.4B funded. Escape dismisses detail. Mouse close is obstructed by main header at1280px; assigned Task6. Share generation/copy works and states snapshot/history limits. Full copied link could not be read through browser clipboard permission, so browser reopen not verified in this check (direct round-trip tests remain separate evidence).

## Task5 browser/runtime identity probe —05cbcd1

Imported the actual Vite-served constants, run and qualification modules into HeadlessChrome153, constructed the same default as the offline harness, and compared every month0–60 with the committed baseline identities. Only15/61 matched. A complete Node-versus-browser recursive comparison found165 numeric differences, all in derived illustrative wellbeing:80income,80raw,3transfer,1population-weighted raw and1headline value. Maximum absolute difference1.4210854715202004e-14. No actual input, macro, accounting, or nonnumeric field differed. At month0 Hungary raw was62.18932324044608 in Node and62.18932324044607 in Chrome. This exposes an exact-hash qualification design defect; it does not indicate a meaningful economic result difference. Assigned Task5 fix round after independent review.

### Frozen-build attribution correction

The4175 frozen copy was initially labeled4bee00c from the nearby build/commit report. A later Charts check exposes an older literal caption absent from4bee00c source, so that frozen build's exact source SHA is **not verified**. Treat its funding/navigation/accessibility observations as an intermediate Task4 build, not final-commit proof. Earlier Vite checks and source/test review remain separately attributed. Final comparison previews must be rebuilt from clean, recorded commits after functional integration.

In that intermediate build, loading/running S.3877 then visiting Charts displays the unrelated world chart (explicit world label), and returning via More→Model Lab loses the source/draft/result: policy textarea length0 and no Download bundle action. Task6 addresses this concrete navigation failure.

## Qualification input identity — fix41ca252

Actual Chrome153 on the Vite development app at4173 reproduced all61 baseline month identities in the regenerated evidence manifest. No derived-output checks failed. Executing-source hash was950d3fb43937e507c4a2cf67599c92105430a320c337712851a5067a28f3291e. This resolves the earlier46 browser identity misses without rounding actual inputs. The local record is still pending independent re-review, and the resolver correctly remains unreviewed for the pending-record reasons; this is not yet a positive accepted-badge browser test.

## Activated qualification —562582a

Actual Chrome153/Vite now accepts all61 exact default monthly points for conditional source/allocation accounting. Every macro/wellbeing classification remains illustrative. Independent probes for corporate money+1e-10, workforce+1e-12, importedUnverified, uploaded equations and raw derived output+0.01 each return unreviewed. The executing source hash remains950d3fb43937e507c4a2cf67599c92105430a320c337712851a5067a28f3291e. Raw browser output is preserved as evidence/overnight-2026-09-15/browser-accepted-562582a.json. This tests the runtime resolver; Task6 still owns visible active-view status integration.

## Task6 fixed production build e529c73

Frozen preview4176 uses index-E_4oBZ9s.js (SHA256d109dbeca8421be6a2a2c30e7670ee850459be6922a3b60fd2d4a31f1c1f7069); committed application files were clean at capture. LiveVite editing later reset drafts via development refresh, so subsequent round trips use this fixed build.

- Actual S.3877 A bundle downloaded through UI:107062bytes, SHA25609a7a3128644399c40eff2ab876f7589dca14a0405212c2122c6f59f963ac026. Source16182characters retained. Reopened through actual file input:288storedvalues reproduced, largestdeviation0. Operative68unresolved now explicitly appears beside results.
- An unrun B displays its own empty state and no A values. Two full S.3877 drafts exceed120000linkpayloadlimit (129963characters): explicit refusal directs to bundle. This is not counted as successful link sharing.
- A small synthetic two-draft link (1695characters, policyDraft=B) reopens B, sourceLength0, explicit source/operativecoverageunknown and no-mapped-effects structuralcomparison warning. Download remains available after its new computation.
- Real Futures link with actualagi slider1.25, ai-dividend-fund selected and2035year restores all3visiblecontrols despite conflicting?tab=lab. Invalid#futures=badshowsownererrorandwithholdsopenedresults. Empty#scenario=showsvisibleempty-share-payloaderror. Invalid#share=badshowsownererrorandzero visiblecharts.

Browser evidence here verifies these concrete routes, not arbitrary sources, every race schedule or live external AI extraction. Controlled callback race tests and their independent review are separately attributed.

### Final Task 6 world and link checks, fixed production build e529c73

- Actual Apple monthly amount request changed to 40 billion constant-2015 USD. Browser reports available 24.3750, requested 40.0000, funded 24.3750, unfunded 15.6250 and unused 0.0000. This is a modeled source limit, not evidence of available corporate profits.
- Corporation panel close works at desktop and 390×844 after waiting for the resulting React render. A first batch checked state before render and prematurely attempted sharing; it was repeated with state checks and passed.
- Actual generated world share is 356,537 characters. It opened in a fresh Chromium session, retained Apple's amount request 40 and funded 24.375, and showed accounting as an unreviewed scenario point. No URL delivery through email/chat or arbitrary browsers was verified; the large link is a usability limitation and file export remains the practical fallback.
- Invalid world share shows an explicit failure and no visible result charts. Empty equation share shows “Cannot open this equation scenario: empty share payload.” A valid equation share opened the editor with the actual “Reviewer equation scenario” name, then cleared the parsed hash. Changing the hash while already mounted to an empty equation share also produced the correct explicit error.
- Actual Futures link uses the registered `agi` node at 1.25, `ai-dividend-fund` intervention and year 2035. Browser controls restored those values even with a conflicting `?tab=lab`. Invalid Futures input refused to open the calculation. Hidden world controls in the DOM are not evidence of a rendered Futures result.

Evidence: [world limit](evidence/overnight-2026-09-15/world-limit-e529c73.json), [reopened world status](evidence/overnight-2026-09-15/world-reopened-e529c73.json), [reopened request](evidence/overnight-2026-09-15/world-reopened-request-e529c73.json). Full generated world URLs stay in temporary local evidence rather than adding a redundant 356KB payload to Git.

Optional provider-backed AI extraction was not verified against a live key. Manual/example policy execution, actual bundle download/reopen and small selected-B links were verified separately above.

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

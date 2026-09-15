# Live policy probes — 15 September 2026

These are actual browser-generated bundles from the existing public deployment at https://wellbeing-transition-simulator-6icr7acugq-uw.a.run.app/?tab=lab, using synthetic source text only. No mock AI client was used. The manifest identifies core 0.2.0; the public deployment commit was not verified. They are NOT evidence of a successful live extraction in the new core 0.3.0 candidate.

- `public-live-supported.bundle.json`: 20 million USD annual training funding, one mapped provision, real gemini-3.6-flash extraction, 200 paired draws, seed 1. Budget converted once to 20,000,000 USD. 2026 responds; 2029 matches baseline because both budgets are 20 million in 2029. Human review/completeness not fabricated.
- `public-live-partial.bundle.json`: same budget plus a national unemployment target and elimination of catastrophic AI risk. Real AI returned one mapped funding provision and two outside-model provisions. The computed training outputs do not estimate those outside effects. Unreviewed status retained.

Candidate browser at http://127.0.0.1:4187/?tab=lab made a real extraction request with the same configured app credential. Google returned 403, reason API_KEY_HTTP_REFERRER_BLOCKED. The website restriction was not altered or spoofed. The user was asked whether an existing development credential/configuration or approved preview origin is available. Successful candidate live extraction remains not verified. Credentials stayed in a gitignored `.env.local` with file mode 0600, never in these artifacts.

Candidate manual fallback opened after the provider failure. An invented quotation (“The programme shall provide 200 million USD.”) triggered quote-not-found and disabled running. The stable final-build conflict test also blocked 20-million/30-million setters after unit conversion, disabling both running and bundle export.

Browser-generated quantiles are conditional on the model and declared parameter ranges. Their presence proves software execution, not a causal effect or forecast accuracy. Bundles retain exact source text, model identity, conversions, review status, manifests and result values for inspection.

`candidate-manual.bundle.json` is the final actual browser export: core-0.3.0, training model hash `165637cc75ea55a1`, 200 paired draws, seed 1. In 2026, median paired changes were 1,720.9031 completions, USD 8,604,515.50 spending, USD 5,395,484.50 unspent funding, and 375.0677 gross placements. Reopening it reproduced all 288 stored values with largest deviation zero.

An earlier local manual probe inherited `kind: person` from the original UI's implicit default. That was incorrect metadata for an automated probe. The final UI provides an author-kind selector. The retained final browser export identifies `kind: agent`, name `Codex automated workflow probe`, review status `ai-drafted`, with no completeness attestation. This export was produced by correcting the actual UI and rerunning, not by hand-editing results. Changing the author hid stale results until the rerun.

`candidate-final-conflict.txt` records the actual disabled controls and conflict diagnostic. `candidate-final-ai-failure.txt` contains the sanitized site-permission message and preserved source. No credential/provider project identifier is included. Final history screenshots and accessibility outcomes are recorded alongside these files.

At cb29ab2 the mobile 390×844 dark-mode held-out view has no page overflow (body/root both390px), and axe4.12.1 WCAG2A/AA reports zero violations and zero incomplete checks with detail tables collapsed. Earlier axe found inaccessible overflow containers; the fix makes all three named regions keyboard focusable. The expanded-table keyboard check is recorded separately when completed.

Expanded annual table at cb29ab2: keyboard ArrowRight advanced its scrollLeft from0 to5 while it held focus with a solid outline. Axe reported zero violations; one color-contrast check remained incomplete because horizontally clipped cells were partially obscured. This is not a claim of a complete manual accessibility certification.

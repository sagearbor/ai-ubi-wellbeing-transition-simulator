# Overnight interface comparison evidence

`historical-public.png` is the previously captured public first visit at https://wellbeing-transition-simulator-6icr7acugq-uw.a.run.app/ . Image dimensions are 1280 × 633. The deployed Git commit was **not verified**. This is historical visual context; it is not the matched-core baseline for the interface experiment.

The functional-fix baseline and improved-interface captures will be recorded separately with exact commits, viewport, theme and scenario settings. An interface comparison must use the same model/data/settings; numerical changes must not be presented as a visual-design improvement.

The historical screenshot's original filesystem timestamp was 2026-09-15 02:49:58 EDT. It depicts the older public interface; no deployment or public-state change was made during capture.

## Legacy path comparisons

`legacy-compare.mjs` compares all existing scalar leaves in organic and anchored 121-state runs and the 61-state US reference run. Current tested implementation:4bee00c (coordinator docs-only6e3b9e7 followed).

- Against7ce0687, immediately before conditional-world work: zero differences across1,806,103 existing leaves; additive metadata recorded separately.
- Against436a16e: organic/anchored identical;1,479 tiny US-reference numeric differences from the earlier solver repair. Maximum absolute difference1.964508555829525e-9 (GDP dollars/person), maximum relative difference1.7248202801528315e-11. The separate scaled-difference metric uses max(1,abs(before),abs(after)); it is not relative error. No structural differences.

These are finite scenario comparisons, not a proof for all legacy inputs. The harness exits nonzero on structural differences; numeric differences remain explicit in the JSON and require interpretation. No reference targets or tolerances were changed.

`original-probes-6e3b9e7.jsonl`: original reviewer probe source run against the current core; correct endpoint accepted, discontinuity/pole rejected, protected completion effect rejected, draw identities distinct, conflicting policy setters rejected,20million units execute, through/effect ordering and initial dependency pass. This logs behavior; it is not a substitute for assertions in the maintained regression suite. `lab-a11y-4bee00c.json` is an explicit-URL frozen-build axe audit;2 violation types (6contrast nodes and2nested interactive nodes), assigned interface work.

Independent Task5 reviewer programs/results retain the exact05cbcd1 artifact review. Their filesystem paths reflect this workspace; adjust paths when rerunning elsewhere. They independently recompute sources, allocations, raw mappings and USA macro recurrence; see the qualification review for fixed tolerances and scope. The accepted arithmetic does not yet approve the qualification trust boundary or browser identity.

Correction: file lab-a11y-4bee00c.json preserves its original filename, but its4175 frozen build exact source SHA is not verified; a later caption comparison shows it is an intermediate Task4 build. Use it as issue-discovery evidence only. Final browser proof will use clean-commit rebuilt assets.

Independent fix41ca252 evidence is retained separately as independent-profile-rereview.py/output.json and qualification-vite-rereview.ts.txt. The latter is an audit script preserved as text, not a compiled application module; copy to a .ts scratch file before rerunning with its stated workspace paths. The regenerated artifact has compressed SHA2564c59f2189699ffcf78e7846c7dacd833150a0ed975a6aa8cdf75b9cfe629bea5 and payload058ec0443bf0b28616b97805a86da8a2652d96ff5ae39c98219bd1ffbb58e084. See the scoped re-review for actual source identity, tolerances and exact-point acceptance scope. browser-qualification-41ca252.json records the root's actual Chrome61-state result; the authority record was still pending at that check, so it is not a positive activated-status claim.

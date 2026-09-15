# Policy evidence follow-up — Claude Code handoff

This follow-up is on `codex/policy-evidence-readiness`, based on the preserved published-data candidate `a064c2c676b2158afea7705e0e9a31668adbd642`. PR20 remains the earlier comparison. No main merge or public deployment has occurred in this follow-up.

## Review scope

The change adds a preregistered temporal holdout through the existing anchored level engine, repairs provenance packaging, refreshes source-bound accounting qualification, and makes historical performance and policy evidence boundaries visible. Original observations, published targets, default fitted coefficients and financial allocation arithmetic remain unchanged.

Read [current verification](reviews/2026-09-15-policy-evidence-readiness.md), [held-out research disclosure](../research/2026-09-15-level-temporal-holdout.md), [independent numerical review](reviews/2026-09-15-level-holdout-independent-review.md), and [fresh accounting review](reviews/2026-09-15-policy-evidence-qualification-review.md). Verify the code and artifacts rather than treating these reports as proof.

Held-out performance is retained in `data/evaluation/level-holdout-2018/scores.json`; it is not converted into a reproduced-target success in the older reference-target ledger.

The first untuned wellbeing error is worse than persistence: 0.317533 versus 0.289744 ladder points. Do not refit or change exclusions, split, horizon or scoring to make this particular test win. Better future models require separately declared evaluation, not a rewritten result. This test is retrospective with revised vintages and post-period model choices, not blinded external validation or evidence for disabled policy channels.

## Local verification

Use a separate checkout so ongoing work is preserved. These commands run from that checkout's terminal, after selecting the branch and installing Node22:

```sh
npm ci
npm run check
node --import tsx scripts/hindcast/export-experience.ts --check
npx vitest run scripts/evaluation/holdout.test.ts scripts/evaluation/packaging.test.ts
npm run dev -- --host 127.0.0.1 --port 4187 --strictPort
```

Open `http://127.0.0.1:4187/`; Check against history exposes the held-out test and reconstruction separately. Model Lab contains the policy-text workflow. Preserve published finance A/B links, model/import provenance and the current-result/stale-result protections.

Actual public-site AI calls worked for synthetic annual funding and unsupported-effect probes. The new candidate's real request was refused by Google's website restriction for localhost. Do not treat those public successes, parser mocks, or manual runs as a successful live candidate extraction. An existing authorized development key or preview address is needed to complete that release smoke test; do not spoof the origin or silently change key restrictions. Credentials belong only in ignored local configuration, never in commits, screenshots or logs.

The retained browser artifacts distinguish public core-0.2.0 live extraction from candidate core-0.3.0 manual execution. Proposed funding can be quoted and mapped; the source does not establish employment/wellbeing response coefficients. Unresolved/outside-model effects are unavailable, not measured zeros. Parameter-draw spreads are not empirical confidence intervals.

## Suggested prompt

Review the `codex/policy-evidence-readiness` follow-up against `a064c2c` and the full candidate against main. Start at README's review table and docs/design/policy-evidence-handoff.md. Independently run the software checks; inspect train/test separation, source identity and the untuned worse-than-persistence wellbeing result. Exercise historical views, policy settings/assumptions/unsupported effects, author identity, invalid-quote/conflicting-setter refusal, worker execution and bundle/share replay. Verify actual AI extraction on an authorized preview origin before calling that release check complete. Keep corporate published inputs and all original scientific targets unchanged. Report concrete defects and production-scope limits. Do not merge or deploy during the review.

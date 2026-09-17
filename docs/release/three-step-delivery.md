# Three-step delivery: research beta, expert review, publication

The public site is https://wellbeing-transition-simulator-6icr7acugq-uw.a.run.app/. GitHub `main`, the public deployment and expert/publication readiness are separate states. The [17 September execution record](2026-09-17-release-verification.md) records exactly what was checked. A merge does not deploy Cloud Run.

## 1. Release a bounded research beta

### Public contract

Explore selected companies’ reported cash flow and editable allocations; compare assumptions; import model families; inspect annual forecast evidence; and translate policy text into a checked draft against the selected model. Results are conditional scenarios. The software is not a demonstrated causal policy predictor. Annual outcome tests remain separate, and weak or losing results stay visible.

### Build and verify the source

Use Node 22 (`.nvmrc`). In the release checkout:

```sh
npm ci
npm run check
node --import tsx scripts/history/export-annual.ts --check
node --import tsx scripts/hindcast/export-experience.ts --check
node --import tsx scripts/evaluation/run.ts package
```

Do not modify or rescore frozen evaluation files. The History exporter only transforms saved outputs. Any numerical/source-qualification change must pass its existing freshness and independent review requirements. Older numerical-runtime bundles must fail explicitly rather than silently producing different results.

### Identified preview, promotion and rollback

Requirements: authenticated Google Cloud CLI with access to project `gen-lang-client-0281141814`, region `us-west1`, existing service `wellbeing-transition-simulator`; an ignored `.env.local` with the owner-authorized Gemini key; and a clean committed checkout. The tool does not create services, change access policies or accept uncommitted sources.

From the release checkout terminal:

```sh
npm run deploy
```

The command archives committed Git bytes, adds the existing ignored build configuration and a commit marker, and deploys a uniquely named preview revision with no public traffic. It records the prior named traffic split and candidate in a JSON receipt under `tmp/releases/`. Keep the receipt: it is the rollback record. A failed preview is not a successful deployment; inspect Cloud Run before retrying it.

The deployed UI displays its embedded build commit. `/release.json` describes that same build; missing identities return 404 rather than a single-page fallback. The checker verifies an exact clean commit, its HTML entry and every emitted JavaScript/CSS chunk. It does not verify AI extraction, usability or scientific correctness.

These commands require values printed by the actual preview operation. **Unverified examples: substitute the real values before running; do not paste placeholders.**

```sh
node --import tsx scripts/release-check.ts https://ACTUAL_PREVIEW_ORIGIN FULL_EXPECTED_COMMIT
npm run deploy:promote -- tmp/releases/ACTUAL_RECEIPT.json
node --import tsx scripts/release-check.ts https://wellbeing-transition-simulator-6icr7acugq-uw.a.run.app FULL_EXPECTED_COMMIT
npm run deploy -- --rollback tmp/releases/ACTUAL_RECEIPT.json
```

Complete the browser gate below before promotion. Promotion rechecks candidate identity and traffic, assigns the explicit candidate revision and verifies the public identity. Rollback restores the recorded named revision percentages, including splits; it refuses an unrelated intervening deployment. An interrupted promotion retains recovery state. If prior traffic is already intact, rollback verifies that state without writing. These guards do not lock out simultaneous operators: coordinate releases, and inspect service state after any failure. Never use `--to-latest` as a substitute for an identified revision.

The browser key may reject a tagged preview origin. That is an access configuration issue: use an authorized origin or have the owner configure an appropriate preview restriction. Do not spoof referrers, relax restrictions silently, or treat an earlier public-site success as verification of the new candidate. Credentials must never appear in commands, logs or reports.

### Browser and live-AI gate

On the exact identified candidate:

1. Explore → Apple → Paste a policy. Enter **“Set the policy share to 20 percent. This must eliminate catastrophic AI risk.”** Confirm `policy_share = 0.2`, source quotes preserved, risk claim outside the model, draft still AI-authored/unreviewed, and comparison visibly partial.
2. Run the comparison. With the untouched default Apple/resident inputs, the monthly equivalent moves from approximately USD 2.420733 to USD 4.841466. This is allocation arithmetic, not measured policy impact.
3. Download the bundle and reopen it in a fresh tab. Confirm source text, experimental-model status, unsupported clause, exact numeric replay and absence of fabricated human completeness attestation. Financial imported-model links stay disabled; the bundle carries the model.
4. Select the training fixture. Enter **“Set the training budget to 20 million USD each year.”** Confirm each curve value becomes 20,000,000 USD; capacity/openings can bind and money can remain unspent.
5. Confirm provider failures keep the pasted text and offer manual drafting. Inspect safe error messages, not raw provider payloads.
6. History: switch country/outcome/method, inspect China’s missing annual wellbeing years and isolated 2025 forecast, use the year slider with a keyboard, and revisit the earlier Held-out test and Historical reconstruction. Check phone layout without horizontal page overflow.
7. After promotion, repeat the public identity and supported/unsupported policy/bundle checks. Record the exact commit and revision. Do not claim final-candidate AI verification from local mocked tests or another deployed version.

### Operations and cost controls

No account settings are claimed configured unless their values were inspected. Read current Cloud Run state and recent server errors from the authenticated release terminal:

```sh
gcloud run services describe wellbeing-transition-simulator --project gen-lang-client-0281141814 --region us-west1 --format='yaml(status.url,status.latestReadyRevisionName,status.traffic)'
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="wellbeing-transition-simulator" AND severity>=ERROR' --project gen-lang-client-0281141814 --limit=20 --freshness=24h --format='table(timestamp,severity,textPayload)'
```

Treat cloud logs as potentially sensitive; inspect locally and redact before sharing. Cloud Run HTTP health does not measure Gemini availability or errors in a browser. Use the identified release checker for static availability and a synthetic browser extraction for provider availability; maintain an operator contact and record any monitoring/alert recipient configured. No monitoring subscription or notification destination is silently created by this release.

The owner accepts the browser-side key. The app’s ten-extraction session limit resets on reload and **does not enforce a spending cap**. In Google AI Studio, inspect this project’s usage tier, model quotas and spend cap, and record the actual configured values privately. Google documents optional project spend caps with delayed enforcement, so costs can exceed the cap during that delay. Alerts-only budgets do not stop spending. Configure owner-chosen limits before broad promotion; this repository does not assert an uninspected dollar amount. [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), [project spend caps and delay](https://ai.google.dev/gemini-api/docs/billing#project-spend-caps), [Google Cloud budget types](https://docs.cloud.google.com/billing/docs/how-to/budgets).

### First-time usability

Use the complete [15-minute newcomer task sheet and observation form](newcomer-test.md) with 3–5 real people. Record assisted completions and mistaken interpretations. Agent and automated browser checks are separate engineering evidence. Fix repeated confusion about assumptions, prediction or causality before promoting beyond a research beta.

## 2. Ask experts specific questions

The draft pack is [expert-review-pack.md](expert-review-pack.md). Send only after the candidate is accessible and the operator verifies the exact release. Include a reproducible bundle, model card, reference ledger and the specific equation/evidence question. These messages are drafts; nobody has been contacted by this work.

Request criticism and missing mechanisms, not endorsement. Treat replies as evidence with scope and attribution. Obtain permission before publishing private correspondence. A faithful paper port, a historical reproduction, and a successful prediction are different checks; retain separate records for each.

## 3. Archive and pursue publication

MIT licensing and CITATION.cff enable reuse and citation; they do not establish journal eligibility. Before archiving, finalize the human author list/affiliations, third-party distribution notices and data reuse conditions. The current citation uses a contributor-group name and deliberately has no unassigned DOI or fictitious release date.

[GitHub's archive guidance](https://docs.github.com/en/repositories/archiving-a-github-repository/referencing-and-citing-content) describes enabling Zenodo and archiving a release. Confirm that the archive was created and its DOI resolves to the correct version before updating citation metadata. [Zenodo's release guide](https://help.zenodo.org/docs/github/archive-software/github-upload/) documents checking archival status and failures. Linking accounts and granting access need the owner's action; these have not been performed.

[JOSS's current requirements](https://joss.readthedocs.io/en/latest/submitting.html) include substantial research software, demonstrated research use, sustained public development, good open-source practices, and a feature-complete package. They require more than six months of public development with active iteration. Repository creation was 2025-12-21, but its historical visibility and satisfaction of the full editorial criteria have not been independently established. Having tests and a license does not mean the journal will accept it. Disclose material AI assistance and human oversight under [JOSS policy](https://joss.readthedocs.io/en/latest/policies.html).

A methods preprint can document architecture, reproducibility, model-family limits, the failed wellbeing benchmark and the research agenda. The [methods outline](methods-outline.md) avoids claiming findings the evidence does not support. arXiv may require [endorsement](https://info.arxiv.org/help/endorsement.html) for a category; availability of an endorser and submission eligibility are not verified. A scientific-results paper needs an actual validated research question and findings, not just a polished interface.

## Gates that require external evidence

- Identified final-candidate Cloud Run deployment, live extraction and real rollback verification.
- Observed cloud monitoring and Gemini quota/spend-cap configuration.
- Actual newcomer sessions and independent domain-expert feedback.
- Human authorship, archive metadata, third-party distribution review, research use and publication eligibility for steps 2–3.

Expert feedback, archival DOI and journal acceptance are not prerequisites for publishing an honestly labeled research beta. They are prerequisites for the corresponding later claims. Software tests cannot manufacture that evidence.

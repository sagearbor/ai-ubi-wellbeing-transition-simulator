# Three-step delivery: research beta, expert review, publication

This is a release preparation record, not a claim that a beta has been deployed, experts contacted, or a journal submission accepted. The current public site is https://wellbeing-transition-simulator-6icr7acugq-uw.a.run.app/. Until the reviewed branch is merged and deployed, that URL does not establish that it runs these changes.

## 1. Release a bounded research beta

### Intended public contract

Explore a transparent allocation of selected companies' reported cash flow; compare assumptions; import model families; inspect limitations and reproducible historical tests; and translate a policy into a checked draft against the selected model. Outputs are conditional scenarios. The software is not a demonstrated causal policy predictor. The first frozen historical wellbeing test performs worse than persistence, and that result remains visible.

### Merge and build

PR #19 precedes PR #20; this follow-up is based on PR #20. Review the complete stack against current main and rerun CI on the resulting merge, rather than assuming individual green branches prove the combined deployment. Confirm the final reviewed commit before merging. GitHub PRs are review artifacts; no one should approve their own work by impersonating an independent reviewer.

Use Node 22 and run, in the release checkout:

```sh
npm ci
npm run check
node --import tsx scripts/hindcast/export-experience.ts --check
node --import tsx scripts/evaluation/run.ts package
```

The packaging check must succeed without changing frozen predictions, observations or scores. Record the final commit, engine version, data collection identities, CI URL and deployed revision in the release notes. Keep original dataset versions to reproduce old shares.

### Deployment and real AI gate

The existing deployment script targets Google Cloud Run and defaults to a tagged revision with no public traffic. It needs an authenticated `gcloud` installation and an owner-authorized key in ignored `.env.local`. This review environment has no `gcloud` executable, so deployment commands below are prepared, not executed here.

On the configured release computer, inspect the current revision first:

```sh
gcloud run services describe wellbeing-transition-simulator --project gen-lang-client-0281141814 --region us-west1 --format='yaml(status.url,status.latestReadyRevisionName,status.traffic)'
```

After reviewing the exact checkout, a tagged candidate is created by:

```sh
DEPLOY_TAG=research-beta npm run deploy
```

Do not promote it until actual candidate tests pass. The existing browser key rejects localhost. A tagged URL may also be outside its allowed origins: confirm an authorized preview address/key with the operator. Do not spoof a referrer or weaken restrictions. A previous success on the old public application is not the new release's smoke test. Browser-side credentials remain the owner's accepted architecture; avoid putting the key in commands, logs, issues or screenshots.

Use synthetic text: “Set the policy share to 20 percent.” Start from the current Apple financial experiment through Paste a policy, confirm its exact reported-allocation model, extract, inspect quoted text and mapped setting, run the worker, compare the allocation and reopen the saved bundle. Then add “This must eliminate catastrophic AI risk” and verify the unsupported effect is disclosed rather than assigned a made-up coefficient. Also test the training fixture's “20 million USD each year” conversion and provider-failure/manual recovery. Preserve draft authorship and do not fake human completeness attestation.

Promotion and rollback are operator actions. Promote only the explicit verified revision, never an uninspected “latest”; use the prior traffic revision recorded above for rollback. Substituting revision names is required, so these examples are **unverified commands**:

```sh
gcloud run services update-traffic wellbeing-transition-simulator --project gen-lang-client-0281141814 --region us-west1 --to-revisions=VERIFIED_CANDIDATE_REVISION=100
gcloud run services update-traffic wellbeing-transition-simulator --project gen-lang-client-0281141814 --region us-west1 --to-revisions=RECORDED_PREVIOUS_REVISION=100
```

After promotion, repeat the supported/unsupported live AI and bundle smoke test on the public domain, confirm the research-beta notice and feedback link, and check the reported deployment identity. Never advertise live extraction as verified before that test succeeds.

### First-time usability gate

Observe 3–5 people individually for approximately 15 minutes, without coaching. Ask them to (1) explain what Apple's USD 2.42 monthly figure does and does not mean, (2) change a funding split and identify why more money may stay unspent, (3) paste a policy and find the assumptions/unsupported effects, and (4) decide whether the history test demonstrates accurate predictions. Record task completion, wrong interpretations and points of hesitation; do not invent success rates. Fix misunderstandings that turn assumptions into facts before promoting beyond beta.

## 2. Ask experts specific questions

The draft pack is [expert-review-pack.md](expert-review-pack.md). Send only after the candidate is accessible and the operator verifies the exact release. Include a reproducible bundle, model card, reference ledger and the specific equation/evidence question. These messages are drafts; nobody has been contacted by this work.

Request criticism and missing mechanisms, not endorsement. Treat replies as evidence with scope and attribution. Obtain permission before publishing private correspondence. A faithful paper port, a historical reproduction, and a successful prediction are different checks; retain separate records for each.

## 3. Archive and pursue publication

MIT licensing and CITATION.cff enable reuse and citation; they do not establish journal eligibility. Before archiving, finalize the human author list/affiliations, third-party distribution notices and data reuse conditions. The current citation uses a contributor-group name and deliberately has no unassigned DOI or fictitious release date.

[GitHub's archive guidance](https://docs.github.com/en/repositories/archiving-a-github-repository/referencing-and-citing-content) describes enabling Zenodo and archiving a release. Confirm that the archive was created and its DOI resolves to the correct version before updating citation metadata. [Zenodo's release guide](https://help.zenodo.org/docs/github/archive-software/github-upload/) documents checking archival status and failures. Linking accounts and granting access need the owner's action; these have not been performed.

[JOSS's current requirements](https://joss.readthedocs.io/en/latest/submitting.html) include substantial research software, demonstrated research use, sustained public development, good open-source practices, and a feature-complete package. They require more than six months of public development with active iteration. Repository creation was 2025-12-21, but its historical visibility and satisfaction of the full editorial criteria have not been independently established. Having tests and a license does not mean the journal will accept it. Disclose material AI assistance and human oversight under [JOSS policy](https://joss.readthedocs.io/en/latest/policies.html).

A methods preprint can document architecture, reproducibility, model-family limits, the failed wellbeing benchmark and the research agenda. The [methods outline](methods-outline.md) avoids claiming findings the evidence does not support. arXiv may require [endorsement](https://info.arxiv.org/help/endorsement.html) for a category; availability of an endorser and submission eligibility are not verified. A scientific-results paper needs an actual validated research question and findings, not just a polished interface.

## Current unresolved gates

- Successful live extraction on the exact new candidate/deployed origin.
- Merged-release CI and actual Cloud Run deployment/rollback verification.
- Observed first-time user feedback and independent domain-expert feedback.
- Final human authorship, archive metadata, data/dependency distribution review, actual research use and publication eligibility.

These require external actions or evidence. They cannot be truthfully marked complete by adding code or changing labels.

# Contributing

Use GitHub issues for reproducible defects, evidence corrections and capability requests. Do not post API keys, private proposal text, personal contact details or unpublished participant data. General feedback can be submitted at https://github.com/sagearbor/ai-ubi-wellbeing-transition-simulator/issues/new.

## Local development

Use Node.js 22 and run `npm ci`, then `npm run check`. Start the app with `npm run dev`. AI is optional for numerical models and manual policy drafts. For live AI, put an authorized development key in ignored `.env.local`; do not commit it or work around its website restrictions.

## Changes and evidence

Make changes on a branch and open a pull request. State the concrete problem, resulting behavior, tests run, and any changed assumptions or evidence. Add tests for meaningful regressions and numerical invariants. For a model, include equations, units, timing, sources, supported question, omitted mechanisms, and independent numerical comparisons. An AI-generated mapping is a draft, not human review or empirical evidence.

Published targets, frozen evaluations, source records, exclusions and snapshot identities are not adjustable to make a failing model pass. A corrected dataset or changed model needs a new version, provenance, and explicit replay behavior. Preserve existing observations and report misses. Avoid changing unrelated models or silently copying trust labels to imports.

## Review and maintenance

The repository maintainer makes merge and release decisions. Automated reviewers can assist, but they are not independent human experts or co-authors of scientific claims. Contributors remain responsible for code, evidence, attribution and any AI-assisted material they submit. Disclose material AI assistance in the pull request.

Support is best effort; there is no promised response time. Confirm the exact release/commit and attach a minimal synthetic reproduction or non-sensitive exported bundle when reporting a problem. Security-related reports should avoid putting exploitable secrets in a public issue; use GitHub's private vulnerability reporting if enabled, otherwise ask the maintainer for a private channel without including the secret.

Original contributions are offered under the project's MIT license unless an explicit compatible third-party notice applies. Preserve upstream notices and cite data/model sources. See THIRD_PARTY_NOTICES.md.

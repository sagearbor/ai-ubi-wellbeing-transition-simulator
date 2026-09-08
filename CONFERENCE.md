# Conference Panel Planning

This snapshot marks the version of the simulator being shared with collaborators
as a starting point for planning a conference panel presentation.

## Live Demo

https://wellbeing-transition-simulator-808228086396.us-west1.run.app

Note (September 2026): the service at that URL is the original Google AI Studio
"applet" export from December 2025 (project `gen-lang-client-0281141814`,
region `us-west1`, service `wellbeing-transition-simulator`). It predates the
corporation panel, game-theory dashboard, custom models and leaderboard that are
on `main`. To bring it up to date, deploy from this repo:

```bash
npm run deploy           # tagged, no-traffic preview revision
npm run deploy:promote   # send traffic to the new revision
```

See README "Deploy (Cloud Run)" for details.

A no-traffic preview revision built from `main` (2026-09-07, revision
`wellbeing-transition-simulator-00007-tof`) is available at:

https://main---wellbeing-transition-simulator-6icr7acugq-uw.a.run.app

To make it the public site:

```bash
gcloud run services update-traffic wellbeing-transition-simulator \
  --project gen-lang-client-0281141814 --region us-west1 --to-latest
```

## Date

February 2026 (snapshot branch: `release/conference-v1`)

# AI Futures Map v1 — turning on the expert and public tiers

Ten steps, about ten minutes, all in the browser except steps 6-7. Until step 6 is done the app
behaves exactly as it does today: the Expert and Public tier buttons stay disabled ("coming soon"),
`createStore()` returns the localStorage store, and the `firebase` SDK is never downloaded — it
lives in its own chunk that is only fetched when the flag is on.

**The flag** is the presence of all four `VITE_FIREBASE_*` variables at build time
(`src/futures/store.ts` → `isCloudConfigured()`). Any one missing or blank = off.

Everything below targets the project the deploy script already uses:
`gen-lang-client-0281141814`, region `us-west1`.

> **Status 2026-09-11:** steps 1 to 8 are DONE (provisioned from the CLI and REST APIs, not the
> console): Firebase added, Firestore `(default)` native in `us-west1`, anonymous + email-link
> sign-in on (the project was upgraded to Identity Platform to enable providers via API; free tier),
> authorised domains set for localhost and both Cloud Run hostnames, web app `futures-map`
> registered, `VITE_FIREBASE_*` in `.env.local`, rules deployed, experts seeded for the two owner
> addresses. The public path (anonymous vote → Firestore) was verified end to end. Step 9 (nightly
> cron secret) and App Check for the public tier remain owner decisions; `npm run futures:aggregate`
> runs the aggregation manually meanwhile.

---

## 1. Add Firebase to the existing GCP project

<https://console.firebase.google.com/> → **Add project** → type `gen-lang-client-0281141814`
and pick it from the list of existing Google Cloud projects (do *not* create a new project).
Accept the terms; Google Analytics is not needed.

## 2. Create Firestore

Firebase console → **Build → Firestore Database → Create database**.

- Mode: **Native / Production mode** (not Datastore mode, not test mode).
- Location: **us-west1** (same region as Cloud Run; this cannot be changed later).

## 3. Enable the two sign-in methods

**Build → Authentication → Get started**, then under *Sign-in method* enable:

- **Anonymous** — every visitor gets a uid so they can vote in the public tier.
- **Email link (passwordless sign-in)** — under the *Email/Password* provider, toggle
  "Email link (passwordless sign-in)" on. (The password half can stay off.)

## 4. Authorise the domains the links come back to

**Authentication → Settings → Authorized domains** → add the Cloud Run hostname
(`wellbeing-transition-simulator-<hash>-uw.a.run.app`, and any custom domain).
`localhost` is already there.

## 5. Register a web app and copy its config

**Project settings (gear) → General → Your apps → Web (`</>`)**. Nickname: `futures-map`.
Do **not** enable Firebase Hosting. Copy the `firebaseConfig` object it shows.

## 6. Put four values in `.env.local`

```sh
VITE_FIREBASE_API_KEY=AIza...            # firebaseConfig.apiKey
VITE_FIREBASE_AUTH_DOMAIN=gen-lang-client-0281141814.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=gen-lang-client-0281141814
VITE_FIREBASE_APP_ID=1:808228086396:web:...
```

Vite exposes anything prefixed `VITE_` automatically — no `vite.config.ts` change. These four are
public by design (they identify the project; the security rules are what protect it), so they are
safe in a client bundle. `.env.local` is gitignored and is uploaded with the source by
`npm run deploy`, so a redeploy bakes them in.

Restart `npm run dev`. The **Expert** and **Public** buttons in the Futures tab are now live.

## 7. Deploy the security rules

```sh
cp firebase/.firebaserc.example firebase/.firebaserc
cd firebase
npx firebase-tools login          # once
npx firebase-tools deploy --only firestore:rules
```

`firebase/firestore.rules` is the whole access model: one estimate document per voter per node,
at most one write a minute, curve values in [0, 1] on the graph's horizons only, tier forced to
what the allowlist says, and `aggregates` / `snapshots` / `experts` read-only to every client.

> The horizons are hardcoded in the rules (`2028, 2030, 2035, 2045`) because rules cannot read
> `data/futures/graph.json`. **If the graph's horizons change, update the rules and redeploy**, or
> honest votes start failing with `PERMISSION_DENIED`.

## 8. Add the experts

Firestore → **Start collection** `experts`. One document per expert, **document id = the email in
lowercase**:

```
experts/jane@lab.org  { addedBy: "sagearbor", affiliation: "Lab", weight: 1, addedAt: <timestamp> }
```

`weight` is the owner-set 0.5-3 multiplier from design 4.5; leave it at 1 unless you mean it.
Anyone signing in with an email that is **not** in this collection votes in the public tier.

## 9. Turn on the nightly aggregation (optional, but do it before the votes matter)

Until this runs, the browser pools the newest 500 estimates itself and shows a *provisional*
number; the cron is what publishes `aggregates/` and the dated `snapshots/`.

1. GCP console → **IAM → Service accounts → Create**: `futures-aggregate`, role
   **Cloud Datastore User**. Create a JSON key and download it.
2. GitHub → repo **Settings → Secrets and variables → Actions**:
   - *Secrets* → **FIREBASE_SERVICE_ACCOUNT** = the whole JSON file, pasted.
   - *Variables* → **FUTURES_AGGREGATE_ENABLED** = `true`, **FIREBASE_PROJECT_ID** =
     `gen-lang-client-0281141814`.
3. Actions → **futures-aggregate → Run workflow** (tick *dry run* the first time).

The workflow is skipped entirely while `FUTURES_AGGREGATE_ENABLED` is anything but `true`.

## 10. Verify, then deploy

```sh
npm run check                                            # unchanged: tests never touch Firestore
npm run dev                                              # Expert/Public enabled; vote on a node
npx tsx scripts/futures-aggregate.ts --dry-run           # needs `gcloud auth application-default login`
npm run deploy                                           # tagged, no-traffic revision
gcloud run services update-traffic wellbeing-transition-simulator \
  --project gen-lang-client-0281141814 --region us-west1 --to-latest
```

What "working" looks like:

- The tier selector no longer says "coming soon"; picking **Public** draws a dashed stroke with a
  25-75 band over each lane, greyed with *"not enough estimates yet"* until 5 effective estimates.
- A node's **details** expander has a "Your estimate" box with one input per horizon.
- Firestore shows `estimates/{uid}_{nodeId}` appearing as you vote, and `estimateLog/` growing.
- Signing in with an allowlisted email flips the box's status line to `Expert · you@lab.org` and
  the next vote is written with `tier: "expert"`.

---

## Notes and gotchas

- **Tests stay hermetic.** `envSource()` deliberately ignores the four variables under vitest, so
  `npm run check` never reaches a real project even with a populated `.env.local`. Set
  `VITE_FIREBASE_IN_TESTS=1` if you ever want the opposite.
- **Cost.** Firestore's free tier is 50k reads / 20k writes a day. The page reads one small
  aggregate document per node per tier selection; the provisional path costs up to 500 document
  reads and only runs before the first cron. Set a budget alert anyway.
- **App Check** (design 8) is the recommended next hardening step for the public tier: Firebase
  console → App Check → register the web app with reCAPTCHA Enterprise, then add
  `initializeAppCheck` to `src/futures/firestoreStore.ts`. It is not required for the tiers to work
  and takes longer than the ten minutes above.
- **Rolling back** is removing the four `.env.local` lines and rebuilding. The data stays in
  Firestore; the app returns to locked-tier-only with no network calls.

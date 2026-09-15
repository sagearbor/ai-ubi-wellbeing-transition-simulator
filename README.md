# Wellbeing Transition Simulator

**What happens to human well-being when AI automates the economy faster than our institutions can adapt — and who, if anyone, keeps the lights on for everyone else?**

The default `world-conditional-v1` compares funded transfers across 128 countries under explicit corporate and macro assumptions. It reports a population-weighted **conditional wellbeing index** for each month's conditions; realized wellbeing timing, demand feedback and total welfare effects are unestimated.

> **Live demo:** https://wellbeing-transition-simulator-808228086396.us-west1.run.app

## What the default models

A hypothetical monthly source pool equals market capitalization × corporate adoption × 0.15 / 12, in billions of constant-2015 USD. A declared available share limits funded requests. This is a modeled source convention, not measured profit or surplus cash. Expenses, ownership and competing uses are unestimated.

Contribution shares or explicit monthly amounts and global/customer-resident/HQ-resident allocation are meaningful policy controls. Adoption, productivity, workforce, available funding share and wellbeing coefficients are scenario assumptions. Source equals funded transfers plus unused and reserved amounts; transfers do not create GDP. The conditional mapping reports income, transfer and assumed non-income unemployment terms separately. Past wellbeing does not alter corporate responses.

The complete country roster participates in allocation. Missing or invalid countries are refused, and out-of-scale mapping values remain visible while the full-roster headline becomes unavailable. The default model card and response evidence distinguish conditional accounting review, illustrative macro/wellbeing and unsupported effects.

Legacy presets remain selectable for historical assumed dynamics, including adaptive corporations and crisis rules. Their displacementRate and gdpScaling controls apply only to appropriate legacy flow models. Tax, baseUBI, adoption-incentive, redistribution and market-pressure fields must not be interpreted as effective default policy controls. The current capability resolver supplies the executable control inventory.

### Bring your own economic model

The simulator isn't just one model — it's a **platform for competing models**.
You can upload your own economic model as a YAML or JSON config that defines
custom equations (AI-adoption growth, surplus generation, well-being delta,
displacement friction, UBI utility) and parameter ranges. Uploaded models are
run through **six "anchor tests"**. One is an accounting invariant (*money must be
conserved*, AT-6); the other five are directional expectations (e.g. *displacement without
UBI reduces wellbeing*). A model is **leaderboard-eligible** when it compiles and holds the
accounting invariant; the directional results are reported beside it but never gate, because
a desired direction can exclude a competing model without showing it is wrong. Eligible models
are scored for **complexity** (an Occam's-razor tiebreaker) on a leaderboard.
Example configs live in [`examples/models/`](examples/models/).

> **Custom model execution:** supported required flow hooks execute in legacy flow mode. Conditional and anchored wellbeing modes explicitly refuse uploaded flow hooks. Unimplemented optional demand/reputation/Gini hooks are refused when changed. A parsed upload is not evidence that every requested mechanism executes; the app reports the actual execution/refusal scope.

---

## How it works

- **Frontend:** React 19 + TypeScript, built with Vite 6, styled with Tailwind CSS 4.
- **Visualization:** D3.js + TopoJSON for the interactive world map, Recharts for
  2D charts, and a custom Canvas renderer for the 2D/3D "motion chart" that traces
  well-being vs. adoption over time.
- **Simulation engine:** a **pure, deterministic, React-free** core in
  [`simulation/pure.ts`](simulation/pure.ts) — same inputs always produce the same
  outputs, which makes it testable, replayable, and runnable outside the browser.
  This is what the anchor tests and batch validation run against.
- **Custom-model tooling:** `mathjs`-based equation parsing, `ajv` JSON-schema
  validation, and `js-yaml` for model configs.
- **AI analysis (optional):** the Google Gemini API (`@google/genai`) powers an
  Analysis tab that generates a plain-language simulation **summary** and a
  hostile **"Red Team" economist** critique that hunts for fatal flaws in the run.
  The core simulation runs fully without any API key; only these two features need one.

The UI is organized into tabs: **Overview** (an animated diagram of the abundance
cycle), **Map** (adoption / well-being / UBI-received / corporate-HQ views),
**Corporations** (a sortable, filterable table plus a game-theory dashboard with
a cooperation meter and contribution histogram), **Charts** (the motion chart and
fund-accumulation graph), **Analysis** (the Gemini features), and a **Guide /
Equations** reference. Simulations auto-save to `localStorage` and can be
exported to / imported from a JSON snapshot.

---

## Quickstart

**Prerequisites:** Node.js.

```bash
# 1. Install dependencies
npm install

# 2. (Optional) enable the AI Analysis tab
#    Copy .example.env to .env.local and add a Google Gemini API key.
#    The simulator runs fine without this — only the Red Team / Summary features need it.
cp .example.env .env.local
#    then edit .env.local and set GEMINI_API_KEY=...

# 3. Run the dev server (http://localhost:3000)
npm run dev

# Production build / preview
npm run build
npm run preview
```

### Checks

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest: parser sandbox, model storage, pure engine
npm run validate    # the six anchor tests against simulation/pure.ts (exit 1 if < 4 pass)
npm run validate:korinek  # reduced-form Korinek reproduction (KJ-1..3)
npm run validate:core     # every core model and overlay in data/core against its own tests
npm run validate:cases    # policy-effect cases (data/cases), signed discrepancies, no grade
npm run hindcast          # 2015-2025 reconstruction (report, not a gate)
npm run check       # typecheck, tests, the validators above and a production build (what CI runs)
```

CI (`.github/workflows/ci.yml`) runs `npm run check` on every push and pull request.

### Deploy (Cloud Run)

The live demo runs on Cloud Run. `Dockerfile` builds the Vite bundle and serves
it with nginx; `scripts/deploy.sh` deploys the current checkout to the existing
service (project/region/service are overridable via `GCP_PROJECT`,
`GCP_REGION`, `CLOUD_RUN_SERVICE`):

```bash
npm run deploy           # new revision, NO traffic, preview at https://main---<service>.<region>.run.app
npm run deploy:promote   # new revision receives 100% of traffic
```

The Gemini key is read from `GEMINI_API_KEY` or `.env.local` at build time and
is embedded in the client bundle (the browser calls Gemini directly), so
restrict the key by HTTP referrer in Google AI Studio.

---

## Status & roadmap

**Early and actively developed (pre-1.0).** The core is real and working: the
five-phase simulation engine, ~80 corporations and 128 countries, the game-theory
dynamics, the world map and charts, the custom-model upload/validation/leaderboard
pipeline, and the Gemini-powered analysis are all implemented. A snapshot
(`release/conference-v1`, February 2026) was shared with collaborators as the
basis for a conference-panel presentation; `main` has moved on since.

Because it's pre-1.0, expect rough edges: parameters and coefficients are still
being tuned, the model catalog is small, and interfaces may change.

Current results for the built-in engine (`npm run check`, 2026-09-13): 767 tests; anchor tests
5 of 6 (AT-3 fails for a measurement reason documented in the model card); Korinek reduced form
3 of 3; every core model passes its own reproduction tests.

**Where to start reviewing (v3 plan, stages 1-5):**

| What | Where |
|---|---|
| Conditional default model card and archived legacy evidence (scope, accounting, response review and limitations) | [`docs/design/model-card-default.md`](docs/design/model-card-default.md), also in-app: MORE → Model Card |
| Audit of the engine and the fixes made | [`docs/design/audit-2026-09-13.md`](docs/design/audit-2026-09-13.md) |
| Authoring core (equations, stocks, lags, entities, effects, solve blocks with `through`) | [`docs/core-authoring.md`](docs/core-authoring.md), `src/core/`, Model Lab tab |
| Faithful port of Korinek et al. (2026), paper equations, 169 published cells reproduced | `data/core/korinek-2026-faithful.json`, [`docs/design/research/korinek-2026-model.md`](docs/design/research/korinek-2026-model.md) |
| Independently selected model added with data only (Gasteiger & Prettner robot tax) and the capability gaps it found | `data/core/gasteiger-prettner-2020.json`, [`docs/design/capability-requests/gasteiger-prettner.md`](docs/design/capability-requests/gasteiger-prettner.md) |
| Historical policy-effect case: Alaska Permanent Fund Dividend (Jones & Marinescu 2022) | `data/cases/alaska-pfd.json`, [`docs/design/research/alaska-pfd-case.md`](docs/design/research/alaska-pfd-case.md), `npm run validate:cases` |
| Cash-transfer and unemployment → wellbeing evidence | [`docs/design/research/cash-transfer-wellbeing-evidence.md`](docs/design/research/cash-transfer-wellbeing-evidence.md) |
| Country data provenance against the World Bank | [`data/provenance/README.md`](data/provenance/README.md) |
| Reference-target ledger: every published/empirical/historical/anchor target with its status, misses kept even when a regression test pins them | [`docs/design/reference-ledger.md`](docs/design/reference-ledger.md), `data/ledger/reference-targets.json`, `npm run ledger` |
| Policy text → provisions → overlay → paired run → share link / bundle → memo | Model Lab → Policy panel, `src/policy/`, worked example `data/policy/examples/` (S. 3877) |

### Reproducing the published outputs of Korinek et al. (2026)

Anthropic's economics team published *Economic Scenarios for Transformative AI*
(Korinek, Jones, Sacher, Cotter & McCrory, Anthropic Institute WP 2026-02) with an
[interactive explorer](https://www.anthropic.com/institute/econ-scenarios): a
task-based US model to 2030 with three scenarios and, deliberately, no probabilities.
A faithful port of their equations now lives in the Model Lab (`data/core/korinek-2026-faithful.json`,
see the table above) and is the canonical US reference: the preset "Provisional level model + US reference"
feeds its US GDP gap, labour income and unemployment into the world engine from January 2025 to January
2030 and stops there (`simulation/usReference.ts`). The reduced form below is kept only as an
illustrative approximation in world scenarios; it is not an authoritative reproduction. This engine's optional macro block (`ModelParameters.macro`, see `simulation/pure.ts`) is
a reduced-form approximation calibrated to match their published US 2030 outputs when
driven by the same inputs — it is not a port of their equations — with the AI
capability/adoption path treated as the scenario input exactly as their explorer does:

| Scenario (US, 2030 vs no-AI path) | GDP boost | Labour share | Cognitive unemployment |
|---|---|---|---|
| Modest — paper / this engine | +1.6% / +1.6% | 59.4% / 59.2% | 2.9% / 3.9% |
| Substantial — paper / this engine | +8.3% / +8.2% | 56.1% / 56.2% | 4.5% / 4.4% |
| Extreme — paper / this engine | +32.4% / +31.3% | 45.2% / 45.4% | 17.9% / 17.8% |

`npm run validate:korinek` runs the three scenarios as tests (KJ-1..3, tolerance ±2 to
±2.5 points). The conditional world default adds explicitly funded transfers and an illustrative wellbeing mapping across 128 countries. Legacy presets separately retain assumed demand/game-theory dynamics; Futures is a separate influence model. None of these extensions inherits the US reproduction claim.

### Hindcast against the last decade

`npm run hindcast` initialises every country from real 2015 data (World Happiness Report
ladder, World Bank GDP per capita) and scores the engine against 2025 actuals with AI
switched off. The wellbeing anchor was fitted on this same 2015-2025 span, so this is a
retrospective reconstruction, not a forecast — the comparison to beat is the persistence
baseline (predicting no change), not zero. Current result: wellbeing-change correlation
0.473 and mean absolute error 4.53 index points (0.453 ladder points) across 106 countries; the script also
prints the persistence baseline and, where enough pre-2015 data exists, a
trend-continuation baseline alongside it. It is an in-sample reconstruction and validates
nothing: the anchor was fitted on the span, the gated run switches AI and UBI off, and the AI
channel has no measurable macro footprint in that decade. The AI-off wellbeing MAE beats persistence (4.68) by 0.15 index points. The separate legacy anchored AI-on MAE is 4.48; neither score validates conditional policy effects. The anchor fit uses 335 observations across 120 countries; 106 is the comparison cohort.

Directions under exploration (see `developer_checklist.yaml` and `docs/`):
- extend explicitly supported uploaded equation hooks, so anchor
  tests and the leaderboard discriminate between models,
- revisit the UBI-boost / friction coefficients so AT-2 passes for an honest reason,
- broader anchor-test coverage and richer validation reporting,
- performance work on the pure engine (memoization, web-workers, batch runs),
- a persistent / shared model leaderboard,
- more scenario presets and richer regional behavior.

---

## Limitations & honest caveats

- **This is a stylized policy sandbox, not a forecast.** The income/governance anchor is fitted associationally; macro responses and policy mappings retain additional assumptions. Outputs are not forecasts or validated causal policy effects.
- **The corporation-centric, direct-to-wallet premise is an assumption**, chosen
  to isolate an incentive question. It presumes frictionless blockchain
  distribution and zero leakage, which is a modeling choice, not a claim about the
  real world.
- **Corporate scale and workforce inputs are assumed.** Most country population/GDP/governance inputs have versioned sources; missing GDP fallbacks remain explicitly assumed. Corporate money is a newly declared hypothetical constant-2015 USD convention, not historical company accounts.
- **No backend.** State lives in the browser (`localStorage`) and JSON exports;
  the leaderboard is local.
- **The AI Analysis features require a Google Gemini API key** and reflect an
  LLM's commentary, not ground truth.

Treat it as an instrument for reasoning about incentives during the AI economic
transition — a way to make assumptions explicit and stress-test them — rather than
as an oracle.

# Wellbeing Transition Simulator

**What happens to human well-being when AI automates the economy faster than our institutions can adapt — and who, if anyone, keeps the lights on for everyone else?**

The Wellbeing Transition Simulator is an interactive, month-by-month model of the
transition from labor-based economies to AI-driven abundance. It lets you run the
next few decades as a live experiment: watch AI adoption spread across ~80
corporations and 128 countries, watch labor income get displaced, and watch a
corporation-funded Universal Basic Income (UBI) system either hold society
together or collapse into a race to the bottom — depending on the incentives you
set.

> **Live demo:** https://wellbeing-transition-simulator-808228086396.us-west1.run.app

---

## Why this matters

Most conversations about AI and jobs stall at "someone should do UBI." This tool
asks the harder, more concrete questions: *funded by whom, distributed how, and
what stops everyone from defecting?*

Its central bet is a **corporation-centric** thought experiment. Instead of
waiting for every nation-state to cooperate on redistribution — a fragile
assumption — it models a world where **corporations voluntarily route a slice of
their AI revenue into a global UBI fund out of self-interest**: if their own
customers go broke, demand collapses and so do their profits. Money flows
**direct-to-wallet** (a blockchain / digital-identity premise that bypasses
government intermediaries and corruption), and nation-states are treated as
**recipients and markets, not policymakers**.

That premise is deliberately provocative, not a prediction. The point of the
simulator is to make the incentive structure *visible and tunable* so you can
argue about it with numbers instead of vibes.

---

## What it models

Each simulated country carries real socio-economic structure — population, GDP
per capita, AI-adoption level, a Gini inequality coefficient, a governance /
institutional-quality score, and an archetype (`rich-democracy`,
`middle-stable`, `developing-fragile`, `authoritarian`, or `failed-state`).
Each corporation carries a headquarters country, a set of operating (customer)
countries, market cap, AI revenue, an AI-adoption level, a UBI **contribution
rate**, a **distribution strategy**, a **policy stance**, and a reputation score.

The engine advances in **five phases every month**:

1. **Corporation revenue generation.** AI revenue is earned as a function of
   automation and customer purchasing power:
   `aiRevenue ≈ aiAdoptionLevel × marketCap × 0.15 × demandFactor × reputationMultiplier`,
   where `demandFactor` shrinks when the corporation's customer countries are too
   poor to buy — poor customers literally reduce revenue.
2. **Contribution decisions.** Each corporation contributes a share of that
   revenue (roughly 5–50%) via one of three strategies:
   - `global` — pooled into a global ledger and paid out equally per capita worldwide,
   - `customer-weighted` — distributed in proportion to where its customers live,
   - `hq-local` — sent only to its headquarters country.
3. **UBI distribution.** The global ledger pays out per capita; each country sums
   what it receives from the global pool, customer-weighted corps, and HQ-local corps.
4. **Wellbeing calculation.** A country's well-being (0–100) moves each month as
   a UBI boost minus displacement friction, with institutions acting as a buffer.
   The actual coefficients baked into the engine include:
   - Displacement friction rises with automation and falls with good governance:
     `baseFriction = 40 × (1 − governance)^1.5 × (1 + gini × 0.5)`, scaled by
     `sin(adoption × π)` so friction peaks mid-transition.
   - Inequality damps the utility of UBI: `giniDamper = 1.5 − gini`.
   - Net update: `wellbeing += ubiBoost × 0.20 − displacementFriction × 0.12`,
     with capped crisis penalties and a subsistence floor.
   - A parallel **shadow simulation** runs the same world with *no intervention*
     as a counterfactual, so you can see the UBI system's marginal impact.
5. **Adaptive corporate policy (game theory).** Corporations watch demand
   projections, competitor behavior, and reputation, then adjust. This is where
   the **prisoner's-dilemma dynamics** live: cross ~60% cooperation and a
   virtuous cycle pulls laggards up; cross ~40% defection and a race to the
   bottom drags everyone down. Regional behaviors (US, China, EU) add
   protectionist and social-contract flavors.

**Global tunable parameters** include `aiGrowthRate`, `displacementRate`,
`gdpScaling` (flat vs. GDP-weighted UBI), `globalRedistributionRate`,
`marketPressure`, and the default corporate policy stance. Six **scenario
presets** ship in the box — *Free Market Optimism, Race to Bottom, Corporate
Altruism, US Protectionism, China Dominance,* and *EU Solidarity* — each a
one-click starting point for a different story about how the transition goes.

### Bring your own economic model

The simulator isn't just one model — it's a **platform for competing models**.
You can upload your own economic model as a YAML or JSON config that defines
custom equations (AI-adoption growth, surplus generation, well-being delta,
displacement friction, UBI utility) and parameter ranges. Uploaded models are
run through a validation harness of **six "anchor tests"** — directional causal
invariants that any honest model must satisfy (e.g. *displacement without UBI
must reduce well-being*, *money must be conserved*). A model needs to pass at
least 4 of 6 to be eligible, and is scored for **complexity** (an Occam's-razor
tiebreaker — simpler models that still pass rank higher) on a leaderboard.
Example configs live in [`examples/models/`](examples/models/).

> **Status of custom models (preview):** uploads are parsed, schema-checked and
> scored for complexity, and the anchor tests run against the built-in engine —
> but the engine does **not yet execute uploaded equations** (checklist item
> P8-T9). Applying a model changes the label and leaderboard bookkeeping; the
> trajectory is still the default model's. See *Status & roadmap* below.

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
npm run check       # all of the above plus a production build (what CI runs)
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

Current anchor-test results for the built-in engine (`npm run validate`): 5 of 6
pass. **AT-2 (generous UBI prevents collapse) fails** — with 40% contributions
distributed globally and 80% displacement, average wellbeing still falls to
about a third of its starting value over 60 months, because the per-capita UBI
boost is small relative to displacement friction at current coefficients. This
is a modelling question, not a code defect, and is left visible on purpose.

### Reproducing Korinek et al. (2026) and extending it

Anthropic's economics team published *Economic Scenarios for Transformative AI*
(Korinek, Jones, Sacher, Cotter & McCrory, Anthropic Institute WP 2026-02) with an
[interactive explorer](https://www.anthropic.com/institute/econ-scenarios): a
task-based US model to 2030 with three scenarios and, deliberately, no probabilities.
This engine's optional macro block (`ModelParameters.macro`, see `simulation/pure.ts`)
reproduces their published US 2030 outcomes when driven by the same inputs, with the
AI capability/adoption path treated as the scenario input exactly as their explorer does:

| Scenario (US, 2030 vs no-AI path) | GDP boost | Labour share | Cognitive unemployment |
|---|---|---|---|
| Modest — paper / this engine | +1.6% / +1.6% | 59.4% / 59.2% | 3.9% / 3.9% |
| Substantial — paper / this engine | +8.3% / +8.2% | 56.1% / 56.2% | 4.5% / 4.4% |
| Extreme — paper / this engine | +32.4% / +31.3% | 45.2% / 45.4% | 17.9% / 17.8% |

`npm run validate:korinek` runs the three scenarios as tests (KJ-1..3, tolerance ±2 to
±2.5 points). The point is what comes after their framework's stated boundary: this repo
adds the demand feedback from displaced customers, the corporation-funded transfer
institution and its game theory, 128 countries instead of one, and (Futures tab) the
catastrophic and non-economic paths with community-weighted likelihoods.

### Hindcast against the last decade

`npm run hindcast` initialises every country from real 2015 data (World Happiness Report
ladder, World Bank GDP per capita) and scores the engine against 2025 actuals with AI
switched off. Current result: wellbeing-change correlation 0.49 and mean absolute error
0.45 ladder points across 106 countries. That validates only the baseline economy
(GDP path and the wellbeing anchor fitted to GDP and governance), not the AI channel,
which has no measurable macro footprint in that decade.

Directions under exploration (see `developer_checklist.yaml` and `docs/`):
- execute uploaded model equations inside the pure engine (P8-T9), so anchor
  tests and the leaderboard discriminate between models,
- revisit the UBI-boost / friction coefficients so AT-2 passes for an honest reason,
- broader anchor-test coverage and richer validation reporting,
- performance work on the pure engine (memoization, web-workers, batch runs),
- a persistent / shared model leaderboard,
- more scenario presets and richer regional behavior.

---

## Limitations & honest caveats

- **This is a stylized policy sandbox, not a forecast.** Coefficients were tuned
  by hand to produce plausible, legible behavior — they are *not* econometric
  estimates fit to historical data, and outputs should not be read as predictions.
- **The corporation-centric, direct-to-wallet premise is an assumption**, chosen
  to isolate an incentive question. It presumes frictionless blockchain
  distribution and zero leakage, which is a modeling choice, not a claim about the
  real world.
- **Corporate and country figures are illustrative.** Market caps, revenues, and
  country attributes are simplified starting values meant to drive dynamics, not
  a curated economic dataset.
- **No backend.** State lives in the browser (`localStorage`) and JSON exports;
  the leaderboard is local.
- **The AI Analysis features require a Google Gemini API key** and reflect an
  LLM's commentary, not ground truth.

Treat it as an instrument for reasoning about incentives during the AI economic
transition — a way to make assumptions explicit and stress-test them — rather than
as an oracle.

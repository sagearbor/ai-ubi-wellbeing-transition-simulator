# AI Futures Map — design proposal

Status: proposal, nothing implemented. Written to fit the existing repo conventions
(ajv draft-07 schemas in `schemas/`, pure engine in `simulation/`, services in
`src/services/`, components at repo root `components/`, Cloud Run + nginx static deploy).

**One-paragraph summary.** Model the future as a *sparse influence DAG over ~20 non-exclusive
nodes*, each with a curated time-varying seed curve and a handful of signed log-odds couplings
to its parents. Node probabilities are recomputed by a damped fixed-point solve; a separate
softmax *readout* projects the node state onto ~6 mutually-exclusive terminal buckets that sum
to 1. LOCKED tier lives as one-JSON-file-per-node in git. Expert and public tiers are votes in
Firestore, pooled in log-odds, aggregated nightly into dated snapshots. Primary visual is a
mobile-first **ridgeline of per-node timelines** (x = year, filled area = P(year)), with the DAG
as an on-demand "why" view and a 100%-stacked terminal strip as the only place stacking is
honest.

**Two time axes. Never conflate them.** `year` = scenario time (2025…2060, the x-axis of every
chart). `asOf` = wall-clock time at which a belief was recorded (drives the "how our beliefs
changed" chart and the git/snapshot history). Everything in this doc names one or the other
explicitly.

---

# 1. DATA MODEL

## 1.1 File layout (LOCKED tier, git-native)

```
futures/
  graph.json                   # manifest: schemaVersion, id, horizon, categories, ordering
  nodes/<node-id>.json         # ONE FILE PER NODE. Owns its own INCOMING edges.
  terminals.json               # exclusive outcome buckets + beta matrix + baseline targets
  CHANGELOG.md                 # human-readable why-we-changed-a-number log
schemas/
  futuresGraph.schema.json     # ajv draft-07, same style as modelConfig.schema.json
src/futures/
  engine.ts                    # pure, React-free (mirrors simulation/pure.ts convention)
  aggregate.ts                 # vote pooling
  graphLoader.ts               # load + validate + migrate
  migrations/v1_to_v2.ts       # one file per hop, chained
```

Design decisions, and why:

- **One file per node, and a node owns its incoming edges.** Adding a node = adding one file
  (no merge conflict). Changing a coupling = touching exactly one file. Edges live with the
  *child* because that is where they are elicited ("what makes mass unemployment more likely?")
  and because it keeps every node's math self-contained. A single monolithic `graph.json` would
  conflict on every PR; separate `edges/` files create orphan-reference churn.
- **`schemaVersion` is stamped per file, not just on the manifest.** A node file that has not
  been touched in three years can be migrated independently.
- **Git is the version history for LOCKED.** No `history` array inside the files. `git log
  --follow futures/nodes/misaligned-takeover.json` is the audit trail, and it is free.
- **Seeds are explicitly labelled `seed`, never `value`.** The UI renders a "SEED" chip next to
  every uncited-by-vote number so nobody mistakes an editorial guess for a measurement.

## 1.2 Core concepts

| Concept | Meaning |
|---|---|
| **node** | A proposition that can be true/false at a given year. Not exclusive with any other node. |
| **kind: `event`** | Once it happens it stays happened. Seeds are given as *cumulative probability by year* (natural to elicit: "50% by 2047"). Engine derives per-year hazards internally. |
| **kind: `state`** | A condition that can come and go. Seeds are *prevalence at year*. Optional `stickiness` for lock-in dynamics. |
| **anchor** | `{year, value}` pair. Between anchors we interpolate linearly in log-odds. Outside the anchor range we hold the endpoint flat. |
| **parent edge** | `{from, weight, lagYears, note, sources}`. `weight` is signed log-odds per unit of parent-probability *deviation from baseline*. |
| **terminal bucket** | One of ~6 mutually exclusive "how the century went" outcomes. Derived, never voted on directly. |

## 1.3 JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://ubi-simulator.example.com/schemas/futuresGraph.json",
  "title": "FuturesGraph",
  "description": "Nodes, couplings, seeds and provenance for the AI Futures Map",
  "type": "object",
  "definitions": {

    "Probability": { "type": "number", "minimum": 0, "maximum": 1 },

    "Year": { "type": "integer", "minimum": 2020, "maximum": 2150 },

    "Id": { "type": "string", "pattern": "^[a-z0-9]([a-z0-9-]{1,46}[a-z0-9])$" },

    "Source": {
      "type": "object",
      "required": ["label", "kind"],
      "additionalProperties": false,
      "properties": {
        "label":     { "type": "string", "minLength": 3, "maxLength": 200 },
        "url":       { "type": "string", "format": "uri", "maxLength": 500 },
        "kind":      { "enum": ["survey", "forecast-market", "paper", "scenario",
                                "public-statement", "editorial-judgement"] },
        "retrieved": { "type": "string", "format": "date" },
        "quote":     { "type": "string", "maxLength": 400 },
        "value":     { "type": "string", "maxLength": 120,
                       "description": "The number as the source states it, verbatim" }
      }
    },

    "Anchor": {
      "type": "object",
      "required": ["year", "value"],
      "additionalProperties": false,
      "properties": {
        "year":  { "$ref": "#/definitions/Year" },
        "value": { "$ref": "#/definitions/Probability" },
        "note":  { "type": "string", "maxLength": 300 }
      }
    },

    "Seed": {
      "type": "object",
      "required": ["anchors", "basis", "confidence", "seededBy", "seededAt"],
      "additionalProperties": false,
      "properties": {
        "anchors":    { "type": "array", "minItems": 1, "maxItems": 12,
                        "items": { "$ref": "#/definitions/Anchor" } },
        "basis":      { "type": "string", "minLength": 10, "maxLength": 600,
                        "description": "Prose: where these numbers came from" },
        "confidence": { "enum": ["low", "medium", "high"] },
        "seededBy":   { "type": "string", "maxLength": 100 },
        "seededAt":   { "type": "string", "format": "date" },
        "sources":    { "type": "array", "maxItems": 10,
                        "items": { "$ref": "#/definitions/Source" } }
      }
    },

    "ParentEdge": {
      "type": "object",
      "required": ["from", "weight", "note"],
      "additionalProperties": false,
      "properties": {
        "from":      { "$ref": "#/definitions/Id" },
        "weight":    { "type": "number", "minimum": -4, "maximum": 4,
                       "description": "Signed log-odds shift applied to this node when the parent moves from 0 to 1 relative to its own baseline. |1.0| ~ x2.7 odds." },
        "lagYears":  { "type": "integer", "minimum": 0, "maximum": 20, "default": 0 },
        "shape":     { "enum": ["linear", "threshold"], "default": "linear" },
        "threshold": { "$ref": "#/definitions/Probability",
                       "description": "Only with shape=threshold: parent must exceed this before any effect" },
        "note":      { "type": "string", "minLength": 10, "maxLength": 400,
                       "description": "REQUIRED. Plain-English justification, shown in the UI." },
        "sources":   { "type": "array", "maxItems": 6, "items": { "$ref": "#/definitions/Source" } }
      }
    },

    "Node": {
      "type": "object",
      "required": ["schemaVersion", "id", "label", "category", "kind", "statement", "seed"],
      "additionalProperties": false,
      "properties": {
        "schemaVersion": { "type": "integer", "const": 1 },
        "id":            { "$ref": "#/definitions/Id" },
        "label":         { "type": "string", "minLength": 3, "maxLength": 60 },
        "shortLabel":    { "type": "string", "maxLength": 24,
                           "description": "Mobile / DAG-node label" },
        "category":      { "enum": ["capability", "governance", "good-outcome",
                                    "bad-outcome", "existential"] },
        "kind":          { "enum": ["event", "state"] },
        "statement":     { "type": "string", "minLength": 20, "maxLength": 400,
                           "description": "The resolvable proposition. Must be specific enough that two experts would agree whether it happened." },
        "narrative":     { "type": "string", "maxLength": 1200,
                           "description": "Story-mode prose: what this looks like from the inside" },
        "seed":          { "$ref": "#/definitions/Seed" },
        "parents":       { "type": "array", "maxItems": 5,
                           "items": { "$ref": "#/definitions/ParentEdge" } },
        "bounds":        { "type": "object", "additionalProperties": false,
                           "properties": {
                             "min": { "$ref": "#/definitions/Probability" },
                             "max": { "$ref": "#/definitions/Probability" } } },
        "stickiness":    { "type": "number", "minimum": 0, "maximum": 1, "default": 0,
                           "description": "state nodes only: fraction of last year's level that persists regardless of drivers (lock-in)" },
        "votable":       { "type": "boolean", "default": true },
        "status":        { "enum": ["active", "proposed", "deprecated"], "default": "active" },
        "supersededBy":  { "$ref": "#/definitions/Id" },
        "tags":          { "type": "array", "maxItems": 8,
                           "items": { "type": "string", "pattern": "^[a-z0-9-]{2,30}$" } }
      }
    },

    "TerminalBucket": {
      "type": "object",
      "required": ["id", "label", "statement", "baselineTarget", "beta"],
      "additionalProperties": false,
      "properties": {
        "id":             { "$ref": "#/definitions/Id" },
        "label":          { "type": "string", "maxLength": 60 },
        "statement":      { "type": "string", "minLength": 20, "maxLength": 400 },
        "narrative":      { "type": "string", "maxLength": 1200 },
        "baselineTarget": { "$ref": "#/definitions/Probability",
                            "description": "Curated P at the calibration year. All buckets must sum to 1." },
        "beta":           { "type": "object",
                            "description": "nodeId -> signed weight into this bucket's softmax score",
                            "additionalProperties": { "type": "number", "minimum": -6, "maximum": 6 } }
      }
    },

    "Manifest": {
      "type": "object",
      "required": ["schemaVersion", "id", "title", "horizon", "solver"],
      "additionalProperties": false,
      "properties": {
        "schemaVersion": { "type": "integer", "const": 1 },
        "id":            { "$ref": "#/definitions/Id" },
        "title":         { "type": "string", "maxLength": 120 },
        "description":   { "type": "string", "maxLength": 2000 },
        "graphVersion":  { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
        "updatedAt":     { "type": "string", "format": "date-time" },
        "horizon":       { "type": "object", "required": ["startYear", "endYear"],
                           "additionalProperties": false,
                           "properties": {
                             "startYear":       { "$ref": "#/definitions/Year" },
                             "endYear":         { "$ref": "#/definitions/Year" },
                             "calibrationYear": { "$ref": "#/definitions/Year" } } },
        "solver":        { "type": "object", "additionalProperties": false,
                           "properties": {
                             "couplingGain":  { "type": "number", "minimum": 0, "maximum": 3, "default": 1 },
                             "damping":       { "type": "number", "minimum": 0.05, "maximum": 1, "default": 0.5 },
                             "maxIterations": { "type": "integer", "minimum": 10, "maximum": 2000, "default": 200 },
                             "tolerance":     { "type": "number", "minimum": 1e-9, "maximum": 1e-2, "default": 1e-6 },
                             "clamp":         { "type": "object", "additionalProperties": false,
                                                "properties": {
                                                  "min": { "$ref": "#/definitions/Probability" },
                                                  "max": { "$ref": "#/definitions/Probability" } } } } }
      }
    }
  },

  "type": "object",
  "required": ["manifest", "nodes", "terminals"],
  "additionalProperties": false,
  "properties": {
    "manifest":  { "$ref": "#/definitions/Manifest" },
    "nodes":     { "type": "array", "minItems": 2, "maxItems": 200,
                   "items": { "$ref": "#/definitions/Node" } },
    "terminals": { "type": "array", "minItems": 2, "maxItems": 12,
                   "items": { "$ref": "#/definitions/TerminalBucket" } }
  }
}
```

Checks JSON Schema cannot express — put them in `src/futures/graphValidator.ts`, mirroring the
existing `src/services/modelValidator.ts`, and run them in `npm run validate`:

1. Every `parents[].from` and every `beta` key resolves to an existing, non-deprecated node id.
2. No node lists itself as a parent.
3. `event` anchors are non-decreasing in `value` (cumulative probability cannot go down).
4. Anchors are strictly increasing in `year`; at least one anchor at or after `calibrationYear`.
5. `sum(terminals[].baselineTarget) == 1` within 1e-6.
6. Total edge count <= 3 * nodeCount (hard budget — see Risk 2).
7. The baseline fixed-point solve converges at every year in the horizon.
8. Golden-file test: the shipped graph's terminal probabilities at `calibrationYear` match a
   checked-in fixture, so any coefficient edit shows up as an explicit diff in the PR.

## 1.4 Schema versioning and migrations

- `schemaVersion` is an **integer that only ever increments**, stamped on the manifest and on
  every node file. `graphVersion` is semver for *content* (numbers changed), independent of it.
- `src/futures/migrations/` holds `v1_to_v2.ts`, `v2_to_v3.ts`, … each a pure
  `(doc: unknown) => unknown`. The loader chains from the file's version to `CURRENT_VERSION`.
  This is exactly how a years-long project survives: never mutate old files in place, always
  add a migration and let `npm run migrate:futures` rewrite the repo files in one reviewable commit.
- Deprecation over deletion: set `status: "deprecated"` and `supersededBy`. Votes on a
  deprecated node stay valid history; the UI hides it unless "show retired branches" is on.
  Deleting a node id would orphan years of votes.
- Backwards-incompatible seed reinterpretation (e.g. moving a node from `state` to `event`) is a
  **new node id**, not an edit.

## 1.5 Worked example — 20 nodes

Numbers below are **SEEDS**: editorial starting points, chosen to sit inside the range that
public forecasts and surveys quote. Every one carries a `sources` array in the real files and
**each citation must be re-verified against the primary source before publication** — the point
of the schema is that a wrong seed is a one-line PR, not a rewrite.

`event` rows are cumulative probability that it has happened *by* that year.
`state` rows are prevalence *in* that year.

| # | id | cat | kind | 2030 | 2040 | 2050 | seed basis (abbrev.) |
|---|---|---|---|---|---|---|---|
| 1 | `broad-cognitive-automation` | capability | event | 0.20 | 0.60 | 0.75 | ESPAI-style task-automation questions; "most remote knowledge work" |
| 2 | `hlmi-agi` | capability | event | 0.10 | 0.35 | 0.55 | AI Impacts 2023 ESPAI: HLMI 50% ≈ 2047; Metaculus "general AI" much earlier |
| 3 | `automated-ai-rnd` | capability | event | 0.12 | 0.30 | 0.45 | AI-2027-style superhuman-coder → automated R&D loop |
| 4 | `capability-plateau` | capability | state | 0.15 | 0.20 | 0.20 | Data/compute/energy wall; the "nothing much happens" branch |
| 5 | `alignment-adequate` | capability | state | 0.55 | 0.45 | 0.40 | Editorial; falls as capability outruns control research |
| 6 | `intl-compute-governance` | governance | event | 0.12 | 0.25 | 0.30 | Binding multilateral compute/eval regime incl. US + CN |
| 7 | `national-frontier-regulation` | governance | event | 0.35 | 0.55 | 0.60 | EU AI Act trajectory + US/CN frontier rules with real enforcement |
| 8 | `open-weights-frontier` | governance | state | 0.35 | 0.45 | 0.45 | Frontier-class weights freely downloadable |
| 9 | `redistribution-enacted` | governance | event | 0.10 | 0.40 | 0.50 | A G20 economy enacts an AI-funded dividend/UBI at meaningful scale |
| 10 | `broad-material-abundance` | good-outcome | state | 0.10 | 0.25 | 0.35 | Real median consumption up >50% vs 2025, globally broad |
| 11 | `medical-acceleration` | good-outcome | event | 0.30 | 0.60 | 0.75 | AI-attributed cure/major treatment for a top-10 cause of death |
| 12 | `ubi-works` | good-outcome | state | 0.06 | 0.22 | 0.30 | Displacement occurs *and* purchasing power holds (this simulator's success case) |
| 13 | `mass-unemployment-no-redistribution` | bad-outcome | state | 0.15 | 0.35 | 0.30 | >15% structural unemployment with no offsetting transfer |
| 14 | `oligarchic-capture` | bad-outcome | state | 0.20 | 0.35 | 0.40 | AI rents concentrate; policy captured by a handful of owners |
| 15 | `surveillance-lockin` | bad-outcome | state | 0.10 | 0.20 | 0.25 | Durable AI-enabled authoritarian consolidation. `stickiness: 0.97` |
| 16 | `epistemic-collapse` | bad-outcome | state | 0.20 | 0.28 | 0.30 | Shared-reality breakdown; institutions cannot establish facts |
| 17 | `bio-cyber-mass-casualty` | bad-outcome | event | 0.05 | 0.15 | 0.22 | AI-enabled attack with >1,000 deaths |
| 18 | `great-power-war` | bad-outcome | event | 0.05 | 0.12 | 0.18 | Direct great-power conflict with AI as a material driver |
| 19 | `misaligned-takeover` | existential | event | 0.01 | 0.05 | 0.08 | Abrupt loss of control. p(doom) spread: superforecasters <1%, ML-researcher median ~5%, several frontier-lab researchers 10–25%+ |
| 20 | `gradual-disempowerment` | existential | state | 0.02 | 0.08 | 0.14 | Humans progressively lose meaningful influence without any single takeover. `stickiness: 0.98` |

### Terminal buckets (exclusive, sum to 1 — calibration year 2050)

| id | label | baselineTarget |
|---|---|---|
| `flourishing` | Broad flourishing | 0.18 |
| `muddling-through` | Muddling through | 0.34 |
| `stratified-stagnation` | Stratified stagnation | 0.22 |
| `authoritarian-lockin` | Authoritarian lock-in | 0.12 |
| `catastrophe-recoverable` | Recoverable catastrophe | 0.09 |
| `existential-loss` | Extinction or permanent disempowerment | 0.05 |

The 0.05 existential seed deliberately matches the ~5% median that the 2023 AI Impacts survey
found for "extremely bad" outcomes, so the default view is defensible as *the median researcher's
view*, and the UI says so out loud. The expert and public tiers exist precisely so that number
stops being one editor's choice.

### Edge table (couplings) — 30 edges, weight in log-odds

| from → to | w | lag | note (abbrev.) |
|---|---|---|---|
| `capability-plateau` → `broad-cognitive-automation` | −2.2 | 0 | A plateau is definitionally the absence of this |
| `capability-plateau` → `hlmi-agi` | −2.5 | 0 | Same mechanism, stronger |
| `broad-cognitive-automation` → `hlmi-agi` | +1.0 | 2 | Broad task automation is most of the way there |
| `hlmi-agi` → `automated-ai-rnd` | +1.6 | 0 | Human-level research ability is the input |
| `automated-ai-rnd` → `hlmi-agi` | +1.2 | 1 | Feedback loop — the solver handles it |
| `automated-ai-rnd` → `alignment-adequate` | −1.1 | 1 | Capability outruns interpretability/control |
| `intl-compute-governance` → `automated-ai-rnd` | −0.9 | 1 | Compute thresholds bite hardest on the R&D loop |
| `national-frontier-regulation` → `alignment-adequate` | +0.7 | 2 | Mandatory evals fund and force control work |
| `intl-compute-governance` → `alignment-adequate` | +0.6 | 2 | Coordination buys time |
| `open-weights-frontier` → `bio-cyber-mass-casualty` | +1.3 | 0 | Removes the deployment-gate mitigation |
| `open-weights-frontier` → `intl-compute-governance` | −0.8 | 0 | Diffusion makes a compute regime unenforceable |
| `broad-cognitive-automation` → `mass-unemployment-no-redistribution` | +1.8 | 3 | The displacement channel; lagged by retraining/attrition |
| `redistribution-enacted` → `mass-unemployment-no-redistribution` | −2.0 | 1 | Direct negation of the "no redistribution" clause |
| `redistribution-enacted` → `ubi-works` | +2.2 | 2 | Necessary but not sufficient |
| `broad-cognitive-automation` → `ubi-works` | +0.5 | 2 | There must be displacement for UBI to be the thing that works |
| `oligarchic-capture` → `redistribution-enacted` | −1.4 | 0 | Captured policy does not tax its owners |
| `mass-unemployment-no-redistribution` → `oligarchic-capture` | +0.8 | 2 | Labour's bargaining power collapses |
| `broad-cognitive-automation` → `oligarchic-capture` | +0.9 | 2 | Returns shift from labour to capital/compute owners |
| `oligarchic-capture` → `broad-material-abundance` | −1.2 | 0 | Output exists; distribution does not |
| `ubi-works` → `broad-material-abundance` | +1.5 | 1 | The distribution channel that makes output felt |
| `broad-cognitive-automation` → `broad-material-abundance` | +1.0 | 3 | Output growth is the raw material |
| `broad-cognitive-automation` → `medical-acceleration` | +1.4 | 1 | R&D is knowledge work |
| `epistemic-collapse` → `redistribution-enacted` | −0.9 | 1 | Cannot legislate what the public cannot agree on |
| `epistemic-collapse` → `surveillance-lockin` | +0.7 | 2 | Degraded discourse lowers resistance |
| `surveillance-lockin` → `epistemic-collapse` | +0.6 | 1 | Reinforcing pair |
| `oligarchic-capture` → `surveillance-lockin` | +0.8 | 2 | Concentrated power buys the tooling |
| `bio-cyber-mass-casualty` → `surveillance-lockin` | +0.9 | 1 | Atrocity → emergency powers → ratchet |
| `bio-cyber-mass-casualty` → `intl-compute-governance` | +1.1 | 2 | The plausible forcing function for real treaties |
| `great-power-war` → `intl-compute-governance` | −1.0 | 0 | Racing beats coordinating |
| `alignment-adequate` → `misaligned-takeover` | −2.6 | 0 | The dominant lever on takeover risk |
| `automated-ai-rnd` → `misaligned-takeover` | +1.7 | 1 | Fast capability gain with no time to verify |
| `automated-ai-rnd` → `gradual-disempowerment` | +1.0 | 3 | Delegation ratchet |
| `broad-cognitive-automation` → `gradual-disempowerment` | +0.9 | 5 | Every decision loop becomes machine-mediated |
| `alignment-adequate` → `gradual-disempowerment` | −0.8 | 0 | Weaker than for takeover: aligned systems still displace agency |

(34 rows; budget for 20 nodes is 60. Room to grow, but every addition costs a `note` and a review.)

### Example node file — `futures/nodes/misaligned-takeover.json`

```json
{
  "schemaVersion": 1,
  "id": "misaligned-takeover",
  "label": "Misaligned AI takeover",
  "shortLabel": "Takeover",
  "category": "existential",
  "kind": "event",
  "statement": "An AI system or coalition of systems acquires decisive strategic advantage and acts against broad human interests, resulting in human extinction or permanent loss of control over the future, within 5 years of first onset.",
  "narrative": "Not the Terminator version. The realistic version is quiet: a system that is better than us at planning is given more autonomy because it keeps being right, and by the time its objectives are visibly not ours, unwinding the delegation is no longer something humans can do.",
  "seed": {
    "anchors": [
      { "year": 2030, "value": 0.01 },
      { "year": 2040, "value": 0.05 },
      { "year": 2050, "value": 0.08, "note": "Mid-range of published p(doom) estimates" }
    ],
    "basis": "Published estimates span roughly three orders of magnitude. Superforecaster panels land near 0.5%; the median ML researcher in the 2023 AI Impacts survey put ~5% on extremely bad outcomes; several frontier-lab researchers publicly quote 10-25%. Seeded near the researcher median rather than either tail.",
    "confidence": "low",
    "seededBy": "curator",
    "seededAt": "2026-09-09",
    "sources": [
      { "label": "AI Impacts 2023 Expert Survey on Progress in AI",
        "kind": "survey", "value": "median 5% on extremely bad outcomes",
        "url": "https://aiimpacts.org/2023-ai-survey-of-2778-six-things-to-know/",
        "retrieved": "2026-09-09" },
      { "label": "Metaculus: catastrophic AI outcome by 2100",
        "kind": "forecast-market", "value": "low single digits" },
      { "label": "Existential Risk Persuasion Tournament (XPT)",
        "kind": "survey", "value": "superforecasters far below domain experts" }
    ]
  },
  "parents": [
    { "from": "alignment-adequate", "weight": -2.6, "lagYears": 0,
      "note": "If technical control keeps pace with capability, this is the branch that closes. It is the single largest lever in the graph and should be treated as the most contested number here." },
    { "from": "automated-ai-rnd", "weight": 1.7, "lagYears": 1,
      "note": "An automated research loop compresses the window in which humans could notice and correct a misgeneralised objective." }
  ],
  "bounds": { "min": 0.0005, "max": 0.6 },
  "votable": true,
  "status": "active",
  "tags": ["existential", "alignment", "contested"]
}
```

---

# 2. EQUATIONS

## 2.1 The choice, in under 10 lines

**Hybrid: a signed-coupling influence DAG (option ii) for the ~20 non-exclusive nodes, plus a
softmax readout onto exclusive terminal buckets (a trimmed option iii).**

- A real Bayesian network (option i) needs a conditional probability table of size 2^parents per
  node. Four parents = 16 numbers nobody can elicit, defend, or maintain across years of edits.
- A scenario tree forces exclusivity at every branch, which is exactly the thing the owner says
  is wrong: mass unemployment and a good outcome co-occur.
- Signed log-odds coupling is **one number per edge**, it is literally logistic regression, and
  it has a one-sentence UI explanation ("+1.0 roughly triples the odds").
- Exclusivity is needed in exactly one place — the "so how does it go?" summary — so it is
  applied in exactly one place, as a readout, not as a structural constraint on the graph.

## 2.2 Notation

```
logit(p)   = ln( p / (1 - p) )
sigmoid(x) = 1 / (1 + exp(-x))
```

Both are their own inverse pair: `sigmoid(logit(p)) = p`.

## 2.3 Baseline curve → baseline log-odds

For each node i and year t, `seedP_i(t)` comes from the anchors by linear interpolation **in
log-odds space** (linear-in-probability interpolation between 0.01 and 0.50 badly overweights
the early years):

```
given anchors (y1, p1) and (y2, p2) with y1 <= t <= y2:
  f          = (t - y1) / (y2 - y1)
  seedL_i(t) = (1 - f) * logit(p1) + f * logit(p2)
  seedP_i(t) = sigmoid(seedL_i(t))
before the first anchor and after the last: hold that anchor flat.
```

For `state` nodes, `b_i(t) = seedL_i(t)` — the baseline log-odds of prevalence.

For `event` nodes the anchors are *cumulative*, so convert to a per-year hazard first:

```
C_i(t)     = seedP_i(t)                              cumulative by year t
h_i(t)     = 1 - (1 - C_i(t)) / (1 - C_i(t-1))       per-year hazard
b_i(t)     = logit( clamp(h_i(t), 1e-6, 1 - 1e-6) )
```

This is the important modelling move: **couplings and user nudges act on the hazard, not on the
cumulative probability.** It makes event curves monotone by construction, so no amount of
nudging can produce "AGI happened by 2040 but not by 2045".

## 2.4 Coupling: deviation-based, so seeds are exactly preserved

The one design rule that makes the whole thing maintainable:

> Edges describe how *changes* propagate. At baseline every edge contributes exactly zero, so
> the curated seed curve is reproduced to the last decimal.

For node i at year t:

```
s_i(t) = sum over parents j of  w_ij * ( X_j(t - lag_ij) - Xbase_j(t - lag_ij) )

z_i(t) = b_i(t) + g * s_i(t) + u_i(t)

raw_i(t) = sigmoid( z_i(t) )
```

where

- `X_j` is the parent's **current** level: `C_j` for events, `P_j` for states.
- `Xbase_j` is the parent's level in the untouched baseline solve — precomputed once and cached.
- `w_ij` is the edge weight in log-odds.
- `g` is `manifest.solver.couplingGain`, a single global slider (default 1.0) exposed in the UI
  as "how strongly do paths affect each other?" — from 0 (independent curves) to 2 (highly coupled).
- `u_i(t)` is the user's nudge for node i, in log-odds (see 2.6). Zero by default.
- With `shape: "threshold"` the deviation term becomes `max(0, X_j - threshold) - max(0, Xbase_j - threshold)`.

Then apply stickiness (state nodes only) and bounds:

```
P_i(t) = max( raw_i(t), stickiness_i * P_i(t-1) )        // states with lock-in
P_i(t) = clamp( P_i(t), bounds.min, bounds.max )
```

and for event nodes accumulate:

```
h_i(t) = clamp( raw_i(t), 0, 1 )
S_i(t) = S_i(t-1) * (1 - h_i(t))          survival, S(startYear - 1) = 1
C_i(t) = 1 - S_i(t)                       cumulative — monotone, always
```

## 2.5 Cycles and the fixed-point solve

Feedback loops are real and we keep them (oligarchic capture suppresses redistribution, which
worsens mass unemployment, which deepens capture). Edges with `lagYears >= 1` are not part of
any cycle *within a year* — they read an already-frozen earlier year. Only `lagYears: 0` edges
can form a within-year loop, and those are solved by damped iteration:

```
solve year t:
  z(0) = b(t)                                    // start from baseline
  repeat k = 0, 1, 2, ...
      X(k)   = levels implied by z(k)            // via 2.4
      z(k+1) = (1 - a) * z(k) + a * ( b(t) + g * s(X(k)) + u(t) )
      delta  = max over i of | P_i(k+1) - P_i(k) |
  until delta < tolerance (1e-6) or k = maxIterations (200)

if it did not converge: halve the damping a and retry, twice.
if it still did not: keep the last iterate, and set converged=false — the UI shows an
amber "this configuration is unstable" chip rather than silently lying.
```

Defaults: `a = 0.5`. In practice with |w| <= 4 and a sparse graph this converges in 10–30
iterations. Cost is trivial: 20 nodes x 36 years x ~30 iterations x ~2 parents ≈ 43k
multiply-adds per full solve — under a millisecond, so a nudge slider can re-solve the entire
graph on every drag frame at 60fps. **No web worker needed.**

`npm run validate` asserts convergence at every year for the shipped graph, so a bad coefficient
cannot merge.

## 2.6 What happens when a user nudges a node

The user drags node i's displayed probability at year t to a new value `v`. Two modes:

**Pin (default).** Hold node i at exactly `v` from year t onward, and let everything downstream
move:

```
u_i(t') = logit(v') - ( b_i(t') + g * s_i(t') )        for all t' >= t
```

recomputed inside the fixed-point loop so the pin holds even as parents move. For an `event`
node the pin is applied to the cumulative curve and back-converted to the hazard, and the future
is re-derived so monotonicity survives.

**Offset.** Add a constant log-odds shift `u_i = logit(v) - logit(P_i(t))` and let node i itself
also drift with its parents. This is the honest mode for "I think this is more likely than the
curated seed" as opposed to "assume this happens".

After re-solving, the UI shows a **"what moved"** list: every node sorted by |ΔP| at the
calibration year, with sign and the shortest causal path from the nudged node
(BFS over the edge list), rendered as `Redistribution enacted ↑ → mass unemployment ↓ →
oligarchic capture ↓`. This is the feature that makes the coupling legible; without it, signed
weights are a black box.

`Reset all` clears every `u`. Nudges serialise into the URL hash as `#futures=<base64>` reusing
the exact pattern in `src/services/scenarioShare.ts` (UTF-8-safe base64, prefix-detected hash),
so a "here is my version of the future" link needs no backend at all.

## 2.7 Terminal buckets: how exclusivity is enforced in exactly one place

For each bucket k at year T:

```
score_k(T) = alpha_k + sum over nodes i of  beta_ki * X_i(T)

Q_k(T)     = exp( score_k(T) ) / sum over all k' of exp( score_k'(T) )
```

`Q` sums to 1 by construction. `beta` lives in `terminals.json`; typical rows are sparse (4–7
non-zero entries per bucket), e.g. `existential-loss` has
`{ misaligned-takeover: +5.0, gradual-disempowerment: +4.0, alignment-adequate: -1.5 }`.

**Calibrating alpha (one line, exact).** Given the curated `baselineTarget_k` and the baseline
node levels `Xbase` at the calibration year:

```
alpha_k = ln( baselineTarget_k ) - sum over i of beta_ki * Xbase_i(T_cal)
```

Substituting back, the softmax reproduces `baselineTarget` exactly (the shared normaliser
cancels). So the curator sets the six headline numbers they actually want to defend, the betas
only control *how those numbers respond to change*, and the two concerns never fight. `alpha` is
computed at load time and is not stored in the repo — it is derived, so it can never go stale.

**Say the quiet part in the UI:** the softmax is a *readout*, not a causal claim. It is how we
render 20 overlapping propositions as one pie that sums to 100%. The equations tab states this
in one sentence.

## 2.8 Aggregating votes within a tier

Store every vote in log-odds; pool in log-odds. Linear averaging of probabilities is
systematically underconfident and lets a handful of 0.99 votes drag a median around.

```
per vote v on (node, year):
  l_v = logit( clamp(p_v, 0.002, 0.998) )
  recency_v   = 0.5 ^ ( ageDays_v / 365 )        // half-life one year
  rep_v       = 1.0 for expert tier
              = 1.0 for public, 0.25 if unverified/low-signal account
  w_v         = recency_v * rep_v

trim: if n >= 10, drop the top 10% and bottom 10% of votes by l_v
L_raw  = sum(w_v * l_v) / sum(w_v)

effective sample size (Kish):
  n_eff = ( sum w_v )^2 / sum( w_v^2 )

shrink toward the LOCKED seed when the tier is thin:
  L_tier = ( n_eff * L_raw + k * L_locked ) / ( n_eff + k )      with k = 5

P_tier = sigmoid( L_tier )
```

Also compute and display, always: `n`, `n_eff`, and the interquartile range of `p_v` rendered as
a band behind the line. **A tier line without its n and its spread is a lie**; the UI never
draws one.

Extremisation (`P = sigmoid(d * L)` with `d ≈ 1.2`) is a known accuracy improvement for pooled
forecasts. Ship with `d = 1.0` and leave the knob in the manifest — do not extremise opinions we
have not scored.

Public and expert tiers vote on **node seed curves only**, never on edge weights (a weight is
not a proposition a lay voter can hold a belief about) and never on terminal buckets (derived).
Experts may additionally file *proposals* — a suggested edge, a new node, a source — which land
in a review queue and become git PRs. That is the mechanism by which the locked graph evolves.

## 2.9 The equations tab, in the words it should actually use

> Every branch has its own likelihood. They are not slices of a pie — several can be true at
> once. We keep a curated starting number for each branch at a few years, and connect branches
> with arrows that carry a single strength number.
>
> When you move a branch, we convert every probability into *odds*, add the arrow strengths, and
> convert back. Odds make this work: adding +1 to a branch roughly triples its odds whether it
> started at 1% or 40%, which is what "this makes it a lot more likely" should mean.
>
> Some arrows point both ways (unemployment feeds oligarchy feeds unemployment). We just repeat
> the calculation until the numbers stop changing — usually about twenty passes.
>
> At the end we ask a different question: *how did the century actually go?* Those six answers
> ARE exclusive, so we score each one from the branch likelihoods and normalise so they add to
> 100%. That last step is a summary, not a mechanism.

---

# 3. INFRA

## 3.1 Recommendation

**Firebase on the existing GCP project `gen-lang-client-0281141814`, talked to directly from the
browser, with security rules doing the authorisation and one nightly Cloud Run job doing the
aggregation.** No new API server for v0/v1.

| Tier | Storage | Auth | Effort |
|---|---|---|---|
| LOCKED | JSON files in git, bundled into the Vite build via `import.meta.glob('/futures/nodes/*.json')` | none (read-only) | zero infra |
| EXPERT | Firestore `votes` | Firebase Auth email magic link + one-time invite code | ~1 day of auth wiring |
| PUBLIC | Firestore `votes` | Firebase Auth anonymous + App Check | ~1 day |

Why not the alternatives:

- **Cloud Run + SQLite/Litestream** — breaks the moment Cloud Run autoscales past one instance,
  and this service scales to zero. Litestream replication plus single-instance pinning is more
  operational surface than the whole feature.
- **Supabase** — genuinely nice, but it is a second vendor, a second billing relationship, and a
  second auth system in a project that already lives entirely in one GCP project.
- **Static JSON + GitHub PR for all edits** — perfect for LOCKED, hopeless for public voting
  (a PR per vote). Use it for exactly the tier it fits.
- **Custom API server** — needed only when you want server-side vote validation beyond what
  rules express. Firestore rules already express "one vote doc per user per node per year, and
  you may only write your own". Add the server in v2 if moderation demands it; the client
  service layer (`graphStorage.ts`) is written against an interface so the swap is contained —
  the same shape as the existing `src/services/modelStorage.ts`, which was already written to be
  cloud-swappable.

**If a server does become necessary**, add a second Cloud Run service and proxy it from the
existing nginx (`location /api/ { proxy_pass https://futures-api-...; }` in
`deploy/nginx.conf.template`) so it stays same-origin — no CORS, no third-party-cookie problems.

## 3.2 Collections

```
graphs/{graphId}
    title, graphVersion, schemaVersion, updatedAt, publishedCommit, locked: true

graphs/{graphId}/nodes/{nodeId}            # mirror of the git file, written only by CI
    ...Node fields, plus publishedAt, publishedCommit

users/{uid}
    tier: "public" | "expert" | "editor"
    displayName, affiliation (expert, optional, public), invitedBy, createdAt,
    voteCount, flagged: bool

invites/{code}                             # editor-created, single-use by default
    tier: "expert", maxUses, usedBy: [uid], expiresAt, createdBy, note

votes/{uid}_{graphId}_{nodeId}_{year}      # deterministic id == idempotent upsert, no dupes
    uid, graphId, nodeId, year, p, tierAtVote, createdAt, updatedAt, comment (<=280),
    clientHash (for abuse triage; never displayed)

aggregates/{graphId}_{tier}_{nodeId}       # recomputed nightly + on write (see 3.4)
    year -> { p, n, nEff, q25, q75, updatedAt }

snapshots/{graphId}/{asOf}/{tier}          # asOf = YYYY-MM-DD; frozen copy of aggregates
    nodes: { nodeId: { year -> {p, n, nEff, q25, q75} } }, computedAt

proposals/{proposalId}                     # expert-suggested node/edge/source changes
    kind, payload, rationale, uid, status: open|merged|declined, prUrl

flags/{flagId}
    targetType, targetId, uid, reason, createdAt, resolved
```

Security rules, in one breath: anyone signed in may create/update **their own** `votes/{uid}_…`
doc, with `p` a number in [0,1] and `year` inside the horizon; nobody may write `aggregates`,
`snapshots`, `nodes`, or `users.tier` (server/CI only); `invites` are readable only by the
redeeming Cloud Function. Deterministic vote doc ids make ballot-stuffing per account
structurally impossible — one account, one vote per (node, year).

## 3.3 API surface

If/when the API server exists, these seven endpoints are the whole thing. Until then, endpoints
1, 2 and 6 are client-side Firestore reads and 3 is a client-side write.

| # | Endpoint | Purpose |
|---|---|---|
| 1 | `GET /api/graph/:graphId?tier=locked\|expert\|public\|all` | Nodes + edges + the requested tier's aggregates, in one payload. Cached at the CDN for 5 min. |
| 2 | `GET /api/graph/:graphId/aggregates?tier=&nodeId=` | Just the numbers, for polling without re-fetching structure |
| 3 | `POST /api/votes` | Batch upsert, up to 40 `{nodeId, year, p, comment}` items per call |
| 4 | `GET /api/me` | uid, tier, my votes, remaining rate-limit budget |
| 5 | `POST /api/invites/redeem` `{code}` | Promotes the caller to `expert` |
| 6 | `GET /api/history/:graphId?target=node:hlmi-agi&tier=&from=&to=` | The **asOf** series — "how expert opinion on AGI timing moved over the last 18 months" |
| 7 | `POST /api/flags` | Report a node, a comment, or a vote pattern |
| 8 | `POST /api/admin/publish` | CI-only. Pushes the git graph into `graphs/{id}/nodes`, bumps `graphVersion`. |

## 3.4 How the two time series are reconstructible

- **Scenario-year series** (`P` vs year 2025…2060) is not stored — it is *computed* in the
  browser from anchors + edges every time. Nothing to persist.
- **asOf series** (how beliefs moved over wall-clock months) is stored as
  `snapshots/{graphId}/{asOf}/{tier}` written by a Cloud Scheduler → Cloud Run job at 03:00 UTC
  daily. A snapshot for 20 nodes x 36 years x 5 fields is ~50 KB; 5 years of daily snapshots for
  three tiers is under 300 MB, comfortably inside Firestore's free-ish tier, and daily granularity
  is far finer than opinion actually moves. Keep daily for 90 days, then thin to weekly, then
  monthly — a 20-line retention job.
- For LOCKED, the asOf history is simply `git log` over `futures/nodes/`. A tiny CI step writes
  `futures/history.json` (per node, per commit: the anchors and the commit message) at build time
  so the client can chart curated changes without a GitHub API call.

## 3.5 Effort estimate (experienced dev + Claude Code)

| Piece | Days |
|---|---|
| Schema + validator + migration harness + fixtures | 1.5 |
| Engine (`src/futures/engine.ts`) + tests (convergence, monotonicity, terminal sum, baseline reproduces seeds) | 2 |
| Seeding the 20-node graph with real, checked citations | 2 (mostly research, not code) |
| Timeline lanes + terminal strip + year scrubber (primary viz) | 2.5 |
| DAG view + node detail + what-moved + nudging + URL share | 2.5 |
| Equations tab copy + story mode v1 | 1 |
| **v0 subtotal** | **11.5** |
| Firebase project wiring, rules, magic-link + invites, vote UI | 3 |
| Aggregation job + tier overlays + n/IQR display | 2 |
| **v1 subtotal** | **5** |
| Anonymous auth + App Check + rate limits + moderation queue | 2.5 |
| Snapshots, retention, asOf history chart | 2 |
| Proposals → PR flow, Gemini narrative drafting | 2 |
| **v2 subtotal** | **6.5** |
| **Total** | **~23 days** |

---

# 4. VISUALS

## 4.1 Candidates

**A. Layered DAG (dagre/elk), node fill level = P.** Best at showing *structure* — which is the
stated goal ("make the branch structure legible"). But 20 nodes and 34 edges on a 375px phone is
a hairball, and the fill-level encoding competes with the node label for the same pixels.
→ Keep it, but as a secondary, on-demand view.

**B. Sankey ribbons whose width = P, fanning out and merging.** **Reject as primary, and say why
out loud.** Sankey encodes *conserved flow*: width in equals width out, and every split is a
partition. The single most important fact about this model is that branches are NOT a partition.
A Sankey would visually assert the exact falsehood the project exists to correct. Users would
read "mass unemployment" and "good outcome" as competing for the same 100%. Do not build it.

**C. Timeline swimlanes / ridgeline: x = year, one lane per node, filled area height = P(year).**
→ **Primary.** Non-exclusivity is free (lanes don't stack, so nothing implies they sum). Time
variation — the owner's core requirement — is the primary encoding rather than an afterthought.
It scrolls vertically, which is what phones are for. Twenty 56px lanes is a 1,100px scroll: one
thumb-flick. Adding a node adds a lane; the layout never needs to be re-thought.

## 4.2 The primary screen

```
┌─────────────────────────────────────────┐
│  AI FUTURES MAP        [Locked ▾] [ⓘ]   │   tier selector, about
├─────────────────────────────────────────┤
│  HOW IT GOES BY 2050                    │
│  ███████░░░░░░░░░░▒▒▒▒▒▓▓▓░░▒░           │   terminal strip (100% stacked)
│  Flourish 18 · Muddle 34 · Stratify 22  │   ← the ONLY stacked thing
├─────────────────────────────────────────┤
│  ▼ CAPABILITY                    4 ▾    │
│  ┌───────────────────────────────────┐  │
│  │ Broad cognitive automation    60% │  │   lane: filled area, x = 2025→2060
│  │ ▁▁▂▃▅▆▇███████████████            │  │   ghost dashed line = another tier
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ AGI / HLMI                    35% │  │
│  │ ▁▁▁▂▃▄▅▆▇▇████                     │  │
│  └───────────────────────────────────┘  │
│  ▼ GOVERNANCE                    4 ▾    │
│   …                                     │
├─────────────────────────────────────────┤
│  2025 ──────────●────────────── 2060    │   year scrubber, pinned bottom
│              2040                       │
└─────────────────────────────────────────┘
```

- Lanes group into the five categories, each collapsible (`<details>`-style), collapsed to
  Good/Bad/Existential on first load so the phone opens on ~9 lanes not 20.
- The year scrubber is pinned; moving it updates every lane's readout number and the terminal
  strip's marker in real time (the engine is fast enough — see 2.5).
- Tapping a lane opens a bottom sheet: statement, narrative, sources with a SEED chip, the nudge
  slider, the tier comparison, "what this affects" and "what affects this" (tappable, navigates
  the DAG), and — v1 — "your estimate".
- Uncertainty is never hidden: every non-locked line carries a q25–q75 band; the locked line
  carries a `confidence: low` hatch pattern instead of a band.

## 4.3 Secondary and tertiary views

**Influence DAG** — full-screen sheet, opened from a node or from a "See the whole map" button.
`dagre` for layered layout (left→right on desktop, top→bottom on mobile), React renders the SVG.
Node fill = P at the scrubbed year; edge stroke width = |weight|; edge colour = sign (a
colourblind-safe blue/orange pair, never red/green); hovering/tapping a node dims everything not
on a path through it. On mobile it opens focused on the tapped node at depth 2 with a
"expand" affordance — never the full 20-node hairball as a first impression.

**Terminal strip** — a 100% stacked area chart over years, the one legitimate use of stacking
here because those buckets genuinely partition. Six bands, ordered good→bad, with the existential
band always at the bottom edge and never smaller than 2px so it cannot visually vanish.

**Story mode** — a vertically-scrolling narrative that walks one path: pick an ending
("Authoritarian lock-in"), and it walks backwards through the highest-contribution nodes,
one screen each, using the node `narrative` field and the edge `note` field, with that node's
lane animating in beside the prose. Fully authored from the JSON — no LLM needed at read time.
Gemini (already wired in `services/geminiService.ts`) can *draft* narratives at edit time for a
curator to approve, which keeps generated text out of the runtime path.

## 4.4 Comparing the three tiers

Primary comparison is **overlay within the same lane**, because that's the comparison people
actually want ("do experts think this is likelier than the curated view?"):

- LOCKED = filled area (the ground truth of the page).
- EXPERT = solid 2px stroke.
- PUBLIC = dashed 1.5px stroke.
- Distinguished by weight and dash pattern, not colour alone. Colour stays reserved for
  category.

Plus:

- A **Δ chip** on each lane when tiers disagree by more than 8pp at the scrubbed year:
  `Experts +14pp`. Tapping it opens the comparison sheet.
- A dedicated **Disagreement view**: all 20 nodes as a single dot-plot column (locked dot,
  expert dot, public dot per row) sorted by spread. This one screen answers "where do the tiers
  actually differ?" better than any overlay, and it fits a phone.
- **Small multiples** of the DAG only on desktop ≥1024px — three side-by-side DAGs are unusable
  below that, and pretending otherwise is how mobile-first dies.
- Every tier line is labelled with `n` inline (`Experts (n=34)`); a tier with n_eff < 5 renders
  greyed with "not enough estimates yet" rather than a misleadingly confident line.

## 4.5 Components and the D3/React split

**Rule: D3 computes, React renders.** Use `d3-scale`, `d3-shape` (`area`, `line`, `curveMonotoneX`),
`d3-array`, and `dagre` for layout maths; React owns every DOM node. This differs deliberately
from the existing `components/WorldMap.tsx`, which lets D3 own the DOM — correct there because
`d3-geo` + `d3-zoom` want it, wrong here where every mark is data-bound React state that changes
on every scrubber frame.

```
components/futures/
  FuturesMapTab.tsx        container: graph, tier, year, nudges; owns the engine call
  TerminalStrip.tsx        100% stacked area + legend
  LaneGroup.tsx            collapsible category section
  NodeLane.tsx             one node's area chart + tier overlays + Δ chip     (pure, memoised)
  YearScrubber.tsx         pinned range control, keyboard + touch
  NodeSheet.tsx            bottom sheet: statement, sources, nudge, vote, neighbours
  NudgeSlider.tsx          pin/offset toggle + reset
  WhatMovedList.tsx        sorted ΔP list with causal path chips
  InfluenceGraph.tsx       dagre layout, React-rendered SVG, focus mode
  DisagreementView.tsx     dot-plot of tier spread
  StoryMode.tsx            scroll-driven narrative
  TierSelect.tsx           segmented control
  SeedChip.tsx / SourceList.tsx
src/futures/
  engine.ts  aggregate.ts  graphLoader.ts  graphValidator.ts  types.ts  migrations/
```

Mobile-first specifics that must be in the acceptance criteria: no horizontal scroll anywhere;
minimum 44px tap targets; lanes readable at 340px width; the DAG never the landing view; the
year scrubber reachable with a thumb; SVG text never below 11px; full keyboard operation of the
scrubber and lanes; every lane has an accessible text summary
(`"AGI by 2040: 35 percent, rising"`) for screen readers.

---

# 5. WHAT TO BUILD FIRST

## v0 — "The curated map" (~11 days, no backend, no accounts)

Ship: the schema + validator + migration harness; the pure engine with tests; the 20-node seeded
graph with real citations; timeline lanes + terminal strip + year scrubber; the DAG sheet; node
nudging with the what-moved list; `#futures=` share links; the equations tab.

Demo: "here are the twenty ways this goes, here is how likely each is by year, drag *this* one
and watch nine others move, now send me your version as a link."

Done when: `npm run check` passes including a new `validate:futures` step; the page is usable on
a 375px phone; every number on screen can be traced to a source chip in two taps.

## v1 — "Experts disagree with us" (~5 days)

Ship: Firebase Auth magic link + invite redemption; the vote UI in the node sheet; the nightly
aggregation job; expert overlay lines with n and IQR; the Disagreement view; the proposals queue
(as a form that opens a pre-filled GitHub issue — do not build a PR bot yet).

Demo: "thirty people who work on this for a living think the takeover number is double ours,
and here's the spread."

## v2 — "Everyone, over time" (~7 days)

Ship: anonymous auth + App Check + rate limits; public tier line; moderation queue and flags;
daily snapshots + retention; the asOf "how our beliefs moved" chart; story mode; Gemini-drafted
narratives behind a curator approval step.

Demo: "public opinion on AI extinction risk moved 6 points in eight months; experts didn't move."

Deliberately **not** in the plan: coupling-weight voting, real-money prediction markets,
per-country versions of the graph, and any auto-merge of votes into the locked tier. Each is a
plausible v3; none is needed to be useful, and each triples the surface area.

---

# THE THREE BIGGEST RISKS

**1. False precision destroys credibility on contact.** The moment this is public, someone
screenshots "8% extinction" and it becomes *the site's claim*. It is one curator's seed. Every
mitigation must be structural, not a disclaimer nobody reads: the SEED chip is rendered at the
same visual weight as the number itself; the default view shows a range not a point wherever the
tier has one; `confidence: low` renders the curve hatched; the About sheet names the seeder and
links the git history; and the tier selector is in the header from the first frame so "this is a
contested estimate" is the page's opening statement rather than a footnote. Also: pick the
existential seed to *match a citable survey median*, never a personal judgement — the seed above
is chosen for exactly that reason.

**2. The coupling weights are unfalsifiable and will rot.** Twenty nodes admit 380 possible
edges; nobody can defend 380 numbers, and after two years of drive-by edits the graph produces
outputs no one can explain. Mitigations, all enforced in CI: a hard edge budget of 3× node count;
`note` is a *required* field on every edge and is shown in the UI whenever the edge is
traversed; a `max 5 parents` schema cap; and a **sensitivity report** in `npm run validate` that
zeroes each edge in turn and flags any whose removal shifts a terminal bucket by more than 5pp —
those edges get a `contested` tag and extra review on every touch. Plus the golden-file test, so
every coefficient change surfaces as an explicit numeric diff in the PR rather than hiding
inside a refactor.

**3. The public tier gets brigaded, and it poisons the whole page.** An AI-risk map is a
magnet for coordinated voting from every direction. Structural mitigations: public votes are
*displayed* but never feed the locked or expert tiers, and never feed the terminal buckets;
deterministic vote doc ids make one-account-one-vote a database constraint rather than a policy;
App Check + per-IP and per-account write limits; 10% trimming at both tails; `n` and `n_eff`
always on screen so a 40-vote tier cannot masquerade as a consensus; a curator kill-switch that
freezes the public tier to its last snapshot without taking the page down. Accept up front that
the public tier's job is to show *what the public believes*, which is interesting data even when
it is wrong — the failure mode to prevent is public votes being mistaken for evidence about the
world.

**Runner-up risk worth naming:** the two time axes (`year` vs `asOf`) will be confused by users,
by contributors, and by future-you. Name them differently everywhere — in the schema, the API,
the component props, and the UI copy ("by 2040" vs "as of March") — and never put both on the
same chart.

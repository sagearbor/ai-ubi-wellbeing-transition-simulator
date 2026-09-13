# AI Futures Map — Fable proposal

Opinionated summary up front:

* **Model = influence DAG over non-exclusive events + one or more exclusive "outcome axes" at a horizon.**
  Not a Bayesian network (CPTs are un-elicitable and explode); not a scenario tree (forces exclusivity).
* **Two time axes, kept rigorously separate:** *horizon* (by which year does X happen) and *as-of* (when the
  estimate was made). Each node stores a small cumulative curve `P(X by year)` at 4 fixed horizons; every
  estimate is an append-only record stamped `asOf`; daily aggregate snapshots rebuild the history chart.
* **Votes are on marginals; the graph is only for what-if propagation.** That one rule kills double counting
  and keeps the community layer and the structure layer independent. Propagation is a log-odds delta pushed
  through signed coupling weights in topological order, then exclusive axes are renormalised.
* **Aggregation in log-odds space, median for public, trimmed weighted mean for experts, 180-day recency
  decay, latest estimate per user per node only.**
* **Infra: locked graph = JSON in git, bundled; votes = Firestore + Firebase Auth (anon + email-link with
  invite code) on the GCP project you already have; nightly aggregate job; nginx image unchanged.**
* **Primary visual = "river" timeline** (x = year, band thickness = P(t), bands may overlap because events
  aren't exclusive) ending in a **stacked outcome strip** that sums to 1. Secondary = influence DAG for the
  what-if nudging. Mobile = node cards with sparklines.

---

## 1. Data model

### 1.1 Concepts

| Concept | What it is | Exclusive? | Voted on? |
|---|---|---|---|
| `event` node | Something that happens (or a state that becomes true) by some year. "AGI exists", "Mass labour displacement", "Oligarchic capture" | No — any subset may co-occur | Yes: `P(happened by year h)` at fixed horizons |
| `outcome` node | A terminal bucket on an `axis` at the map's horizon year | Yes within its axis (sum = 1) | Yes: probability mass at the horizon |
| `axis` | A named partition of the horizon-year world into exclusive outcomes, e.g. `trajectory-2045` = {flourishing, muddling, catastrophic-recoverable, existential} | — | — |
| `edge` | Signed influence `from → to` with strength in [-1, 1] and a kind | — | v2: yes (strength); v0/v1: locked only |
| `estimate` | One person's curve for one node, at one `asOf` date, in one tier | — | — |
| `snapshot` | Aggregate of all estimates in a tier as of a date | — | — |

Sub-extinction bad outcomes ("mass unemployment without a safety net", "exponential rich/poor divide")
are **event nodes**, so they legitimately co-occur with good events *and* with the `muddling` outcome.
Only the axis buckets are exclusive. That's the whole trick for "non-exclusive branches".

### 1.2 Fixed horizons

`horizons: [2028, 2030, 2035, 2045]` (map-level constant, editable per graph version). Four points is
enough for a curve, few enough that a voter can fill a card in 20 seconds. Curves are cumulative and
must be non-decreasing in year for `event` nodes ("once it has happened it stays happened"; state-like
nodes such as *race dynamics* are worded as "has occurred at some point by year").

### 1.3 Schema (JSON Schema draft-07, matches `schemas/modelConfig.schema.json` style; validated with ajv)

File: `schemas/futuresGraph.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "FuturesGraph",
  "type": "object",
  "required": ["schemaVersion", "graphVersion", "horizons", "nodes", "edges", "axes", "metadata"],
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "type": "integer", "const": 1 },
    "graphVersion":  { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}(\\.\\d+)?$" },
    "horizons": { "type": "array", "items": { "type": "integer" }, "minItems": 2, "maxItems": 8 },
    "axes": {
      "type": "array",
      "items": {
        "type": "object", "required": ["id", "label", "horizon", "outcomes"], "additionalProperties": false,
        "properties": {
          "id":       { "type": "string", "pattern": "^[a-z0-9-]+$" },
          "label":    { "type": "string" },
          "horizon":  { "type": "integer" },
          "outcomes": { "type": "array", "items": { "type": "string" }, "minItems": 2 }
        }
      }
    },
    "nodes": {
      "type": "array", "minItems": 1, "maxItems": 200,
      "items": {
        "type": "object",
        "required": ["id", "kind", "label", "lane", "valence", "summary", "seed"],
        "additionalProperties": false,
        "properties": {
          "id":      { "type": "string", "pattern": "^[a-z0-9-]+$", "maxLength": 40 },
          "kind":    { "enum": ["event", "outcome"] },
          "label":   { "type": "string", "maxLength": 60 },
          "lane":    { "enum": ["capability", "governance", "economy", "society", "catastrophe", "flourishing", "outcome"] },
          "valence": { "enum": ["good", "bad", "neutral", "mixed"] },
          "severity":{ "enum": ["none", "disruptive", "catastrophic", "existential"] },
          "summary": { "type": "string", "maxLength": 300 },
          "operationalisation": { "type": "string", "maxLength": 600,
            "description": "The resolvable criterion. Forecasters must agree what counts." },
          "seed": {
            "type": "object", "required": ["curve", "source"], "additionalProperties": false,
            "properties": {
              "curve":  { "$ref": "#/definitions/Curve" },
              "source": { "type": "string" },
              "asOf":   { "type": "string", "format": "date" }
            }
          },
          "evidence": { "type": "array", "items": { "$ref": "#/definitions/Evidence" } },
          "axis":     { "type": "string", "description": "outcome nodes only" },
          "since":    { "type": "string", "description": "graphVersion that introduced this node" },
          "retired":  { "type": "string", "description": "graphVersion that retired it" },
          "supersededBy": { "type": "string" },
          "tags":     { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "edges": {
      "type": "array",
      "items": {
        "type": "object", "required": ["from", "to", "kind", "strength"], "additionalProperties": false,
        "properties": {
          "from":     { "type": "string" },
          "to":       { "type": "string" },
          "kind":     { "enum": ["requires", "enables", "amplifies", "prevents", "dampens"] },
          "strength": { "type": "number", "minimum": -1, "maximum": 1 },
          "rationale":{ "type": "string", "maxLength": 300 },
          "lag":      { "type": "integer", "minimum": 0, "maximum": 20,
            "description": "years between cause and effect becoming visible; used only for drawing and for the requires-clamp" }
        }
      }
    },
    "metadata": {
      "type": "object", "required": ["editors", "changelog"], "additionalProperties": false,
      "properties": {
        "editors":   { "type": "array", "items": { "type": "string" } },
        "changelog": { "type": "array", "items": { "type": "object",
          "required": ["graphVersion", "date", "note"], "properties": {
            "graphVersion": { "type": "string" }, "date": { "type": "string" }, "note": { "type": "string" } } } }
      }
    }
  },
  "definitions": {
    "Curve": {
      "description": "Cumulative P(node true by year). Keys are horizon years as strings. Event curves must be non-decreasing (validated in code, not schema).",
      "type": "object",
      "patternProperties": { "^\\d{4}$": { "type": "number", "minimum": 0, "maximum": 1 } },
      "additionalProperties": false
    },
    "Evidence": {
      "type": "object", "required": ["title", "date", "direction"], "additionalProperties": false,
      "properties": {
        "title": { "type": "string" }, "url": { "type": "string", "format": "uri" },
        "date": { "type": "string" },
        "direction": { "enum": ["up", "down", "context"] },
        "note": { "type": "string", "maxLength": 300 }
      }
    }
  }
}
```

Rules enforced in code (`src/futures/validateGraph.ts`), not in the schema:

1. Graph must be acyclic. Cycles are the biggest source of "the numbers won't settle"; feedback loops are
   expressed as two nodes at different horizons (e.g. `race-dynamics` → `rsi` → `race-dynamics-2035`) if ever
   truly needed. In practice a couple of extra nodes beats a solver.
2. `requires` edges imply `P(to, h) ≤ P(from, h - lag)` — validator warns on seed violations; propagation clamps.
3. Every `outcome` node names an `axis`; each axis's seed masses sum to 1 ± 0.01.
4. `retired` nodes stay in the file forever (estimates reference them) but are hidden by default.
5. `id` never changes. Relabel freely; re-id never.

### 1.4 Evolving the graph over years

* One file per graph version is NOT the plan — one file `data/futures/graph.json`, edited in git, with
  `graphVersion` bumped (date-based) and a changelog entry. Git history *is* the version store for structure.
* Estimates and snapshots (in Firestore) record `graphVersion` so a node's history chart can mark
  "definition changed here" ticks.
* Adding a node: add it, give it a `seed`, `since`. Aggregates start empty; UI shows "new — n=0".
* Splitting/merging: retire old id(s) with `supersededBy`; do not migrate estimates (re-asking is honest).
* Schema migration: `schemaVersion` int + `src/futures/migrate.ts` with `migrate1to2` etc., same pattern as
  any app; ajv validates after migration. Tests load every historical fixture under `examples/futures/`.

### 1.5 Worked example graph (18 nodes, 4 outcomes, 26 edges)

Seeds are **rough, labelled, and meant to be argued with**. Sources mixed: AI Impacts ESPAI 2023
(median 5% extreme outcome; 50% HLMI by ~2047), Forecasting Research Institute XPT 2022 (AI extinction by
2100: superforecasters ≈0.4%, domain experts ≈3%), Metaculus community (weak AGI ~2027–2031 range in
2024–25), public statements (Hinton "10–20%", Amodei "10–25%", Christiano ~20% cumulative, Yudkowsky
">90%"), AI-2027 scenario, and this week's ">10% in 10 years" discourse. Curves are `P(by year)`.

```json
{
  "schemaVersion": 1,
  "graphVersion": "2026-09-09",
  "horizons": [2028, 2030, 2035, 2045],
  "axes": [
    { "id": "trajectory-2045", "label": "Where humanity is in 2045", "horizon": 2045,
      "outcomes": ["flourishing", "muddling", "catastrophic-recoverable", "existential"] }
  ],
  "nodes": [
    { "id": "agi", "kind": "event", "lane": "capability", "valence": "neutral", "severity": "none",
      "label": "AGI-level systems exist",
      "summary": "AI matches expert humans on most economically valuable cognitive tasks.",
      "operationalisation": "A system passes a broad expert-level battery (e.g. ≥90% on a held-out professional exam suite across ≥8 fields) and runs multi-week autonomous projects.",
      "seed": { "curve": { "2028": 0.25, "2030": 0.45, "2035": 0.70, "2045": 0.85 },
                "source": "Metaculus weak-AGI 2024-25 + ESPAI 2023 shifted earlier", "asOf": "2026-09-09" } },

    { "id": "rsi", "kind": "event", "lane": "capability", "valence": "mixed", "severity": "none",
      "label": "Recursive self-improvement",
      "summary": "AI R&D is mostly done by AI; capability doubling time under one year.",
      "seed": { "curve": { "2028": 0.05, "2030": 0.20, "2035": 0.40, "2045": 0.50 },
                "source": "AI-2027 scenario upper branch discounted ~2x" } },

    { "id": "labor-displacement", "kind": "event", "lane": "economy", "valence": "mixed", "severity": "disruptive",
      "label": "Mass labour displacement",
      "summary": "≥25% of 2025 work-hours automated; measurable labour-share collapse in OECD.",
      "seed": { "curve": { "2028": 0.10, "2030": 0.30, "2035": 0.65, "2045": 0.85 },
                "source": "editorial; consistent with this repo's simulator base case" } },

    { "id": "race-dynamics", "kind": "event", "lane": "governance", "valence": "bad", "severity": "none",
      "label": "Frontier race with cut corners",
      "summary": "US/China/lab race where safety timelines are visibly compressed to win.",
      "seed": { "curve": { "2028": 0.60, "2030": 0.70, "2035": 0.75, "2045": 0.75 }, "source": "editorial" } },

    { "id": "compute-governance", "kind": "event", "lane": "governance", "valence": "good", "severity": "none",
      "label": "Binding international AI regime",
      "summary": "Treaty-level compute/training controls with verification, signed by US+China.",
      "seed": { "curve": { "2028": 0.05, "2030": 0.12, "2035": 0.30, "2045": 0.45 }, "source": "editorial" } },

    { "id": "alignment-adequate", "kind": "event", "lane": "governance", "valence": "good", "severity": "none",
      "label": "Alignment/control adequate at frontier",
      "summary": "Independent evals confirm frontier systems reliably obey and are corrigible at deployment scale.",
      "seed": { "curve": { "2028": 0.10, "2030": 0.25, "2035": 0.45, "2045": 0.60 }, "source": "editorial" } },

    { "id": "redistribution", "kind": "event", "lane": "economy", "valence": "good", "severity": "none",
      "label": "Redistribution keeps pace",
      "summary": "UBI / AI dividend / sovereign wealth covering ≥50% of displaced income in major economies.",
      "seed": { "curve": { "2028": 0.03, "2030": 0.10, "2035": 0.30, "2045": 0.50 }, "source": "editorial" } },

    { "id": "unemployment-no-net", "kind": "event", "lane": "society", "valence": "bad", "severity": "disruptive",
      "label": "Mass unemployment without a safety net",
      "summary": "Displacement outruns redistribution for 5+ years: >15% structural unemployment somewhere G7.",
      "seed": { "curve": { "2028": 0.05, "2030": 0.18, "2035": 0.40, "2045": 0.45 }, "source": "editorial" } },

    { "id": "oligarchic-capture", "kind": "event", "lane": "society", "valence": "bad", "severity": "catastrophic",
      "label": "Oligarchic capture",
      "summary": "Wealth/power from AI concentrates in <100 entities; inequality diverges and stays.",
      "seed": { "curve": { "2028": 0.10, "2030": 0.20, "2035": 0.40, "2045": 0.50 }, "source": "editorial" } },

    { "id": "surveillance-lockin", "kind": "event", "lane": "society", "valence": "bad", "severity": "catastrophic",
      "label": "AI-enabled authoritarian lock-in",
      "summary": "A major power establishes a durable, AI-run surveillance state that cannot be reformed.",
      "seed": { "curve": { "2028": 0.08, "2030": 0.15, "2035": 0.25, "2045": 0.35 }, "source": "editorial" } },

    { "id": "epistemic-collapse", "kind": "event", "lane": "society", "valence": "bad", "severity": "disruptive",
      "label": "Epistemic collapse",
      "summary": "Synthetic media + persuasion agents make shared factual reality unrecoverable for majorities.",
      "seed": { "curve": { "2028": 0.15, "2030": 0.25, "2035": 0.35, "2045": 0.40 }, "source": "editorial" } },

    { "id": "bio-cyber", "kind": "event", "lane": "catastrophe", "valence": "bad", "severity": "catastrophic",
      "label": "AI-enabled bio/cyber catastrophe",
      "summary": "An AI-assisted attack causing ≥1M deaths or a global-infrastructure outage.",
      "seed": { "curve": { "2028": 0.02, "2030": 0.05, "2035": 0.12, "2045": 0.20 }, "source": "XPT 2022 catastrophic-risk medians, scaled" } },

    { "id": "great-power-war", "kind": "event", "lane": "catastrophe", "valence": "bad", "severity": "catastrophic",
      "label": "AI-precipitated great-power war",
      "summary": "Direct US–China (or NATO–Russia) war where AI race or AI weapons are a primary cause.",
      "seed": { "curve": { "2028": 0.03, "2030": 0.06, "2035": 0.12, "2045": 0.18 }, "source": "editorial" } },

    { "id": "misaligned-takeover", "kind": "event", "lane": "catastrophe", "valence": "bad", "severity": "existential",
      "label": "Misaligned AI takeover",
      "summary": "AI systems seize decisive control against human wishes (the 'Terminator' path, minus robots).",
      "seed": { "curve": { "2028": 0.005, "2030": 0.02, "2035": 0.06, "2045": 0.09 },
                "source": "ESPAI 2023 median 5%; public 10-20% statements; XPT ~0.4-3% by 2100" } },

    { "id": "gradual-disempowerment", "kind": "event", "lane": "catastrophe", "valence": "bad", "severity": "existential",
      "label": "Gradual human disempowerment",
      "summary": "No coup; humans just stop being needed for the economy, military and state, and lose all leverage.",
      "seed": { "curve": { "2028": 0.01, "2030": 0.03, "2035": 0.08, "2045": 0.15 }, "source": "Kulveit et al. 2025 'Gradual Disempowerment', editorial numbers" } },

    { "id": "abundance", "kind": "event", "lane": "flourishing", "valence": "good", "severity": "none",
      "label": "Material abundance",
      "summary": "Real cost of a median consumption basket falls >50%; energy and goods effectively cheap.",
      "seed": { "curve": { "2028": 0.03, "2030": 0.08, "2035": 0.30, "2045": 0.55 }, "source": "editorial" } },

    { "id": "medical-breakthroughs", "kind": "event", "lane": "flourishing", "valence": "good", "severity": "none",
      "label": "Medical breakthroughs",
      "summary": "AI-driven cures for ≥3 of the top-10 causes of death; healthy lifespan +5y in rich countries.",
      "seed": { "curve": { "2028": 0.05, "2030": 0.15, "2035": 0.45, "2045": 0.70 }, "source": "editorial; 'compressed 21st century' essay discounted" } },

    { "id": "broad-flourishing", "kind": "event", "lane": "flourishing", "valence": "good", "severity": "none",
      "label": "Broad human flourishing",
      "summary": "Abundance + redistribution + intact institutions: global wellbeing indices up across all quintiles.",
      "seed": { "curve": { "2028": 0.02, "2030": 0.05, "2035": 0.20, "2045": 0.35 }, "source": "editorial" } },

    { "id": "flourishing", "kind": "outcome", "axis": "trajectory-2045", "lane": "outcome", "valence": "good",
      "label": "Flourishing", "summary": "Abundance shared, institutions intact, humans in control.",
      "seed": { "curve": { "2045": 0.30 }, "source": "editorial" } },
    { "id": "muddling", "kind": "outcome", "axis": "trajectory-2045", "lane": "outcome", "valence": "mixed",
      "label": "Muddling through", "summary": "Big gains, big disruptions, nobody in charge, no catastrophe.",
      "seed": { "curve": { "2045": 0.45 }, "source": "editorial" } },
    { "id": "catastrophic-recoverable", "kind": "outcome", "axis": "trajectory-2045", "lane": "outcome", "valence": "bad",
      "label": "Catastrophe, recoverable", "summary": "War, lock-in, or mass-casualty event; civilisation persists.",
      "seed": { "curve": { "2045": 0.17 }, "source": "editorial" } },
    { "id": "existential", "kind": "outcome", "axis": "trajectory-2045", "lane": "outcome", "valence": "bad",
      "label": "Existential", "summary": "Extinction or permanent, irreversible loss of human control.",
      "seed": { "curve": { "2045": 0.08 }, "source": "ESPAI median 5% + recent discourse" } }
  ],
  "edges": [
    { "from": "agi", "to": "rsi",                    "kind": "requires",  "strength": 0.9, "lag": 1 },
    { "from": "agi", "to": "labor-displacement",     "kind": "amplifies", "strength": 0.7, "lag": 2 },
    { "from": "agi", "to": "abundance",              "kind": "enables",   "strength": 0.6, "lag": 4 },
    { "from": "agi", "to": "medical-breakthroughs",  "kind": "enables",   "strength": 0.6, "lag": 3 },
    { "from": "agi", "to": "misaligned-takeover",    "kind": "requires",  "strength": 0.8, "lag": 1 },
    { "from": "agi", "to": "gradual-disempowerment", "kind": "requires",  "strength": 0.7, "lag": 3 },
    { "from": "rsi", "to": "misaligned-takeover",    "kind": "amplifies", "strength": 0.6, "lag": 0 },
    { "from": "rsi", "to": "race-dynamics",          "kind": "amplifies", "strength": 0.4, "lag": 0 },
    { "from": "race-dynamics", "to": "alignment-adequate", "kind": "dampens",  "strength": -0.5, "lag": 0 },
    { "from": "race-dynamics", "to": "great-power-war",    "kind": "amplifies","strength": 0.4, "lag": 2 },
    { "from": "race-dynamics", "to": "compute-governance", "kind": "dampens",  "strength": -0.4, "lag": 0 },
    { "from": "compute-governance", "to": "race-dynamics",       "kind": "prevents", "strength": -0.6, "lag": 0,
      "rationale": "NOTE: would create a cycle with the edge above. Resolved by dropping this edge; governance→race is modelled as the race→governance dampener only. Kept here as an example of what the validator rejects." },
    { "from": "compute-governance", "to": "misaligned-takeover", "kind": "dampens",  "strength": -0.4, "lag": 2 },
    { "from": "alignment-adequate", "to": "misaligned-takeover", "kind": "prevents", "strength": -0.8, "lag": 0 },
    { "from": "alignment-adequate", "to": "gradual-disempowerment", "kind": "dampens", "strength": -0.3, "lag": 0 },
    { "from": "labor-displacement", "to": "unemployment-no-net", "kind": "requires",  "strength": 0.9, "lag": 1 },
    { "from": "redistribution",     "to": "unemployment-no-net", "kind": "prevents",  "strength": -0.8, "lag": 0 },
    { "from": "labor-displacement", "to": "oligarchic-capture",  "kind": "amplifies", "strength": 0.5, "lag": 2 },
    { "from": "redistribution",     "to": "oligarchic-capture",  "kind": "dampens",   "strength": -0.5, "lag": 0 },
    { "from": "oligarchic-capture", "to": "surveillance-lockin", "kind": "amplifies", "strength": 0.4, "lag": 2 },
    { "from": "epistemic-collapse", "to": "surveillance-lockin", "kind": "amplifies", "strength": 0.4, "lag": 2 },
    { "from": "epistemic-collapse", "to": "compute-governance",  "kind": "dampens",   "strength": -0.3, "lag": 0 },
    { "from": "abundance",          "to": "redistribution",      "kind": "enables",   "strength": 0.4, "lag": 1 },
    { "from": "abundance",          "to": "broad-flourishing",   "kind": "requires",  "strength": 0.8, "lag": 0 },
    { "from": "redistribution",     "to": "broad-flourishing",   "kind": "requires",  "strength": 0.8, "lag": 0 },
    { "from": "surveillance-lockin","to": "broad-flourishing",   "kind": "prevents",  "strength": -0.7, "lag": 0 },
    { "from": "broad-flourishing",  "to": "flourishing",             "kind": "amplifies", "strength": 0.9 },
    { "from": "misaligned-takeover","to": "existential",             "kind": "amplifies", "strength": 0.9 },
    { "from": "gradual-disempowerment","to": "existential",          "kind": "amplifies", "strength": 0.7 },
    { "from": "bio-cyber",          "to": "catastrophic-recoverable","kind": "amplifies", "strength": 0.6 },
    { "from": "great-power-war",    "to": "catastrophic-recoverable","kind": "amplifies", "strength": 0.7 },
    { "from": "surveillance-lockin","to": "catastrophic-recoverable","kind": "amplifies", "strength": 0.5 }
  ],
  "metadata": {
    "editors": ["sagearbor"],
    "changelog": [{ "graphVersion": "2026-09-09", "date": "2026-09-09", "note": "Initial seed graph." }]
  }
}
```

(The one cyclic edge is left in deliberately with a rationale to show the failure mode; the real file drops it.)

---

## 2. Equations

### 2.1 Choice: influence DAG in log-odds, votes on marginals, propagation only for what-ifs

* A full Bayesian network needs `P(child | every parent combination)` — for a node with 4 parents that's 16
  numbers nobody can elicit and that community voting cannot maintain. Rejected.
* A scenario tree makes branches exclusive by construction. The ask is explicitly non-exclusive. Rejected.
* An influence diagram with signed weights is what forecasters can actually argue about: "if AGI arrives,
  how much does that raise takeover risk?" is one number. It also has a natural reading in the UI
  ("+0.6 = strongly increases"). With acyclicity it needs no solver.
* The crucial simplification: **people vote on marginal probabilities, not on the graph's outputs.** The
  displayed baseline for a tier is the aggregate of votes, full stop. The graph is used to answer *"what if
  alignment were solved?"* by propagating a **change**, not to derive the baseline. So the graph can be
  wrong without corrupting the numbers people entered, and the numbers can move without touching the graph.
  This is the hybrid the brief asked us to pick.

### 2.2 Baseline

For tier `T`, node `i`, horizon `h`:

```
P_T[i][h] = aggregate of estimates (see 2.5), else seed curve if n < N_min
```

Between horizons, interpolate linearly **in log-odds**, so a 2% and a 6% point don't produce a fake-linear
ramp: `L(y) = lerp(logit(P[h_k]), logit(P[h_k+1]), (y - h_k)/(h_k+1 - h_k))`, `P(y) = sigmoid(L(y))`.

### 2.3 What-if propagation (the "nudge")

User drags node `k` from `P_k` to `P_k'` (whole curve shifts; horizon-specific nudges are a v2 nicety).

```
logit(p) = ln(p / (1 - p));   sigmoid(x) = 1 / (1 + e^-x)

d_k = logit(P_k') - logit(P_k)                       // the shock, in log-odds
for each node j in topological order (k's descendants):
    d_j = clamp( sum over parents i of j:  w_ij * d_i ,  -4, +4 )
    P_j' = sigmoid( logit(P_j) + d_j )
for each edge (i -> j) with kind == "requires":
    P_j'(h) = min( P_j'(h), P_i'(h - lag) )           // a consequence can't be likelier than its prerequisite
for each axis A:
    P_o' = P_o' / sum over o in A of P_o'             // exclusive buckets sum to 1 again
```

Properties worth telling users in the Equations tab:

* `w` in [-1, 1] and paths multiply, so influence decays with distance: a 3-hop chain of 0.5s carries 12.5%
  of the shock. No oscillation, no iteration, deterministic.
* Raising a good node lowers bad nodes only via explicit negative edges — the graph makes the claim visible
  rather than assuming "good and bad trade off". The outcome axis renormalisation is where the zero-sum
  lives, and only there.
* Multiple nudges compose by summing their `d` vectors before the sigmoid (so nudges are order-independent).
* Log-odds shifts keep 0.5% at 0.5% scale: doubling odds of takeover from 6% to 12% is `d = +0.75`, and the
  same `d` moves a 50% node to 68%. That's the behaviour you want: small risks stay small-ish, big ones move.

### 2.4 Coupling strength semantics

| kind | strength | reading |
|---|---|---|
| `requires` | +0.7…1 | child cannot happen without parent; also imposes the min-clamp |
| `enables` | +0.3…0.7 | parent makes child materially easier |
| `amplifies` | +0.1…0.7 | parent increases child |
| `dampens` | −0.1…−0.7 | parent decreases child |
| `prevents` | −0.7…−1 | parent nearly rules child out |

Editors set these in git. In v2 experts can vote on `strength` with the same aggregation as 2.5 (it's just
a number in [-1, 1]; use plain median, not log-odds).

### 2.5 Aggregating a tier

Inputs: for node `i`, tier `T`, the **latest** estimate per user (`u`), each with `asOf`, curve `c_u`, and
user weight `q_u` (1 for public; 1 by default for experts, editable 0.5–3 by the owner for track record).

```
age_u  = days between now and asOf_u
r_u    = exp( -age_u / 180 )                        // recency: half-weight at ~4 months, ~1/7 at a year
x_u[h] = logit( clamp(c_u[h], 0.005, 0.995) )       // never let 0 or 1 into the pool
weight w_u = q_u * r_u

PUBLIC:  L[h] = weighted median of x_u[h]           // robust to trolls and 0/100 spammers
EXPERT:  L[h] = weighted mean of x_u[h] after dropping the top and bottom 10% by weight (trimmed)
LOCKED:  L[h] = logit(seed or editor-set value)     // one number, no pooling

P_T[i][h] = sigmoid( L[h] )
band      = [ sigmoid(weighted 25th pct of x_u[h]), sigmoid(weighted 75th pct) ]   // drawn as IQR
n_eff     = sum(w_u)
display only if n_eff >= N_min   (N_min = 5 public, 3 expert); else show seed with "n too small"
```

Why log-odds pooling: averaging raw probabilities drags a 2% risk toward the middle whenever a few people say
20%; pooling in log-odds is the standard for forecast aggregation and is what makes the "median public
p(doom)" a defensible number. No extremising — keep it explainable.

Outcome axes: aggregate each outcome independently as above, then renormalise the axis to sum to 1 (voters
enter four numbers that the slider UI already forces to sum to 100, so this is a tidy-up, not a correction).

### 2.6 Time (two axes, never confused)

* **Horizon** (`h`): "P that X has happened by year h". Stored on every estimate as the curve. Plotted as the
  x-axis of the river chart.
* **As-of** (`asOf`): when the estimate was made. Daily snapshot of every tier's `P_T[i][h]` → a per-node
  chart "how the community's 2035 number has moved since 2026". Plotted as its own small chart, labelled
  "estimate history", with graph-version change ticks. Do not overlay these two time axes on one chart.

Hazard rates are derivable (`hazard(y) = (P(y+1) - P(y)) / (1 - P(y))`) for a "per-year risk" toggle, but
they are not the stored primitive — cumulative curves are what surveys and Metaculus report, so seeding and
sanity-checking stay easy.

---

## 3. Infrastructure

### 3.1 Recommendation

| Tier | Where it lives | Auth | Write path |
|---|---|---|---|
| LOCKED | `data/futures/graph.json` in git; imported into the Vite bundle | git / PR review | PR |
| EXPERT | Firestore `estimates` with `tier: "expert"` | Firebase Auth email-link; tier granted by redeeming an invite code | client SDK, security rules |
| PUBLIC | Firestore `estimates` with `tier: "public"` | Firebase Auth anonymous + App Check (reCAPTCHA Enterprise) | client SDK, security rules |

Why Firestore: it's on the GCP project already in `scripts/deploy.sh`; no server process, so the nginx
container and deploy script stay exactly as they are; security rules do the per-user write gating; free tier
covers thousands of daily voters; and the client SDK gives live updates for free ("watch the public number
move"). Supabase would be equally fine but is a second vendor and a second bill. Cloud Run + SQLite/Litestream
means writing and running an API server for what is a 3-table problem. Static-JSON-plus-GitHub-PR is right for
LOCKED and wrong for voting (nobody opens a PR to say "I think 7%").

Firebase config keys are public by design (rules are the security boundary), so unlike the Gemini key this
adds no new secret to the bundle.

### 3.2 Collections

```
users/{uid}                 { tier: "public"|"expert"|"editor", displayName?, weight: 1, invitedBy?, createdAt }
invites/{code}              { createdBy, maxUses, uses, expiresAt, tier: "expert" }
estimates/{uid}_{nodeId}    { uid, tier, nodeId, graphVersion, curve: {"2028":0.2,...}, note?, asOf }   // latest only
estimateLog/{autoId}        { same fields }                                                              // append-only
aggregates/{tier}/nodes/{nodeId}   { curve, band25, band75, nEff, updatedAt, graphVersion }
snapshots/{tier}/days/{YYYY-MM-DD} { nodes: { nodeId: { curve, nEff } }, graphVersion }                  // ~20 nodes × 4 = tiny
edgeEstimates/{uid}_{from}_{to}    { strength, asOf }   // v2 only
```

Security rules (the whole "API"):

* `estimates`: create/update only if `request.auth.uid == uid` in the doc id, `tier` equals `users/{uid}.tier`
  (or `public` if no user doc), curve values in [0,1], keys ⊆ graph horizons, non-decreasing check done
  client-side + nightly job flags violations, and `request.time - resource.data.asOf > 60s` (rate limit).
* `estimateLog`: create only, same checks.
* `aggregates`, `snapshots`: read all, write only by the service account.
* `invites`: read own code by exact id only; `redeem` is a Cloud Function (one function total) that
  atomically increments `uses` and sets `users/{uid}.tier = "expert"`.
* `users`: read own; write own `displayName` only; `tier`/`weight` only via function or console.

### 3.3 The one scheduled job

`scripts/futures-aggregate.ts` (tsx, same style as `scripts/run-anchor-tests.ts`): reads all `estimates`,
runs the pure `aggregateTier()` from `src/futures/aggregate.ts` (the *same* code the client uses for
previews, so tests cover both), writes `aggregates/*` and today's `snapshots/*`. Run it nightly from a
GitHub Actions cron with a service-account secret. No Cloud Scheduler, no Functions except `redeem`.

Client also computes a live "provisional" aggregate from the last 500 estimates for immediacy; the nightly
job is the canonical one.

### 3.4 Client API surface (thin adapter, `src/futures/store.ts`, interface + two impls)

```
interface FuturesStore {
  getGraph(): FuturesGraph                                  // bundled JSON, sync
  getAggregates(tier): Promise<Record<nodeId, Aggregate>>   // aggregates/{tier}
  getHistory(tier, nodeId, from, to): Promise<SnapshotPoint[]>
  getMyEstimates(): Promise<Record<nodeId, Estimate>>
  submitEstimate(nodeId, curve, note?): Promise<void>       // writes estimates + estimateLog
  redeemInvite(code): Promise<Tier>
  whoAmI(): Promise<{ uid, tier }>
}
```

`LocalFuturesStore` (localStorage, v0) and `FirestoreFuturesStore` (v1). Same interface as
`modelStorage.ts`'s "designed for easy migration to cloud backend" comment promised.

### 3.5 Effort (experienced dev + CC)

| Phase | Days |
|---|---|
| v0 static + locked graph, river chart, nudging, equations tab | 3–4 |
| v1 Firestore + anon/email-link auth + invites + expert voting + provisional aggregate | 4–5 |
| v2 nightly snapshots, history charts, public tier hardening (App Check), edge voting | 3–4 |

### 3.6 Sybil / abuse posture for PUBLIC

Anonymous auth + App Check + one latest estimate per (uid, node) + 60 s write throttle + weighted median.
That's enough that a troll needs many devices to move a median and gets no lasting effect once the
nightly job recomputes. Not bulletproof; the expert tier is the trusted number and the UI says so.

---

## 4. Visuals

### 4.1 Candidates

1. **River timeline (primary).** x = year 2026→2045; lanes stacked vertically (capability, governance,
   economy, society, catastrophe, flourishing). Each event node is a band inside its lane whose vertical
   thickness at year y = `P(y)`; bands are translucent and **allowed to overlap** — the eye immediately gets
   "these can all happen at once". Thin curved links from band to band show edges (green for positive,
   red for negative, drawn from the parent at year y to the child at y+lag). At the right edge the
   `trajectory-2045` axis renders as a **stacked outcome strip** that visibly sums to 100%. Hover/tap a band:
   card with the number at each horizon, the IQR band, evidence, and a slider to nudge.
2. **Influence graph (secondary, "How they affect each other" tab).** Layered DAG via `elkjs` (or `d3-dag`),
   node = pill with fill level = P(2035), edge = arrow with width ∝ |strength|, colour by sign. This is where
   nudging feels natural: drag a fill level, watch descendants recolour, with numbers shown as before → after.
3. **Story mode (tertiary).** Choose an outcome bucket; show the top-3 chains by product of edge strengths ×
   node P(2035) as a vertical plain-English walk ("AGI arrives (70%) → race dynamics stay hot (75%) → alignment
   not adequate (55%) → misaligned takeover (6%) → existential (8%)"). This is the thing that fixes "people
   only know Terminator".

Rejected: Sankey — the merge/fan semantics force conservation of flow, which implies exclusivity, exactly the
wrong message.

### 4.2 Tier comparison

* Default shows one tier (Expert if n_eff ≥ 3 else Locked). A three-way segmented control (Locked / Experts /
  Public) at the top, plus a "compare" toggle that draws the other two tiers as **ghost outlines** on the
  river (dashed = expert, dotted = public) and as **three thin stacked strips** on the outcome axis.
* Node card shows a 3-row mini table: tier, P at each horizon, n_eff. Differences ≥ 10 points are highlighted.
* "Estimate history" chart per node: as-of on x, one line per tier, graph-version ticks.

### 4.3 Mobile

River chart needs ≥ 700 px. Below that: **card list** grouped by lane, each card = label, valence pill,
sparkline of P(y), the 2035 number big, tap to expand (numbers, evidence, slider). Outcome strip stays as a
horizontal bar at the top. Nudge propagation still works on cards (changed cards animate). Voting is
card-first anyway.

### 4.4 Components and responsibilities

```
src/futures/
  types.ts            FuturesGraph, Node, Edge, Curve, Estimate, Aggregate, Tier
  validateGraph.ts    ajv + acyclicity + requires-clamp + axis-sum checks
  curve.ts            logit/sigmoid, interpolate in log-odds, hazard
  propagate.ts        nudge propagation (pure, tested)
  aggregate.ts        per-tier pooling (pure, tested; shared with the nightly script)
  store.ts            FuturesStore interface; LocalFuturesStore; FirestoreFuturesStore
  seeds/graph.json    -> actually data/futures/graph.json, re-exported
components/futures/
  FuturesTab.tsx      layout, tier control, view switcher, responsive breakpoint
  RiverChart.tsx      D3 for scales/area generators/curve interpolation; React owns the SVG elements
  OutcomeStrip.tsx    stacked bar(s) for axes; up to 3 tiers
  InfluenceGraph.tsx  elkjs layout in a worker/useMemo; React SVG; drag-to-nudge
  NodeCard.tsx        details, evidence list, horizon sliders (sum-to-100 for outcomes)
  EstimateHistory.tsx Recharts line chart of snapshots
  StoryMode.tsx       chain enumeration + narrative
  EquationsPanel.tsx  the formulas above, rendered with live numbers plugged in
```

D3 does maths (scales, `d3-shape` areas/links, `d3-dag` or elk for layout); React does DOM. Same split as
`WorldMap.tsx`. No D3 selections mutating React-owned nodes.

---

## 5. Build order

**v0 — "Locked map" (demoable: the map, the what-if, the story).**
Graph JSON + schema + validator + tests; `curve.ts`, `propagate.ts` with unit tests (nudge monotonicity,
axis sums to 1, requires-clamp, order independence); river chart + outcome strip + node cards + influence
graph; Equations panel; `LocalFuturesStore` so a visitor's own nudges persist. Ship behind a new
"Futures" tab. This alone answers "show people how it could actually go".

**v1 — "Experts weigh in" (demoable: invited people vote, expert number appears).**
Firebase project on the existing GCP project; anon + email-link auth; `invites` + `redeem` function;
`submitEstimate`; provisional client-side aggregate; tier control with Locked/Expert. Owner invites 10–20
people; watch the Expert numbers diverge from Locked.

**v2 — "Everyone, over time" (demoable: public tier, history charts, edge votes).**
App Check; public tier on; nightly `futures-aggregate.ts` via GitHub Actions; `snapshots`; EstimateHistory
chart; ghost-outline comparison; expert votes on edge strengths.

### Biggest risks

1. **Operationalisation drift.** If "AGI" means different things to different voters the numbers are
   noise. Mitigation: `operationalisation` is a required field for anything that can be voted on; show it on
   the card *before* the slider; changing it bumps `graphVersion` and starts a new history segment.
2. **The graph gets read as "the model's prediction".** Non-experts will treat propagated what-if numbers as
   forecasts. Mitigation: what-if state is visually distinct (hatched bands, "what-if" banner, one-tap reset)
   and never written to any tier.
3. **Expert tier legitimacy.** Twenty invitees isn't a survey; a reporter will quote it as one. Mitigation:
   show `n_eff` next to every expert number, show the IQR band, and keep the invite list (or at least its size
   and composition by affiliation) public on an About panel.

Out-of-scope note for the parent: the existing simulator's job-displacement engine could later drive
`labor-displacement` and `unemployment-no-net` seeds from a chosen scenario preset — a nice bridge, not v0.

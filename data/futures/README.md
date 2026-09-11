# data/futures

The AI Futures Map's curated graph and interventions. Everything here is plain JSON,
git-tracked, and validated by `src/futures/validateGraph.ts`
(CLI: `scripts/validate-futures.ts`, npm script: `npm run validate:futures`, not yet wired
into `package.json` — see the note at the bottom of this file).

## Files

- `graph.json` — the one graph: `startYear`/`endYear`/`horizons`, the single `axis`
  (five mutually exclusive world-states), and `nodes` (18 `event` nodes + 5 `state` nodes).
  Edges live on the **child** node, in its `parents[]` array.
- `interventions/*.json` — one file per intervention (policy lever). Each is a standalone
  `Intervention` object; the file name should match its `id` with a `.json` suffix.

Shapes are defined in `src/futures/types.ts` (`FuturesGraph`, `FuturesNode`, `ParentEdge`,
`Intervention`, ...) and enforced by `schemas/futuresGraph.schema.json`. Read the doc-comments
at the top of `types.ts` before editing — in particular the difference between `horizon`/`year`
(the x-axis of every chart) and `asOf` (when an estimate was recorded).

## id rules

- Node ids and intervention ids: lowercase, digits, hyphens only (`^[a-z0-9-]+$`), and unique
  within their collection.
- Pick a short, stable, descriptive id (`compute-governance`, not `cg` or `node-14`). Ids are
  referenced from `parents[].from`, `axis.states`, `axis.absorbing`, and every intervention's
  `nudges[].node` — renaming one means updating all of those, plus any golden-file numbers that
  depend on the node (see "Editing the graph" below).

## How to add an event node

1. Append a new object to `graph.json`'s `nodes` array with:
   - `id`, `kind: "event"`, `label`, `lane` (one of `capability`/`governance`/`economy`/
     `society`/`catastrophe`/`flourishing`), `valence` (`good`/`bad`/`neutral`/`mixed`).
   - `summary` (one line), `operationalisation` (the resolvable criterion — "what would have to
     be true for this to count as having happened"), `narrative` (2-3 sentences, plain English,
     what it looks like from the inside).
   - `seed.curve`: an object keyed by year (one of `graph.horizons`, as a string) to a
     probability in `[0, 1]`. Event curves must be non-decreasing across horizons (they are
     cumulative "by year Y" probabilities) — the validator checks this.
   - `seed.basis` (how you got the numbers), `seed.confidence` (`low`/`medium`/`high`),
     `seed.sources[]` if you have any (each needs `label` + `kind`; omit `url` if you're not
     sure of the exact link — never invent a citation), `seed.seededBy: "curator"`,
     `seed.asOf`: today's date.
   - `since`: today's date.
2. If this node should be caused by, or should cause, anything else, add edges — see below.
3. Run `npx tsx scripts/validate-futures.ts` and fix anything it flags.
4. Add a `metadata.changelog` entry (see "Changelog" below).

## How to add a state node

States are the mutually-exclusive buckets on `graph.axis`. Adding a sixth one is a bigger
decision than adding an event (it changes what every other state's marginal means) — think hard
before doing it, and if you do:

1. Add the node with `kind: "state"`, `goodness` (0-100, its position on the goodness axis; must
   be unique among states), and a `seed.curve` keyed **only** by `graph.startYear` and the
   entries of `graph.axis.horizons` (not the event horizons — the validator checks this).
2. Add its id to `graph.axis.states`. If it should count toward "floor risk" or "ceiling
   chance", check `graph.axis.floorGoodness` / `ceilingGoodness` still make sense. If it's a
   dead end (nothing recovers from it), add it to `graph.axis.absorbing`.
3. Reseed every other state's curve so the marginals at each axis horizon still sum to ~1 (the
   validator only warns on this — the engine renormalises at solve time — but a graph that's
   already balanced is much easier to reason about).
4. Regenerate the golden file: `npx tsx scripts/validate-futures.ts --update-golden`.

## How to add an edge

Edges are declared on the **child** (effect) node, not the parent (cause):

```json
{ "from": "compute-governance", "kind": "dampens", "strength": -0.4, "lag": 2,
  "note": "Verified compute limits slow unchecked capability gains, giving more time to notice and fix dangerous objectives." }
```

- `kind` is one of `requires` / `enables` / `amplifies` (strength must be **positive**) or
  `dampens` / `prevents` (strength must be **negative**). The validator rejects a sign
  mismatch.
- `strength` is a log-odds coefficient in `[-1, 1]`. There's no formula for picking it — start
  from a similar existing edge and adjust; `requires`/`prevents` tend to be strong (|0.6-0.9|),
  `amplifies`/`dampens`/`enables` more moderate (|0.3-0.6|).
- `lag` (years, default 0) is when the effect is felt, not when the cause happens. **A cycle
  of edges is only legal if at least one edge in the cycle has `lag >= 1`** — a zero-lag cycle
  is a validation error (see `topoOrder` in `src/futures/engine.ts`). The real graph already has
  two intentional lagged cycles (`race-dynamics` <-> `compute-governance`, `oligarchic-capture`
  <-> `redistribution`); copy that pattern if you need another one.
- `note` is required and shown in the UI whenever the edge is traversed — write it as a
  complete sentence a curious layperson would find convincing, not a variable name.
- A node may have at most 5 `parents`. The graph as a whole may have at most `3 * (number of
  nodes)` edges. Both are enforced by the validator.
- A `requires` edge clamps the child's probability to never exceed the parent's (at the given
  lag) — including on the **seed** curves, since the engine applies this clamp even when no
  slider or intervention has been touched. If you add a `requires` edge, make sure the child's
  seed curve is already <= the parent's seed curve at every year, or your seed will silently get
  clamped at solve time.

## How to add an intervention

1. Create `data/futures/interventions/<id>.json` matching the `Intervention` shape in
   `src/futures/types.ts`: `schemaVersion: 1`, `id`, `label`, `summary`, `source` (`kind` one of
   `bill`/`paper`/`proposal`/`editorial`, plus a `quote` or short description — never a fabricated
   URL), `tier`, `status`, `cost` (`band` 1-5, plus a `note` explaining the band), `startYear`
   (must fall within `graph.startYear`..`graph.endYear`), and `nudges[]`.
2. Each nudge targets one existing node id, a `direction` (`up`/`down`), a `magnitude`
   (`slight`/`moderate`/`strong` — the *only* numbers a lay user or an LLM ever picks; see
   `MAGNITUDE_LOG_ODDS` in `src/futures/types.ts`), an optional `lag` (years after the
   intervention's own `startYear`), and ideally `evidence` (a one-sentence justification).
3. Run `npx tsx scripts/validate-futures.ts` — it validates every file under
   `interventions/` automatically.

## Changelog

Every content change to `graph.json` should bump `graphVersion` (format `YYYY-MM-DD` or
`YYYY-MM-DD.N` for same-day revisions) and append one entry to `metadata.changelog` explaining
what changed and why. Interventions don't carry their own changelog; the graph's changelog entry
should mention it if an intervention file was added or edited alongside a graph change.

## How to run validation

```bash
npx tsx scripts/validate-futures.ts            # human-readable report, exits 1 on failure
npx tsx scripts/validate-futures.ts --json      # same, as JSON
npx tsx scripts/validate-futures.ts --update-golden   # rewrite src/futures/golden.json
npx vitest run src/futures/validateGraph.test.ts       # unit tests for the validator itself
```

`validate-futures.ts` runs, in order: schema + semantic validation of `graph.json`, schema +
semantic validation of every file in `interventions/`, a comparison of the graph's baseline
against `src/futures/golden.json` (fails the run on mismatch), and a sensitivity report (edges
whose removal shifts an endYear state marginal by more than 0.05 under a standard probe — this
is informational and does not fail the run).

**After any change to `graph.json`'s numbers** (a seed curve, an edge strength, a lag), run
`--update-golden` and commit the resulting `src/futures/golden.json` alongside your change —
otherwise CI's golden check will fail on the next PR that doesn't also touch the graph.

Not yet in `package.json` — add this script line if you want `npm run validate:futures`:

```json
"validate:futures": "tsx scripts/validate-futures.ts"
```

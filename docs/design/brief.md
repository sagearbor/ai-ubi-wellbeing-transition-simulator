# Design brief: "AI Futures Map" — branching outcome pathway explorer

## Context
Repo: ai-ubi-wellbeing-transition-simulator (React 19 + TS + Vite 6, D3 + Recharts, Tailwind 4,
ajv JSON-schema validated "ModelConfig" uploads, mathjs equation parser, Cloud Run deploy behind
nginx, currently localStorage-only persistence, Gemini API for analysis). Live at
https://wellbeing-transition-simulator-808228086396.us-west1.run.app. It already models the
"mass job disruption / rich-poor divide" pathway month-by-month.

## The ask (owner's words, paraphrased)
A web interface where people can SEE how AI -> AGI could actually go, good AND bad. A flow chart
that branches into positive and negative paths. Each branch has a 0-1 likelihood that changes over
time. Branches are NOT mutually exclusive (mass job disruption AND a good outcome can co-occur;
"sub-extinction" bad outcomes like exponential rich/poor divide). Paths affect each other:
raising the likelihood of a good path should lower some bad paths, etc.

Motivation: this week lots of posts about Anthropic staff leaving and estimates of >10% chance AI
exterminates humanity within 10 years. Public doesn't believe "Terminator" but doesn't know the
OTHER ways it could go bad (or well). Goal: make the branch structure legible.

Community: three weight tiers — (a) LOCKED / curated version (owner + editors), (b) INVITED
experts (people in the field, more trusted), (c) PUBLIC (anyone guessing). Show all three,
compare them.

"The main work to start will be thinking out how to store such info and allow it to evolve as our
understanding changes. Also how do paths affect each other." KISS but adaptable and useful.

## Deliver (write a markdown file, be concrete, no fluff)
1. DATA MODEL. Exact JSON/YAML schema for nodes, edges, time-varying likelihoods, couplings
   between paths, provenance/evidence, versioning. Must survive years of edits (schema versioning,
   migrations). Must be git-friendly for the LOCKED tier. Give a worked example with ~12-20 real
   nodes covering: capability milestones (AGI, recursive self-improvement), governance branches,
   good outcomes (abundance, cures, UBI works), sub-extinction bad outcomes (mass unemployment
   without redistribution, oligarchic capture, surveillance lock-in, epistemic collapse, bio/cyber
   misuse, great-power war), and extinction-class (misaligned takeover, gradual disempowerment).
   Cite the rough consensus-ish numbers people quote (e.g. AI Impacts survey, Metaculus, the
   "p(doom)" ranges, Compendium/AI 2027 style) as INITIAL seeds, clearly labelled as seeds.
2. EQUATIONS. How to represent non-exclusive branches mathematically. Options to weigh: (i) a
   Bayesian network / DAG with conditional probabilities; (ii) an "influence diagram" with signed
   coupling coefficients and a fixed-point / softmax normalisation; (iii) scenario-tree with
   overlapping terminal sets. Pick one (or a hybrid), justify in <10 lines, then give the
   actual formulas: how P(node, t) is computed, how a user nudging one node propagates, how to
   keep mutually-exclusive terminal buckets summing to 1 while intermediate states are not
   exclusive, how time enters (likelihood by year, or hazard rates). How to aggregate votes per
   tier (median? trimmed mean? log-odds pooling? with N-weighting and recency decay).
   Keep it something a smart non-mathematician can read in the UI's "equations" tab.
3. INFRA. KISS: what's the smallest thing that works for LOCKED (git JSON in repo), EXPERT
   (invite codes / magic link), PUBLIC (anon, rate-limited, sybil-resistant enough)? Candidate
   backends: Firestore (already on GCP), Supabase, Cloud Run + SQLite/Litestream, or a static
   JSON + GitHub-PR model for edits. Recommend one, give the tables/collections, the API surface
   (5-8 endpoints), and how snapshots over time are stored so the "likelihood over time" chart is
   reconstructible. Estimate effort in days for an experienced dev + CC.
4. VISUALS. The hard part: non-exclusive branches. Propose 2-3 candidate views, pick a primary.
   Consider: layered DAG (dagre/elk) with node "fill level" = likelihood; Sankey-ish ribbons
   whose width = P and which can fan-out AND merge; a "timeline swimlane" (x = year) where each
   path is a band whose height = P(t); a "stacked outcome strip" for the exclusive terminal
   buckets; a "story mode" that walks one path with plain-English narrative. Show how the three
   tiers are compared (ghost outlines, small multiples, diff colouring). Mobile-first matters.
   Sketch the component list and D3 vs React responsibilities.
5. WHAT TO BUILD FIRST. A 3-phase plan (v0 static + locked, v1 expert voting, v2 public +
   time-series), each phase demoable.

Be opinionated. Prefer the simplest thing that isn't wrong. Flag the 3 biggest risks.

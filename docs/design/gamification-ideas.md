# Gamification that teaches, not flatters

Design note, 2026-09-12. Question: how to make the site pleasant and instructive without turning a
forecasting and policy tool into a toy. The bar is the owner's: utility and correctness. Every
mechanic below is judged by one test: **does it make the model's assumptions more visible, or less?**
A mechanic that makes people feel clever while hiding what the model assumes is a loss, however fun.

---

## 1. Principles

Five, drawn from games that actually teach.

1. **The world pushes back, honestly.** Kerbal Space Program teaches orbital mechanics because the
   rocket falls when your intuition is wrong, and the physics never lies to be kind. Factorio teaches
   throughput because the belt backs up. The lesson is not "make it fun", it is "make consequences
   legible and undeniable". For us: every drag, every card, every vote must show its consequence
   through the real engine, never through a canned animation.

2. **Reveal the machine.** Universal Paperclips is a joke about a paperclip maximiser, and it works
   because the player becomes the maximiser and feels the pull. Papers Please makes you complicit in
   the rules. The best mechanics here put the user inside the model's assumptions: you set the
   coefficient, you feel what it implies, you argue with it. A mechanic that only lets people pull
   levers without seeing the equations behind them teaches superstition.

3. **Score calibration, never popularity or extremity.** Metaculus works because your Brier score
   improves by being right and well-calibrated, and the community median is a recency-weighted median
   that a single loud vote cannot move. A leaderboard of "most upvoted future" would reward
   confident, extreme, dramatic claims and would poison the expert and public tiers within a month.
   Reputation must be earned only by resolved predictions.

4. **Small, complete loops.** Wordle is one puzzle a day with a shareable card that shows your
   process, not your answer. Duolingo streaks work until they become guilt. The honest version: a
   short daily loop (one question, one guess, one reveal) with a share card that shows reasoning and
   uncertainty, and no punishment for missing a day.

5. **Difficulty should come from the world, not from the interface.** Papers Please is hard because
   the rules are complex and the stakes are moral, not because the UI fights you. Our hard parts are
   real (interventions interact, timing matters, data are thin). The interface should be frictionless
   so the difficulty people meet is the real one.

What corrupts a forecasting tool, explicitly: upvote leaderboards; points for participation volume;
badges for extreme positions; any score that resolves before the world does; "win" states that imply
the model is settled; and animations that suggest precision the model does not have.

---

## 2. Mechanics

Effort: S = days, M = a week or two on top of the unified core, L = a month or more. "Needs" lists what
the mechanic requires from the core, so the shortlist can be mapped to fixture models and validation
cases in section 4.

### 2a. Mirror
- **Does:** after applying an intervention as one actor (the US bans chip exports to China), the user
  taps "mirror" and sees the same policy applied by other actors (China bans rare-earth exports to the
  US, the EU does both, India does neither), side by side, with the outcome differences explained by
  the parameters that differ: manufacturing base, import dependence, share of the frontier, ally
  alignment. A short "why it differs" panel lists the three parameters with the largest contribution.
- **Learns:** policy effects are not symmetric; the same lever pulled from a different seat has a
  different, sometimes opposite, result, and the reason is structural, not moral.
- **Needs:** per-actor parameterisation in the core (a country or bloc is an overlay of parameters
  on shared equations), interventions written against roles ("exporter", "target") rather than named
  countries, and a sensitivity routine that attributes the outcome gap to parameters.
- **Effort:** M once the core exists; L without it.
- **Risk:** an actor whose parameters are not calibrated produces confident nonsense. Mirror should
  refuse actors whose parameters are unsourced and say so.

### 2b. Direct manipulation of curves and arrows, maths honoured
- **Does:** on touch, drag a band on the goodness chart up or down, or drag an arrow's thickness in
  the influence graph. The engine treats a dragged band as a pinned target and solves for the
  log-odds shift that reproduces it; the rest of the graph responds live. Dragging an arrow changes
  its strength coefficient, and the panel shows the coefficient, its allowed range and its source,
  greyed if the user has left the sourced range.
- **Learns:** what it costs to move one thing, because other things move; and that arrow strengths
  are claims with sources, not free dials.
- **Needs:** an inverse solve (given a target probability for one node, find the shift), which the
  current engine can do by bisection in a millisecond; coefficient ranges and sources on every edge.
- **Effort:** S for bands, M for arrows.
- **Risk:** drags feel authoritative. Anything dragged outside its sourced range must render hatched
  and labelled "your assumption", and never persist into any tier.

### 2c. Predict, then reveal
- **Does:** a validation case is presented as a puzzle: "In 2012 Kansas cut its top income tax rate
  from 6.45% to 4.9%. By 2017, how did its job growth compare with Nebraska's?" The user sets a range
  and a confidence. Then the published estimate and its confidence interval are revealed, and the
  model's own pre-registered prediction is shown beside both. The user gets a Brier or interval score;
  so does the model. Cases: Kansas, Alaska dividend, Finland basic income, Oregon Medicaid, the 2021
  child tax credit, the minimum-wage panel, Stockton.
- **Learns:** how wrong intuition is about real policy, and that the model is scored the same way.
  This is the Freakonomics feel the owner wants, done honestly.
- **Needs:** the validation-case library with published effect sizes and intervals; the model's
  frozen predictions per version.
- **Effort:** S for the quiz, M to show the model's own score beside the user's.
- **Risk:** people learn the answers and replay. Keep a bank of at least twenty cases and rotate.

### 2d. Shareable result cards
- **Does:** any state of the chart or any prediction becomes a card: a small image plus a link that
  reproduces the exact state (the URL-hash share already exists). The card shows the change as a
  dashed-before, solid-after pair, the three biggest movers, the interventions on, and a footer that
  says which tier's numbers it used and the model version.
- **Learns:** nothing directly, but it is the growth loop, and the footer keeps the provenance
  attached to every screenshot that leaves the site.
- **Needs:** server-side or canvas image rendering of the chart; the existing share encoding.
- **Effort:** S.
- **Risk:** cards without the provenance footer become "the site says 8% extinction". The footer is
  not optional.

### 2e. Daily question tied to the news
- **Does:** one question a day, drawn from the map's nodes or a validation case, prompted by a real
  headline: "Reports today say X lab compressed its safety review. Does this move your 'frontier race'
  estimate?" The user answers in ten seconds. Answers feed the public tier as ordinary estimates and
  the user sees how the pooled number moved.
- **Learns:** how to update on evidence, and how small one person's update is against a pool.
- **Needs:** a curated headline feed (a human or an agent proposing three per day for editor
  approval), the estimate store.
- **Effort:** S for the mechanic, ongoing editorial cost.
- **Risk:** news-driven updating trains overreaction. Show the pooled number's 30-day path so the
  user sees that most days move nothing.

### 2f. Experts versus you
- **Does:** after the user has estimated a few nodes, a panel shows their curve against the expert
  tier and the public tier, with the spread, and names the three nodes where they differ most. One
  tap opens the expert reasoning notes for that node (experts can attach a one-line rationale).
- **Learns:** where the user is an outlier and why the experts think what they think.
- **Needs:** expert tier populated (a dozen people minimum), rationale field on estimates.
- **Effort:** S.
- **Risk:** anchoring: showing the expert number before the user commits destroys the signal. Always
  collect first, reveal after.

### 2g. Challenge modes
- **Does:** a constrained optimisation puzzle: "Get existential under 3% by 2045 with total cost band
  at most 8. Interventions available: these twelve." The user picks a set; the engine scores mean
  shift, floor lift, cost, and shows the cost curve. A second challenge type: "Reach the same result
  from China's seat." The best solutions are shown as a set, not a ranking, with the assumptions each
  one leans on.
- **Learns:** trade-offs, interactions between interventions (once the core supports conditional and
  lagged effects), and that different seats have different feasible sets.
- **Needs:** cost profiles over time, interaction terms in the core, per-actor overlays.
- **Effort:** M.
- **Risk:** it is easy to make this feel like a solved game. Every challenge page must state which
  coupling coefficients its answer depends on and how contested they are.

### 2h. Reputation from calibration only
- **Does:** a user's reputation is their Brier score on resolved questions and validation cases,
  shown with the count of resolved items. Nothing else counts: not votes, not participation, not
  challenge scores. Reputation weights their estimates in the public pool, capped (weight 0.5 to 3,
  the range the aggregation already supports). Experts start at weight 1 and are subject to the same
  scoring.
- **Learns:** that being right over time is the only currency, and that the site treats experts and
  the public by the same rule.
- **Needs:** resolution of questions (a curator marks nodes or daily questions resolved), the
  estimate log with timestamps.
- **Effort:** M.
- **Risk:** almost nothing in the map resolves before 2028. In the first two years reputation would
  come almost entirely from the validation-case quizzes and daily questions on near-term events, and
  the UI must say so.

### 2i. Story mode, walk a path
- **Does:** pick an ending, and walk backwards through the highest-contribution chain one screen at
  a time, with the lane animating beside plain-English narrative from the node files. At each step
  the user can nudge and see the ending change. (Designed in v0, not built.)
- **Learns:** the actual mechanisms, especially the non-Terminator ways things go wrong, which was the
  original motivation for the map.
- **Needs:** node narratives (already in the seed data), the propagation engine.
- **Effort:** S.
- **Risk:** narrative is persuasive. Each screen must show the number and its source chip beside the
  prose.

### 2j. Time scrubbing as the primary control
- **Does:** the year scrubber drives everything on the page at once: chart, lanes, country map
  colours, the readout. Press and hold to play forward. On the country simulator, the same scrubber
  runs the months.
- **Learns:** that most divergence between futures happens late, and when interventions with lags
  begin to bite.
- **Needs:** nothing new; both engines already produce per-year and per-month series.
- **Effort:** S.
- **Risk:** none of note.

### 2k. Fork a target model
- **Does:** a dropdown of the fixture models (Korinek 2026, the country simulator, the futures map,
  the toy, the toy plus one variable, the two-intervention model, the state-overlay model, the
  hindcast). Pick one, it loads as the starting point, the user edits parameters or adds a variable,
  and the diff against the original is always visible. A fork can be shared, and the original's
  authors are credited on every fork.
- **Learns:** how published models are built, and how little or how much a conclusion depends on a
  parameter.
- **Needs:** the unified core with the fixture models as loadable files; diff rendering.
- **Effort:** S once the core exists; it is the core's natural UI.
- **Risk:** forks that drift far from the original still carry its name. The diff and a "modified"
  badge must be unremovable.

### 2l. Sensitivity heatmap
- **Does:** for the current state, one tap shows which parameters the headline numbers depend on
  most, as a ranked bar list with the parameter's source and range. Tap a bar to jump to that
  parameter and drag it.
- **Learns:** which assumptions matter and which are decoration.
- **Needs:** a sensitivity routine (one-at-a-time perturbation is enough to start).
- **Effort:** S.
- **Risk:** none of note; this is the most honest mechanic on the list.

### 2m. Country seat selection
- **Does:** the user chooses a seat (a country or bloc) at the start of a session. All interventions,
  costs and mirror results are then framed from that seat, and the public tier can be sliced by seat.
- **Learns:** how differently the same future looks from Lagos, Shenzhen and Ohio.
- **Needs:** per-actor overlays and seat-tagged estimates.
- **Effort:** M.
- **Risk:** seat-sliced public tiers get thin fast. Show n and suppress below the usual threshold.

### 2n. Consequence receipts
- **Does:** after a user applies an intervention, a receipt lists what it bought and what it cost:
  mean shift, floor lift, ceiling lift, cost band, and the two or three assumptions the result leans on
  hardest, with their sources. The receipt is what gets shared, not a bare number.
- **Learns:** that every result has a price and an assumption list.
- **Needs:** the metrics already computed plus the sensitivity routine.
- **Effort:** S.
- **Risk:** none of note.

---

## 3. Shortlist for the first release, and rejections

Ranked. Criteria: honesty (assumptions more visible), learning per minute, and feasibility on the
unified core within the first release.

1. **Predict, then reveal (2c).** It is the Freakonomics experience the owner asked for, it works
   with a library of only six cases, it scores the user and the model by the same rule, and it is the
   foundation of an honest reputation system. It also forces the validation library to exist early,
   which is the single most important credibility step.

2. **Direct manipulation with sourced ranges (2b) plus the sensitivity heatmap (2l).** Counted as one
   because they share the machinery. Together they turn the chart into an instrument rather than a
   picture: drag a thing, see what it costs, see which assumption it leaned on. This is the mechanic
   that makes the model's assumptions visible by construction.

3. **Mirror (2a).** The owner's strongest idea, and it teaches something no other tool does. It
   depends on per-actor overlays, which the unified core must have anyway for state-versus-state
   policy, so it rides on work that is planned.

4. **Fork a target model (2k) with shareable receipts (2n).** The dropdown of published models is the
   natural front door of the unified core, and it is also the outreach mechanic: authors whose model
   can be loaded, forked and cited from a URL will use and cite the site. Receipts keep provenance on
   everything that leaves.

Explicitly rejected, at least for the first release:

- **Reputation from calibration (2h).** Right in principle, wrong now. Almost nothing on the map
  resolves before 2028, so any visible reputation in year one would be built on a handful of quiz
  answers and would read as noise with a badge on it. Log the data from day one, show no reputation
  until at least fifty resolved items exist per user.
- **Challenge modes (2g).** They need interaction terms and cost profiles the core does not have
  yet, and without those the "best" answer is an artefact of additive log-odds. Shipping it early
  would teach the wrong lesson with a trophy attached.
- **Daily question tied to the news (2e).** Good mechanic, wrong moment. It needs a daily editorial
  process and a populated public tier to be anything other than an empty room, and it trains
  overreaction unless the pooled path is shown. Revisit once a few hundred people are voting.

Also declined: any upvote leaderboard, any points for participation, and any "you saved the world"
end state.

---

## 4. Mapping the shortlist onto the unified core

| Mechanic | Fixture models it needs | Validation cases it needs | Core features it needs |
|---|---|---|---|
| Predict, then reveal | The hindcast model (2015 to 2025) as the scored baseline; the country simulator with a state overlay for Kansas and Alaska | Alaska dividend, Kansas 2012, Finland basic income, Oregon Medicaid, 2021 child tax credit, the minimum-wage panel, Stockton or Los Angeles BIG:LEAP | Frozen per-version model predictions; case file format with effect size and interval; Brier and interval scoring |
| Direct manipulation + sensitivity | The futures map and the toy plus one variable (to prove drags work on a three-node model too) | None | Inverse solve for a pinned target; coefficient ranges and sources on every edge and parameter; one-at-a-time sensitivity |
| Mirror | The two-intervention model; the state-overlay model generalised to country and bloc overlays; Korinek 2026 as the US economic overlay | None to start; later the minimum-wage panel as a "same policy, different states" demonstration | Interventions written against roles; per-actor parameter overlays with sources; attribution of outcome gaps to parameters |
| Fork a target model + receipts | All eight fixtures, each loadable and diffable | None | Model file loader with diff; author credit metadata in every model file; receipt generation from existing metrics plus sensitivity |

Two consequences for the core spec:

- **Roles, not names, in interventions.** "Exporter restricts chips to target" must be expressible
  once and instantiated for any actor pair. That is a schema requirement, not a UI nicety.
- **Sources and ranges are mandatory on every coefficient.** Three of the four shortlisted mechanics
  depend on being able to say "you left the sourced range" or "this result leans on parameter X from
  source Y". Unsourced coefficients should be legal only in a fork and always rendered as such.

One last note on the owner's gesture idea. Dragging importance is exactly mechanic 2b, and it is
honest as long as the drag maps to a real quantity with a real range. Gestures that map to nothing in
the model (shaking, swiping for emphasis) would be decoration, and decoration on a forecasting tool
reads as manipulation. Keep every gesture attached to a number the user can read.

# Guided experience design

Proposal for `codex/overnight-guided-experience`, after core fixes. This document changes no application code and makes no claim that the proposed interface has been implemented or tested.

## Direction: follow the funds

Make the first screen a working question, with one distinctive interactive funding diagram. The visual subject is the route from an explicitly assumed corporate source, through a funded contribution, to people. The executive visitor can understand an actual comparison without learning model taxonomy first. A curious visitor can immediately change it. An author sees Model Lab in primary navigation.

Grounding: inspected `/private/tmp/stage35-first-visit.png`, `App.tsx`, `components/lab/LabTab.tsx`, `components/lab/PolicyPanel.tsx`, `src/core/fixtures.ts`, `src/policy/examples.ts`, `docs/design/first-visit-proposal.md`, and the concrete conditional-world addendum plus final funding ruling in `docs/design/stage3-qualification-design.md`. The old screenshot opens on eleven metrics, a preset sidebar, a map, and a Play instruction. It does not give one clear question or prioritize the powerful authoring tools.

## Compact visual system

- Palette: porcelain `#F7F9FC` page, white `#FFFFFF` result surface, ink `#15273E` text, cobalt `#244DB8` primary action/funded flow, steel `#526477` secondary text, garnet `#A43148` invalid/unfunded warning. Quiet borders use the steel color at reduced opacity. Cobalt denotes selected or funded, not scientific validity. Evidence labels always carry words.
- Dark mode: preserve existing preference; navy surfaces, pale text, brighter blue interactive marks, and distinct warning text. Verify contrast in both themes rather than assuming the light tokens invert safely.
- Typography: `Avenir Next, Avenir, Segoe UI, sans-serif` for a quietly human interface, no new font request or external asset. Heading 44/48 desktop, 32/36 mobile; section 24/30; body/control 16/24; supporting 13/19. Numbers use tabular numerals, not a monospace face. Sentence case throughout. Text max width 66 characters.
- Layout: left-aligned max-width 1200px, 32px desktop gutter, 16px mobile. Header 68px; generous opening whitespace; 8px spacing rhythm. Controls use 6px corners; the one diagram surface 16px; narrative sections stay unboxed. No repeated metric-card grid or decorative shadows.
- Motion: only a short user-triggered redraw of flow width after a completed calculation. Reduced-motion renders directly. No ambient animation, bouncing hints, tour overlay, or autoplay timeline.

## Exact navigation and entry questions

Primary navigation: **Explore | Compare | Model Lab**. Utility: **About** and theme control. About contains Guide, Model card, Sources and equations, Analysis, and Leaderboard; these link to supported existing destinations. Map, Charts, and Corporations remain secondary views inside Explore. Preserve every existing `?tab=` destination and share hash.

Landing headline: **Where could the gains from AI go?**

Supporting copy: **Change a contribution, follow the funds, and inspect the assumptions.**

Three question choices, one selected by default:

1. **What could an AI dividend pay?** — primary button **Explore a dividend**. Opens the active conditional world reference and its paired zero-contribution comparator. Start with computed month-zero monthly-flow semantics, not fabricated precomputed numbers or elapsed historical payments.
2. **What could this policy change?** — button **Try a policy idea**. Opens the existing Lab Policy panel with its inspect-before-run workflow; offer the actual worked example **S. 3877, Investing in Tomorrow’s Workforce Act of 2026** and a Paste text action.
3. **What limits a training program?** — button **Explore retraining**. Opens existing **Training funding meets a jobs constraint** fixture, preserving its budget and placement-capacity explanations.

Immediately after these choices: **Build or import a model** (Model Lab), and **Explore AI risks** (AI Futures Map). Risk subtitle: **Separate assumptions and interventions; these results do not change the dividend model.** Neither capability goes inside a generic More menu. The question choices can be compact text rows, not three equal marketing cards.

## Desktop wireframe

```text
Transition Engine        Explore   Compare   Model Lab        About  Theme

Where could the gains from AI go?
Change a contribution, follow the funds, and inspect the assumptions.
[Explore a dividend]  Try a policy idea  Explore retraining

Conditional world reference  [actual evidence status]  [Model details]
Compare funded transfers under stated corporate and macro assumptions;
wellbeing is an illustrative conditional index.

Choose the contribution       Follow the funds
[Corporation / scope]         Modeled source ━━━┳━━ Funded contribution ━━ People
[Request: rate | amount]                      ┗━━ Unused modeled source
[Allocation route]           Requested … / Funded … / Unfunded …
[Recalculate, if needed]      Monthly receipts per person: [computed] [denominator]
                             Compared with zero contributions: [computed delta]
                             [Inspect this calculation]

[Compare] [Share scenario]    Assumptions [expand]   What is outside scope [expand]

[Map] [Charts] [Corporations]    [supported existing view]

Model Lab: Build/import • Equations • Add variable • Uncertainty
Explore AI risks: Separate model and intervention scenarios
```

The diagram is the one bold element. Its branching width represents same-unit accounting flows only. Per-person receipts sit in adjacent text, never share a dollar-volume width scale. Unfunded requests appear as a labeled outlined extension, not as paid flow. Display a table equivalent immediately available to keyboard/screen-reader users. If aggregate request diagnostics do not exist in the new core contract, show the selected corporation’s verified data; do not infer aggregate constraints from unrelated headline fields.

Never label source as real profit, cash available to shareholders, surplus, or net benefit. Always expose that expenses, ownership incidence, and competing uses are unestimated. No zero invented for unsupported outputs. When paid transfers reach available source, compute: “Requested [Q]; modeled source pool [F]; funded [C]; unfunded [U].” Show “Funding request fully covered” when supported by the diagnostics. The 100% rate endpoint gets no bottleneck claim. Amount mode demonstrates requests above the modeled source without silently changing availableShare.

## Mobile wireframe

```text
Transition Engine       Menu
Explore  Compare  Model Lab
Where could the gains
from AI go?
[Explore a dividend]
Try a policy idea
Explore retraining
[Model identity + scope + status]
[Contribution, input + allocation]
Follow the funds
Source [value]
  ├ Funded [value]
  └ Unused [value]
Unfunded request [value]
Receipts/person [value + denominator]
[Compare] [Share]
[Inspect calculation]
[Assumptions]
[Map | Charts | Corporations]
[Build or import] [Explore AI risks]
```

Keep actions in normal flow. No fixed playback bar covering content, horizontal page overflow, or tiny all-caps labels. Primary navigation remains exposed as three links at phone width. Scope/status wraps naturally. Charts and wide scientific tables scroll within their own containers; essential funding figures do not require horizontal scrolling.

## First minute and state behavior

0–10 seconds: see question, first action and real selected model scope. No mandatory tour and no initial eleven-number scoreboard. 10–30 seconds: choose contribution/allocation; get a labeled current comparison. 30–45 seconds: inspect how request, modeled source and paid receipts reconcile. 45–60 seconds: expand Assumptions or enter Compare, then discover Model Lab/risks directly below.

Use actual runner state. Loading names the calculation; stale outputs stay marked or are withheld. Cancellation stops the pending job; error names the problem with Retry/Edit options. A failed shared scenario opens its existing error, never a fresh welcome state disguising failure. Revisiting Explore retains the active run. Do not remount Lab and discard drafts when opening a helper panel or switching its internal workspace sections. Deep links and imported scenarios take priority over default landing selection.

Compare initially exposes the existing compatible world map comparison, zero-contribution paired chart, and Lab policy A/B route. It must explain which kind is selected; current App explicitly says chart/corporation comparison is not implemented. Do not promise arbitrary cross-model chart overlays. Native generations, steady-state-only outputs, scoped US horizons, and unsupported views retain existing limits.

## Component/file implementation plan

1. `App.tsx`: add a small guided destination/state layer and primary navigation while retaining existing tab handlers, imports, save/share actions, model selection, and error state. Preserve explicit old URLs. Render the guided introduction for new visits and provide a persistent return action. Remove the default tour prompt from this new entry.
2. New `components/guided/ExploreIntro.tsx`: questions, exact actions, direct Model Lab/risk links. Props dispatch to existing capabilities; no independent simulation state.
3. New `components/guided/FundingFlow.tsx`: render core-provided source/request/funded/unfunded/unused/recipient values with units, scope, accessible data table, and strict unavailable states. No economic calculations embedded in SVG layout.
4. New `components/guided/ScenarioContext.tsx`: actual model identity, scope, month/time unit, output definitions and resolver classifications. Consume the shared core capability/review contract when available. Never attach a blanket “reviewed” badge or infer evidence from a preset name.
5. New `components/guided/ExploreControls.tsx`: bind only live corporation request and allocation controls. Separate policy choices from availableShare, corporate scale, macro and conditional-index assumptions. Reuse existing update/replay pathways; exclude dead controls through capabilities.
6. `components/lab/LabTab.tsx`: optional initial section/focus affordance for policy and training entry. Keep `ModelImportPanel`, `AssumptionsPanel`, `BindingPanel`, `DiagnosticsPanel`, `TestsPanel`, `AddVariableForm`, `ModelFilePanel`, `PolicyPanel` and all runner/export behavior reachable. Make Author/Import/Policy/Uncertainty shortcuts visible without duplicating their logic. World equation authoring in `ModelEditor` and `ModelUpload` remains an explicitly world-specific route.
7. `src/index.css`: scoped `guided-*` tokens/classes; do not broadly restyle third-party or legacy scientific components with element selectors. `components/futures/FuturesTab.tsx` needs only a clear separate-model context/return link if existing context is insufficient.
8. Targeted integration tests for routing, deep-link precedence, capabilities, no draft loss and diagnostic-to-view mapping; retain full existing scientific checks. No key, gateway, server, deployment, model-equation or evidence-artifact changes are part of this interface branch.

## Acceptance and honest morning comparison

Record before and after on the same verified core commit/model/dataset/settings, in isolated branches; otherwise distinguish model changes from interface changes. Preserve the supplied old screenshot as historical baseline and capture a fresh core-fixed baseline before changing UI. Record URLs, commit hashes, viewport, theme, model/scenario identity and selected time. Compare desktop 1440×900, laptop 1280×720, phone 390×844 and narrow 320px.

Browser tasks: a new visitor can identify the question and initiate dividend exploration; adjust a real request; explain paid versus unfunded; find one assumption and its status; open policy example and inspect every mapped/unresolved/outside-model clause before running; compare A/B only in supported scope; share/reopen identical scenario; enter Lab, import a valid fixture, edit an assumption, add a variable, see bindings/diagnostics, download the reproducible files; find world equation editor, existing leaderboard/analysis, and separate risk model. Test invalid import and shared link, cancellation, empty data, unsupported outputs, and stale results. Confirm no engine value changes merely from navigation.

Keyboard tasks: logical focus order; labeled numeric controls and adjustable sliders; visible focus in both themes; menu Escape/return focus; open details without pointer; chart table accessible; no trapped focus or hidden required action. Touch tasks: controls at least 44px high, no hover-only explanation, direct risk/Lab access, readable units/status, no fixed overlay hiding result/actions.

Numerical/UI probes: request below/at/above source reproduces core diagnostics; availableShare remains explicit; no rate-endpoint bottleneck story; monthly-flow month0 semantics; per-person denominator/date/basis visible; conditional index never called observed wellbeing or a forecast; changed coefficients/custom model invalidate inherited review when required; risk unavailable as transfer effect; incompatible calendar/steady-state views remain withheld.

Morning report must show paired screenshots plus task pass/fail evidence and unresolved limitations. Do not claim usability improvement from screenshots alone; automated task completion demonstrates access and behavior, not first-time human comprehension. Keep the branch separable and unmerged until the user's requested comparison has been presented.

## Self-critique against template tendencies

Rejected an executive dashboard with three oversized outcome cards: it would repeat the current metric overload and invite decontextualized empirical readings. Rejected map-as-hero: geographic detail dominates the first action without explaining funds. Rejected a marketing landing page: it adds a click before the product. Chosen diagram earns its prominence because sources, requests and recipients are this model’s actual central accounting relationship. All other content is quiet type, controls and disclosure. No cream/serif/clay palette, neon dark skin, decorative gradients, numbered feature tiles, all-caps eyebrow labels, arrow-suffixed links, generic AI branding or equal-shadow card wall. Final implementation critique should remove any decorative element that does not help the user explain one real calculation.

## Coordinator acceptance of design direction

The question-led layout and single funding-flow emphasis are accepted for the separately authorized overnight interface branch. The third action is **Explore retraining**, because the actual constraint may be job openings or instructor capacity rather than funding. Display modeled source amounts as explicit scenario assumptions; fixed source inputs do not become forecasts of corporate cash. Keep supported scientific capabilities available and preserve deep links. Compare against both the historical screenshot and a core-fixed baseline so numerical and interface changes are distinguished.

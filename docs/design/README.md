# Design record (September 2026)

Chronological record of the AI Futures Map effort and the proposed unified core, kept here so the
reasoning is shareable. Nothing in this folder is a promise of what will be built.

| File | What it is |
|---|---|
| `brief.md` | The original brief given to two design agents (2026-09-09). |
| `proposal-fable.md`, `proposal-opus.md` | Their independent proposals. |
| `ai-futures-map-design.html` | The synthesised design, v2, with a live demo of the maths and a comparison to Anthropic's Econ Scenario Explorer (Korinek et al. 2026). Open in a browser. |
| `gamification-ideas.md` | Mechanics considered for making the site pleasant and honest; four shortlisted, three rejected. |
| `research/wellbeing-frameworks.md` | Wellbeing measures worth binding to (WHR ladder, WELLBYs, Social Progress Index) and elasticities. |
| `research/modeling-frameworks.md` | Survey of system-dynamics, microsimulation, AI-economics and forecasting tools; what to borrow. |
| `research/policy-validation.md` | How policy effects are established empirically; a validation-case library and scoring; first six cases. |
| `research/squiggle.md` | Evaluation of Squiggle for uncertainty; declined in favour of a small distribution literal. |
| `spec/core-spec-v1.md` | Draft specification of a unified equation-graph core replacing the two current engines. Known to have serious errors after external review; kept as the starting point for v2. |
| `spec/core-spec-v1-REVIEW-BUNDLE.md`, `spec/review-prompt.txt` | The self-contained bundle and prompt used to obtain an external model review. |

What exists in the app today (branch merged to main): the country simulator (Map, Charts, Corporations
tabs), the Futures tab (goodness chart, interventions, paste-a-bill, expert/public voting), the
Korinek et al. 2026 reproduction (`npm run validate:korinek`), and the hindcast (`npm run hindcast`).

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered economic transition simulator that models the transition from labor-based economies to automated abundance. It visualizes global AI adoption rates, UBI distribution mechanics, and their effects on human wellbeing across 100+ countries.

## Commands

```bash
# Install dependencies
npm install

# Run development server (port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Setup

Set `GEMINI_API_KEY` in `.env.local` for AI-powered analysis features (Summarize and Red Team audit).

## Architecture

### Tech Stack
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 6
- **Visualization**: D3.js (world map), Recharts (2D charts), custom Canvas API (3D motion chart)
- **AI Integration**: Google Gemini API via `@google/genai`
- **Styling**: Tailwind CSS (utility classes inline)

### Model Philosophy: Corporation-Centric UBI

The simulation models a **corporation-driven** UBI system, not a nation-state driven one. This reflects a free-market approach where:
- **Corporations voluntarily contribute** AI revenue to a global UBI fund based on self-interest (maintaining customer purchasing power)
- **Direct-to-wallet distribution** via blockchain (assumed always enabled - no government intermediaries)
- **Nation-states are recipients**, not policy-makers (countries can't set UBI rates or block distribution)
- **Three distribution strategies**: global (equal per capita), customer-weighted (proportional to markets), hq-local (HQ country only)

This reduces existential risk by not depending on nation-state cooperation, which may be unreliable.

### Core Files

| File | Purpose |
|------|---------|
| `App.tsx` | Main application component: corporation-driven simulation logic, state management, all tab views |
| `types.ts` | TypeScript interfaces: `Corporation`, `GlobalLedger`, `GameTheoryState`, `CountryStats`, `ModelParameters` |
| `constants.ts` | 90+ initial corporations (tech giants, AI specialists, regional players), country data, scenario presets |
| `services/geminiService.ts` | Gemini API integration for Red Team analysis and simulation summaries |

### Components

| Component | Purpose |
|-----------|---------|
| `WorldMap.tsx` | D3-based interactive world map: adoption, wellbeing, UBI received, corp HQs. Click countries/hover for stats |
| `MotionChart.tsx` | Dual-mode chart (2D Recharts / 3D Canvas) showing wellbeing vs adoption over time |
| `SimulationControls.tsx` | Playback controls: play/pause, speed, timeline seek, reset |
| `CorporationList.tsx` | Sortable table of all corporations: name, HQ, AI revenue, contribution rate, strategy. Filter/search/select |
| `CorporationDetailPanel.tsx` | Slide-out panel for selected corporation: edit policies, view metrics, customer health, projections |
| `GameTheoryVisualization.tsx` | Cooperation meter, strategy breakdown, contribution histogram, status indicators |

### Simulation Flow (Corporation-Centric)

Each month, the simulation executes **5 phases**:

1. **Corporation Revenue Generation**
   - Each corporation earns AI revenue based on adoption level and customer purchasing power
   - Revenue formula: `aiRevenue = aiAdoptionLevel × marketCap × 0.15 × demandFactor`
   - Demand factor depends on customer wellbeing (poor customers can't afford products)

2. **Corporation Contribution Decisions**
   - Each corporation decides how much AI revenue to contribute based on its `contributionRate` (5-50%)
   - Distributes funds via chosen strategy: global (to GlobalLedger), customer-weighted (to operating countries), hq-local (to HQ country)

3. **UBI Distribution to Citizens**
   - GlobalLedger distributes funds equally per capita worldwide
   - Countries receive UBI from: global pool + customer-weighted corps + HQ-local corps
   - Direct-to-wallet (blockchain) ensures no corruption

4. **Wellbeing Calculation**
   - UBI boosts wellbeing (purchasing power maintained despite job displacement)
   - Displacement friction reduces wellbeing (AI adoption displaces labor income)
   - Net wellbeing = base GDP wellbeing + UBI boost - displacement friction

5. **Corporation Adaptive Policy** (Game Theory)
   - Corporations observe market conditions and competitor behavior
   - Adaptive triggers: demand collapse projection, reputation pressure, Nash equilibrium dynamics
   - Corporations may increase contribution to save customer base or match competitors

### Key Simulation Parameters

**Economic Constants:**
- `aiGrowthRate`: Base viral coefficient of AI technology spread (0.04-0.15)
- `displacementRate`: % of labor income displaced at 100% AI adoption (0.7-0.85)
- `gdpScaling`: Wealth gradient for UBI distribution (0 = flat, 1 = GDP-proportional)

**Corporation Policy:**
- `defaultCorpPolicy`: Initial stance (free-market, selfish-start, altruistic-start, mixed-reality)
- `marketPressure`: How strongly customer demand affects corp decisions (0-1)

**Corporation-Level Settings** (editable per corp):
- `contributionRate`: % of AI revenue contributed to UBI (5-50%)
- `distributionStrategy`: global / customer-weighted / hq-local
- `policyStance`: generous / moderate / selfish (affects reputation)

### Game Theory Mechanics

The simulation models **prisoner's dilemma dynamics** in corporate UBI contributions:

**Nash Equilibrium Dynamics:**
- **Virtuous Cycle**: If 60%+ cooperate, reputation pressure encourages others to cooperate
- **Race to Bottom**: If 40%+ defect, competitive pressure encourages others to defect
- **Prisoner's Dilemma**: Tension zone where cooperation is optimal collectively but defection is tempting individually

**Adaptive Mechanisms:**
- **Demand Collapse Projection**: Corps project future customer purchasing power; if collapsing, increase UBI to save markets
- **Reputation System**: Generous corps gain reputation (68-80), selfish corps lose it (50-60). Reputation affects customer preference.
- **Competitor Awareness**: Corps observe competitor contribution rates and adjust to match market leaders

**Regional Behavior:**
- **US Corps**: May prioritize US when US wellbeing < 50 (shift to hq-local or customer-weighted)
- **China Corps**: More protectionist, state-influenced (tend toward hq-local)
- **EU Corps**: Social contract pressure (generous when doing well)

### View Modes

- **Overview Tab**: Animated SVG showing the abundance cycle (Corps → AI Revenue → Global Ledger → Citizens → Purchasing Power → Corps)
- **Map Tab**: Interactive world map with view modes:
  - AI Adoption (blue gradient)
  - Wellbeing (red-yellow-green gradient)
  - UBI Received (green gradient)
  - Corp HQs (purple gradient)
  - Selected corp highlighting (HQ = amber border, operating countries = blue border)
- **Corporations Tab**:
  - Corporation list (sortable, filterable by HQ/strategy/stance, searchable)
  - Game theory visualization (cooperation meter, strategy breakdown, contribution histogram)
  - Click corporation to open detail panel for policy editing
- **Charts Tab**: Motion chart (2D/3D toggle) + fund accumulation graph + AI analysis buttons
- **Analysis Tab**: Gemini-powered simulation summary and red team audit
- **Guide/Equations**: Documentation and detailed mathematical formulas

### Save/Load System

- **Auto-save**: Simulation state saved to localStorage every 5 minutes
- **Manual save**: Download simulation as JSON file (includes corporations, countries, ledger, game theory state, history)
- **Load**: Upload saved JSON to restore exact simulation state
- **Scenario presets**: 6 pre-configured scenarios (Free Market, Race to Bottom, Altruism, US Protectionism, China Dominance, EU Solidarity)

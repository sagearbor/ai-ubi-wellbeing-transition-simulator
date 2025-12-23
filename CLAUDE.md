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

### Core Files

| File | Purpose |
|------|---------|
| `App.tsx` | Main application component containing simulation logic, state management, and all tab views |
| `types.ts` | TypeScript interfaces: `ModelParameters`, `SimulationState`, `CountryStats`, `HistoryPoint` |
| `constants.ts` | Preset economic models and initial country data (population, GDP, social resilience) |
| `services/geminiService.ts` | Gemini API integration for Red Team analysis and simulation summaries |

### Components

| Component | Purpose |
|-----------|---------|
| `WorldMap.tsx` | D3-based interactive world map with zoom/pan, country hover stats, click-to-invest |
| `MotionChart.tsx` | Dual-mode chart (2D Recharts / 3D Canvas) showing wellbeing vs adoption over time |
| `SimulationControls.tsx` | Playback controls: play/pause, speed, timeline seek, reset |

### Simulation Flow

1. **State Initialization**: Countries start with 1% AI adoption, wellbeing based on GDP
2. **Step Function** (`stepSimulation` in App.tsx): Each month calculates:
   - Corporate adoption probability (sigmoid-based incentive curve)
   - Surplus generation (based on adoption^1.6 and population)
   - Fund contribution (surplus × tax rate)
   - GDP-scaled UBI distribution per country
   - Wellbeing delta (UBI utility boost minus displacement friction)
3. **History Tracking**: Each state snapshot is stored for timeline scrubbing and chart rendering

### Key Simulation Parameters

- `corporateTaxRate`: % of AI surplus collected for global fund
- `adoptionIncentive`: Subsidy encouraging corporate AI adoption
- `aiGrowthRate`: Base viral coefficient of technology spread
- `gdpScaling`: 0 = flat UBI, 1 = GDP-proportional distribution

### View Modes

- **Map Tab**: Interactive world map (adoption = blue gradient, wellbeing = red-yellow-green)
- **Charts Tab**: Motion chart + fund accumulation graph + AI analysis buttons
- **Analysis Tab**: Gemini-powered simulation summary and red team audit
- **Guide/Overview/Equations**: Documentation and model explanation tabs

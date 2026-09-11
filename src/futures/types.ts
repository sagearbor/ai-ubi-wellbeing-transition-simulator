/**
 * AI Futures Map — type contracts.
 *
 * Design: tmp/futures-design/ai-futures-map-design.html (v2, 2026-09-10).
 *
 * Two kinds of node:
 *   - `event`  : a non-exclusive proposition ("AGI exists by year Y"). Cumulative curve at
 *                the graph's event horizons. Any subset of events may co-occur.
 *   - `state`  : one of a few mutually exclusive world-states on the single `axis`, each with
 *                a fixed `goodness` value (0-100). State curves are marginals at the axis
 *                horizons and are renormalised to sum to 1 at every year.
 *
 * Edges are stored on the CHILD node as `parents[]`. Strength is a signed number in [-1, 1]
 * applied in log-odds. Cycles are allowed only if every cycle contains an edge with lag >= 1.
 *
 * Two time axes, never conflated:
 *   - horizon / year : "by 2035" — the x-axis of every chart.
 *   - asOf           : when an estimate was recorded — drives history charts only.
 */

export type Tier = 'locked' | 'expert' | 'public';
export type NodeKind = 'event' | 'state';
export type Lane = 'capability' | 'governance' | 'economy' | 'society' | 'catastrophe' | 'flourishing';
export type Valence = 'good' | 'bad' | 'neutral' | 'mixed';
export type Severity = 'none' | 'disruptive' | 'catastrophic' | 'existential';
export type EdgeKind = 'requires' | 'enables' | 'amplifies' | 'dampens' | 'prevents';
export type Confidence = 'low' | 'medium' | 'high';

/** Year (as string key, e.g. "2035") -> probability in [0, 1]. */
export type Curve = Record<string, number>;

export interface Source {
  label: string;
  kind: 'survey' | 'forecast-market' | 'paper' | 'scenario' | 'public-statement' | 'editorial';
  url?: string;
  value?: string;
  retrieved?: string;
  quote?: string;
}

export interface Seed {
  curve: Curve;
  basis: string;
  confidence: Confidence;
  sources?: Source[];
  seededBy?: string;
  asOf?: string;
}

export interface ParentEdge {
  from: string;
  kind: EdgeKind;
  /** Signed strength in [-1, 1], applied in log-odds. requires/enables/amplifies > 0; dampens/prevents < 0. */
  strength: number;
  /** Years between cause and effect. Default 0. Cycles must cross at least one lag >= 1 edge. */
  lag?: number;
  /** Required. Plain-English justification, shown in the UI whenever the edge is traversed. */
  note: string;
}

export interface FuturesNode {
  id: string;
  kind: NodeKind;
  label: string;
  shortLabel?: string;
  /** Events only. */
  lane?: Lane;
  valence: Valence;
  severity?: Severity;
  /** States only. 0-100, the y-position on the goodness river. */
  goodness?: number;
  summary: string;
  /** Required for anything votable. The resolvable criterion. */
  operationalisation?: string;
  narrative?: string;
  seed: Seed;
  parents?: ParentEdge[];
  since?: string;
  retired?: string;
  supersededBy?: string;
  tags?: string[];
}

export interface Axis {
  id: string;
  label: string;
  /** State node ids, any order. */
  states: string[];
  /** Years at which state marginals are seeded / voted. */
  horizons: number[];
  /** State ids that are absorbing for the flow computation (e.g. "existential"). */
  absorbing?: string[];
  /** Goodness at or below which a state counts toward "floor risk". Default 20. */
  floorGoodness?: number;
  /** Goodness at or above which a state counts toward "ceiling chance". Default 90. */
  ceilingGoodness?: number;
}

export interface ChangelogEntry {
  graphVersion: string;
  date: string;
  note: string;
}

export interface FuturesGraph {
  schemaVersion: 1;
  /** Date-based content version, e.g. "2026-09-10" or "2026-09-10.2". */
  graphVersion: string;
  title?: string;
  description?: string;
  /** First simulated year (state curves may carry a seed here, e.g. muddling ~0.96 in 2026). */
  startYear: number;
  /** Last simulated year. */
  endYear: number;
  /** Event horizons, e.g. [2028, 2030, 2035, 2045]. */
  horizons: number[];
  axis: Axis;
  nodes: FuturesNode[];
  metadata: {
    editors: string[];
    changelog: ChangelogEntry[];
  };
}

// ---------------------------------------------------------------------------
// Interventions
// ---------------------------------------------------------------------------

export type Magnitude = 'slight' | 'moderate' | 'strong';
export type Direction = 'up' | 'down';
export type CostBand = 1 | 2 | 3 | 4 | 5;

/** The only numbers an LLM or a lay user ever sets are these enum picks. */
export const MAGNITUDE_LOG_ODDS: Record<Magnitude, number> = {
  slight: 0.25,
  moderate: 0.5,
  strong: 1.0,
};

export interface Nudge {
  node: string;
  direction: Direction;
  magnitude: Magnitude;
  /** Years after the intervention's startYear before this nudge takes effect. Default 0. */
  lag?: number;
  /** A quoted sentence from the source justifying this pick. Required for ai-drafted cards. */
  evidence?: string;
}

export interface InterventionSource {
  kind: 'bill' | 'paper' | 'proposal' | 'editorial';
  url?: string;
  title?: string;
  quote?: string;
}

export interface Intervention {
  schemaVersion: 1;
  id: string;
  label: string;
  summary: string;
  source: InterventionSource;
  tier: Tier;
  status: 'ai-drafted' | 'reviewed' | 'locked';
  cost: { band: CostBand; note?: string };
  startYear: number;
  nudges: Nudge[];
  extractedBy?: { model: string; asOf: string; reviewedBy?: string | null };
}

// ---------------------------------------------------------------------------
// Estimates and aggregates (tiers)
// ---------------------------------------------------------------------------

export interface Estimate {
  uid: string;
  tier: Tier;
  nodeId: string;
  graphVersion: string;
  curve: Curve;
  note?: string;
  /** ISO date the estimate was made. */
  asOf: string;
  /** Owner-set weight for experts (0.5-3). Default 1. */
  weight?: number;
}

export interface Aggregate {
  nodeId: string;
  tier: Tier;
  curve: Curve;
  band25: Curve;
  band75: Curve;
  n: number;
  nEff: number;
  updatedAt: string;
  graphVersion: string;
}

// ---------------------------------------------------------------------------
// Engine I/O
// ---------------------------------------------------------------------------

/** nodeId -> per-year log-odds shift, index 0 = graph.startYear. Missing node = no shift. */
export type ShiftVector = Record<string, number[]>;

export interface Baseline {
  years: number[];
  /** nodeId -> P per year (states renormalised per year). */
  P: Record<string, number[]>;
}

export interface SolveResult extends Baseline {
  /** The baseline this solve was computed against. */
  base: Record<string, number[]>;
}

export interface GoodnessSeries {
  years: number[];
  /** Expected goodness, 0-100. */
  mean: number[];
  /** P(state with goodness <= axis.floorGoodness). */
  floor: number[];
  /** P(state with goodness >= axis.ceilingGoodness). */
  ceiling: number[];
}

export interface InterventionMetrics {
  interventionId: string;
  /** mean(endYear) - baseline mean(endYear). */
  meanShift: number;
  /** baseline floor(endYear) - floor(endYear). Positive = the bad tail shrank. */
  floorLift: number;
  /** ceiling(endYear) - baseline ceiling(endYear). */
  ceilingLift: number;
  cost: CostBand;
  shiftPerCost: number;
}

/** Probability mass flowing between two world-states across consecutive horizons. */
export interface StateFlow {
  from: string;
  to: string;
  fromYear: number;
  toYear: number;
  mass: number;
}

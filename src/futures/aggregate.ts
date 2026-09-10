/**
 * AI Futures Map — tier pooling.
 *
 * Design: tmp/futures-design/ai-futures-map-design.html section 4.5. One function, used in two
 * places: the browser computes a live provisional number with it, and the nightly
 * `scripts/futures-aggregate.ts` cron writes the stored aggregates with it. Pure, so both agree.
 *
 *   for each voter u, latest estimate only:
 *     r_u = 0.5 ^ (age_days / 365)                    recency, one-year half-life
 *     x_u = logit(clamp(curve_u[h], 0.005, 0.995))    never let 0 or 1 into the pool
 *     w_u = q_u * r_u                                 q_u = 1, owner-editable 0.5-3 for experts
 *   PUBLIC:  L_raw = weighted median of x_u           robust to trolls and 0/100 spammers
 *   EXPERT:  L_raw = weighted mean after dropping the top and bottom 10% by weight
 *   LOCKED:  L_raw = logit(seed)
 *   n_eff   = (sum w)^2 / sum(w^2)                    Kish effective sample size
 *   L_tier  = (n_eff * L_raw + 5 * L_seed) / (n_eff + 5)
 *   P_tier  = sigmoid(L_tier); band = weighted 25th and 75th percentiles
 *
 * Two deliberate choices the design leaves open:
 *   - The **bands are the raw pool's** weighted percentiles, not shrunk. They describe the
 *     spread of opinion; the shrunk centre describes what we are willing to publish. With a
 *     single estimate the band is that estimate while the curve sits near the seed, which is
 *     the honest picture.
 *   - Shrinkage uses the **per-horizon** n_eff (a voter may answer 2035 and skip 2045), while
 *     the reported `nEff`/`n` describe the node's whole pool.
 *
 * Pure: no React, no DOM, no I/O.
 */

import { P_MAX, P_MIN, clamp, interpolateCurve, logit, sigmoid } from './engine';
import { Aggregate, Curve, Estimate, Tier } from './types';

const DAY_MS = 86_400_000;

export interface AggregateOptions {
  /** Required when `estimates` is empty (there is then nothing to read the id from). */
  nodeId?: string;
  /** Stamped onto the result. Defaults to the newest estimate's graphVersion, else ''. */
  graphVersion?: string;
  /** Shrink-toward-seed strength, the `5` in the formula. Default 5. */
  shrinkK?: number;
  /** Recency half-life in days. Default 365. */
  halfLifeDays?: number;
  /** Fraction trimmed off each tail of the expert mean. Default 0.1. */
  trim?: number;
  /** Minimum number of estimates at a horizon before any trimming happens. Default 10. */
  trimMinN?: number;
  /** Stamped onto the result. Defaults to `now`. */
  updatedAt?: string;
}

export const DEFAULT_SHRINK_K = 5;
export const DEFAULT_HALF_LIFE_DAYS = 365;
export const DEFAULT_TRIM = 0.1;
export const DEFAULT_TRIM_MIN_N = 10;
/** Below this the UI greys the number out with "not enough estimates yet" (design 4.5). */
export const THIN_NEFF = 5;

// ---------------------------------------------------------------------------
// Weighted order statistics
// ---------------------------------------------------------------------------

/**
 * Weighted percentile, `p` in [0, 1], using the standard midpoint-of-weight convention:
 * each sorted value sits at cumulative position (prior weight + half its own) / total weight,
 * and we interpolate linearly between neighbours. Continuous in the weights, so a slowly
 * decaying vote does not make the published number jump.
 *
 * Values and weights are positionally paired. Non-finite values and non-positive weights are
 * dropped. Returns NaN when nothing usable is left.
 */
export function weightedPercentile(values: number[], weights: number[], p: number): number {
  const pairs: Array<{ v: number; w: number }> = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const w = weights[i] ?? 1;
    if (Number.isFinite(v) && Number.isFinite(w) && w > 0) pairs.push({ v, w });
  }
  if (pairs.length === 0) return NaN;
  if (pairs.length === 1) return pairs[0].v;

  pairs.sort((a, b) => a.v - b.v);
  const total = pairs.reduce((s, x) => s + x.w, 0);
  if (total <= 0) return NaN;

  const target = clamp(p, 0, 1);
  const pos: number[] = [];
  let cum = 0;
  for (const x of pairs) {
    pos.push((cum + x.w / 2) / total);
    cum += x.w;
  }

  if (target <= pos[0]) return pairs[0].v;
  if (target >= pos[pos.length - 1]) return pairs[pairs.length - 1].v;
  let k = 0;
  while (k < pos.length - 2 && pos[k + 1] < target) k++;
  const f = (target - pos[k]) / Math.max(1e-12, pos[k + 1] - pos[k]);
  return pairs[k].v + f * (pairs[k + 1].v - pairs[k].v);
}

/** Weighted median. See `weightedPercentile`. */
export function weightedMedian(values: number[], weights: number[]): number {
  return weightedPercentile(values, weights, 0.5);
}

/** Plain weighted mean. Returns NaN when no positive weight remains. */
export function weightedMean(values: number[], weights: number[]): number {
  let sw = 0;
  let sx = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const w = weights[i] ?? 1;
    if (!Number.isFinite(v) || !Number.isFinite(w) || w <= 0) continue;
    sw += w;
    sx += w * v;
  }
  return sw > 0 ? sx / sw : NaN;
}

/**
 * Weighted mean after dropping `trim` of the total WEIGHT (not of the count) from each tail.
 * A value straddling the cut contributes only the part of its weight that falls inside, so the
 * estimator is continuous: one expert's weight decaying does not flip a vote in or out.
 */
export function trimmedWeightedMean(values: number[], weights: number[], trim: number): number {
  const pairs: Array<{ v: number; w: number }> = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const w = weights[i] ?? 1;
    if (Number.isFinite(v) && Number.isFinite(w) && w > 0) pairs.push({ v, w });
  }
  if (pairs.length === 0) return NaN;
  pairs.sort((a, b) => a.v - b.v);
  const total = pairs.reduce((s, x) => s + x.w, 0);
  const lo = clamp(trim, 0, 0.49) * total;
  const hi = total - lo;
  if (hi <= lo) return weightedMean(values, weights);

  let cum = 0;
  let sw = 0;
  let sx = 0;
  for (const x of pairs) {
    const a = Math.max(cum, lo);
    const b = Math.min(cum + x.w, hi);
    cum += x.w;
    const kept = b - a;
    if (kept <= 0) continue;
    sw += kept;
    sx += kept * x.v;
  }
  return sw > 0 ? sx / sw : weightedMean(values, weights);
}

/** Kish effective sample size, (sum w)^2 / sum(w^2). 0 when there is no weight. */
export function kishNEff(weights: number[]): number {
  let s = 0;
  let s2 = 0;
  for (const w of weights) {
    if (!Number.isFinite(w) || w <= 0) continue;
    s += w;
    s2 += w * w;
  }
  return s2 > 0 ? (s * s) / s2 : 0;
}

// ---------------------------------------------------------------------------
// Pooling
// ---------------------------------------------------------------------------

/** Keep only each uid's newest estimate (ties broken by later position in the array). */
export function latestPerUid(estimates: Estimate[]): Estimate[] {
  const best = new Map<string, { e: Estimate; t: number; i: number }>();
  estimates.forEach((e, i) => {
    const t = Date.parse(e.asOf);
    const at = Number.isFinite(t) ? t : -Infinity;
    const prev = best.get(e.uid);
    if (!prev || at > prev.t || (at === prev.t && i > prev.i)) best.set(e.uid, { e, t: at, i });
  });
  return [...best.values()].map((x) => x.e);
}

/** Recency weight: 0.5 ^ (age in days / half-life). Future-dated estimates get 1, not > 1. */
export function recencyWeight(asOf: string, now: Date, halfLifeDays = DEFAULT_HALF_LIFE_DAYS): number {
  const t = Date.parse(asOf);
  if (!Number.isFinite(t)) return 0;
  const ageDays = Math.max(0, (now.getTime() - t) / DAY_MS);
  if (halfLifeDays <= 0) return 1;
  return Math.pow(0.5, ageDays / halfLifeDays);
}

/** Read a (possibly sparse) curve at one horizon, interpolating in log-odds and holding flat. */
function valueAt(curve: Curve, horizon: number): number | null {
  if (!curve || typeof curve !== 'object') return null;
  // exact hit: return it verbatim rather than round-tripping through logit/sigmoid
  const exact = curve[String(horizon)];
  if (typeof exact === 'number' && Number.isFinite(exact)) return exact;
  const usable = Object.keys(curve).some((k) => Number.isFinite(Number(k)) && Number.isFinite(curve[k]));
  if (!usable) return null;
  const clean: Curve = {};
  for (const k of Object.keys(curve)) {
    if (Number.isFinite(Number(k)) && Number.isFinite(curve[k])) clean[k] = curve[k];
  }
  const v = interpolateCurve(clean, [horizon])[0];
  return Number.isFinite(v) ? v : null;
}

/**
 * Pool one node's estimates for one tier into a published curve plus a 25-75 band.
 *
 * @param estimates  every estimate for this node (any tier; other tiers are ignored)
 * @param tier       which tier to publish
 * @param seedCurve  the locked seed — the shrink target, and the whole answer for `locked`
 * @param horizons   the years to publish, e.g. graph.axis.horizons or graph.horizons
 * @param now        the clock, for recency weighting. Injected so tests are deterministic.
 */
export function aggregateNode(
  estimates: Estimate[],
  tier: Tier,
  seedCurve: Curve,
  horizons: number[],
  now: Date,
  opts: AggregateOptions = {},
): Aggregate {
  const shrinkK = opts.shrinkK ?? DEFAULT_SHRINK_K;
  const halfLifeDays = opts.halfLifeDays ?? DEFAULT_HALF_LIFE_DAYS;
  const trim = opts.trim ?? DEFAULT_TRIM;
  const trimMinN = opts.trimMinN ?? DEFAULT_TRIM_MIN_N;

  const mine = latestPerUid(estimates.filter((e) => e.tier === tier));
  const nodeId = opts.nodeId ?? mine[0]?.nodeId ?? estimates[0]?.nodeId;
  if (!nodeId) throw new Error('aggregateNode: no nodeId — pass opts.nodeId when there are no estimates');

  const newest = [...mine].sort((a, b) => (Date.parse(a.asOf) || 0) - (Date.parse(b.asOf) || 0)).pop();
  const graphVersion = opts.graphVersion ?? newest?.graphVersion ?? '';

  const curve: Curve = {};
  const band25: Curve = {};
  const band75: Curve = {};

  // node-level pool size, reported on the card next to the number
  const nodeWeights = mine.map((e) => (e.weight ?? 1) * recencyWeight(e.asOf, now, halfLifeDays));
  const nEff = kishNEff(nodeWeights);

  for (const h of horizons) {
    const key = String(h);
    const seedRaw = valueAt(seedCurve, h);
    const seedP = seedRaw === null ? 0.5 : clamp(seedRaw, P_MIN, P_MAX);
    const lSeed = logit(seedP);

    // LOCKED is the seed, verbatim — never pooled, never shrunk.
    if (tier === 'locked') {
      const v = seedRaw === null ? 0.5 : seedRaw;
      curve[key] = v;
      band25[key] = v;
      band75[key] = v;
      continue;
    }

    const xs: number[] = [];
    const ws: number[] = [];
    for (const e of mine) {
      const p = valueAt(e.curve, h);
      if (p === null) continue;
      const w = (e.weight ?? 1) * recencyWeight(e.asOf, now, halfLifeDays);
      if (!(w > 0)) continue;
      xs.push(logit(clamp(p, P_MIN, P_MAX)));
      ws.push(w);
    }

    if (xs.length === 0) {
      // nothing to pool: publish the seed exactly rather than a sigmoid(logit()) round-trip
      const v = seedRaw === null ? 0.5 : seedRaw;
      curve[key] = v;
      band25[key] = v;
      band75[key] = v;
      continue;
    }

    const lRaw =
      tier === 'public'
        ? weightedMedian(xs, ws)
        : xs.length >= trimMinN
          ? trimmedWeightedMean(xs, ws, trim)
          : weightedMean(xs, ws);

    const nEffH = kishNEff(ws);
    const lTier = (nEffH * lRaw + shrinkK * lSeed) / (nEffH + shrinkK);
    curve[key] = sigmoid(lTier);
    band25[key] = sigmoid(weightedPercentile(xs, ws, 0.25));
    band75[key] = sigmoid(weightedPercentile(xs, ws, 0.75));
  }

  return {
    nodeId,
    tier,
    curve,
    band25,
    band75,
    n: tier === 'locked' ? 0 : mine.length,
    nEff: tier === 'locked' ? 0 : nEff,
    updatedAt: opts.updatedAt ?? now.toISOString(),
    graphVersion,
  };
}

/**
 * Renormalise a set of state aggregates so the published marginals sum to 1 at every horizon
 * (design 4.5: "State votes: aggregate each state, then renormalise"). Bands are left alone —
 * they are per-state spreads of opinion, not a joint distribution.
 */
export function renormaliseStateAggregates(aggregates: Aggregate[], horizons: number[]): Aggregate[] {
  const out = aggregates.map((a) => ({ ...a, curve: { ...a.curve } }));
  for (const h of horizons) {
    const key = String(h);
    let z = 0;
    for (const a of out) z += a.curve[key] ?? 0;
    if (z > 0) for (const a of out) if (a.curve[key] !== undefined) a.curve[key] /= z;
  }
  return out;
}

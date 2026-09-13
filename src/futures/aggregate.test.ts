/**
 * Tests for src/futures/aggregate.ts — tier pooling (design 4.5).
 *
 * The headline requirement is robustness: the public number must survive 0/100 spammers, and
 * a thin pool must not be allowed to shout down the curated seed.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHRINK_K,
  aggregateNode,
  kishNEff,
  latestPerUid,
  recencyWeight,
  renormaliseStateAggregates,
  trimmedWeightedMean,
  weightedMean,
  weightedMedian,
  weightedPercentile,
} from './aggregate';
import { Curve, Estimate, Tier } from './types';

const NOW = new Date('2026-09-10T00:00:00Z');
const HORIZONS = [2030, 2035, 2045];
const SEED: Curve = { '2030': 0.2, '2035': 0.35, '2045': 0.5 };

let seq = 0;
function est(p: number, over: Partial<Estimate> = {}): Estimate {
  seq += 1;
  return {
    uid: over.uid ?? `u${seq}`,
    tier: over.tier ?? 'public',
    nodeId: over.nodeId ?? 'frontier-agi',
    graphVersion: over.graphVersion ?? 'test-0001',
    curve: over.curve ?? { '2030': p, '2035': p, '2045': p },
    asOf: over.asOf ?? '2026-09-01',
    ...(over.weight !== undefined ? { weight: over.weight } : {}),
  };
}

const many = (n: number, p: number, over: Partial<Estimate> = {}) =>
  Array.from({ length: n }, () => est(p, over));

describe('weighted order statistics', () => {
  it('medians a flat pool', () => {
    expect(weightedMedian([1, 2, 3], [1, 1, 1])).toBeCloseTo(2, 12);
  });

  it('follows the weight, not the count', () => {
    // one heavy vote at 10 against three light ones at 0: the median lands next to the heavy one
    expect(weightedMedian([0, 0, 0, 10], [0.1, 0.1, 0.1, 10])).toBeGreaterThan(9);
    expect(weightedMedian([0, 0, 0, 10], [1, 1, 1, 1])).toBeLessThan(1);
  });

  it('handles one value and no values', () => {
    expect(weightedMedian([7], [1])).toBe(7);
    expect(weightedMedian([], [])).toBeNaN();
    expect(weightedMedian([1, 2], [0, 0])).toBeNaN();
  });

  it('drops non-finite values and non-positive weights', () => {
    expect(weightedMedian([1, NaN, 3], [1, 1, 1])).toBeCloseTo(2, 12);
    expect(weightedMean([1, 99], [1, 0])).toBe(1);
  });

  it('orders percentiles', () => {
    const v = [1, 2, 3, 4, 5];
    const w = [1, 1, 1, 1, 1];
    expect(weightedPercentile(v, w, 0.25)).toBeLessThan(weightedPercentile(v, w, 0.5));
    expect(weightedPercentile(v, w, 0.5)).toBeLessThan(weightedPercentile(v, w, 0.75));
    expect(weightedPercentile(v, w, 0)).toBe(1);
    expect(weightedPercentile(v, w, 1)).toBe(5);
  });

  it('trims by weight, not by count, and only what falls outside the cut', () => {
    // 10 votes at 0 plus one extreme at 100: the trimmed mean ignores the extreme entirely
    const v = [...new Array(10).fill(0), 100];
    const w = new Array(11).fill(1);
    expect(trimmedWeightedMean(v, w, 0.1)).toBeCloseTo(0, 9);
    expect(weightedMean(v, w)).toBeCloseTo(100 / 11, 9);
  });

  it('computes Kish n_eff', () => {
    expect(kishNEff([1, 1, 1, 1])).toBeCloseTo(4, 12);
    expect(kishNEff([3, 1, 1])).toBeLessThan(3);
    expect(kishNEff([])).toBe(0);
  });
});

describe('recency and latest-per-uid', () => {
  it('halves the weight after a year', () => {
    expect(recencyWeight('2026-09-10', NOW)).toBeCloseTo(1, 9);
    expect(recencyWeight('2025-09-10', NOW)).toBeCloseTo(0.5, 2);
    expect(recencyWeight('2024-09-10', NOW)).toBeCloseTo(0.25, 2);
  });

  it('never weights a future-dated estimate above 1, and rejects garbage dates', () => {
    expect(recencyWeight('2030-01-01', NOW)).toBe(1);
    expect(recencyWeight('not a date', NOW)).toBe(0);
  });

  it('keeps only each voter\'s newest estimate', () => {
    const old = est(0.1, { uid: 'a', asOf: '2025-01-01' });
    const fresh = est(0.9, { uid: 'a', asOf: '2026-06-01' });
    const other = est(0.5, { uid: 'b', asOf: '2026-06-01' });
    const kept = latestPerUid([fresh, old, other]);
    expect(kept).toHaveLength(2);
    expect(kept.find((e) => e.uid === 'a')!.curve['2035']).toBe(0.9);
  });
});

describe('aggregateNode: locked and empty pools', () => {
  it('publishes the seed verbatim for the locked tier and ignores estimates', () => {
    const a = aggregateNode(many(20, 0.95, { tier: 'locked' }), 'locked', SEED, HORIZONS, NOW);
    expect(a.curve).toEqual(SEED);
    expect(a.band25).toEqual(SEED);
    expect(a.band75).toEqual(SEED);
    expect(a.n).toBe(0);
    expect(a.nEff).toBe(0);
  });

  it('publishes the seed verbatim when a tier has no estimates at all', () => {
    const a = aggregateNode([], 'expert', SEED, HORIZONS, NOW, { nodeId: 'frontier-agi' });
    expect(a.curve).toEqual(SEED);
    expect(a.n).toBe(0);
    expect(a.nEff).toBe(0);
  });

  it('ignores estimates belonging to another tier', () => {
    const a = aggregateNode(many(6, 0.9, { tier: 'expert' }), 'public', SEED, HORIZONS, NOW, { nodeId: 'frontier-agi' });
    expect(a.curve).toEqual(SEED);
    expect(a.n).toBe(0);
  });

  it('stamps nodeId, graphVersion and updatedAt', () => {
    const a = aggregateNode(many(3, 0.4), 'public', SEED, HORIZONS, NOW);
    expect(a.nodeId).toBe('frontier-agi');
    expect(a.tier).toBe('public');
    expect(a.graphVersion).toBe('test-0001');
    expect(a.updatedAt).toBe(NOW.toISOString());
  });

  it('throws only when it cannot possibly know the node id', () => {
    expect(() => aggregateNode([], 'public', SEED, HORIZONS, NOW)).toThrow(/nodeId/);
  });
});

describe('aggregateNode: robustness (the whole point of the median)', () => {
  const honest = (tier: Tier) => many(9, 0.3, { tier });
  const spammers = (tier: Tier) => [
    est(1, { uid: 'spam1', tier }),
    est(1, { uid: 'spam2', tier, weight: 3 }),
    est(0, { uid: 'spam3', tier }),
  ];

  it('the public median barely moves when 0/100 spammers pile in', () => {
    const clean = aggregateNode(honest('public'), 'public', SEED, HORIZONS, NOW);
    const spammed = aggregateNode([...honest('public'), ...spammers('public')], 'public', SEED, HORIZONS, NOW);
    expect(Math.abs(spammed.curve['2035'] - clean.curve['2035'])).toBeLessThan(0.05);
  });

  it('and the same spammers pull the expert mean further than the public median', () => {
    const pull = (tier: Tier) => {
      const clean = aggregateNode(honest(tier), tier, SEED, HORIZONS, NOW);
      const spammed = aggregateNode([...honest(tier), ...spammers(tier)], tier, SEED, HORIZONS, NOW);
      return Math.abs(spammed.curve['2035'] - clean.curve['2035']);
    };
    expect(pull('expert')).toBeGreaterThan(pull('public'));
  });

  it('never produces NaN or Infinity from an estimate of exactly 0 or 1', () => {
    const a = aggregateNode([est(0, { uid: 'z' }), est(1, { uid: 'o' }), est(0.5, { uid: 'm' })], 'public', SEED, HORIZONS, NOW);
    for (const h of HORIZONS) {
      expect(Number.isFinite(a.curve[String(h)])).toBe(true);
      expect(a.curve[String(h)]).toBeGreaterThan(0);
      expect(a.curve[String(h)]).toBeLessThan(1);
    }
  });

  it('trims the expert mean once n >= 10 but not before', () => {
    const flat = (n: number, uidPrefix: string) =>
      Array.from({ length: n }, (_, i) => est(0.5, { uid: `${uidPrefix}${i}`, tier: 'expert' }));
    const spammer = est(1, { uid: 'x-spam', tier: 'expert' });
    const thin = aggregateNode([...flat(8, 'a'), spammer], 'expert', SEED, HORIZONS, NOW); // n = 9
    const thinControl = aggregateNode(flat(9, 'a2'), 'expert', SEED, HORIZONS, NOW);
    const thick = aggregateNode([...flat(10, 'b'), spammer], 'expert', SEED, HORIZONS, NOW); // n = 11
    const thickControl = aggregateNode(flat(11, 'b2'), 'expert', SEED, HORIZONS, NOW);
    // n = 9: no trimming, so the one spammer drags the mean up
    expect(thin.curve['2035']).toBeGreaterThan(thinControl.curve['2035'] + 0.01);
    // n = 11: the top 10% of weight is dropped, and the spammer is all of it
    expect(thick.curve['2035']).toBeCloseTo(thickControl.curve['2035'], 9);
  });
});

describe('aggregateNode: recency, shrinkage and bands', () => {
  it('weights a fresh estimate above a stale one', () => {
    const stale = est(0.9, { uid: 'old', asOf: '2022-09-10' });
    const fresh = est(0.1, { uid: 'new', asOf: '2026-09-10' });
    const a = aggregateNode([stale, fresh], 'public', SEED, HORIZONS, NOW);
    const even = aggregateNode(
      [est(0.9, { uid: 'old2', asOf: '2026-09-10' }), est(0.1, { uid: 'new2', asOf: '2026-09-10' })],
      'public',
      SEED,
      HORIZONS,
      NOW,
    );
    expect(a.curve['2035']).toBeLessThan(even.curve['2035']);
  });

  it('shrinks a thin pool toward the seed and lets a thick one speak', () => {
    const one = aggregateNode([est(0.9, { uid: 'lonely' })], 'public', SEED, HORIZONS, NOW);
    const crowd = aggregateNode(many(60, 0.9), 'public', SEED, HORIZONS, NOW);
    expect(Math.abs(one.curve['2035'] - SEED['2035'])).toBeLessThan(Math.abs(one.curve['2035'] - 0.9));
    expect(crowd.curve['2035']).toBeGreaterThan(0.8);
    expect(crowd.curve['2035']).toBeLessThan(0.9);
  });

  it('a pool of exactly k voters sits halfway between seed and pool in log-odds', () => {
    const a = aggregateNode(many(DEFAULT_SHRINK_K, 0.8, { asOf: '2026-09-10' }), 'public', SEED, HORIZONS, NOW);
    const l = (p: number) => Math.log(p / (1 - p));
    expect(l(a.curve['2035'])).toBeCloseTo((l(0.8) + l(SEED['2035'])) / 2, 6);
  });

  it('reports n and Kish nEff', () => {
    const a = aggregateNode(many(6, 0.4, { asOf: '2026-09-10' }), 'public', SEED, HORIZONS, NOW);
    expect(a.n).toBe(6);
    expect(a.nEff).toBeCloseTo(6, 6);
    const skewed = aggregateNode(
      [est(0.4, { uid: 'p', weight: 3 }), est(0.4, { uid: 'q' }), est(0.4, { uid: 'r' })],
      'public',
      SEED,
      HORIZONS,
      NOW,
    );
    expect(skewed.n).toBe(3);
    expect(skewed.nEff).toBeLessThan(3);
  });

  it('draws a band that brackets the spread and stays ordered', () => {
    const a = aggregateNode(
      [est(0.2, { uid: 'a' }), est(0.4, { uid: 'b' }), est(0.6, { uid: 'c' }), est(0.8, { uid: 'd' })],
      'public',
      SEED,
      HORIZONS,
      NOW,
    );
    for (const h of HORIZONS) {
      const k = String(h);
      expect(a.band25[k]).toBeLessThanOrEqual(a.band75[k]);
      expect(a.band25[k]).toBeGreaterThan(0.2 - 1e-9);
      expect(a.band75[k]).toBeLessThan(0.8 + 1e-9);
    }
  });

  it('reads a sparse estimate curve by holding it flat past its last horizon', () => {
    const sparse = est(0, { uid: 'sparse', curve: { '2035': 0.9 } });
    const a = aggregateNode([sparse, ...many(30, 0.9)], 'public', SEED, HORIZONS, NOW);
    expect(a.curve['2045']).toBeGreaterThan(0.8);
  });
});

describe('renormaliseStateAggregates', () => {
  it('makes state marginals sum to 1 at every horizon without touching the bands', () => {
    const mk = (id: string, p: number) =>
      aggregateNode([], 'locked', { '2030': p, '2035': p, '2045': p }, HORIZONS, NOW, { nodeId: id });
    const raw = [mk('flourishing', 0.3), mk('muddling', 0.9), mk('stratified', 0.2), mk('collapse', 0.1)];
    const out = renormaliseStateAggregates(raw, HORIZONS);
    for (const h of HORIZONS) {
      expect(out.reduce((s, a) => s + a.curve[String(h)], 0)).toBeCloseTo(1, 12);
    }
    expect(out[0].band25).toEqual(raw[0].band25);
    expect(raw[0].curve['2035']).toBe(0.3); // input untouched
  });
});

describe('aggregateNode: tier plumbing', () => {
  it('publishes the tier it was asked for', () => {
    for (const tier of ['locked', 'expert', 'public'] as Tier[]) {
      expect(aggregateNode(many(3, 0.4, { tier }), tier, SEED, HORIZONS, NOW, { nodeId: 'n' }).tier).toBe(tier);
    }
  });
});

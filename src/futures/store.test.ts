/**
 * Store seam tests: the flag, the local (v0) store, and the pooling helper the Firestore
 * provisional path and the nightly cron both share.
 *
 * No firebase here on purpose: `createStore` must be able to answer "which store?" without
 * loading the SDK, and the local store must work with nothing but an in-memory map.
 */

import { describe, expect, it } from 'vitest';
import { aggregateNode } from './aggregate';
import { LocalFuturesStore } from './localStore';
import {
  aggregateAll,
  createStore,
  envSource,
  estimateDocId,
  isCloudConfigured,
  readFirebaseEnv,
  seedOf,
  validateCurve,
  type EnvSource,
  type KeyValueStorage,
} from './store';
import { fixtureGraph } from './testFixture';
import type { Estimate } from './types';

const FULL_ENV: EnvSource = {
  VITE_FIREBASE_API_KEY: 'AIza-test',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'demo',
  VITE_FIREBASE_APP_ID: '1:2:web:3',
};

function memStorage(): KeyValueStorage & { dump: () => Record<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    dump: () => Object.fromEntries(map),
  };
}

const makeStore = (now = new Date('2026-09-10T12:00:00Z')) =>
  new LocalFuturesStore({ graph: fixtureGraph, storage: memStorage(), now: () => now });

const NODE = 'frontier-agi';

describe('isCloudConfigured', () => {
  it('is false with no env at all', () => {
    expect(isCloudConfigured({})).toBe(false);
    expect(readFirebaseEnv({})).toBeNull();
  });

  it('is false when any one of the four keys is missing or blank', () => {
    for (const k of Object.keys(FULL_ENV)) {
      expect(isCloudConfigured({ ...FULL_ENV, [k]: undefined })).toBe(false);
      expect(isCloudConfigured({ ...FULL_ENV, [k]: '   ' })).toBe(false);
    }
  });

  it('is true only with all four, and trims them', () => {
    expect(isCloudConfigured(FULL_ENV)).toBe(true);
    expect(readFirebaseEnv({ ...FULL_ENV, VITE_FIREBASE_PROJECT_ID: ' demo ' })?.projectId).toBe('demo');
  });

  it('ignores a populated .env.local under vitest, so tests never reach a real project', () => {
    // envSource() strips the four keys whenever it detects a test run.
    expect(readFirebaseEnv(envSource())).toBeNull();
    expect(isCloudConfigured()).toBe(false);
  });
});

describe('createStore', () => {
  it('returns the local store when the env is unset — the v0 default', () => {
    const store = createStore({ env: {}, graph: fixtureGraph, storage: memStorage() });
    expect(store.kind).toBe('local');
    expect(store).toBeInstanceOf(LocalFuturesStore);
  });

  it('returns the lazy Firestore store when configured, without importing firebase', () => {
    const store = createStore({ env: FULL_ENV, graph: fixtureGraph, storage: memStorage() });
    expect(store.kind).toBe('firestore');
    // `getGraph` is answered from the bundle, so it resolves with no SDK and no network.
    return expect(store.getGraph()).resolves.toBe(fixtureGraph);
  });

  it('defaults to the real env source, which is blind under vitest', () => {
    expect(createStore({ graph: fixtureGraph, storage: memStorage() }).kind).toBe('local');
  });
});

describe('LocalFuturesStore round-trip', () => {
  it('stores an estimate and reads it back for the same pseudo uid', async () => {
    const store = makeStore();
    const saved = await store.submitEstimate(NODE, { '2035': 0.6 }, 'because scaling');

    expect(saved.tier).toBe('public');
    expect(saved.uid).toMatch(/^local_/);
    expect(saved.graphVersion).toBe(fixtureGraph.graphVersion);
    expect(saved.note).toBe('because scaling');

    const mine = await store.getMyEstimates();
    expect(mine).toHaveLength(1);
    expect(mine[0].curve).toEqual({ '2035': 0.6 });
    expect((await store.whoAmI()).uid).toBe(saved.uid);
  });

  it('keeps exactly one estimate per node, the newest', async () => {
    const store = makeStore();
    await store.submitEstimate(NODE, { '2035': 0.6 });
    await store.submitEstimate(NODE, { '2035': 0.2 });
    await store.submitEstimate('redistribution', { '2035': 0.9 });

    const mine = await store.getMyEstimates();
    expect(mine).toHaveLength(2);
    expect(mine.find((e) => e.nodeId === NODE)?.curve).toEqual({ '2035': 0.2 });
    expect(estimateDocId(mine[0].uid, mine[0].nodeId)).toBe(`${mine[0].uid}_${mine[0].nodeId}`);
  });

  it('survives a new store object over the same storage (a page reload)', async () => {
    const storage = memStorage();
    const opts = { graph: fixtureGraph, storage, now: () => new Date('2026-09-10T12:00:00Z') };
    const first = new LocalFuturesStore(opts);
    const saved = await first.submitEstimate(NODE, { '2030': 0.3 });

    const second = new LocalFuturesStore(opts);
    expect((await second.whoAmI()).uid).toBe(saved.uid);
    expect(await second.getMyEstimates()).toHaveLength(1);
  });

  it('rejects curves the security rules would also reject', async () => {
    const store = makeStore();
    await expect(store.submitEstimate(NODE, { '2031': 0.5 })).rejects.toThrow(/horizons/);
    await expect(store.submitEstimate(NODE, { '2035': 1.4 })).rejects.toThrow(/between 0 and 1/);
    await expect(store.submitEstimate(NODE, {})).rejects.toThrow(/at least one horizon/);
    await expect(store.submitEstimate('no-such-node', { '2035': 0.5 })).rejects.toThrow(/unknown node/);
    expect(await store.getMyEstimates()).toHaveLength(0);
  });

  it('has no cloud identity and cannot sign in', async () => {
    const store = makeStore();
    expect(await store.whoAmI()).toMatchObject({ tier: 'public', email: null, source: 'local' });
    await expect(store.signInWithEmailLink('a@b.com')).rejects.toThrow(/not configured/);
    expect(await store.completeSignIn()).toBeNull();
    await expect(store.signOut()).resolves.toBeUndefined();
  });

  it('round-trips an intervention and forces it to the local tier', async () => {
    const store = makeStore();
    const iv = {
      schemaVersion: 1 as const,
      id: 'my-levy',
      label: 'My levy',
      summary: 'test',
      source: { kind: 'proposal' as const },
      tier: 'expert' as const, // a client claim; the store overrides it
      status: 'ai-drafted' as const,
      cost: { band: 2 as const },
      startYear: 2030,
      nudges: [],
    };
    await store.saveIntervention(iv);
    expect(await store.listInterventions('public')).toEqual([{ ...iv, tier: 'public' }]);
    expect(await store.listInterventions('expert')).toEqual([]);
    // the bundled, git-reviewed cards are still what 'locked' means
    expect((await store.listInterventions('locked')).length).toBeGreaterThan(0);
  });
});

describe('aggregates over local estimates', () => {
  it('pools the visitor’s own estimate, shrunk hard toward the seed at n_eff = 1', async () => {
    const store = makeStore();
    await store.submitEstimate(NODE, { '2035': 0.9 });

    const [agg] = await store.getAggregates('public');
    const seed = seedOf(fixtureGraph, NODE)!;
    expect(agg.nodeId).toBe(NODE);
    expect(agg.tier).toBe('public');
    expect(agg.n).toBe(1);
    expect(agg.nEff).toBeCloseTo(1, 6);

    // Centre sits between the seed and the single vote; the band IS the vote (design 4.5).
    const s = seed.curve['2035'];
    expect(agg.curve['2035']).toBeGreaterThan(s);
    expect(agg.curve['2035']).toBeLessThan(0.9);
    expect(agg.band25['2035']).toBeCloseTo(0.9, 6);
    expect(agg.band75['2035']).toBeCloseTo(0.9, 6);
    // a one-horizon vote is held flat across the others (engine.interpolateCurve), so 2045
    // moves too — toward the vote, not to it
    expect(agg.curve['2045']).toBeGreaterThan(seed.curve['2045']);
    expect(agg.curve['2045']).toBeLessThan(0.9);
  });

  it('serves nothing for the tiers the local store cannot know about', async () => {
    const store = makeStore();
    await store.submitEstimate(NODE, { '2035': 0.9 });
    expect(await store.getAggregates('expert')).toEqual([]);
    expect(await store.getAggregates('locked')).toEqual([]);
  });

  it('agrees with aggregateNode — the provisional path, the local path and the cron are one function', () => {
    const now = new Date('2026-09-10T12:00:00Z');
    const estimates: Estimate[] = [
      { uid: 'a', tier: 'public', nodeId: NODE, graphVersion: 'test-0001', curve: { '2035': 0.8 }, asOf: now.toISOString() },
      { uid: 'b', tier: 'public', nodeId: NODE, graphVersion: 'test-0001', curve: { '2035': 0.4 }, asOf: now.toISOString() },
      { uid: 'c', tier: 'expert', nodeId: NODE, graphVersion: 'test-0001', curve: { '2035': 0.1 }, asOf: now.toISOString() },
      { uid: 'd', tier: 'public', nodeId: 'ghost-node', graphVersion: 'test-0001', curve: { '2035': 0.5 }, asOf: now.toISOString() },
    ];
    const seed = seedOf(fixtureGraph, NODE)!;

    const pooled = aggregateAll(fixtureGraph, estimates, 'public', now);
    // the ghost node is dropped: there is no seed to shrink it toward
    expect(pooled.map((a) => a.nodeId)).toEqual([NODE]);
    expect(pooled[0].n).toBe(2);
    expect(pooled[0].curve).toEqual(
      aggregateNode(estimates.filter((e) => e.nodeId === NODE), 'public', seed.curve, seed.horizons, now, {
        nodeId: NODE,
        graphVersion: fixtureGraph.graphVersion,
      }).curve,
    );

    // the expert pool is a different, smaller pool over the same rows
    const experts = aggregateAll(fixtureGraph, estimates, 'expert', now);
    expect(experts[0].n).toBe(1);
    expect(experts[0].curve['2035']).toBeLessThan(pooled[0].curve['2035']);
  });

  it('builds a dated history from the append-only log', async () => {
    const storage = memStorage();
    const day = (d: string) =>
      new LocalFuturesStore({ graph: fixtureGraph, storage, now: () => new Date(`${d}T09:00:00Z`) });

    await day('2026-09-08').submitEstimate(NODE, { '2035': 0.3 });
    await day('2026-09-10').submitEstimate(NODE, { '2035': 0.8 });

    const history = await day('2026-09-10').getHistory('public', NODE, '2026-01-01', '2026-12-31');
    expect(history.map((p) => p.date)).toEqual(['2026-09-08', '2026-09-10']);
    // only the latest estimate per uid counts, so the curve moves with the newer vote
    expect(history[1].curve['2035']).toBeGreaterThan(history[0].curve['2035']);
    expect(await day('2026-09-10').getHistory('public', NODE, '2026-09-09', '2026-09-09')).toEqual([]);
    expect(await day('2026-09-10').getHistory('expert', NODE, '2026-01-01', '2026-12-31')).toEqual([]);
  });
});

describe('validateCurve', () => {
  const stateNode = fixtureGraph.nodes.find((n) => n.kind === 'state')!.id;

  it('accepts a curve on the node’s own horizons', () => {
    expect(validateCurve(fixtureGraph, NODE, { '2030': 0, '2045': 1 })).toBeNull();
    expect(validateCurve(fixtureGraph, stateNode, { '2035': 0.25 })).toBeNull();
  });

  it('names what is wrong', () => {
    expect(validateCurve(fixtureGraph, NODE, { '2033': 0.5 })).toMatch(/2033/);
    expect(validateCurve(fixtureGraph, NODE, { '2035': -0.1 })).toMatch(/probability/);
    expect(validateCurve(fixtureGraph, NODE, { '2035': Number.NaN })).toMatch(/probability/);
  });
});

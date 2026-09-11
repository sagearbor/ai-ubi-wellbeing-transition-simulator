/**
 * AI Futures Map — the store seam (design doc section 8).
 *
 *   interface FuturesStore { getGraph(); getAggregates(tier); getHistory(tier,nodeId,from,to);
 *                            getMyEstimates(); submitEstimate(nodeId,curve,note?);
 *                            listInterventions(tier); saveIntervention(iv); whoAmI() }
 *   LocalFuturesStore (localStorage, v0)  ->  FirestoreFuturesStore (v1).
 *
 * The whole v1 voting feature is behind ONE flag: `isCloudConfigured()`, which is true only when
 * all four `VITE_FIREBASE_*` variables are present at build time. Until the owner runs
 * docs/futures-v1-setup.md the app behaves exactly as v0:
 *   - `createStore()` returns the localStorage store, which never touches the network;
 *   - `./firestoreStore` (and with it the whole `firebase` SDK) is never imported, so it is not
 *     in the main bundle — it lives in its own dynamically-imported chunk.
 *
 * Nothing here imports React or `firebase`. Keep it that way: localStore.ts and the tests run
 * under plain node.
 */

import { aggregateNode } from './aggregate';
import { LOCKED_GRAPH } from './data';
// store.ts <-> localStore.ts is a deliberate ES-module cycle: localStore only touches the
// helpers below from inside methods, never at module-evaluation time, so either evaluation
// order works. It keeps `createStore` — the one thing callers need — in this file.
import { LocalFuturesStore } from './localStore';
import type { Aggregate, Curve, Estimate, FuturesGraph, Intervention, Tier } from './types';

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/** Who the current visitor is, as far as the store can tell. */
export interface Identity {
  /** null when signed out entirely (cloud store before anonymous sign-in). */
  uid: string | null;
  /** Only ever set for an email-link ("expert") sign-in. */
  email: string | null;
  /** 'expert' iff `experts/{email}` exists; otherwise 'public'; 'locked' when signed out. */
  tier: Tier;
  /** Owner-set expert weight, 0.5-3. Default 1. */
  weight: number;
  /** Which backend answered. */
  source: 'local' | 'firestore';
}

export const SIGNED_OUT: Identity = { uid: null, email: null, tier: 'locked', weight: 1, source: 'local' };

/** One dated point on a node's "how has the 2035 number moved" chart (design 4.6). */
export interface HistoryPoint {
  /** YYYY-MM-DD. */
  date: string;
  curve: Curve;
  nEff: number;
}

// ---------------------------------------------------------------------------
// The seam
// ---------------------------------------------------------------------------

export interface FuturesStore {
  readonly kind: 'local' | 'firestore';
  /** The locked graph. Bundled from git in both stores — the cloud never serves the graph. */
  getGraph(): Promise<FuturesGraph>;
  /** Published aggregates for a tier, one per node that has any. `locked` always returns []. */
  getAggregates(tier: Tier): Promise<Aggregate[]>;
  /** Dated snapshots for one node, inclusive, dates as YYYY-MM-DD. */
  getHistory(tier: Tier, nodeId: string, from: string, to: string): Promise<HistoryPoint[]>;
  /** This visitor's latest estimate per node. */
  getMyEstimates(): Promise<Estimate[]>;
  /** Upsert this visitor's estimate for one node. Resolves with what was stored. */
  submitEstimate(nodeId: string, curve: Curve, note?: string): Promise<Estimate>;
  listInterventions(tier: Tier): Promise<Intervention[]>;
  saveIntervention(iv: Intervention): Promise<void>;
  whoAmI(): Promise<Identity>;
  /** Send an expert sign-in link. Rejects on the local store. */
  signInWithEmailLink(email: string): Promise<void>;
  /** Finish a sign-in if the current URL is an email link. Resolves null when it is not. */
  completeSignIn(): Promise<Identity | null>;
  signOut(): Promise<void>;
}

export interface StoreOptions {
  /** Defaults to the bundled locked graph. */
  graph?: FuturesGraph;
  /** Injected for tests. Defaults to `globalThis.localStorage` with an in-memory fallback. */
  storage?: KeyValueStorage;
  /** Injected for tests. Defaults to `() => new Date()`. */
  now?: () => Date;
}

/** The 3 methods of `Storage` we use, so tests (and node) can pass a plain object. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** localStorage when it exists and works, an in-memory map otherwise (node, private mode). */
export function defaultStorage(): KeyValueStorage {
  try {
    const ls = (globalThis as { localStorage?: KeyValueStorage }).localStorage;
    if (ls) {
      const probe = '__futures_probe__';
      ls.setItem(probe, '1');
      ls.removeItem(probe);
      return ls;
    }
  } catch {
    /* blocked or unavailable: fall through */
  }
  const mem = new Map<string, string>();
  return {
    getItem: (k) => (mem.has(k) ? (mem.get(k) as string) : null),
    setItem: (k, v) => void mem.set(k, v),
    removeItem: (k) => void mem.delete(k),
  };
}

// ---------------------------------------------------------------------------
// The flag
// ---------------------------------------------------------------------------

/**
 * `import.meta.env` typed locally: this repo's tsconfig has `"types": ["node"]`, not
 * `vite/client`, so the ambient Vite types are not in scope. Optional because plain node
 * (the `tsx` scripts) has no `env` on `import.meta` at all.
 */
declare global {
  interface ImportMeta {
    readonly env?: Record<string, string | boolean | undefined>;
  }
}

export interface FirebaseEnv {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

export const FIREBASE_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

export type EnvSource = Record<string, string | boolean | undefined>;

/**
 * Build-time env, `import.meta.env` first (Vite inlines it) then `process.env` (tsx scripts).
 *
 * Deliberately blind under vitest: tests must be hermetic and must never reach Firestore just
 * because the owner happens to have a populated `.env.local`. Set `VITE_FIREBASE_IN_TESTS=1`
 * to opt a test run back in.
 */
export function envSource(): EnvSource {
  const out: EnvSource = {};
  const proc = (globalThis as { process?: { env?: EnvSource } }).process?.env;
  if (proc) Object.assign(out, proc);
  let meta: EnvSource | undefined;
  try {
    meta = import.meta.env;
  } catch {
    meta = undefined;
  }
  if (meta) Object.assign(out, meta);
  const underTest = out.VITEST || out.VITEST_WORKER_ID || out.MODE === 'test' || out.NODE_ENV === 'test';
  if (underTest && !out.VITE_FIREBASE_IN_TESTS) {
    for (const k of FIREBASE_ENV_KEYS) delete out[k];
  }
  return out;
}

/** The 4 keys, or null when any is missing/blank. */
export function readFirebaseEnv(source: EnvSource = envSource()): FirebaseEnv | null {
  const v = FIREBASE_ENV_KEYS.map((k) => {
    const raw = source[k];
    return typeof raw === 'string' ? raw.trim() : '';
  });
  if (v.some((x) => x === '')) return null;
  return { apiKey: v[0], authDomain: v[1], projectId: v[2], appId: v[3] };
}

/** THE flag. False => v0 behaviour: no firebase chunk, no network, no vote UI. */
export function isCloudConfigured(source: EnvSource = envSource()): boolean {
  return readFirebaseEnv(source) !== null;
}

// ---------------------------------------------------------------------------
// Lazy cloud store
// ---------------------------------------------------------------------------

/**
 * Delegates to `./firestoreStore`, imported on first use. This is what keeps both that module
 * and the `firebase` SDK out of the main chunk: nothing in the static import graph of the app
 * mentions either.
 */
class LazyFirestoreStore implements FuturesStore {
  readonly kind = 'firestore' as const;
  private inner?: Promise<FuturesStore>;

  constructor(
    private readonly env: FirebaseEnv,
    private readonly opts: StoreOptions,
  ) {}

  private get store(): Promise<FuturesStore> {
    if (!this.inner) {
      this.inner = import('./firestoreStore').then((m) => m.createFirestoreStore(this.env, this.opts));
    }
    return this.inner;
  }

  /** Sync-able: the graph is bundled from git, so this never waits on firebase. */
  async getGraph(): Promise<FuturesGraph> {
    return this.opts.graph ?? LOCKED_GRAPH;
  }
  async getAggregates(tier: Tier): Promise<Aggregate[]> {
    return (await this.store).getAggregates(tier);
  }
  async getHistory(tier: Tier, nodeId: string, from: string, to: string): Promise<HistoryPoint[]> {
    return (await this.store).getHistory(tier, nodeId, from, to);
  }
  async getMyEstimates(): Promise<Estimate[]> {
    return (await this.store).getMyEstimates();
  }
  async submitEstimate(nodeId: string, curve: Curve, note?: string): Promise<Estimate> {
    return (await this.store).submitEstimate(nodeId, curve, note);
  }
  async listInterventions(tier: Tier): Promise<Intervention[]> {
    return (await this.store).listInterventions(tier);
  }
  async saveIntervention(iv: Intervention): Promise<void> {
    return (await this.store).saveIntervention(iv);
  }
  async whoAmI(): Promise<Identity> {
    return (await this.store).whoAmI();
  }
  async signInWithEmailLink(email: string): Promise<void> {
    return (await this.store).signInWithEmailLink(email);
  }
  async completeSignIn(): Promise<Identity | null> {
    return (await this.store).completeSignIn();
  }
  async signOut(): Promise<void> {
    return (await this.store).signOut();
  }
}

/** LocalFuturesStore when unconfigured, a lazy FirestoreFuturesStore when configured. */
export function createStore(opts: StoreOptions & { env?: EnvSource } = {}): FuturesStore {
  const fb = readFirebaseEnv(opts.env ?? envSource());
  if (!fb) return new LocalFuturesStore(opts);
  return new LazyFirestoreStore(fb, opts);
}

// ---------------------------------------------------------------------------
// Shared helpers for both stores
// ---------------------------------------------------------------------------

/** Deterministic doc id, so a voter has exactly one live estimate per node (design 8). */
export const estimateDocId = (uid: string, nodeId: string): string => `${uid}_${nodeId}`;

/** YYYY-MM-DD in UTC. */
export const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/** The seed curve a tier is shrunk toward, and the horizons it is published at. */
export function seedOf(graph: FuturesGraph, nodeId: string): { curve: Curve; horizons: number[] } | null {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  return {
    curve: node.seed.curve,
    horizons: node.kind === 'state' ? graph.axis.horizons : graph.horizons,
  };
}

/**
 * Reject anything the security rules would reject anyway, so a bad vote fails in the UI with a
 * readable message instead of a PERMISSION_DENIED from the SDK.
 */
export function validateCurve(graph: FuturesGraph, nodeId: string, curve: Curve): string | null {
  const seed = seedOf(graph, nodeId);
  if (!seed) return `unknown node "${nodeId}"`;
  const keys = Object.keys(curve);
  if (keys.length === 0) return 'give at least one horizon';
  for (const k of keys) {
    if (!seed.horizons.includes(Number(k))) return `"${k}" is not one of this node's horizons (${seed.horizons.join(', ')})`;
    const v = curve[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) return `${k} must be a probability between 0 and 1`;
  }
  return null;
}

/**
 * Pool a flat list of estimates into one Aggregate per node that has any.
 * Used by the local store, by the Firestore provisional path, and by the nightly cron — so all
 * three agree by construction.
 */
export function aggregateAll(
  graph: FuturesGraph,
  estimates: Estimate[],
  tier: Tier,
  now: Date,
  updatedAt?: string,
): Aggregate[] {
  const byNode = new Map<string, Estimate[]>();
  for (const e of estimates) {
    if (e.tier !== tier) continue;
    const list = byNode.get(e.nodeId);
    if (list) list.push(e);
    else byNode.set(e.nodeId, [e]);
  }
  const out: Aggregate[] = [];
  for (const [nodeId, list] of byNode) {
    const seed = seedOf(graph, nodeId);
    if (!seed) continue; // a node retired out of the graph: drop it rather than publish a ghost
    out.push(
      aggregateNode(list, tier, seed.curve, seed.horizons, now, {
        nodeId,
        graphVersion: graph.graphVersion,
        updatedAt,
      }),
    );
  }
  return out;
}

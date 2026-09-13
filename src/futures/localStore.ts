/**
 * LocalFuturesStore — the v0 store (design doc section 8: "LocalFuturesStore (localStorage, v0)").
 *
 * Everything lives in this browser: a pseudo uid, one estimate per node, an append-only log for
 * the history chart, and any interventions the visitor authored. Aggregates are computed with the
 * same `aggregateNode` the cron uses, at tier 'public' — so a single visitor sees exactly the
 * shape the cloud tier will have (their own estimate, shrunk hard toward the seed because
 * n_eff = 1), and the code path is exercised long before Firebase exists.
 *
 * No network, ever. Safe under node: storage falls back to an in-memory map.
 */

import { LOCKED_GRAPH, LOCKED_INTERVENTIONS } from './data';
import {
  aggregateAll,
  defaultStorage,
  estimateDocId,
  isoDay,
  type FuturesStore,
  type HistoryPoint,
  type Identity,
  type KeyValueStorage,
  type StoreOptions,
  validateCurve,
} from './store';
import type { Aggregate, Curve, Estimate, FuturesGraph, Intervention, Tier } from './types';

const UID_KEY = 'futures.uid.v1';
const ESTIMATES_KEY = 'futures.estimates.v1';
const LOG_KEY = 'futures.estimateLog.v1';
/** Same key data.ts uses, so the two views of "my interventions" never disagree. */
const INTERVENTIONS_KEY = 'futures.customInterventions.v1';

/** The local store is always this tier: there is nobody to be an expert to. */
const LOCAL_TIER: Tier = 'public';

/** Keep the log bounded; it is only there to draw a small "how my number moved" chart. */
const LOG_CAP = 500;

export class LocalFuturesStore implements FuturesStore {
  readonly kind = 'local' as const;

  private readonly graph: FuturesGraph;
  private readonly storage: KeyValueStorage;
  private readonly now: () => Date;

  constructor(opts: StoreOptions = {}) {
    this.graph = opts.graph ?? LOCKED_GRAPH;
    this.storage = opts.storage ?? defaultStorage();
    this.now = opts.now ?? (() => new Date());
  }

  // -- storage helpers ------------------------------------------------------

  private read<T>(key: string, fallback: T): T {
    try {
      const raw = this.storage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : (parsed as T);
    } catch {
      return fallback;
    }
  }

  private write(key: string, value: unknown): void {
    try {
      this.storage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota or private mode: this visitor's votes are session-only */
    }
  }

  /** Stable per-browser pseudo id. Not an identity claim — just a pooling key. */
  private uid(): string {
    const existing = this.storage.getItem(UID_KEY);
    if (existing) return existing;
    const rnd = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const uid = `local_${rnd}`;
    try {
      this.storage.setItem(UID_KEY, uid);
    } catch {
      /* ignore */
    }
    return uid;
  }

  private estimates(): Estimate[] {
    return this.read<Estimate[]>(ESTIMATES_KEY, []).filter((e) => e && typeof e.nodeId === 'string');
  }

  private log(): Estimate[] {
    return this.read<Estimate[]>(LOG_KEY, []).filter((e) => e && typeof e.nodeId === 'string');
  }

  // -- FuturesStore ---------------------------------------------------------

  async getGraph(): Promise<FuturesGraph> {
    return this.graph;
  }

  async whoAmI(): Promise<Identity> {
    return { uid: this.uid(), email: null, tier: LOCAL_TIER, weight: 1, source: 'local' };
  }

  async getMyEstimates(): Promise<Estimate[]> {
    const uid = this.uid();
    return this.estimates().filter((e) => e.uid === uid);
  }

  async submitEstimate(nodeId: string, curve: Curve, note?: string): Promise<Estimate> {
    const bad = validateCurve(this.graph, nodeId, curve);
    if (bad) throw new Error(bad);

    const estimate: Estimate = {
      uid: this.uid(),
      tier: LOCAL_TIER,
      nodeId,
      graphVersion: this.graph.graphVersion,
      curve: { ...curve },
      asOf: this.now().toISOString(),
      weight: 1,
    };
    if (note) estimate.note = note;

    const id = estimateDocId(estimate.uid, nodeId);
    const next = this.estimates().filter((e) => estimateDocId(e.uid, e.nodeId) !== id);
    next.push(estimate);
    this.write(ESTIMATES_KEY, next);
    this.write(LOG_KEY, [...this.log(), estimate].slice(-LOG_CAP));
    return estimate;
  }

  async getAggregates(tier: Tier): Promise<Aggregate[]> {
    // Only the local visitor's own tier has anything to pool. 'locked' is the bundled seed and
    // is never served as an aggregate; 'expert' needs the cloud.
    if (tier !== LOCAL_TIER) return [];
    return aggregateAll(this.graph, this.estimates(), tier, this.now());
  }

  async getHistory(tier: Tier, nodeId: string, from: string, to: string): Promise<HistoryPoint[]> {
    if (tier !== LOCAL_TIER) return [];
    const entries = this.log().filter((e) => e.nodeId === nodeId && e.tier === tier);
    const days = [...new Set(entries.map((e) => isoDay(new Date(e.asOf))))]
      .filter((d) => d >= from && d <= to)
      .sort();

    const out: HistoryPoint[] = [];
    for (const day of days) {
      // As-of that day: everything estimated up to and including it (design 4.6).
      const upTo = entries.filter((e) => isoDay(new Date(e.asOf)) <= day);
      const asOfDay = new Date(`${day}T23:59:59.999Z`);
      const [agg] = aggregateAll(this.graph, upTo, tier, asOfDay, asOfDay.toISOString());
      if (agg) out.push({ date: day, curve: agg.curve, nEff: agg.nEff });
    }
    return out;
  }

  async listInterventions(tier: Tier): Promise<Intervention[]> {
    if (tier === 'locked') return LOCKED_INTERVENTIONS;
    return this.read<Intervention[]>(INTERVENTIONS_KEY, []).filter((iv) => iv && iv.tier === tier);
  }

  async saveIntervention(iv: Intervention): Promise<void> {
    if (!iv?.id) throw new Error('intervention needs an id');
    const mine = { ...iv, tier: LOCAL_TIER };
    const list = this.read<Intervention[]>(INTERVENTIONS_KEY, []).filter((x) => x?.id !== iv.id);
    list.push(mine);
    this.write(INTERVENTIONS_KEY, list);
  }

  async signInWithEmailLink(_email: string): Promise<void> {
    throw new Error('Community voting is not configured, so there is nothing to sign in to.');
  }

  async completeSignIn(): Promise<Identity | null> {
    return null;
  }

  async signOut(): Promise<void> {
    /* nothing to sign out of; the pseudo uid is kept so votes survive a reload */
  }
}

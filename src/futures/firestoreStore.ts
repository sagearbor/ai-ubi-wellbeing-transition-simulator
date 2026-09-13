/**
 * FirestoreFuturesStore — the v1 store (design doc section 8).
 *
 *   experts/{email}                    { addedBy, affiliation?, weight: 1, addedAt }
 *   estimates/{uid}_{nodeId}           latest only, deterministic id so one voter = one vote
 *   estimateLog/{autoId}               append-only copy
 *   aggregates/{tier}/nodes/{nodeId}   written nightly by scripts/futures-aggregate.ts
 *   snapshots/{tier}/days/{YYYY-MM-DD} dated copy, for the "how the number moved" chart
 *   interventions/{id}                 the intervention schema, plus uid and tier
 *
 * Auth: anonymous for the public tier, email-link for experts. Tier is 'expert' iff a doc exists
 * at experts/{email} — an owner-edited allowlist, no Cloud Function, no invite codes.
 *
 * THIS MODULE IS LOADED DYNAMICALLY (see store.ts) and every `firebase` import inside it is a
 * dynamic `import()` as well, so neither this file nor the SDK is in the main chunk. Do not add
 * a static `import ... from 'firebase/*'` here: it would put ~400 KB into the initial payload
 * for every visitor, configured or not.
 */

import { LOCKED_GRAPH, LOCKED_INTERVENTIONS } from './data';
import {
  aggregateAll,
  defaultStorage,
  estimateDocId,
  type FirebaseEnv,
  type FuturesStore,
  type HistoryPoint,
  type Identity,
  type KeyValueStorage,
  type StoreOptions,
  validateCurve,
} from './store';
import type { Aggregate, Curve, Estimate, FuturesGraph, Intervention, Tier } from './types';

/** Newest estimates pulled for the provisional aggregate when a nightly doc is missing. */
const PROVISIONAL_LIMIT = 500;
/** Where the email typed into the sign-in box is parked between the two page loads. */
const EMAIL_KEY = 'futures.emailForSignIn';

type FirebaseApp = Awaited<ReturnType<typeof loadApp>>['app'];
type AuthModule = typeof import('firebase/auth');
type FirestoreModule = typeof import('firebase/firestore');
type Auth = ReturnType<AuthModule['getAuth']>;
type Firestore = ReturnType<FirestoreModule['getFirestore']>;
type User = NonNullable<Auth['currentUser']>;

async function loadApp(env: FirebaseEnv) {
  const { getApps, initializeApp } = await import('firebase/app');
  const name = 'futures';
  const existing = getApps().find((a) => a.name === name);
  const app = existing ?? initializeApp({ ...env }, name);
  return { app };
}

interface Sdk {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  A: AuthModule;
  F: FirestoreModule;
}

/** A plain object is enough of a "row"; the SDK's DocumentData is structurally the same. */
type Row = Record<string, unknown>;

const asCurve = (v: unknown): Curve => {
  const out: Curve = {};
  if (v && typeof v === 'object') {
    for (const [k, n] of Object.entries(v as Row)) if (typeof n === 'number' && Number.isFinite(n)) out[k] = n;
  }
  return out;
};

const asString = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const asNumber = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

function rowToEstimate(row: Row): Estimate | null {
  const nodeId = asString(row.nodeId);
  const uid = asString(row.uid);
  if (!nodeId || !uid) return null;
  const tier = asString(row.tier) as Tier;
  if (tier !== 'public' && tier !== 'expert') return null;
  const e: Estimate = {
    uid,
    tier,
    nodeId,
    graphVersion: asString(row.graphVersion),
    curve: asCurve(row.curve),
    asOf: asString(row.asOf, new Date(0).toISOString()),
    weight: asNumber(row.weight, 1),
  };
  const note = asString(row.note);
  if (note) e.note = note;
  return e;
}

function rowToAggregate(nodeId: string, tier: Tier, row: Row): Aggregate {
  return {
    nodeId,
    tier,
    curve: asCurve(row.curve),
    band25: asCurve(row.band25),
    band75: asCurve(row.band75),
    n: asNumber(row.n, 0),
    nEff: asNumber(row.nEff, 0),
    updatedAt: asString(row.updatedAt),
    graphVersion: asString(row.graphVersion),
  };
}

class FirestoreFuturesStore implements FuturesStore {
  readonly kind = 'firestore' as const;

  private readonly graph: FuturesGraph;
  private readonly storage: KeyValueStorage;
  private readonly now: () => Date;
  private sdkP?: Promise<Sdk>;
  private identity: Identity | null = null;

  constructor(
    private readonly env: FirebaseEnv,
    opts: StoreOptions = {},
  ) {
    this.graph = opts.graph ?? LOCKED_GRAPH;
    this.storage = opts.storage ?? defaultStorage();
    this.now = opts.now ?? (() => new Date());
  }

  // -- SDK + auth -----------------------------------------------------------

  private sdk(): Promise<Sdk> {
    if (!this.sdkP) {
      this.sdkP = (async (): Promise<Sdk> => {
        const [{ app }, A, F] = await Promise.all([
          loadApp(this.env),
          import('firebase/auth'),
          import('firebase/firestore'),
        ]);
        return { app, auth: A.getAuth(app), db: F.getFirestore(app), A, F };
      })();
    }
    return this.sdkP;
  }

  /** Resolve once the SDK has restored any persisted session (or decided there is none). */
  private async currentUser(sdk: Sdk): Promise<User | null> {
    if (sdk.auth.currentUser) return sdk.auth.currentUser;
    return new Promise<User | null>((resolve) => {
      const off = sdk.A.onAuthStateChanged(sdk.auth, (u) => {
        off();
        resolve(u);
      });
    });
  }

  /** Anonymous sign-in is the floor: everyone who can see the page can vote in the public tier. */
  private async ensureUser(sdk: Sdk): Promise<User> {
    const existing = await this.currentUser(sdk);
    if (existing) return existing;
    const cred = await sdk.A.signInAnonymously(sdk.auth);
    return cred.user;
  }

  private async resolveIdentity(sdk: Sdk, user: User): Promise<Identity> {
    const email = user.email ?? null;
    let tier: Tier = 'public';
    let weight = 1;
    if (email) {
      try {
        const snap = await sdk.F.getDoc(sdk.F.doc(sdk.db, 'experts', email.toLowerCase()));
        if (snap.exists()) {
          tier = 'expert';
          weight = asNumber((snap.data() as Row).weight, 1);
        }
      } catch {
        /* rules or network: stay public rather than fail the whole page */
      }
    }
    this.identity = { uid: user.uid, email, tier, weight, source: 'firestore' };
    return this.identity;
  }

  async whoAmI(): Promise<Identity> {
    const sdk = await this.sdk();
    const user = await this.ensureUser(sdk);
    if (this.identity && this.identity.uid === user.uid) return this.identity;
    return this.resolveIdentity(sdk, user);
  }

  async signInWithEmailLink(email: string): Promise<void> {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) throw new Error('That does not look like an email address.');
    const sdk = await this.sdk();
    const url = typeof window !== 'undefined' ? window.location.href.split('#')[0] : '';
    await sdk.A.sendSignInLinkToEmail(sdk.auth, trimmed, { url, handleCodeInApp: true });
    try {
      this.storage.setItem(EMAIL_KEY, trimmed);
    } catch {
      /* the link will ask for the address again */
    }
  }

  async completeSignIn(): Promise<Identity | null> {
    if (typeof window === 'undefined') return null;
    const href = window.location.href;
    const sdk = await this.sdk();
    if (!sdk.A.isSignInWithEmailLink(sdk.auth, href)) return null;
    const email = this.storage.getItem(EMAIL_KEY) ?? window.prompt('Confirm the email you used to sign in') ?? '';
    if (!email) throw new Error('Sign-in needs the email address the link was sent to.');
    const cred = await sdk.A.signInWithEmailLink(sdk.auth, email.trim().toLowerCase(), href);
    try {
      this.storage.removeItem(EMAIL_KEY);
    } catch {
      /* ignore */
    }
    // Strip the one-time credential out of the address bar.
    try {
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    } catch {
      /* ignore */
    }
    return this.resolveIdentity(sdk, cred.user);
  }

  async signOut(): Promise<void> {
    const sdk = await this.sdk();
    this.identity = null;
    await sdk.A.signOut(sdk.auth);
  }

  // -- reads ----------------------------------------------------------------

  async getGraph(): Promise<FuturesGraph> {
    return this.graph;
  }

  async getAggregates(tier: Tier): Promise<Aggregate[]> {
    if (tier === 'locked') return [];
    const sdk = await this.sdk();
    await this.ensureUser(sdk);
    const { collection, getDocs, limit, orderBy, query } = sdk.F;

    const published = new Map<string, Aggregate>();
    const snap = await getDocs(collection(sdk.db, 'aggregates', tier, 'nodes'));
    snap.forEach((d) => published.set(d.id, rowToAggregate(d.id, tier, d.data() as Row)));

    // Provisional: before the first cron run (and for any node it has not reached yet) pool the
    // newest estimates in the browser with the same function the cron uses. One single-field
    // ordered query, so no composite index is needed.
    const missing = this.graph.nodes.filter((n) => !n.retired && !published.has(n.id));
    if (missing.length > 0) {
      const recent = await getDocs(
        query(collection(sdk.db, 'estimates'), orderBy('asOf', 'desc'), limit(PROVISIONAL_LIMIT)),
      );
      const estimates: Estimate[] = [];
      recent.forEach((d) => {
        const e = rowToEstimate(d.data() as Row);
        if (e) estimates.push(e);
      });
      const wanted = new Set(missing.map((n) => n.id));
      const provisional = aggregateAll(
        this.graph,
        estimates.filter((e) => wanted.has(e.nodeId)),
        tier,
        this.now(),
      );
      for (const a of provisional) published.set(a.nodeId, a);
    }

    return [...published.values()];
  }

  async getHistory(tier: Tier, nodeId: string, from: string, to: string): Promise<HistoryPoint[]> {
    if (tier === 'locked') return [];
    const sdk = await this.sdk();
    await this.ensureUser(sdk);
    const { collection, documentId, getDocs, query, where } = sdk.F;
    const snap = await getDocs(
      query(
        collection(sdk.db, 'snapshots', tier, 'days'),
        where(documentId(), '>=', from),
        where(documentId(), '<=', to),
      ),
    );
    const out: HistoryPoint[] = [];
    snap.forEach((d) => {
      const nodes = (d.data() as Row).nodes;
      const entry = nodes && typeof nodes === 'object' ? (nodes as Row)[nodeId] : undefined;
      if (!entry || typeof entry !== 'object') return;
      out.push({ date: d.id, curve: asCurve((entry as Row).curve), nEff: asNumber((entry as Row).nEff, 0) });
    });
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }

  async getMyEstimates(): Promise<Estimate[]> {
    const sdk = await this.sdk();
    const user = await this.ensureUser(sdk);
    const { collection, getDocs, query, where } = sdk.F;
    const snap = await getDocs(query(collection(sdk.db, 'estimates'), where('uid', '==', user.uid)));
    const out: Estimate[] = [];
    snap.forEach((d) => {
      const e = rowToEstimate(d.data() as Row);
      if (e) out.push(e);
    });
    return out;
  }

  // -- writes ---------------------------------------------------------------

  async submitEstimate(nodeId: string, curve: Curve, note?: string): Promise<Estimate> {
    const bad = validateCurve(this.graph, nodeId, curve);
    if (bad) throw new Error(bad);

    const sdk = await this.sdk();
    const user = await this.ensureUser(sdk);
    const me = await this.whoAmI();
    const { addDoc, collection, doc, serverTimestamp, setDoc } = sdk.F;

    const estimate: Estimate = {
      uid: user.uid,
      tier: me.tier === 'expert' ? 'expert' : 'public',
      nodeId,
      graphVersion: this.graph.graphVersion,
      curve: { ...curve },
      asOf: this.now().toISOString(),
      weight: me.weight,
    };
    if (note) estimate.note = note;

    // `updatedAt` is the server clock the 60 s write throttle in firestore.rules compares
    // against; `asOf` is the client's and is only ever used for recency weighting.
    const payload = { ...estimate, email: me.email ?? null, updatedAt: serverTimestamp() };
    await setDoc(doc(sdk.db, 'estimates', estimateDocId(user.uid, nodeId)), payload);
    try {
      await addDoc(collection(sdk.db, 'estimateLog'), payload);
    } catch {
      /* the log is a nice-to-have; never fail a vote because the append copy failed */
    }
    return estimate;
  }

  async listInterventions(tier: Tier): Promise<Intervention[]> {
    if (tier === 'locked') return LOCKED_INTERVENTIONS;
    const sdk = await this.sdk();
    await this.ensureUser(sdk);
    const { collection, getDocs, query, where } = sdk.F;
    const snap = await getDocs(query(collection(sdk.db, 'interventions'), where('tier', '==', tier)));
    const out: Intervention[] = [];
    snap.forEach((d) => out.push({ ...(d.data() as unknown as Intervention), id: d.id }));
    return out;
  }

  async saveIntervention(iv: Intervention): Promise<void> {
    if (!iv?.id) throw new Error('intervention needs an id');
    const sdk = await this.sdk();
    const user = await this.ensureUser(sdk);
    const me = await this.whoAmI();
    const { doc, serverTimestamp, setDoc } = sdk.F;
    await setDoc(doc(sdk.db, 'interventions', iv.id), {
      ...iv,
      tier: me.tier === 'expert' ? 'expert' : 'public',
      uid: user.uid,
      updatedAt: serverTimestamp(),
    });
  }
}

/** Called only by store.ts's lazy wrapper. */
export function createFirestoreStore(env: FirebaseEnv, opts: StoreOptions = {}): FuturesStore {
  return new FirestoreFuturesStore(env, opts);
}

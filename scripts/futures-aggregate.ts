#!/usr/bin/env tsx
/**
 * AI Futures Map — nightly tier aggregation (design doc section 8).
 *
 * Reads every `estimates/*` document, pools it with the SAME pure `aggregateNode` the browser
 * uses for its provisional number, and writes:
 *
 *   aggregates/{tier}/nodes/{nodeId}    { curve, band25, band75, n, nEff, updatedAt, graphVersion }
 *   snapshots/{tier}/days/{YYYY-MM-DD}  { graphVersion, updatedAt, nodes: { id: { curve, nEff } } }
 *
 * Dependency-free on purpose: no firebase-admin, no googleapis. Plain Firestore REST plus a
 * bearer token, so the GitHub Actions job needs nothing but node and one secret.
 *
 * Credentials, first match wins:
 *   1. GOOGLE_ACCESS_TOKEN                  a raw OAuth token (cheapest in CI)
 *   2. FIREBASE_SERVICE_ACCOUNT             the service-account JSON itself, as a string
 *   3. GOOGLE_APPLICATION_CREDENTIALS       path to a service-account JSON, or to the
 *                                           authorized-user file `gcloud auth application-default
 *                                           login` writes
 *   4. `gcloud auth print-access-token`     local fallback; run `gcloud auth login` first
 *
 * Usage:
 *   npx tsx scripts/futures-aggregate.ts --dry-run          # print what would be written
 *   npx tsx scripts/futures-aggregate.ts                    # write aggregates + today's snapshot
 *   npx tsx scripts/futures-aggregate.ts --project=my-proj --tiers=expert --date=2026-09-10
 *
 * The project id defaults to FIREBASE_PROJECT_ID / VITE_FIREBASE_PROJECT_ID.
 * This runs with admin credentials and therefore BYPASSES firestore.rules.
 */

import { createSign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import graphJson from '../data/futures/graph.json';
import { aggregateAll } from '../src/futures/store';
import type { Aggregate, Curve, Estimate, FuturesGraph, Tier } from '../src/futures/types';

const GRAPH = graphJson as unknown as FuturesGraph;
const SCOPE = 'https://www.googleapis.com/auth/datastore';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const PAGE_SIZE = 300;

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : '';
};

const DRY_RUN = flag('dry-run') !== undefined;
const PROJECT =
  flag('project') || process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';
const TIERS = (flag('tiers') || 'expert,public').split(',').map((t) => t.trim()).filter(Boolean) as Tier[];
const DATE = flag('date') || new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const b64url = (buf: Buffer | string): string =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function postForm(url: string, body: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(`${url}: ${res.status} ${JSON.stringify(json)}`);
  return json;
}

/** Self-signed JWT -> access token. ~20 lines, and it keeps firebase-admin out of CI. */
async function tokenFromServiceAccount(sa: { client_email: string; private_key: string }): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(
    JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const jwt = `${header}.${claim}.${b64url(signer.sign(sa.private_key.replace(/\\n/g, '\n')))}`;
  const out = await postForm(TOKEN_URL, {
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  });
  return String(out.access_token);
}

async function tokenFromAuthorizedUser(u: {
  client_id: string;
  client_secret: string;
  refresh_token: string;
}): Promise<string> {
  const out = await postForm(TOKEN_URL, {
    grant_type: 'refresh_token',
    client_id: u.client_id,
    client_secret: u.client_secret,
    refresh_token: u.refresh_token,
  });
  return String(out.access_token);
}

async function credentialsFromJson(raw: string): Promise<string> {
  const parsed = JSON.parse(raw) as Record<string, string>;
  if (parsed.type === 'authorized_user' || parsed.refresh_token) {
    return tokenFromAuthorizedUser(parsed as never);
  }
  if (!parsed.client_email || !parsed.private_key) throw new Error('credentials JSON is neither a service account nor an authorized user');
  return tokenFromServiceAccount(parsed as never);
}

async function accessToken(): Promise<string> {
  if (process.env.GOOGLE_ACCESS_TOKEN) return process.env.GOOGLE_ACCESS_TOKEN.trim();
  if (process.env.FIREBASE_SERVICE_ACCOUNT) return credentialsFromJson(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return credentialsFromJson(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
  }
  try {
    return execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
  } catch {
    throw new Error(
      'No credentials. Set GOOGLE_ACCESS_TOKEN or FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS, ' +
        'or run `gcloud auth application-default login`. See docs/futures-v1-setup.md.',
    );
  }
}

// ---------------------------------------------------------------------------
// Firestore REST
// ---------------------------------------------------------------------------

type RestValue = Record<string, unknown>;
type RestDoc = { name?: string; fields?: Record<string, RestValue> };

function decode(v: RestValue): unknown {
  if (v == null) return null;
  if ('nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('timestampValue' in v) return String(v.timestampValue);
  if ('mapValue' in v) {
    const fields = (v.mapValue as { fields?: Record<string, RestValue> }).fields ?? {};
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) out[k] = decode(val);
    return out;
  }
  if ('arrayValue' in v) {
    const values = (v.arrayValue as { values?: RestValue[] }).values ?? [];
    return values.map(decode);
  }
  return null;
}

function encode(v: unknown): RestValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  const fields: Record<string, RestValue> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) fields[k] = encode(val);
  return { mapValue: { fields } };
}

const docFields = (d: RestDoc): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d.fields ?? {})) out[k] = decode(v);
  return out;
};

class Firestore {
  constructor(
    private readonly project: string,
    private readonly token: string,
  ) {}

  private base(): string {
    return `https://firestore.googleapis.com/v1/projects/${this.project}/databases/(default)/documents`;
  }

  async list(collection: string): Promise<Array<Record<string, unknown>>> {
    const out: Array<Record<string, unknown>> = [];
    let pageToken: string | undefined;
    do {
      const url = new URL(`${this.base()}/${collection}`);
      url.searchParams.set('pageSize', String(PAGE_SIZE));
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const res = await fetch(url, { headers: { authorization: `Bearer ${this.token}` } });
      const json = (await res.json()) as { documents?: RestDoc[]; nextPageToken?: string; error?: unknown };
      if (!res.ok) throw new Error(`list ${collection}: ${res.status} ${JSON.stringify(json.error)}`);
      for (const d of json.documents ?? []) out.push(docFields(d));
      pageToken = json.nextPageToken;
    } while (pageToken);
    return out;
  }

  /** Full overwrite of one document (REST PATCH without an updateMask creates or replaces). */
  async set(path: string, data: Record<string, unknown>): Promise<void> {
    const fields: Record<string, RestValue> = {};
    for (const [k, v] of Object.entries(data)) fields[k] = encode(v);
    const res = await fetch(`${this.base()}/${path}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) throw new Error(`set ${path}: ${res.status} ${await res.text()}`);
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

function toEstimate(row: Record<string, unknown>): Estimate | null {
  const nodeId = typeof row.nodeId === 'string' ? row.nodeId : '';
  const uid = typeof row.uid === 'string' ? row.uid : '';
  const tier = row.tier as Tier;
  if (!nodeId || !uid || (tier !== 'public' && tier !== 'expert')) return null;
  const curve: Curve = {};
  if (row.curve && typeof row.curve === 'object') {
    for (const [k, v] of Object.entries(row.curve as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) curve[k] = v;
    }
  }
  return {
    uid,
    tier,
    nodeId,
    graphVersion: typeof row.graphVersion === 'string' ? row.graphVersion : '',
    curve,
    asOf: typeof row.asOf === 'string' ? row.asOf : new Date(0).toISOString(),
    weight: typeof row.weight === 'number' ? row.weight : 1,
  };
}

const aggregateDoc = (a: Aggregate): Record<string, unknown> => ({
  nodeId: a.nodeId,
  tier: a.tier,
  curve: a.curve,
  band25: a.band25,
  band75: a.band75,
  n: a.n,
  nEff: a.nEff,
  updatedAt: a.updatedAt,
  graphVersion: a.graphVersion,
});

async function main(): Promise<void> {
  if (!PROJECT) throw new Error('No project id. Pass --project=... or set FIREBASE_PROJECT_ID.');
  const now = new Date();
  const token = await accessToken();
  const fs = new Firestore(PROJECT, token);

  const rows = await fs.list('estimates');
  const estimates = rows.map(toEstimate).filter((e): e is Estimate => e !== null);
  console.log(`${PROJECT}: ${rows.length} estimate docs, ${estimates.length} usable, date ${DATE}`);

  for (const tier of TIERS) {
    if (tier !== 'expert' && tier !== 'public') {
      console.log(`  skipping unknown tier "${tier}"`);
      continue;
    }
    const aggregates = aggregateAll(GRAPH, estimates, tier, now, now.toISOString());
    const snapshot: Record<string, { curve: Curve; nEff: number }> = {};
    for (const a of aggregates) snapshot[a.nodeId] = { curve: a.curve, nEff: a.nEff };

    console.log(`  ${tier}: ${aggregates.length} node aggregates`);
    for (const a of aggregates) {
      console.log(`    ${a.nodeId}  n=${a.n} nEff=${a.nEff.toFixed(2)}  ${JSON.stringify(a.curve)}`);
      if (!DRY_RUN) await fs.set(`aggregates/${tier}/nodes/${a.nodeId}`, aggregateDoc(a));
    }
    if (!DRY_RUN && aggregates.length > 0) {
      await fs.set(`snapshots/${tier}/days/${DATE}`, {
        graphVersion: GRAPH.graphVersion,
        updatedAt: now.toISOString(),
        nodes: snapshot,
      });
    }
  }

  console.log(DRY_RUN ? 'dry run: nothing written' : 'done');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

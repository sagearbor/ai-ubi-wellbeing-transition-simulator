/**
 * VotePanel — the expert/public voting box inside a node's "details" expander, plus the React
 * context that carries the selected tier's overlay down to every NodeLane.
 *
 * Design doc section 8 (tiers, auth, write path) and 4.5 (what the pooled number means).
 *
 * The whole thing is behind one flag. When `isCloudConfigured()` is false — which is the case
 * until the owner works through docs/futures-v1-setup.md — this renders a single grey line and
 * nothing else: no store call, no network, no firebase chunk.
 */

import React, { createContext, useContext, useMemo, useState } from 'react';
import { THIN_NEFF } from '../../src/futures/aggregate';
import type { FuturesStore, Identity } from '../../src/futures/store';
import type { Aggregate, Curve, Estimate, FuturesGraph, FuturesNode, Tier } from '../../src/futures/types';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface TierOverlayValue {
  /** True only when all four VITE_FIREBASE_* vars were present at build time. */
  cloud: boolean;
  /** The tier the user picked in the header. 'locked' means "seed only", the v0 behaviour. */
  tier: Tier;
  graph: FuturesGraph | null;
  store: FuturesStore | null;
  identity: Identity | null;
  /** nodeId -> published (or provisional) aggregate for `tier`. Empty for 'locked'. */
  aggregates: Map<string, Aggregate>;
  /** nodeId -> this visitor's own latest estimate. */
  mine: Map<string, Estimate>;
  loading: boolean;
  error: string | null;
  submit: (nodeId: string, curve: Curve, note?: string) => Promise<void>;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const INERT_TIER_OVERLAY: TierOverlayValue = {
  cloud: false,
  tier: 'locked',
  graph: null,
  store: null,
  identity: null,
  aggregates: new Map(),
  mine: new Map(),
  loading: false,
  error: null,
  submit: async () => undefined,
  signIn: async () => undefined,
  signOut: async () => undefined,
};

/** Provided by FuturesTab; consumed by NodeLane. Inert (and free) when unconfigured. */
export const TierOverlayContext = createContext<TierOverlayValue>(INERT_TIER_OVERLAY);

export const useTierOverlay = (): TierOverlayValue => useContext(TierOverlayContext);

/** Horizons a node is voted at: states live on the axis, events on the graph's own horizons. */
export function horizonsOf(graph: FuturesGraph | null, node: FuturesNode): number[] {
  if (!graph) return [];
  return node.kind === 'state' ? graph.axis.horizons : graph.horizons;
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export interface VotePanelProps {
  node: FuturesNode;
}

const pctOf = (v: number | undefined): string =>
  typeof v === 'number' && Number.isFinite(v) ? String(Math.round(v * 100)) : '';

const VotePanel: React.FC<VotePanelProps> = ({ node }) => {
  const ctx = useTierOverlay();
  const horizons = useMemo(() => horizonsOf(ctx.graph, node), [ctx.graph, node]);
  const mine = ctx.mine.get(node.id);

  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [note, setNote] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Not configured: one honest line, and not a single call into the store.
  if (!ctx.cloud) {
    return (
      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Community voting: not configured.
      </p>
    );
  }

  const values: Record<string, string> =
    draft ??
    Object.fromEntries(
      horizons.map((h) => [
        String(h),
        pctOf(mine?.curve[String(h)] ?? node.seed.curve[String(h)]),
      ]),
    );

  const identity = ctx.identity;
  const isExpert = identity?.tier === 'expert';
  const status = !identity
    ? 'Signed out'
    : isExpert
      ? `Expert · ${identity.email ?? ''}`
      : 'Public · anonymous';

  const setValue = (key: string, v: string) => setDraft({ ...values, [key]: v });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const curve: Curve = {};
    for (const h of horizons) {
      const raw = values[String(h)];
      if (raw === '' || raw === undefined) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        setErr(`${h} must be a number between 0 and 100.`);
        return;
      }
      curve[String(h)] = n / 100;
    }
    if (Object.keys(curve).length === 0) {
      setErr('Give at least one horizon.');
      return;
    }
    setBusy(true);
    try {
      await ctx.submit(node.id, curve, note.trim() || undefined);
      setDraft(null);
      setNote('');
      setMsg('Saved. The pooled number updates on the next nightly run.');
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  };

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      await ctx.signIn(email.trim());
      setMsg(`Sign-in link sent to ${email.trim()}. Open it in this browser.`);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  };

  const agg = ctx.aggregates.get(node.id);
  const thin = !agg || agg.nEff < THIN_NEFF;

  const inputCls =
    'w-16 min-h-11 px-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-[12px] tabular-nums text-right';

  return (
    <div className="mt-1 rounded-lg border border-slate-200 dark:border-slate-700 p-2 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          Your estimate
          <span className="ml-1.5 font-normal text-slate-400 dark:text-slate-500">{status}</span>
        </span>
        {identity?.email && (
          <button
            type="button"
            onClick={() => void ctx.signOut()}
            className="text-[11px] underline text-slate-500 dark:text-slate-400 min-h-11"
          >
            sign out
          </button>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-1.5">
        <div className="flex flex-wrap gap-2">
          {horizons.map((h) => (
            <label key={h} className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              by {h}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                className={inputCls}
                value={values[String(h)] ?? ''}
                aria-label={`Your probability for ${node.label} by ${h}, 0 to 100 percent`}
                onChange={(e) => setValue(String(h), e.target.value)}
              />
              %
            </label>
          ))}
        </div>
        <input
          type="text"
          value={note}
          maxLength={500}
          placeholder="Why? (optional, public)"
          aria-label={`Note on your estimate for ${node.label}`}
          onChange={(e) => setNote(e.target.value)}
          className="w-full min-h-11 px-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-[12px] text-slate-800 dark:text-white"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={busy || ctx.loading}
            className="min-h-11 px-3 rounded-lg bg-violet-600 text-white text-[12px] font-medium disabled:opacity-40"
          >
            {mine ? 'Update my estimate' : 'Submit my estimate'}
          </button>
          {mine && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              yours:{' '}
              {horizons
                .filter((h) => mine.curve[String(h)] !== undefined)
                .map((h) => `${h} ${Math.round(mine.curve[String(h)] * 100)}%`)
                .join(' · ')}{' '}
              (as of {mine.asOf.slice(0, 10)})
            </span>
          )}
        </div>
      </form>

      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        {thin
          ? 'Not enough estimates yet — the pooled number is still mostly the seed.'
          : `Pooled from ${agg?.n ?? 0} estimates (effective ${agg ? agg.nEff.toFixed(1) : '0'}).`}
      </p>

      {!isExpert && (
        <form onSubmit={onSignIn} className="flex flex-wrap items-center gap-1.5">
          <input
            type="email"
            value={email}
            placeholder="you@lab.org"
            aria-label="Email for an expert sign-in link"
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 min-w-[10rem] min-h-11 px-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-[12px] text-slate-800 dark:text-white"
          />
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="min-h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-[12px] text-slate-700 dark:text-slate-200 disabled:opacity-40"
          >
            Email me an expert link
          </button>
        </form>
      )}

      {msg && <p className="text-[11px] text-emerald-600 dark:text-emerald-400">{msg}</p>}
      {(err || ctx.error) && <p className="text-[11px] text-rose-600 dark:text-rose-400">{err ?? ctx.error}</p>}
    </div>
  );
};

export default VotePanel;

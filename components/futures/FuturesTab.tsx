/**
 * FuturesTab — the AI Futures Map tab (design doc sections 1, 9 and 10, package C).
 *
 * Owns all UI state: per-node log-odds sliders, the set of active interventions, and the
 * scrubbed year. The baseline is memoised once per graph; `solve()` is sub-millisecond,
 * so it re-runs on every slider input.
 *
 * Mount it with:
 *   <FuturesTab graph={graph} interventions={interventions} importPanel={<InterventionImportPanel .../>} />
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Compass, RotateCcw } from 'lucide-react';
import {
  Aggregate,
  Curve,
  Estimate,
  FuturesGraph,
  Intervention,
  InterventionMetrics,
  ShiftVector,
  Tier,
} from '../../src/futures/types';
import {
  buildBaseline,
  goodnessSeries,
  mergeShifts,
  shiftsFromInterventions,
  sliderShift,
  solve,
} from '../../src/futures/engine';
import GoodnessRiver, { FX_SCOPE_CSS } from './GoodnessRiver';
import MetricTiles from './MetricTiles';
import InterventionPanel from './InterventionPanel';
import StateSankey from './StateSankey';
import NodeLanes from './NodeLanes';
import WhatMovedList from './WhatMovedList';
import EquationsPanel from './EquationsPanel';
import { TierOverlayContext, type TierOverlayValue } from './VotePanel';
import { createStore, isCloudConfigured, type Identity } from '../../src/futures/store';

export interface FuturesTabProps {
  graph: FuturesGraph;
  interventions: Intervention[];
  /** Package D's paste-a-bill panel, rendered inside the intervention panel. */
  importPanel?: React.ReactNode;
  /** Optional precomputed each-alone cost-curve metrics; computed from the engine when absent. */
  interventionMetrics?: InterventionMetrics[];
}

/**
 * Locked is always available (it is the seed, bundled from git). Expert and Public light up only
 * when the four VITE_FIREBASE_* build vars are present — see docs/futures-v1-setup.md. Until
 * then they stay disabled and nothing in this tab touches the network.
 */
const TIER_LABELS: Array<{ id: Tier; label: string }> = [
  { id: 'locked', label: 'Locked' },
  { id: 'expert', label: 'Expert' },
  { id: 'public', label: 'Public' },
];

const byNodeId = <T extends { nodeId: string }>(rows: T[]): Map<string, T> =>
  new Map(rows.map((r) => [r.nodeId, r]));

const FuturesTab: React.FC<FuturesTabProps> = ({ graph, interventions, importPanel, interventionMetrics }) => {
  const [sliders, setSliders] = useState<Record<string, number>>({});
  const [activeInterventionIds, setActiveInterventionIds] = useState<Set<string>>(() => new Set<string>());
  const [scrubYear, setScrubYear] = useState<number>(graph.endYear);
  const [tier, setTier] = useState<Tier>('locked');

  const nY = graph.endYear - graph.startYear + 1;

  // -- tiers ----------------------------------------------------------------

  const cloud = useMemo(() => isCloudConfigured(), []);
  // Only built when the cloud is configured: `createStore()` then returns the lazy Firestore
  // store, whose `firebase` import is the only thing that ever pulls the SDK into the page.
  const store = useMemo(() => (cloud ? createStore({ graph }) : null), [cloud, graph]);

  const [identity, setIdentity] = useState<Identity | null>(null);
  const [aggregates, setAggregates] = useState<Map<string, Aggregate>>(() => new Map());
  const [mine, setMine] = useState<Map<string, Estimate>>(() => new Map());
  const [tierLoading, setTierLoading] = useState(false);
  const [tierError, setTierError] = useState<string | null>(null);

  const refreshMine = useCallback(async () => {
    if (!store) return;
    setMine(byNodeId(await store.getMyEstimates()));
  }, [store]);

  const refreshAggregates = useCallback(
    async (t: Tier) => {
      if (!store || t === 'locked') {
        setAggregates(new Map());
        return;
      }
      setTierLoading(true);
      setTierError(null);
      try {
        setAggregates(byNodeId(await store.getAggregates(t)));
      } catch (err) {
        setAggregates(new Map());
        setTierError(err instanceof Error ? err.message : String(err));
      } finally {
        setTierLoading(false);
      }
    },
    [store],
  );

  // Sign in (finishing an email link if this page load is one), then load the tier.
  useEffect(() => {
    if (!store) return;
    let live = true;
    (async () => {
      try {
        await store.completeSignIn();
        const who = await store.whoAmI();
        if (!live) return;
        setIdentity(who);
        await refreshMine();
      } catch (err) {
        if (live) setTierError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      live = false;
    };
  }, [store, refreshMine]);

  useEffect(() => {
    void refreshAggregates(tier);
  }, [tier, refreshAggregates]);

  const submitEstimate = useCallback(
    async (nodeId: string, curve: Curve, note?: string) => {
      if (!store) throw new Error('Community voting is not configured.');
      await store.submitEstimate(nodeId, curve, note);
      await refreshMine();
      await refreshAggregates(tier);
    },
    [store, refreshMine, refreshAggregates, tier],
  );

  const signIn = useCallback(
    async (email: string) => {
      if (!store) throw new Error('Community voting is not configured.');
      await store.signInWithEmailLink(email);
    },
    [store],
  );

  const signOut = useCallback(async () => {
    if (!store) return;
    await store.signOut();
    setIdentity(await store.whoAmI());
    await refreshMine();
  }, [store, refreshMine]);

  const tierOverlay = useMemo<TierOverlayValue>(
    () => ({
      cloud,
      tier,
      graph,
      store,
      identity,
      aggregates,
      mine,
      loading: tierLoading,
      error: tierError,
      submit: submitEstimate,
      signIn,
      signOut,
    }),
    [cloud, tier, graph, store, identity, aggregates, mine, tierLoading, tierError, submitEstimate, signIn, signOut],
  );

  // The baseline never depends on user state, so it is built once per graph.
  const built = useMemo(() => {
    try {
      return { baseline: buildBaseline(graph), error: null as string | null };
    } catch (err) {
      return { baseline: null, error: err instanceof Error ? err.message : String(err) };
    }
  }, [graph]);

  const activeInterventions = useMemo(
    () => interventions.filter((iv) => activeInterventionIds.has(iv.id)),
    [interventions, activeInterventionIds],
  );

  const shifts = useMemo<ShiftVector>(() => {
    const vectors: ShiftVector[] = [shiftsFromInterventions(graph, activeInterventions)];
    for (const id of Object.keys(sliders)) {
      const v = sliders[id];
      if (v) vectors.push(sliderShift(graph, id, v));
    }
    return mergeShifts(nY, ...vectors);
  }, [graph, activeInterventions, sliders, nY]);

  const result = useMemo(() => {
    if (!built.baseline) return null;
    return solve(graph, shifts, built.baseline);
  }, [graph, shifts, built.baseline]);

  const currentSeries = useMemo(
    () => (result ? goodnessSeries(graph, result.P, result.years) : null),
    [graph, result],
  );
  const baselineSeries = useMemo(
    () => (built.baseline ? goodnessSeries(graph, built.baseline.P, built.baseline.years) : null),
    [graph, built.baseline],
  );

  const onSlider = useCallback((nodeId: string, logOdds: number) => {
    setSliders((prev) => ({ ...prev, [nodeId]: logOdds }));
  }, []);

  const onToggleIntervention = useCallback((id: string) => {
    setActiveInterventionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setSliders({});
    setActiveInterventionIds(new Set<string>());
    setScrubYear(graph.endYear);
  }, [graph.endYear]);

  const dirty = activeInterventionIds.size > 0 || Object.values(sliders).some((v) => v !== 0);

  return (
    <TierOverlayContext.Provider value={tierOverlay}>
    <div className="fx-scope max-w-5xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6 space-y-4">
      <style>{FX_SCOPE_CSS}</style>

      {/* header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-slate-800 dark:text-white">
              <Compass size={18} className="text-violet-600 dark:text-violet-400 shrink-0" />
              {graph.title ?? 'AI Futures Map'}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              {graph.description ??
                'Goodness of the world, 0-100, from ' +
                  graph.startYear +
                  ' to ' +
                  graph.endYear +
                  '. Ribbon thickness is probability. Numbers are labelled seeds, not forecasts.'}
            </p>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              Graph version {graph.graphVersion}
              {tier !== 'locked' && (
                <>
                  {' · '}
                  {tier === 'expert' ? 'Expert' : 'Public'} tier drawn over the seed:{' '}
                  {tier === 'expert' ? 'solid stroke' : 'dashed stroke'}, band = the 25th to 75th percentile of
                  opinion, greyed where fewer than 5 effective estimates.
                  {tierLoading && ' Loading…'}
                </>
              )}
            </p>
            {tierError && (
              <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">Tier data unavailable: {tierError}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Estimate tier"
              className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              {TIER_LABELS.map((t) => {
                const enabled = t.id === 'locked' || cloud;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={!enabled}
                    aria-pressed={tier === t.id}
                    title={enabled ? `${t.label} tier` : 'Coming soon'}
                    onClick={() => enabled && setTier(t.id)}
                    className={`min-h-11 px-3 text-xs font-medium transition-colors ${
                      tier === t.id
                        ? 'bg-violet-600 text-white'
                        : enabled
                          ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                          : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    {t.label}
                    {!enabled && <span className="block text-[10px] font-normal leading-none">coming soon</span>}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={reset}
              disabled={!dirty}
              className="min-h-11 px-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw size={13} />
              Reset everything
            </button>
          </div>
        </div>
      </div>

      {built.error && (
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-300 dark:border-rose-800 rounded-2xl p-4 text-sm text-rose-700 dark:text-rose-300">
          This futures graph could not be solved: {built.error}
        </div>
      )}

      {built.baseline && result && currentSeries && baselineSeries && (
        <>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4">
            <GoodnessRiver
              graph={graph}
              years={result.years}
              P={result.P}
              baseP={built.baseline.P}
              current={currentSeries}
              baseline={baselineSeries}
              scrubYear={scrubYear}
              onScrubYear={setScrubYear}
            />
          </div>

          <MetricTiles graph={graph} current={currentSeries} baseline={baselineSeries} />

          <InterventionPanel
            graph={graph}
            interventions={interventions}
            baseline={built.baseline}
            activeIds={activeInterventionIds}
            onToggle={onToggleIntervention}
            metrics={interventionMetrics}
            importPanel={importPanel}
          />

          <StateSankey graph={graph} years={result.years} P={result.P} />

          <NodeLanes
            graph={graph}
            years={result.years}
            P={result.P}
            baseP={built.baseline.P}
            sliders={sliders}
            onSlider={onSlider}
          />

          <WhatMovedList graph={graph} years={result.years} P={result.P} baseP={built.baseline.P} />

          <EquationsPanel
            graph={graph}
            years={result.years}
            P={result.P}
            baseP={built.baseline.P}
            current={currentSeries}
            scrubYear={scrubYear}
          />
        </>
      )}
    </div>
    </TierOverlayContext.Provider>
  );
};

export default FuturesTab;

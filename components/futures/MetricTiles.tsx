/**
 * MetricTiles — the three headline numbers under the river (design doc section 5:
 * mean shift, floor lift, ceiling lift), each with its delta against the baseline.
 * Green means the world got better, red means worse; "better" is not always "up",
 * which is why floor risk is coloured the other way round.
 */

import React from 'react';
import { FuturesGraph, GoodnessSeries } from '../../src/futures/types';
import { pct } from './GoodnessRiver';

export interface MetricTilesProps {
  graph: FuturesGraph;
  current: GoodnessSeries;
  baseline: GoodnessSeries;
}

interface Delta {
  text: string;
  tone: 'good' | 'bad' | 'flat';
}

function deltaOf(base: number, now: number, isProbability: boolean, upIsGood: boolean): Delta {
  const d = now - base;
  const eps = isProbability ? 0.005 : 0.05;
  if (Math.abs(d) < eps) return { text: 'unchanged vs baseline', tone: 'flat' };
  const better = upIsGood ? d > 0 : d < 0;
  const magnitude = isProbability ? `${(d * 100).toFixed(1)} pts` : d.toFixed(1);
  return { text: `${d > 0 ? '+' : ''}${magnitude} vs baseline`, tone: better ? 'good' : 'bad' };
}

const TONE_CLASS: Record<Delta['tone'], string> = {
  good: 'text-emerald-600 dark:text-emerald-400',
  bad: 'text-rose-600 dark:text-rose-400',
  flat: 'text-slate-400 dark:text-slate-500',
};

const Tile: React.FC<{ label: string; value: string; delta: Delta }> = ({ label, value, delta }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4">
    <div className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">{label}</div>
    <div className="text-2xl font-bold tabular-nums text-slate-800 dark:text-white leading-tight mt-0.5">{value}</div>
    <div className={`text-[11px] tabular-nums ${TONE_CLASS[delta.tone]}`}>{delta.text}</div>
  </div>
);

const MetricTiles: React.FC<MetricTilesProps> = ({ graph, current, baseline }) => {
  const last = current.mean.length - 1;
  const floorG = graph.axis.floorGoodness ?? 20;
  const ceilG = graph.axis.ceilingGoodness ?? 90;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Tile
        label={`Expected goodness in ${graph.endYear}`}
        value={current.mean[last].toFixed(1)}
        delta={deltaOf(baseline.mean[last], current.mean[last], false, true)}
      />
      <Tile
        label={`Chance of catastrophe or worse by ${graph.endYear} (goodness ≤ ${floorG})`}
        value={pct(current.floor[last])}
        delta={deltaOf(baseline.floor[last], current.floor[last], true, false)}
      />
      <Tile
        label={`Chance of flourishing by ${graph.endYear} (goodness ≥ ${ceilG})`}
        value={pct(current.ceiling[last])}
        delta={deltaOf(baseline.ceiling[last], current.ceiling[last], true, true)}
      />
    </div>
  );
};

export default MetricTiles;

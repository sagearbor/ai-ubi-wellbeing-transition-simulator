/**
 * WhatMovedList — the eight nodes whose end-year probability moved most, so a nudge or a
 * stacked wedge is never a black box. Colour is valence-aware: a rise in a good node is
 * green, a rise in a bad or existential node is red, neutral/mixed stays ink.
 */

import React, { useMemo } from 'react';
import { FuturesGraph, FuturesNode } from '../../src/futures/types';
import { pct } from './GoodnessRiver';

export interface WhatMovedListProps {
  graph: FuturesGraph;
  years: number[];
  P: Record<string, number[]>;
  baseP: Record<string, number[]>;
}

/** +1 = a rise here is good for the world, -1 = a rise is bad, 0 = neither. */
function directionOfGood(node: FuturesNode): number {
  if (node.kind === 'state') {
    const g = node.goodness ?? 0;
    return g >= 60 ? 1 : g <= 20 ? -1 : 0;
  }
  if (node.severity === 'existential') return -1;
  if (node.valence === 'good') return 1;
  if (node.valence === 'bad') return -1;
  return 0;
}

const WhatMovedList: React.FC<WhatMovedListProps> = ({ graph, years, P, baseP }) => {
  const last = years.length - 1;

  const moved = useMemo(
    () =>
      graph.nodes
        .filter((n) => !n.retired && P[n.id] && baseP[n.id])
        .map((n) => ({ node: n, delta: P[n.id][last] - baseP[n.id][last] }))
        .filter((x) => Math.abs(x.delta) >= 0.005)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 8),
    [graph, P, baseP, last],
  );

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
      <h3 className="text-sm font-bold text-slate-800 dark:text-white">{`What moved most by ${graph.endYear}`}</h3>
      {moved.length === 0 ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Nothing yet. Toggle an intervention above, or drag a slider.
        </p>
      ) : (
        <ul className="mt-2 space-y-1 text-[13px] tabular-nums text-slate-700 dark:text-slate-200">
          {moved.map(({ node, delta }) => {
            const good = directionOfGood(node) * Math.sign(delta);
            const tone =
              good > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : good < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-500 dark:text-slate-400';
            return (
              <li key={node.id}>
                <span className={`font-semibold ${tone}`}>
                  {delta > 0 ? '▲' : '▼'} {Math.abs(delta * 100).toFixed(1)} pts
                </span>{' '}
                {node.label}
                {node.kind === 'state' && <span className="text-slate-400 dark:text-slate-500"> (world-state)</span>}:{' '}
                <span className="text-slate-500 dark:text-slate-400">
                  {pct(baseP[node.id][last], 1)} → {pct(P[node.id][last], 1)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default WhatMovedList;

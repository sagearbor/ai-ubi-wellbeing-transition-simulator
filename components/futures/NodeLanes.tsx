/**
 * NodeLanes — every event node, grouped by lane into collapsible <details> sections.
 * States are not shown here: they live on the river, which is the only place
 * exclusivity is enforced.
 */

import React, { useMemo } from 'react';
import { FuturesGraph, FuturesNode, Lane } from '../../src/futures/types';
import NodeLane from './NodeLane';

export interface NodeLanesProps {
  graph: FuturesGraph;
  years: number[];
  P: Record<string, number[]>;
  baseP: Record<string, number[]>;
  sliders: Record<string, number>;
  onSlider: (nodeId: string, logOdds: number) => void;
}

const LANE_ORDER: Lane[] = ['capability', 'governance', 'economy', 'society', 'catastrophe', 'flourishing'];

const laneRank = (lane: string): number => {
  const i = LANE_ORDER.indexOf(lane as Lane);
  return i < 0 ? LANE_ORDER.length : i;
};

const NodeLanes: React.FC<NodeLanesProps> = ({ graph, years, P, baseP, sliders, onSlider }) => {
  const nodesById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);

  const groups = useMemo(() => {
    const events = graph.nodes.filter((n) => !n.retired && n.kind === 'event');
    const byLane = new Map<string, FuturesNode[]>();
    for (const n of events) {
      const lane = n.lane ?? 'other';
      if (!byLane.has(lane)) byLane.set(lane, []);
      byLane.get(lane)!.push(n);
    }
    return [...byLane.entries()].sort((a, b) => laneRank(a[0]) - laneRank(b[0]));
  }, [graph]);

  /** "by 2035" when the graph has it, otherwise the middle axis horizon. */
  const midYear = useMemo(() => {
    const inRange = graph.horizons.filter((h) => h > graph.startYear && h < graph.endYear);
    if (inRange.includes(2035)) return 2035;
    if (inRange.length) return inRange[Math.floor((inRange.length - 1) / 2)];
    return graph.startYear;
  }, [graph]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-800 dark:text-white">Event likelihoods</h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Non-exclusive propositions — any subset can be true at once. Drag a slider to nudge one in log-odds
          and watch it propagate.
        </p>
      </div>

      {groups.map(([lane, nodes]) => (
        <details key={lane} open className="border-b border-slate-200 dark:border-slate-800 last:border-b-0">
          <summary className="cursor-pointer select-none px-4 sm:px-5 py-2 min-h-11 flex items-center text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50">
            {lane}
            <span className="ml-2 normal-case tracking-normal text-slate-400 dark:text-slate-500">{nodes.length}</span>
          </summary>
          <div className="px-4 sm:px-5">
            {nodes.map((n) => (
              <NodeLane
                key={n.id}
                node={n}
                years={years}
                base={baseP[n.id] ?? []}
                cur={P[n.id] ?? []}
                value={sliders[n.id] ?? 0}
                onChange={onSlider}
                midYear={midYear}
                endYear={graph.endYear}
                nodesById={nodesById}
              />
            ))}
          </div>
        </details>
      ))}

      <div className="px-4 sm:px-5 py-2 grid grid-cols-1 sm:grid-cols-[150px_1fr] sm:gap-x-3 text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
        <div />
        <div className="flex justify-between">
          {[graph.startYear, ...graph.horizons.filter((h) => h > graph.startYear && h <= graph.endYear)].map((y) => (
            <span key={y}>{y}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NodeLanes;

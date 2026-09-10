/**
 * EquationsPanel — the maths from design doc section 4, verbatim, plus the live numbers
 * for whatever the user has nudged, evaluated at the scrubbed year. Collapsed by default:
 * it is here so nobody has to take the chart on faith, not because it is the point.
 */

import React, { useMemo, useState } from 'react';
import { Sigma } from 'lucide-react';
import { FuturesGraph, GoodnessSeries } from '../../src/futures/types';
import { logit } from '../../src/futures/engine';
import { clampN, orderedStates, pct } from './GoodnessRiver';

export interface EquationsPanelProps {
  graph: FuturesGraph;
  years: number[];
  P: Record<string, number[]>;
  baseP: Record<string, number[]>;
  current: GoodnessSeries;
  scrubYear: number;
  defaultOpen?: boolean;
}

const FORMULAS = `4.2 Baseline curves
  logit(p) = ln(p / (1 - p))            sigmoid(x) = 1 / (1 + e^-x)
  Between horizons, interpolate linearly IN LOG-ODDS:
    L(y) = lerp( logit(P[h_k]), logit(P[h_k+1]), f ),   P(y) = sigmoid( L(y) )
  World-states: interpolate each state the same way, then renormalise across states every year.

4.3 Propagation (nudges and interventions)
  u_k(y) = user or intervention shift on node k, in log-odds; zero before its start year plus lag.

  for each year y:
    for each node j in topological order of the zero-lag edges:
      d_j(y)  = u_j(y) + clamp( SUM over parents i of  w_ij * d_i(y - lag_ij),  -4, +4 )
      P'_j(y) = sigmoid( logit(P_j(y)) + d_j(y) )

  requires edges:  P'_j(y) = min( P'_j(y), P'_i(y - lag) )   a consequence is never likelier than its cause
  event nodes:     P'_j(y) = max( P'_j(y), P'_j(y - 1) )     once happened, stays happened
  world-states:    P'_s(y) = P'_s(y) / SUM over states       exclusive, sums to 1 every year

  Only deltas travel: at baseline every edge contributes zero, so the curated seed is reproduced exactly.
  Nudges compose by addition in log-odds, so order does not matter and repeated pushes on the same
  lever show diminishing returns.

4.4 The one graph
  Mean goodness   G(y) = SUM over states s of  P_s(y) * v_s
  Floor risk      F(y) = SUM over s with v_s <= floorGoodness of P_s(y)
  Ceiling chance  C(y) = SUM over s with v_s >= ceilingGoodness of P_s(y)
  Ribbon s at year y is centred at v_s with thickness proportional to P_s(y).

  Intervention magnitudes:  slight 0.25, moderate 0.5, strong 1.0 log-odds; sign from direction.`;

const EquationsPanel: React.FC<EquationsPanelProps> = ({
  graph,
  years,
  P,
  baseP,
  current,
  scrubYear,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const states = useMemo(() => orderedStates(graph), [graph]);
  const t = clampN(years.indexOf(scrubYear) >= 0 ? years.indexOf(scrubYear) : 0, 0, years.length - 1);
  const floorG = graph.axis.floorGoodness ?? 20;
  const ceilG = graph.axis.ceilingGoodness ?? 90;

  const meanTerms = states.map((s) => `${(P[s.id]?.[t] ?? 0).toFixed(3)}*${s.goodness}`).join(' + ');

  const nudged = useMemo(
    () =>
      graph.nodes
        .filter((n) => !n.retired && P[n.id] && baseP[n.id] && Math.abs(P[n.id][t] - baseP[n.id][t]) >= 0.002)
        .map((n) => ({
          node: n,
          base: baseP[n.id][t],
          now: P[n.id][t],
          d: logit(P[n.id][t]) - logit(baseP[n.id][t]),
        }))
        .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
        .slice(0, 10),
    [graph, P, baseP, t],
  );

  const live =
    `At y = ${years[t]}\n` +
    `  G(${years[t]}) = ${meanTerms} = ${current.mean[t].toFixed(2)}\n` +
    `  F(${years[t]}) = P(goodness <= ${floorG}) = ${pct(current.floor[t], 1)}\n` +
    `  C(${years[t]}) = P(goodness >= ${ceilG}) = ${pct(current.ceiling[t], 1)}\n` +
    (nudged.length
      ? `\nNodes with a non-zero total delta at ${years[t]}   [ P' = sigmoid( logit(P) + d ) ]\n` +
        nudged
          .map(
            (x) =>
              `  ${x.node.id.padEnd(24)} d = ${(x.d >= 0 ? '+' : '') + x.d.toFixed(3)}   ` +
              `${x.base.toFixed(3)} -> ${x.now.toFixed(3)}`,
          )
          .join('\n')
      : `\nNothing nudged: every d_j(y) is 0, so P' = P and the seed is reproduced exactly.`);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl"
    >
      <summary className="cursor-pointer select-none px-4 sm:px-5 py-3 min-h-11 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
        <Sigma size={15} className="text-violet-600 dark:text-violet-400" />
        Equations
        <span className="font-normal text-[11px] text-slate-500 dark:text-slate-400">
          exactly what the engine runs
        </span>
      </summary>
      <div className="px-4 sm:px-5 pb-4 space-y-3">
        <pre className="overflow-x-auto text-[11px] leading-relaxed rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-slate-700 dark:text-slate-300">
          {FORMULAS}
        </pre>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            Live numbers
          </div>
          <pre className="overflow-x-auto text-[11px] leading-relaxed rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-slate-700 dark:text-slate-300">
            {live}
          </pre>
        </div>
      </div>
    </details>
  );
};

export default EquationsPanel;

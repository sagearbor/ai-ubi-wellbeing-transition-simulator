/**
 * InterventionPanel — toggle chips (wedges stack) plus the cost curve
 * (design doc section 5, the marginal-abatement-curve analogue).
 *
 * Every row of the cost curve is computed with that intervention applied ALONE against
 * the baseline, which is how the climate curve is built; the chips above stack.
 *
 * Metrics may be supplied by the integrator via the `metrics` prop (e.g. from
 * src/futures/interventions.ts, owned by another package). When absent they are
 * computed here from the engine alone, so this component never has to import that
 * module while it is still being written.
 */

import React, { useMemo } from 'react';
import { FlaskConical, Info } from 'lucide-react';
import {
  Baseline,
  FuturesGraph,
  Intervention,
  InterventionMetrics,
} from '../../src/futures/types';
import { goodnessSeries, shiftsFromInterventions, solve } from '../../src/futures/engine';

export interface InterventionPanelProps {
  graph: FuturesGraph;
  interventions: Intervention[];
  baseline: Baseline;
  activeIds: Set<string>;
  onToggle: (id: string) => void;
  /** Precomputed each-alone metrics. Computed locally when omitted. */
  metrics?: InterventionMetrics[];
  /** The paste-a-bill import panel, owned by another package. */
  importPanel?: React.ReactNode;
}

/** Each-alone metrics against the baseline. Same shape as src/futures/interventions.ts. */
export function computeInterventionMetrics(
  graph: FuturesGraph,
  interventions: Intervention[],
  baseline: Baseline,
): InterventionMetrics[] {
  const baseSeries = goodnessSeries(graph, baseline.P, baseline.years);
  const last = baseline.years.length - 1;
  return interventions.map((iv) => {
    const solved = solve(graph, shiftsFromInterventions(graph, [iv]), baseline);
    const g = goodnessSeries(graph, solved.P, solved.years);
    const meanShift = g.mean[last] - baseSeries.mean[last];
    const band = iv.cost.band;
    return {
      interventionId: iv.id,
      meanShift,
      floorLift: baseSeries.floor[last] - g.floor[last],
      ceilingLift: g.ceiling[last] - baseSeries.ceiling[last],
      cost: band,
      shiftPerCost: band > 0 ? meanShift / band : 0,
    };
  });
}

const costDots = (band: number): string => '●'.repeat(band) + '○'.repeat(Math.max(0, 5 - band));

const signed = (x: number, digits = 1): string => `${x >= 0 ? '+' : ''}${x.toFixed(digits)}`;

const InterventionPanel: React.FC<InterventionPanelProps> = ({
  graph,
  interventions,
  baseline,
  activeIds,
  onToggle,
  metrics,
  importPanel,
}) => {
  const rows = useMemo(() => {
    const m = metrics ?? computeInterventionMetrics(graph, interventions, baseline);
    const byId = new Map(interventions.map((iv) => [iv.id, iv]));
    return m
      .filter((r) => byId.has(r.interventionId))
      .slice()
      .sort((a, b) => b.shiftPerCost - a.shiftPerCost)
      .map((r) => ({ ...r, iv: byId.get(r.interventionId)! }));
  }, [graph, interventions, baseline, metrics]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <FlaskConical size={16} className="text-violet-600 dark:text-violet-400" />
        <h3 className="text-sm font-bold text-slate-800 dark:text-white">Interventions</h3>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">toggle to stack wedges</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {interventions.length === 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400">No interventions in this graph yet.</p>
        )}
        {interventions.map((iv) => {
          const on = activeIds.has(iv.id);
          return (
            <button
              key={iv.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(iv.id)}
              title={iv.summary}
              className={`min-h-11 px-3 py-2 rounded-xl border text-xs font-medium text-left transition-colors ${
                on
                  ? 'bg-violet-600 border-violet-600 text-white'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500'
              }`}
            >
              {iv.label}
              <span className={`ml-2 text-[11px] ${on ? 'text-violet-200' : 'text-slate-400 dark:text-slate-500'}`}>
                from {iv.startYear} · cost {iv.cost.band}/5
              </span>
            </button>
          );
        })}
      </div>

      {rows.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Cost curve · ranked by mean shift per unit cost · each intervention applied alone
          </div>
          <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr className="text-slate-500 dark:text-slate-400 text-left">
                  <th className="font-semibold py-1.5 pr-2">Intervention</th>
                  <th className="font-semibold py-1.5 pr-2">Cost band</th>
                  <th className="font-semibold py-1.5 pr-2">Mean shift {graph.endYear}</th>
                  <th className="font-semibold py-1.5 pr-2">Floor lift</th>
                  <th className="font-semibold py-1.5 pr-2">Ceiling lift</th>
                  <th className="font-semibold py-1.5">Shift per cost</th>
                </tr>
              </thead>
              <tbody className="tabular-nums text-slate-700 dark:text-slate-200">
                {rows.map((r) => (
                  <tr
                    key={r.interventionId}
                    className={`border-t border-slate-200 dark:border-slate-800 ${
                      activeIds.has(r.interventionId) ? 'bg-violet-50 dark:bg-violet-900/20' : ''
                    }`}
                  >
                    <td className="py-1.5 pr-2">{r.iv.label}</td>
                    <td className="py-1.5 pr-2 text-slate-500 dark:text-slate-400" title={r.iv.cost.note ?? `Cost band ${r.cost} of 5`}>
                      {costDots(r.cost)}
                    </td>
                    <td className="py-1.5 pr-2">{signed(r.meanShift)}</td>
                    <td className="py-1.5 pr-2">{signed(r.floorLift * 100)} pts</td>
                    <td className="py-1.5 pr-2">{signed(r.ceilingLift * 100)} pts</td>
                    <td className="py-1.5">{r.shiftPerCost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <Info size={12} className="mt-0.5 shrink-0" />
            Floor lift is how much the bad tail shrank. An intervention can barely move the mean and still
            be the best thing on this table.
          </p>
        </div>
      )}

      {importPanel && <div className="pt-3 border-t border-slate-200 dark:border-slate-800">{importPanel}</div>}
    </div>
  );
};

export default InterventionPanel;

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
import { Hint } from './Hint';

/** Plain-words glossary for the cost curve. Kept next to the table it explains. */
const HINTS = {
  interventions:
    'Toggle one or more; their effects add in log-odds, so the second wedge on the same lever is smaller than the first.',
  costBand:
    'Rough cost and political difficulty. 1 = cheap and easy (a rule change), 2 = a funded programme, 3 = a major national programme, 4 = several percent of GDP or a new institution, 5 = a binding international treaty or a constitutional-scale change. Only used to rank interventions on the cost curve.',
  meanShift: (endYear: number) =>
    `Change in the expected goodness of the world in ${endYear} (0-100 scale, 100 = flourishing) versus the baseline.`,
  floorLift: (endYear: number) =>
    `How many percentage points the chance of catastrophe-or-worse by ${endYear} (goodness 20 or below) falls. An intervention can barely move the mean and still be the best thing here.`,
  ceilingLift: (endYear: number) =>
    `How many percentage points the chance of flourishing by ${endYear} (goodness 90 or above) rises.`,
  shiftPerCost:
    'Mean shift divided by the cost band. This is the order of the cost curve, like a climate abatement curve.',
} as const;

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
        <Hint text={HINTS.interventions} label="Interventions" />
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
              {iv.tier !== 'locked' && (
                <span
                  title="You added this card; it is not part of the curated seed."
                  className={`ml-1.5 align-[1px] rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    on
                      ? 'bg-white/20 text-white'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                  }`}
                >
                  yours
                </span>
              )}
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
                  <th className="font-semibold py-1.5 pr-2 whitespace-nowrap">
                    Cost band
                    <Hint text={HINTS.costBand} label="Cost band" />
                  </th>
                  <th className="font-semibold py-1.5 pr-2 whitespace-nowrap">
                    Mean shift {graph.endYear}
                    <Hint text={HINTS.meanShift(graph.endYear)} label="Mean shift" />
                  </th>
                  <th className="font-semibold py-1.5 pr-2 whitespace-nowrap">
                    Floor lift
                    <Hint text={HINTS.floorLift(graph.endYear)} label="Floor lift" />
                  </th>
                  <th className="font-semibold py-1.5 pr-2 whitespace-nowrap">
                    Ceiling lift
                    <Hint text={HINTS.ceilingLift(graph.endYear)} label="Ceiling lift" align="right" />
                  </th>
                  <th className="font-semibold py-1.5 whitespace-nowrap">
                    Shift per cost
                    <Hint text={HINTS.shiftPerCost} label="Shift per cost" align="right" />
                  </th>
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

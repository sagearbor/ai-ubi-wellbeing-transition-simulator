/**
 * PolicyResults — the paired comparison, for one or two drafts on the same baseline.
 *
 * The table puts the baseline, each policy, and each paired difference side by side at a chosen
 * year. A paired difference is computed inside each Monte Carlo draw and then summarised, so it is
 * not the policy column minus the baseline column — the hint says so. The charts show the active
 * draft's median against the baseline median with the policy's p5–p95 band.
 */

import React from 'react';
import type { CoreModel } from '../../src/core/types';
import type { PairedRunResult, Quantiles } from '../../src/policy/types';
import { Hint } from '../futures/Hint';
import OutputChart from './OutputChart';
import { fmtCompact, stepForYear, unitOf } from './labState';

export interface PolicyResultEntry {
  label: string;
  result: PairedRunResult;
  stale: boolean;
}

export interface PolicyResultsProps {
  /** Scenario model (base + scenario overlays), for units and descriptions. */
  model: CoreModel;
  entries: PolicyResultEntry[];
  active: number;
  year: number | null;
  onYear: (year: number) => void;
}

const bandText = (q: Quantiles | undefined, t: number): string => {
  if (!q || !Number.isFinite(q.p50[t])) return '—';
  return `${fmtCompact(q.p50[t])} [${fmtCompact(q.p5[t])}, ${fmtCompact(q.p95[t])}]`;
};

const signed = (q: Quantiles | undefined, t: number): string => {
  if (!q || !Number.isFinite(q.p50[t])) return '—';
  const s = (x: number) => `${x > 0 ? '+' : ''}${fmtCompact(x)}`;
  return `${s(q.p50[t])} [${s(q.p5[t])}, ${s(q.p95[t])}]`;
};

const PolicyResults: React.FC<PolicyResultsProps> = ({ model, entries, active, year, onYear }) => {
  const first = entries.find((e) => e.result.ok);
  if (!first) {
    return (
      <div className="rounded-lg border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 px-3 py-2 text-xs text-rose-800 dark:text-rose-200">
        <p className="font-semibold">The paired run did not complete, so there are no results.</p>
        <ul className="mt-1 list-disc pl-4">
          {entries.flatMap((e) => e.result.errors.map((err, i) => <li key={`${e.label}-${i}`}>{`${e.label}: ${err}`}</li>))}
        </ul>
      </div>
    );
  }
  const { years, entities, outputs } = first.result;
  const entity = entities[0];
  const t = year === null ? years.length - 1 : stepForYear(years, year);
  const shown = entries[active]?.result.ok ? entries[active] : first;

  return (
    <div className="space-y-3">
      {entries.some((e) => e.stale) && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          The draft or the scenario changed after this run ({entries.filter((e) => e.stale).map((e) => e.label).join(', ')}). These numbers are for the earlier version — run again.
        </p>
      )}
      {entries.filter((e) => !e.result.ok).map((e) => (
        <p key={e.label} className="rounded-lg border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 px-3 py-2 text-xs text-rose-800 dark:text-rose-200">
          {e.label} did not complete: {e.result.errors.join('; ')}
        </p>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300" htmlFor="policy-year">
          Year
        </label>
        <select
          id="policy-year"
          className="h-11 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm"
          value={years[t]}
          onChange={(e) => onYear(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {Number.isInteger(y) ? y : y.toFixed(2)}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          median [p5, p95] over {first.result.runs} paired draws, seed {first.result.seed}
          <Hint
            label="paired draws"
            text="Both sides use the same model version, the same scenario overlays and the same parameter draws; only the policy overlay differs. The spread comes only from parameters that declare a range. It is not a forecast interval, and it says nothing about whether the model's equations are right."
            align="right"
          />
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-[11px] text-slate-600 dark:text-slate-300">
            <tr>
              <th className="px-2 py-1.5 font-semibold">output</th>
              <th className="px-2 py-1.5 font-semibold">baseline</th>
              {entries.map((e) => (
                <React.Fragment key={e.label}>
                  <th className="px-2 py-1.5 font-semibold">{`policy ${e.label}`}</th>
                  <th className="px-2 py-1.5 font-semibold">
                    {`paired difference ${e.label}`}
                    <Hint
                      label="paired difference"
                      text="Policy minus baseline inside each draw, then the median and 5th–95th percentile of those differences. It is not the policy column minus the baseline column."
                      align="right"
                    />
                  </th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {outputs.map((o) => (
              <tr key={o} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-2 py-1.5 font-mono whitespace-nowrap">
                  {o}
                  <span className="ml-1 font-sans text-[11px] text-slate-400">{unitOf(model, o)}</span>
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap">{bandText(first.result.baseline[entity]?.[o], t)}</td>
                {entries.map((e) => (
                  <React.Fragment key={e.label}>
                    <td className="px-2 py-1.5 whitespace-nowrap">{e.result.ok ? bandText(e.result.policy[entity]?.[o], t) : '—'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap font-semibold">{e.result.ok ? signed(e.result.difference[entity]?.[o], t) : '—'}</td>
                  </React.Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg bg-slate-100 dark:bg-slate-800/60 px-3 py-2 text-xs">
        <p className="font-semibold text-slate-700 dark:text-slate-200">What limits it in {Number.isInteger(years[t]) ? years[t] : years[t].toFixed(2)} (point run)</p>
        <ul className="mt-1 space-y-0.5 text-slate-600 dark:text-slate-300">
          <li>
            <span className="font-medium">baseline:</span> {(first.result.binding.baseline[entity]?.[t] ?? []).join('; ') || 'no min()/max() limit recorded'}
          </li>
          {entries.map((e) =>
            e.result.ok ? (
              <li key={e.label}>
                <span className="font-medium">{`policy ${e.label}:`}</span> {(e.result.binding.policy[entity]?.[t] ?? []).join('; ') || 'no min()/max() limit recorded'}
              </li>
            ) : null,
          )}
        </ul>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {shown.result.ok &&
          outputs.map((o) => (
            <OutputChart
              key={o}
              id={o}
              unit={unitOf(model, o)}
              years={years}
              current={shown.result.policy[entity]?.[o]?.p50 ?? []}
              baseline={shown.result.baseline[entity]?.[o]?.p50}
              showBaseline
              band={shown.result.policy[entity]?.[o] ? { p5: shown.result.policy[entity][o].p5, p95: shown.result.policy[entity][o].p95 } : undefined}
              markYear={years[t]}
              selected={false}
              onSelect={() => onYear(years[t])}
              currentLabel={`policy ${shown.label} (median)`}
              baselineLabel="baseline (median)"
              selectNote=""
            />
          ))}
      </div>
    </div>
  );
};

export default PolicyResults;

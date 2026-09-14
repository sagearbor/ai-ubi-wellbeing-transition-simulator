/**
 * OutputChart — one small chart per declared output.
 *
 * Solid line: the run as currently parameterised. Dashed line: the untouched base model, drawn only
 * once something has changed, so "what did my edit do" is a comparison and not a memory test.
 * With uncertainty on, the shaded band is p5-p95 across Monte Carlo draws of the *declared*
 * parameter ranges — a spread, not a forecast interval, which is what the hint says.
 *
 * A LineChart carries the lines; when a band is present the same children sit in a ComposedChart,
 * which is the recharts chart type that renders an Area beside Lines.
 *
 * Time is labelled in the model's own unit (src/core/calendar.ts): "2029" for a calendar model,
 * "Generation 40" for one whose step is a generation. An output the model declares steady-state-only
 * gets no transition chart at all: its value at the steady state, the reason, and (for a model with
 * entities) the steady-state value of every entity, which is the comparison the model supports.
 */

import React from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Label,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { timeAxisTitle, timeLabel, timeTick } from '../../src/core/calendar';
import type { ModelTime } from '../../src/core/types';
import { Hint } from '../futures/Hint';
import { fmtCompact, fmtExact } from './labState';

export interface Band {
  p5: number[];
  p95: number[];
}

export interface SteadyStateView {
  reason: string;
  /** Step index of the steady state. */
  index: number;
  /** Steady-state value per entity, when the model has several (the comparison it supports). */
  entities?: Array<{ entity: string; value: number; selected: boolean }>;
  /** Caption for the entity list, e.g. "robotTaxRate". */
  entityKind?: string;
}

export interface OutputChartProps {
  id: string;
  /** The model's clock, for labels. Omitted = calendar years. */
  time?: ModelTime;
  /** Set when the model declares this output steady-state-only: no transition chart is drawn. */
  steadyState?: SteadyStateView;
  unit: string;
  description?: string;
  years: number[];
  current: number[];
  /** The base model's series, drawn dashed when `showBaseline`. */
  baseline?: number[];
  showBaseline: boolean;
  band?: Band;
  /** Year the "what limits the result" panel is scrubbed to; marked on the chart. */
  markYear?: number;
  selected: boolean;
  onSelect: (id: string) => void;
  /** Legend names; default "this run" and "base model, untouched". */
  currentLabel?: string;
  baselineLabel?: string;
  /** Text under the "selected / tap to explain" slot; default depends on `selected`. */
  selectNote?: string;
}

const AXIS = { fontSize: 11, fill: 'currentColor' } as const;

const OutputChart: React.FC<OutputChartProps> = ({
  id,
  time,
  steadyState,
  unit,
  description,
  years,
  current,
  baseline,
  showBaseline,
  band,
  markYear,
  selected,
  onSelect,
  currentLabel = 'this run',
  baselineLabel = 'base model, untouched',
  selectNote,
}) => {
  const data = years.map((year, i) => ({
    year,
    current: current?.[i],
    baseline: baseline?.[i],
    band: band ? [band.p5[i], band.p95[i]] : undefined,
  }));
  const Chart: any = band ? ComposedChart : LineChart;
  const lastIndex = steadyState ? steadyState.index : years.length - 1;
  const last = current?.[lastIndex];

  if (steadyState) {
    const at = timeLabel(time, years[lastIndex]);
    const base = baseline?.[lastIndex];
    return (
      <figure
        className={`bg-white dark:bg-slate-900 border rounded-xl p-3 ${
          selected ? 'border-sky-400 dark:border-sky-600 ring-1 ring-sky-200 dark:ring-sky-900' : 'border-slate-200 dark:border-slate-800'
        }`}
        data-steady-state-only={id}
      >
        <figcaption className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
          <button
            type="button"
            onClick={() => onSelect(id)}
            aria-pressed={selected}
            className="min-h-11 text-left text-sm font-semibold text-slate-800 dark:text-white hover:text-sky-700 dark:hover:text-sky-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
          >
            <span className="font-mono break-all">{id}</span>
            <span className="ml-2 font-sans text-[11px] font-normal text-slate-500 dark:text-slate-400">{unit || 'no unit'}</span>
          </button>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-700">
            steady state only
          </span>
        </figcaption>
        {description && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
        <p className="mt-2 text-xs text-slate-700 dark:text-slate-200">
          {`Steady state (${at}): `}
          <span className="font-semibold tabular-nums">{Number.isFinite(last) ? fmtExact(last) : '—'}</span>
          {band && Number.isFinite(band.p5[lastIndex]) && <span className="tabular-nums text-slate-500 dark:text-slate-400">{` [p5 ${fmtCompact(band.p5[lastIndex])}, p95 ${fmtCompact(band.p95[lastIndex])}]`}</span>}
          {showBaseline && Number.isFinite(base) && <span className="text-slate-500 dark:text-slate-400">{` · ${baselineLabel}: ${fmtExact(base as number)}`}</span>}
        </p>
        <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">
          <span className="font-semibold">No transition chart:</span> {steadyState.reason}
        </p>
        {steadyState.entities && steadyState.entities.length > 1 && (
          <div className="mt-2 overflow-x-auto">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{`Steady-state ${id} (${at}) by ${steadyState.entityKind ?? 'entity'}:`}</p>
            <table className="text-[11px] tabular-nums text-slate-600 dark:text-slate-300">
              <tbody>
                {steadyState.entities.map((e) => (
                  <tr key={e.entity} className={e.selected ? 'font-semibold text-sky-800 dark:text-sky-200' : ''}>
                    <td className="pr-3 font-mono whitespace-nowrap">{e.entity}</td>
                    <td className="text-right">{Number.isFinite(e.value) ? fmtExact(e.value) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </figure>
    );
  }

  return (
    <figure
      className={`bg-white dark:bg-slate-900 border rounded-xl p-3 ${
        selected ? 'border-sky-400 dark:border-sky-600 ring-1 ring-sky-200 dark:ring-sky-900' : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <button
          type="button"
          onClick={() => onSelect(id)}
          aria-pressed={selected}
          className="min-h-11 text-left text-sm font-semibold text-slate-800 dark:text-white hover:text-sky-700 dark:hover:text-sky-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
        >
          <span className="font-mono break-all">{id}</span>
          <span className="ml-2 font-sans text-[11px] font-normal text-slate-500 dark:text-slate-400">
            {unit || 'no unit'}
            {selectNote ?? (selected ? ' · explained below' : ' · tap to explain')}
          </span>
        </button>
        <span className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
          {timeLabel(time, years[years.length - 1])}: {Number.isFinite(last) ? fmtExact(last) : '—'}
        </span>
      </figcaption>
      {description && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
      <div className="h-44 w-full mt-1 text-slate-500 dark:text-slate-400">
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={data} margin={{ top: 6, right: 8, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
            <XAxis dataKey="year" tick={AXIS} tickLine={false} axisLine={false} minTickGap={16} tickFormatter={timeTick}>
              {time?.stepLabel && <Label value={timeAxisTitle(time)} position="insideBottomRight" offset={-2} style={{ fontSize: 10, fill: 'currentColor' }} />}
            </XAxis>
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={54} tickFormatter={fmtCompact}>
              <Label value={unit || id} angle={-90} position="insideLeft" style={{ fontSize: 11, fill: 'currentColor' }} />
            </YAxis>
            <Tooltip
              contentStyle={{ fontSize: 11 }}
              labelFormatter={(v: any) => timeLabel(time, Number(v))}
              formatter={(v: any) => (Array.isArray(v) ? `${fmtCompact(v[0])} – ${fmtCompact(v[1])}` : fmtExact(Number(v)))}
            />
            {markYear !== undefined && <ReferenceLine x={markYear} stroke="#0ea5e9" strokeDasharray="2 3" />}
            {band && (
              <Area
                dataKey="band"
                stroke="none"
                fill="#0ea5e9"
                fillOpacity={0.16}
                isAnimationActive={false}
                name="p5–p95"
              />
            )}
            {showBaseline && baseline && (
              <Line
                type="monotone"
                dataKey="baseline"
                stroke="#94a3b8"
                strokeDasharray="4 3"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                name={baselineLabel}
              />
            )}
            <Line
              type="monotone"
              dataKey="current"
              stroke="#0284c7"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              name={currentLabel}
            />
          </Chart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
        <span>
          <span className="inline-block w-4 border-t-2 border-sky-600 align-middle mr-1" />
          {currentLabel}
        </span>
        {showBaseline && (
          <span>
            <span className="inline-block w-4 border-t-2 border-dashed border-slate-400 align-middle mr-1" />
            {baselineLabel}
          </span>
        )}
        {band && (
          <span>
            <span className="inline-block w-4 h-2 bg-sky-500/20 align-middle mr-1" />
            p5–p95 band
            <Hint
              label="p5–p95 band"
              text="The spread from the declared parameter ranges only. It is not a forecast interval: it ignores whether the equations are right, and anything with no declared range contributes nothing to it."
              align="right"
            />
          </span>
        )}
      </div>
    </figure>
  );
};

export default OutputChart;

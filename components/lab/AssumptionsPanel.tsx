/**
 * AssumptionsPanel — every number this model rests on, in one list, with where it came from.
 *
 * The count at the top ("N of M parameters are assumptions") is the honest headline: most of these
 * fixtures are mostly guesses, and the panel says so before anyone reads a chart. Editing a value
 * never touches the model file — it becomes a parameter overlay (see labState.parameterOverlay).
 *
 * Inputs are exogenous curves; v0 shows them read-only as a sparkline plus their keyed points.
 */

import React from 'react';
import { RotateCcw } from 'lucide-react';
import type { CoreModel, Input, Parameter } from '../../src/core/types';
import { Hint, HintedLabel } from '../futures/Hint';
import { countAssumptions, fmtCompact, fmtExact, sliderBounds, sourceStyle, sparklinePoints } from './labState';

export interface AssumptionsPanelProps {
  model: CoreModel;
  /** Value actually used by the current run, per parameter id. */
  values: Record<string, number>;
  /** Ids the user has edited away from the model's own value. */
  edited: Set<string>;
  onEdit: (id: string, value: number) => void;
  onResetAll: () => void;
  /** Interpolated series per input id, from the run. */
  inputSeries: Record<string, number[]>;
  years: number[];
}

const SourceChip: React.FC<{ parameter: Parameter }> = ({ parameter }) => {
  const style = sourceStyle(parameter.source);
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${style.chip}`}>
        {style.label}
        {style.assumption ? ' · assumption' : ''}
      </span>
      <Hint label={style.label} text={`${style.meaning} Source given: ${parameter.source?.label || 'none'}.`} align="right" />
    </span>
  );
};

const ParameterRow: React.FC<{
  parameter: Parameter;
  value: number;
  isEdited: boolean;
  onEdit: (id: string, value: number) => void;
}> = ({ parameter, value, isEdited, onEdit }) => {
  const bounds = sliderBounds(parameter, value);
  const inputId = `lab-param-${parameter.id}`;
  return (
    <div className="py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <HintedLabel
          className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-100 break-all"
          htmlFor={inputId}
          label={parameter.id}
          hint={`${parameter.source?.label || 'no source given'}${parameter.source?.note ? ` — ${parameter.source.note}` : ''}${
            parameter.range ? ` Declared range p5-p95: ${fmtCompact(parameter.range.p5)} to ${fmtCompact(parameter.range.p95)} (${parameter.range.dist}).` : ''
          }`}
        />
        <SourceChip parameter={parameter} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <input
          id={inputId}
          type="number"
          className="h-11 w-32 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          value={Number.isFinite(value) ? value : ''}
          step="any"
          onChange={(e) => onEdit(parameter.id, Number(e.target.value))}
        />
        <span className="text-[11px] text-slate-500 dark:text-slate-400">{parameter.unit || 'no unit'}</span>
        {isEdited && (
          <span className="text-[11px] font-medium text-sky-700 dark:text-sky-300">edited · yours</span>
        )}
      </div>
      {bounds && (
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500 w-12 shrink-0 text-right">
            {fmtCompact(parameter.range!.p5)}
          </span>
          <input
            type="range"
            aria-label={`${parameter.id} between its declared p5 and p95`}
            className="flex-1 min-w-0 h-11 accent-sky-600"
            min={bounds.min}
            max={bounds.max}
            step={bounds.step}
            value={value}
            onChange={(e) => onEdit(parameter.id, Number(e.target.value))}
          />
          <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500 w-12 shrink-0">
            {fmtCompact(parameter.range!.p95)}
          </span>
        </div>
      )}
    </div>
  );
};

const InputRow: React.FC<{ input: Input; series?: number[]; years: number[] }> = ({ input, series, years }) => {
  const points = series && series.length ? sparklinePoints(series, 120, 28) : '';
  const keys = Object.keys(input.curve).sort((a, b) => Number(a) - Number(b));
  return (
    <div className="py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-100 break-all">
          {input.id}
          <span className="ml-2 font-sans font-normal text-[11px] text-slate-500 dark:text-slate-400">
            {input.unit || 'no unit'} · {input.interp ?? 'linear'} · read-only in v0
          </span>
        </span>
        {points && (
          <svg
            width={120}
            height={28}
            viewBox="0 0 120 28"
            className="shrink-0"
            role="img"
            aria-label={`${input.id} from ${years[0]} to ${years[years.length - 1]}`}
          >
            <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-sky-600 dark:text-sky-400" />
          </svg>
        )}
      </div>
      <div className="mt-1 overflow-x-auto">
        <table className="text-[11px] tabular-nums text-slate-600 dark:text-slate-300">
          <tbody>
            <tr>
              {keys.map((k) => (
                <th key={k} scope="col" className="pr-3 text-left font-medium text-slate-400 dark:text-slate-500">
                  {k}
                </th>
              ))}
            </tr>
            <tr>
              {keys.map((k) => (
                <td key={k} className="pr-3">
                  {fmtExact(input.curve[k])}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AssumptionsPanel: React.FC<AssumptionsPanelProps> = ({
  model,
  values,
  edited,
  onEdit,
  onResetAll,
  inputSeries,
  years,
}) => {
  const count = countAssumptions(model.parameters);
  const inputs = model.inputs ?? [];
  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
            Assumptions
            <Hint
              label="Assumptions"
              text="Every number the model rests on. The chip says what kind of claim it is: measured, fitted, elicited, or simply chosen. Editing a value here does not change the model file — it is layered on top as your own overlay."
            />
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{count.text}</span>
            {count.assumptions > 0 ? ' — treat anything downstream of them as illustrative.' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onResetAll}
          disabled={edited.size === 0}
          className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <RotateCcw size={14} aria-hidden="true" />
          Reset values
        </button>
      </div>

      <div className="mt-2">
        {model.parameters.map((p) => (
          <ParameterRow
            key={p.id}
            parameter={p}
            value={values[p.id] ?? p.value}
            isEdited={edited.has(p.id)}
            onEdit={onEdit}
          />
        ))}
      </div>

      {inputs.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            Inputs (exogenous curves)
            <Hint
              label="Inputs"
              text="Paths the model is told, not ones it works out: a budget, an adoption share. They are read-only here in v0; change one by adding an overlay."
            />
          </h4>
          <div className="mt-1">
            {inputs.map((i) => (
              <InputRow key={i.id} input={i} series={inputSeries[i.id]} years={years} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default AssumptionsPanel;

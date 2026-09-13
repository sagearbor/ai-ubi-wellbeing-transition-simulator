/**
 * BindingPanel — "what limits the result", the answer to "why doesn't more money help".
 *
 * Every min()/max() the engine evaluated recorded which argument was active at each step. For the
 * training fixture at $20M that reads, in order down the chain:
 *     completions is limited by instructor_capacity
 *     placements is limited by suitable_openings
 * When the active argument is a bare parameter, the panel offers to relax it by +25% — as a
 * hypothetical, under a banner that says creating that headroom is its own problem with its own
 * cost and evidence. It is not a policy and the panel refuses to let it read like one.
 */

import React from 'react';
import { FlaskConical, X } from 'lucide-react';
import type { CoreModel, RunResult } from '../../src/core/types';
import { Hint } from '../futures/Hint';
import { bindingChain, fmtDelta, fmtExact, hypotheticalBanner, type Hypothetical } from './labState';

export interface BindingPanelProps {
  model: CoreModel;
  result: RunResult;
  entity: string;
  selectedOutput: string;
  /** Step index the panel is scrubbed to. */
  step: number;
  onStep: (step: number) => void;
  /** Parameter values of the current run, so a relax starts from what is actually in force. */
  paramValues: Record<string, number>;
  hypothetical: Hypothetical | null;
  /** Change in the selected output at the scrubbed step caused by the hypothetical. */
  hypotheticalDelta: number | null;
  onRelax: (parameter: string, current: number) => void;
  onClearHypothetical: () => void;
}

const BindingPanel: React.FC<BindingPanelProps> = ({
  model,
  result,
  entity,
  selectedOutput,
  step,
  onStep,
  paramValues,
  hypothetical,
  hypotheticalDelta,
  onRelax,
  onClearHypothetical,
}) => {
  const years = result.years;
  const year = years[step];
  const groups = bindingChain(model, result, entity, selectedOutput, step);
  const chain = groups.filter((g) => g.depth !== null);
  const rest = groups.filter((g) => g.depth === null);

  const renderGroup = (inChain: boolean) => (g: (typeof groups)[number]) => (
    <li
      key={g.variable}
      className={`rounded-lg border px-2.5 py-2 ${
        inChain
          ? 'border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40'
          : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40'
      }`}
    >
      {g.lines.map((line, i) => (
        <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs text-slate-800 dark:text-slate-100 break-words">
            {g.depth === 0 && <span className="text-[11px] font-semibold text-sky-700 dark:text-sky-300 mr-1">output ·</span>}
            {g.depth !== null && g.depth > 0 && (
              <span className="text-[11px] font-semibold text-sky-700 dark:text-sky-300 mr-1">feeds it ·</span>
            )}
            <span className="font-mono">{line.text}</span>
          </span>
          {line.relaxParameter && (
            <button
              type="button"
              onClick={() => onRelax(line.relaxParameter as string, paramValues[line.relaxParameter as string])}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-amber-400 dark:border-amber-700 px-2.5 text-[11px] font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <FlaskConical size={13} aria-hidden="true" />
              Try relaxing it (hypothetical)
            </button>
          )}
        </div>
      ))}
    </li>
  );

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
        What limits the result
        <Hint
          label="What limits the result"
          text='Where the model takes a min() or max(), one argument is the one that actually decides the answer. "limited by X" means that at this year, raising anything else changes nothing until X moves.'
        />
      </h3>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
        For <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{selectedOutput}</span> in{' '}
        <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{year}</span>. Tap another chart above to
        switch output.
      </p>

      <div className="mt-2 flex items-center gap-2">
        <label className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0" htmlFor="lab-year">
          Year
        </label>
        <input
          id="lab-year"
          type="range"
          className="flex-1 min-w-0 h-11 accent-sky-600"
          min={0}
          max={Math.max(0, years.length - 1)}
          step={1}
          value={step}
          onChange={(e) => onStep(Number(e.target.value))}
        />
        <span className="text-xs tabular-nums font-semibold text-slate-700 dark:text-slate-200 w-12 text-right shrink-0">{year}</span>
      </div>

      {groups.length === 0 ? (
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
          Nothing in this model rations anything: there is no min() or max() in its equations, so no constraint binds. Every
          output moves smoothly with every input.
        </p>
      ) : (
        <>
          <ul className="mt-2 space-y-1.5">{chain.map(renderGroup(true))}</ul>
          {rest.length > 0 && (
            <>
              <h4 className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Elsewhere in the model
              </h4>
              <ul className="mt-1 space-y-1.5">{rest.map(renderGroup(false))}</ul>
            </>
          )}
        </>
      )}

      {hypothetical && (
        <div className="mt-3 rounded-lg border-2 border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/50 px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-100 break-words">
              {hypotheticalBanner(hypothetical)}
            </p>
            <button
              type="button"
              onClick={onClearHypothetical}
              aria-label="Drop the hypothetical"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="text-[11px] tabular-nums text-amber-900 dark:text-amber-100">
            {hypothetical.parameter}: {fmtExact(hypothetical.from)} → {fmtExact(hypothetical.to)}.{' '}
            {hypotheticalDelta === null ? (
              'The hypothetical run did not complete — see diagnostics.'
            ) : (
              <>
                <span className="font-semibold">{selectedOutput}</span> in {year} moves {fmtDelta(hypotheticalDelta)}
                {hypotheticalDelta === 0 ? ' — something else is binding' : ''}.
              </>
            )}
          </p>
        </div>
      )}
    </section>
  );
};

export default BindingPanel;

/**
 * DiagnosticsPanel / TestsPanel — the "failures are explicit" half of the stage-2 acceptance.
 *
 * Every Diagnostic the engine produced is shown with its code, message and the element it is
 * about; nothing is swallowed. The tests panel shows the model's own reproduction tests with the
 * actual number next to the expected one, so a near-miss is visible rather than just "failed".
 */

import React from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { Diagnostic, TestOutcome } from '../../src/core/types';
import { Hint } from '../futures/Hint';
import { fmtExact } from './labState';

export interface DiagnosticsPanelProps {
  diagnostics: Diagnostic[];
}

const LEVEL: Record<Diagnostic['level'], { row: string; icon: React.ReactNode; word: string }> = {
  error: {
    row: 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40',
    icon: <XCircle size={14} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />,
    word: 'error',
  },
  warning: {
    row: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40',
    icon: <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />,
    word: 'warning',
  },
};

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({ diagnostics }) => {
  const errors = diagnostics.filter((d) => d.level === 'error').length;
  const warnings = diagnostics.length - errors;
  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
        Diagnostics
        <Hint
          label="Diagnostics"
          text="What the engine found while resolving and compiling this model: unknown names, cycles, unit mismatches, numbers that stopped being finite. Errors stop the run; warnings do not."
        />
      </h3>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
        {diagnostics.length === 0
          ? 'No diagnostics. The model resolved, compiled and ran.'
          : `${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}.`}
      </p>
      {diagnostics.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {diagnostics.map((d, i) => (
            <li
              key={`${d.code}-${d.where ?? ''}-${i}`}
              className={`flex gap-2 items-start border rounded-lg px-2.5 py-2 ${LEVEL[d.level].row}`}
            >
              {LEVEL[d.level].icon}
              <div className="min-w-0">
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  {LEVEL[d.level].word} · {d.code}
                  {d.where ? ` · ${d.where}` : ''}
                  {d.entity && d.entity !== '_' ? ` · ${d.entity}` : ''}
                  {d.step !== undefined ? ` · step ${d.step}` : ''}
                </div>
                <div className="text-xs text-slate-800 dark:text-slate-100 break-words">{d.message}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export interface TestsPanelProps {
  outcomes: TestOutcome[];
}

export const TestsPanel: React.FC<TestsPanelProps> = ({ outcomes }) => {
  const passed = outcomes.filter((o) => o.passed).length;
  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
        Reproduction tests
        <Hint
          label="Reproduction tests"
          text="Numbers the model's author says it must reproduce, checked against this run. A failing test means the model no longer matches the table it was written from — including after your edits."
        />
      </h3>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
        {outcomes.length === 0
          ? 'This model declares no tests.'
          : `${passed} of ${outcomes.length} passing, as currently parameterised.`}
      </p>
      {outcomes.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {outcomes.map((o, i) => (
            <li
              key={`${o.name}-${i}`}
              className={`flex gap-2 items-start border rounded-lg px-2.5 py-2 ${
                o.passed
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
                  : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
              }`}
            >
              {o.passed ? (
                <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <XCircle size={14} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <div className="text-xs text-slate-800 dark:text-slate-100 break-words">{o.name}</div>
                <div className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300 break-words">
                  actual {o.actual === null ? 'n/a' : fmtExact(o.actual)} · expected {fmtExact(o.expected)} ± {fmtExact(o.tol)}
                </div>
                {!o.passed && <div className="text-[11px] text-rose-700 dark:text-rose-300 break-words">{o.message}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default DiagnosticsPanel;

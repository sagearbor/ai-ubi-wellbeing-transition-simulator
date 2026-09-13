import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { EquationError } from '../src/services/equationParser';

interface Props {
  modelName: string;
  errors: EquationError[];
  onClear?: () => void;
}

/**
 * Shown next to the timeline when the active custom model's equations do not compile.
 *
 * Audit 2026-09-13, finding A5: the app used to fall back to the built-in engine while the
 * broken model stayed selected and labelled, so a user was shown results that their equations
 * had not produced. The simulation now refuses to step and says why.
 */
const EquationErrorBanner: React.FC<Props> = ({ modelName, errors, onClear }) => {
  if (errors.length === 0) return null;
  return (
    <div
      role="alert"
      className="mb-3 rounded-xl border-2 border-rose-400 dark:border-rose-600 bg-rose-50 dark:bg-rose-900/30 px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-black uppercase tracking-widest text-rose-700 dark:text-rose-300">
            Custom model &ldquo;{modelName}&rdquo; cannot run: {errors.length} equation{' '}
            {errors.length === 1 ? 'error' : 'errors'}
          </div>
          <ul className="mt-2 space-y-1">
            {errors.map((e, i) => (
              <li key={`${String(e.equation)}-${i}`} className="text-[11px] leading-relaxed text-rose-800 dark:text-rose-200">
                <span className="font-mono font-bold">{String(e.equation)}</span>: {e.error}
                {e.suggestion && (
                  <span className="block opacity-80 font-mono break-words">{e.suggestion}</span>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-2 text-[11px] text-rose-700 dark:text-rose-300">
            Playback is disabled. The built-in engine is not used as a substitute - fix the
            equations in the Models tab, or clear the custom model.
          </div>
        </div>
        {onClear && (
          <button
            onClick={onClear}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold uppercase tracking-widest"
          >
            Clear Model
          </button>
        )}
      </div>
    </div>
  );
};

export default EquationErrorBanner;

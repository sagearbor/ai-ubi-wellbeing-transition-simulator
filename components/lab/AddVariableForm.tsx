/**
 * AddVariableForm — the stage-2 acceptance test, as a form.
 *
 * Declare one new exogenous input as a two-point curve, then one or two effects that carry it into
 * existing equations. Applying builds an Overlay object in React state and adds it to the active
 * overlays: the new variable reaches two equations with no edit to the base model file and no edit
 * to this app. Effects attach to hooks; replacing an equation is a structural fork and the engine
 * rejects it, which is why there is no "edit equation" field here.
 */

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { CoreModel, EvidenceKind, Overlay } from '../../src/core/types';
import { Hint, HintedLabel } from '../futures/Hint';
import {
  ALL_KINDS,
  applyOverlayForm,
  emptyOverlayForm,
  hookableVariables,
  renameSymbol,
  SOURCE_STYLES,
  type EffectForm,
  type OverlayForm,
} from './labState';

export interface AddVariableFormProps {
  /** The model as currently resolved, so targets and id collisions are checked against it. */
  model: CoreModel;
  onApply: (overlay: Overlay) => void;
  /** Overlays this form has already added, so they can be removed again. */
  applied: Overlay[];
  onRemove: (id: string) => void;
}

const FIELD =
  'h-11 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';
const LABEL = 'block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-0.5';

const AddVariableForm: React.FC<AddVariableFormProps> = ({ model, onApply, applied, onRemove }) => {
  const [form, setForm] = useState<OverlayForm>(() => emptyOverlayForm(model));
  const [errors, setErrors] = useState<string[]>([]);
  const targets = hookableVariables(model);

  const set = <K extends keyof OverlayForm>(key: K, value: OverlayForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  // Renaming the input carries the expressions that used it, so the default effects keep working.
  const setInputId = (next: string) =>
    setForm((f) => ({
      ...f,
      inputId: next,
      effects: f.effects.map((e) => ({ ...e, expr: renameSymbol(e.expr, f.inputId, next) })),
    }));
  const setEffect = (i: number, patch: Partial<EffectForm>) =>
    setForm((f) => ({ ...f, effects: f.effects.map((e, j) => (j === i ? { ...e, ...patch } : e)) }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const { overlay, errors: errs } = applyOverlayForm(form, model);
    setErrors(errs);
    if (overlay) {
      onApply(overlay);
      setErrors([]);
    }
  };

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
        Add a variable
        <Hint
          label="Add a variable"
          text="Declare a new exogenous input and attach it to existing equations as effects. This writes an overlay, so the base model file is untouched and the change is reversible — and it needs no change to this app."
        />
      </h3>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
        One new input, one or two effects. Effects add to, or multiply, the variable they attach to; they never replace its
        equation.
      </p>

      <form onSubmit={submit} className="mt-2 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <HintedLabel
              className={LABEL}
              htmlFor="lab-new-id"
              label="New input id"
              hint="The name your effects will use, e.g. aiTutoringAccess. Letters, digits and underscore; it must not already exist in the model."
            />
            <input id="lab-new-id" className={`${FIELD} font-mono`} value={form.inputId} onChange={(e) => setInputId(e.target.value)} />
          </div>
          <div>
            <HintedLabel className={LABEL} htmlFor="lab-new-unit" label="Unit" hint="What the number is measured in: share, usd, people. Blank means dimensionless." />
            <input id="lab-new-unit" className={FIELD} value={form.unit} onChange={(e) => set('unit', e.target.value)} />
          </div>
        </div>

        <fieldset className="border border-slate-200 dark:border-slate-800 rounded-lg p-2">
          <legend className="px-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
            Curve (two points, interpolated between)
            <Hint label="Curve" text="The path the input follows: its value at a start year and at an end year. Outside that span the end values are held." />
          </legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className={LABEL} htmlFor="lab-new-sy">Start year</label>
              <input id="lab-new-sy" type="number" className={`${FIELD} tabular-nums`} value={form.startYear} onChange={(e) => set('startYear', Number(e.target.value))} />
            </div>
            <div>
              <label className={LABEL} htmlFor="lab-new-sv">Start value</label>
              <input id="lab-new-sv" type="number" step="any" className={`${FIELD} tabular-nums`} value={form.startValue} onChange={(e) => set('startValue', Number(e.target.value))} />
            </div>
            <div>
              <label className={LABEL} htmlFor="lab-new-ey">End year</label>
              <input id="lab-new-ey" type="number" className={`${FIELD} tabular-nums`} value={form.endYear} onChange={(e) => set('endYear', Number(e.target.value))} />
            </div>
            <div>
              <label className={LABEL} htmlFor="lab-new-ev">End value</label>
              <input id="lab-new-ev" type="number" step="any" className={`${FIELD} tabular-nums`} value={form.endValue} onChange={(e) => set('endValue', Number(e.target.value))} />
            </div>
          </div>
        </fieldset>

        {form.effects.map((eff, i) => (
          <fieldset key={i} className="border border-slate-200 dark:border-slate-800 rounded-lg p-2">
            <legend className="px-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
              Effect {i + 1}
              <Hint
                label={`Effect ${i + 1}`}
                text="Where the new input lands. 'add' is summed into the target variable in the target's own unit; 'multiply' scales it and must be dimensionless."
              />
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className={LABEL} htmlFor={`lab-eff-target-${i}`}>Target variable</label>
                <select id={`lab-eff-target-${i}`} className={FIELD} value={eff.target} onChange={(e) => setEffect(i, { target: e.target.value })}>
                  {targets.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.id}
                      {v.unit ? ` (${v.unit})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor={`lab-eff-op-${i}`}>Operation</label>
                <select id={`lab-eff-op-${i}`} className={FIELD} value={eff.op} onChange={(e) => setEffect(i, { op: e.target.value as EffectForm['op'] })}>
                  <option value="add">add</option>
                  <option value="multiply">multiply</option>
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor={`lab-eff-unit-${i}`}>Effect unit</label>
                <input id={`lab-eff-unit-${i}`} className={FIELD} value={eff.unit} onChange={(e) => setEffect(i, { unit: e.target.value })} />
              </div>
            </div>
            <div className="mt-2">
              <HintedLabel
                className={LABEL}
                htmlFor={`lab-eff-expr-${i}`}
                label="Expression"
                hint="Maths over the model's parameters, inputs and variables — your new input included. Unknown names are reported as diagnostics rather than guessed at."
              />
              <input id={`lab-eff-expr-${i}`} className={`${FIELD} font-mono`} value={eff.expr} onChange={(e) => setEffect(i, { expr: e.target.value })} />
            </div>
            {form.effects.length > 1 && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, effects: f.effects.filter((_, j) => j !== i) }))}
                className="mt-1 inline-flex min-h-11 items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
              >
                <Trash2 size={13} aria-hidden="true" /> Remove effect {i + 1}
              </button>
            )}
          </fieldset>
        ))}

        {form.effects.length < 2 && (
          <button
            type="button"
            onClick={() =>
              setForm((f) => ({
                ...f,
                effects: [...f.effects, { target: targets[Math.min(1, targets.length - 1)]?.id ?? '', op: 'add', expr: `0.1 * ${f.inputId}`, unit: '' }],
              }))
            }
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Plus size={14} aria-hidden="true" /> Add a second effect
          </button>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <HintedLabel className={LABEL} htmlFor="lab-src-label" label="Source label" hint="Where these numbers come from. 'author guess' is an honest answer and is what the chip will say." />
            <input id="lab-src-label" className={FIELD} value={form.sourceLabel} onChange={(e) => set('sourceLabel', e.target.value)} />
          </div>
          <div>
            <HintedLabel className={LABEL} htmlFor="lab-src-kind" label="Source kind" hint="What kind of claim it is. Guess and assumed are shown grey and labelled as assumptions everywhere they appear." />
            <select id="lab-src-kind" className={FIELD} value={form.sourceKind} onChange={(e) => set('sourceKind', e.target.value as EvidenceKind)}>
              {ALL_KINDS.map((k) => (
                <option key={k} value={k}>
                  {SOURCE_STYLES[k].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {errors.length > 0 && (
          <ul className="rounded-lg border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 px-3 py-2 space-y-0.5">
            {errors.map((e) => (
              <li key={e} className="text-xs text-rose-800 dark:text-rose-200">
                {e}
              </li>
            ))}
          </ul>
        )}

        <button
          type="submit"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          Apply as an overlay
        </button>
      </form>

      {applied.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Your overlays</h4>
          <ul className="mt-1 space-y-1">
            {applied.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-slate-700 dark:text-slate-200 break-all">
                  {o.id}
                  <span className="ml-2 font-sans text-[11px] text-slate-500 dark:text-slate-400">
                    {(o.effects ?? []).length} effect{(o.effects ?? []).length === 1 ? '' : 's'} · yours
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(o.id)}
                  aria-label={`Remove overlay ${o.id}`}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default AddVariableForm;

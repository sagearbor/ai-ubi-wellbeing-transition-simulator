/**
 * labState — every piece of Model Lab logic that is not JSX, so it can be tested without a DOM.
 *
 * The lab never mutates a base model. Everything the user does becomes an *overlay*:
 *   - editing a parameter      -> `lab-parameter-edits` (an overlay that re-assigns values)
 *   - "try relaxing it"        -> `lab-hypothetical`    (one parameter, +25%, clearly labelled)
 *   - "add a variable"         -> `lab-<inputId>`       (a new input plus one or two effects)
 * That is the stage-2 acceptance test: a new variable reaches two equations with no app edits and
 * no rewrite of the base model file.
 */

import type {
  CoreModel,
  Diagnostic,
  EvidenceKind,
  Overlay,
  Parameter,
  RunResult,
  Source,
  Variable,
} from '../../src/core/types';
import { explainBinding } from '../../src/core/engine';

// ---------------------------------------------------------------------------
// Evidence chips
// ---------------------------------------------------------------------------

export interface SourceStyle {
  /** Word shown on the chip. */
  label: string;
  /** Tailwind classes for the chip. */
  chip: string;
  /** Plain-English meaning, used as the chip's hint. */
  meaning: string;
  /** True when the number is somebody's judgement rather than a measurement. */
  assumption: boolean;
}

export const SOURCE_STYLES: Record<EvidenceKind, SourceStyle> = {
  causal: {
    label: 'causal',
    chip: 'bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:ring-emerald-700',
    meaning: 'From a study designed to support a cause-and-effect claim (trial, quasi-experiment).',
    assumption: false,
  },
  associational: {
    label: 'associational',
    chip: 'bg-sky-100 text-sky-800 ring-sky-300 dark:bg-sky-900/40 dark:text-sky-200 dark:ring-sky-700',
    meaning: 'A measured relationship, not a demonstrated cause. Moving the input may not move the output.',
    assumption: false,
  },
  calibrated: {
    label: 'calibrated',
    chip: 'bg-teal-100 text-teal-800 ring-teal-300 dark:bg-teal-900/40 dark:text-teal-200 dark:ring-teal-700',
    meaning: 'Chosen so the model reproduces something already observed. It carries the fit, not new evidence.',
    assumption: false,
  },
  elicited: {
    label: 'elicited',
    chip: 'bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-700',
    meaning: 'A considered judgement from people in the field, recorded as a number.',
    assumption: false,
  },
  assumed: {
    label: 'assumed',
    chip: 'bg-slate-200 text-slate-700 ring-slate-300 dark:bg-slate-700/60 dark:text-slate-200 dark:ring-slate-600',
    meaning: 'Set by the author to make the model run. Nothing measured it.',
    assumption: true,
  },
  guess: {
    label: 'guess',
    chip: 'bg-slate-200 text-slate-700 ring-slate-300 dark:bg-slate-700/60 dark:text-slate-200 dark:ring-slate-600',
    meaning: 'A round number picked by the author. Treat every result that depends on it as illustrative.',
    assumption: true,
  },
};

export const ALL_KINDS: EvidenceKind[] = ['causal', 'associational', 'calibrated', 'elicited', 'assumed', 'guess'];

/** Types default to 'assumed' when a source omits its kind (see types.ts). */
export function sourceKind(source?: Source): EvidenceKind {
  const k = source?.kind;
  return k && SOURCE_STYLES[k] ? k : 'assumed';
}

export function sourceStyle(source?: Source): SourceStyle {
  return SOURCE_STYLES[sourceKind(source)];
}

export function countAssumptions(parameters: Parameter[]): { assumptions: number; total: number; text: string } {
  const assumptions = parameters.filter((p) => sourceStyle(p.source).assumption).length;
  const total = parameters.length;
  return { assumptions, total, text: `${assumptions} of ${total} parameters are assumptions` };
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

const COMPACT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });
const EXACT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 });

/** Short form for axis ticks and tiles: 6000000 -> "6M". */
export function fmtCompact(x: number): string {
  if (!Number.isFinite(x)) return String(x);
  if (x !== 0 && Math.abs(x) < 0.001) return x.toExponential(1);
  return COMPACT.format(x);
}

/** Full form for editable fields and tables. */
export function fmtExact(x: number): string {
  if (!Number.isFinite(x)) return String(x);
  return EXACT.format(x);
}

export function fmtDelta(x: number): string {
  if (!Number.isFinite(x)) return String(x);
  return `${x > 0 ? '+' : ''}${fmtCompact(x)}`;
}

/** Points for a tiny read-only sparkline over a fixed box. */
export function sparklinePoints(values: number[], w: number, h: number, pad = 2): string {
  if (!values.length) return '';
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const stepX = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  return values
    .map((v, i) => `${(pad + i * stepX).toFixed(1)},${(h - pad - ((v - lo) / span) * (h - pad * 2)).toFixed(1)}`)
    .join(' ');
}

/** Slider span for a parameter: its declared p5..p95, widened a little so the point value fits. */
export function sliderBounds(p: Parameter, current: number): { min: number; max: number; step: number } | null {
  if (!p.range) return null;
  let min = Math.min(p.range.p5, current);
  let max = Math.max(p.range.p95, current);
  if (!(max > min)) return null;
  const pad = (max - min) * 0.05;
  min -= pad;
  max += pad;
  if (p.bounds) {
    min = Math.max(p.bounds[0], min);
    max = Math.min(p.bounds[1], max);
  }
  return { min, max, step: (max - min) / 200 };
}

// ---------------------------------------------------------------------------
// Overlays the lab builds
// ---------------------------------------------------------------------------

export const PARAM_OVERLAY_ID = 'lab-parameter-edits';
export const HYPOTHETICAL_OVERLAY_ID = 'lab-hypothetical';

/**
 * Turn the edited-value map into an overlay. Only ids the resolved model already knows are
 * included (an id from an overlay the user has since switched off would otherwise be resolved as a
 * brand-new parameter without a source), and only values that actually differ.
 */
export function parameterOverlay(edits: Record<string, number>, baseValues: Map<string, number>): Overlay | null {
  const parameters = Object.entries(edits)
    .filter(([id, v]) => baseValues.has(id) && Number.isFinite(v) && v !== baseValues.get(id))
    .map(([id, value]) => ({ id, value }));
  if (!parameters.length) return null;
  return { id: PARAM_OVERLAY_ID, name: 'Your parameter edits', parameters };
}

export interface Hypothetical {
  parameter: string;
  /** Fractional bump, 0.25 = +25%. */
  pct: number;
  from: number;
  to: number;
}

export function makeHypothetical(parameter: string, current: number, pct = 0.25): Hypothetical {
  return { parameter, pct, from: current, to: current * (1 + pct) };
}

export function hypotheticalOverlay(h: Hypothetical): Overlay {
  return {
    id: HYPOTHETICAL_OVERLAY_ID,
    name: `Hypothetical: ${h.parameter} ${h.pct >= 0 ? '+' : ''}${Math.round(h.pct * 100)}%`,
    parameters: [{ id: h.parameter, value: h.to }],
  };
}

/** The banner the hypothetical must carry, so nobody mistakes it for a policy. */
export function hypotheticalBanner(h: Hypothetical): string {
  const pct = `${h.pct >= 0 ? '+' : ''}${Math.round(h.pct * 100)}%`;
  return `HYPOTHETICAL: ${h.parameter} ${pct}; creating that headroom needs its own mechanism, cost and evidence.`;
}

// ---------------------------------------------------------------------------
// "What limits the result"
// ---------------------------------------------------------------------------

const ID_RE = /[A-Za-z_]\w*/g;

/** Ids from `known` that appear as bare words in an expression. */
export function referencedIds(expression: string, known: Set<string>): string[] {
  const out = new Set<string>();
  for (const word of expression.match(ID_RE) ?? []) if (known.has(word)) out.add(word);
  return [...out];
}

/**
 * How far each variable sits from `root` along the dependency chain (root = 0, its own inputs = 1,
 * theirs = 2 …). Effects attached to a variable count as part of that variable's inputs.
 */
export function dependencyDepths(model: CoreModel, root: string): Map<string, number> {
  const varIds = new Set(model.variables.map((v) => v.id));
  const byId = new Map(model.variables.map((v) => [v.id, v] as const));
  const depth = new Map<string, number>([[root, 0]]);
  const queue: string[] = [root];
  while (queue.length) {
    const cur = queue.shift() as string;
    const d = depth.get(cur) as number;
    const v = byId.get(cur);
    if (!v) continue;
    const sources = [v.equation, typeof v.initial === 'string' ? v.initial : '']
      .concat((model.effects ?? []).filter((e) => e.target === cur).map((e) => e.expr))
      .join(' ');
    for (const dep of referencedIds(sources, varIds)) {
      if (dep === cur || depth.has(dep)) continue;
      depth.set(dep, d + 1);
      queue.push(dep);
    }
  }
  return depth;
}

export interface BindingLine {
  variable: string;
  /** e.g. "placements is limited by suitable_openings" */
  text: string;
  fn: 'min' | 'max';
  /** Source text of the argument that bound, or null if the call was not reached. */
  activeArg: string | null;
  /** Set when the binding argument is a bare parameter, so it can be relaxed hypothetically. */
  relaxParameter: string | null;
}

export interface BindingGroup {
  variable: string;
  /** Distance from the selected output; null when the variable is not on its chain. */
  depth: number | null;
  lines: BindingLine[];
}

/**
 * Every variable with a min()/max() record, ordered so the selected output comes first, then the
 * things it is built from, then the rest of the model.
 */
export function bindingChain(
  model: CoreModel,
  result: RunResult,
  entity: string,
  output: string,
  t: number,
): BindingGroup[] {
  const records = result.binding?.[entity] ?? {};
  const depths = dependencyDepths(model, output);
  const paramIds = new Set(model.parameters.map((p) => p.id));
  const groups: BindingGroup[] = Object.keys(records).map((variable) => {
    const texts = explainBinding(result, entity, variable, t);
    const lines: BindingLine[] = (records[variable] ?? []).map((rec, i) => {
      const idx = rec.activeArg[t];
      const arg = idx >= 0 ? String(rec.args[idx]).trim() : null;
      return {
        variable,
        text: texts[i] ?? `${variable}: ${rec.fn}()`,
        fn: rec.fn,
        activeArg: arg,
        relaxParameter: arg && paramIds.has(arg) ? arg : null,
      };
    });
    return { variable, depth: depths.has(variable) ? (depths.get(variable) as number) : null, lines };
  });
  groups.sort(
    (a, b) => (a.depth ?? 1e9) - (b.depth ?? 1e9) || a.variable.localeCompare(b.variable),
  );
  return groups;
}

// ---------------------------------------------------------------------------
// "Add a variable" form
// ---------------------------------------------------------------------------

export interface EffectForm {
  target: string;
  op: 'add' | 'multiply';
  expr: string;
  unit: string;
}

export interface OverlayForm {
  inputId: string;
  unit: string;
  startYear: number;
  startValue: number;
  endYear: number;
  endValue: number;
  sourceLabel: string;
  sourceKind: EvidenceKind;
  effects: EffectForm[];
}

/** Variables an effect may attach to. */
export function hookableVariables(model: CoreModel): Variable[] {
  return model.variables.filter((v) => v.hook !== false);
}

export function emptyOverlayForm(model: CoreModel): OverlayForm {
  const target = hookableVariables(model)[0]?.id ?? '';
  return {
    inputId: 'newAccess',
    unit: 'share',
    startYear: model.time.start,
    startValue: 0,
    endYear: model.time.end,
    endValue: 0.5,
    sourceLabel: 'author guess',
    sourceKind: 'guess',
    effects: [{ target, op: 'multiply', expr: '1 + 0.05 * newAccess', unit: '' }],
  };
}

const IDENT_RE = /^[A-Za-z_]\w*$/;

/**
 * Rename a bare symbol inside an expression. Renaming the new input carries the default effect
 * expressions with it, so changing the id does not silently leave them pointing at a name that no
 * longer exists.
 */
export function renameSymbol(expression: string, from: string, to: string): string {
  if (!from || !to || from === to) return expression;
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return expression.replace(new RegExp(`\\b${escaped}\\b`, 'g'), to);
}

/**
 * Build the Overlay the form describes. Structural problems (bad id, empty expression, a target
 * that cannot take effects) are reported here; anything the engine can say better — unknown
 * symbols, unit mismatches, non-finite results — is deliberately left to the run's diagnostics.
 */
export function applyOverlayForm(form: OverlayForm, model: CoreModel): { overlay: Overlay | null; errors: string[] } {
  const errors: string[] = [];
  const id = form.inputId.trim();
  if (!id) errors.push('The new input needs an id.');
  else if (!IDENT_RE.test(id)) errors.push(`"${id}" is not a valid id: letters, digits and _ only, starting with a letter.`);
  const taken = new Set<string>([
    ...model.parameters.map((p) => p.id),
    ...(model.inputs ?? []).map((i) => i.id),
    ...model.variables.map((v) => v.id),
    ...(model.solves ?? []).map((s) => s.unknown),
  ]);
  if (id && taken.has(id)) errors.push(`"${id}" already exists in this model. Pick another id.`);

  if (!Number.isFinite(form.startYear) || !Number.isFinite(form.endYear)) errors.push('Both curve years must be numbers.');
  else if (form.endYear <= form.startYear) errors.push('The end year must be after the start year.');
  if (!Number.isFinite(form.startValue) || !Number.isFinite(form.endValue)) errors.push('Both curve values must be numbers.');

  if (!form.sourceLabel.trim()) errors.push('Every added number needs a source label — "author guess" is a valid one.');

  const effects = form.effects.filter((e) => e.target.trim() || e.expr.trim());
  if (!effects.length) errors.push('Add at least one effect, otherwise the new input reaches nothing.');
  const hookable = new Set(hookableVariables(model).map((v) => v.id));
  effects.forEach((e, i) => {
    const n = i + 1;
    if (!e.target.trim()) errors.push(`Effect ${n} needs a target variable.`);
    else if (!hookable.has(e.target)) errors.push(`Effect ${n}: "${e.target}" does not accept effects.`);
    if (!e.expr.trim()) errors.push(`Effect ${n} needs an expression.`);
  });
  if (errors.length) return { overlay: null, errors };

  const source: Source = { label: form.sourceLabel.trim(), kind: form.sourceKind };
  const overlay: Overlay = {
    id: `lab-${id}`,
    name: `Add ${id}`,
    description: `A lab-authored input "${id}" reaching ${effects.length} equation${effects.length === 1 ? '' : 's'} through effects. The base model is unchanged.`,
    inputs: [
      {
        id,
        unit: form.unit.trim() || undefined,
        curve: { [String(form.startYear)]: form.startValue, [String(form.endYear)]: form.endValue },
        source,
      },
    ],
    effects: effects.map((e, i) => ({
      id: `lab-${id}-${i + 1}`,
      target: e.target,
      op: e.op,
      expr: e.expr.trim(),
      unit: e.unit.trim() || undefined,
      source,
    })),
  };
  return { overlay, errors: [] };
}

// ---------------------------------------------------------------------------
// Small helpers the view needs
// ---------------------------------------------------------------------------

export function unitOf(model: CoreModel, id: string): string {
  const v = model.variables.find((x) => x.id === id);
  if (v) return v.unit ?? '';
  const i = (model.inputs ?? []).find((x) => x.id === id);
  if (i) return i.unit ?? '';
  const s = (model.solves ?? []).find((x) => x.unknown === id);
  if (s) return s.unit ?? '';
  return model.parameters.find((x) => x.id === id)?.unit ?? '';
}

export function describeOf(model: CoreModel, id: string): string {
  return model.variables.find((x) => x.id === id)?.description ?? '';
}

export function errorsOf(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.filter((d) => d.level === 'error');
}

export function warningsOf(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.filter((d) => d.level === 'warning');
}

/** Index of the step closest to a calendar year. */
export function stepForYear(years: number[], year: number): number {
  if (!years.length) return 0;
  let best = 0;
  for (let i = 1; i < years.length; i++) if (Math.abs(years[i] - year) < Math.abs(years[best] - year)) best = i;
  return best;
}

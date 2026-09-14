/**
 * Model-native calendars: how to name a model's time values.
 *
 * A calendar model (no `time.stepLabel`) counts calendar years, so step values print as years
 * ("2029", or "2029.50" for a monthly step). A model that declares `stepLabel` counts its own unit:
 * Gasteiger-Prettner's steps are 25-year generations, so its values print "Generation 3". Nothing
 * here converts one into the other or interpolates annual values between generations.
 */

import type { CoreModel, ModelTime } from './types';

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** True when the model's time values are calendar years. */
export function isCalendarTime(time: ModelTime | undefined): boolean {
  return !time?.stepLabel;
}

/** "Year" or the declared unit, capitalised ("Generation"). */
export function timeUnitName(time: ModelTime | undefined): string {
  return time?.stepLabel ? cap(time.stepLabel) : 'Year';
}

const num = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));

/** A time value in words: "2029", "2029.50", "Generation 3". */
export function timeLabel(time: ModelTime | undefined, value: number): string {
  if (!Number.isFinite(value)) return '—';
  return time?.stepLabel ? `${cap(time.stepLabel)} ${num(value)}` : num(value);
}

/** A short tick for a chart axis: "2029" or "3" (the axis names the unit). */
export function timeTick(value: number): string {
  return Number.isFinite(value) ? (Number.isInteger(value) ? String(value) : value.toFixed(1)) : '';
}

/** The axis title: "year" or "generation (25 years each)". */
export function timeAxisTitle(time: ModelTime | undefined): string {
  if (!time?.stepLabel) return time?.step === 'month' ? 'year (monthly steps)' : 'year';
  return time.stepYears ? `${time.stepLabel} (${time.stepYears} years each)` : time.stepLabel;
}

/**
 * The sentence a reader needs before a chart of a non-calendar model, or null for calendar models:
 * "One step is one generation (25 years). Values count generations, not calendar years; no annual
 * path between them is modelled."
 */
export function calendarNote(time: ModelTime | undefined): string | null {
  if (!time?.stepLabel) return null;
  const dur = time.stepYears ? ` (${time.stepYears} years)` : '';
  return `One step is one ${time.stepLabel}${dur}. Time values count ${time.stepLabel}s from ${num(time.start)} to ${num(time.end)}, not calendar years; no annual path between them is modelled.`;
}

export interface SteadyStateInfo {
  outputs: Set<string>;
  reason: string;
  /** Time value the steady state is read at. */
  at: number;
}

/** The model's declared steady-state-only outputs, or null. */
export function steadyStateOf(model: Pick<CoreModel, 'limitations' | 'time'>): SteadyStateInfo | null {
  const s = model.limitations?.steadyStateOnly;
  if (!s || !Array.isArray(s.outputs) || !s.outputs.length) return null;
  return { outputs: new Set(s.outputs), reason: s.reason, at: s.at ?? model.time.end };
}

/** Index of the step closest to a time value. */
export function stepIndexOf(years: number[], value: number): number {
  if (!years.length) return 0;
  let best = 0;
  for (let i = 1; i < years.length; i++) if (Math.abs(years[i] - value) < Math.abs(years[best] - value)) best = i;
  return best;
}

/**
 * Unit conversion for policy mappings. Pure, small, and deliberately conservative: a mapping's
 * value+unit either converts to the target's declared unit with a stated factor, or it is a
 * blocking error with a readable reason. Nothing is ever passed through silently.
 *
 * What converts (and nothing else):
 *   currency     usd, $, dollar(s), with scale words or letters: thousand/k, million/m/mn,
 *                billion/b/bn, trillion/t/tn. "$", "M usd", "million usd", "usd million" all parse.
 *   counts       people/persons/residents, workers, participants, households (distinct kinds), jobs, units; with the
 *                same scale words ("2 thousand people").
 *   shares       share/fraction/proportion (scale 1) and percent/pct/% /percentage points (scale 0.01).
 *                "share of L" keeps its qualifier; two different qualifiers do not convert.
 *   durations    year(s) and month(s) (1 year = 12 months).
 *   dimensionless "1", "ratio", "factor", "x", "" (only when both sides are dimensionless).
 *   per-time     "per year" / "a year" / "annual" / "/yr" and "per month" / "monthly" / "/mo" convert
 *                into each other (x12). "one-off" / "one-time" / "total" / "lump sum" never becomes a
 *                rate: there is no spreading rule. A target with no time basis accepts a per-time
 *                value only when that basis is the model's own step and the target is a per-step
 *                curve or effect (a warning names the assumption); otherwise it is an error.
 *   per-person   "per person" / "per capita" / "per worker" denominators must match on both sides:
 *                a total never becomes a per-person amount (that would need a population).
 *
 * Anything with an unrecognised word is compared as an opaque label: equal labels convert with
 * factor 1, different labels are an error.
 */

import type { StepUnit } from '../core/types';

export const UNITS_VERSION = 'policy-units/2';

export type Dimension = 'currency' | 'count' | 'share' | 'duration' | 'dimensionless' | 'opaque';
export type TimeBasis = 'year' | 'month' | 'one-off' | 'generation';

export interface ParsedUnit {
  raw: string;
  dimension: Dimension;
  /** currency: 'usd'; count: 'people' | 'jobs' | 'units'; share: qualifier ("of l") or ''; opaque: canonical label. */
  kind: string;
  /** Multiply a value in this unit by `scale` to get the base unit (usd, people, share, year). */
  scale: number;
  time?: TimeBasis;
  /** Legacy indicator for any recipient denominator; recipient identifies which population. */
  perPerson?: boolean;
  recipient?: 'resident' | 'worker' | 'participant' | 'household';
}

const SCALE_WORDS: Record<string, number> = {
  thousand: 1e3, thousands: 1e3, k: 1e3,
  million: 1e6, millions: 1e6, m: 1e6, mn: 1e6, mm: 1e6, mil: 1e6,
  billion: 1e9, billions: 1e9, b: 1e9, bn: 1e9,
  trillion: 1e12, trillions: 1e12, t: 1e12, tn: 1e12,
};
const CURRENCY = new Set(['usd', 'dollar', 'dollars', 'us$', 'usdollars']);
const PEOPLE = new Set(['people', 'person', 'persons', 'worker', 'workers', 'individual', 'individuals', 'participant', 'participants', 'trainee', 'trainees', 'resident', 'residents', 'household', 'households']);
const JOBS = new Set(['job', 'jobs', 'position', 'positions']);
const UNITS = new Set(['unit', 'units']);
const SHARE = new Set(['share', 'fraction', 'proportion']);
const PERCENT = new Set(['percent', 'pct', 'percentage', 'pp', 'percentagepoints', 'percentagepoint']);
const DIMENSIONLESS = new Set(['1', 'ratio', 'factor', 'x', 'multiplier', 'dimensionless']);
const YEAR = new Set(['year', 'years', 'yr', 'yrs', 'annum', 'y']);
const MONTH = new Set(['month', 'months', 'mo', 'mos']);
const PER_PERSON = new Set(['capita', 'person', 'people', 'persons', 'worker', 'workers', 'head', 'participant', 'participants', 'individual', 'individuals', 'resident', 'residents', 'household', 'households']);
const recipientOf = (s: string): ParsedUnit['recipient'] => /^(worker|workers)$/.test(s) ? 'worker' : /^(participant|participants|trainee|trainees)$/.test(s) ? 'participant' : /^(household|households)$/.test(s) ? 'household' : 'resident';
const FILLER = new Set(['a', 'an', 'each', 'every', 'the', 'us', 'of']);

function tokens(unit: string): string[] {
  return String(unit ?? '')
    .toLowerCase()
    .replace(/percentage points?/g, ' percentagepoints ')
    .replace(/us\s*dollars?/g, ' usd ')
    .replace(/one[\s-]?(off|time)/g, ' oneoff ')
    .replace(/lump[\s-]?sum/g, ' oneoff ')
    .replace(/%/g, ' percent ')
    .replace(/\$/g, ' usd ')
    .replace(/\//g, ' per ')
    .replace(/[_,()]/g, ' ')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .split(/[\s-]+/)
    .filter(Boolean);
}

/** Parse a unit label. Never throws; unrecognised labels come back as 'opaque'. */
export function parseUnit(unit: string | undefined): ParsedUnit {
  const raw = String(unit ?? '').trim();
  const opaque = (): ParsedUnit => ({ raw, dimension: 'opaque', kind: raw.toLowerCase().replace(/[\s_]+/g, ' ').trim(), scale: 1 });
  if (!raw) return { raw, dimension: 'dimensionless', kind: '', scale: 1 };

  const ts = tokens(raw);
  let time: TimeBasis | undefined;
  let perPerson = false;
  let recipient: ParsedUnit['recipient'];
  const numerator: string[] = [];
  let qualifier = '';
  for (let i = 0; i < ts.length; i++) {
    const w = ts[i];
    if (w === 'annual' || w === 'annually' || w === 'yearly') { if (time && time !== 'year') return opaque(); time = 'year'; continue; }
    if (w === 'monthly') { if (time && time !== 'month') return opaque(); time = 'month'; continue; }
    if (w === 'oneoff' || w === 'once' || w === 'total') { if (time && time !== 'one-off') return opaque(); time = 'one-off'; continue; }
    if (w === 'per' || (w === 'a' && (YEAR.has(ts[i + 1]) || MONTH.has(ts[i + 1])))) {
      const next = ts[i + 1];
      if (!next) return opaque();
      i += 1;
      if (YEAR.has(next)) { if (time && time !== 'year') return opaque(); time = 'year'; }
      else if (MONTH.has(next)) { if (time && time !== 'month') return opaque(); time = 'month'; }
      else if (next === 'generation') { time = 'generation'; }
      else if (PER_PERSON.has(next)) { if (recipient && recipient !== recipientOf(next)) return opaque(); perPerson = true; recipient = recipientOf(next); }
      else return opaque();
      continue;
    }
    if (w === 'of' && numerator.length && ts[i + 1] && ts[i + 1] !== 'per') {
      // "share of L", "share of workforce": a qualifier, up to the next "per"
      const rest: string[] = [];
      while (ts[i + 1] && ts[i + 1] !== 'per') rest.push(ts[++i]);
      qualifier = rest.join(' ');
      continue;
    }
    if (FILLER.has(w) && w !== 'of') continue;
    numerator.push(w);
  }

  let scale = 1;
  const base: string[] = [];
  for (const w of numerator) {
    if (w in SCALE_WORDS && numerator.length > 1) scale *= SCALE_WORDS[w];
    else base.push(w);
  }
  const out = (dimension: Dimension, kind: string, s: number): ParsedUnit => ({ raw, dimension, kind, scale: s, ...(time ? { time } : {}), ...(perPerson ? { perPerson, recipient } : {}) });

  if (base.length === 0) {
    // "per year" alone, or nothing but fillers: a dimensionless rate
    return scale === 1 ? out('dimensionless', '', 1) : opaque();
  }
  if (base.length !== 1) return opaque();
  const b = base[0];
  if (CURRENCY.has(b)) return out('currency', 'usd', scale);
  if (PEOPLE.has(b)) return out('count', recipientOf(b) === 'resident' ? 'people' : recipientOf(b)!, scale);
  if (JOBS.has(b)) return out('count', 'jobs', scale);
  if (UNITS.has(b)) return out('count', 'units', scale);
  if (scale !== 1) return opaque();
  if (SHARE.has(b)) return out('share', qualifier, 1);
  if (PERCENT.has(b)) return out('share', qualifier, 0.01);
  if (qualifier) return opaque();
  if (DIMENSIONLESS.has(b)) return out('dimensionless', '', 1);
  if (YEAR.has(b)) return time ? opaque() : out('duration', 'time', 1);
  if (MONTH.has(b)) return time ? opaque() : out('duration', 'time', 1 / 12);
  return opaque();
}

export interface ConversionContext {
  /** The model's step, used only when the target declares no time basis. */
  step?: StepUnit;
  /** Persist on the mapping; supplies only a missing source time basis, never recipient equivalence. */
  timeAssumption?: { basis: TimeBasis; reason: string };
  /** A per-step curve or effect (true) versus a parameter (false). */
  perStepTarget?: boolean;
}

export type Conversion =
  | { ok: true; factor: number; message: string; warning?: string }
  | { ok: false; message: string };

const nf = (x: number) => (Number.isFinite(x) ? x.toLocaleString('en-US', { maximumFractionDigits: 10 }) : String(x));

/**
 * The factor that takes a value in `from` to `to`, or why it cannot. `label` names the target for
 * messages ("training_budget"). A missing `from` unit is reported by the validator, not here.
 */
export function unitFactor(from: string, to: string, label: string, ctx: ConversionContext = {}): Conversion {
  const f = parseUnit(from);
  const t = parseUnit(to);
  if (ctx.timeAssumption) {
    if (!['year', 'month', 'one-off', 'generation'].includes(ctx.timeAssumption.basis) || typeof ctx.timeAssumption.reason !== 'string' || !ctx.timeAssumption.reason.trim()) return { ok: false, message: 'time assumption requires a valid basis and a reason' };
    if (f.time) return { ok: false, message: 'time assumption cannot override an explicit source time basis' };
    f.time = ctx.timeAssumption.basis;
  }
  const target = `${label} (${to || 'no unit'})`;
  const fail = (why: string): Conversion => ({ ok: false, message: `${from || 'no unit'} → ${target}: ${why}` });

  if (f.dimension === 'opaque' || t.dimension === 'opaque') {
    if (f.dimension === 'opaque' && t.dimension === 'opaque' && f.kind === t.kind && f.time === t.time && !!f.perPerson === !!t.perPerson) return { ok: true, factor: 1, message: `${from} → ${target}: same unit` };
    return fail(`cannot convert (${f.dimension === 'opaque' ? `"${from}"` : `"${to}"`} is not a unit this app knows how to convert, and the labels differ)`);
  }
  if (f.dimension !== t.dimension) return fail(`incompatible units (${f.dimension} is not ${t.dimension})`);
  if (f.kind !== t.kind) {
    if (f.dimension === 'share' && (!f.kind || !t.kind)) {
      // an unqualified share converts into a qualified one ("percent" → "share of L")
    } else return fail(`incompatible units (${f.kind || 'unqualified'} is not ${t.kind || 'unqualified'})`);
  }
  if (!!f.perPerson !== !!t.perPerson) {
    return fail(t.perPerson ? 'a total is not a per-person amount (converting needs a population the mapping does not give)' : 'a per-person amount is not a total (converting needs a population the mapping does not give)');
  }

  if (f.recipient !== t.recipient) return fail(`recipient denominators differ (${f.recipient} versus ${t.recipient}); supply a separately justified population conversion`);
  let factor = f.scale / t.scale;
  let warning: string | undefined = ctx.timeAssumption ? `Source time assumed per ${ctx.timeAssumption.basis}: ${ctx.timeAssumption.reason}` : undefined;
  if (f.time !== t.time) {
    if (f.time === 'one-off' || t.time === 'one-off') return fail('a one-off amount and a rate do not convert: say how the amount is spread over time');
    if (f.time === 'generation' || t.time === 'generation') return fail('a per-generation amount does not convert to a calendar rate');
    if (f.time && t.time) {
      // per year <-> per month
      factor *= f.time === 'year' && t.time === 'month' ? 1 / 12 : 12;
    } else if (f.time && !t.time) {
      if (ctx.perStepTarget && ctx.step && f.time === ctx.step) {
        warning = [warning, `"${to}" declares no time basis; the value is taken as per model step (per ${ctx.step})`].filter(Boolean).join("; ");
      } else {
        return fail(
          ctx.step && ctx.perStepTarget
            ? `the value is per ${f.time}, the model steps by ${ctx.step}, and "${to}" declares no time basis`
            : `the value is per ${f.time}, but "${to}" declares no time basis`,
        );
      }
    }
    else if (!f.time && t.time) return fail('source time basis is unknown; supply an explicit persisted time assumption with a reason');
  }
  const message = factor === 1 ? `${from} → ${target}: same unit` : `${from} → ${target}: ×${nf(factor)}`;
  return { ok: true, factor, message, ...(warning ? { warning } : {}) };
}

/** Readable "20 million usd → training_budget (usd): converted to 20,000,000". */
export function describeConversion(value: number, from: string, to: string, label: string, factor: number): string {
  return factor === 1 ? `${nf(value)} ${from} → ${label} (${to}): no conversion needed` : `${nf(value)} ${from} → ${label} (${to}): converted to ${nf(value * factor)}`;
}

export const DIMENSIONLESS_UNITS = ['', '1', 'ratio', 'factor', 'x'];

/** True when `unit` is acceptable on a multiplier. */
export function isDimensionless(unit: string | undefined): boolean {
  const p = parseUnit(unit);
  return p.dimension === 'dimensionless' && !p.time && !p.perPerson;
}

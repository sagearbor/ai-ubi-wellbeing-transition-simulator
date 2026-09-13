/**
 * Response profile of the default world model (v3 plan, stage 3 "response review").
 *
 * PURE - no I/O. Runs the built-in engine (simulation/pure.ts via simulation/run.ts) from the
 * shipped initial state under the default preset, then re-runs it with each public lever nudged,
 * and reports what the headline outputs did. It answers, per lever:
 *
 *   - the +/-1% and +/-10% response at two horizons (5 and 10 years), so a reader can see whether
 *     a small nudge produces a small response;
 *   - an amplification ratio: (response to 10%) / (10 x response to 1%). Near 1 the lever acts
 *     linearly at this point; far above 1 the model amplifies (a threshold is nearby); far below
 *     1 something caps the lever;
 *   - the shape of the response over a 0.5x-1.5x sweep (flat / linear / saturating / threshold /
 *     non-monotone), using the same classifier the authoring core uses, so the two engines are
 *     reviewed with one vocabulary.
 *
 * Categorical switches (distribution strategy, macro block) are reported as before/after pairs.
 *
 * Nothing here is fitted or scored. It is a description of how the shipped model responds, for
 * the model card; a surprising number is a finding to record, not a failure to hide.
 */

import { classifyShape, type ShapeDetail } from '../src/core/sensitivity';
import { initialRun, advanceRun, type SimulationRun } from '../simulation/run';
import { INITIAL_CORPORATIONS, PRESET_MODELS, DEFAULT_MACRO } from '../constants';
import type { Corporation, ModelParameters } from '../types';

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

/** The eight countries anchor test AT-5 treats as "poor". */
export const POOR_COUNTRY_IDS = ['HTI', 'AFG', 'YEM', 'ETH', 'COD', 'SYR', 'PRK', 'TJK'];

export interface Headline {
  /** Mean wellbeing over all countries (0-100). */
  averageWellbeing: number;
  usWellbeing: number;
  /** Mean wellbeing over POOR_COUNTRY_IDS that exist in the state. */
  poorWellbeing: number;
  usAdoption: number;
  countriesInCrisis: number;
  /** Corporate UBI contributions that month, billions USD. */
  monthlyInflow: number;
}

export const HEADLINE_KEYS: (keyof Headline)[] = [
  'averageWellbeing',
  'usWellbeing',
  'poorWellbeing',
  'usAdoption',
  'countriesInCrisis',
  'monthlyInflow',
];

export function headline(run: SimulationRun): Headline {
  const cd = run.state.countryData;
  const poor = POOR_COUNTRY_IDS.map((id) => cd[id]).filter(Boolean);
  return {
    averageWellbeing: run.state.averageWellbeing,
    usWellbeing: cd['USA']?.wellbeing ?? NaN,
    poorWellbeing: poor.length ? poor.reduce((a, c) => a + c.wellbeing, 0) / poor.length : NaN,
    usAdoption: cd['USA']?.aiAdoption ?? NaN,
    countriesInCrisis: run.state.countriesInCrisis ?? 0,
    monthlyInflow: run.ledger.monthlyInflow,
  };
}

// ---------------------------------------------------------------------------
// Levers
// ---------------------------------------------------------------------------

/** A scenario is a model plus a corporation table; every lever maps to one of the two. */
export interface Scenario {
  model: ModelParameters;
  corporations: Corporation[];
}

export interface NumericLever {
  id: string;
  label: string;
  /** Where the lever lives, for the card. */
  kind: 'model' | 'corporation';
  base: (s: Scenario) => number;
  /** Return a new scenario with the lever set to `value`. */
  set: (s: Scenario, value: number) => Scenario;
}

export interface CategoricalSwitch {
  id: string;
  label: string;
  /** Alternatives to the base scenario, each a full scenario. */
  alternatives: { id: string; label: string; apply: (s: Scenario) => Scenario }[];
}

const clampRate = (r: number) => Math.max(0, Math.min(0.5, r));

export const NUMERIC_LEVERS: NumericLever[] = [
  {
    id: 'aiGrowthRate',
    label: 'AI adoption growth rate',
    kind: 'model',
    base: (s) => s.model.aiGrowthRate,
    set: (s, v) => ({ ...s, model: { ...s.model, aiGrowthRate: v } }),
  },
  {
    id: 'displacementRate',
    label: 'Share of labour income displaced at full adoption',
    kind: 'model',
    base: (s) => s.model.displacementRate,
    set: (s, v) => ({ ...s, model: { ...s.model, displacementRate: v } }),
  },
  {
    id: 'gdpScaling',
    label: 'Wealth gradient of UBI utility',
    kind: 'model',
    base: (s) => s.model.gdpScaling,
    set: (s, v) => ({ ...s, model: { ...s.model, gdpScaling: v } }),
  },
  {
    id: 'contributionRate',
    label: 'Corporate contribution rate (every corporation scaled)',
    kind: 'corporation',
    base: (s) => s.corporations.reduce((a, c) => a + c.contributionRate, 0) / s.corporations.length,
    set: (s, v) => {
      const b = s.corporations.reduce((a, c) => a + c.contributionRate, 0) / s.corporations.length;
      const k = b > 0 ? v / b : 0;
      return { ...s, corporations: s.corporations.map((c) => ({ ...c, contributionRate: clampRate(c.contributionRate * k) })) };
    },
  },
];

export const CATEGORICAL_SWITCHES: CategoricalSwitch[] = [
  {
    id: 'distributionStrategy',
    label: 'Distribution strategy (all corporations)',
    alternatives: [
      { id: 'global', label: 'all global', apply: (s) => ({ ...s, corporations: s.corporations.map((c) => ({ ...c, distributionStrategy: 'global' as const })) }) },
      { id: 'customer-weighted', label: 'all customer-weighted', apply: (s) => ({ ...s, corporations: s.corporations.map((c) => ({ ...c, distributionStrategy: 'customer-weighted' as const })) }) },
      { id: 'hq-local', label: 'all HQ-local', apply: (s) => ({ ...s, corporations: s.corporations.map((c) => ({ ...c, distributionStrategy: 'hq-local' as const })) }) },
    ],
  },
  {
    id: 'macro',
    label: 'Macro block (GDP path, labour share, displaced pool)',
    alternatives: [
      { id: 'macro-on', label: 'DEFAULT_MACRO on', apply: (s) => ({ ...s, model: { ...s.model, macro: { ...DEFAULT_MACRO } } }) },
    ],
  },
];

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

export function defaultScenario(): Scenario {
  return { model: { ...PRESET_MODELS[0] }, corporations: INITIAL_CORPORATIONS.map((c) => ({ ...c })) };
}

/** Run a scenario and return the headline at each requested month. */
export function runScenario(s: Scenario, horizons: number[]): Record<number, Headline> {
  const out: Record<number, Headline> = {};
  const last = Math.max(...horizons);
  let run = initialRun(s.corporations);
  for (let m = 1; m <= last; m++) {
    run = advanceRun(run, { model: s.model });
    if (horizons.includes(m)) out[m] = headline(run);
  }
  return out;
}

export interface NudgeArm {
  factor: number; // 0.99, 1.01, 0.9, 1.1
  value: number;
  /** Absolute change from base per headline key, by horizon. */
  delta: Record<number, Record<keyof Headline, number>>;
}

export interface LeverProfile {
  id: string;
  label: string;
  kind: 'model' | 'corporation';
  base: number;
  arms: NudgeArm[];
  /** (|d10| / (10 x |d1|)) per headline key at each horizon; null when d1 is ~0. */
  amplification: Record<number, Record<keyof Headline, number | null>>;
  /** Shape of averageWellbeing at the last horizon across the 0.5x-1.5x sweep. */
  sweep: { factors: number[]; averageWellbeing: number[]; shape: ShapeDetail };
}

export interface SwitchProfile {
  id: string;
  label: string;
  alternatives: { id: string; label: string; delta: Record<number, Record<keyof Headline, number>> }[];
}

export interface ResponseProfile {
  modelId: string;
  horizons: number[];
  base: Record<number, Headline>;
  levers: LeverProfile[];
  switches: SwitchProfile[];
}

const diff = (a: Headline, b: Headline): Record<keyof Headline, number> => {
  const d = {} as Record<keyof Headline, number>;
  for (const k of HEADLINE_KEYS) d[k] = a[k] - b[k];
  return d;
};

export const DEFAULT_HORIZONS = [60, 120];
export const SWEEP_FACTORS = [0.5, 0.625, 0.75, 0.875, 1, 1.125, 1.25, 1.375, 1.5];

export function profileLever(lever: NumericLever, s: Scenario, horizons: number[], base: Record<number, Headline>): LeverProfile {
  const b = lever.base(s);
  const arms: NudgeArm[] = [0.99, 1.01, 0.9, 1.1].map((factor) => {
    const value = b * factor;
    const res = runScenario(lever.set(s, value), horizons);
    const delta: NudgeArm['delta'] = {};
    for (const h of horizons) delta[h] = diff(res[h], base[h]);
    return { factor, value, delta };
  });
  const amplification: LeverProfile['amplification'] = {};
  for (const h of horizons) {
    const row = {} as Record<keyof Headline, number | null>;
    for (const k of HEADLINE_KEYS) {
      // Use the larger of the two one-sided responses at each scale (a lever can be one-sided at a cap).
      const d1 = Math.max(Math.abs(arms[0].delta[h][k]), Math.abs(arms[1].delta[h][k]));
      const d10 = Math.max(Math.abs(arms[2].delta[h][k]), Math.abs(arms[3].delta[h][k]));
      row[k] = d1 > 1e-9 ? d10 / (10 * d1) : null;
    }
    amplification[h] = row;
  }
  const last = Math.max(...horizons);
  const ys = SWEEP_FACTORS.map((f) => (f === 1 ? base[last].averageWellbeing : runScenario(lever.set(s, b * f), [last])[last].averageWellbeing));
  return {
    id: lever.id,
    label: lever.label,
    kind: lever.kind,
    base: b,
    arms,
    amplification,
    sweep: { factors: SWEEP_FACTORS, averageWellbeing: ys, shape: classifyShape(ys) },
  };
}

export function profileSwitch(sw: CategoricalSwitch, s: Scenario, horizons: number[], base: Record<number, Headline>): SwitchProfile {
  return {
    id: sw.id,
    label: sw.label,
    alternatives: sw.alternatives.map((alt) => {
      const res = runScenario(alt.apply(s), horizons);
      const delta: Record<number, Record<keyof Headline, number>> = {};
      for (const h of horizons) delta[h] = diff(res[h], base[h]);
      return { id: alt.id, label: alt.label, delta };
    }),
  };
}

export function runResponseProfile(opts: { scenario?: Scenario; horizons?: number[] } = {}): ResponseProfile {
  const s = opts.scenario ?? defaultScenario();
  const horizons = opts.horizons ?? DEFAULT_HORIZONS;
  const base = runScenario(s, horizons);
  return {
    modelId: s.model.id,
    horizons,
    base,
    levers: NUMERIC_LEVERS.map((l) => profileLever(l, s, horizons, base)),
    switches: CATEGORICAL_SWITCHES.map((sw) => profileSwitch(sw, s, horizons, base)),
  };
}

// ---------------------------------------------------------------------------
// Markdown rendering (for the model card)
// ---------------------------------------------------------------------------

const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');
const f3 = (x: number) => (Number.isFinite(x) ? x.toFixed(3) : '—');
const signed = (x: number, digits = 1) => (Number.isFinite(x) ? (x >= 0 ? '+' : '') + x.toFixed(digits) : '—');
const amp = (x: number | null) => (x === null ? 'n/a' : x.toFixed(2));

export function renderMarkdown(p: ResponseProfile): string {
  const L: string[] = [];
  L.push(`Response profile of \`${p.modelId}\` (built-in engine, shipped initial state).`, '');
  L.push('| Horizon | avg wellbeing | US wellbeing | poor-8 wellbeing | US adoption | countries in crisis | inflow bn/mo |');
  L.push('|---|---|---|---|---|---|---|');
  for (const h of p.horizons) {
    const b = p.base[h];
    L.push(`| ${h / 12} y | ${f1(b.averageWellbeing)} | ${f1(b.usWellbeing)} | ${f1(b.poorWellbeing)} | ${f3(b.usAdoption)} | ${b.countriesInCrisis} | ${f1(b.monthlyInflow)} |`);
  }
  L.push('', '### Small nudges (change in average wellbeing, index points)', '');
  L.push('| Lever | base | horizon | −10% | −1% | +1% | +10% | amplification | sweep shape (0.5x–1.5x) |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  for (const l of p.levers) {
    for (const h of p.horizons) {
      const d = (factor: number) => l.arms.find((a) => a.factor === factor)!.delta[h].averageWellbeing;
      const shape = h === Math.max(...p.horizons) ? `${l.sweep.shape.shape} (span ${f1(l.sweep.shape.span)})` : '';
      L.push(`| ${l.id} | ${f3(l.base)} | ${h / 12} y | ${signed(d(0.9))} | ${signed(d(0.99), 2)} | ${signed(d(1.01), 2)} | ${signed(d(1.1))} | ${amp(l.amplification[h].averageWellbeing)} | ${shape} |`);
    }
  }
  L.push('', 'Amplification = |10% response| / (10 × |1% response|); 1.0 is proportional, well above 1 means a threshold is near, well below 1 means a cap.', '');
  L.push('### Same nudges, other outputs (10% arms only, last horizon)', '');
  const last = Math.max(...p.horizons);
  L.push('| Lever | arm | US wellbeing | poor-8 wellbeing | US adoption | crisis count | inflow bn/mo |');
  L.push('|---|---|---|---|---|---|---|');
  for (const l of p.levers) {
    for (const factor of [0.9, 1.1]) {
      const d = l.arms.find((a) => a.factor === factor)!.delta[last];
      L.push(`| ${l.id} | ${factor < 1 ? '−10%' : '+10%'} | ${signed(d.usWellbeing)} | ${signed(d.poorWellbeing)} | ${signed(d.usAdoption, 3)} | ${signed(d.countriesInCrisis, 0)} | ${signed(d.monthlyInflow)} |`);
    }
  }
  L.push('', '### Switches (difference from base, last horizon)', '');
  L.push('| Switch | alternative | avg wellbeing | US wellbeing | poor-8 wellbeing | crisis count | inflow bn/mo |');
  L.push('|---|---|---|---|---|---|---|');
  for (const sw of p.switches) {
    for (const alt of sw.alternatives) {
      const d = alt.delta[last];
      L.push(`| ${sw.id} | ${alt.label} | ${signed(d.averageWellbeing)} | ${signed(d.usWellbeing)} | ${signed(d.poorWellbeing)} | ${signed(d.countriesInCrisis, 0)} | ${signed(d.monthlyInflow)} |`);
    }
  }
  return L.join('\n');
}

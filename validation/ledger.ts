/**
 * Reference-target coverage ledger (review 2026-09-14, finding 10 and next-work item 7).
 *
 * data/ledger/reference-targets.json lists every external reference target the repository claims to
 * check - published-paper numbers, empirical case estimates, historical reconstruction scores and
 * the anchor expectations - with its current status. A regression test that pins a MISS keeps
 * passing; this ledger is where the miss stays visible, so it can never be counted as a success.
 *
 * This module is PURE (no file or network I/O; bundled JSON imports only). It:
 *   1. computes the model value for every entry with a `compute` spec, by calling the existing
 *      harnesses (runModel/runTests, runKorinekScenario, runPolicyCase, runAllAnchorTests,
 *      runHindcast - the last only when the caller hands in the hindcast actuals);
 *   2. derives each entry's status from value vs target vs tolerance (deriveStatus);
 *   3. checks the recorded ledger (checkLedger): (a) no target disappears without being retired
 *      with a reason, (b) no computed status differs from the recorded one, (c) no test file that
 *      pins a known miss exists without a ledger entry;
 *   4. renders the markdown report (renderLedgerMarkdown).
 *
 * scripts/ledger.ts does the I/O (reading test files, the previous ledger from git, the hindcast
 * series) and writes docs/design/reference-ledger.md.
 */

import alaskaCase from '../data/cases/alaska-pfd.json';
import korinekOracle from '../data/core/korinek-2026-faithful.expected.json';
import { KORINEK_SCENARIOS, PRESET_MODELS } from '../constants';
import { runModel, runTests } from '../src/core/engine';
import { CORE_FIXTURES, findFixture } from '../src/core/fixtures';
import type { CoreModel, ModelTest, Overlay, RunResult } from '../src/core/types';
import { ANCHOR_TESTS, runAllAnchorTests, type AnchorTestResult } from './anchorTests';
import { runHindcast, mean, type HindcastActuals, type HindcastRun } from './hindcast';
import { runKorinekScenario, type KorinekOutcome } from './korinek';
import { runPolicyCase, type PolicyCase } from './policyCases';

// ---------------------------------------------------------------------------
// Ledger shape (mirrors data/ledger/reference-targets.json)
// ---------------------------------------------------------------------------

export const FAMILIES = [
  'korinek-reduced-form',
  'korinek-faithful',
  'gasteiger-prettner',
  'alaska-pfd',
  'hindcast',
  'anchor-directional',
  'anchor-invariant',
  'other',
] as const;
export type Family = (typeof FAMILIES)[number];

export const STATUSES = ['reproduced', 'reproduced-with-caveat', 'missed', 'not-checked', 'not-verified', 'outside-model'] as const;
export type Status = (typeof STATUSES)[number];

/** A status that is decided by classification, not by comparing a value with a tolerance. */
export type Classification = 'not-checked' | 'not-verified' | 'outside-model';

export type Tolerance =
  /** |model - published| <= value */
  | { kind: 'abs'; value: number; setBy: string }
  /** |model / published - 1| <= value */
  | { kind: 'relative'; value: number; setBy: string }
  /** model <op> published (published.value is the bound) */
  | { kind: 'lt' | 'lte' | 'gt' | 'gte'; setBy: string }
  /** no tolerance declared anywhere; the entry must carry a classification */
  | { kind: 'none'; setBy: string };

export type ComputeSpec =
  /** Evaluate an expression on a bundled core model (src/core/fixtures.ts) at one step. */
  | { kind: 'core-expr'; model: string; overlays?: string[]; params?: Record<string, number>; at: number; expr: string; entity?: string }
  /** The `actual` of one of a bundled model's own in-file tests (overlay: the overlay that carries it). */
  | { kind: 'core-infile'; model: string; overlay?: string; test: string }
  /** A named computation defined in DERIVED below. */
  | { kind: 'derived'; fn: string; args?: Record<string, string | number | null> }
  /** validation/korinek.ts (the reduced-form TypeScript harness), US at end-2030. */
  | { kind: 'korinek-ts'; scenario: string; metric: 'gdpBoostPct' | 'laborSharePct' | 'cognitiveUnemploymentPct' | 'unemploymentPct' | 'growthPctPerYear' }
  /** validation/policyCases.ts on data/cases/<case>.json, one outcome. */
  | { kind: 'policy-case'; case: string; outcome: string; target: 'core-model' | 'world-engine' | 'none' }
  /** validation/anchorTests.ts, one anchor test. */
  | { kind: 'anchor'; testId: string }
  /** validation/hindcast.ts; needs the data/hindcast series (script only). */
  | {
      kind: 'hindcast';
      run: 'ai-off' | 'ai-off-ubi-on' | 'ai-on' | 'anchored-ai-off' | 'anchored-ai-on';
      metric: 'corrWellbeingChange' | 'maeWellbeing' | 'corrGdpGrowth' | 'maeGdpGrowthPct' | 'maeMinusPersistence';
    };

export interface LedgerEntry {
  id: string;
  family: Family;
  source: { citation: string; locator: string };
  quantity: string;
  units: string;
  published: { value: number | null; uncertainty?: string | null; display?: string };
  model: { value: number | null; computed: boolean; note?: string };
  /** model - published, in `units`; null when either side is missing. */
  discrepancy: number | null;
  tolerance: Tolerance;
  status: Status;
  /** file:line of the test or script that produces / asserts the model value. */
  checkedBy: string[];
  compute: ComputeSpec | null;
  /** Forces a status that is not decided by the tolerance comparison. */
  classification?: Classification;
  /** Within tolerance but with a stated qualification (e.g. a timing mismatch) -> reproduced-with-caveat. */
  caveat?: string;
  /** Discovery keys this entry accounts for (in-file tests, scenario targets, case outcomes, anchor ids). */
  covers?: string[];
  notes?: string;
  retired?: { date: string; reason: string };
}

export interface Ledger {
  schemaVersion: 1;
  description: string;
  /** Discovery keys (regex on the key) that are not reference targets, with the reason. */
  exclusions: Array<{ pattern: string; reason: string }>;
  /** Test files the miss-pin heuristic may flag that do not pin a reference target. */
  scanExemptions: Array<{ file: string; reason: string }>;
  entries: LedgerEntry[];
}

export interface ComputeResult {
  value: number | null;
  /** A status the harness decides on its own (e.g. a case outcome mapped to no model). */
  forcedStatus?: Status;
  /** The computation was attempted and failed (a renamed test, a missing overlay, a harness disagreement). */
  error?: string;
  /** The computation was not attempted (e.g. hindcast data not supplied). */
  skipped?: string;
}

export interface ComputeContext {
  /** data/hindcast series; hindcast entries are skipped without them. */
  hindcast?: { actuals: HindcastActuals; fromYear?: number; toYear?: number };
}

// ---------------------------------------------------------------------------
// Status derivation
// ---------------------------------------------------------------------------

const EPS = 1e-12;

/** Is the value inside the declared tolerance? null when that cannot be decided. */
export function withinTolerance(value: number, published: number | null, tol: Tolerance): boolean | null {
  if (!Number.isFinite(value)) return false;
  if (tol.kind === 'none' || published === null) return null;
  switch (tol.kind) {
    case 'abs':
      return Math.abs(value - published) <= tol.value + EPS;
    case 'relative':
      return published !== 0 && Math.abs(value / published - 1) <= tol.value + EPS;
    case 'lt':
      return value < published;
    case 'lte':
      return value <= published + EPS;
    case 'gt':
      return value > published;
    case 'gte':
      return value >= published - EPS;
  }
}

/**
 * Status from a computed result. Order: a status the harness forces; the entry's classification;
 * the tolerance comparison (reproduced / reproduced-with-caveat / missed). Returns null when the
 * status cannot be derived (no value, or no tolerance and no classification) - the recorded status
 * then stands.
 */
export function deriveStatus(
  entry: Pick<LedgerEntry, 'tolerance' | 'published' | 'classification' | 'caveat'>,
  result: ComputeResult | undefined,
): Status | null {
  if (result?.forcedStatus) return result.forcedStatus;
  if (entry.classification) return entry.classification;
  if (!result || result.value === null) return null;
  const inside = withinTolerance(result.value, entry.published.value, entry.tolerance);
  if (inside === null) return null;
  if (!inside) return 'missed';
  return entry.caveat ? 'reproduced-with-caveat' : 'reproduced';
}

export function discrepancyOf(value: number | null, published: number | null): number | null {
  return value === null || published === null ? null : value - published;
}

// ---------------------------------------------------------------------------
// Computation
// ---------------------------------------------------------------------------

const setting = (values: Record<string, number>): Overlay => ({
  id: `ledger-setting-${Object.entries(values).map(([k, v]) => `${k}=${v}`).join(',')}`,
  parameters: Object.entries(values).map(([id, value]) => ({ id, value })),
});

function fixtureOverlays(modelId: string, ids: string[] = [], keepTests = false): Overlay[] {
  const fx = findFixture(modelId);
  if (!fx) throw new Error(`unknown core model "${modelId}"`);
  return ids.map((id) => {
    const o = fx.overlays.find((x) => x.id === id);
    if (!o) throw new Error(`model "${modelId}" has no overlay "${id}"`);
    return keepTests ? o : { ...o, tests: [] };
  });
}

function stepOf(r: RunResult, year: number): number {
  const t = r.years.findIndex((y) => Math.abs(y - year) < 1e-9);
  if (t < 0) throw new Error(`year ${year} is not a step`);
  return t;
}

function runOk(model: CoreModel, overlays: Overlay[]): RunResult {
  const r = runModel(model, { overlays });
  if (!r.ok) throw new Error(`run failed: ${r.diagnostics.filter((d) => d.level === 'error').map((d) => `${d.code}: ${d.message}`).join('; ')}`);
  return r;
}

// --- Gasteiger & Prettner fine grids (the same construction as src/core/gasteigerPrettner.test.ts) ---

const round6 = (x: number) => Math.round(x * 1e6) / 1e6;
function gridRange(lo: number, hi: number, step: number): number[] {
  const out: number[] = [];
  for (let i = 0; lo + i * step <= hi + 1e-12; i++) out.push(round6(lo + i * step));
  return out;
}
function gpOnGrid(taus: number[]): CoreModel {
  const base = findFixture('gasteiger-prettner-2020')!.model;
  const all = [0, ...taus.filter((x) => x !== 0)].map(round6);
  const ids = all.map((x) => `tau=${x}`);
  const m: CoreModel = JSON.parse(JSON.stringify(base));
  m.entities = { ...m.entities!, ids };
  m.tests = [];
  for (const p of m.parameters) {
    if (p.id === 'tau') p.byEntity = Object.fromEntries(all.map((x, i) => [ids[i], x]));
    if (p.id === 'isBaseline') p.byEntity = { [ids[0]]: 1 };
  }
  return m;
}
type GridPoint = { tau: number } & Record<string, number>;
function gpSteady(r: RunResult, taus: number[], keys: string[]): GridPoint[] {
  const T = r.years.length - 1;
  return taus.map((tau) => {
    const e = `tau=${round6(tau)}`;
    const pt = { tau } as GridPoint;
    for (const k of keys) pt[k] = r.series[e][k][T];
    return pt;
  });
}
const argBest = (pts: GridPoint[], key: string, dir: 'min' | 'max') =>
  pts.reduce((best, p) => ((dir === 'min' ? p[key] < best[key] : p[key] > best[key]) ? p : best)).tau;

/** Named computations that are not one expression at one step. Each caches through `memo`. */
const DERIVED: Record<string, (args: Record<string, string | number | null>, memo: Map<string, unknown>) => number> = {
  /** Utility-maximising robot tax on the 0.001 grid, 0.50-0.62 (p.24). args.overlay: null | overlay id. */
  'gp-tau-star': (args, memo) => gpTauStar(args.overlay as string | null, memo).u,
  /** 1 when tau*(mu 0.4) > tau*(mu 0.5) > tau*(mu 0.6), else 0. */
  'gp-tau-ordering': (_args, memo) => {
    const a = gpTauStar('gasteiger-prettner-mu04', memo).u;
    const b = gpTauStar(null, memo).u;
    const c = gpTauStar('gasteiger-prettner-mu06', memo).u;
    return a > b && b > c ? 1 : 0;
  },
  /** Linear-interpolated zero crossing of args.key on the 2.3-2.6 grid (Fig. 5). */
  'gp-cv-crossing': (args, memo) => {
    const seg = gpFigGrid(memo).filter((p) => p.tau >= 2.3);
    const key = String(args.key);
    for (let i = 1; i < seg.length; i++) {
      const a = seg[i - 1];
      const b = seg[i];
      if (a[key] < 0 && b[key] >= 0) return a.tau + ((b.tau - a.tau) * -a[key]) / (b[key] - a[key]);
    }
    return NaN;
  },
  /** tau at which args.key peaks on the 0.8-1.6 grid (Fig. 4). */
  'gp-peak-tau': (args, memo) => argBest(gpFigGrid(memo).filter((p) => p.tau <= 1.6), String(args.key), 'max'),
  /** |closed form (43) - monthly recursion| in pp for the Extreme ideas stock at 2030 (Appendix A). */
  'kf-ideas-recursion-gap': () => {
    const fx = findFixture('korinek-2026-faithful')!;
    const e = runOk(fx.model, fixtureOverlays('korinek-2026-faithful', ['korinek-faithful-extreme']));
    const at = (id: string) => e.series._[id][stepOf(e, 2030)];
    const g = at('g');
    const k = at('oneMinusPhiR');
    const lambda = at('lambda');
    const gap = e.series._.lnGDPGap;
    let integral = 0;
    for (let i = 1; i < e.years.length; i++) {
      const f = (j: number) => Math.exp(-k * g * (2030 - e.years[j]) + lambda * gap[j]);
      integral += ((f(i) + f(i - 1)) / 2) * (1 / 12);
    }
    const closed = Math.log(Math.exp(-k * g * 6) + k * g * integral) / k;
    return Math.abs(100 * closed - 100 * at('dlnA'));
  },
  /**
   * Largest |port - explorer oracle| / tolerance over every stored series and date of one setting in
   * data/core/korinek-2026-faithful.expected.json (tolerance 1e-8 for *Pct series, 1e-10 otherwise).
   */
  'kf-oracle-max-normalised': (args) => {
    const file = korinekOracle as unknown as { settings: Array<{ id: string; modelParameters: Record<string, number>; years: number[]; series: Record<string, number[]> }> };
    const s = file.settings.find((x) => x.id === args.setting);
    if (!s) throw new Error(`no oracle setting "${args.setting}"`);
    const r = runOk(findFixture('korinek-2026-faithful')!.model, [setting(s.modelParameters)]);
    let worst = 0;
    for (const [id, expected] of Object.entries(s.series)) {
      const tol = id.endsWith('Pct') ? 1e-8 : 1e-10;
      s.years.forEach((year, i) => {
        const err = Math.abs(r.series._[id][stepOf(r, year)] - expected[i]) / tol;
        worst = Number.isFinite(err) ? Math.max(worst, err) : Infinity;
      });
    }
    return worst;
  },
};

function gpTauStar(overlay: string | null, memo: Map<string, unknown>): { u: number; cv1: number; cv2: number } {
  const key = `gp-tau-star:${overlay}`;
  if (!memo.has(key)) {
    const taus = gridRange(0.5, 0.62, 0.001);
    const r = runOk(gpOnGrid(taus), overlay ? fixtureOverlays('gasteiger-prettner-2020', [overlay]) : []);
    const pts = gpSteady(r, taus, ['utility_prev', 'cv1_pct', 'cv2_pct']);
    memo.set(key, { u: argBest(pts, 'utility_prev', 'max'), cv1: argBest(pts, 'cv1_pct', 'min'), cv2: argBest(pts, 'cv2_pct', 'min') });
  }
  return memo.get(key) as { u: number; cv1: number; cv2: number };
}

function gpFigGrid(memo: Map<string, unknown>): GridPoint[] {
  if (!memo.has('gp-fig-grid')) {
    const taus = [...gridRange(0.8, 1.6, 0.005), ...gridRange(2.3, 2.6, 0.005)];
    memo.set('gp-fig-grid', gpSteady(runOk(gpOnGrid(taus), []), taus, ['cv1_pct', 'cv2_pct', 'y', 'transfer', 'c1_prev']));
  }
  return memo.get('gp-fig-grid') as GridPoint[];
}

/** Parse a number out of an anchor result's `details.actual` string. */
function anchorNumber(r: AnchorTestResult, re: RegExp, index = 1): number {
  const m = r.details?.actual.match(re);
  if (!m) throw new Error(`${r.testId}: cannot read a value from "${r.details?.actual ?? r.reason}"`);
  return Number(m[index]);
}

/** Model value per anchor test, in the units of its assertion (see validation/anchorTests.ts). */
function anchorValue(r: AnchorTestResult): number {
  const m = r.details?.metrics ?? {};
  switch (r.testId) {
    case 'AT-1': return m.wellbeingDelta;
    case 'AT-2': return m.finalWellbeing / m.initialWellbeing;
    case 'AT-3': return anchorNumber(r, /Max race-to-bottom risk: ([-\d.]+)/);
    case 'AT-4': return anchorNumber(r, /→ ([-\d.]+)/) - anchorNumber(r, /Contribution rate: ([-\d.]+)/);
    case 'AT-5': return m.difference;
    case 'AT-6': return anchorNumber(r, /Diff: ([-\d.]+)%/) / 100;
    default: throw new Error(`no value rule for anchor ${r.testId}`);
  }
}

const HINDCAST_FROM = 2015;
const HINDCAST_TO = 2025;

function hindcastRuns(ctx: NonNullable<ComputeContext['hindcast']>, memo: Map<string, unknown>): Record<string, HindcastRun> {
  if (!memo.has('hindcast')) {
    const base = { actuals: ctx.actuals, fromYear: ctx.fromYear ?? HINDCAST_FROM, toYear: ctx.toYear ?? HINDCAST_TO } as const;
    const anchored = PRESET_MODELS.find((m) => m.id === 'evidence-anchored');
    if (!anchored) throw new Error('constants.ts PRESET_MODELS has no evidence-anchored preset');
    memo.set('hindcast', {
      'ai-off': runHindcast({ ...base, aiOff: true }),
      'ai-off-ubi-on': runHindcast({ ...base, aiOff: true, corpContributionRate: null, label: 'AI off, UBI on' }),
      'ai-on': runHindcast({ ...base, aiOff: false }),
      'anchored-ai-off': runHindcast({ ...base, aiOff: true, params: anchored, label: 'Anchored, AI off' }),
      'anchored-ai-on': runHindcast({ ...base, aiOff: false, params: anchored, label: 'Anchored, AI on' }),
    });
  }
  return memo.get('hindcast') as Record<string, HindcastRun>;
}

const groupKey = (spec: { model: string; overlays?: string[]; params?: Record<string, number> }) =>
  JSON.stringify([spec.model, spec.overlays ?? [], Object.entries(spec.params ?? {}).sort()]);

/**
 * Compute the model value of every non-retired entry with a compute spec. Entries without one are
 * absent from the map. Errors are captured per entry, never thrown.
 */
export function computeLedger(entries: LedgerEntry[], ctx: ComputeContext = {}): Map<string, ComputeResult> {
  const out = new Map<string, ComputeResult>();
  const memo = new Map<string, unknown>();
  const live = entries.filter((e) => !e.retired && e.compute);
  const guard = (id: string, f: () => ComputeResult) => {
    try {
      out.set(id, f());
    } catch (err) {
      out.set(id, { value: null, error: err instanceof Error ? err.message : String(err) });
    }
  };

  // core-expr: one runTests per (model, overlays, params) with every expression as a test.
  const exprGroups = new Map<string, LedgerEntry[]>();
  for (const e of live) {
    if (e.compute!.kind !== 'core-expr') continue;
    const k = groupKey(e.compute as Extract<ComputeSpec, { kind: 'core-expr' }>);
    exprGroups.set(k, [...(exprGroups.get(k) ?? []), e]);
  }
  for (const group of exprGroups.values()) {
    const spec0 = group[0].compute as Extract<ComputeSpec, { kind: 'core-expr' }>;
    try {
      const fx = findFixture(spec0.model);
      if (!fx) throw new Error(`unknown core model "${spec0.model}"`);
      const overlays = fixtureOverlays(spec0.model, spec0.overlays);
      if (spec0.params && Object.keys(spec0.params).length) overlays.push(setting(spec0.params));
      const tests: ModelTest[] = group.map((e) => {
        const s = e.compute as Extract<ComputeSpec, { kind: 'core-expr' }>;
        return { name: e.id, at: s.at, expr: s.expr, entity: s.entity, expected: 0, tol: 0 };
      });
      const outcomes = runTests({ ...fx.model, tests }, { overlays });
      for (const e of group) {
        const o = outcomes.find((x) => x.name === e.id);
        out.set(e.id, o && o.actual !== null && Number.isFinite(o.actual) ? { value: o.actual } : { value: null, error: o?.message ?? 'expression not evaluated' });
      }
    } catch (err) {
      for (const e of group) out.set(e.id, { value: null, error: err instanceof Error ? err.message : String(err) });
    }
  }

  let korinek: Map<string, KorinekOutcome> | undefined;
  let anchors: Map<string, AnchorTestResult> | undefined;
  const cases = new Map<string, ReturnType<typeof runPolicyCase>>();
  const infile = new Map<string, ReturnType<typeof runTests>>();

  for (const e of live) {
    const c = e.compute!;
    switch (c.kind) {
      case 'core-expr':
        break;
      case 'core-infile':
        guard(e.id, () => {
          const k = `${c.model}/${c.overlay ?? ''}`;
          if (!infile.has(k)) {
            const fx = findFixture(c.model);
            if (!fx) throw new Error(`unknown core model "${c.model}"`);
            infile.set(k, c.overlay ? runTests({ ...fx.model, tests: [] }, { overlays: fixtureOverlays(c.model, [c.overlay], true) }) : runTests(fx.model));
          }
          const o = infile.get(k)!.find((x) => x.name === c.test);
          if (!o) throw new Error(`in-file test not found: ${k}::${c.test}`);
          if (o.actual === null) throw new Error(o.message);
          return { value: o.actual };
        });
        break;
      case 'derived':
        guard(e.id, () => {
          const f = DERIVED[c.fn];
          if (!f) throw new Error(`unknown derived computation "${c.fn}"`);
          return { value: f(c.args ?? {}, memo) };
        });
        break;
      case 'korinek-ts':
        guard(e.id, () => {
          korinek ??= new Map(KORINEK_SCENARIOS.map((s) => [s.id, runKorinekScenario(s)]));
          const o = korinek.get(c.scenario);
          if (!o) throw new Error(`no Korinek scenario "${c.scenario}"`);
          return { value: o[c.metric] };
        });
        break;
      case 'policy-case':
        guard(e.id, () => {
          if (c.case !== 'alaska-pfd') throw new Error(`no bundled case "${c.case}"`);
          if (!cases.has(c.case)) cases.set(c.case, runPolicyCase(alaskaCase as unknown as PolicyCase));
          const report = cases.get(c.case)!;
          if (report.errors.length) throw new Error(report.errors.join('; '));
          const r = report.results.find((x) => x.outcome === c.outcome && (c.target === 'none' ? x.status === 'outside-model' : c.target === 'core-model' ? x.status === 'mapped' : x.status === 'mechanism-absent' || x.status === 'mechanism-present'));
          if (!r) throw new Error(`case ${c.case}: no ${c.target} result for outcome "${c.outcome}"`);
          if (r.status === 'mapped') return { value: r.modelValue };
          if (r.status === 'outside-model') return { value: null, forcedStatus: 'outside-model' };
          // A structural check: absent mechanism = the model is silent; present = a mapping now exists but has no target.
          const diff = r.detail.unemploymentTransfer - r.detail.unemploymentNoTransfer;
          return { value: diff, forcedStatus: r.status === 'mechanism-absent' ? 'outside-model' : 'not-checked' };
        });
        break;
      case 'anchor':
        guard(e.id, () => {
          anchors ??= new Map(runAllAnchorTests().results.map((r) => [r.testId, r]));
          const r = anchors.get(c.testId);
          if (!r) throw new Error(`no anchor test "${c.testId}"`);
          const value = anchorValue(r);
          const inside = withinTolerance(value, e.published.value, e.tolerance);
          if (inside !== r.passed) throw new Error(`${c.testId}: ledger bound says ${inside ? 'pass' : 'fail'} but the harness says ${r.passed ? 'pass' : 'fail'} (${r.reason}) - the ledger target no longer matches validation/anchorTests.ts`);
          return { value };
        });
        break;
      case 'hindcast':
        if (!ctx.hindcast) {
          out.set(e.id, { value: null, skipped: 'hindcast series not supplied (computed by scripts/ledger.ts only)' });
          break;
        }
        guard(e.id, () => {
          const run = hindcastRuns(ctx.hindcast!, memo)[c.run];
          if (c.metric === 'maeMinusPersistence') {
            const persistence = mean(run.countries.map((x) => Math.abs(x.actualWellbeingChange)));
            return { value: run.score.maeWellbeing - persistence };
          }
          return { value: run.score[c.metric] };
        });
        break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Discovery: the targets the harnesses themselves declare
// ---------------------------------------------------------------------------

/**
 * Keys for every target a harness declares, so an entry cannot vanish while its source remains:
 *   infile:<model>[/<overlay>]::<test name>   every in-file test of every bundled core model
 *   kj:<scenario>:<metric>                    every KORINEK_SCENARIOS target
 *   case:<case>:<outcome>                     every outcome of data/cases/alaska-pfd.json
 *   anchor:<id>                               every ANCHOR_TESTS id
 * (hindcast:HC-1/HC-2 are added by the caller, which knows the hindcast suite exists.)
 */
export function discoverTargetKeys(): string[] {
  const keys: string[] = [];
  for (const fx of CORE_FIXTURES) {
    for (const t of fx.model.tests ?? []) keys.push(`infile:${fx.model.id}::${t.name}`);
    for (const o of fx.overlays) for (const t of o.tests ?? []) keys.push(`infile:${fx.model.id}/${o.id}::${t.name}`);
  }
  for (const s of KORINEK_SCENARIOS) for (const k of Object.keys(s.targets)) keys.push(`kj:${s.id}:${k}`);
  for (const o of (alaskaCase as unknown as PolicyCase).outcomes) keys.push(`case:alaska-pfd:${o.id}`);
  for (const t of ANCHOR_TESTS) keys.push(`anchor:${t.id}`);
  return keys;
}

// ---------------------------------------------------------------------------
// Check rules
// ---------------------------------------------------------------------------

/**
 * Test files that pin a known miss. If the file still contains the pattern, the entry must exist,
 * must not be retired, and must be recorded as something other than reproduced.
 */
export const KNOWN_MISS_PINS: Array<{ file: string; pattern: RegExp; entryId: string; what: string }> = [
  { file: 'src/core/gasteigerPrettner.test.ts', pattern: /published readings this port does not match/, entryId: 'gp-fig3a-p100-tau0.5', what: 'Fig. 3(a) reading 3.9% above the published 0.011' },
  { file: 'src/core/korinekFaithful.test.ts', pattern: /rounded calibration does not reproduce/, entryId: 'kf-table1-rounded-substantial-uAllPct', what: 'rounded Table 1 inputs give u_all 4.53 vs published 4.6' },
  { file: 'validation/anchorTests.test.ts', pattern: /at3\?\.passed\)\.toBe\(false\)/, entryId: 'anchor-AT-3', what: 'AT-3 race-to-bottom risk below its bar' },
  { file: 'validation/policyCases.test.ts', pattern: /studyEstimate\)\.toBe\(0\.001\)/, entryId: 'alaska-employment-rate-estimate', what: 'Alaska employment: calibration -0.7 pp vs estimate +0.1 pp' },
];

/** Heuristic: wording or assertions that usually mean a test pins a failure. */
export const MISS_HINT = /does not match|do(?:es)? not reproduce|pinned discrepancy|\bmiss(?:es|ed)?\b|still fails|\.passed\)\.toBe\(false\)/i;

export interface CheckInput {
  current: Ledger;
  /** Ledger(s) at the comparison base (git HEAD / merge-base with main); ids that must not vanish. */
  previous?: Ledger[];
  computed: Map<string, ComputeResult>;
  /** repo-relative path -> contents, for every *.test.ts(x) file. */
  testFiles: Record<string, string>;
  /** Harness-declared target keys (discoverTargetKeys plus caller additions). */
  targetKeys: string[];
  /** Repo-relative paths that exist, to validate checkedBy references. Omit to skip. */
  existingFiles?: Set<string>;
}

export interface CheckFailure {
  rule: 'a' | 'b' | 'c' | 'schema';
  id?: string;
  message: string;
}

export interface CheckReport {
  failures: CheckFailure[];
  warnings: string[];
}

const DRIFT_REL = 1e-4;

export function checkLedger(input: CheckInput): CheckReport {
  const failures: CheckFailure[] = [];
  const warnings: string[] = [];
  const { current } = input;
  const byId = new Map<string, LedgerEntry>();

  // schema basics
  for (const e of current.entries) {
    if (byId.has(e.id)) failures.push({ rule: 'schema', id: e.id, message: `duplicate id "${e.id}"` });
    byId.set(e.id, e);
    if (!FAMILIES.includes(e.family)) failures.push({ rule: 'schema', id: e.id, message: `unknown family "${e.family}"` });
    if (!STATUSES.includes(e.status)) failures.push({ rule: 'schema', id: e.id, message: `unknown status "${e.status}"` });
    if (e.tolerance.kind === 'none' && !e.classification && !e.retired && e.compute?.kind !== 'policy-case')
      failures.push({ rule: 'schema', id: e.id, message: 'no tolerance and no classification: the status cannot be derived' });
    if (!e.tolerance.setBy) failures.push({ rule: 'schema', id: e.id, message: 'tolerance.setBy is empty (who declared it?)' });
    if (input.existingFiles) {
      for (const ref of e.checkedBy) {
        const file = ref.split(':')[0];
        if (!input.existingFiles.has(file)) failures.push({ rule: 'a', id: e.id, message: `checkedBy file "${file}" no longer exists; retire or re-point the entry` });
      }
    }
  }

  // (a) nothing disappears without a retirement reason
  for (const e of current.entries) {
    if (e.retired && !(e.retired.reason ?? '').trim()) failures.push({ rule: 'a', id: e.id, message: 'retired without a reason' });
  }
  for (const prev of input.previous ?? []) {
    for (const p of prev.entries) {
      if (!byId.has(p.id)) failures.push({ rule: 'a', id: p.id, message: `target "${p.id}" was removed from the ledger; mark it retired with a reason instead` });
    }
  }
  const covered = new Map<string, LedgerEntry>();
  for (const e of current.entries) for (const k of e.covers ?? []) covered.set(k, e);
  const exclusions = current.exclusions.map((x) => ({ re: new RegExp(x.pattern), reason: x.reason }));
  for (const key of input.targetKeys) {
    const entry = covered.get(key);
    if (entry?.retired) warnings.push(`${key} is still declared by a harness but its ledger entry ${entry.id} is retired`);
    if (entry) continue;
    if (exclusions.some((x) => x.re.test(key))) continue;
    failures.push({ rule: 'a', message: `harness target "${key}" has no ledger entry (add one, or an exclusion with a reason)` });
  }

  // (b) computed status must equal recorded status; computations must not silently break
  for (const e of current.entries) {
    if (e.retired) continue;
    const r = input.computed.get(e.id);
    if (e.compute && !r) {
      failures.push({ rule: 'b', id: e.id, message: 'has a compute spec but was not computed' });
      continue;
    }
    if (r?.error) {
      failures.push({ rule: 'b', id: e.id, message: `computation failed: ${r.error}` });
      continue;
    }
    if (r?.skipped) {
      warnings.push(`${e.id}: not computed (${r.skipped}); recorded status "${e.status}" kept`);
      continue;
    }
    const derived = deriveStatus(e, r);
    if (derived === null) {
      if (e.compute) warnings.push(`${e.id}: status cannot be derived from the computed value; recorded "${e.status}" kept`);
    } else if (derived !== e.status) {
      failures.push({ rule: 'b', id: e.id, message: `computed status "${derived}" differs from recorded "${e.status}" (model ${fmt(r?.value ?? null)} vs published ${fmt(e.published.value)}); record it deliberately with npm run ledger -- --write` });
    }
    if (r && r.value !== null && e.model.value !== null) {
      const scale = Math.max(Math.abs(e.model.value), Math.abs(r.value), 1e-12);
      if (Math.abs(r.value - e.model.value) / scale > DRIFT_REL && Math.abs(r.value - e.model.value) > 1e-12)
        warnings.push(`${e.id}: model value drifted ${fmt(e.model.value)} -> ${fmt(r.value)} (status unchanged); re-record with npm run ledger -- --write`);
    } else if (r && (r.value === null) !== (e.model.value === null)) {
      warnings.push(`${e.id}: model value ${e.model.value === null ? 'now computable' : 'no longer computed'}; re-record with npm run ledger -- --write`);
    }
  }

  // (c) a test file that pins a known miss must have its ledger entry
  for (const pin of KNOWN_MISS_PINS) {
    const text = input.testFiles[pin.file];
    if (text === undefined || !pin.pattern.test(text)) continue;
    const e = byId.get(pin.entryId);
    if (!e || e.retired) failures.push({ rule: 'c', id: pin.entryId, message: `${pin.file} pins a known miss (${pin.what}) but the ledger has no live entry "${pin.entryId}"` });
    else if (e.status === 'reproduced') failures.push({ rule: 'c', id: pin.entryId, message: `${pin.file} pins a known miss (${pin.what}) but the ledger records it as reproduced` });
  }
  const referenced = new Set(current.entries.flatMap((e) => e.checkedBy.map((r) => r.split(':')[0])));
  const exempt = new Set(current.scanExemptions.map((x) => x.file));
  for (const [file, text] of Object.entries(input.testFiles)) {
    if (referenced.has(file) || exempt.has(file) || !MISS_HINT.test(text)) continue;
    failures.push({ rule: 'c', message: `${file} looks like it pins a miss (${text.match(MISS_HINT)![0]}) but no ledger entry references it; add an entry or a scanExemption with a reason` });
  }

  return { failures, warnings };
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

/** Round to 6 significant digits for storage. */
export function roundForStorage(x: number | null): number | null {
  if (x === null || !Number.isFinite(x)) return x === null ? null : x;
  return x === 0 ? 0 : Number(x.toPrecision(6));
}

/** The ledger with computed values, discrepancies and derived statuses written in. */
export function recordComputed(ledger: Ledger, computed: Map<string, ComputeResult>): { ledger: Ledger; changes: string[] } {
  const changes: string[] = [];
  const entries = ledger.entries.map((e) => {
    if (e.retired) return e;
    const r = computed.get(e.id);
    if (!r || r.error || r.skipped) return e;
    const value = r.value === null ? e.model.value : roundForStorage(r.value);
    const status = deriveStatus(e, r) ?? e.status;
    if (status !== e.status) changes.push(`${e.id}: ${e.status} -> ${status}`);
    return {
      ...e,
      model: { ...e.model, value, computed: r.value !== null },
      discrepancy: roundForStorage(discrepancyOf(r.value, e.published.value)),
      status,
    };
  });
  return { ledger: { ...ledger, entries }, changes };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function fmt(x: number | null | undefined): string {
  if (x === null || x === undefined) return '—';
  if (!Number.isFinite(x)) return String(x);
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e4 || a < 1e-3) return x.toExponential(3);
  return String(Number(x.toPrecision(4)));
}

const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function tolText(t: Tolerance): string {
  switch (t.kind) {
    case 'abs': return `±${fmt(t.value)}`;
    case 'relative': return `±${fmt(t.value * 100)}%`;
    case 'lt': return '< target';
    case 'lte': return '≤ target';
    case 'gt': return '> target';
    case 'gte': return '≥ target';
    case 'none': return 'none';
  }
}

export function summarise(entries: LedgerEntry[]): { byFamily: Record<string, Record<Status, number>>; totals: Record<Status, number>; live: number; retired: number } {
  const zero = () => Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  const byFamily: Record<string, Record<Status, number>> = {};
  const totals = zero();
  let live = 0;
  for (const e of entries) {
    if (e.retired) continue;
    live++;
    byFamily[e.family] ??= zero();
    byFamily[e.family][e.status]++;
    totals[e.status]++;
  }
  return { byFamily, totals, live, retired: entries.length - live };
}

/** Deterministic markdown (no timestamps), so --check can tell whether the committed doc is current. */
export function renderLedgerMarkdown(ledger: Ledger): string {
  const L: string[] = [];
  const { byFamily, totals, live, retired } = summarise(ledger.entries);
  L.push('# Reference-target ledger', '');
  L.push('Generated by `npm run ledger` from `data/ledger/reference-targets.json`. Do not edit by hand.', '');
  L.push(
    'Every external reference target the repository claims to check, with its current status. A regression test that pins a miss keeps passing; this ledger is where the miss stays recorded (review 2026-09-14, finding 10). `npm run ledger -- --check` (part of `npm run check`) fails when a target disappears without a retirement reason, when a computed status differs from the recorded one, or when a test file that pins a known miss has no entry.',
    '',
  );
  L.push(
    '**Re-recording after an engine or data change.** Hindcast and anchor values depend on the country and corporation tables (a versioned country-data migration is in progress), and every computable value is recomputed by the script. After a deliberate change, run `npm run ledger -- --write`: it recomputes every entry, rewrites model values, discrepancies and statuses in the JSON, prints every status change, and regenerates this file. Review the printed status changes before committing - a new miss or a silent fix must be a visible diff.',
    '',
  );
  L.push('Statuses: **reproduced** (inside the declared tolerance); **reproduced-with-caveat** (inside, with a stated qualification such as a timing mismatch, a fitted target or an in-sample score); **missed** (outside the tolerance or failing); **not-checked** (the target exists but nothing tests it); **not-verified** (the source value itself is unverified); **outside-model** (the model has no mechanism for the quantity).', '');
  L.push(`## Summary (${live} live targets${retired ? `, ${retired} retired` : ''})`, '');
  L.push(`| Family | ${STATUSES.join(' | ')} | total |`);
  L.push(`|---|${STATUSES.map(() => '---:').join('|')}|---:|`);
  for (const f of FAMILIES) {
    const row = byFamily[f];
    if (!row) continue;
    L.push(`| ${f} | ${STATUSES.map((s) => row[s] || '').join(' | ')} | ${STATUSES.reduce((n, s) => n + row[s], 0)} |`);
  }
  L.push(`| **all** | ${STATUSES.map((s) => `**${totals[s]}**`).join(' | ')} | **${live}** |`, '');

  const attention = ledger.entries.filter((e) => !e.retired && e.status !== 'reproduced' && e.status !== 'reproduced-with-caveat');
  L.push('## Misses and unchecked targets', '');
  L.push('| Id | Status | Quantity | Published | Model | Discrepancy | Tolerance | Notes |');
  L.push('|---|---|---|---:|---:|---:|---|---|');
  for (const s of ['missed', 'not-verified', 'not-checked', 'outside-model'] as Status[]) {
    for (const e of attention.filter((x) => x.status === s)) {
      L.push(`| \`${e.id}\` | **${e.status}** | ${esc(e.quantity)} | ${pubText(e)} | ${fmt(e.model.value)} | ${fmt(e.discrepancy)} | ${tolText(e.tolerance)} | ${esc(e.notes ?? e.caveat ?? '')} |`);
    }
  }
  L.push('');

  for (const f of FAMILIES) {
    const rows = ledger.entries.filter((e) => e.family === f && !e.retired);
    if (!rows.length) continue;
    L.push(`## ${f}`, '');
    L.push('| Id | Source | Quantity (units) | Published | Model | Discrepancy | Tolerance (set by) | Status | Checked by | Notes |');
    L.push('|---|---|---|---:|---:|---:|---|---|---|---|');
    for (const e of rows) {
      const model = e.compute === null
        ? `${fmt(e.model.value)} (not computable${e.model.value !== null ? '; recorded value' : ''})`
        : `${fmt(e.model.value)}${e.model.value !== null && !e.model.computed ? ' (recorded, not computed)' : ''}`;
      const status = e.status === 'reproduced-with-caveat' && e.caveat ? `${e.status}: ${esc(e.caveat)}` : e.status;
      L.push(
        `| \`${e.id}\` | ${esc(e.source.citation)}, ${esc(e.source.locator)} | ${esc(e.quantity)} (${esc(e.units)}) | ${pubText(e)} | ${model} | ${fmt(e.discrepancy)} | ${tolText(e.tolerance)} (${esc(e.tolerance.setBy)}) | ${status} | ${e.checkedBy.map((c) => `\`${c}\``).join(', ') || '—'} | ${esc(e.notes ?? '')} |`,
      );
    }
    L.push('');
  }

  const gone = ledger.entries.filter((e) => e.retired);
  if (gone.length) {
    L.push('## Retired', '', '| Id | Retired | Reason |', '|---|---|---|');
    for (const e of gone) L.push(`| \`${e.id}\` | ${e.retired!.date} | ${esc(e.retired!.reason)} |`);
    L.push('');
  }
  L.push('## Exclusions (harness tests that are not reference targets)', '', '| Pattern | Reason |', '|---|---|');
  for (const x of ledger.exclusions) L.push(`| \`${esc(x.pattern)}\` | ${esc(x.reason)} |`);
  L.push('');
  return L.join('\n');
}

function pubText(e: LedgerEntry): string {
  const v = e.published.display ?? fmt(e.published.value);
  return e.published.uncertainty ? `${esc(v)} (${esc(e.published.uncertainty)})` : esc(v);
}

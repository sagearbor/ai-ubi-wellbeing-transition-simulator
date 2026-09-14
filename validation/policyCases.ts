/**
 * Policy-effect cases (v3 plan section 8, evaluation category 4; stage 4 "one exactly mapped
 * historical policy case").
 *
 * PURE - no I/O. A case record (data/cases/*.json) carries a published treatment contrast with its
 * own estimate, denominator, period, inference and funding boundary, and a list of mappings: which
 * model, if any, speaks to each outcome. This module runs those mappings and reports, per outcome:
 *
 *   - mapped: the model's value in the outcome's own units, the signed discrepancy (model minus
 *     study), the study's own 95% interval, and the model-side spread across declared alternatives
 *     (kept separate from the study interval; neither is widened to make the other look better);
 *   - mechanism-absent / mechanism-present: a structural check run on the world engine;
 *   - outside-model: the reason no model speaks to it.
 *
 * There is deliberately no pass/fail grade and no "within interval" rule (v3 section 8 removes
 * both). The one hard failure is coverage: an outcome no mapping accounts for, or a mapping that
 * cannot run.
 */

import { runModel } from '../src/core/engine';
import { findFixture } from '../src/core/fixtures';
import type { Overlay } from '../src/core/types';
import { initialRun, advanceRun, initOptionsFor } from '../simulation/run';
import { BASE_LABOR_SHARE } from '../simulation/pure';
import { INITIAL_CORPORATIONS, PRESET_MODELS } from '../constants';

// ---------------------------------------------------------------------------
// Case record shape (mirrors data/cases/*.json)
// ---------------------------------------------------------------------------

export interface CaseOutcome {
  id: string;
  headline: boolean;
  label: string;
  denominator: string;
  unit: string;
  estimate: number;
  ci95: [number, number];
  pValue: number;
  preFitRmsePercentile?: number;
  source: string;
  robustnessRange?: [number, number];
  fragility?: string;
}

export type CaseMapping =
  | {
      outcome: string;
      target: 'core-model';
      model: string;
      expr: string;
      at: number;
      alternatives?: { label: string; overlays: string[] }[];
      classification: string;
      fittedToOutcome: boolean;
      independence?: string;
      applicability?: string;
    }
  | {
      outcome: string;
      target: 'world-engine';
      model: string;
      check: 'transfer-moves-unemployment';
      classification: string;
      note?: string;
    }
  | { outcome: string; target: 'none'; status: 'outside-model'; reason: string };

export interface PolicyCase {
  id: string;
  title: string;
  category: string;
  extraction: string;
  citation: Record<string, unknown>;
  treatment: { dose?: { dividendsToLabourIncome?: number } } & Record<string, unknown>;
  method: Record<string, unknown>;
  fundingBoundary: string;
  outcomes: CaseOutcome[];
  mappings: CaseMapping[];
  limits: string[];
}

// ---------------------------------------------------------------------------
// Report shape
// ---------------------------------------------------------------------------

export interface MappedResult {
  outcome: string;
  status: 'mapped';
  model: string;
  classification: string;
  fittedToOutcome: boolean;
  independence?: string;
  applicability?: string;
  unit: string;
  modelValue: number;
  studyEstimate: number;
  /** modelValue - studyEstimate, in the outcome's units. */
  discrepancy: number;
  studyCi95: [number, number];
  /** Model values under each declared alternative, including the default. Not a probability interval. */
  modelAlternatives: { label: string; value: number }[];
  modelSpread: [number, number];
}

export interface StructuralResult {
  outcome: string;
  status: 'mechanism-absent' | 'mechanism-present';
  model: string;
  classification: string;
  note?: string;
  detail: {
    country: string;
    months: number;
    /** Unemployment rate (0-1) with every corporation contributing 0 / 0.5. */
    unemploymentNoTransfer: number;
    unemploymentTransfer: number;
    /** Monthly transfer per person in the transfer run, as a share of monthly labour income. */
    transferShareOfLabourIncome: number;
    /** The case's own dose on the same basis, when the record gives one. */
    caseTransferShare: number | null;
  };
}

export interface OutsideResult {
  outcome: string;
  status: 'outside-model';
  reason: string;
}

export type OutcomeResult = MappedResult | StructuralResult | OutsideResult;

export interface CaseReport {
  caseId: string;
  title: string;
  results: OutcomeResult[];
  /** Outcomes in the record that no mapping accounts for. Non-empty is a failure. */
  unaccounted: string[];
  /** Mappings that could not run (unknown model, failing run, unknown outcome). Non-empty is a failure. */
  errors: string[];
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

function runCoreMapping(m: Extract<CaseMapping, { target: 'core-model' }>, outcome: CaseOutcome, errors: string[]): MappedResult | null {
  const fixture = findFixture(m.model);
  if (!fixture) {
    errors.push(`${m.outcome}: unknown core model "${m.model}"`);
    return null;
  }
  const valueWith = (overlayIds: string[]): number | null => {
    const overlays: Overlay[] = [];
    for (const id of overlayIds) {
      const o = fixture.overlays.find((x) => x.id === id);
      if (!o) {
        errors.push(`${m.outcome}: model "${m.model}" has no overlay "${id}"`);
        return null;
      }
      overlays.push(o);
    }
    const res = runModel(fixture.model, { overlays });
    if (!res.ok) {
      errors.push(`${m.outcome}: ${m.model} run failed: ${res.diagnostics.filter((d) => d.level === 'error').map((d) => d.message).join('; ')}`);
      return null;
    }
    const t = res.years.findIndex((y) => y === m.at);
    const series = res.series['_']?.[m.expr];
    if (t < 0 || !series) {
      errors.push(`${m.outcome}: ${m.model} has no "${m.expr}" at ${m.at}`);
      return null;
    }
    return series[t];
  };

  const modelValue = valueWith([]);
  if (modelValue === null) return null;
  const alternatives: { label: string; value: number }[] = [{ label: 'default', value: modelValue }];
  for (const alt of m.alternatives ?? []) {
    const v = valueWith(alt.overlays);
    if (v === null) return null;
    alternatives.push({ label: alt.label, value: v });
  }
  const values = alternatives.map((a) => a.value);
  return {
    outcome: m.outcome,
    status: 'mapped',
    model: m.model,
    classification: m.classification,
    fittedToOutcome: m.fittedToOutcome,
    independence: m.independence,
    applicability: m.applicability,
    unit: outcome.unit,
    modelValue,
    studyEstimate: outcome.estimate,
    discrepancy: modelValue - outcome.estimate,
    studyCi95: outcome.ci95,
    modelAlternatives: alternatives,
    modelSpread: [Math.min(...values), Math.max(...values)],
  };
}

export const STRUCTURAL_CHECK_COUNTRY = 'USA';
export const STRUCTURAL_CHECK_MONTHS = 24;

/**
 * Does a transfer move unemployment in the world engine? Runs the named preset twice from the same
 * initial state with every corporation's contribution pinned at 0 and at 0.5 each month (the
 * engine's adaptive policy would otherwise move it), and compares the country's unemployment.
 */
function runTransferUnemploymentCheck(
  m: Extract<CaseMapping, { target: 'world-engine' }>,
  caseRecord: PolicyCase,
  errors: string[],
): StructuralResult | null {
  const preset = PRESET_MODELS.find((p) => p.id === m.model);
  if (!preset) {
    errors.push(`${m.outcome}: unknown preset "${m.model}"`);
    return null;
  }
  if (!preset.macro) {
    errors.push(`${m.outcome}: preset "${m.model}" has no macro block, so it has no unemployment state to check`);
    return null;
  }
  const simulate = (rate: number) => {
    const pin = (cs: typeof INITIAL_CORPORATIONS) => cs.map((c) => ({ ...c, contributionRate: rate }));
    let run = initialRun(pin(INITIAL_CORPORATIONS), undefined, initOptionsFor(preset));
    for (let i = 0; i < STRUCTURAL_CHECK_MONTHS; i++) {
      run = advanceRun(run, { model: preset });
      run = { ...run, corporations: pin(run.corporations) };
    }
    return run.state.countryData[STRUCTURAL_CHECK_COUNTRY];
  };
  const off = simulate(0);
  const on = simulate(0.5);
  if (!off || !on || off.unemployment === undefined || on.unemployment === undefined) {
    errors.push(`${m.outcome}: ${STRUCTURAL_CHECK_COUNTRY} has no unemployment state under "${m.model}"`);
    return null;
  }
  // Actual labour income per resident (GDP x labour share), the same basis as the case's dividends/labour income.
  const labourIncomeMonthly = (on.gdpPerCapita * (on.laborShare ?? BASE_LABOR_SHARE)) / 12;
  const moved = Math.abs(on.unemployment - off.unemployment) > 1e-12;
  return {
    outcome: m.outcome,
    status: moved ? 'mechanism-present' : 'mechanism-absent',
    model: m.model,
    classification: m.classification,
    note: m.note,
    detail: {
      country: STRUCTURAL_CHECK_COUNTRY,
      months: STRUCTURAL_CHECK_MONTHS,
      unemploymentNoTransfer: off.unemployment,
      unemploymentTransfer: on.unemployment,
      transferShareOfLabourIncome: labourIncomeMonthly > 0 ? (on.totalUbiReceived ?? 0) / labourIncomeMonthly : 0,
      caseTransferShare: caseRecord.treatment.dose?.dividendsToLabourIncome ?? null,
    },
  };
}

export function runPolicyCase(caseRecord: PolicyCase): CaseReport {
  const errors: string[] = [];
  const results: OutcomeResult[] = [];
  const byId = new Map(caseRecord.outcomes.map((o) => [o.id, o] as [string, CaseOutcome]));

  for (const m of caseRecord.mappings) {
    const outcome = byId.get(m.outcome);
    if (!outcome) {
      errors.push(`mapping refers to unknown outcome "${m.outcome}"`);
      continue;
    }
    if (m.target === 'core-model') {
      const r = runCoreMapping(m, outcome, errors);
      if (r) results.push(r);
    } else if (m.target === 'world-engine') {
      const r = runTransferUnemploymentCheck(m, caseRecord, errors);
      if (r) results.push(r);
    } else {
      results.push({ outcome: m.outcome, status: 'outside-model', reason: m.reason });
    }
  }

  const accounted = new Set(caseRecord.mappings.map((m) => m.outcome));
  return {
    caseId: caseRecord.id,
    title: caseRecord.title,
    results,
    unaccounted: caseRecord.outcomes.filter((o) => !accounted.has(o.id)).map((o) => o.id),
    errors,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const asPp = (unit: string, x: number) => (unit === 'proportion' ? `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)} pp` : `${x >= 0 ? '+' : ''}${x.toFixed(3)} ${unit}`);

export function renderCaseMarkdown(caseRecord: PolicyCase, report: CaseReport): string {
  const L: string[] = [];
  L.push(`## ${caseRecord.title} (\`${caseRecord.id}\`, ${caseRecord.category})`, '');
  L.push(`Funding boundary: ${caseRecord.fundingBoundary}`, '');
  L.push('| Outcome | study estimate (95% CI, p) | status | model value | discrepancy (model − study) | model spread across declared alternatives |');
  L.push('|---|---|---|---|---|---|');
  for (const o of caseRecord.outcomes) {
    const study = `${asPp(o.unit, o.estimate)} [${asPp(o.unit, o.ci95[0])}, ${asPp(o.unit, o.ci95[1])}], p ${o.pValue}`;
    const rs = report.results.filter((r) => r.outcome === o.id);
    if (rs.length === 0) L.push(`| ${o.label}${o.headline ? ' **(headline)**' : ''} | ${study} | **UNACCOUNTED** | | | |`);
    for (const r of rs) {
      if (r.status === 'mapped') {
        L.push(`| ${o.label}${o.headline ? ' **(headline)**' : ''} | ${study} | mapped: \`${r.model}\` | ${asPp(o.unit, r.modelValue)} | ${asPp(o.unit, r.discrepancy)} | ${asPp(o.unit, r.modelSpread[0])} to ${asPp(o.unit, r.modelSpread[1])} |`);
      } else if (r.status === 'outside-model') {
        L.push(`| ${o.label}${o.headline ? ' **(headline)**' : ''} | ${study} | outside model: ${r.reason} | — | — | — |`);
      } else {
        const d = r.detail;
        L.push(`| ${o.label}${o.headline ? ' **(headline)**' : ''} | ${study} | ${r.status} in world engine \`${r.model}\` (${d.country}, ${d.months} mo: unemployment ${(d.unemploymentNoTransfer * 100).toFixed(2)}% without vs ${(d.unemploymentTransfer * 100).toFixed(2)}% with transfers) | not a prediction | — | — |`);
      }
    }
  }
  const mapped = report.results.filter((r): r is MappedResult => r.status === 'mapped');
  for (const r of mapped) {
    L.push('', `**${r.outcome} → \`${r.model}\`.** ${r.classification}. Fitted to this outcome: ${r.fittedToOutcome ? 'yes (calibration, not a benchmark)' : 'no'}.`);
    if (r.independence) L.push(`Independence: ${r.independence}`);
    if (r.applicability) L.push(`Applicability: ${r.applicability}`);
    L.push(`Alternatives: ${r.modelAlternatives.map((a) => `${a.label} ${asPp(r.unit, a.value)}`).join('; ')}.`);
  }
  for (const r of report.results.filter((x): x is StructuralResult => x.status !== 'mapped' && x.status !== 'outside-model')) {
    const d = r.detail;
    L.push('', `**${r.outcome} → world engine \`${r.model}\`: ${r.status}.** ${r.note ?? ''} Transfer in the check run: ${(d.transferShareOfLabourIncome * 100).toFixed(2)}% of labour income` +
      (d.caseTransferShare !== null ? ` (the case's dose: ${(d.caseTransferShare * 100).toFixed(2)}%).` : '.'));
  }
  L.push('', 'Limits:', ...caseRecord.limits.map((x) => `- ${x}`));
  if (report.unaccounted.length) L.push('', `**Unaccounted outcomes:** ${report.unaccounted.join(', ')}`);
  if (report.errors.length) L.push('', `**Errors:** ${report.errors.join('; ')}`);
  return L.join('\n');
}

/**
 * Decision memo — a Markdown record of one paired run, written so it cannot be read as more than
 * it is: which text, who drafted and reviewed the reading, every provision and what happened to it,
 * the assumptions the numbers rest on, the paired result with its spread, what bound, what the
 * model cannot say, and the manifest to reproduce it.
 */

import { steadyStateOf, timeLabel, timeUnitName } from '../core/calendar';
import { resolveModel } from '../core/engine';
import type { CoreModel, EvidenceKind, Overlay } from '../core/types';
import { coverage, mappingUnits, normaliseWhitespace } from './draft';
import type { DraftDiagnostic, PairedRunResult, PolicyDraft, Quantiles } from './types';

export interface MemoInput {
  model: CoreModel;
  overlays: Overlay[];
  draft: PolicyDraft;
  result: PairedRunResult;
  diagnostics?: DraftDiagnostic[];
  /** The source text, when available: source-clause coverage is measured against it. */
  sourceText?: string;
  /** Years to report; defaults to every step for yearly models and each whole year for monthly ones (at most 12 rows). */
  years?: number[];
  /** 'imported': the model was loaded into the Lab, not shipped with the app; the memo says it is experimental. */
  modelStatus?: 'curated' | 'imported';
}

const ASSUMPTION_KINDS: EvidenceKind[] = ['guess', 'assumed'];

const REVIEW_TEXT: Record<PolicyDraft['reviewStatus'], string> = {
  'ai-drafted': 'AI-drafted, not reviewed. Every provision needs checking against the source.',
  'author-drafted': 'Drafted by the named author, not independently reviewed.',
  'human-reviewed': 'Reviewed by the named person against the source text.',
};

/** Escape a value for a Markdown table cell. */
export function cell(text: unknown): string {
  return normaliseWhitespace(String(text ?? '')).replace(/\|/g, '\\|');
}

export function fmtNumber(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return 'n/a';
  const abs = Math.abs(x);
  if (abs !== 0 && (abs < 0.001 || abs >= 1e12)) return x.toExponential(3);
  const digits = abs >= 1000 ? 0 : abs >= 1 ? 2 : 4;
  return x.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

/** Calendar years print as years; fractional (monthly) steps keep two decimals. */
export function fmtYear(y: number): string {
  return Number.isInteger(y) ? String(y) : y.toFixed(2);
}

function band(q: Quantiles | undefined, t: number): string {
  if (!q) return 'n/a';
  return `${fmtNumber(q.p50[t])} [${fmtNumber(q.p5[t])}, ${fmtNumber(q.p95[t])}]`;
}

function reportSteps(result: PairedRunResult, years?: number[]): number[] {
  const all = result.years.map((_, i) => i);
  if (years?.length) return all.filter((i) => years.some((y) => Math.abs(result.years[i] - y) < 1e-9));
  const whole = all.filter((i) => Math.abs(result.years[i] - Math.round(result.years[i])) < 1e-9);
  if (whole.length <= 12) return whole;
  const stride = Math.ceil(whole.length / 12);
  return whole.filter((_, k) => k % stride === 0 || k === whole.length - 1);
}

export function renderMemo(input: MemoInput): string {
  const { model, overlays, draft, result } = input;
  const cov = coverage(draft, input.sourceText);
  const lines: string[] = [];
  const push = (...xs: string[]) => lines.push(...xs);
  const { model: resolved } = resolveModel(model, overlays);

  push(`# Decision memo: ${draft.title}`, '');
  push(
    '> This memo reports what one model does with one reading of a policy text. It is not a prediction of the policy\'s real-world effect. ' +
      'The reading is a draft; the numbers are the model\'s, and they are only as good as the assumptions listed below.',
    '',
  );

  // -- source and review ------------------------------------------------------
  push('## Source and review', '');
  push(`- **Source:** ${draft.source.title}${draft.source.url ? ` — ${draft.source.url}` : ''}`);
  if (draft.source.excerptNote) push(`- **Excerpt:** ${draft.source.excerptNote}`);
  push(`- **Text checked:** ${draft.source.excerptChars.toLocaleString('en-US')} characters${draft.source.textSha256 ? `, SHA-256 ${draft.source.textSha256}` : ''}`);
  push(`- **Review status:** \`${draft.reviewStatus}\` — ${REVIEW_TEXT[draft.reviewStatus] ?? ''}`);
  if (draft.draftedBy) push(`- **Drafted by:** ${draft.draftedBy.name} (${draft.draftedBy.kind}${draft.draftedBy.date ? `, ${draft.draftedBy.date}` : ''})`);
  if (draft.reviewedBy) push(`- **Reviewed by:** ${draft.reviewedBy.name}${draft.reviewedBy.date ? ` (${draft.reviewedBy.date})` : ''}`);
  push(`- **Model:** ${model.name} (\`${model.id}\`, version ${result.manifest.modelHash})`);
  if (input.modelStatus === 'imported') push('- **Model status:** experimental — not curated. This model was imported into the Lab from a file; it is not one of the app\'s reviewed models.');
  if (model.time?.stepLabel) push(`- **Time unit:** one step is one ${model.time.stepLabel}${model.time.stepYears ? ` (${model.time.stepYears} years)` : ''}; the ${model.time.stepLabel} column counts ${model.time.stepLabel}s, not calendar years.`);
  if (overlays.length) push(`- **Scenario overlays on both sides:** ${overlays.map((o) => `\`${o.id}\``).join(', ')}`);
  push(`- **Provisions listed:** ${cov.text}; ${cov.statusText}. This counts only what the draft lists.`);
  push(`- **Source coverage:** ${cov.source.text}${cov.source.status === 'complete' || cov.source.status === 'incomplete' ? ` (clause inventory ${cov.source.inventoryVersion})` : ''}.`);
  if (cov.source.uncovered.length) push(`  - Neither quoted nor excluded: ${cov.source.uncovered.map((id) => `\`${id}\``).join(', ')}`);
  push(`- **Operative coverage:** ${cov.operative.text}.`);
  push(`- **Completeness:** ${cov.completeness.text}.${cov.completeness.attested && cov.completeness.attestation ? ` Statement: "${normaliseWhitespace(cov.completeness.attestation.statement)}"` : ' No person has attested that the provisions and exclusions cover the whole text.'}`);
  if (draft.notes) push(`- **Drafting notes:** ${normaliseWhitespace(draft.notes)}`);
  push('');

  // -- provisions ----------------------------------------------------------------
  push('## Provisions', '');
  push('| # | Quote | Status | Role | Mapping | Evidence kind | Why |', '|---|---|---|---|---|---|---|');
  draft.provisions.forEach((p, i) => {
    const m = p.mapping;
    const units = p.status === 'mapped' && m ? mappingUnits(m, resolved) : null;
    const mapping =
      p.status === 'mapped' && m
        ? `${m.kind} \`${m.target}\` ${m.op}${m.value !== undefined ? ` ${fmtNumber(m.value)}` : ''}${m.curve ? ` curve ${JSON.stringify(m.curve)}` : ''}${m.expr ? ` \`${m.expr}\`` : ''}${m.unit ? ` ${m.unit}` : ''}${
            units?.conversion ? ` (${units.conversion})` : ''
          }${m.stacksOn ? ` on top of ${m.stacksOn}` : ''}`
        : p.interprets?.length
          ? `interprets ${p.interprets.join(', ')}`
          : '—';
    const kind = p.status === 'mapped' && m ? m.evidence?.kind ?? 'assumed' : '—';
    const quote = normaliseWhitespace(p.quote);
    push(`| ${i + 1} | "${cell(quote.length > 220 ? `${quote.slice(0, 217)}...` : quote)}" | ${p.status} | ${p.role ?? '—'} | ${cell(mapping)} | ${kind} | ${cell(p.reason ?? p.summary)} |`);
  });
  push('');

  // -- exclusions ----------------------------------------------------------------------
  const exclusions = Array.isArray(draft.exclusions) ? draft.exclusions : [];
  push('## Source clauses excluded', '');
  if (exclusions.length) {
    push('| Clause | Kind | Why | Interprets / duplicate of |', '|---|---|---|---|');
    for (const x of exclusions) {
      push(`| \`${cell(x.clauseId)}\` | ${cell(x.kind)} | ${cell(x.reason)} | ${cell([...(x.interprets ?? []), ...(x.duplicateOf ? [`duplicate of ${x.duplicateOf}`] : [])].join(', ') || '—')} |`);
    }
  } else push('None: every clause the draft deals with has a provision.');
  push('');

  // -- assumptions -------------------------------------------------------------------
  push('## Assumptions the result depends on', '');
  const mappedAssumptions = draft.provisions.filter((p) => p.status === 'mapped' && p.mapping && ASSUMPTION_KINDS.includes(p.mapping.evidence?.kind ?? 'assumed'));
  if (mappedAssumptions.length) {
    push('Mapping choices (the text supplies the number; using it this way is a modelling choice):', '');
    for (const p of mappedAssumptions) push(`- **${p.id}** (${p.mapping!.evidence?.kind ?? 'assumed'}): ${normaliseWhitespace(p.mapping!.evidence?.label ?? '')}${p.mapping!.evidence?.note ? ` — ${normaliseWhitespace(p.mapping!.evidence.note)}` : ''}`);
    push('');
  }
  const coeffs = draft.provisions.filter((p) => p.status === 'mapped' && (p.role === 'coefficient' || p.mapping?.kind === 'effect'));
  if (coeffs.length) {
    push('Response coefficients introduced by the draft (not supported by the policy text itself):', '');
    for (const p of coeffs) push(`- **${p.id}**: ${p.mapping?.evidence?.kind ?? 'assumed'} — ${normaliseWhitespace(p.mapping?.evidence?.label ?? '')}`);
    push('');
  }
  const params = resolved.parameters.filter((p) => ASSUMPTION_KINDS.includes(p.source?.kind ?? 'assumed'));
  const inputs = (resolved.inputs ?? []).filter((i) => i.source && ASSUMPTION_KINDS.includes(i.source.kind ?? 'assumed'));
  push(`Model assumptions (${params.length} of ${resolved.parameters.length} parameters are guesses or assumptions):`, '');
  for (const p of params) push(`- \`${p.id}\` = ${fmtNumber(p.value)}${p.unit ? ` ${p.unit}` : ''} (${p.source?.kind ?? 'assumed'}: ${normaliseWhitespace(p.source?.label ?? 'no label')})${p.range ? `, range p5–p95 ${fmtNumber(p.range.p5)}–${fmtNumber(p.range.p95)} ${p.range.dist}` : ''}`);
  for (const i of inputs) push(`- input \`${i.id}\` (${i.source?.kind ?? 'assumed'}: ${normaliseWhitespace(i.source?.label ?? '')})`);
  push('');

  // -- results ---------------------------------------------------------------------
  push('## Paired results', '');
  if (!result.ok) {
    push('The run did not complete, so there are no results:', '');
    for (const e of result.errors) push(`- ${e}`);
    push('');
  } else {
    push(
      (result.deterministic
        ? 'Deterministic: uncertainty off. No parameter declares a range on either side, so the model was run once; the brackets repeat the point value. '
        : `Baseline and policy use the same model version, the same scenario overlays, seed ${result.seed} and the same ${result.runs} draws; only the policy overlay differs. `) +
        'Each cell is the median with the 5th–95th percentile across draws in brackets. The difference is computed inside each draw, then summarised — it is not the policy column minus the baseline column. ' +
        'The spread comes only from parameters that declare a range; it is not a forecast interval.',
      '',
    );
    const steps = reportSteps(result, input.years);
    const unitName = timeUnitName(model.time);
    const steady = steadyStateOf(resolved);
    const steadyIndex = steady ? result.years.findIndex((y) => Math.abs(y - steady.at) < 1e-9) : -1;
    for (const entity of result.entities) {
      for (const output of result.outputs) {
        const unit = resolved.variables.find((v) => v.id === output)?.unit ?? (resolved.inputs ?? []).find((i) => i.id === output)?.unit ?? '';
        push(`### ${output}${unit ? ` (${unit})` : ''}${result.entities.length > 1 ? ` — ${entity}` : ''}`, '');
        const steadyOnly = steady?.outputs.has(output) && steadyIndex >= 0;
        if (steadyOnly) push(`Steady state only: ${normaliseWhitespace(steady!.reason)} Only the steady-state row is reported.`, '');
        push(`| ${unitName} | Baseline | Policy | Paired difference |`, '|---|---|---|---|');
        for (const t of steadyOnly ? [steadyIndex] : steps) {
          push(`| ${timeLabel(model.time, result.years[t])} | ${band(result.baseline[entity]?.[output], t)} | ${band(result.policy[entity]?.[output], t)} | ${band(result.difference[entity]?.[output], t)} |`);
        }
        push('');
      }
      if (result.policyOnlyOutputs.length) push(`Outputs only the policy side has (no baseline to compare): ${result.policyOnlyOutputs.map((o) => `\`${o}\``).join(', ')}.`, '');
    }
  }

  // -- binding ---------------------------------------------------------------------
  push('## Binding constraints', '');
  if (!result.ok) push('Not available: the run did not complete.', '');
  else {
    let any = false;
    const steps = reportSteps(result, input.years);
    for (const entity of result.entities) {
      for (const t of steps) {
        const b = result.binding.baseline[entity]?.[t] ?? [];
        const p = result.binding.policy[entity]?.[t] ?? [];
        if (!b.length && !p.length) continue;
        any = true;
        const same = b.join('; ') === p.join('; ');
        push(`- ${timeLabel(model.time, result.years[t])}${result.entities.length > 1 ? ` (${entity})` : ''}: ${same ? `both sides — ${b.join('; ')}` : `baseline — ${b.join('; ') || 'none'}; policy — ${p.join('; ') || 'none'}`}`);
      }
    }
    if (any) push('', 'These are point runs (every parameter at its stated value). A limit that binds explains why more of the policy lever does not move the output.', '');
    else push('This model records no min()/max() limits.', '');
  }

  // -- limits ------------------------------------------------------------------------
  push('## What this model cannot say', '');
  push(`- **Model scope:** ${normaliseWhitespace(model.scope ?? 'The model declares no scope; treat every result as illustrative.')}`);
  const outside = draft.provisions.filter((p) => p.status === 'outside-model');
  const unresolved = draft.provisions.filter((p) => p.status === 'unresolved');
  if (outside.length) {
    push(`- **Outside the model (${outside.length}):** these provisions change nothing in the run.`);
    for (const p of outside) push(`  - ${p.id}: ${normaliseWhitespace(p.reason ?? p.summary)}`);
  }
  if (unresolved.length) {
    push(`- **Unresolved (${unresolved.length}):** these could matter to the model but have no honest mapping, so the run leaves them out.`);
    for (const p of unresolved) push(`  - ${p.id}: ${normaliseWhitespace(p.reason ?? p.summary)}`);
  }
  push('');

  const issues = (input.diagnostics ?? []).filter((d) => d.level !== 'info');
  if (issues.length) {
    push('## Open validation issues', '');
    for (const d of issues) push(`- ${d.level} \`${d.code}\`: ${d.message}`);
    push('');
  }

  push('## Manifest', '', '```json', JSON.stringify(result.manifest, null, 2), '```', '');
  return lines.join('\n');
}

export function memoFileName(draft: Pick<PolicyDraft, 'id'>): string {
  const slug = String(draft.id ?? 'policy').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'policy';
  return `${slug}-memo.md`;
}

/**
 * Model Lab — "paste a bill" extraction into a PolicyDraft (stage 5 of the v3 plan).
 *
 * Reuses the patterns of services/futuresExtract.ts: lazy Gemini client, typed errors the UI can
 * explain, a per-session rate limit, JSON parsing with code-fence stripping, and ajv schema
 * validation followed by semantic checks against the model.
 *
 * Guardrails:
 *   1. The prompt lists the model's parameters, inputs and hookable variables with units and
 *      sources. A mapping may only target those ids; anything else is demoted to 'unresolved'.
 *   2. Every provision needs a verbatim quote. Quotes are checked by substring after whitespace
 *      normalisation; a quote that is not in the source demotes the provision to 'unresolved' with
 *      the reason recorded — it is never silently kept as mapped.
 *   3. The extractor cannot supply evidence for a response coefficient. Every AI mapping comes back
 *      with evidence kind 'assumed' (a modelling choice), and the draft is 'ai-drafted'.
 *   4. Extraction is optional. Without an API key the UI offers a blank manual draft instead.
 */

import { GoogleGenAI } from '@google/genai';
import Ajv, { type ErrorObject } from 'ajv';
import { resolveModel } from '../src/core/engine';
import type { CoreModel, Overlay } from '../src/core/types';
import { quoteInSource, expressionSymbols } from '../src/policy/draft';
import { modelHash, sha256Hex } from '../src/policy/hash';
import { PROVISION_ROLES, PROVISION_STATUSES, type PolicyDraft, type Provision, type ProvisionMapping } from '../src/policy/types';

export const DEFAULT_POLICY_MODEL = 'gemini-3.6-flash';

const MAX_EXTRACTIONS_PER_SESSION = 10;
export const MAX_POLICY_SOURCE_CHARS = 60_000;
const MAX_PROVISIONS = 40;

// ---------------------------------------------------------------------------
// Typed errors
// ---------------------------------------------------------------------------

export class PolicyNoApiKeyError extends Error {
  constructor(message = 'No Gemini API key is configured (GEMINI_API_KEY), so AI extraction is off. Start a manual draft instead — it works offline.') {
    super(message);
    this.name = 'PolicyNoApiKeyError';
  }
}

export class PolicyRateLimitError extends Error {
  constructor(message = `Extraction limit reached (${MAX_EXTRACTIONS_PER_SESSION} per session). Reload to reset, or continue with a manual draft.`) {
    super(message);
    this.name = 'PolicyRateLimitError';
  }
}

export class PolicySourceTooLongError extends Error {
  constructor(chars: number) {
    super(`The pasted text is ${chars.toLocaleString('en-US')} characters; extraction reads at most ${MAX_POLICY_SOURCE_CHARS.toLocaleString('en-US')}. Paste the operative sections only.`);
    this.name = 'PolicySourceTooLongError';
  }
}

// ---------------------------------------------------------------------------
// Rate limit and client
// ---------------------------------------------------------------------------

let extractionCount = 0;

export function _resetPolicyExtractionCountForTests(): void {
  extractionCount = 0;
}

function bumpRateLimit(): void {
  extractionCount += 1;
  if (extractionCount > MAX_EXTRACTIONS_PER_SESSION) throw new PolicyRateLimitError();
}

/** The subset of the Gemini client this module uses. Tests inject a fake. */
export interface GenerateClient {
  models: { generateContent: (req: { model: string; contents: string }) => Promise<{ text?: string | undefined }> };
}

let client: GenerateClient | null = null;

export function _setPolicyClientForTests(c: GenerateClient | null): void {
  client = c;
}

/** A configured key, or undefined. Vite's `define` turns a missing key into the string "undefined". */
function apiKey(): string | undefined {
  const usable = (k: unknown): k is string => typeof k === 'string' && k.trim() !== '' && k !== 'undefined' && k !== 'null';
  try {
    const a = process.env.API_KEY;
    const b = process.env.GEMINI_API_KEY;
    return usable(a) ? a : usable(b) ? b : undefined;
  } catch {
    return undefined;
  }
}

/** Whether AI extraction can run in this build (the UI disables the button otherwise). */
export function hasPolicyApiKey(): boolean {
  return !!client || !!apiKey();
}

function getClient(): GenerateClient {
  if (!client) {
    const key = apiKey();
    if (!key) throw new PolicyNoApiKeyError();
    client = new GoogleGenAI({ apiKey: key }) as unknown as GenerateClient;
  }
  return client;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export function modelTargetsText(model: CoreModel): string {
  const src = (s?: { label?: string; kind?: string }) => (s ? `${s.kind ?? 'assumed'}: ${s.label ?? ''}` : 'no source');
  const params = model.parameters.map((p) => `- parameter ${p.id} = ${p.value}${p.unit ? ` ${p.unit}` : ''} (${src(p.source)})`);
  const inputs = (model.inputs ?? []).map((i) => {
    const keys = Object.entries(i.curve).map(([y, v]) => `${y}: ${v}`).join(', ');
    return `- input ${i.id}${i.unit ? ` [${i.unit}]` : ''} curve {${keys}} (${src(i.source)})`;
  });
  const vars = model.variables
    .filter((v) => v.hook !== false)
    .map((v) => `- variable ${v.id}${v.unit ? ` [${v.unit}]` : ''} = ${v.equation}${v.description ? ` -- ${v.description}` : ''}`);
  return [...params, ...inputs, ...vars].join('\n');
}

export function buildPolicyPrompt(base: CoreModel, sourceText: string, meta: ExtractionMeta = {}): string {
  const model = resolveModel(base, meta.overlays ?? []).model;
  const label = [meta.title, meta.url].filter(Boolean).join(' -- ') || '(pasted text, no URL)';
  return `You are reading a policy text against ONE simulation model and listing its provisions. You are not predicting the policy's effect.

SOURCE: ${label}
---
${sourceText}
---

MODEL: ${model.name} (id "${model.id}", ${model.time.start}-${model.time.end}, step ${model.time.step})
SCOPE: ${model.scope ?? '(no scope declared)'}

The ONLY ids a mapping may target (anything else must be "unresolved" or "outside-model"):
${modelTargetsText(model)}

Return ONLY one JSON object, no markdown, no commentary:
{
  "title": "short title",
  "notes": "one or two sentences on granularity and anything you left out",
  "provisions": [
    {
      "id": "kebab-case-id",
      "quote": "<verbatim text copied character-for-character from the SOURCE>",
      "summary": "what the provision does, in plain English",
      "status": "mapped" | "unresolved" | "outside-model",
      "role": "control" | "funding" | "constraint" | "coefficient",
      "reason": "why this status (required for unresolved and outside-model)",
      "mapping": {
        "kind": "parameter" | "input" | "effect",
        "target": "<id from the list above>",
        "op": "set" | "add" | "multiply",
        "value": <number, for parameter set / input set or add>,
        "curve": { "<year>": <number> },
        "expr": "<expression over model ids, for effects>",
        "unit": "<unit of the target>",
        "evidenceLabel": "which words of the source give this number, and what modelling choice the mapping makes"
      }
    }
  ]
}

HARD RULES:
1. Every operative provision gets exactly one entry: "mapped", "unresolved" or "outside-model". Do not drop provisions the model cannot represent; mark them "outside-model" with a reason.
2. "quote" must be copied verbatim from the SOURCE. If you cannot quote it, do not include it.
3. Only "mapped" provisions have a "mapping", and only when the SOURCE states the number (a budget, rate, cap, date). parameter: op "set". input: op "set" (value or curve) or "add" (value, when the text adds to existing funding). effect: op "add" or "multiply" on a variable.
4. Separate policy controls from how the world responds. The text can give a budget; it cannot give the employment response to that budget. If a mapping would need a response coefficient the model does not already have as a parameter, mark the provision "unresolved" and say which coefficient is missing. Never invent a number.
5. Do not claim an effect (for example on risk or safety) just because the text mentions a topic.
6. At most ${MAX_PROVISIONS} provisions. Output ONLY the JSON object.`;
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

const extractionSchema = {
  type: 'object',
  required: ['provisions'],
  properties: {
    title: { type: 'string' },
    notes: { type: 'string' },
    provisions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['quote', 'status'],
        properties: {
          id: { type: 'string' },
          quote: { type: 'string' },
          summary: { type: 'string' },
          status: { type: 'string' },
          role: { type: 'string' },
          reason: { type: 'string' },
          mapping: {
            type: 'object',
            required: ['kind', 'target', 'op'],
            properties: {
              kind: { enum: ['parameter', 'input', 'effect'] },
              target: { type: 'string' },
              op: { enum: ['set', 'add', 'multiply'] },
              value: { type: 'number' },
              curve: { type: 'object', additionalProperties: { type: 'number' } },
              expr: { type: 'string' },
              unit: { type: 'string' },
              evidenceLabel: { type: 'string' },
            },
          },
        },
      },
    },
  },
} as const;

const ajv = new Ajv({ allErrors: true, strict: false });
const validateExtraction = ajv.compile(extractionSchema);

function stripCodeFence(raw: string): string {
  const text = raw.trim();
  const anchored = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (anchored) return anchored[1].trim();
  const loose = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return loose ? loose[1].trim() : text;
}

function slug(text: string, fallback: string): string {
  const s = String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
  return s || fallback;
}

function formatAjv(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors?.length) return ['The extraction did not match the expected shape.'];
  return errors.map((e) => `${e.instancePath || '(root)'} ${e.message ?? ''}`.trim());
}

export interface PolicyExtraction {
  draft: PolicyDraft | null;
  errors: string[];
  /** Provision ids demoted from mapped to unresolved, with why. */
  demoted: Array<{ id: string; why: string }>;
}

export interface ExtractionMeta {
  title?: string;
  url?: string;
  /** Scenario overlays in force: their parameters, inputs and variables are valid targets too. */
  overlays?: Overlay[];
}

export function parsePolicyExtraction(
  raw: string,
  model: CoreModel,
  sourceText: string,
  meta: ExtractionMeta = {},
  modelUsed: string = DEFAULT_POLICY_MODEL,
  today: string = new Date().toISOString().slice(0, 10),
): PolicyExtraction {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch (e) {
    return { draft: null, errors: [`Could not parse JSON from the model's response: ${(e as Error).message}`], demoted: [] };
  }
  if (!validateExtraction(parsed)) return { draft: null, errors: formatAjv(validateExtraction.errors), demoted: [] };
  const body = parsed as { title?: string; notes?: string; provisions: Array<Record<string, unknown>> };
  if (body.provisions.length === 0) return { draft: null, errors: ['The extraction listed no provisions.'], demoted: [] };
  if (body.provisions.length > MAX_PROVISIONS) return { draft: null, errors: [`Too many provisions (${body.provisions.length}); at most ${MAX_PROVISIONS}.`], demoted: [] };

  const scenario = resolveModel(model, meta.overlays ?? []).model;
  const params = new Set(scenario.parameters.map((p) => p.id));
  const inputs = new Set((scenario.inputs ?? []).map((i) => i.id));
  const hookable = new Set(scenario.variables.filter((v) => v.hook !== false).map((v) => v.id));
  const known = new Set([...params, ...inputs, ...scenario.variables.map((v) => v.id), ...(scenario.solves ?? []).map((s) => s.unknown)]);
  const demoted: PolicyExtraction['demoted'] = [];
  const usedIds = new Set<string>();
  const sourceTitle = meta.title?.trim() || body.title?.trim() || 'Pasted text';

  const provisions: Provision[] = body.provisions.map((p, i) => {
    let id = slug(String(p.id ?? ''), `provision-${i + 1}`);
    while (usedIds.has(id)) id = `${id}-${i + 1}`;
    usedIds.add(id);
    const quote = String(p.quote ?? '');
    const status = PROVISION_STATUSES.includes(p.status as Provision['status']) ? (p.status as Provision['status']) : 'unresolved';
    const role = PROVISION_ROLES.includes(p.role as NonNullable<Provision['role']>) ? (p.role as Provision['role']) : undefined;
    const out: Provision = {
      id,
      quote,
      summary: String(p.summary ?? ''),
      status,
      ...(role ? { role } : {}),
      ...(typeof p.reason === 'string' && p.reason.trim() ? { reason: p.reason.trim() } : {}),
    };
    if (p.status !== status) out.reason = `The extractor gave no valid status ("${String(p.status)}"). ${out.reason ?? ''}`.trim();

    const demote = (why: string) => {
      demoted.push({ id, why });
      out.status = 'unresolved';
      out.reason = `${why}${out.reason ? ` (extractor's reason: ${out.reason})` : ''}`;
    };

    if (!quoteInSource(quote, sourceText)) {
      if (out.status === 'mapped') demote('Demoted from mapped: the quote is not found verbatim in the source text (after whitespace normalisation).');
      else out.reason = `The quote is not found verbatim in the source text. ${out.reason ?? ''}`.trim();
    }

    const m = p.mapping as Record<string, unknown> | undefined;
    if (out.status === 'mapped') {
      if (!m) {
        demote('Demoted from mapped: the extractor gave no mapping.');
      } else {
        const mapping: ProvisionMapping = {
          kind: m.kind as ProvisionMapping['kind'],
          target: String(m.target),
          op: m.op as ProvisionMapping['op'],
          ...(typeof m.value === 'number' ? { value: m.value } : {}),
          ...(m.curve && typeof m.curve === 'object' ? { curve: m.curve as Record<string, number> } : {}),
          ...(typeof m.expr === 'string' ? { expr: m.expr } : {}),
          ...(typeof m.unit === 'string' && m.unit ? { unit: m.unit } : {}),
          evidence: {
            label: `AI-drafted mapping of "${sourceTitle}": ${String(m.evidenceLabel ?? 'no explanation given')}`,
            kind: 'assumed',
            ...(meta.url ? { url: meta.url } : {}),
            note: 'Extracted by an AI model and not reviewed. The source supports what the policy sets, not how the world responds.',
          },
        };
        out.mapping = mapping;
        const targetOk =
          (mapping.kind === 'parameter' && params.has(mapping.target)) ||
          (mapping.kind === 'input' && inputs.has(mapping.target)) ||
          (mapping.kind === 'effect' && hookable.has(mapping.target));
        if (!targetOk) demote(`Demoted from mapped: "${mapping.target}" is not a ${mapping.kind} this model has.`);
        else if (mapping.kind === 'effect') {
          const unknown = expressionSymbols(mapping.expr ?? '').filter((s) => !known.has(s));
          if (!mapping.expr?.trim()) demote('Demoted from mapped: the effect has no expression.');
          else if (unknown.length) demote(`Demoted from mapped: the effect reads ${unknown.map((s) => `"${s}"`).join(', ')}, which the model does not have.`);
          else if (role !== 'coefficient') out.role = 'coefficient';
        }
      }
    }
    if (out.status !== 'mapped' && !out.reason) out.reason = 'The extractor gave no reason; a reviewer must supply one.';
    return out;
  });

  const draft: PolicyDraft = {
    schemaVersion: 1,
    id: slug(body.title ?? meta.title ?? '', 'ai-draft'),
    title: body.title?.trim() || meta.title?.trim() || 'AI-drafted policy reading',
    source: {
      title: sourceTitle,
      ...(meta.url ? { url: meta.url } : {}),
      textSha256: sha256Hex(sourceText),
      excerptChars: sourceText.length,
    },
    modelId: model.id,
    modelHash: modelHash(model),
    provisions,
    reviewStatus: 'ai-drafted',
    draftedBy: { kind: 'ai', name: modelUsed, date: today },
    ...(body.notes ? { notes: body.notes } : {}),
  };
  return { draft, errors: [], demoted };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function extractPolicyDraft(
  model: CoreModel,
  sourceText: string,
  meta: ExtractionMeta = {},
  opts: { model?: string } = {},
): Promise<PolicyExtraction> {
  if (sourceText.length > MAX_POLICY_SOURCE_CHARS) throw new PolicySourceTooLongError(sourceText.length);
  const c = getClient();
  bumpRateLimit();
  const which = opts.model ?? DEFAULT_POLICY_MODEL;
  const response = await c.models.generateContent({ model: which, contents: buildPolicyPrompt(model, sourceText, meta) });
  return parsePolicyExtraction(response.text ?? '', model, sourceText, meta, which);
}

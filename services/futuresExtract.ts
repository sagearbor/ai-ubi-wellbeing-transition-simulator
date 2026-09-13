/**
 * AI Futures Map — "paste a bill" extraction service.
 *
 * Design: tmp/futures-design/ai-futures-map-design.html section 6 ("Paste a bill").
 *
 * Text or a URL goes to Gemini, which is already wired into the app (see
 * services/geminiService.ts for the lazy-client pattern reused here). The prompt contains the
 * node list (event nodes only, with operationalisation), the magnitude enum, and the
 * intervention JSON shape. The response is parsed as JSON and validated with ajv against
 * schemas/intervention.schema.json, then checked against the graph semantically.
 *
 * Three guardrails make this trustworthy (section 6):
 *   1. The model never sets a free number - it only picks node ids from the graph and
 *      magnitudes from slight/moderate/strong.
 *   2. Every nudge must carry a quoted evidence sentence from the source. No quote, no nudge.
 *   3. Cards come back tier 'public', status 'ai-drafted' - always unreviewed until a human
 *      (or expert) confirms them in the review card.
 */

import { GoogleGenAI } from '@google/genai';
import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import interventionSchema from '../schemas/intervention.schema.json';
import { FuturesGraph, FuturesNode, Intervention, MAGNITUDE_LOG_ODDS, Magnitude } from '../src/futures/types';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(interventionSchema);

/** Default extraction model. Matches services/geminiService.ts's Gemini calls. */
export const DEFAULT_MODEL = 'gemini-3.6-flash';

const MAX_EXTRACTIONS_PER_SESSION = 10;
const MAX_SOURCE_CHARS = 60_000;
const MAX_NUDGES = 6;
const MAX_EVIDENCE_CHARS = 300;

// ---------------------------------------------------------------------------
// Typed errors the UI can catch and explain
// ---------------------------------------------------------------------------

export class NoApiKeyError extends Error {
  constructor(message = 'No Gemini API key configured. Set GEMINI_API_KEY in your environment.') {
    super(message);
    this.name = 'NoApiKeyError';
  }
}

export class RateLimitError extends Error {
  constructor(
    message = `Extraction limit reached (${MAX_EXTRACTIONS_PER_SESSION} per session). Reload the page to reset, or use "Start from blank card".`
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class SourceFetchError extends Error {
  constructor(
    message = 'Could not fetch that URL (likely blocked by CORS, or the site is unreachable). Paste the text instead.'
  ) {
    super(message);
    this.name = 'SourceFetchError';
  }
}

// ---------------------------------------------------------------------------
// Per-session rate limit
// ---------------------------------------------------------------------------

let extractionCount = 0;

/** Test-only: resets the per-session extraction counter between test cases. */
export function _resetExtractionCountForTests(): void {
  extractionCount = 0;
}

function bumpRateLimit(): void {
  extractionCount += 1;
  if (extractionCount > MAX_EXTRACTIONS_PER_SESSION) {
    throw new RateLimitError();
  }
}

// ---------------------------------------------------------------------------
// Lazy Gemini client (mirrors services/geminiService.ts)
// ---------------------------------------------------------------------------

let ai: GoogleGenAI | null = null;
const getAI = (): GoogleGenAI => {
  if (!ai) {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new NoApiKeyError();
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function eventNodesFor(graph: FuturesGraph): FuturesNode[] {
  return graph.nodes.filter((n) => n.kind === 'event' && !n.retired);
}

export function buildExtractionPrompt(
  graph: FuturesGraph,
  sourceText: string,
  sourceMeta: { url?: string; title?: string }
): string {
  const nodes = eventNodesFor(graph);
  const nodeList = nodes
    .map((n) => `- ${n.id}: ${n.label} -- ${n.operationalisation ?? n.summary}`)
    .join('\n');
  const magnitudeList = (Object.keys(MAGNITUDE_LOG_ODDS) as Magnitude[])
    .map((m) => `"${m}" (${MAGNITUDE_LOG_ODDS[m]} log-odds)`)
    .join(', ');
  const sourceLabel = [sourceMeta.title, sourceMeta.url].filter(Boolean).join(' -- ') || '(pasted text, no URL)';
  const truncatedSource =
    sourceText.length > MAX_SOURCE_CHARS ? `${sourceText.slice(0, MAX_SOURCE_CHARS)}\n...[truncated]` : sourceText;

  return `You are extracting a structured "intervention" card from a piece of policy text for the AI Futures Map, a probabilistic model of AI-era outcomes.

SOURCE: ${sourceLabel}
---
${truncatedSource}
---

The model has these EVENT nodes you may reference (format "id: label -- operationalisation"). This is the ONLY
list of valid node ids. Never invent, misspell, or reference a world-state node or any id not on this list:
${nodeList}

MAGNITUDE ENUM (how strongly a nudge pushes a node's odds, in log-odds; the sign comes from "direction"):
${magnitudeList}

Return ONLY a single JSON object with exactly this shape (no markdown, no commentary, no code fence):
{
  "schemaVersion": 1,
  "id": "kebab-case-slug",
  "label": "Short human title",
  "summary": "One or two sentence plain-English summary of what this text does.",
  "source": { "kind": "bill" | "paper" | "proposal" | "editorial", "url": "${sourceMeta.url ?? ''}", "title": "${sourceMeta.title ?? ''}" },
  "tier": "public",
  "status": "ai-drafted",
  "cost": { "band": 1-5, "note": "One line explaining the cost band pick." },
  "startYear": an integer between ${graph.startYear} and ${graph.endYear} inclusive,
  "nudges": [
    { "node": "<id from the list above>", "direction": "up" | "down", "magnitude": "slight" | "moderate" | "strong", "lag": 0, "evidence": "<verbatim quote from the source, at most 300 characters>" }
  ]
}

HARD RULES (breaking any of these makes the extraction unusable):
1. Only pick node ids from the list above. Never invent an id.
2. magnitude is only ever "slight", "moderate", or "strong" - never a raw number.
3. Every nudge MUST include an "evidence" field: a quote copied verbatim (character-for-character) from the
   source text above, at most 300 characters. If you cannot find a supporting quote for a pick, drop that
   nudge instead of guessing.
4. Output at most ${MAX_NUDGES} nudges. Prefer the strongest, clearest ones.
5. "cost.band" is an integer 1-5 with a one-line "note" explaining the pick.
6. "startYear" must be an integer between ${graph.startYear} and ${graph.endYear} inclusive.
7. Output ONLY the JSON object. No prose before or after it, no markdown code fence.`;
}

// ---------------------------------------------------------------------------
// Parsing and validation
// ---------------------------------------------------------------------------

function stripCodeFence(raw: string): string {
  const text = raw.trim();
  const anchored = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (anchored) return anchored[1].trim();
  const loose = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return loose ? loose[1].trim() : text;
}

function slugify(label: string): string {
  const slug = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || `intervention-${Date.now()}`;
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors || errors.length === 0) return ['Schema validation failed.'];
  return errors.map((e) => `${e.instancePath || '(root)'} ${e.message ?? ''}`.trim());
}

export function parseExtraction(
  raw: string,
  graph: FuturesGraph,
  modelUsed: string = DEFAULT_MODEL
): { intervention: Intervention | null; errors: string[] } {
  const text = stripCodeFence(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return {
      intervention: null,
      errors: [`Could not parse JSON from the model's response: ${(err as Error).message}`],
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { intervention: null, errors: ['Extraction did not return a JSON object.'] };
  }

  const draft = parsed as Record<string, unknown>;

  // Fields the model must never control - normalise before schema validation so a missing
  // id or a model-supplied tier/status doesn't cause a spurious schema failure.
  if (typeof draft.id !== 'string' || draft.id.trim() === '') {
    draft.id = slugify(typeof draft.label === 'string' ? draft.label : 'intervention');
  }
  draft.schemaVersion = 1;
  draft.tier = 'public';
  draft.status = 'ai-drafted';
  draft.extractedBy = { model: modelUsed, asOf: new Date().toISOString().slice(0, 10) };

  if (!validateSchema(draft)) {
    return { intervention: null, errors: formatAjvErrors(validateSchema.errors) };
  }

  const intervention = draft as unknown as Intervention;
  const errors: string[] = [];

  const eventIds = new Set(eventNodesFor(graph).map((n) => n.id));

  if (intervention.nudges.length === 0) {
    errors.push('At least one nudge is required.');
  }
  if (intervention.nudges.length > MAX_NUDGES) {
    errors.push(`Too many nudges (${intervention.nudges.length}); at most ${MAX_NUDGES} are allowed.`);
  }
  for (const nudge of intervention.nudges) {
    if (!eventIds.has(nudge.node)) {
      errors.push(`Unknown or non-event node id in a nudge: "${nudge.node}".`);
    }
    if (!nudge.evidence || nudge.evidence.trim() === '') {
      errors.push(`Nudge on "${nudge.node}" is missing a required evidence quote.`);
    } else if (nudge.evidence.length > MAX_EVIDENCE_CHARS) {
      errors.push(`Nudge on "${nudge.node}" evidence quote is too long (> ${MAX_EVIDENCE_CHARS} chars).`);
    }
  }
  if (intervention.startYear < graph.startYear || intervention.startYear > graph.endYear) {
    errors.push(
      `startYear ${intervention.startYear} is outside the graph's range [${graph.startYear}, ${graph.endYear}].`
    );
  }

  if (errors.length > 0) {
    return { intervention: null, errors };
  }

  return { intervention, errors: [] };
}

// ---------------------------------------------------------------------------
// Extraction entry point
// ---------------------------------------------------------------------------

export async function extractIntervention(
  graph: FuturesGraph,
  sourceText: string,
  sourceMeta: { url?: string; title?: string },
  opts?: { model?: string }
): Promise<{ intervention: Intervention | null; errors: string[] }> {
  bumpRateLimit();
  const model = opts?.model ?? DEFAULT_MODEL;
  const prompt = buildExtractionPrompt(graph, sourceText, sourceMeta);

  const response = await getAI().models.generateContent({
    model,
    contents: prompt,
  });

  const raw = response.text ?? '';
  return parseExtraction(raw, graph, model);
}

// ---------------------------------------------------------------------------
// Fetch a source URL as plain text (client-side; CORS is the expected failure mode)
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function fetchSourceText(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new SourceFetchError();
  }
  if (!res.ok) {
    throw new SourceFetchError(`Fetch failed with status ${res.status}. Paste the text instead.`);
  }
  const html = await res.text();
  const text = stripHtml(html);
  return text.length > MAX_SOURCE_CHARS ? text.slice(0, MAX_SOURCE_CHARS) : text;
}

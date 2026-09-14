/**
 * importState — model import/export for the Lab, without JSX.
 *
 * A model file loaded here is validated (validateCoreModel / validateOverlay, run through the same
 * runner as everything else) and then runs like a bundled fixture, but it is never curated: the
 * picker, the results, bundles and memos all carry "experimental — not curated". A file that is
 * byte-for-byte a bundled model (same id, same version hash) is simply that bundled model.
 */

import { ENGINE_VERSION } from '../../src/core/engine';
import { CORE_FIXTURES, type FixtureEntry } from '../../src/core/fixtures';
import type { CoreModel, Overlay } from '../../src/core/types';
import { modelHash } from '../../src/policy/hash';

export type ModelStatus = 'curated' | 'imported';

export const EXPERIMENTAL_LABEL = 'experimental — not curated';
export const EXPORT_SCHEMA = 'core-model-export/1';

export interface ImportedModel {
  /** Picker value: "imported:<id>:<version hash>". */
  key: string;
  model: CoreModel;
  /** Overlays that came with it (a package), offered as toggles like a fixture's. */
  overlays: Overlay[];
  /** Validation warnings shown with it. */
  warnings: string[];
}

export interface ModelExport {
  schema: typeof EXPORT_SCHEMA;
  /** "curated" for a bundled model; "experimental — not curated" for anything imported. */
  status: 'curated' | typeof EXPERIMENTAL_LABEL;
  engineVersion: string;
  modelHash: string;
  exportedAt: string;
  model: CoreModel;
  overlays: Overlay[];
}

export function importKey(model: CoreModel): string {
  return `imported:${model.id}:${modelHash(model)}`;
}

export function isImportKey(value: string): boolean {
  return value.startsWith('imported:');
}

/** The bundled fixture this model is an exact copy of (same id and version), if any. */
export function curatedMatch(model: CoreModel): FixtureEntry | undefined {
  const f = CORE_FIXTURES.find((x) => x.model.id === model.id);
  return f && modelHash(f.model) === modelHash(model) ? f : undefined;
}

export function buildModelExport(model: CoreModel, overlays: Overlay[], status: ModelStatus, now: () => string = () => new Date().toISOString()): ModelExport {
  return {
    schema: EXPORT_SCHEMA,
    status: status === 'curated' ? 'curated' : EXPERIMENTAL_LABEL,
    engineVersion: ENGINE_VERSION,
    modelHash: modelHash(model),
    exportedAt: now(),
    model,
    overlays,
  };
}

export function exportFileName(model: CoreModel): string {
  const slug = String(model.id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'model';
  return `${slug}-${modelHash(model)}.model.json`;
}

export type Classified =
  | { kind: 'model'; model: unknown }
  | { kind: 'package'; model: unknown; overlays: unknown[] }
  | { kind: 'overlay'; overlay: unknown }
  | { kind: 'policy-bundle' }
  | { kind: 'unknown'; reason: string };

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Parse pasted or uploaded text. Never throws. */
export function parseImportText(text: string): { ok: true; json: unknown } | { ok: false; reason: string } {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, reason: 'Nothing to import: paste JSON or choose a file.' };
  if (text.length > 5_000_000) return { ok: false, reason: 'The file is larger than 5 MB; a core model file is far smaller than that.' };
  try {
    return { ok: true, json: JSON.parse(text) };
  } catch (e) {
    return { ok: false, reason: `Not valid JSON: ${(e as Error).message}` };
  }
}

/** What kind of file this is: a model, an exported model + overlays, an overlay, or a policy bundle. */
export function classifyImport(json: unknown): Classified {
  if (!isObject(json)) return { kind: 'unknown', reason: 'The file is not a JSON object.' };
  if (json.schema === EXPORT_SCHEMA) {
    if (!isObject(json.model)) return { kind: 'unknown', reason: `A ${EXPORT_SCHEMA} file must contain "model".` };
    return { kind: 'package', model: json.model, overlays: Array.isArray(json.overlays) ? json.overlays : [] };
  }
  if (typeof json.schema === 'string' && json.schema.startsWith('policy-bundle/')) return { kind: 'policy-bundle' };
  if ('schemaVersion' in json || 'time' in json || 'variables' in json && 'outputs' in json && 'parameters' in json && 'name' in json) {
    return { kind: 'model', model: json };
  }
  if (typeof json.id === 'string' && ['parameters', 'inputs', 'variables', 'effects', 'solves', 'outputs', 'tests', 'invariants'].some((k) => k in json)) {
    return { kind: 'overlay', overlay: json };
  }
  return { kind: 'unknown', reason: 'This is not a core model (it has no schemaVersion, time or variables) and not an overlay (it has no id with parameters, inputs, variables or effects).' };
}

const ADDITIONAL = /^schema: (\S*) must NOT have additional properties \("([^"]+)"\)$/;

/**
 * Validation errors in words an author can act on. Schema errors about fields this format does not
 * have, or values it does not accept, are reported as unsupported capabilities — the model may be
 * fine, this app just cannot run that feature — rather than as generic schema noise.
 */
export function explainValidationErrors(errors: string[]): string[] {
  return errors.map((e) => {
    const add = ADDITIONAL.exec(e);
    if (add) {
      const where = add[1] === '/' ? 'the top level' : add[1];
      return `unsupported capability: "${add[2]}" at ${where} is not part of the core model format this app runs (schemaVersion 1, docs/core-authoring.md). Remove it, or express it with the elements the format has.`;
    }
    if (/^schema: \/time\/step /.test(e)) return 'unsupported capability: time.step must be "year" or "month". A model whose step is another unit keeps step "year" and declares the unit with time.stepLabel (and stepYears), e.g. "generation", 25.';
    if (/^schema: \/schemaVersion /.test(e)) return 'unsupported capability: this app reads core model schemaVersion 1 only.';
    if (/is not allowed/.test(e) && /^parse: /.test(e)) return `unsupported capability: ${e.replace(/^parse: /, '')} (the expression language is the allow-listed mathjs subset in docs/core-authoring.md)`;
    if (/^limit-exceeded: /.test(e)) return `over a hard limit: ${e.replace(/^limit-exceeded: /, '')}`;
    return e;
  });
}

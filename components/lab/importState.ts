/**
 * importState — model import/export for the Lab, without JSX.
 *
 * A model file loaded here is validated (validateCoreModel / validateOverlay, run through the same
 * runner as everything else) and then runs like a bundled fixture, but it is never curated: the
 * picker, the results, bundles and memos all carry "experimental — not curated". A file that is
 * byte-for-byte a bundled model (same id, same version hash) is simply that bundled model.
 */

import { packageProvenance, scenarioProvenance, type ScenarioProvenance } from '../../src/policy/provenance';
import { ENGINE_VERSION, NUMERICAL_CONVENTIONS } from '../../src/core/engine';
import { CORE_FIXTURES, type FixtureEntry } from '../../src/core/fixtures';
import type { CoreModel, Overlay } from '../../src/core/types';
import { contentHash, modelHash } from '../../src/policy/hash';
import { exactModel, financialDataHash, validateExperiment, type FinancialExperiment } from '../../src/financials/share';
import { financialRecord } from '../../src/financials/catalog';
import { financialRecordForModel } from '../../src/financials/presentation';

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
  provenance?: ScenarioProvenance;
  /** Set only by the verified experiment entry path, never copied from imported JSON. */
  financialOrigin?: { collectionId: string; dataHash: string; modelHash: string; fiscalYear: number };
}

/** The financial entry accepts a pinned experiment, never a caller-supplied model or origin flag. */
export function importFinancialExperiment(experiment: FinancialExperiment, side: 'A' | 'B'): ImportedModel {
  if (side !== 'A' && side !== 'B') throw new Error('Unknown financial scenario side.');
  const checked = validateExperiment(experiment);
  const model = exactModel(checked, side);
  return {
    key: importKey(model), model, overlays: [], warnings: [],
    financialOrigin: {
      collectionId: checked.collectionId, dataHash: checked.dataHash, modelHash: checked.modelHashes[side],
      fiscalYear: financialRecord(checked.recordId, checked.collectionId).fiscalYear,
    },
  };
}

/** Recheck the actual model, so a replaced or edited import cannot retain an app-origin claim. */
export function verifiedFinancialOrigin(entry: ImportedModel | undefined): ImportedModel['financialOrigin'] {
  const origin = entry?.financialOrigin;
  if (!origin || typeof origin.collectionId !== 'string') return undefined;
  try {
    const record = financialRecordForModel(entry.model, origin.collectionId);
    return origin.dataHash === financialDataHash(origin.collectionId) && origin.modelHash === modelHash(entry.model)
      && record && record.fiscalYear === origin.fiscalYear ? origin : undefined;
  } catch { return undefined; }
}

export interface ModelExport {
  schema: typeof EXPORT_SCHEMA;
  /** "curated" for a bundled model; "experimental — not curated" for anything imported. */
  status: 'curated' | typeof EXPERIMENTAL_LABEL;
  engineVersion: string;
  numerical: Record<string, string>;
  overlaysHash: string;
  importWarnings?: string[];
  provenance?: ScenarioProvenance;
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

export function buildModelExport(model: CoreModel, overlays: Overlay[], status: ModelStatus, now: () => string = () => new Date().toISOString(), importWarnings: string[] = [], provenance?: ScenarioProvenance): ModelExport {
  const actual = scenarioProvenance(model, overlays, provenance ?? (status === 'imported' ? {kind: 'experimental'} : undefined));
  const result: ModelExport = {
    provenance: actual,
    schema: EXPORT_SCHEMA,
    importWarnings,
    status: status === 'curated' && actual.kind === 'fixture' ? 'curated' : EXPERIMENTAL_LABEL,
    engineVersion: ENGINE_VERSION,
    numerical: NUMERICAL_CONVENTIONS,
    overlaysHash: contentHash(overlays),
    modelHash: modelHash(model),
    exportedAt: now(),
    model,
    overlays,
  };
  if (new TextEncoder().encode(JSON.stringify(result, null, 2)).length > 5_000_000) throw new Error('The model package exceeds the 5 MB import limit.');
  return result;
}

export function exportFileName(model: CoreModel): string {
  const slug = String(model.id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'model';
  return `${slug}-${modelHash(model)}.model.json`;
}

export type Classified =
  | { kind: 'model'; model: unknown }
  | { kind: 'package'; model: unknown; overlays: unknown[]; warnings?: string[]; provenance?: ScenarioProvenance }
  | { kind: 'incompatible-package'; model: unknown; overlays: unknown[]; warnings?: string[]; provenance?: ScenarioProvenance; reason: string }
  | { kind: 'overlay'; overlay: unknown }
  | { kind: 'policy-bundle' }
  | { kind: 'unknown'; reason: string };

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Parse pasted or uploaded text. Never throws. */
export function parseImportText(text: string): { ok: true; json: unknown } | { ok: false; reason: string } {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, reason: 'Nothing to import: paste JSON or choose a file.' };
  if (text.length > 5_000_000 || new TextEncoder().encode(text).length > 5_000_000) return { ok: false, reason: 'The file is larger than 5 MB; a core model file is far smaller than that.' };
  try {
    return { ok: true, json: JSON.parse(text) };
  } catch (e) {
    return { ok: false, reason: `Not valid JSON: ${(e as Error).message}` };
  }
}

/** What kind of file this is: a model, an exported model + overlays, an overlay, or a policy bundle. */
export function classifyImport(json: unknown): Classified {
  try { return classifyChecked(json); } catch { return { kind: 'unknown', reason: 'The package structure is too deeply nested or malformed.' }; }
}

function classifyChecked(json: unknown): Classified {
  if (!isObject(json)) return { kind: 'unknown', reason: 'The file is not a JSON object.' };
  if (typeof json.schema === 'string' && json.schema.startsWith('core-model-export/')) {
    if (!isObject(json.model)) return { kind: 'unknown', reason: `A ${EXPORT_SCHEMA} file must contain "model".` };
    const reasons: string[] = [];
    if (json.schema !== EXPORT_SCHEMA) reasons.push(`unsupported package schema ${json.schema}`);
    if (json.modelHash !== modelHash(json.model as unknown as CoreModel)) reasons.push('the declared model hash does not match the actual model');
    if (json.engineVersion !== ENGINE_VERSION) reasons.push(`engine ${String(json.engineVersion)} is incompatible with ${ENGINE_VERSION}`);
    if (contentHash(json.numerical) !== contentHash(NUMERICAL_CONVENTIONS)) reasons.push('numerical conventions are missing or incompatible');
    if (!Array.isArray(json.overlays) || contentHash(json.overlays) !== json.overlaysHash) reasons.push('overlay settings do not match their hash');
    const overlays = Array.isArray(json.overlays) ? json.overlays : [];
    const provenance = scenarioProvenance(json.model as unknown as CoreModel, overlays as Overlay[], packageProvenance(json.provenance, json.importWarnings) ?? (json.status === EXPERIMENTAL_LABEL ? {kind: 'experimental'} : undefined));
    const warnings = Array.isArray(json.importWarnings) ? json.importWarnings.filter((x): x is string => typeof x === 'string') : [];
    if (reasons.length) return { kind: 'incompatible-package', model: json.model, overlays, warnings, provenance, reason: reasons.join('; ') };
    return { kind: 'package', model: json.model, overlays, warnings, provenance };
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

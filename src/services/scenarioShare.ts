/**
 * Scenario Share/Export Service (P9-T8)
 *
 * A "scenario" here is a full ModelConfig - parameters plus the custom equations a user
 * has written in ModelEditor. This module is the pure (React-free, DOM-free where possible)
 * logic for:
 *   - exporting a scenario to a downloadable JSON string
 *   - importing a scenario back from an uploaded JSON string
 *   - encoding a scenario into a URL hash fragment (`#scenario=<base64>`) for a copyable link
 *   - decoding that hash fragment back into a ModelConfig
 *
 * Kept separate from the `#share=` hash App.tsx already uses for the simple ModelParameters
 * dial preset (see generateShareLink/handleCopyLink in App.tsx) - that mechanism only ever
 * encoded the numeric preset, never a model's custom equations. `#scenario=` is additive and
 * does not change that existing behavior.
 *
 * Country datasets (2026-09 migration, data/countries/README.md): a scenario is only reproducible
 * on the country data it was made with, so exports and links carry `countryDataset`. Files and
 * links without it predate the migration and are read as 'countries-legacy-v1'. The same rule
 * applies to the `#share=` preset payload (encodeSharePayload / decodeSharePayload).
 */

import { ModelConfig, ModelParameters } from '../../types';
import { COUNTRY_DATASET_ID, LEGACY_COUNTRY_DATASET_ID, isCountryDatasetId, type CountryDatasetId } from '../../constants';

export class ScenarioParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScenarioParseError';
  }
}

/** Minimal structural check that a parsed JSON value looks like a ModelConfig. */
function isModelConfigShape(value: unknown): value is ModelConfig {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === 'string' &&
    typeof v.description === 'string' &&
    Array.isArray(v.parameters) &&
    typeof v.equations === 'object' && v.equations !== null &&
    typeof v.metadata === 'object' && v.metadata !== null
  );
}

/**
 * The dataset a scenario (or #share= payload) was made on: its own field, else legacy (nothing
 * written before the migration carries one). Unknown ids are rejected rather than remapped.
 */
export function resolveCountryDataset(value: unknown): CountryDatasetId {
  if (value === undefined || value === null) return LEGACY_COUNTRY_DATASET_ID;
  if (!isCountryDatasetId(value)) {
    throw new ScenarioParseError(`This scenario uses country dataset "${String(value)}", which this version of the app does not have.`);
  }
  return value;
}

/** A config with its dataset recorded: its own, else the one given (the session's). */
function stampCountryDataset(config: ModelConfig, countryDataset: CountryDatasetId): ModelConfig {
  return config.countryDataset ? config : { ...config, countryDataset };
}

/** Serialize a scenario to pretty-printed JSON, suitable for a file download. */
export function exportScenarioJson(config: ModelConfig, countryDataset: CountryDatasetId = COUNTRY_DATASET_ID): string {
  return JSON.stringify(stampCountryDataset(config, countryDataset), null, 2);
}

/** Parse a scenario back from a JSON string (e.g. an uploaded file's contents). */
export function parseScenarioJson(json: string): ModelConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new ScenarioParseError(
      `Not valid JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  if (!isModelConfigShape(parsed)) {
    throw new ScenarioParseError(
      'This file does not look like a scenario - a scenario needs name, description, parameters, equations, and metadata.'
    );
  }
  return { ...parsed, countryDataset: resolveCountryDataset(parsed.countryDataset) };
}

/** UTF-8-safe base64 encode (plain btoa mangles non-Latin1 characters). */
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** UTF-8-safe base64 decode, the inverse of utf8ToBase64. */
function base64ToUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

const SCENARIO_HASH_PREFIX = '#scenario=';

/** Encode a scenario into the base64 payload used inside a share URL's hash. */
export function encodeScenarioForUrl(config: ModelConfig, countryDataset: CountryDatasetId = COUNTRY_DATASET_ID): string {
  return utf8ToBase64(JSON.stringify(stampCountryDataset(config, countryDataset)));
}

/** Decode a scenario from the base64 payload produced by encodeScenarioForUrl. */
export function decodeScenarioFromUrl(encoded: string): ModelConfig {
  let json: string;
  try {
    json = base64ToUtf8(encoded);
  } catch (err) {
    throw new ScenarioParseError(
      `Link is not valid scenario data: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  return parseScenarioJson(json);
}

/** Build a full, copyable share URL for a scenario. */
export function buildScenarioShareUrl(
  config: ModelConfig,
  origin: string,
  pathname: string,
  countryDataset: CountryDatasetId = COUNTRY_DATASET_ID,
): string {
  return `${origin}${pathname}${SCENARIO_HASH_PREFIX}${encodeScenarioForUrl(config, countryDataset)}`;
}

// ============================================================================
// #share= preset links (App.tsx)
// ============================================================================

/** What a `#share=` link carries: the model parameters and the country dataset they ran on. */
export interface SharePayload {
  model?: ModelParameters;
  countryDataset: CountryDatasetId;
}

/** Base64 payload for a `#share=` link (ASCII-safe JSON, as the links have always been). */
export function encodeSharePayload(model: ModelParameters, countryDataset: CountryDatasetId): string {
  return utf8ToBase64(JSON.stringify({ model, countryDataset }));
}

/** Decode a `#share=` payload. Links made before the 2026-09 migration have no dataset id: legacy. */
export function decodeSharePayload(encoded: string): SharePayload {
  let parsed: { model?: ModelParameters; countryDataset?: unknown };
  try {
    parsed = JSON.parse(base64ToUtf8(encoded));
  } catch (err) {
    throw new ScenarioParseError(`Link is not valid share data: ${err instanceof Error ? err.message : String(err)}`);
  }
  return { model: parsed?.model, countryDataset: resolveCountryDataset(parsed?.countryDataset) };
}

/**
 * Pull the base64 payload out of a `window.location.hash`-style string, or null when the
 * hash isn't a `#scenario=...` link (e.g. empty, or the unrelated `#share=` preset link).
 */
export function extractScenarioHashParam(hash: string): string | null {
  if (!hash || !hash.startsWith(SCENARIO_HASH_PREFIX)) return null;
  const value = hash.slice(SCENARIO_HASH_PREFIX.length);
  return value.length > 0 ? value : null;
}

/** A safe filename for the exported JSON download, derived from the scenario's name. */
export function scenarioFileName(config: ModelConfig): string {
  const slug = config.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${slug || 'scenario'}.json`;
}

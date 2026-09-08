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
 */

import { ModelConfig } from '../../types';

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

/** Serialize a scenario to pretty-printed JSON, suitable for a file download. */
export function exportScenarioJson(config: ModelConfig): string {
  return JSON.stringify(config, null, 2);
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
  return parsed;
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
export function encodeScenarioForUrl(config: ModelConfig): string {
  return utf8ToBase64(JSON.stringify(config));
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
export function buildScenarioShareUrl(config: ModelConfig, origin: string, pathname: string): string {
  return `${origin}${pathname}${SCENARIO_HASH_PREFIX}${encodeScenarioForUrl(config)}`;
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

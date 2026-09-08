/**
 * Round-trip tests for scenario export/import and share-link encode/decode (P9-T8).
 */

import { describe, it, expect } from 'vitest';
import {
  exportScenarioJson,
  parseScenarioJson,
  encodeScenarioForUrl,
  decodeScenarioFromUrl,
  buildScenarioShareUrl,
  extractScenarioHashParam,
  scenarioFileName,
  ScenarioParseError
} from './scenarioShare';
import { DEFAULT_MODEL_CONFIG } from '../../constants';
import { ModelConfig } from '../../types';

const sampleConfig: ModelConfig = {
  ...DEFAULT_MODEL_CONFIG,
  id: 'custom-test-1',
  name: 'Test Scenario ☀️ café',
  description: 'A scenario with unicode: 你好, éèê, emoji 🚀',
  equations: {
    ...DEFAULT_MODEL_CONFIG.equations,
    wellbeingDelta: 'ubiBoost * 0.30 - displacementFriction * 0.10'
  }
};

describe('scenarioShare: JSON export/import round trip', () => {
  it('round-trips a scenario through exportScenarioJson -> parseScenarioJson', () => {
    const json = exportScenarioJson(sampleConfig);
    const restored = parseScenarioJson(json);
    expect(restored).toEqual(sampleConfig);
  });

  it('produces pretty-printed JSON (readable file download)', () => {
    const json = exportScenarioJson(sampleConfig);
    expect(json).toContain('\n');
    expect(json).toContain('"name"');
  });

  it('throws a ScenarioParseError with a helpful message on invalid JSON', () => {
    expect(() => parseScenarioJson('{not valid json')).toThrow(ScenarioParseError);
    expect(() => parseScenarioJson('{not valid json')).toThrow(/not valid json/i);
  });

  it('throws a ScenarioParseError when the JSON is valid but not a scenario shape', () => {
    expect(() => parseScenarioJson(JSON.stringify({ foo: 'bar' }))).toThrow(ScenarioParseError);
    expect(() => parseScenarioJson(JSON.stringify({ foo: 'bar' }))).toThrow(/does not look like a scenario/i);
  });

  it('rejects a scenario missing the equations field', () => {
    const { equations, ...withoutEquations } = sampleConfig;
    expect(() => parseScenarioJson(JSON.stringify(withoutEquations))).toThrow(ScenarioParseError);
  });

  it('derives a safe filename from the scenario name', () => {
    expect(scenarioFileName(sampleConfig)).toMatch(/^[a-z0-9-]+\.json$/);
    expect(scenarioFileName({ ...sampleConfig, name: '   ' })).toBe('scenario.json');
  });
});

describe('scenarioShare: share-URL hash encode/decode round trip', () => {
  it('round-trips a scenario through encodeScenarioForUrl -> decodeScenarioFromUrl', () => {
    const encoded = encodeScenarioForUrl(sampleConfig);
    const restored = decodeScenarioFromUrl(encoded);
    expect(restored).toEqual(sampleConfig);
  });

  it('preserves unicode content through the base64 hop', () => {
    const encoded = encodeScenarioForUrl(sampleConfig);
    const restored = decodeScenarioFromUrl(encoded);
    expect(restored.name).toBe(sampleConfig.name);
    expect(restored.description).toBe(sampleConfig.description);
  });

  it('builds a full share URL containing the #scenario= prefix', () => {
    const url = buildScenarioShareUrl(sampleConfig, 'https://example.com', '/app');
    expect(url).toMatch(/^https:\/\/example\.com\/app#scenario=/);
  });

  it('round-trips through buildScenarioShareUrl -> extractScenarioHashParam -> decodeScenarioFromUrl', () => {
    const url = buildScenarioShareUrl(sampleConfig, 'https://example.com', '/app');
    const hash = url.slice(url.indexOf('#'));
    const param = extractScenarioHashParam(hash);
    expect(param).not.toBeNull();
    const restored = decodeScenarioFromUrl(param as string);
    expect(restored).toEqual(sampleConfig);
  });

  it('extractScenarioHashParam returns null for unrelated or empty hashes', () => {
    expect(extractScenarioHashParam('')).toBeNull();
    expect(extractScenarioHashParam('#share=abc123')).toBeNull();
    expect(extractScenarioHashParam('#scenario=')).toBeNull();
    expect(extractScenarioHashParam('#somethingelse')).toBeNull();
  });

  it('throws a ScenarioParseError when the hash payload is not valid base64/JSON', () => {
    expect(() => decodeScenarioFromUrl('not-valid-base64!!!')).toThrow(ScenarioParseError);
  });

  it('throws a ScenarioParseError when the hash payload decodes to non-scenario JSON', () => {
    const bogus = Buffer.from(JSON.stringify({ hello: 'world' }), 'utf-8').toString('base64');
    expect(() => decodeScenarioFromUrl(bogus)).toThrow(ScenarioParseError);
  });
});

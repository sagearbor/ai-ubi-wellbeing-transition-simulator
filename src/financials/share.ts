import { ENGINE_VERSION, NUMERICAL_CONVENTIONS } from '../core/engine';
import { contentHash, modelHash } from '../policy/hash';
import { financialCollection, financialRecord, financialRecords } from './catalog';
import { recipientCohorts } from './cohorts';
import { createFinancialModel, defaultFinancialScenario, validateFinancialScenario } from './model';
import type { FinancialScenario } from './types';

export const FINANCE_PREFIX = '#finance=';
export const MAX_FINANCE_BYTES = 16000;
export interface FinancialExperiment {
  version: 1;
  collectionId: string;
  recipientsId: string;
  dataHash: string;
  engineVersion: string;
  numericalHash: string;
  recordId: string;
  scenarios: { A: FinancialScenario; B: FinancialScenario };
  modelHashes: { A: string; B: string };
  view: 'explore' | 'compare';
}
const pins = { collectionId: financialCollection.id, recipientsId: recipientCohorts[0].datasetId,
  dataHash: contentHash({ financialRecords, recipientCohorts }), engineVersion: ENGINE_VERSION,
  numericalHash: contentHash(NUMERICAL_CONVENTIONS) };
export function buildExperiment(recordId = 'apple-fy2025', scenarios = { A: { ...defaultFinancialScenario }, B: { ...defaultFinancialScenario, trainingShare: .2 } }, view: FinancialExperiment['view'] = 'explore'): FinancialExperiment {
  const record = financialRecord(recordId);
  for (const s of Object.values(scenarios)) validateFinancialScenario(s);
  if (scenarios.A.recipientCountry !== scenarios.B.recipientCountry) throw new Error('Comparison scenarios must share the recipient cohort.');
  return { version: 1, ...pins, recordId, scenarios, view,
    modelHashes: { A: modelHash(createFinancialModel(record, scenarios.A)), B: modelHash(createFinancialModel(record, scenarios.B)) } };
}
export function validateExperiment(value: unknown): FinancialExperiment {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Missing saved experiment.');
  const v = value as FinancialExperiment;
  if (JSON.stringify(value).length > MAX_FINANCE_BYTES) throw new Error('Saved experiment is too large.');
  if (v.version !== 1) throw new Error('Unsupported saved experiment version.');
  for (const key of Object.keys(pins) as (keyof typeof pins)[]) if (v[key] !== pins[key]) throw new Error(`Stale or unknown ${key}; this experiment cannot be reproduced with the current data and engine.`);
  if (v.view !== 'explore' && v.view !== 'compare') throw new Error('Unknown experiment view.');
  if (typeof v.recordId !== 'string' || !v.scenarios?.A || !v.scenarios?.B) throw new Error('Missing company or scenario inputs.');
  const rebuilt = buildExperiment(v.recordId, v.scenarios, v.view);
  if (contentHash(v.modelHashes) !== contentHash(rebuilt.modelHashes)) throw new Error('Model hashes do not match the saved inputs.');
  return rebuilt;
}
export function parseExperiment(text: string): FinancialExperiment {
  if (text.length > MAX_FINANCE_BYTES) throw new Error('Saved experiment is too large.');
  return validateExperiment(JSON.parse(text));
}
export function encodeExperiment(value: FinancialExperiment): string {
  return encodeURIComponent(JSON.stringify(validateExperiment(value)));
}
export function decodeExperiment(hash: string): FinancialExperiment {
  if (!hash.startsWith(FINANCE_PREFIX) || hash.length > MAX_FINANCE_BYTES * 3) throw new Error('Malformed financial experiment link.');
  return parseExperiment(decodeURIComponent(hash.slice(FINANCE_PREFIX.length)));
}
export function experimentUrl(value: FinancialExperiment, base: string, side?: 'A' | 'B'): string {
  const url = new URL(base); url.search = ''; url.searchParams.set('tab', side ? 'lab' : value.view);
  if (side) url.searchParams.set('side', side);
  url.hash = FINANCE_PREFIX + encodeExperiment(value); return url.href;
}
export function exactModel(value: FinancialExperiment, side: 'A' | 'B') {
  const checked = validateExperiment(value);
  return createFinancialModel(financialRecord(checked.recordId), checked.scenarios[side]);
}

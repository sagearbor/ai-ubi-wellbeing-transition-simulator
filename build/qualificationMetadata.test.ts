import { describe, expect, it } from 'vitest';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { canonicalJson } from '../src/policy/hash';
import { conditionalCases, runConditionalProfile } from '../validation/conditionalProfile';
import { assertFreshSources } from './qualificationSources';
import evidence from '../data/qualification/world-conditional-v1-evidence.json';
import acceptance from '../data/qualification/world-conditional-v1.json';
import structure from '../data/qualification/world-conditional-v1-structure.json';

const contentHash = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');
// Empty execution list builds the current header without running or reading the raw profile.
const { cases: _empty, ...header } = runConditionalProfile({ cases: [] });
const declared = conditionalCases();
const zeroCounts = ['missing', 'incomplete', 'altered', 'duplicates', 'failures', 'accountingFailures', 'outputFailures'] as const;

/** Metadata consistency is not proof of the absent raw case bytes or their arithmetic. */
function verifyMetadata(e = evidence, a = acceptance) {
  assert.equal(e.version, header.version);
  assert.equal(e.modelId, header.modelId);
  assert.equal(e.headerHash, contentHash(header));
  assert.deepEqual(header.expectedIds, declared.map(c => c.id));
  assert.equal(new Set(header.expectedIds).size, declared.length);
  assert.deepEqual(header.expectedInputHashes, Object.fromEntries(declared.map(c => [c.id, contentHash(c)])));
  assert.equal(e.caseHashes.length, declared.length);
  assert.ok(e.caseHashes.every(hash => /^[a-f0-9]{64}$/.test(hash)));
  assert.equal(contentHash(e.caseHashes), e.payloadHash);
  assert.equal(a.evidenceHash, e.payloadHash);
  assert.equal(e.structureHash, structure.hash);
  assert.equal(a.structureHash, structure.hash);
  for (const key of ['expected', 'attempted', 'completed'] as const) assert.equal(e.audit[key], declared.length);
  for (const key of zeroCounts) assert.equal(e.audit[key], 0);
  assert.equal(e.audit.pass, true);
  assert.equal(e.baselineRunIdentities.length, header.months + 1);
  assert.equal(e.baselineRunIdentities.length, 61);
  assert.equal(new Set(e.baselineRunIdentities).size, 61);
  assert.ok(e.baselineRunIdentities.every(hash => /^[a-f0-9]{64}$/.test(hash)));
  assert.deepEqual(a.reviewedRunIdentities, e.baselineRunIdentities);
}

describe('clean-checkout qualification metadata integrity (no raw profile required)', () => {
  it('binds current source/lock files, declared header, ordered cases and accepted baseline identities', () => {
    assertFreshSources(process.cwd(), structure);
    verifyMetadata();
  });
  it.each(['missing', 'changed', 'reordered'] as const)('rejects %s case hashes even with audit.pass retained', kind => {
    const altered = structuredClone(evidence);
    if (kind === 'missing') altered.caseHashes.pop();
    if (kind === 'changed') altered.caseHashes[0] = '0'.repeat(64);
    if (kind === 'reordered') [altered.caseHashes[0], altered.caseHashes[1]] = [altered.caseHashes[1], altered.caseHashes[0]];
    expect(() => verifyMetadata(altered)).toThrow();
  });
  it('rejects changed hashes with recomputed payload but unchanged acceptance', () => {
    const altered = structuredClone(evidence);
    altered.caseHashes[0] = '0'.repeat(64);
    altered.payloadHash = contentHash(altered.caseHashes);
    expect(() => verifyMetadata(altered)).toThrow();
  });
  it.each(['expected', 'attempted', 'completed', ...zeroCounts] as const)('rejects contradictory %s count even with audit.pass retained', key => {
    const altered = structuredClone(evidence);
    altered.audit[key] += 1;
    expect(() => verifyMetadata(altered)).toThrow();
  });
  it.each(['headerHash', 'structureHash'] as const)('rejects altered %s', key => {
    const altered = structuredClone(evidence);
    altered[key] = '0'.repeat(64);
    expect(() => verifyMetadata(altered)).toThrow();
  });
  it.each(['missing', 'duplicate', 'reordered'] as const)('rejects %s baseline identities', kind => {
    const altered = structuredClone(evidence);
    if (kind === 'missing') altered.baselineRunIdentities.pop();
    if (kind === 'duplicate') altered.baselineRunIdentities[1] = altered.baselineRunIdentities[0];
    if (kind === 'reordered') [altered.baselineRunIdentities[0], altered.baselineRunIdentities[1]] = [altered.baselineRunIdentities[1], altered.baselineRunIdentities[0]];
    expect(() => verifyMetadata(altered)).toThrow();
  });
  it('rejects a removed required audit counter', () => {
    const altered = structuredClone(evidence);
    Reflect.deleteProperty(altered.audit, 'outputFailures');
    expect(() => verifyMetadata(altered)).toThrow();
  });
});

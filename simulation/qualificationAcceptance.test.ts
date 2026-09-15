import { describe, it, expect } from 'vitest';
import { DEFAULT_MODEL } from '../constants';
import { initialRun, initOptionsFor, advanceRun } from './run';
import { resolveQualification } from './qualification';
import { executingSourceHash } from './sourceFreshness';
import record from '../data/qualification/world-conditional-v1.json';
import evidence from '../data/qualification/world-conditional-v1-evidence.json';
import structure from '../data/qualification/world-conditional-v1-structure.json';

describe('independently accepted exact default accounting points', () => {
  it('binds the automated review to exactly the 61 independently checked baseline identities', () => {
    expect(executingSourceHash()).toBe(structure.hash);
    expect(record.independentReview).toBe('accepted');
    expect(record.reviewer).toBe('Independent automated Astra security/numerical review');
    expect(record.reviewReport).toBe('docs/design/reviews/2026-09-15-beta-security-qualification-review.md');
    expect(record.evidenceHash).toBe(evidence.payloadHash);
    expect(record.structureHash).toBe(evidence.structureHash);
    expect(record.reviewedRunIdentities).toEqual(evidence.baselineRunIdentities);
    expect(new Set(record.reviewedRunIdentities).size).toBe(61);
  });

  it('accepts actual baseline months while keeping broader capabilities illustrative', () => {
    let run = initialRun(undefined, undefined, initOptionsFor(DEFAULT_MODEL));
    for (let month = 0; month <= 60; month++) {
      const qualification = resolveQualification(DEFAULT_MODEL, run);
      expect(qualification.accounting).toBe('reviewed-conditional');
      expect(qualification.macro).toBe('illustrative');
      expect(qualification.wellbeing).toBe('illustrative');
      expect(qualification.unsupported).toContain('net-welfare');
      if (month < 60) run = advanceRun(run, { model: DEFAULT_MODEL });
    }
  });

  it('refuses modified inputs, imported snapshots, supplied equations and altered derived results', () => {
    const base = initialRun(undefined, undefined, initOptionsFor(DEFAULT_MODEL));
    for (const edit of [
      (run: typeof base) => {
        run.corporations[0].marketCap += 1e-10;
      },
      (run: typeof base) => {
        run.state.countryData.USA.laborForcePerResident! += 1e-12;
      },
      (run: typeof base) => {
        run.state.importedUnverified = true;
      },
      (run: typeof base) => {
        run.state.countryData.USA.conditionalWellbeing!.raw += 0.01;
      },
    ]) {
      const changed = structuredClone(base);
      edit(changed);
      expect(resolveQualification(DEFAULT_MODEL, changed).accounting).toBe('unreviewed');
    }
    expect(resolveQualification(DEFAULT_MODEL, base, {}).accounting).toBe('unreviewed');
  });
});

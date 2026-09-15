/** Scenario provenance is independent of whether its base model is a known fixture. */
import { CORE_FIXTURES } from '../core/fixtures';
import type { CoreModel, Overlay } from '../core/types';
import { contentHash, modelHash } from './hash';

export interface ScenarioProvenance {
  kind: 'fixture' | 'experimental' | 'source-import';
  /** Why incompatible source was imported for a new run. */
  reason?: string;
}

export function validProvenance(value: unknown): value is ScenarioProvenance {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const p = value as ScenarioProvenance;
  return ['fixture', 'experimental', 'source-import'].includes(p.kind) &&
    (p.reason === undefined || typeof p.reason === 'string') &&
    (p.kind !== 'source-import' || !!p.reason);
}

/** Recorded data can retain an experimental status, but cannot certify edited fixture content. */
export function scenarioProvenance(model: CoreModel, overlays: Overlay[], recorded?: ScenarioProvenance): ScenarioProvenance {
  if (validProvenance(recorded) && recorded.kind !== 'fixture') return {...recorded};
  const fixture = CORE_FIXTURES.find((f) => f.model.id === model.id && modelHash(f.model) === modelHash(model));
  const known = fixture && overlays.every((o) => fixture.overlays.some((f) => f.id === o.id && contentHash(f) === contentHash(o)));
  return {kind: known ? 'fixture' : 'experimental'};
}

/** Compatibility for packages written before structured provenance (through e622b10).
 * Nonempty legacy warnings conservatively retain experimental status. No English
 * marker is interpreted, and an explicit modern provenance field takes precedence.
 * The original reasons remain in the package's importWarnings array.
 */
export function packageProvenance(recorded: unknown, legacyWarnings: unknown): ScenarioProvenance | undefined {
  if (validProvenance(recorded)) return recorded;
  if (recorded === undefined && Array.isArray(legacyWarnings) && legacyWarnings.some((w) => typeof w === 'string' && w.trim())) {
    return {kind: 'experimental'};
  }
  return undefined;
}

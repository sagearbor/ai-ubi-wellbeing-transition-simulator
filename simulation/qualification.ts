/** Local qualification authority. Saved files cannot provide review records or attestations. */
import { canonicalJson, sha256Hex } from '../src/policy/hash';
const contentHash = (v: unknown) => sha256Hex(canonicalJson(v));
import type { ModelParameters } from '../types';
import type { SimulationRun } from './run';
import { resolveRunCapabilities } from './capabilities';
import record from '../data/qualification/world-conditional-v1.json';
import evidence from '../data/qualification/world-conditional-v1-evidence.json';
import structure from '../data/qualification/world-conditional-v1-structure.json';
export const QUALIFICATION_STRUCTURE_VERSION = 'conditional-engine-4bee00c-v1';
function requireFinite(value: unknown): void {
    if (typeof value === 'number' && !Number.isFinite(value))
        throw new Error('Non-finite qualification input');
    if (value && typeof value === 'object')
        Object.values(value).forEach(requireFinite);
}
/** Complete actual snapshot, including roster, money provenance, workforce and all model fields.
 * Exact-point region, deliberately no interpolation or model-ID-only inheritance. */
export function qualificationInputText(model: ModelParameters, run: SimulationRun): string {
    requireFinite({ model, run });
    return canonicalJson({ structure: { version: QUALIFICATION_STRUCTURE_VERSION, hash: structure.hash }, model, run });
}
export function qualificationIdentity(model: ModelParameters, run: SimulationRun): string { return sha256Hex(qualificationInputText(model, run)); }
export interface QualificationResult {
    version: string;
    identity: string | null;
    structureVersion: string;
    accounting: 'reviewed-conditional' | 'unreviewed';
    macro: 'illustrative';
    wellbeing: 'illustrative';
    independentReview: string;
    scope: string;
    geography: string[];
    firstMonth: number;
    lastMonth: number;
    controls: string[];
    unsupported: string[];
    monetaryBasis: SimulationRun['state']['outputDefinition'];
    limitations: string[];
    reasons: string[];
}
export function resolveQualification(model: ModelParameters, run: SimulationRun, equations?: unknown): QualificationResult {
    const capabilities = resolveRunCapabilities(model);
    let identity: string | null = null;
    const reasons: string[] = [];
    try {
        identity = qualificationIdentity(model, run);
    }
    catch (e) {
        reasons.push(String(e));
    }
    if (run.state.importedUnverified)
        reasons.push('Imported snapshot: recomputed accounting does not verify imported macro history.');
    if (record.independentReview !== 'accepted')
        reasons.push('Independent review pending; generated computational checks are not independent review.');
    if (!identity || !(record.reviewedRunIdentities as string[]).includes(identity))
        reasons.push('Actual complete input/snapshot signature is outside the locally reviewed exact-point region.');
    if (equations)
        reasons.push('Uploaded equations are not supported by this accounting contract.');
    if (run.state.month > 60)
        reasons.push('Month outside reviewed 0–60 horizon.');
    if (record.evidenceHash !== evidence.payloadHash || !evidence.audit.pass || !record.reviewer || !record.reviewReport)
        reasons.push('No complete locally pinned independent evidence acceptance.');
    if (record.structureHash !== structure.hash || evidence.structureHash !== structure.hash)
        reasons.push("Pinned review does not match the built source manifest.");
    const reviewed = capabilities.conditional && reasons.length === 0;
    return { version: record.version, identity, structureVersion: QUALIFICATION_STRUCTURE_VERSION,
        accounting: reviewed ? 'reviewed-conditional' as const : 'unreviewed' as const,
        macro: 'illustrative' as const, wellbeing: 'illustrative' as const,
        independentReview: record.independentReview, scope: record.scope,
        geography: Object.keys(run.state.countryData).sort(), firstMonth: 0, lastMonth: 60,
        controls: capabilities.supportedControls, unsupported: capabilities.unsupported,
        monetaryBasis: run.state.outputDefinition, limitations: [...capabilities.limitations, ...record.unresolved], reasons };
}

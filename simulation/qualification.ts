/** Local qualification authority. Saved files cannot provide review records or attestations. */
import { canonicalJson, sha256Hex } from '../src/policy/hash';
import type { ModelParameters } from '../types';
import { evaluateConditionalSnapshot, type SimulationRun } from './run';
import { executingSourceHash } from './sourceFreshness';
import { resolveRunCapabilities } from './capabilities';
import record from '../data/qualification/world-conditional-v1.json';
import evidence from '../data/qualification/world-conditional-v1-evidence.json';
import structure from '../data/qualification/world-conditional-v1-structure.json';
export const QUALIFICATION_STRUCTURE_VERSION = 'conditional-input-identity-v2';
function requireFinite(value: unknown): void {
    if (typeof value === 'number' && !Number.isFinite(value))
        throw new Error('Non-finite qualification input');
    if (value && typeof value === 'object')
        Object.values(value).forEach(requireFinite);
}
/** Exact inputs and economic snapshot. Only derived illustrative mapping fields are excluded.
 * Authored values, money/workforce provenance, imports, macro/accounting and history stay exact. */
export function qualificationInputText(model: ModelParameters, run: SimulationRun): string {
    const { conditionalSummary: _summary, ...state } = run.state;
    const countryData = Object.fromEntries(Object.entries(state.countryData).map(([id, country]) => {
        const { conditionalWellbeing: _mapping, ...inputs } = country;
        return [id, inputs];
    }));
    const exact = { model, run: { ...run, state: { ...state, countryData } } };
    requireFinite(exact);
    return canonicalJson({ structure: { version: QUALIFICATION_STRUCTURE_VERSION, hash: executingSourceHash() ?? structure.hash }, ...exact });
}
/** Fixed absolute numerical tolerance for derived illustrative values only; no input rounding. */
export const DERIVED_OUTPUT_ABSOLUTE_TOLERANCE = 1e-10;
function sameDerived(actual: unknown, expected: unknown): boolean {
    if (typeof actual === 'number' && typeof expected === 'number') {
        return Number.isFinite(actual) && Number.isFinite(expected)
            && Math.abs(actual - expected) <= DERIVED_OUTPUT_ABSOLUTE_TOLERANCE;
    }
    if (actual && expected && typeof actual === 'object' && typeof expected === 'object') {
        const a = actual as Record<string, unknown>, b = expected as Record<string, unknown>;
        return Object.keys(a).length === Object.keys(b).length
            && Object.keys(b).every(key => Object.hasOwn(a, key) && sameDerived(a[key], b[key]));
    }
    return actual === expected;
}
export function checkDerivedOutputs(model: ModelParameters, run: SimulationRun): boolean {
    try {
        const checked = evaluateConditionalSnapshot(run, { model });
        return sameDerived(run.state.conditionalSummary, checked.state.conditionalSummary)
            && Object.keys(checked.state.countryData).every(id => sameDerived(run.state.countryData[id]?.conditionalWellbeing, checked.state.countryData[id].conditionalWellbeing));
    }
    catch {
        return false;
    }
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
    if (executingSourceHash() !== structure.hash)
        reasons.push('Executing source freshness is unverified or stale; this runtime cannot grant reviewed status.');
    if (capabilities.conditional && !checkDerivedOutputs(model, run))
        reasons.push('Derived output check failed: fixed absolute tolerance 1e-10; no authored inputs are rounded.');
    const reviewed = capabilities.conditional && reasons.length === 0;
    return { version: record.version, identity, structureVersion: QUALIFICATION_STRUCTURE_VERSION,
        accounting: reviewed ? 'reviewed-conditional' as const : 'unreviewed' as const,
        macro: 'illustrative' as const, wellbeing: 'illustrative' as const,
        independentReview: record.independentReview, scope: record.scope,
        geography: Object.keys(run.state.countryData).sort(), firstMonth: 0, lastMonth: 60,
        controls: capabilities.supportedControls, unsupported: capabilities.unsupported,
        monetaryBasis: run.state.outputDefinition, limitations: [...capabilities.limitations, ...record.unresolved], reasons };
}

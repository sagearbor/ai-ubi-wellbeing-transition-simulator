import { DEFAULT_EQUATIONS } from '../constants';
import type { ModelParameters } from '../types';
import type { CompiledEquationSet } from '../src/services/equationParser';
export class RunScopeError extends Error {
    constructor(public code: 'unsupported-horizon' | 'unsupported-equations' | 'invalid-scenario', message: string) {
        super(message);
        this.name = 'RunScopeError';
    }
}
export function resolveRunCapabilities(model: ModelParameters, equations?: CompiledEquationSet) {
    const conditional = model.executionMode === 'world-conditional-v1';
    const anchored = model.macro?.wellbeingMode === 'anchored';
    const equationIssue = equations && (conditional || anchored)
        ? 'Uploaded wellbeing hooks are unsupported by this output definition; select a legacy flow model or remove the upload.'
        : equations && (['demandCollapse', 'reputationChange', 'giniDamping'] as const).some(key => equations[key] && (!equations.sourceExpressions || equations.sourceExpressions[key] !== DEFAULT_EQUATIONS[key]))
            ? 'Optional demandCollapse, reputationChange and giniDamping hooks are not implemented; remove these hooks.' : undefined;
    const supportedControls = conditional
        ? ['contributionRate', 'distributionStrategy', 'availableShare', 'fundingRequest', 'marketCap', 'aiAdoptionLevel', 'aiGrowthRate', 'baselineGrowth', 'productivityGain', 'automationShare', 'reemploymentMonths', 'laborShareSensitivity', 'transferEffectPerDoubling', 'nonIncomeLossPerAdditionalUnemployedPerson', 'incomeDenominatorMultiplier', 'cognitiveShare', 'naturalUnemployment', 'laborForcePerResident']
        : ['contributionRate', 'distributionStrategy', 'aiGrowthRate', ...(!anchored ? ['gdpScaling', 'displacementRate'] : []), ...(model.macro ? ['baselineGrowth', 'productivityGain', 'automationShare', 'reemploymentMonths', 'laborShareSensitivity', 'wellbeingAnchorRate', ...(anchored ? ['ubiEffectPerDoubling', 'unemploymentEffectPerPoint'] : [])] : [])];
    return {
        conditional, lastMonth: model.macro?.usReference ? 60 : null, equationIssue, supportedControls,
        wellbeingLabel: conditional ? 'Conditional wellbeing index' : 'Legacy wellbeing index',
        unsupported: conditional ? ['realized-wellbeing-timing', 'wellbeing-to-demand', 'corporate-adaptation', 'game-theory', 'transfer-to-macro', 'net-welfare', 'risk-safety'] : [],
        limitations: conditional ? ['Fixed corporate response inputs; modeled source pool, not profits or surplus cash.', 'Expenses, ownership and competing uses are unestimated.', 'Wellbeing is an illustrative recipient-side mapping, not net welfare.', 'Transfer-to-macro feedback and realized wellbeing timing are unestimated.', 'Unemployment is an assumed additive non-income decomposition; empirical independence is not established.'] : ['Legacy demand ratio mixes millions and billions (factor 1000 before its cap); retained for replay.'],
    };
}
export function assertRunSupported(model: ModelParameters, month: number, equations?: CompiledEquationSet): void {
    if(model.executionMode !== undefined && model.executionMode !== 'world-conditional-v1') throw new RunScopeError('invalid-scenario','Unknown execution mode');
    const c = resolveRunCapabilities(model, equations);
    if (!Number.isInteger(month) || month < 0 || (c.lastMonth !== null && month > c.lastMonth))
        throw new RunScopeError('unsupported-horizon', `Month ${month} is outside supported scope (US reference ends month 60).`);
    if (c.equationIssue)
        throw new RunScopeError('unsupported-equations', c.equationIssue);
}

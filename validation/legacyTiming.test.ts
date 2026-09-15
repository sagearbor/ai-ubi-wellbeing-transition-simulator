import { it, expect } from 'vitest';
import { PRESET_MODELS, DEFAULT_MODEL } from '../constants';
import { initialRun, initOptionsFor, advanceRun } from '../simulation/run';
import { anchoredWellbeingTarget } from '../simulation/pure';
it('legacy fixed target follows the analytic recurrence at assumed rates 0/.02/1', () => {
    for (const rate of [0, .02, 1]) {
        const model = structuredClone(PRESET_MODELS.find(m => m.id === 'evidence-anchored')!);
        model.aiGrowthRate = 0;
        Object.assign(model.macro!, { baselineGrowth: 0, productivityGain: 0, laborShareSensitivity: 0, automationShare: 0, wellbeingAnchorRate: rate });
        let run = initialRun([], undefined, initOptionsFor(model));
        const initial = run.state.countryData.USA.wellbeing;
        for (let t = 1; t <= 60; t++) {
            run = advanceRun(run, { model });
            const c = run.state.countryData.USA;
            const target = anchoredWellbeingTarget(c, model.macro!, 0).target;
            expect(c.wellbeing).toBeCloseTo(target + (initial - target) * Math.pow(1 - rate, t), 10);
        }
    }
});
it('new conditional output is independent of past wellbeing values', () => {
    const base = initialRun(undefined, undefined, initOptionsFor(DEFAULT_MODEL)), changed = structuredClone(base);
    for (const c of Object.values(changed.state.countryData)) {
        c.wellbeing = 1;
        c.wellbeingTrend = [100, 1, 100];
    }
    const a = advanceRun(base, { model: DEFAULT_MODEL }), b = advanceRun(changed, { model: DEFAULT_MODEL });
    expect(b.state.conditionalSummary).toEqual(a.state.conditionalSummary);
    expect(b.state.sourceAccounting).toEqual(a.state.sourceAccounting);
});

/**
 * Model-native calendars (review 2026-09-14 finding 15): a model whose step is not a calendar year
 * says so, and the labels follow the model, never a calendar.
 */

import { describe, expect, it } from 'vitest';
import { calendarNote, isCalendarTime, steadyStateOf, timeAxisTitle, timeLabel, timeUnitName } from './calendar';
import { compileModel, runModel, runTests } from './engine';
import { findFixture } from './fixtures';
import type { CoreModel } from './types';
import { validateCoreModel } from './validate';

const gp = findFixture('gasteiger-prettner-2020')!.model;
const training = findFixture('training-budget')!.model;
const cohort = findFixture('cohort-flow')!.model;

describe('calendar labels', () => {
  it('calendar models print years; a generation model prints generations', () => {
    expect(isCalendarTime(training.time)).toBe(true);
    expect(timeUnitName(training.time)).toBe('Year');
    expect(timeLabel(training.time, 2029)).toBe('2029');
    expect(timeLabel(cohort.time, 2027.5)).toBe('2027.50');
    expect(calendarNote(training.time)).toBeNull();

    expect(isCalendarTime(gp.time)).toBe(false);
    expect(timeUnitName(gp.time)).toBe('Generation');
    expect(timeLabel(gp.time, 3)).toBe('Generation 3');
    expect(timeAxisTitle(gp.time)).toBe('generation (25 years each)');
    expect(calendarNote(gp.time)).toContain('One step is one generation (25 years)');
    expect(calendarNote(gp.time)).toContain('not calendar years');
  });

  it('Gasteiger-Prettner declares a 25-year generation step and steady-state-only welfare outputs', () => {
    expect(gp.time).toMatchObject({ start: 0, end: 40, step: 'year', stepLabel: 'generation', stepYears: 25 });
    const steady = steadyStateOf(gp)!;
    expect([...steady.outputs].sort()).toEqual(['c1_prev', 'c2_prev', 'cv1_pct', 'cv2_pct', 'utility_prev']);
    expect(steady.at).toBe(40);
    for (const o of steady.outputs) expect(gp.outputs).toContain(o);
  });

  it('declaring the calendar changes no number: every embedded test still passes', () => {
    const outcomes = runTests(gp);
    expect(outcomes.length).toBe(46);
    expect(outcomes.filter((o) => !o.passed).map((o) => o.message)).toEqual([]);
    expect(validateCoreModel(gp).ok).toBe(true);
  });

  it('the schema accepts stepLabel/stepYears/limitations and rejects a bad one; the engine checks the steady-state step', () => {
    const bad = JSON.parse(JSON.stringify(gp)) as CoreModel;
    bad.time.stepYears = -1;
    expect(validateCoreModel(bad).errors.some((e) => e.includes('/time/stepYears'))).toBe(true);
    const off = JSON.parse(JSON.stringify(gp)) as CoreModel;
    off.limitations!.steadyStateOnly!.at = 40.5;
    expect(compileModel(off).diagnostics.some((d) => d.message.includes('steadyStateOnly.at 40.5 is not a step'))).toBe(true);
    const unknown = JSON.parse(JSON.stringify(training)) as CoreModel;
    unknown.limitations = { steadyStateOnly: { outputs: ['nope'], reason: 'x' } };
    expect(runModel(unknown).diagnostics.some((d) => d.level === 'warning' && d.message.includes('"nope"'))).toBe(true);
  });
});

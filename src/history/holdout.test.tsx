import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import raw from '../../data/evaluation/level-holdout-2018/experience.json';
import HistoryExperience from '../../components/history/HistoryExperience';
import HeldoutExperience from '../../components/history/HeldoutExperience';
import { holdoutRows, holdoutValues, holdoutFormat, type HoldoutArtifact } from './holdout';
const artifact=raw as HoldoutArtifact;
describe('held-out presentation',()=>{
 it('uses actual independent masks and a stable origin cohort',()=>{expect(artifact.origin.countries).toHaveLength(100);for(const outcome of ['ladder','gdp'] as const){const rows=artifact.scores.rows.filter(r=>r.outcome===outcome);expect(rows).toHaveLength(700);expect(rows.filter(r=>r.actual!==null)).toHaveLength(artifact.scores.outcomes[outcome].overall.observed);expect(new Set(rows.map(r=>r.id))).toEqual(new Set(artifact.origin.countries.map(c=>c.id)));}});
 it('preserves zero observations and missing gaps',()=>{const row=holdoutRows(artifact,'USA','ladder')[0];expect(holdoutValues({...row,actual:0}).observed).toBe(0);expect(holdoutValues({...row,actual:null}).observed).toBeNull();expect(holdoutFormat(null)).toBe('Not scored');expect(holdoutFormat(0)).toBe('0.000000');});
 it('keeps the original untuned failure visible in the preserved held-out view',()=>{const nav=renderToStaticMarkup(<HistoryExperience/>);expect(nav).toContain('aria-pressed="false">Held-out test');expect(nav).toContain('Historical reconstruction');const html=renderToStaticMarkup(<HeldoutExperience/>);expect(html).toContain('worse than persistence');for(const v of [artifact.scores.outcomes.ladder.overall.model.mae,artifact.scores.outcomes.ladder.overall.persistence.mae,artifact.scores.outcomes.ladder.overall.modelMinusPersistenceMae])expect(html).toContain(holdoutFormat(v,3));expect(html).toContain('0–10');expect(html).toContain('0–100');expect(html).toContain('Does the model beat predicting no change?');expect(html.indexOf('100 origin countries')).toBeLessThan(html.indexOf('<figure'));expect(html.indexOf('worse than persistence')).toBeLessThan(html.indexOf('<figure'));expect(html.indexOf('Aggregate held-out comparison')).toBeGreaterThan(html.indexOf('</figure>'));expect(html).toContain('691 / 700');expect(html).toContain('681 / 700');expect(html).toContain('not test the conditional-world default');});
});

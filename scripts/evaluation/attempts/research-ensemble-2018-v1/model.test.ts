import { describe, it, expect } from 'vitest';
import { fit, forecast, dampingSum, choose, crossValidate, type Row, type Weights, type CandidateResult } from './model';
const row = (id: string, year: number, ladder: number, gdp: number): Row => ({ id, year, ladder, gdp });
const P: Weights = [1,0,0,0];

describe('registered conservative ensemble: synthetic boundaries and forecasts', () => {
    it('rejects future values, duplicates, and invalid observations before fitting', () => {
        expect(() => fit([row('A',2017,5,100)],2016)).toThrow('past boundary');
        expect(() => fit([row('A',2016,5,100),row('A',2016,5,100)],2016)).toThrow('Duplicate');
        expect(() => fit([row('A',2016,5,0)],2016)).toThrow('Invalid');
    });
    it('keeps persistent country differences and exact origin GDP under persistence', () => {
        const f = fit([row('A',2015,3,123.4567),row('A',2018,3,123.4567),row('B',2018,9,99999.321)],2018);
        expect(forecast(f,'A',7,'gdp',P).value).toBe(123.4567);
        expect(forecast(f,'A',7,'ladder',P).value).toBe(3);
        expect(forecast(f,'B',7,'ladder',P).value).toBe(9);
    });
    it('uses calendar gaps and only actual prior values for the short smoother', () => {
        const f = fit([row('A',2015,3,100),row('A',2018,6,800)],2018);
        expect(f.countries[0].ladderSlope).toBe(1);
        expect(f.countries[0].ladderSmoother).toBe(5);
        expect(forecast(f,'A',1,'ladder',[.75,.25,0,0]).value).toBe(5.75);
        expect(forecast(f,'A',1,'gdp',[.75,.25,0,0]).value).toBeCloseTo(800*Math.pow(1/8,1/12),8);
    });
    it('falls back for single-value history, but does not invent a missing origin', () => {
        const f = fit([row('A',2018,5,100),row('B',2017,4,90)],2018);
        expect(f.countries[0].ladderSlope).toBe(0);
        expect(f.pooled.countries).toBe(0);
        expect(forecast(f,'A',7,'ladder',[.5,.25,.125,.125]).value).toBe(5);
        expect(() => forecast(f,'B',1,'gdp',P)).toThrow('Missing valid fold origin');
    });
    it('damps trends, uses an equal-country median, and visibly clamps ladder output', () => {
        const f = fit([row('A',2015,0,100),row('A',2016,10,110),row('B',2015,5,100),row('B',2016,5,120),row('C',2015,4,100),row('C',2016,5,130)],2016);
        expect(f.pooled.ladderSlope).toBe(1);
        expect(dampingSum(7,.8)).toBeLessThan(4);
        const p = forecast(f,'A',7,'ladder',[.75,0,.25,0]);
        expect(p.raw).toBeGreaterThan(10); expect(p.clamped).toBe(true); expect(p.value).toBe(10);
        expect(() => forecast(f,'A',8,'gdp',P)).toThrow('horizon');
    });
    it('prefers persistence within the registered tolerance, then loss and index', () => {
        const stub = (index: number, weights: Weights, score: number) => ({index,weights,score,cells:[],pooled:{n:1,mae:score,rmse:score,bias:score}} as CandidateResult);
        expect(choose([stub(0,P,1.005),stub(1,[.75,.25,0,0],1)],.01).index).toBe(0);
        expect(choose([stub(0,P,1.02),stub(1,[.75,.25,0,0],1)],.01).index).toBe(1);
        expect(choose([stub(2,[.75,0,.25,0],1),stub(1,[.75,.25,0,0],1)],.01).index).toBe(1);
    });
    it('validation target perturbation cannot alter earlier-fold fits or predictions', () => {
        const rows = [2015,2016,2017,2018].flatMap(y => [row('A',y,4+(y-2015)*.1,100*Math.pow(1.02,y-2015)),row('B',y,7,200)]);
        const config = {weights:[P,[.75,0,.25,0] as Weights],damping:.8,tolerance:.01};
        const a = crossValidate(rows,config);
        const changed = rows.map(r => r.year === 2018 ? {...r,ladder:1,gdp:r.gdp*3} : r);
        const b = crossValidate(changed,config);
        expect(b.folds).toEqual(a.folds);
        expect(b.ladder.candidates[1].cells[0]).toEqual(a.ladder.candidates[1].cells[0]);
        expect(b.gdp.candidates[1].cells[1].metrics.mae).not.toBe(a.gdp.candidates[1].cells[1].metrics.mae);
        expect(a.ladder.selected.cells.map(c=>c.metrics.n)).toEqual([2,2,2]);
    });
    it('rejects non-convex weights and preserves positive geometric GDP forecasts', () => {
        const f=fit([row('A',2015,5,10),row('A',2018,5,1)],2018);
        expect(() => forecast(f,'A',1,'gdp',[1,1,0,0])).toThrow('weights');
        expect(forecast(f,'A',7,'gdp',[.5,.25,.125,.125]).value).toBeGreaterThan(0);
    });
});

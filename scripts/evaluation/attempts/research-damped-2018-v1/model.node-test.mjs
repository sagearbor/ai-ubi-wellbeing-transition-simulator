import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {olsSlope, fitOutcome, forecast, dampingSum, evaluateCandidate, selectCandidate, fitAndPredict, validateTraining} from './model.mjs';
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const read = relative => JSON.parse(fs.readFileSync(new URL(relative, `file://${ROOT}`), 'utf8'));
const protocol = read('data/evaluation/research-damped-2018-v1/protocol.json');
const near = (actual, expected, tolerance = 1e-12) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const fixture = () => ({years: [2015,2016,2017,2018], countries: [{id:'AAA',name:'A'},{id:'BBB',name:'B'}],
  ladder: {AAA:{2015:4,2016:5,2017:6,2018:7},BBB:{2015:2,2016:4,2017:6,2018:8}},
  gdp: {AAA:Object.fromEntries([2015,2016,2017,2018].map(year=>[year,100*Math.exp(0.1*(year-2015))])),
    BBB:Object.fromEntries([2015,2016,2017,2018].map(year=>[year,200*Math.exp(0.2*(year-2015))]))}});
const candidate = {id:'pooled-w0.25-p0.8',target:'pooled',countryWeight:0.25,damping:0.8};
function smallInputs(train=fixture()) {
  const origin={originYear:2018,countries:train.countries.map(c=>({...c,ladder:train.ladder[c.id][2018],gdp:train.gdp[c.id][2018]}))};
  const config=structuredClone(protocol);
  config.cohort.rosterIds=origin.countries.map(c=>c.id);
  return {train,origin,config};
}

test('registered finite grid and chronological folds have their declared sizes', () => {
  assert.equal(protocol.candidateGrid.candidates.length,30);
  assert.equal(new Set(protocol.candidateGrid.candidates.map(c=>c.id)).size,30);
  for(const fold of protocol.validation.folds) {
    assert.equal(Math.max(...fold.trainingYears),fold.originYear);
    assert.ok(fold.targetYears.every(year=>year>fold.originYear && year<=2018));
  }
});
test('OLS uses actual calendar spacing and insufficient histories return no slope', () => {
  near(olsSlope([{year:2015,value:2},{year:2017,value:6},{year:2018,value:8}]),2);
  assert.equal(olsSlope([{year:2015,value:2}]),null);
  assert.equal(olsSlope([]),null);
});
test('country slopes, equal-country pool, shrinkage and damping match hand calculations', () => {
  const fit=fitOutcome(fixture(),'ladder',2016);
  near(fit.countries[0].slope,1);
  near(fit.countries[1].slope,2);
  near(fit.pooledSlope,1.5);
  near(dampingSum(0.8,2),1.44);
  const fc=forecast('ladder',5,1,1.5,candidate,2);
  near(fc.shrunkSlope,1.375);
  near(fc.prediction,6.98);
});
test('each fold fit is invariant to numerical changes after its origin', () => {
  const changed=fixture();
  changed.ladder.AAA[2017]=9;changed.ladder.AAA[2018]=0;
  changed.gdp.BBB[2017]=1;changed.gdp.BBB[2018]=10000;
  for(const outcome of ['ladder','gdp']) assert.deepEqual(fitOutcome(changed,outcome,2016),fitOutcome(fixture(),outcome,2016));
});
test('missing years are omitted; no slope uses the selected pool or zero fallback', () => {
  const train=fixture();delete train.ladder.AAA[2016];delete train.ladder.AAA[2017];delete train.ladder.AAA[2018];
  const fit=fitOutcome(train,'ladder',2018);
  assert.equal(fit.countries[0].slope,null);near(fit.pooledSlope,2);assert.equal(fit.pooledSlopeCountryCount,1);
  near(forecast('ladder',4,null,2,candidate,1).prediction,5.6);
  near(forecast('ladder',4,null,2,{...candidate,target:'zero'},1).prediction,4);
});
test('ladder bounds have explicit raw/clamped diagnostics', () => {
  const upper=forecast('ladder',9,3,0,{...candidate,countryWeight:1},2);
  assert.equal(upper.prediction,10);assert.equal(upper.clamped,true);near(upper.unclamped,13.32);
  const lower=forecast('ladder',1,-3,0,{...candidate,countryWeight:1},2);
  assert.equal(lower.prediction,0);assert.equal(lower.clamped,true);near(lower.unclamped,-3.32);
});
test('GDP applies exponential growth without a cap or smearing correction', () => {
  const fit=fitOutcome(fixture(),'gdp',2018);
  near(fit.countries[0].slope,0.1);
  const fc=forecast('gdp',100,0.1,0,{...candidate,countryWeight:1},2);
  near(fc.prediction,100*Math.exp(0.144));assert.equal(fc.clamped,false);
  assert.throws(()=>forecast('gdp',100,1000,0,{...candidate,countryWeight:1},7),/Nonfinite/);
});
test('zero-weight zero-target candidate is exact ladder persistence and numerical GDP persistence', () => {
  const zero={target:'zero',countryWeight:0,damping:0.8};
  near(forecast('ladder',6,100,5,zero,7).prediction,6);
  near(forecast('gdp',123.45,-10,2,zero,7).prediction,123.45);
  near(forecast('ladder',6,1,0,candidate,0).prediction,6);
});
test('validation counts, shared persistence mask and GDP loss denominator are explicit', () => {
  const train=fixture();
  const zero={id:'zero-w0-p0.8',target:'zero',countryWeight:0,damping:0.8};
  const result=evaluateCandidate(train,'gdp',zero,protocol.validation.folds);
  assert.equal(result.pooled.count,6);near(result.pooled.mae,result.pooled.persistenceMae);
  const single=evaluateCandidate(train,'gdp',zero,[{id:'single',trainingYears:[2015,2016],originYear:2016,targetYears:[2017]}]);
  near(single.pooled.mae,100*((Math.exp(0.1)-1)+(Math.exp(0.2)-1))/2);
  delete train.gdp.AAA[2017];
  const missing=evaluateCandidate(train,'gdp',zero,protocol.validation.folds);
  assert.equal(missing.pooled.count,4);assert.equal(missing.skipped.length,2);
});
test('selection is deterministic, shrinkage-first for ties, and persistence for empty scores', () => {
  const results=protocol.candidateGrid.candidates.map(c=>({candidate:c,pooled:{mae:1}}));
  assert.equal(selectCandidate([...results].reverse()).candidate.id,'zero-w0-p0.8');
  assert.equal(selectCandidate(results.map(r=>({...r,pooled:{mae:null}}))).candidate.id,'zero-w0-p0.8');
  results.find(r=>r.candidate.id==='pooled-w0.5-p0.9').pooled.mae=0.5;
  assert.equal(selectCandidate(results).candidate.id,'pooled-w0.5-p0.9');
});
test('outcome fits and predictions remain independent of the other outcome', () => {
  const {train,origin,config}=smallInputs();
  const reference=fitAndPredict(train,origin,config);
  const changedGdp=structuredClone(train);
  for(const series of Object.values(changedGdp.gdp)) for(const year of Object.keys(series)) series[year] *= (Number(year)-2014)**2;
  const gdpInputs=smallInputs(changedGdp);
  const gdpResult=fitAndPredict(gdpInputs.train,gdpInputs.origin,gdpInputs.config);
  assert.deepEqual(gdpResult.calibration.outcomes.ladder,reference.calibration.outcomes.ladder);
  assert.deepEqual(gdpResult.predictions.rows.map(r=>r.ladder),reference.predictions.rows.map(r=>r.ladder));
  const changedLadder=structuredClone(train);
  for(const series of Object.values(changedLadder.ladder)) for(const year of Object.keys(series)) series[year]=10-series[year];
  const ladderInputs=smallInputs(changedLadder);
  const ladderResult=fitAndPredict(ladderInputs.train,ladderInputs.origin,ladderInputs.config);
  assert.deepEqual(ladderResult.calibration.outcomes.gdp,reference.calibration.outcomes.gdp);
  assert.deepEqual(ladderResult.predictions.rows.map(r=>r.gdp),reference.predictions.rows.map(r=>r.gdp));
});
test('future years, invalid outcomes and final cohort drift fail closed', () => {
  const future=fixture();future.ladder.AAA[2019]=9;assert.throws(()=>validateTraining(future),/future year/);
  const invalid=fixture();invalid.gdp.AAA[2016]=0;assert.throws(()=>validateTraining(invalid),/Invalid training/);
  const {train,origin,config}=smallInputs();origin.countries.pop();assert.throws(()=>fitAndPredict(train,origin,config),/roster drift/);
});
test('permitted frozen fixtures generate exactly 700 Prediction rows with complete numerical trace', () => {
  const train=read('data/evaluation/level-holdout-2018/train.json');
  const origin=read('data/evaluation/level-holdout-2018/origin.json');
  const result=fitAndPredict(train,origin,protocol);
  assert.equal(result.predictions.rows.length,700);
  assert.equal(new Set(result.predictions.rows.map(r=>`${r.id}:${r.year}`)).size,700);
  assert.equal(result.diagnostics.numericalTrace.length,1400);
  const keys=['id','name','year','horizon','ladder','gdp','originLadder','originGdp'];
  for(const row of result.predictions.rows) {
    assert.deepEqual(Object.keys(row),keys);assert.ok(row.ladder>=0 && row.ladder<=10);assert.ok(Number.isFinite(row.gdp) && row.gdp>0);
    assert.equal(row.horizon,row.year-2018);
    for(const outcome of ['ladder','gdp']) assert.equal(result.diagnostics.numericalTrace.find(t=>t.id===row.id && t.year===row.year && t.outcome===outcome).prediction,row[outcome]);
  }
});

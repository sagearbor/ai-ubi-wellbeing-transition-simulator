import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { TARGETS, series, eligible, fit, predict, metric } from './model.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const dir=path.join(root,'data/evaluation/research-objective-1980-v1');
const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
const save=(name,value)=>fs.writeFileSync(path.join(dir,name),JSON.stringify(value,null,2)+'\n');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const protocol=read('protocol.json');
if (protocol.id!=='research-objective-1980-v1' || protocol.fit.candidates.length!==1 || protocol.fit.candidates[0].phi!==.95) throw Error('Protocol drift');
const metadata=read('raw/countries.json')[1];
const raw=Object.fromEntries(Object.entries(TARGETS).map(([target,t])=>[target,read(`raw/${t.indicator}-1960-1980.json`)[1]]));
const maps=Object.fromEntries(Object.entries(raw).map(([target,r])=>[target,series(r,target)]));
const cohort=[]; const excluded=[];
for (const c of metadata.toSorted((a,b)=>a.id.localeCompare(b.id))) {
  if (c.region.id==='NA') {excluded.push({id:c.id,name:c.name,reason:'World Bank aggregate'});continue;}
  const availability=Object.fromEntries(Object.keys(TARGETS).map(t=>[t,eligible(maps[t].get(c.id))]));
  const reasons=Object.entries(availability).filter(([,v])=>!v.qualified).map(([t,v])=>`${t}: origin=${v.origin!==null}; n=${v.count}; span=${v.span}`);
  if(reasons.length) excluded.push({id:c.id,name:c.name,reasons,availability});
  else cohort.push({id:c.id,name:c.name,availability});
}
if(!cohort.length) throw Error('Empty cohort');
const quartiles=new Map(cohort.toSorted((a,b)=>a.availability.gdp.origin-b.availability.gdp.origin||a.id.localeCompare(b.id)).map((c,i)=>[c.id,Math.floor(i*4/cohort.length)+1]));
for(const c of cohort)c.originIncomeQuartile=quartiles.get(c.id);
save('cohort.json',{schema:'objective-cohort/1',originYear:1980,metadataIds:metadata.length,aggregateCount:excluded.filter(c=>c.reason).length,nonaggregateCount:metadata.filter(c=>c.region.id!=='NA').length,countryCount:cohort.length,countries:cohort,excluded});
const models=[];const rows=[]; let lifeExpectancyClampCount=0;
for(const c of cohort) for(const target of Object.keys(TARGETS)) {
  const model={id:c.id,name:c.name,...fit(maps[target].get(c.id),target)};models.push(model);
  for(let horizon=1;horizon<=45;horizon++) {
    const p=predict(model,horizon);
    if(p.prediction!==p.rawPrediction)lifeExpectancyClampCount++;
    rows.push({id:c.id,name:c.name,target,unit:TARGETS[target].unit,year:1980+horizon,horizon,originYear:1980,originValue:model.originValue,...p});
  }
}
save('predictions.json',{schema:'objective-predictions/1',rows});
const diagnostics=[];const skipped=[];
for(const c of cohort) for(const target of Object.keys(TARGETS)) {
  const train=maps[target].get(c.id).filter(r=>r.year<=1975);
  if(!eligible(train,1975).qualified){skipped.push({id:c.id,target,...eligible(train,1975)});continue;}
  const model=fit(train,target,1975);
  for(const actual of maps[target].get(c.id).filter(r=>r.year>1975)) {
    const p=predict(model,actual.year-1975).prediction;
    const scale=target==='gdp'?100/model.originValue:1;
    diagnostics.push({id:c.id,target,year:actual.year,horizon:actual.year-1975,originValue:model.originValue,prediction:p,actual:actual.value,error:(p-actual.value)*scale,persistenceError:(model.originValue-actual.value)*scale});
  }
}
const summaries=Object.fromEntries(Object.keys(TARGETS).map(target=>{const r=diagnostics.filter(r=>r.target===target);return[target,{unit:target==='gdp'?'cumulative growth percentage points':'years',model:metric(r.map(r=>r.error)),persistence:metric(r.map(r=>r.persistenceError))}]}));
save('internal-validation.json',{schema:'forecast-internal-validation/1',status:'diagnostic only; no selection',cutoff:1975,trainingYears:[1960,1975],validationYears:[1976,1980],summaries,skipped,rows:diagnostics});
save('calibration.json',{schema:'objective-calibration/1',method:'fixed-origin-damped-pretrend',phi:.95,selection:'none',countryCount:cohort.length,modelCount:models.length,predictionCount:rows.length,lifeExpectancyClampCount,models});
const inputPaths=['protocol.json','source-provenance.json',...read('source-provenance.json').sources.map(s=>s.relativePath)];
const code=['fetch.mjs','model.mjs','run.mjs','model.checks.mjs','model.test.ts'];
save('integrity.json',{schema:'forecast-integrity/1',entryId:protocol.id,protocolRegistrationCommit:'41fe91c',allowedNumericYears:[1960,1980],newHealthDataExposedBeforeFreeze:false,inputs:Object.fromEntries(inputPaths.map(p=>[p,sha(path.join(dir,p))])),code:Object.fromEntries(code.map(p=>[p,sha(path.join(root,'scripts/evaluation/attempts/research-objective-1980-v1',p))])),outputs:Object.fromEntries(['cohort.json','calibration.json','internal-validation.json','predictions.json'].map(p=>[p,sha(path.join(dir,p))])),externalScoring:'pending; prohibited until all family entries frozen'});
console.log(JSON.stringify({countryCount:cohort.length,excludedCountries:excluded.filter(c=>!c.reason).length,predictions:rows.length,lifeExpectancyClampCount,internalDiagnosticRows:diagnostics.length}));

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {GRID,PHI,healthPanel,validateTraining,fit,covariates,forecast,metric,choose,validLadder,validGdp} from './model.mjs';
const root=path.resolve(import.meta.dirname,'../../../..');
const dir=path.join(root,'data/evaluation/research-health-2018-v1');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const local=p=>read(`data/evaluation/research-health-2018-v1/${p}`);
const save=(p,v)=>fs.writeFileSync(path.join(dir,p),JSON.stringify(v,null,2)+'\n');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const protocol=local('protocol.json');
if(JSON.stringify(protocol.fit.candidateGrid.lambda)!==JSON.stringify(GRID)||protocol.fit.fixedParameters.covariateDampingPhi!==PHI)throw Error('Protocol drift');
const train=read('data/evaluation/level-holdout-2018/train.json');
const origin=read('data/evaluation/level-holdout-2018/origin.json');
validateTraining(train);
if(origin.originYear!==2018||origin.countries.length!==100||origin.excluded.length!==28)throw Error('Origin cohort drift');
const health=healthPanel(local('raw/SP.DYN.LE00.IN-2015-2018.json')[1]);
const folds=protocol.internalValidation.folds.map(f=>{
  const countries=[],excluded=[];
  for(const c of train.countries){const ladder=train.ladder[c.id]?.[f.originYear],gdp=train.gdp[c.id]?.[f.originYear];if(validLadder(ladder)&&validGdp(gdp))countries.push({...c,ladder,gdp});else excluded.push({id:c.id,reason:'Missing valid original ladder/GDP at internal origin'});}
  return {...f,countries,excluded};
});
const candidates=[];
for(const lambda of GRID){
  const foldResults=[];const all=[];
  for(const f of folds){
    const model=fit(train,health,f.originYear,lambda);const rows=[];const missing=[];const covariateFits=[];
    for(const c of f.countries){
      const cov=covariates(c,train,health,f.originYear);covariateFits.push(cov);
      for(const year of f.validationYears){
        const p=forecast(c,model,cov,year-f.originYear).row;
        const actualLadder=train.ladder[c.id]?.[year],actualGdp=train.gdp[c.id]?.[year];
        const scored={...p,actualLadder:validLadder(actualLadder)?actualLadder:null,actualGdp:validGdp(actualGdp)?actualGdp:null};
        if(validLadder(actualLadder)){scored.ladderError=p.ladder-actualLadder;scored.persistenceLadderError=c.ladder-actualLadder;}else missing.push({id:c.id,year,target:'ladder'});
        if(validGdp(actualGdp)){scored.gdpError=100*(p.gdp-actualGdp)/c.gdp;scored.persistenceGdpError=100*(c.gdp-actualGdp)/c.gdp;}else missing.push({id:c.id,year,target:'gdp'});
        rows.push(scored);all.push(scored);
      }
    }
    foldResults.push({originYear:f.originYear,fitYears:f.fitYears,validationYears:f.validationYears,model,originCount:f.countries.length,excludedOrigins:f.excluded,missingTargets:missing,covariateFits,rows});
  }
  const get=key=>all.filter(r=>Number.isFinite(r[key])).map(r=>r[key]);
  candidates.push({lambda,ladder:metric(get('ladderError')),persistenceLadder:metric(get('persistenceLadderError')),gdp:metric(get('gdpError')),persistenceGdp:metric(get('persistenceGdpError')),folds:foldResults});
}
const selected=choose(candidates.map(c=>({lambda:c.lambda,mae:c.ladder.mae})));
save('internal-validation.json',{schema:'forecast-internal-validation/1',selection:protocol.fit.selection,selected,candidates,limitations:protocol.internalValidation.limits});
const model=fit(train,health,2018,selected.lambda);const rows=[],diagnostics=[],countryFits=[];
for(const c of origin.countries){
  const cov=covariates(c,train,health,2018);countryFits.push(cov);
  for(let horizon=1;horizon<=7;horizon++){const p=forecast(c,model,cov,horizon);rows.push(p.row);diagnostics.push(p.diagnostic);}
}
const sort=(a,b)=>a.year-b.year||origin.countries.findIndex(c=>c.id===a.id)-origin.countries.findIndex(c=>c.id===b.id);
rows.sort(sort);diagnostics.sort(sort);
if(rows.length!==700||new Set(rows.map(r=>`${r.id}:${r.year}`)).size!==700)throw Error('Forecast shape drift');
const incomeQuartiles=new Map(origin.countries.toSorted((a,b)=>a.gdp-b.gdp||a.id.localeCompare(b.id)).map((c,i)=>[c.id,Math.floor(i*4/100)+1]));
save('cohort.json',{schema:'forecast-cohort/1',originYear:2018,countryCount:100,excludedCount:28,countries:origin.countries.map(c=>({id:c.id,name:c.name,originLadder:c.ladder,originGdp:c.gdp,originIncomeQuartile:incomeQuartiles.get(c.id)})),excluded:origin.excluded});
save('predictions.json',{rows});
save('calibration.json',{schema:'forecast-calibration/1',model,covariateDampingPhi:PHI,selectedByInternalValidation:selected,trainingBackgroundCountries:train.countries.length,pairedTrainingRows:train.countries.reduce((n,c)=>n+train.years.filter(y=>validLadder(train.ladder[c.id]?.[y])&&validGdp(train.gdp[c.id]?.[y])).length,0),countryFits,healthFallbackCountryCount:countryFits.filter(c=>c.healthFallbackReason).length,ladderClampCount:diagnostics.filter(r=>r.ladderClamped).length,healthClampCount:diagnostics.filter(r=>r.healthClamped).length});
save('forecast-covariates.json',{schema:'forecast-covariates/1',source:'Only registered forecasts from pre2019 history; never actual future features',rows:diagnostics});
const paths=['data/evaluation/level-holdout-2018/train.json','data/evaluation/level-holdout-2018/origin.json',...['protocol.json','source-provenance.json',...local('source-provenance.json').sources.map(s=>s.relativePath)].map(s=>`data/evaluation/research-health-2018-v1/${s}`)];
const code=['fetch.mjs','model.mjs','run.mjs','model.checks.mjs','model.test.ts'].map(s=>`scripts/evaluation/attempts/research-health-2018-v1/${s}`);
save('integrity.json',{schema:'forecast-integrity/1',entryId:protocol.id,protocolRegistrationCommit:'6c6cdb2',exposureAmendmentCommit:'1b8512e',allowedNumericYears:[2015,2018],inputs:Object.fromEntries(paths.map(p=>[p,hash(p)])),code:Object.fromEntries(code.map(p=>[p,hash(p)])),outputs:Object.fromEntries(['cohort.json','calibration.json','internal-validation.json','predictions.json','forecast-covariates.json'].map(p=>[p,hash(`data/evaluation/research-health-2018-v1/${p}`)])),futureDataAccess:'none through file/API; unsolicited postperiod WHR literature excerpts disclosed in protocol',externalScoring:'pending; prohibited until all family entries frozen'});
console.log(JSON.stringify({selected,trainingPairs:model.trainingPairCount,missingHealthPairs:model.missingHealthPairCount,healthFallbackCountries:countryFits.filter(c=>c.healthFallbackReason).length,rows:rows.length,ladderClamps:diagnostics.filter(r=>r.ladderClamped).length,healthClamps:diagnostics.filter(r=>r.healthClamped).length}));

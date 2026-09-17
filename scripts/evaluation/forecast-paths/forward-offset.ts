/** Forward research projection from the original pure model; never refits or scores. */
import { readFileSync, writeFileSync } from 'node:fs';
import { forecast } from '../attempts/research-offset-2018-v1/model';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const base='data/evaluation/level-holdout-2018/';
const origin=read(base+'origin.json'),truth=read(base+'test-outcomes.json');
const calibration=read('data/evaluation/research-offset-2018-v1/calibration.json');
const original=read('data/evaluation/research-offset-2018-v1/predictions.json').rows;
const historical=forecast(origin,calibration.fit,calibration.selectedSetting,7).rows;
const index=new Map(original.map((r:any)=>[`${r.id}/${r.year}`,r]));
let maxLadder=0,maxGdp=0;
for(const r of historical){const old:any=index.get(`${r.id}/${r.year}`);if(!old)throw Error('Missing original');maxLadder=Math.max(maxLadder,Math.abs(r.ladder-old.ladder));maxGdp=Math.max(maxGdp,Math.abs(r.gdp-old.gdp));}
if(maxLadder>1e-10||maxGdp>1e-7)throw Error('Historical reconstruction mismatch');
const forwardOrigin={originYear:2025,countries:origin.countries.filter((c:any)=>Number.isFinite(truth.ladder[c.id]?.['2025'])&&Number.isFinite(truth.gdp[c.id]?.['2025'])).map((c:any)=>({...c,ladder:truth.ladder[c.id]['2025'],gdp:truth.gdp[c.id]['2025']}))};
const result=forecast(forwardOrigin,calibration.fit,calibration.selectedSetting,7);
writeFileSync('data/evaluation/diagnostic-health-income-2018-v1/forward-offset.json',JSON.stringify({status:'2025-origin illustrative projection, unchanged2018 fit; unscored',reconstruction:{maxLadder,maxGdp},origin:forwardOrigin,...result},null,2)+'\n');
console.log(JSON.stringify({countries:forwardOrigin.countries.length,reconstruction:{maxLadder,maxGdp},diagnostics:result.diagnostics}));

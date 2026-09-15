import {pathToFileURL} from 'node:url';
const baseline=process.argv[2] ?? '/private/tmp/alignment-review-436a16e';
const current=process.argv[3] ?? '/private/tmp/alignment-stage35';
const [bc,br,nc,nr]=await Promise.all([import(pathToFileURL(baseline+'/constants.ts')),import(pathToFileURL(baseline+'/simulation/run.ts')),import(pathToFileURL(current+'/constants.ts')),import(pathToFileURL(current+'/simulation/run.ts'))]);
let checked=0;const differences=[];const extras=new Set();const stats={};
function compare(a,b,path){if(a===null||typeof a!=='object'){checked++;const id=path.split('/')[0];const q=stats[id]??={different:0,structural:0,maxAbs:0,maxRelative:0,maxScaledDifference:0,maxAbsPath:''};if(!Object.is(a,b)){q.different++;if(typeof a==='number'&&typeof b==='number'&&Number.isFinite(a)&&Number.isFinite(b)){const d=Math.abs(a-b);if(d>q.maxAbs){q.maxAbs=d;q.maxAbsPath=path;}q.maxRelative=Math.max(q.maxRelative,d/Math.max(Math.abs(a),Math.abs(b)));q.maxScaledDifference=Math.max(q.maxScaledDifference,d/Math.max(Math.abs(a),Math.abs(b),1));}else q.structural++;if(differences.length<8)differences.push({path,before:a,after:b});}return;}for(const key of Object.keys(a)){compare(a[key],b?.[key],path+'/'+key);}if(b&&typeof b==='object')for(const key of Object.keys(b))if(!(key in a))extras.add(key);}
const scenarios=[];
for(const id of ['organic-incentive','evidence-anchored','us-reference-korinek']){
const bm=bc.PRESET_MODELS.find(m=>m.id===id),nm=nc.PRESET_MODELS.find(m=>m.id===id);let b=br.initialRun(undefined,undefined,br.initOptionsFor(bm)),n=nr.initialRun(undefined,undefined,nr.initOptionsFor(nm));const end=id==='us-reference-korinek'?60:120;
for(let month=0;month<=end;month++){compare(b,n,id+'/'+month);if(month<end){b=br.advanceRun(b,{model:bm});n=nr.advanceRun(n,{model:nm});}}
scenarios.push({id,states:end+1});
}
console.log(JSON.stringify({baseline,current,scenarios,checkedExistingLeaves:checked,stats,differences,newMetadataKeys:[...extras]},null,2));
if(Object.values(stats).some(s=>s.structural))process.exitCode=1;

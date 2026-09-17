"""Training-only diagnostic preparation. Does not open test outcomes."""
import hashlib,json
from pathlib import Path
from model import fit,forecast
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'data/evaluation/diagnostic-health-income-2018-v1'
def read(p):return json.loads((ROOT/p).read_text())
def write(name,data):(OUT/name).write_text(json.dumps(data,indent=2,allow_nan=False)+'\n')
protocol=read(str(OUT.relative_to(ROOT)/'protocol.json'))
train=read('data/evaluation/level-holdout-2018/train.json');origin=read('data/evaluation/level-holdout-2018/origin.json')
raw=read('data/evaluation/research-health-2018-v1/raw/SP.DYN.LE00.IN-2015-2018.json')[1]
health={}
for r in raw:
    if not 2015<=int(r['date'])<=2018:raise ValueError('Future health value')
    if r['countryiso3code'] and isinstance(r['value'],(int,float)) and 0<r['value']<120:health.setdefault(r['countryiso3code'],{})[r['date']]=r['value']
models={};predictions={};validation={}
for v in protocol['variants']:
    models[v['id']]=fit(train,health,2018,v)
    predictions[v['id']]=[forecast(c,models[v['id']],h) for c in origin['countries'] for h in range(1,8)]
    records=[]
    for cutoff,years in [(2016,[2017,2018]),(2017,[2018])]:
        m=fit(train,health,cutoff,v)
        for c in train['countries']:
            gp=train['gdp'].get(c['id'],{});lp=train['ladder'].get(c['id'],{})
            if str(cutoff) not in gp or str(cutoff) not in lp:continue
            o={**c,'gdp':gp[str(cutoff)],'ladder':lp[str(cutoff)]}
            for year in years:
                if str(year) not in lp:continue
                p=forecast(o,m,year-cutoff,cutoff)
                records.append({'id':c['id'],'origin':cutoff,'year':year,'error':p['ladder']-lp[str(year)],'persistenceError':o['ladder']-lp[str(year)]})
    validation[v['id']]={'n':len(records),'mae':sum(abs(r['error']) for r in records)/len(records),'persistenceMae':sum(abs(r['persistenceError']) for r in records)/len(records),'rows':records}
ids=list(predictions)
base=predictions[ids[0]]
predictions['diagnostic_mean']=[{**row,**{t:sum(predictions[i][k][t] for i in ids)/4 for t in ['ladder','gdp']}} for k,row in enumerate(base)]
control=read('data/evaluation/research-health-2018-v1/predictions.json')['rows'];indexed={(r['id'],r['year']):r for r in control}
diffs={t:max(abs(r[t]-indexed[r['id'],r['year']][t]) for r in predictions['health_control']) for t in ['ladder','gdp']}
assert diffs['ladder']<1e-10 and diffs['gdp']<1e-7,diffs
write('calibration.json',models);write('predictions.json',predictions);write('internal-validation.json',validation)
inputs=[p for p in protocol['sourceHashes'] if not p.endswith('test-outcomes.json')]
scripts=['scripts/evaluation/forecast-paths/'+n for n in ['model.py','freeze.py']]
manifest={'status':'Predictions frozen before this diagnostic score; model forms designed after previous same-period outcomes were known.','sourceHashes':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in inputs+scripts},'predictionSha256':hashlib.sha256((OUT/'predictions.json').read_bytes()).hexdigest(),'protocolSha256':hashlib.sha256((OUT/'protocol.json').read_bytes()).hexdigest(),'controlMaxDifference':diffs,'clamps':{i:{key:sum(r[key] for r in rows) for key in ['ladderClamped','healthClamped']} for i,rows in predictions.items()}}
write('freeze-manifest.json',manifest)
print(json.dumps({'controlMaxDifference':diffs,'innerValidation':{k:{m:v[m] for m in ['n','mae','persistenceMae']} for k,v in validation.items()}},indent=2))

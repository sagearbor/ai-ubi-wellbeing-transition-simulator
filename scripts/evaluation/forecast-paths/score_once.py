"""One append-only diagnostic score. Old scorer artifacts remain untouched."""
import hashlib,importlib.util,json,subprocess
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'data/evaluation/diagnostic-health-income-2018-v1'
sp=importlib.util.spec_from_file_location('comparison',ROOT/'scripts/evaluation/comparison-review/analyze.py');a=importlib.util.module_from_spec(sp);sp.loader.exec_module(a)
def read(p):return json.loads(p.read_text())
protocol=read(OUT/'protocol.json');manifest=read(OUT/'freeze-manifest.json')
for p,h in protocol['sourceHashes'].items():assert hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==h
assert hashlib.sha256((OUT/'predictions.json').read_bytes()).hexdigest()==manifest['predictionSha256']
for p,h in manifest['sourceHashes'].items():assert hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==h
assert hashlib.sha256((OUT/'protocol.json').read_bytes()).hexdigest()==manifest['protocolSha256']
# Every new study input/implementation must be in HEAD and clean before outcomes are opened.
for path in [OUT,Path(__file__).parent]:
    status=subprocess.check_output(['git','status','--porcelain','--',str(path.relative_to(ROOT))],cwd=ROOT,text=True)
    assert not status,'Uncommitted study changes: '+status
receipt={'createdAt':datetime.now(timezone.utc).isoformat(),'preScoreCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'predictionSha256':manifest['predictionSha256'],'protocolSha256':manifest['protocolSha256'],'status':'started; errors do not authorize rerunning this scorer'}
assert not (OUT/'scores.json').exists(),'Results already exist'
with (OUT/'score-receipt.json').open('x') as f:json.dump(receipt,f,indent=2)
actual=read(ROOT/'data/evaluation/level-holdout-2018/test-outcomes.json')
origin=read(ROOT/'data/evaluation/level-holdout-2018/origin.json')
quartiles={c['id']:i//25+1 for i,c in enumerate(sorted(origin['countries'],key=lambda c:(c['gdp'],c['id'])))}
forecasts=read(OUT/'predictions.json');scores={}
for name,rows in forecasts.items():
    scores[name]={}
    for t in ['ladder','gdp']:
        observed=[r for r in rows if str(r['year']) in actual[t].get(r['id'],{})]
        errs=[];bases=[]
        for r in observed:
            value=actual[t][r['id']][str(r['year'])];scale=100/r['originGdp'] if t=='gdp' else 1
            errs.append((r[t]-value)*scale);bases.append((r['originGdp' if t=='gdp' else 'originLadder']-value)*scale)
        groups={'pooled':list(range(len(observed))),'endpoint':[i for i,r in enumerate(observed) if r['year']==2025]}
        groups.update({str(y):[i for i,r in enumerate(observed) if r['year']==y] for y in range(2019,2026)})
        for s in ['pooled','endpoint']:
            groups.update({s+'_Q'+str(q):[i for i in groups[s] if quartiles[observed[i]['id']]==q] for q in range(1,5)})
        scores[name][t]={s:a.metric(errs,bases,indices) for s,indices in groups.items()}
        scores[name][t]['countries']={c['id']:{s:a.metric(errs,bases,[i for i in groups[s] if observed[i]['id']==c['id']]) for s in ['pooled','endpoint']} for c in origin['countries']}
        assert scores[name][t]['pooled']['n']==(681 if t=='ladder' else 691)
with (OUT/'scores.json').open('x') as f:json.dump({'status':protocol['status'],'receipt':receipt,'scores':scores},f,indent=2,allow_nan=False);f.write('\n')
print(json.dumps({k:{t:{s:v[t][s]['mae'] for s in ['endpoint','pooled']} for t in ['ladder','gdp']} for k,v in scores.items()},indent=2))

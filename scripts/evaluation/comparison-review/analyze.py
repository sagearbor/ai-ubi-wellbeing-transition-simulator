#!/usr/bin/env python3
"""Post-hoc comparison of immutable saved forecasts; standard library only.
Never calls an original scorer, trains a new forecast, or writes source artifacts.
"""
import csv
import hashlib
import itertools
import json
import math
from pathlib import Path
import random

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'data/evaluation/comparison-20260916'
BASE = 'data/evaluation/level-holdout-2018/'

def read(path):
    return json.loads((ROOT / path).read_text())

def index_rows(rows, expected):
    indexed = {}
    for row in rows:
        key = (row['id'], row['year'])
        if key in indexed:
            raise ValueError('Duplicate prediction: ' + str(key))
        if any(not math.isfinite(row[t]) for t in ('ladder', 'gdp')):
            raise ValueError('Nonfinite forecast')
        indexed[key] = row
    if set(indexed) != set(expected):
        raise ValueError('Forecast keys differ from declared cohort')
    return indexed

def recipes(n):
    for count in range(1, n + 1):
        for members in itertools.combinations(range(n), count):
            yield {'kind': 'single' if count == 1 else 'equal', 'weights': {i: 1/count for i in members}}
    for i, j in itertools.combinations(range(n), 2):
        for w in (.25, .75):
            yield {'kind': 'weighted-pair', 'weights': {i: w, j: 1-w}}

def blend(vectors, weights):
    return [sum(w * vectors[i][k] for i, w in weights.items()) for k in range(len(vectors[0]))]

def metric(errors, baseline, indices):
    n = len(indices)
    if not n:
        return {'n': 0, 'mae': None, 'rmse': None, 'bias': None, 'baseline': None, 'skill': None}
    mae = sum(abs(errors[k]) for k in indices)/n
    base = sum(abs(baseline[k]) for k in indices)/n
    return dict(n=n, mae=mae, rmse=math.sqrt(sum(errors[k]**2 for k in indices)/n),
                bias=sum(errors[k] for k in indices)/n, baseline=base, skill=1-mae/base if base else None)

def percentile(values, q):
    a = sorted(values)
    x = (len(a)-1)*q
    lo = math.floor(x)
    return a[lo] + (a[min(lo+1, len(a)-1)]-a[lo])*(x-lo)

def correlation(a,b):
    x, y = sum(a)/len(a), sum(b)/len(b)
    den = math.sqrt(sum((v-x)**2 for v in a)*sum((v-y)**2 for v in b))
    return sum((v-x)*(w-y) for v,w in zip(a,b))/den if den else None

def audit_claude(origin, vectors, ids, keys):
    train = read(BASE+'train.json')
    coef = read(BASE+'frozen-fit.json')['coefficients']
    def raw_anchor(gdp, gov):
        return coef['intercept'] + coef['lnGdp']*math.log(max(100,gdp)) + coef['governance']*gov
    def anchor(gdp, gov):
        return max(15,min(90,raw_anchor(gdp,gov)))
    gaps = {}
    for c in train['countries']:
        for year in train['years']:
            l = train['ladder'].get(c['id'],{}).get(str(year))
            g = train['gdp'].get(c['id'],{}).get(str(year))
            if l is not None and g is not None:
                gaps[c['id'],year] = l*10-anchor(g,c['governance'])
    by_lag=[]
    for lag in range(1,4):
        pairs = [(v, gaps[(id,y+lag)]) for (id,y),v in gaps.items() if (id,y+lag) in gaps]
        r = (sum(a*b for a,b in pairs)/sum(a*a for a,b in pairs))**(1/lag)
        by_lag.append(dict(lag=lag,rho=r,pairs=len(pairs)))
    rho=math.exp(sum(math.log(x['rho'])*x['pairs'] for x in by_lag)/sum(x['pairs'] for x in by_lag))
    origins={c['id']:c for c in origin['countries']}
    discrepancies={}
    bounds={}
    for name,decay in [('c_decay',rho),('c_retained',1)]:
        predicted={'ladder':[],'gdp':[]}
        caps={'anchorClipped':0,'ladderClipped':0}
        for id,year in keys:
            c=origins[id]; h=year-2018; g=c['gdp']*1.02**h
            raw=(anchor(g,c['governance'])+(c['ladder']*10-anchor(c['gdp'],c['governance']))*decay**h)/10
            caps['anchorClipped']+=int(not 15<=raw_anchor(g,c['governance'])<=90)
            caps['ladderClipped']+=int(not .1<=raw<=10)
            predicted['gdp'].append(g); predicted['ladder'].append(max(.1,min(10,raw)))
        discrepancies[name]={t:max(abs(a-b) for a,b in zip(predicted[t],vectors[t][ids.index(name)])) for t in predicted}
        bounds[name]=caps
    return dict(rho=rho,byLag=by_lag,maxPredictionDifference=discrepancies,bounds=bounds,
                maxLegacyGdpDifference=max(abs(a-b) for a,b in zip(vectors['gdp'][ids.index('legacy')],vectors['gdp'][ids.index('c_decay')])),
                exactlyOneExecution='not verified: registration precedes result, but runner overwrites output and has no exclusive score receipt',
                internalValidation='not verified: described in note, no committed reproducible inner-validation output located')

def main():
    plan=read('data/evaluation/comparison-20260916/analysis-plan.json')
    for path,digest in plan['sourceHashes'].items():
        assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==digest, 'Frozen source changed: '+path
    models=plan['models']; ids=[m['id'] for m in models]
    origin=read(BASE+'origin.json'); actual=read(BASE+'test-outcomes.json')
    countries=origin['countries']; country_ids=[c['id'] for c in countries]
    keys=[(c['id'],y) for c in countries for y in range(2019,2026)]
    origins={c['id']:c for c in countries}
    vectors={t:[] for t in ('ladder','gdp')}
    for model in models:
        if model['id']=='persistence':
            indexed={k:{t:origins[k[0]][t] for t in vectors} for k in keys}
        else:
            d=read(model['predictionsPath']); indexed=index_rows(d.get('rows',d.get('predictions')),keys)
            for (id,year),row in indexed.items():
                for field,target in [('originLadder','ladder'),('originGdp','gdp')]:
                    assert abs(row[field]-origins[id][target])<1e-7, 'Origin mismatch'
        for t in vectors: vectors[t].append([indexed[k][t] for k in keys])
    quartile={c['id']:i//25+1 for i,c in enumerate(sorted(countries,key=lambda c:(c['gdp'],c['id'])))}
    groups={}; outcomes={}; bases={}
    for t in vectors:
        outcomes[t]=[actual[t].get(id,{}).get(str(y)) for id,y in keys]
        mask=[k for k,v in enumerate(outcomes[t]) if v is not None]
        groups[t]={'pooled':mask,'endpoint':[k for k in mask if keys[k][1]==2025]}
        groups[t].update({str(y):[k for k in mask if keys[k][1]==y] for y in range(2019,2026)})
        for scope in ('pooled','endpoint'):
            groups[t].update({scope+'_Q'+str(q):[k for k in groups[t][scope] if quartile[keys[k][0]]==q] for q in range(1,5)})
        bases[t]=[(vectors[t][-1][k]-v)*(100/origins[keys[k][0]]['gdp'] if t=='gdp' else 1) if v is not None else None for k,v in enumerate(outcomes[t])]
    records=[]; errors={}; source_audit=[]
    for recipe in recipes(len(models)):
        rid='r'+str(len(records)).zfill(3); recipe['id']=rid
        recipe['weights']={str(i):w for i,w in recipe['weights'].items()}
        recipe['members']=[ids[int(i)] for i in recipe['weights']]
        recipe['name']=' + '.join(f'{w:.0%} {models[int(i)]["name"]}' for i,w in recipe['weights'].items())
        recipe['metrics']={}
        errors[rid]={}
        for t in vectors:
            vals=blend(vectors[t],{int(i):w for i,w in recipe['weights'].items()})
            e=[(p-v)*(100/origins[keys[k][0]]['gdp'] if t=='gdp' else 1) if v is not None else None for k,(p,v) in enumerate(zip(vals,outcomes[t]))]
            errors[rid][t]=e
            recipe['metrics'][t]={g:metric(e,bases[t],indices) for g,indices in groups[t].items()}
        records.append(recipe)
    assert len(records)==583
    for i,model in enumerate(models[:-1]):
        saved=read(model['scoresPath'])['outcomes']; differences=[]
        for t in vectors:
            for scope,stored in [('pooled',saved[t]['overall'])]+[(str(x['year']),x) for x in saved[t]['byYear']]:
                calc=records[i]['metrics'][t][scope]
                assert calc['n']==stored['observed']
                for m in ('mae','rmse','bias'):
                    differences.append(abs(calc[m]-stored['model'][m]))
                differences.append(abs(calc['baseline']-stored['persistence']['mae']))
        assert max(differences)<1e-10,(model['id'],max(differences))
        source_audit.append(dict(id=model['id'],maxMetricDifference=max(differences),status='matched'))
    winners={}; pareto={}
    for scope in ('pooled','endpoint'):
        winners[scope]={}
        for t in vectors:
            winners[scope][t]={label:min((r for r in records if condition(r)),key=lambda r:r['metrics'][t][scope]['mae'])['id'] for label,condition in [('individual',lambda r:r['kind']=='single'),('equalBlend',lambda r:r['kind']=='equal'),('catalog',lambda r:True)]}
        pareto[scope]=[r['id'] for r in records if not any(all(s['metrics'][t][scope]['mae']<=r['metrics'][t][scope]['mae'] for t in vectors) and any(s['metrics'][t][scope]['mae']<r['metrics'][t][scope]['mae'] for t in vectors) for s in records)]
    pair_index={}
    for r in records:
        if r['kind']=='single': pair_index[r['members'][0]+'|'+r['members'][0]]=r['id']
        if r['kind']=='equal' and len(r['members'])==2:
            a,b=r['members']; pair_index[a+'|'+b]=r['id'];pair_index[b+'|'+a]=r['id']
        for t in vectors:
            for scope in ('pooled','endpoint'):
                best=min(records[int(i)]['metrics'][t][scope]['mae'] for i in r['weights'])
                r['metrics'][t][scope]['gainVsBestMember']=best-r['metrics'][t][scope]['mae']
    # All declared resamples use the same country indices, preserving paired forecasts and all years.
    rng=random.Random(20260916)
    draws=[[rng.randrange(len(countries)) for _ in countries] for _ in range(2000)]
    comparisons=[('r001','r000'),(pair_index['c_decay|g_offset'],'r000'),('r002','r000'),('r003','r001')]
    bootstrap=[]
    for left,right in comparisons:
        for t in vectors:
            for scope in ('pooled','endpoint'):
                sums=[];counts=[]
                for id in country_ids:
                    ix=[k for k in groups[t][scope] if keys[k][0]==id]
                    sums.append(sum(abs(errors[left][t][k])-abs(errors[right][t][k]) for k in ix));counts.append(len(ix))
                vals=[sum(sums[i] for i in draw)/sum(counts[i] for i in draw) for draw in draws]
                bootstrap.append(dict(left=left,right=right,target=t,scope=scope,delta=records[int(left[1:])]['metrics'][t][scope]['mae']-records[int(right[1:])]['metrics'][t][scope]['mae'],low=percentile(vals,.025),high=percentile(vals,.975)))
    correlations={t:{scope:[[correlation([errors['r'+str(i).zfill(3)][t][k] for k in groups[t][scope]],[errors['r'+str(j).zfill(3)][t][k] for k in groups[t][scope]]) for j in range(9)] for i in range(9)] for scope in ('pooled','endpoint')} for t in vectors}
    detailed=set('r'+str(i).zfill(3) for i in range(9))|{pair_index['c_decay|g_offset']}
    for w in winners.values():
        for v in w.values():detailed.update(v.values())
    contributions={}
    for rid in sorted(detailed):
        contributions[rid]={}
        for t in vectors:
            contributions[rid][t]={}
            for scope in ('pooled','endpoint'):
                rows=[];total=len(groups[t][scope])
                for c in countries:
                    ix=[k for k in groups[t][scope] if keys[k][0]==c['id']]
                    m=metric(errors[rid][t],bases[t],ix)
                    rows.append(dict(id=c['id'],name=c['name'],quartile=quartile[c['id']],**m,contribution=sum(abs(bases[t][k])-abs(errors[rid][t][k]) for k in ix)/total))
                contributions[rid][t][scope]=sorted(rows,key=lambda x:x['contribution'],reverse=True)
    audit=dict(individualScores=source_audit,claude=audit_claude(origin,vectors,ids,keys),
               sourceHashes=plan['sourceHashes'],sourceIntegrity='All declared source hashes unchanged',
               cohort=dict(countries=len(countries),expected=len(keys),excludedOriginCountries=len(origin['excluded']),observations={t:{s:len(groups[t][s]) for s in ('pooled','endpoint')} for t in vectors}),
               computedFrom='Saved point predictions and frozen test outcomes; original scoring entry points were not run')
    # Verify archived objective metrics from their saved scored rows, without running that scorer.
    long_path='data/evaluation/research-objective-1980-v1/scores.json'
    long_saved=read(long_path); long_summary={}
    for t, target in long_saved['analysis'].items():
        long_summary[t]={}
        for scope, saved in [('pooled',target['pooled']),('2025',target['primaryEndpoint']),('2024',next(x for x in target['byHorizon'] if x['year']==2024))]:
            rows=[r for r in long_saved['rows'] if r['target']==t and r['error'] is not None and (scope=='pooled' or r['year']==int(scope))]
            m=metric([r['error'] for r in rows],[r['persistenceError'] for r in rows],list(range(len(rows))))
            assert m['n']==saved['observed']
            if m['n']: assert abs(m['mae']-saved['model']['mae'])<1e-9 and abs(m['baseline']-saved['persistence']['mae'])<1e-9
            long_summary[t][scope]=m
    audit['objectiveSavedRows']='Archived primary, pooled and 2024 metrics matched saved scored rows; source observations not independently re-fetched'
    audit['objectiveSourceHash']=hashlib.sha256((ROOT/long_path).read_bytes()).hexdigest()
    result=dict(schema='exploratory-comparison/1',planCommit='a2b1a01',baseCommit=plan['baseCommit'],status=plan['status'],models=models,recipes=records,winners=winners,pairIndex=pair_index,pareto=pareto,bootstrap=bootstrap,correlations=correlations,contributions=contributions,audit=audit,objective=long_summary)
    (OUT/'results.json').write_text(json.dumps(result,separators=(',',':'),allow_nan=False)+'\n')
    (OUT/'audit.json').write_text(json.dumps(audit,indent=2,allow_nan=False)+'\n')
    with (OUT/'recipes.csv').open('w',newline='') as f:
        writer=csv.writer(f,lineterminator="\n");writer.writerow(['id','recipe','kind','target','scope','n','mae','persistence_mae','skill','gain_over_best_member'])
        for r in records:
            for t in vectors:
                for s in ('endpoint','pooled'):
                    m=r['metrics'][t][s];writer.writerow([r['id'],r['name'],r['kind'],t,s,m['n'],m['mae'],m['baseline'],m['skill'],m['gainVsBestMember']])
    print(json.dumps({'audit':{k:v for k,v in audit.items() if k!='sourceHashes'},'winners':{s:{t:{k:records[int(v[1:])]['name'] for k,v in d.items()} for t,d in a.items()} for s,a in winners.items()}},indent=2))

if __name__=='__main__':main()

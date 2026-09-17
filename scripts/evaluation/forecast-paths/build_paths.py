"""Build historical and forward path data. No new evaluation scoring invocation."""
import hashlib,json,math
from pathlib import Path
from model import forecast
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'data/evaluation/diagnostic-health-income-2018-v1'
def read(p):return json.loads((ROOT/p).read_text())
def local(name):return json.loads((OUT/name).read_text())
base='data/evaluation/level-holdout-2018/'
train=read(base+'train.json');origin=read(base+'origin.json');test=read(base+'test-outcomes.json')
comparison=read('data/evaluation/comparison-20260916/results.json')
models=comparison['models'];historical={};future={};forward=local('forward-offset.json')
for m in models:
 if m['id']=='persistence':rows=[{**c,'year':y} for c in origin['countries'] for y in range(2019,2026)]
 else:
  d=read(m['predictionsPath']);rows=d.get('rows',d.get('predictions'))
 historical[m['id']]=rows
new=local('predictions.json');cal=local('calibration.json');newscores=local('scores.json')['scores']
for id in ['income_only','saturated_health','saturated_income']:
 models.append({'id':id,'name':{'income_only':'Income only (new)','saturated_health':'Saturating income + health (new)','saturated_income':'Saturating income only (new)'}[id],'pr':None})
 historical[id]=new[id]
future['g_offset']=forward['rows']
k=read(base+'frozen-fit.json')['coefficients'];rho=comparison['audit']['claude']['rho']
def anchor(g,gov):return max(15,min(90,k['intercept']+k['lnGdp']*math.log(max(100,g))+k['governance']*gov))
def decay_rows(countries,originyear,decay):
 return [{'id':c['id'],'year':originyear+h,'gdp':c['gdp']*1.02**h,'ladder':max(.1,min(10,(anchor(c['gdp']*1.02**h,c['governance'])+(c['ladder']*10-anchor(c['gdp'],c['governance']))*decay**h)/10))} for c in countries for h in range(1,8)]
for id,decay in [('c_decay',rho),('c_retained',1)]:
 control={(r['id'],r['year']):r for r in historical[id]}
 for r in decay_rows(origin['countries'],2018,decay):
  for t in ['ladder','gdp']:assert abs(r[t]-control[r['id'],r['year']][t])<1e-7
 future[id]=decay_rows(forward['origin']['countries'],2025,decay)
for id,mid in [('g_health','health_control'),('income_only','income_only'),('saturated_health','saturated_health'),('saturated_income','saturated_income')]:future[id]=[forecast(c,cal[mid],h,2025) for c in forward['origin']['countries'] for h in range(1,8)]
future['persistence']=[{**c,'year':y} for c in forward['origin']['countries'] for y in range(2026,2033)]
ensembles=[{'id':'endpoint_blend','name':'75% offsets + 25% decay','weights':{'g_offset':.75,'c_decay':.25},'status':'Selected on known 2025 wellbeing outcomes. Not proven best for future years or GDP.'},{'id':'simple_blend','name':'50% offsets + 50% decay','weights':{'g_offset':.5,'c_decay':.5},'status':'Simple average, proposed after original outcomes were seen.'},{'id':'diagnostic_mean','name':'New four-model average','weights':{'g_health':.25,'income_only':.25,'saturated_health':.25,'saturated_income':.25},'status':'Equal weights frozen before new diagnostic score; model forms still designed after historical outcomes were known.'}]
def add_blends(collection):
 for e in ensembles:
  indexed={id:{(r['id'],r['year']):r for r in collection[id]} for id in e['weights']}
  keys=list(indexed[next(iter(indexed))]);assert all(set(d)==set(keys) for d in indexed.values())
  collection[e['id']]=[{'id':id,'year':y,**{t:sum(w*indexed[mid][id,y][t] for mid,w in e['weights'].items()) for t in ['ladder','gdp']}} for id,y in keys]
add_blends(historical);add_blends(future)
# Assert the newly frozen average is unchanged by plotting.
for r in historical['diagnostic_mean']:
 reference=next(x for x in new['diagnostic_mean'] if x['id']==r['id'] and x['year']==r['year'])
 assert max(abs(r[t]-reference[t]) for t in ['ladder','gdp'])<1e-7
histidx={id:{(r['id'],r['year']):r for r in rows} for id,rows in historical.items()}
futidx={id:{(r['id'],r['year']):r for r in rows} for id,rows in future.items()}
countries=[]
for c in origin['countries']:
 id=c['id'];obs={t:[[y,train[t].get(id,{}).get(str(y)) if y<=2018 else test[t].get(id,{}).get(str(y))] for y in range(2015,2026)] for t in ['ladder','gdp']}
 eligible=all(obs[t][-1][1] is not None for t in obs)
 paths={};projections={}
 for mid,index in histidx.items():paths[mid]={t:[[2018,c[t]]]+[[y,index[id,y][t]] for y in range(2019,2026)] for t in obs}
 if eligible:
  for mid,index in futidx.items():projections[mid]={t:[[2025,obs[t][-1][1]]]+[[y,index[id,y][t]] for y in range(2026,2033)] for t in obs}
 countries.append({'id':id,'name':c['name'],'observed':obs,'historical':paths,'future':projections,'futureEligible':eligible})
metrics={m['id']:comparison['recipes'][i]['metrics'] for i,m in enumerate(models[:9])}
for id in ['income_only','saturated_health','saturated_income','diagnostic_mean']:metrics[id]={t:{s:newscores[id][t][s] for s in ['endpoint','pooled','2019','2020','2021','2022','2023','2024','2025','endpoint_Q4','pooled_Q4']} for t in ['ladder','gdp']}
metrics['endpoint_blend']=next(r['metrics'] for r in comparison['recipes'] if r['id']=='r512')
metrics['simple_blend']=next(r['metrics'] for r in comparison['recipes'] if r['id']=='r009')
data={'schema':'forecast-paths/1','status':'Retrospective historical scores plus unscored forward projections; no production change','models':models,'ensembles':ensembles,'countries':countries,'metrics':metrics,'diagnostic':{'scores':newscores,'receipt':local('score-receipt.json'),'controlReconstruction':local('freeze-manifest.json')['controlMaxDifference'],'clamps':local('freeze-manifest.json')['clamps']},'future':{'origin':2025,'years':list(range(2026,2033)),'countries':sum(c['futureEligible'] for c in countries),'exclusions':[{'id':c['id'],'name':c['name'],'reason':'2025 ladder or GDP unavailable'} for c in countries if not c['futureEligible']],'method':'Observed2025 ladder/GDP initialize unchanged2018 fits. Country growth and health trends stay as estimated in2015–2018; governance stays at old2015 background. No future calibration, score, AI transition or policy intervention. Past-only unsupported original variants stop at2025.','uncertainty':'Range of displayed model predictions is disagreement only, not a probability interval. Models share inputs and can miss together.'}}
(OUT/'paths.json').write_text(json.dumps(data,separators=(',',':'),allow_nan=False)+'\n')
print(json.dumps({'countryCount':len(countries),'forward':data['future'],'historicalModels':len(historical),'futureModels':len(future)},indent=2))

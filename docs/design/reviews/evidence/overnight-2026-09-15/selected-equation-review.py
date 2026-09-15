import gzip,json,math
p='/private/tmp/alignment-stage35/tmp/qualification/world-conditional-v1-profile.jsonl.gz'
with gzip.open(p,'rt') as f:
 next(f); c=json.loads(next(f))
m=c['inputs']['scenario']['model']; corps=c['inputs']['scenario']['corporations']; macro=m['macro']; x=c['months'][0]['countries']['USA']; adoption=x['aiAdoption']; gdp=x['gdpPerCapita']; baseline=gdp/(1+macro['productivityGain']*adoption*x['cognitiveShare']); displaced=0; level=sum(t['aiAdoptionLevel'] for t in corps if 'USA' in t['operatingCountries'])/sum('USA' in t['operatingCountries'] for t in corps)
for row in c['months'][1:]:
 old=adoption; adoption=min(.999,old+m['aiGrowthRate']*(1+gdp/100000)*level*.1*(1-old)); baseline*=(1+macro['baselineGrowth'])**(1/12);gdp=baseline*(1+macro['productivityGain']*adoption*x['cognitiveShare']); labor=.6*(1-macro['laborShareSensitivity']*adoption*x['cognitiveShare']); displaced=displaced*(1-1/macro['reemploymentMonths'])+max(0,adoption-old)*x['cognitiveShare']*macro['automationShare'];u=min(.6,x['naturalUnemployment']+displaced); actual=row['countries']['USA']
 for key,v in dict(aiAdoption=adoption,gdpPerCapita=gdp,gdpNoAi=baseline,laborShare=labor,unemployment=u,cognitiveUnemployment=min(.9,x['naturalUnemployment']+displaced/x['cognitiveShare'])).items():assert math.isclose(v,actual[key],abs_tol=1e-9,rel_tol=1e-12),(row['month'],key,v,actual[key])
print('Independent USA baseline macro recurrence: all 60 transitions pass')

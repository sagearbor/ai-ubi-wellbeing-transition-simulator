import gzip,json,math,hashlib,collections
from pathlib import Path
root=Path('/private/tmp/alignment-stage35'); data=json.loads((root/'data/countries/wb-2026-09.json').read_text()); roster={x['id']:x for x in data['countries']}; k=data['wellbeingAnchor']; manifest=json.loads((root/'data/qualification/world-conditional-v1-evidence.json').read_text()); path=root/manifest['rawPath']; counts=collections.Counter(); selected={}; hashes=[]
def close(a,b):
 assert math.isfinite(a) and math.isfinite(b) and math.isclose(a,b,rel_tol=2e-10,abs_tol=2e-9),(a,b)
with path.open('rb') as f:
 h=hashlib.file_digest(f,'sha256').hexdigest()
assert h=='6983c38b06153d079d1dbd28118f4e4c714861cd84d68faf3ac7da884c52d50b'
with gzip.open(path,'rt') as f:
 header=json.loads(next(f))
 for line in f:
  c=json.loads(line); hashes.append(hashlib.sha256(line.rstrip('\n').encode()).hexdigest()); counts['cases']+=1; assert c['failure'] is None; assert len(c['months'])==61
  assert c['id']==header['expectedIds'][counts['cases']-1]
  overrides={x['id']:x for x in c['inputs'].get('countries',[])}; model=c['inputs']['scenario']['model']; ass=model['conditional']; corps=c['inputs']['scenario']['corporations']; assert len(corps)==79
  for mi,m in enumerate(c['months']):
   assert m['month']==mi and set(m['countries'])==set(roster); assert len(m['budgets'])==79; assert m['realizedWellbeing'] is None; counts['months']+=1
   countries=m['countries']; pop=sum(x['population'] for x in countries.values()); expected={id:0. for id in roster}; budgets={b['id']:b for b in m['budgets']}; assert set(budgets)=={x['id'] for x in corps}; exhausted=[]
   for corp in corps:
    b=budgets[corp['id']]; source=corp['marketCap']*corp['aiAdoptionLevel']*.15/12; available=source*corp.get('availableShare',1); request=corp.get('fundingRequest',{}); requested=request['monthlyBillions'] if request.get('kind')=='amount' else source*corp['contributionRate']; actual=min(requested,available)
    for name,value in dict(source=source,available=available,requested=requested,actual=actual,reservedForOtherUses=source-available,slack=available-actual,unfunded=requested-actual).items(): close(b[name],value)
    destinations=list(roster) if corp['distributionStrategy']=='global' else [corp['headquartersCountry']] if corp['distributionStrategy']=='hq-local' else corp['operatingCountries']; denom=sum(countries[id]['population'] for id in destinations)
    for id in destinations: expected[id]+=actual*countries[id]['population']/denom
    if requested>actual: exhausted.append(corp['id'])
    counts['corporationRows']+=1
   invalid=[]; validpop=0; weighted=0; assumedpop=0
   for id,x in countries.items():
    counts['countryRows']+=1; close(x['transferMonthlyBillions'],expected[id]); close(x['population'],overrides.get(id,{}).get('population',roster[id]['population']['value'])); w=x['conditionalWellbeing']; gov=overrides.get(id,{}).get('governance',roster[id]['governance']['value']); inc=k['intercept']+k['lnGdp']*math.log(x['gdpPerCapita']*x['laborShare']/.6)+k['governance']*gov; denom=x['gdpPerCapita']*x['laborShare']*ass['incomeDenominatorMultiplier']; ratio=expected[id]*12000/x['population']/denom; transfer=ass['transferEffectPerDoubling']*math.log2(1+ratio); loss=ass['nonIncomeLossPerAdditionalUnemployedPerson']*max(0,x['unemployment']-x['naturalUnemployment'])*x['laborForcePerResident']; raw=inc+transfer-loss
    for name,val in dict(income=inc,incomeDenominatorAnnual=denom,transferRatio=ratio,transfer=transfer,nonIncomeUnemployment=loss,raw=raw).items():close(w[name],val)
    # Boundary validity follows retained JS raw, with tiny rounding uncertainty in independent log.
    assert w['valid']==(0<=w['raw']<=100)
    if not w['valid']: invalid.append(id)
    else: validpop+=x['population']
    weighted+=w['raw']*x['population']/pop
    if roster[id]['gdpPerCapita']['status']!='observed':assumedpop+=x['population']
   s=m['summary']; close(s['rawPopulationWeighted'],weighted);close(s['populationMillions'],pop);close(s['validPopulationMillions'],validpop);close(s['assumedGdpPopulationMillions'],assumedpop); assert s['countryCount']==128 and s['invalidCountryCount']==len(invalid) and s['assumedGdpCountryCount']==2
   assert (s['value'] is None)==bool(invalid)
   if not invalid:close(s['value'],weighted)
   for field,key in [('mappingOutsideScale',invalid),('fundingExhausted',exhausted),('adoptionCap',[id for id,x in countries.items() if x.get('adoptionDiagnostics',{}).get('capActive')]),('unemploymentCap',[id for id,x in countries.items() if x.get('macroDiagnostics',{}).get('unemploymentCapActive') or x.get('macroDiagnostics',{}).get('cognitiveUnemploymentCapActive')])]:assert set(m['constraints'][field])==set(key)
   a=m['accounting']
   for name,bname in [('source','source'),('available','available'),('requested','requested'),('actual','actual'),('unfunded','unfunded'),('unused','slack'),('reserved','reservedForOtherUses')]:close(a[name],sum(b[bname] for b in budgets.values()))
   close(a['receipts'],sum(expected.values()));close(a['actual'],a['receipts']);close(a['residual'],a['actual']-a['receipts']);counts['invalidRows']+=len(invalid)
  if c['id']=='base' or any(t in c['id'] for t in ['funding-exhaustion','cap-neighbor','mapping-floor-neighbor','mapping-ceiling-neighbor','relative-contributionRate','absolute-zero-contributionRate','range-contributionRate-0']):
   selected[c['id']]=[{'month':m['month'],'source':m['accounting']['source'],'funded':m['accounting']['actual'],'unfunded':m['accounting']['unfunded'],'raw':m['summary']['rawPopulationWeighted'],'invalid':m['summary']['invalidCountryCount'],'us':m['countries']['USA']['conditionalWellbeing']['raw'],'macro':m['countries']['USA'].get('macroDiagnostics'),'adoption':m['countries']['USA'].get('adoptionDiagnostics')} for m in c['months'] if m['month'] in [0,1,12,24,60]]
  if counts['cases']%100==0:print('checked',counts['cases'],flush=True)
assert hashes==manifest['caseHashes'];assert counts['cases']==383
out={'counts':dict(counts),'compressedHash':h,'selected':selected};Path('/private/tmp/independent-profile-review-output.json').write_text(json.dumps(out,indent=2));print(json.dumps({'counts':dict(counts),'compressedHash':h}))

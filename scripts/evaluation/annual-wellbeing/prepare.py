"""Join official annual target rows to fresh public World Bank annual drivers.

Target file contract: {"rows":[{"id":"USA","name":"United States","year":2005,"y":7.1}],
"provenance":{"sources":[{"url":"...","label":"..."}],"targetPrecision":"..."}}.
Only source-level schema/count summaries are printed; no evaluation losses are computed.
"""
import argparse
import datetime as dt
import hashlib
import json
import math
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
DATA=ROOT/'data/evaluation/annual-wellbeing-20260917'
INDICATORS={'log_gdp':'NY.GDP.PCAP.KD','life_expectancy':'SP.DYN.LE00.IN','unemployment':'SL.UEM.TOTL.ZS'}


def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(p,v): p.write_text(json.dumps(v,indent=2,allow_nan=False)+'\n')


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--target',type=Path,required=True)
    ap.add_argument('--worldbank',type=Path,required=True,help='annual-objective study data directory')
    args=ap.parse_args()
    if (DATA/'score-receipt.json').exists(): raise SystemExit('Frozen scored study: preparation cannot replace input.')
    target=json.loads(args.target.read_text())
    if target.get('annual') is not True: raise SystemExit('Target metadata must explicitly attest annual:true.')
    if target.get('officialPublic') is not True: raise SystemExit('Target metadata must explicitly attest officialPublic:true.')
    wbprov=json.loads((args.worldbank/'provenance.json').read_text())
    rawdir=args.worldbank/'raw'
    cc=json.loads((rawdir/'countries.json').read_text())[1]
    valid={c['id']:c['name'] for c in cc if c['region']['value']!='Aggregates'}
    series={}; used=[]
    for feature,indicator in INDICATORS.items():
        filename=indicator+'-1960-2025.json'; path=rawdir/filename
        metadata=next(s for s in wbprov['sources'] if s['file']==filename)
        assert sha(path)==metadata['sha256'],f'Source hash mismatch: {filename}'
        raw=json.loads(path.read_text())
        assert raw[0]['pages']==1 and len(raw[1])==raw[0]['total']
        series[feature]={(r['countryiso3code'],int(r['date'])):r['value'] for r in raw[1] if r['countryiso3code'] in valid}
        used.append({**metadata,'label':indicator,'description':'Fresh public World Bank annual series; latest-vintage retrospective values','sharedRawPath':'data/evaluation/annual-objective-20260917/raw/'+filename})
    rows=[]; excluded=[]; keys=set()
    for r in target['rows']:
        country=r['id']; year=int(r['year']); y=r['y']
        if year<2005: continue
        if country not in valid:
            excluded.append({'id':country,'year':year,'reason':'No nonaggregate World Bank country mapping'})
            continue
        if y is None: continue
        if not 0<=float(y)<=10: raise ValueError('Invalid Cantril ladder range')
        key=(country,year)
        if key in keys: raise ValueError(f'Duplicate target country-year: {key}')
        keys.add(key)
        xs={f:series[f].get(key) for f in INDICATORS}
        if xs['log_gdp'] is not None: xs['log_gdp']=math.log(xs['log_gdp']) if xs['log_gdp']>0 else None
        rows.append({'id':country,'name':r.get('name',valid[country]),'year':year,'y':float(y),'x':xs})
    rows.sort(key=lambda r:(r['id'],r['year']))
    (DATA/'sources').mkdir(parents=True,exist_ok=True)
    targetcopy=DATA/'sources/official-annual-target.json'
    targetcopy.write_bytes(args.target.read_bytes())
    dump(DATA/'input.json',{'schemaVersion':1,'rows':rows})
    source={'retrievedAt':dt.datetime.now(dt.timezone.utc).isoformat(),
       'sources':target['provenance'].get('sources',[])+used,
       'targetPrecision':target['provenance'].get('targetPrecision','unknown; see target source'),
       'targetSHA256':sha(targetcopy),'targetCollection':target['provenance'],
       'worldBankAttribution':wbprov['attribution'],'worldBankLicense':wbprov['license'],
       'worldBankLicenseURL':wbprov['licenseUrl'],
       'revisions':'Latest-vintage retrospective data; annual date does not assert release-time availability.',
       'excludedUnmappedRows':excluded,
       'schemaChecks':{'annualTarget':True,'threeYearAveragesUsed':False,'uniqueCountryYear':len(keys)==len(rows),'targetRows':len(rows),'countries':len({r['id'] for r in rows}),'years':sorted({r['year'] for r in rows})}}
    dump(DATA/'sources/provenance.json',source)
    print(json.dumps(source['schemaChecks'],indent=2))

if __name__=='__main__': main()

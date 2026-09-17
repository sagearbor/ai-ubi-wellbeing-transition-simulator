"""Build the compact conversation companion, using the same plotted values."""
import json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).parent
d=json.loads((ROOT/'data/evaluation/diagnostic-health-income-2018-v1/paths.json').read_text())
ids=['g_offset','c_decay','g_health','income_only','saturated_income']
keep=set(ids+['endpoint_blend','persistence'])
def compact(v):
 if isinstance(v,float):return round(v,6)
 if isinstance(v,list):return [compact(x) for x in v]
 if isinstance(v,dict):return {k:compact(x) for k,x in v.items()}
 return v
payload={'models':[{'id':m['id'],'name':m['name']} for mid in ids for m in d['models'] if m['id']==mid],
 'countries':[{**{k:c[k] for k in ['id','name','observed']},**{view:{k:v for k,v in c[view].items() if k in keep} for view in ['historical','future']}} for c in d['countries']]}
page=(HERE/'inline-template.html').read_text().replace('__INLINE_DATA__',json.dumps(compact(payload),separators=(',',':')).replace('</','<\\/'))
assert len(page.encode())<1_000_000
out=Path(sys.argv[1]);out.write_text(page)
print(out,len(page.encode()))

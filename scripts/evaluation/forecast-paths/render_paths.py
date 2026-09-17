import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).parent
p=ROOT/'data/evaluation/diagnostic-health-income-2018-v1/paths.json'
d=json.loads(p.read_text())
# Compact chart data, leaving full precision and details in the published research artifacts.
d['diagnostic']['scores']={}
def rounded(v):
 if isinstance(v,float):return v if abs(v)<1e-8 else round(v,9)
 if isinstance(v,list):return [rounded(x) for x in v]
 if isinstance(v,dict):return {k:rounded(x) for k,x in v.items()}
 return v
library=(ROOT/'node_modules/d3/dist/d3.min.js').read_text()
assert 'v7.9.0' in library[:200]
page=(HERE/'chart-template.html').read_text().replace('__PATH_DATA__',json.dumps(rounded(d),separators=(',',':')).replace('</','<\\/')).replace('__D3_LIBRARY__',library.replace('</script','<\\/script')).replace('__CHART_SCRIPT__',(HERE/'chart.js').read_text())
out=ROOT/'docs/design/reviews/2026-09-16-forecast-paths.html';out.write_text(page)
print(out,len(page.encode()))

#!/usr/bin/env python3
"""Render a portable, offline interactive report from the descriptive analysis."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'data/evaluation/comparison-20260916/results.json'
data=json.loads(SOURCE.read_text())
# Keep full precision in results.json/CSV. Six decimals suffice for interactive display.
def round_numbers(v):
    if isinstance(v,float):return round(v,9)
    if isinstance(v,list):return [round_numbers(x) for x in v]
    if isinstance(v,dict):return {k:round_numbers(x) for k,x in v.items()}
    return v
payload=round_numbers(data)
for recipe in payload['recipes']:
    for target,metrics in recipe['metrics'].items():
        for scope,metric in metrics.items():
            for key in ['rmse','bias']:
                if scope not in ['endpoint','pooled']:metric.pop(key,None)
page=(Path(__file__).parent/'report-template.html').read_text()
assert page.count('__REPORT_DATA__')==1
page=page.replace('__REPORT_DATA__',json.dumps(payload,separators=(',',':'),allow_nan=False).replace('</','<\\/'))
out=ROOT/'docs/design/reviews/2026-09-16-independent-combination-review.html'
out.write_text(page)
print(str(out),out.stat().st_size,'bytes')

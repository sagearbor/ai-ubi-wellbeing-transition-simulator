"""Read-only checks of saved evidence and published gallery links; no fitting."""
from collections import defaultdict
import hashlib
import json
import math
from pathlib import Path
import re
from PIL import Image

ROOT=Path(__file__).resolve().parents[3]
BASE=ROOT/'data/evaluation/annual-wellbeing-20260917'
REV=ROOT/'docs/design/reviews'
FIG=REV/'figures/annual-history-20260917'


def same(a,b):
    assert math.isclose(a,b,rel_tol=1e-11,abs_tol=1e-11),(a,b)


def main():
    receipt=json.loads((BASE/'score-receipt.json').read_text())
    assert receipt['scoreRun']==receipt['maximumScoreRuns']==1
    for path,digest in {**receipt['hashes'],**receipt['outputs']}.items():
        assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==digest,path
    data=json.loads((BASE/'paths.json').read_text())
    inputs=json.loads((BASE/'input.json').read_text())
    methods={m['id'] for m in data['methods']}
    sums=defaultdict(lambda:[0,0.,0.]);sets=set();counts=defaultdict(int)
    for country in data['countries']:
        observed=dict(country['observed'])
        for row in country['rows']:
            year,mode=row['year'],row['mode']
            key=(country['id'],mode,year)
            assert key not in sets;sets.add(key)
            assert row['origin']==year-1 and row['horizon']==1
            assert row['fitCutoff']==(2016 if mode=='conditional' else year-1)
            assert row['featureMaxYear']==(year if mode=='conditional' else year-1)
            assert set(row['predictions'])==methods
            same(row['observed'],observed[year]);same(row['previousObserved'],observed[year-1])
            same(row['predictions']['persistence'],observed[year-1])
            for method,prediction in row['predictions'].items():
                assert math.isfinite(prediction) and 0<=prediction<=10
                path=dict(country['predictions'][mode][method]);same(path[year],prediction)
                error=abs(prediction-row['observed']);base=abs(observed[year]-observed[year-1])
                same(error,abs((prediction-observed[year-1])-(observed[year]-observed[year-1])))
                for scope in ('pooled',country['id']):
                    stats=sums[(mode,scope,method)];stats[0]+=1;stats[1]+=error;stats[2]+=base
            counts[mode]+=1
    for (mode,scope,method),(n,err,base) in sums.items():
        metric=data['metrics'][mode]['pooled'][method] if scope=='pooled' else data['metrics'][mode]['byCountry'][scope][method]
        assert n==metric['n']
        same(metric['levelMAE'],err/n);same(metric['changeMAE'],err/n)
        same(metric['persistenceMAE'],base/n)
        same(metric['percentMAEReductionVsPersistence'],100*(1-err/base))
    assert dict(counts)==receipt['counts']
    for source in json.loads((BASE/'sources/provenance.json').read_text())['sources']:
        if 'sharedRawPath' in source:
            assert hashlib.sha256((ROOT/source['sharedRawPath']).read_bytes()).hexdigest()==source['sha256']
    pngs=list(FIG.glob('*.png'));assert len(pngs)==43,len(pngs)
    for path in pngs:
        with Image.open(path) as im:
            assert im.width>=1200 and im.height>=800,path
            im.verify()
    pages=[REV/'2026-09-17-annual-history-graphs.md']+sorted((REV/'annual-history-20260917').glob('*.md'))
    assert len(pages)==9
    nlinks=0
    for page in pages:
        for target in re.findall(r'\]\(([^)]+)\)',page.read_text()):
            if target.startswith(('https://','http://','#')):
                continue
            path=(page.parent/target.split('#')[0]).resolve()
            assert path.is_relative_to(ROOT) and path.exists(),(page,target)
            nlinks+=1
    for source,digest in json.loads((FIG/'wellbeing-presentation.json').read_text())['sources'].items():
        assert hashlib.sha256((ROOT/source).read_bytes()).hexdigest()==digest
    print(json.dumps({'status':'passed','wellbeingMatchedSets':len(sets),'wellbeingPredictions':len(sets)*len(methods),
       'independentlyRecomputedMetricGroups':len(sums),'images':len(pngs),'pages':len(pages),'localLinksChecked':nlinks,
       'checks':'Saved hash integrity, temporal metadata, common-method masks, observed values, path/row equality, all pooled/country MAE arithmetic, PNG integrity and gallery links. No fit or scored run.'},indent=2))


if __name__=='__main__':
    main()

"""Exactly one descriptive scoring run after protocol/code/input are committed."""
import collections
import datetime as dt
import hashlib
import json
from pathlib import Path
import subprocess

from model import METHODS, FEATURES, generate, metrics

ROOT=Path(__file__).resolve().parents[3]
DATA=ROOT/'data/evaluation/annual-wellbeing-20260917'
CODE=ROOT/'scripts/evaluation/annual-wellbeing'
DOC=ROOT/'docs/design/research/2026-09-17-annual-wellbeing.md'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def dump(path,value):
    path.write_text(json.dumps(value,indent=2,allow_nan=False)+'\n')


def main():
    receipt=DATA/'score-receipt.json'
    if receipt.exists():
        raise SystemExit('Refusing a second scoring run: score-receipt.json already exists. Preserve this study and register a new study for further comparisons.')
    frozen=[DATA/'protocol.json',DATA/'input.json',DATA/'sources/provenance.json']+list(CODE.glob('*.py'))
    for p in frozen:
        if not p.exists(): raise SystemExit(f'Missing frozen input: {p}')
        rel=str(p.relative_to(ROOT))
        subprocess.run(['git','ls-files','--error-unmatch',rel],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
        subprocess.run(['git','diff','--exit-code','HEAD','--',rel],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
    commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    now=dt.datetime.now(dt.timezone.utc).isoformat()
    hashes={str(p.relative_to(ROOT)):sha(p) for p in frozen}
    record={'status':'started','startedAt':now,'freezeCommit':commit,'hashes':hashes,'scoreRun':1,'maximumScoreRuns':1}
    with receipt.open('x') as f: json.dump(record,f,indent=2)
    protocol=json.loads((DATA/'protocol.json').read_text())
    source=json.loads((DATA/'sources/provenance.json').read_text())
    panel=json.loads((DATA/'input.json').read_text())['rows']
    rows,eligible=generate(panel)
    if not rows: raise RuntimeError('No eligible evaluation rows; no numeric claims permitted.')
    bymode={mode:[r for r in rows if r['mode']==mode] for mode in ('conditional','rolling')}
    summary={}
    for mode,mrows in bymode.items():
        cc=sorted({r['id'] for r in mrows})
        bycountry={c:{m:metrics([r for r in mrows if r['id']==c],m) for m in METHODS} for c in cc}
        summary[mode]={'pooled':{m:metrics(mrows,m) for m in METHODS},'byCountry':bycountry,
          'macroCountryMAE':{m:sum(bycountry[c][m]['levelMAE'] for c in cc)/len(cc) for m in METHODS},
          'countryCount':len(cc),'rowCount':len(mrows),
          'years':sorted({r['year'] for r in mrows}),
          'commonMaskSHA256':hashlib.sha256(json.dumps([[r['id'],r['year'],r['origin']] for r in mrows],separators=(',',':')).encode()).hexdigest()}
        counts={m:sum(m in r['predictions'] for r in mrows) for m in METHODS}
        assert len(set(counts.values()))==1,counts
    countries=[]
    for c in eligible:
        obs=sorted([r for r in panel if r['id']==c and r['y'] is not None],key=lambda r:r['year'])
        cr=[r for r in rows if r['id']==c]
        countries.append({'id':c,'name':obs[0]['name'],'observed':[[r['year'],r['y']] for r in obs],
           'predictions':{mode:{m:[[r['year'],r['predictions'][m]] for r in cr if r['mode']==mode] for m in METHODS} for mode in bymode},
           'rows':[{k:v for k,v in r.items() if k!='id'} for r in cr]})
    paths={'schemaVersion':1,'studyId':protocol['studyId'],'target':protocol['target'],
           'caveats':protocol['interpretation'],'methods':[{'id':m['id'],'label':m['label'],'kind':'candidate'} for m in protocol['candidates']]+[{'id':m['id'],'label':m['label'],'kind':'baseline'} for m in protocol['baselines']],
           'modes':protocol['modes'],'predeterminedExamples':protocol['predeterminedExamples'],
           'countries':countries,'metrics':summary,
           'provenance':{'freezeCommit':commit,'hashes':hashes,'source':source,'retrospective':True,'realTime':False,'untouchedHoldout':False,
              'targetPrecision':source.get('targetPrecision','source values'),'features':protocol['data']['features']}}
    dump(DATA/'paths.json',paths)
    dump(DATA/'metrics.json',summary)
    dump(DATA/'predictions.json',{'studyId':protocol['studyId'],'rows':rows})
    lines=['# Annual wellbeing study — 17 September 2026','',
      'This is a latest-vintage retrospective annual comparison, not a real-time forecasting claim or an untouched holdout. The outcome period has appeared in earlier project work. Annual target values come from the official public World Happiness Report display; three-year averages are not used.','',
      'Four parsimonious candidates were frozen before one scoring run. All six methods, including persistence and a damped annual trend, use identical rows within each mode. Coefficients are trained through 2016 for conditional replay and expand through t−1 for each rolling forecast. The conditional replay is a sequence of one-year reconstructions with observed previous-year outcomes and realized target-year drivers; it is not a free-running 2016-origin path.','',
      'Drivers are World Bank log constant-dollar GDP per capita, total life expectancy, and modeled unemployment. Total life expectancy is not WHR healthy life expectancy. No same-survey support/freedom/corruption variables or fitted Figure 2.1 factor contributions are used. Even date-restricted features are revised retrospective vintages, with original release availability unknown.','',
      f'Frozen commit: `{commit}`. Initial training: 2005–2016. Eligible initial cohort: {len(eligible)} countries. All country paths and row-level cutoffs are in `data/evaluation/annual-wellbeing-20260917/paths.json`.','',
      '## All candidate losses','',
      'MAE is in native 0–10 ladder points. Positive reduction means improvement over persistence; negative reduction means worse. Change MAE is algebraically the same as level MAE when both use the same observed t−1 anchor at horizon one. It is therefore not independent evidence of dynamic skill. Direction and change-correlation results are also reported.','',
      '| Mode | Method | Rows | Level/change MAE | Reduction vs persistence | Direction accuracy | Change correlation |',
      '|---|---|---:|---:|---:|---:|---:|']
    for mode in bymode:
        for m in METHODS:
            s=summary[mode]['pooled'][m]
            corr='undefined (constant)' if s['changeCorrelation'] is None else f"{s['changeCorrelation']:.3f}"
            lines.append(f"| {mode} | {m} | {s['n']} | {s['levelMAE']:.4f} | {s['percentMAEReductionVsPersistence']:.2f}% | {100*s['directionAccuracy']:.1f}% | {corr} |")
    lines+=['','Direction uses three classes (up/down/flat), with only a 1e−9 numerical equality tolerance. Every scored country-year is in that denominator. Persistence always predicts flat and thus abstains on nonzero moves; its zero directional accuracy on changing outcomes is not evidence of useful candidate forecasts. `metrics.json` separately reports observed ties, direction-call coverage, accuracy when called, and matched-origin absolute-error wins/losses/ties. Nominal paired sign-test probabilities ignore serial and country dependence and are descriptive only.','',
      '## Predetermined examples','',
      'Countries below were named before scoring. Every eligible country is available in the paths artifact. Missing examples are stated rather than silently replaced.','',
      '| Country | Rolling rows | Persistence MAE | Change ridge MAE | Country offset MAE | Residual carry MAE | Shrinkage MAE | Damped trend MAE |',
      '|---|---:|---:|---:|---:|---:|---:|---:|']
    for c in protocol['predeterminedExamples']:
        s=summary['rolling']['byCountry'].get(c)
        if not s:
            lines.append(f'| {c} | unavailable | — | — | — | — | — | — |')
        else:
            vals=' | '.join(f"{s[m]['levelMAE']:.4f}" for m in ('persistence','change_ridge','country_offset','residual_carry','shrinkage_change','damped_trend'))
            lines.append(f"| {c} | {s['persistence']['n']} | {vals} |")
    lines+=['','## Coverage and limitations','',
      f"Conditional rows: {summary['conditional']['rowCount']} across {summary['conditional']['countryCount']} countries. Rolling rows: {summary['rolling']['rowCount']} across {summary['rolling']['countryCount']} countries. All methods within a mode share the exact mask and origin; modes can differ because conditional reconstruction requires actual target-year drivers.",
      '', 'No missing target or driver is filled. A valid previous year and the year before that are required; gaps remove those dependent predictions. Country inclusion requires five complete 2005–2016 observations. This is an availability-selected panel, not a population-representative country sample. No population weights are used. Macroeconomic features and country offsets cannot establish causal wellbeing effects, and annual country-mean survey noise is not separately modeled.',
      '', 'Exactly one descriptive scoring run was allowed. All registered candidates are published; no candidate was retuned after outcome comparison. No prior evaluation namespace was changed.','',
      '## Reproduction and checks','',
      '`python -m unittest discover -s scripts/evaluation/annual-wellbeing -p "test_*.py" -v`',
      '', '`python scripts/evaluation/annual-wellbeing/run.py` requires committed protocol, code, and input and refuses to overwrite an existing scoring receipt. Preserve the original receipt: a further model comparison needs a new registered study.','',
      'Six synthetic tests establish own-target and future-target invariance, target-year driver exclusion from rolling forecasts, historical-only offsets, frozen cohort selection, exact prediction/missingness counts, and the same-origin change-error identity.','',
      '## Sources','']
    for item in source.get('sources',[]):
        lines.append(f"- [{item.get('label',item['url'])}]({item['url']}) — {item.get('description','')}")
    DOC.write_text('\n'.join(lines)+'\n')
    record.update({'status':'completed','completedAt':dt.datetime.now(dt.timezone.utc).isoformat(),
      'outputs':{str(p.relative_to(ROOT)):sha(p) for p in (DATA/'paths.json',DATA/'metrics.json',DATA/'predictions.json',DOC)},
      'counts':{mode:summary[mode]['rowCount'] for mode in bymode},'eligibleCountries':len(eligible)})
    dump(receipt,record)
    print(json.dumps({mode:{m:round(v['levelMAE'],5) for m,v in summary[mode]['pooled'].items()} for mode in summary},indent=2))

if __name__=='__main__': main()

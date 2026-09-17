"""Matched diagnostic model: pure training/forecast functions, no filesystem I/O."""
import math
import statistics

PHI=.8
LAMBDA=.1

def f_income(g,k,saturated):
    return math.log(g/(g+k)) if saturated else math.log(g)

def slope(series,cutoff,log=False):
    rows=[(int(y),math.log(v) if log else v) for y,v in series.items() if 2015<=int(y)<=cutoff and isinstance(v,(int,float)) and v>0]
    if len(rows)<2:return 0.
    x=sum(y for y,v in rows)/len(rows);z=sum(v for y,v in rows)/len(rows)
    return sum((y-x)*(v-z) for y,v in rows)/sum((y-x)**2 for y,v in rows)

def fit(train,health,cutoff,variant):
    if cutoff not in [2016,2017,2018]:raise ValueError('Unregistered cutoff')
    for panel in [train['gdp'],train['ladder'],health]:
        if any(not 2015<=int(y)<=2018 for v in panel.values() for y in v):raise ValueError('Future training observation')
    values=[v[str(cutoff)] for v in train['gdp'].values() if str(cutoff) in v]
    k=statistics.median(values)
    rows=[];covariates={}
    for c in train['countries']:
        id=c['id'];gp=train['gdp'].get(id,{});lp=train['ladder'].get(id,{});hp=health.get(id,{})
        covariates[id]={'gdpSlope':slope(gp,cutoff,True),'healthSlope':slope(hp,cutoff) if str(cutoff) in hp else 0.,'healthOrigin':hp.get(str(cutoff))}
        for year in range(2016,cutoff+1):
            prev=str(year-1);now=str(year)
            if any(y not in panel for panel in [gp,lp] for y in [prev,now]):continue
            x=f_income(gp[now],k,variant['saturation'])-f_income(gp[prev],k,variant['saturation'])
            h=(hp[now]-hp[prev]) if variant['health'] and now in hp and prev in hp else 0.
            rows.append((x,h,lp[now]-lp[prev]))
    n=len(rows)
    if not n:raise ValueError('No paired rows')
    sg=math.sqrt(sum(g*g for g,h,y in rows)/n) or 1
    sh=math.sqrt(sum(h*h for g,h,y in rows)/n) or 1
    a=LAMBDA+sum((g/sg)**2 for g,h,y in rows)/n
    d=LAMBDA+sum((h/sh)**2 for g,h,y in rows)/n
    b=sum((g/sg)*(h/sh) for g,h,y in rows)/n
    yg=sum((g/sg)*y for g,h,y in rows)/n;yh=sum((h/sh)*y for g,h,y in rows)/n
    det=a*d-b*b
    if det<=0:raise ValueError('Singular fit')
    return {'variant':variant,'cutoff':cutoff,'k':k,'lambda':LAMBDA,'phi':PHI,'n':n,'scaleGdp':sg,'scaleHealth':sh,'betaGdp':(d*yg-b*yh)/det,'betaHealth':(a*yh-b*yg)/det,'covariates':covariates}

def forecast(country,model,horizon,origin_year=2018):
    if not 1<=horizon<=7:raise ValueError('Horizon outside1–7')
    if origin_year<model['cutoff']:raise ValueError('Future calibration')
    cv=model['covariates'][country['id']]
    damp=PHI*(1-PHI**horizon)/(1-PHI)
    gdp=country['gdp']*math.exp(cv['gdpSlope']*damp)
    ho=cv['healthOrigin'];rawh=ho+cv['healthSlope']*damp if ho is not None else None
    healthchange=0 if rawh is None else min(120,max(0,rawh))-ho
    x=f_income(gdp,model['k'],model['variant']['saturation'])-f_income(country['gdp'],model['k'],model['variant']['saturation'])
    raw=country['ladder']+model['betaGdp']*x/model['scaleGdp']+model['betaHealth']*healthchange/model['scaleHealth']
    ladder=max(0,min(10,raw))
    if not math.isfinite(ladder) or not math.isfinite(gdp) or gdp<=0:raise ValueError('Invalid forecast')
    return {'id':country['id'],'name':country['name'],'year':origin_year+horizon,'horizon':horizon,'ladder':ladder,'gdp':gdp,'originLadder':country['ladder'],'originGdp':country['gdp'],'ladderClamped':raw!=ladder,'healthClamped':rawh is not None and not 0<=rawh<=120}

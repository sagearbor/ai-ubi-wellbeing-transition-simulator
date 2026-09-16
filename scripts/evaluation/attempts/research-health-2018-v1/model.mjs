export const GRID=[.1,1,10];
export const PHI=.8;
export const validGdp=x=>Number.isFinite(x)&&x>0;
export const validLadder=x=>Number.isFinite(x)&&x>=0&&x<=10;
export const validHealth=x=>Number.isFinite(x)&&x>0&&x<120;
export function healthPanel(raw){
  const panel={};
  for(const r of raw){
    const y=+r.date;
    if(!Number.isInteger(y)||y<2015||y>2018)throw Error('Health year outside training window');
    if(r.indicator.id!=='SP.DYN.LE00.IN')throw Error('Wrong indicator');
    if(!r.countryiso3code)continue;
    panel[r.countryiso3code]??={};
    if(Object.hasOwn(panel[r.countryiso3code],y))throw Error('Duplicate health country-year');
    panel[r.countryiso3code][y]=validHealth(r.value)?r.value:null;
  }
  return panel;
}
export function validateTraining(train){
  for(const key of ['ladder','gdp'])for(const values of Object.values(train[key]))for(const y of Object.keys(values))if(+y<2015||+y>2018)throw Error('Original year outside training window');
}
export function pairs(train,health,cutoff){
  if(![2016,2017,2018].includes(cutoff))throw Error('Invalid cutoff');
  validateTraining(train);
  const rows=[];
  for(const c of train.countries)for(let year=2016;year<=cutoff;year++){
    const y0=train.ladder[c.id]?.[year-1], y1=train.ladder[c.id]?.[year];
    const g0=train.gdp[c.id]?.[year-1], g1=train.gdp[c.id]?.[year];
    if(!validLadder(y0)||!validLadder(y1)||!validGdp(g0)||!validGdp(g1))continue;
    const h0=health[c.id]?.[year-1],h1=health[c.id]?.[year];
    const missingHealth=!validHealth(h0)||!validHealth(h1);
    rows.push({id:c.id,year,dy:y1-y0,xg:Math.log(g1)-Math.log(g0),xh:missingHealth?0:h1-h0,missingHealth});
  }
  if(!rows.length)throw Error('No training pairs');
  return rows;
}
export function fit(train,health,cutoff,lambda){
  if(!GRID.includes(lambda))throw Error('Unregistered lambda');
  const rows=pairs(train,health,cutoff); const n=rows.length;
  const sg=Math.sqrt(rows.reduce((s,r)=>s+r.xg*r.xg,0)/n)||1;
  const sh=Math.sqrt(rows.reduce((s,r)=>s+r.xh*r.xh,0)/n)||1;
  let a=lambda,d=lambda,b=0,yg=0,yh=0;
  for(const r of rows){const g=r.xg/sg,h=r.xh/sh;a+=g*g/n;d+=h*h/n;b+=g*h/n;yg+=g*r.dy/n;yh+=h*r.dy/n;}
  const det=a*d-b*b;
  if(!(det>0))throw Error('Singular ridge fit');
  const betaG=(d*yg-b*yh)/det,betaH=(a*yh-b*yg)/det;
  return {cutoff,lambda,trainingPairCount:n,missingHealthPairCount:rows.filter(r=>r.missingHealth).length,rms:{gdp:sg,health:sh},beta:{gdp:betaG,health:betaH},originalUnitCoefficients:{logGdp:betaG/sg,lifeExpectancy:betaH/sh},normalization:'train-fold RMS, no centering',intercept:0};
}
export function slope(values,cutoff,transform,valid){
  const rows=Object.entries(values??{}).filter(([y,v])=>+y>=2015&&+y<=cutoff&&valid(v)).map(([y,v])=>({year:+y,z:transform(v)}));
  if(rows.length<2)return {slope:0,count:rows.length,fallback:true};
  const x=rows.reduce((s,r)=>s+r.year,0)/rows.length,z=rows.reduce((s,r)=>s+r.z,0)/rows.length;
  const denominator=rows.reduce((s,r)=>s+(r.year-x)**2,0);
  return {slope:rows.reduce((s,r)=>s+(r.year-x)*(r.z-z),0)/denominator,count:rows.length,fallback:false};
}
export function covariates(country,train,health,cutoff){
  const g=slope(train.gdp[country.id],cutoff,Math.log,validGdp);
  const observedHealth=health[country.id]?.[cutoff];
  const originHealth=validHealth(observedHealth)?observedHealth:null;
  const h=slope(health[country.id],cutoff,x=>x,validHealth);
  if(originHealth===null){h.slope=0;h.fallback=true;}
  return {id:country.id,originYear:cutoff,originHealth,gdpTrend:g,healthTrend:h,healthFallbackReason:originHealth===null?'missing origin health':h.fallback?'fewer than two historical health observations':null};
}
export function forecast(country,model,covariate,horizon){
  if(!Number.isInteger(horizon)||horizon<1||horizon>7)throw Error('Invalid horizon');
  if(!validLadder(country.ladder)||!validGdp(country.gdp))throw Error('Invalid origin');
  if(covariate.originYear!==model.cutoff)throw Error('Origin mismatch');
  const dampedYears=PHI*(1-PHI**horizon)/(1-PHI);
  const logGdpChange=covariate.gdpTrend.slope*dampedYears;
  const gdp=country.gdp*Math.exp(logGdpChange);
  const rawHealth=covariate.originHealth===null?null:covariate.originHealth+covariate.healthTrend.slope*dampedYears;
  const forecastHealth=rawHealth===null?null:Math.max(0,Math.min(120,rawHealth));
  const healthChange=forecastHealth===null?0:forecastHealth-covariate.originHealth;
  const rawLadder=country.ladder+model.beta.gdp*logGdpChange/model.rms.gdp+model.beta.health*healthChange/model.rms.health;
  const ladder=Math.max(0,Math.min(10,rawLadder));
  if(!Number.isFinite(gdp)||gdp<=0||!Number.isFinite(ladder))throw Error('Invalid forecast');
  return {row:{id:country.id,name:country.name,year:model.cutoff+horizon,horizon,ladder,gdp,originLadder:country.ladder,originGdp:country.gdp},diagnostic:{id:country.id,year:model.cutoff+horizon,horizon,rawLadder,ladderClamped:rawLadder!==ladder,rawHealth,forecastHealth,healthClamped:rawHealth!==forecastHealth,logGdpChange,healthChange}};
}
export function metric(errors){if(!errors.length)return {n:0,mae:null,rmse:null,bias:null,reason:'No observed outcomes'};return{n:errors.length,mae:errors.reduce((s,x)=>s+Math.abs(x),0)/errors.length,rmse:Math.sqrt(errors.reduce((s,x)=>s+x*x,0)/errors.length),bias:errors.reduce((s,x)=>s+x,0)/errors.length};}
export function choose(candidates){let best;for(const c of candidates){if(!Number.isFinite(c.mae))throw Error('No validation metric');if(!best||c.mae<best.mae-1e-12||(Math.abs(c.mae-best.mae)<=1e-12&&c.lambda>best.lambda))best=c;}return best;}

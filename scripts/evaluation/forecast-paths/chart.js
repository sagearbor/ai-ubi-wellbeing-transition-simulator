'use strict';
const PATHS=JSON.parse(document.getElementById('path-data').textContent);
const el=id=>document.getElementById(id), countries=Object.fromEntries(PATHS.countries.map(c=>[c.id,c]));
const active=new Set(['g_offset','c_decay','g_health','income_only','saturated_income']);
const palette=['var(--s1)','var(--s2)','var(--s3)','var(--s4)','var(--s5)','var(--s6)'];
const modelColors=Object.fromEntries(PATHS.models.map((m,i)=>[m.id,palette[i%palette.length]]));
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=(n,d=3)=>n===null||n===undefined?'Not observed':Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const skillText=s=>Math.abs(s)<1e-8?'Same error':`${(Math.abs(s)*100).toFixed(1)}% ${s>0?'less':'more'} error`;
const outcomeNames={ladder:'Ladder points (0–10)',gdp:'Constant-2015 US dollars per person'};
let pinned={ladder:false,gdp:false};
el('country').innerHTML=PATHS.countries.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');el('country').value='USA';
function current(){return {country:countries[el('country').value],view:el('view').value,ensemble:PATHS.ensembles.find(e=>e.id===el('ensemble').value)}}
function render(){
 const {country:c,view,ensemble:e}=current();const forward=view==='future';
 el('view-status').innerHTML=forward?`<strong>Exploratory 2026–2032 projections.</strong> Observed 2025 starting point; unchanged 2018 fits. No future score. Bold line: ${escapeHtml(e.name)}. ${escapeHtml(e.status)}`:`<strong>Historical test: origin 2018, outcomes 2019–2025.</strong> Thin lines are saved forecasts, dark line is observed reality. Bold line: ${escapeHtml(e.name)}. ${escapeHtml(e.status)}`;
 const available=PATHS.models.filter(m=>m.id!=='persistence'&&(!forward||c.future[m.id]));
 el('legend').innerHTML='<span class="permanent strong" style="--c:var(--obs)"><span class="swatch"></span>Observed</span><span class="permanent strong" style="--c:var(--bold)"><span class="swatch"></span>Bold ensemble</span><span class="permanent dashed" style="--c:var(--base)"><span class="swatch"></span>Persistence</span>'+available.map(m=>`<button type="button" data-model="${m.id}" aria-pressed="${active.has(m.id)}" style="--c:${modelColors[m.id]}"><span class="swatch"></span>${escapeHtml(m.name)}</button>`).join('');
 for(const target of ['ladder','gdp']){pinned[target]=false;draw(target);}
}
function seriesFor(target){
 const {country:c,view,ensemble:e}=current();const forward=view==='future',collection=c[view];
 let rows=[{id:'observed',name:'Observed',color:'var(--obs)',width:3,values:c.observed[target].filter(([year])=>year>=(forward?2021:2015))}];
 if(forward&&!c.futureEligible)return rows;
 for(const m of PATHS.models)if(active.has(m.id)&&m.id!=='persistence'&&collection[m.id])rows.push({id:m.id,name:m.name,color:modelColors[m.id],width:1.5,values:collection[m.id][target]});
 rows.push({id:'persistence',name:'Persistence',color:'var(--base)',width:1.8,dash:'5 5',values:collection.persistence[target]});
 rows.push({id:e.id,name:e.name,color:'var(--bold)',width:4,values:collection[e.id][target]});
 return rows;
}
function interpolate(values,year){
 if(year<values[0][0]||year>values.at(-1)[0])return null;
 const index=d3.bisector(d=>d[0]).left(values,year),b=values[Math.min(index,values.length-1)],a=values[Math.max(0,index-1)];
 if(b[0]===year)return b[1];if(a[1]===null||b[1]===null)return null;
 return a[1]+(b[1]-a[1])*(year-a[0])/(b[0]-a[0]||1);
}
function draw(target){
 const container=el('plot-'+target),svg=d3.select(container.querySelector('svg')),data=seriesFor(target),{country:c,view,ensemble:e}=current();
 const forward=view==='future',width=Math.max(270,container.clientWidth),height=width<500?300:360;
 const margin={left:target==='gdp'?76:66,right:15,top:32,bottom:58};const x0=forward?2021:2015,x1=forward?2032:2025,origin=forward?2025:2018;
 svg.selectAll('*').remove();svg.attr('viewBox',`0 0 ${width} ${height}`).attr('height',height);
 const all=data.flatMap(s=>s.values.filter(d=>d[1]!==null).map(d=>d[1]));const [lo,hi]=d3.extent(all),padding=Math.max((hi-lo)*.1,target==='ladder'?.08:Math.max(1,hi*.01));
 const x=d3.scaleLinear().domain([x0,x1]).range([margin.left+4,width-margin.right-4]);
 const y=d3.scaleLinear().domain([Math.max(0,lo-padding),hi+padding]).nice(5).range([height-margin.bottom,margin.top]);
 const frame={x:margin.left,y:margin.top,width:width-margin.left-margin.right,height:height-margin.top-margin.bottom};
 svg.append('defs').append('clipPath').attr('id','clip-'+target).append('rect').attr('x',frame.x).attr('y',frame.y).attr('width',frame.width).attr('height',frame.height);
 svg.append('rect').attr('data-chart-frame','').attr('x',frame.x).attr('y',frame.y).attr('width',frame.width).attr('height',frame.height).attr('fill','none').attr('stroke','var(--line)');
 const ticks=width<500?(forward?[2021,2025,2029,2032]:[2015,2018,2022,2025]):d3.range(x0,x1+1);
 const xAxis=svg.append('g').attr('transform',`translate(0,${height-margin.bottom})`).call(d3.axisBottom(x).tickValues(ticks).tickFormat(d3.format('d')).tickSizeOuter(0));
 xAxis.select('.tick:first-of-type text').attr('text-anchor','start');xAxis.select('.tick:last-of-type text').attr('text-anchor','end');
 svg.append('g').attr('transform',`translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(target==='gdp'?d3.format(',.0f'):d3.format('.1f')).tickSizeOuter(0));
 svg.append('g').attr('class','grid').attr('transform',`translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-frame.width).tickFormat(''));
 svg.append('text').attr('class','axis-title').attr('data-axis','x').attr('x',margin.left+frame.width/2).attr('y',height-10).attr('text-anchor','middle').text('Calendar year');
 svg.append('text').attr('class','axis-title').attr('data-axis','y').attr('x',margin.left).attr('y',15).text(outcomeNames[target]);
 const plot=svg.append('g').attr('clip-path',`url(#clip-${target})`);
 plot.append('rect').attr('x',x(origin)).attr('y',frame.y).attr('width',x(x1)-x(origin)).attr('height',frame.height).attr('fill','var(--band)').attr('opacity',.025);
 const members=data.filter(s=>!['observed','persistence',e.id].includes(s.id));
 if(members.length>=2){const band=d3.range(origin,x1+1).map(year=>{const vals=members.map(s=>interpolate(s.values,year)).filter(v=>v!==null);return {year,low:d3.min(vals),high:d3.max(vals)}});plot.append('path').datum(band).attr('d',d3.area().defined(d=>d.low!==undefined).x(d=>x(d.year)).y0(d=>y(d.low)).y1(d=>y(d.high))).attr('fill','var(--band)').attr('opacity',.10);}
 plot.append('line').attr('x1',x(origin)).attr('x2',x(origin)).attr('y1',frame.y).attr('y2',height-margin.bottom).attr('stroke','var(--muted)').attr('stroke-dasharray','3 4');
 plot.append('text').attr('x',x(origin)+5).attr('y',frame.y+16).text(forward?'2025 origin':'2018 origin');
 const line=d3.line().defined(d=>d[1]!==null).x(d=>x(d[0])).y(d=>y(d[1]));
 for(const s of data){plot.append('path').datum(s.values).attr('data-series',s.id).attr('d',line).attr('stroke',s.color).attr('stroke-width',s.width).attr('stroke-dasharray',s.dash||null).attr('fill','none');if(s.id==='observed')plot.selectAll('.observed-point').data(s.values.filter(d=>d[1]!==null)).join('circle').attr('class','observed-point').attr('cx',d=>x(d[0])).attr('cy',d=>y(d[1])).attr('r',2.8).attr('fill',s.color);}
 const hover=plot.append('g').style('display','none');hover.append('line').attr('data-chart-hover-guide','').attr('y1',frame.y).attr('y2',height-margin.bottom).attr('stroke','var(--muted)');
 let tip=container.querySelector('.tip');if(!tip){tip=document.createElement('div');tip.className='tip';tip.setAttribute('role','tooltip');container.appendChild(tip)}tip.style.display='none';
 function show(event){const [px]=d3.pointer(event,svg.node());const clipped=Math.min(width-margin.right,Math.max(margin.left,px)),year=x.invert(clipped);hover.style('display',null);hover.select('line').attr('x1',clipped).attr('x2',clipped);const points=data.map(s=>({...s,value:interpolate(s.values,year)})).filter(s=>s.value!==null);hover.selectAll('circle').data(points,s=>s.id).join('circle').attr('data-chart-hover-marker','').attr('cx',clipped).attr('cy',s=>y(s.value)).attr('r',3).attr('fill',s=>s.color);tip.innerHTML=`<strong>${year.toFixed(2)}${pinned[target]?' · pinned':''}</strong><table>${points.map(s=>`<tr><td>${escapeHtml(s.name)}</td><td>${f(s.value,target==='gdp'?0:3)}</td></tr>`).join('')}</table>`;tip.style.display='block';tip.style.left=Math.max(5,Math.min(width-tip.offsetWidth-5,clipped+12))+'px';tip.style.top='42px';}
 svg.append('rect').attr('data-chart-hit','').attr('data-chart-hover-overlay','cross-series').attr('x',frame.x).attr('y',frame.y).attr('width',frame.width).attr('height',frame.height).attr('fill','transparent').on('pointermove',event=>{if(!pinned[target])show(event)}).on('pointerleave',()=>{if(!pinned[target]){hover.style('display','none');tip.style.display='none'}}).on('click',event=>{pinned[target]=!pinned[target];if(pinned[target])show(event);else{hover.style('display','none');tip.style.display='none'}});
 const summary=el('summary-'+target);
 if(forward){summary.innerHTML=c.futureEligible?`<strong>${escapeHtml(c.name)}, 2032:</strong> bold ensemble ${f(c.future[e.id][target].at(-1)[1],target==='gdp'?0:3)}; 2025 starting value ${f(c.observed[target].at(-1)[1],target==='gdp'?0:3)}. <strong>Not yet observed or scored.</strong>`:`<strong>${escapeHtml(c.name)}:</strong> no forward paths because its 2025 wellbeing or GDP observation is missing. Historical observations remain visible.`;}
 else{const actual=c.observed[target].at(-1)[1],prediction=c.historical[e.id][target].at(-1)[1],base=c.historical.persistence[target].at(-1)[1];summary.innerHTML=`<strong>${escapeHtml(c.name)}, 2025:</strong> observed ${f(actual,target==='gdp'?0:3)}; bold forecast ${f(prediction,target==='gdp'?0:3)}; persistence ${f(base,target==='gdp'?0:3)}. ${actual===null?'Endpoint unscored.':`Absolute error: ${f(Math.abs(prediction-actual),target==='gdp'?0:3)} versus ${f(Math.abs(base-actual),target==='gdp'?0:3)} for persistence.`}`;}
}
el('legend').addEventListener('click',event=>{const b=event.target.closest('[data-model]');if(!b)return;active.has(b.dataset.model)?active.delete(b.dataset.model):active.add(b.dataset.model);render()});
for(const id of ['country','view','ensemble'])el(id).addEventListener('change',render);
new ResizeObserver(()=>{draw('ladder');draw('gdp')}).observe(el('chart-app'));
const tableRows=[['g_offset','Existing country offsets'],['endpoint_blend','Earlier selected 75/25 blend'],['g_health','Health + income (control)'],['income_only','Income only (health removed)'],['saturated_health','Saturating income + health'],['saturated_income','Saturating income only'],['diagnostic_mean','New equal four-model average']];
el('round-table').querySelector('tbody').innerHTML=tableRows.map(([id,name])=>{const m=PATHS.metrics[id].ladder,e=m.endpoint,q=m.endpoint_Q4;return `<tr><td>${name}</td><td>${f(e.mae,4)}</td><td class="${e.skill>=0?'good':'bad'}">${skillText(e.skill)}</td><td>${f(m.pooled.mae,4)}</td><td class="${q.skill>=0?'good':'bad'}">${skillText(q.skill)}</td></tr>`}).join('');
const control=PATHS.metrics.g_health.ladder.endpoint.mae,noHealth=PATHS.metrics.income_only.ladder.endpoint.mae;
el('health-effect').innerHTML=`The matched health-removal difference is only <strong>${f(control-noHealth,4)} ladder points</strong> at the endpoint. That weakens the case for adding health in this specific formulation; it does not imply that health has no effect on wellbeing.`;
el('forward-coverage').textContent=`Forward coverage: ${PATHS.future.countries} of 100 countries. Excluded for missing 2025 wellbeing or GDP: ${PATHS.future.exclusions.map(c=>c.name).join(', ')}.`;
el('receipt').textContent=`Protocol committed at d68147b. Code and all five prediction sets frozen at ${PATHS.diagnostic.receipt.preScoreCommit.slice(0,7)}; single score receipt ${PATHS.diagnostic.receipt.createdAt}. Original health-control reconstruction maximum ladder difference ${PATHS.diagnostic.controlReconstruction.ladder.toExponential(2)} points.`;
render();

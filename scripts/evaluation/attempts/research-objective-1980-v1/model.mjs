export const PHI = .95;
export const TARGETS = {
  lifeExpectancy: { indicator: 'SP.DYN.LE00.IN', unit: 'years', valid: x => Number.isFinite(x) && x > 0 && x < 120, transform: x => x },
  gdp: { indicator: 'NY.GDP.PCAP.KD', unit: 'constant-2015 USD per person', valid: x => Number.isFinite(x) && x > 0, transform: Math.log },
};
export function series(raw, target, maxYear = 1980) {
  const map = new Map();
  for (const row of raw) {
    const year = +row.date;
    if (!Number.isInteger(year) || year < 1960 || year > 1980) throw Error('Training window violation');
    if (row.indicator.id !== TARGETS[target].indicator) throw Error('Indicator mismatch');
    if (!row.countryiso3code || year > maxYear || !TARGETS[target].valid(row.value)) continue;
    if (!map.has(row.countryiso3code)) map.set(row.countryiso3code, []);
    const values = map.get(row.countryiso3code);
    if (values.some(x => x.year === year)) throw Error('Duplicate country-year');
    values.push({year, value: row.value});
  }
  for (const values of map.values()) values.sort((a,b)=>a.year-b.year);
  return map;
}
export function eligible(values = [], originYear = 1980) {
  const span = values.length ? values.at(-1).year-values[0].year : 0;
  return { count: values.length, span, origin: values.find(r => r.year === originYear)?.value ?? null, qualified: values.length >= 10 && span >= 10 && values.some(r => r.year === originYear) };
}
export function fit(values, target, originYear = 1980) {
  if (values.some(r => r.year > originYear || r.year < 1960)) throw Error('Fit window violation');
  const info = eligible(values, originYear);
  if (!info.qualified) throw Error('Insufficient historical data');
  const meanX = values.reduce((s,r)=>s+r.year-1960,0)/values.length;
  const meanY = values.reduce((s,r)=>s+TARGETS[target].transform(r.value),0)/values.length;
  const denom = values.reduce((s,r)=>s+(r.year-1960-meanX)**2,0);
  const slope = values.reduce((s,r)=>s+(r.year-1960-meanX)*(TARGETS[target].transform(r.value)-meanY),0)/denom;
  return { target, originYear, originValue: info.origin, count: info.count, span: info.span, firstYear: values[0].year, lastYear: values.at(-1).year, intercept: meanY-slope*meanX, slope, phi: PHI };
}
export function predict(model, horizon) {
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 45) throw Error('Invalid horizon');
  const dampedYears = PHI * (1-PHI**horizon)/(1-PHI);
  const z = TARGETS[model.target].transform(model.originValue)+model.slope*dampedYears;
  const rawPrediction = model.target === 'gdp' ? Math.exp(z) : z;
  const prediction = model.target === 'gdp' ? rawPrediction : Math.max(0,Math.min(120,rawPrediction));
  if (!Number.isFinite(prediction) || (model.target === 'gdp' && prediction <= 0)) throw Error('Nonfinite forecast');
  return {prediction, rawPrediction};
}
export function metric(rows) {
  if (!rows.length) return {n:0,mae:null,rmse:null,bias:null,reason:'No observed rows'};
  return { n:rows.length, mae:rows.reduce((s,r)=>s+Math.abs(r),0)/rows.length, rmse:Math.sqrt(rows.reduce((s,r)=>s+r*r,0)/rows.length), bias:rows.reduce((s,r)=>s+r,0)/rows.length };
}

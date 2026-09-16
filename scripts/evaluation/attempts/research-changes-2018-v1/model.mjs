/** Pure train-only first-difference model. No filesystem, network, or outcome readers. */
export const LAMBDAS = Object.freeze([0.1, 1, 10, 100]);
export const FEATURES = Object.freeze(['deltaLogGdp', 'startLogGdp', 'governance2015', 'giniFraction2010to2015']);
export const FOLDS = Object.freeze([
  { id: 'origin-2016', trainYears: [2015, 2016], originYear: 2016, validationYears: [2017, 2018] },
  { id: 'origin-2017', trainYears: [2015, 2016, 2017], originYear: 2017, validationYears: [2018] },
]);
export const finite = x => typeof x === 'number' && Number.isFinite(x);
const validLadder = x => finite(x) && x >= 0 && x <= 10;
const validGdp = x => finite(x) && x > 0;
const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const median = xs => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n ? (s[Math.floor((n - 1) / 2)] + s[Math.floor(n / 2)]) / 2 : 0.5; };
function checkTrain(train, cutoff) {
  if (![2016, 2017, 2018].includes(cutoff)) throw Error('Unsupported training cutoff');
  if (new Set(train.countries.map(c => c.id)).size !== train.countries.length) throw Error('Duplicate training country');
  for (const c of train.countries) {
    for (const key of ['population', 'ge', 'rl', 'cc']) {
      if (c[key] && c[key].year !== 2015) throw Error(`Future/out-of-window background ${c.id}/${key}`);
    }
    if (c.gini && !(c.gini.year >= 2010 && c.gini.year <= 2015)) throw Error(`Future/out-of-window background ${c.id}/gini`);
  }
}
function staticFeatures(c) {
  return [finite(c.governance) && c.governance >= 0 && c.governance <= 1 ? c.governance : null,
    finite(c.gini?.value) && c.gini.value >= 0 && c.gini.value <= 100 ? c.gini.value / 100 : null];
}
export function transitions(train, cutoff) {
  checkTrain(train, cutoff);
  const ladder = [], gdp = [];
  const missing = [];
  for (const c of train.countries) for (let year = 2016; year <= cutoff; year++) {
    const g0 = train.gdp[c.id]?.[year - 1], g1 = train.gdp[c.id]?.[year];
    const l0 = train.ladder[c.id]?.[year - 1], l1 = train.ladder[c.id]?.[year];
    if (validGdp(g0) && validGdp(g1)) {
      const growth = Math.log(g1 / g0);
      gdp.push({ id: c.id, year, growth });
      if (validLadder(l0) && validLadder(l1)) ladder.push({ id: c.id, year, y: l1 - l0, x: [growth, Math.log(g0), ...staticFeatures(c)] });
      else missing.push({ id: c.id, year, reason: 'Missing/invalid adjacent ladder endpoints' });
    } else missing.push({ id: c.id, year, reason: 'Missing/invalid adjacent GDP endpoints' });
  }
  return { ladder, gdp, missing };
}
/** Pivoted elimination solves a 5x5 positive-definite ridge system. */
export function solve(matrix, vector) {
  const n = vector.length, a = matrix.map((row, i) => [...row, vector[i]]);
  for (let k = 0; k < n; k++) {
    let pivot = k;
    for (let j = k + 1; j < n; j++) if (Math.abs(a[j][k]) > Math.abs(a[pivot][k])) pivot = j;
    [a[k], a[pivot]] = [a[pivot], a[k]];
    if (!finite(a[k][k]) || Math.abs(a[k][k]) < 1e-14) throw Error('Singular/nonfinite ridge system');
    const divisor = a[k][k];
    for (let j = k; j <= n; j++) a[k][j] /= divisor;
    for (let i = 0; i < n; i++) if (i !== k) {
      const scale = a[i][k];
      for (let j = k; j <= n; j++) a[i][j] -= scale * a[k][j];
    }
  }
  return a.map(row => row[n]);
}
export function fit(train, cutoff, lambda) {
  if (!LAMBDAS.includes(lambda)) throw Error('Unregistered ridge penalty');
  const data = transitions(train, cutoff), n = data.ladder.length;
  const medians = FEATURES.map((_, j) => median(data.ladder.map(r => r.x[j]).filter(finite)));
  const imputed = FEATURES.map(() => 0);
  const x = data.ladder.map(r => r.x.map((v, j) => { if (finite(v)) return v; imputed[j]++; return medians[j]; }));
  const means = FEATURES.map((_, j) => mean(x.map(r => r[j])));
  const rawSd = FEATURES.map((_, j) => Math.sqrt(mean(x.map(r => (r[j] - means[j]) ** 2))));
  const scales = rawSd.map(s => s < 1e-12 ? 1 : s);
  const design = x.map(row => [1, ...row.map((v, j) => (v - means[j]) / scales[j])]);
  const matrix = Array.from({ length: 5 }, (_, j) => Array.from({ length: 5 }, (_, k) => (j === k ? lambda : 0) + mean(design.map(row => row[j] * row[k]))));
  const rhs = Array.from({ length: 5 }, (_, j) => mean(design.map((row, i) => row[j] * data.ladder[i].y)));
  const coefficients = n ? solve(matrix, rhs) : [0, 0, 0, 0, 0];
  const pooledGrowth = mean(data.gdp.map(r => r.growth));
  const rates = {}, growthClamps = [], noHistory = [];
  for (const c of train.countries) {
    const history = data.gdp.filter(r => r.id === c.id), count = history.length;
    const countryMean = count ? mean(history.map(r => r.growth)) : null;
    const raw = (count * (countryMean ?? 0) + 2 * pooledGrowth) / (count + 2);
    rates[c.id] = { count, countryMean, raw, rate: clamp(raw, -0.1, 0.1) };
    if (!count) noHistory.push(c.id);
    if (raw !== rates[c.id].rate) growthClamps.push({ id: c.id, side: raw < -0.1 ? 'lower' : 'upper', raw, rate: rates[c.id].rate });
  }
  return {
    schema: 'changes-ridge-calibration/1', cutoff, trainingYears: Array.from({ length: cutoff - 2014 }, (_, i) => 2015 + i), lambda,
    nTransitions: n, missingTransitions: data.missing, features: FEATURES, coefficients,
    normalizer: { medians, means, scales, imputed, zeroVarianceColumns: FEATURES.filter((_, j) => rawSd[j] < 1e-12) },
    gdp: { pseudoObservations: 2, growthClamp: [-0.1, 0.1], nTransitions: data.gdp.length, pooledGrowth, rates, growthClamps, noHistory },
    emptyLadderFallback: n === 0, emptyGdpFallback: data.gdp.length === 0,
  };
}
export function originAt(train, year) {
  checkTrain(train, year);
  const countries = [], excluded = [];
  for (const c of train.countries) {
    const ladder = train.ladder[c.id]?.[year], gdp = train.gdp[c.id]?.[year];
    if (validLadder(ladder) && validGdp(gdp)) countries.push({ ...c, ladder, gdp });
    else excluded.push({ id: c.id, reason: `Missing/invalid paired ${year} origin outcomes` });
  }
  return { originYear: year, countries, excluded };
}
export function predict(origin, calibration, horizons) {
  if (origin.originYear !== calibration.cutoff) throw Error('Origin/calibration boundary mismatch');
  checkTrain({ countries: origin.countries }, origin.originYear);
  if (!Number.isInteger(horizons) || horizons < 1 || horizons > 7) throw Error('Invalid horizon');
  if (new Set(origin.countries.map(c => c.id)).size !== origin.countries.length) throw Error('Duplicate origin country');
  const rows = [], ladderClamps = [], featureImputations = [], gdpFallbacks = [];
  const state = new Map();
  for (const c of origin.countries) {
    if (!validLadder(c.ladder) || !validGdp(c.gdp)) throw Error('Invalid origin outcome');
    const rate = calibration.gdp.rates[c.id]?.rate ?? clamp(calibration.gdp.pooledGrowth, -0.1, 0.1);
    if (!calibration.gdp.rates[c.id] || calibration.gdp.rates[c.id].count === 0) gdpFallbacks.push(c.id);
    state.set(c.id, { ladder: c.ladder, rate });
  }
  for (let h = 1; h <= horizons; h++) for (const c of origin.countries) {
    const s = state.get(c.id);
    const x = [s.rate, Math.log(c.gdp) + (h - 1) * s.rate, ...staticFeatures(c)];
    const z = x.map((v, j) => {
      if (!finite(v)) { featureImputations.push({ id: c.id, horizon: h, feature: FEATURES[j] }); v = calibration.normalizer.medians[j]; }
      return (v - calibration.normalizer.means[j]) / calibration.normalizer.scales[j];
    });
    const delta = calibration.coefficients[0] + z.reduce((v, term, j) => v + term * calibration.coefficients[j + 1], 0);
    const rawLadder = s.ladder + delta, ladder = clamp(rawLadder, 0, 10);
    const gdp = c.gdp * Math.exp(h * s.rate);
    if (!finite(ladder) || !validGdp(gdp)) throw Error('Nonfinite prediction');
    if (ladder !== rawLadder) ladderClamps.push({ id: c.id, horizon: h, year: origin.originYear + h, side: rawLadder < 0 ? 'lower' : 'upper', raw: rawLadder, clamped: ladder });
    s.ladder = ladder;
    rows.push({ id: c.id, name: c.name, year: origin.originYear + h, horizon: h, ladder, gdp, originLadder: c.ladder, originGdp: c.gdp });
  }
  return { rows, diagnostics: { ladderClamps, featureImputations, gdpFallbacks } };
}
const summary = values => values.length ? { n: values.length, mae: mean(values.map(Math.abs)), rmse: Math.sqrt(mean(values.map(x => x * x))), bias: mean(values) } : { n: 0, mae: null, rmse: null, bias: null, reason: 'No observed target rows' };
export function scoreInternal(rows, train) {
  const errors = [], missingTargets = [];
  for (const r of rows) {
    if (r.year < 2017 || r.year > 2018) throw Error('Only 2017/2018 internal scoring is permitted');
    const ladder = train.ladder[r.id]?.[r.year], gdp = train.gdp[r.id]?.[r.year];
    if (validLadder(ladder)) errors.push({ id: r.id, year: r.year, horizon: r.horizon, outcome: 'ladder', model: r.ladder - ladder, persistence: r.originLadder - ladder });
    else missingTargets.push({ id: r.id, year: r.year, outcome: 'ladder' });
    if (validGdp(gdp)) errors.push({ id: r.id, year: r.year, horizon: r.horizon, outcome: 'gdp', model: 100 * (r.gdp - gdp) / r.originGdp, persistence: 100 * (r.originGdp - gdp) / r.originGdp });
    else missingTargets.push({ id: r.id, year: r.year, outcome: 'gdp' });
  }
  return { errors, missingTargets };
}
export function summarizeErrors(errors) {
  const out = {};
  for (const outcome of ['ladder', 'gdp']) {
    const e = errors.filter(r => r.outcome === outcome);
    const model = summary(e.map(r => r.model)), persistence = summary(e.map(r => r.persistence));
    out[outcome] = { model, persistence, deltaMae: model.mae === null ? null : model.mae - persistence.mae };
  }
  return out;
}
export function validate(train) {
  const candidates = LAMBDAS.map(lambda => {
    const folds = FOLDS.map(fold => {
      // Calibration and forecasts complete before any fold target is read by scoreInternal.
      const calibration = fit(train, fold.originYear, lambda);
      const origin = originAt(train, fold.originYear);
      const forecast = predict(origin, calibration, Math.max(...fold.validationYears) - fold.originYear);
      const scored = scoreInternal(forecast.rows, train);
      return { ...fold, originCountries: origin.countries.length, originExcluded: origin.excluded,
        fit: { nTransitions: calibration.nTransitions, coefficients: calibration.coefficients, normalizer: calibration.normalizer,
          gdpTransitions: calibration.gdp.nTransitions, pooledGrowth: calibration.gdp.pooledGrowth, growthClamps: calibration.gdp.growthClamps, noGdpHistory: calibration.gdp.noHistory },
        diagnostics: forecast.diagnostics, missingTargets: scored.missingTargets, metrics: summarizeErrors(scored.errors),
        byHorizon: [...new Set(forecast.rows.map(r => r.horizon))].map(horizon => ({ horizon, ...summarizeErrors(scored.errors.filter(e => e.horizon === horizon)) })),
        predictions: forecast.rows, errors: scored.errors };
    });
    const errors = folds.flatMap(f => f.errors);
    return { lambda, pooled: summarizeErrors(errors), byHorizon: [1, 2].map(horizon => ({ horizon, ...summarizeErrors(errors.filter(e => e.horizon === horizon)) })), folds };
  });
  let selected = candidates.at(-1);
  for (const candidate of candidates) {
    const a = candidate.pooled.ladder.model.mae, b = selected.pooled.ladder.model.mae;
    if (a !== null && (b === null || a < b - 1e-12 || (Math.abs(a - b) <= 1e-12 && candidate.lambda > selected.lambda))) selected = candidate;
  }
  return { schema: 'changes-internal-validation/1', selection: { lambda: selected.lambda, metric: 'Pooled country/fold/horizon ladder MAE', tieTolerance: 1e-12, tiesPrefer: 'larger lambda' },
    warning: 'Tuning evidence from two rolling origins, not an unbiased selected-model accuracy estimate; no seven-year internal horizon exists.', candidates };
}

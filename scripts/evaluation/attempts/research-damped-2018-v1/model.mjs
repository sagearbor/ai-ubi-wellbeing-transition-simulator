/** Pure, dependency-free registered forecasting functions. No file/network readers. */
export const OUTCOMES = ['ladder', 'gdp'];
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const valid = (outcome, value) => Number.isFinite(value) && (outcome === 'gdp' ? value > 0 : value >= 0 && value <= 10);
export function transform(outcome, value) {
  if (!OUTCOMES.includes(outcome) || !valid(outcome, value)) throw Error('Invalid outcome');
  return outcome === 'gdp' ? Math.log(value) : value;
}
export function validateTraining(train) {
  if (JSON.stringify(train.years) !== '[2015,2016,2017,2018]') throw Error('Training-year boundary changed');
  const ids = train.countries.map(country => country.id);
  if (new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string' || !id)) throw Error('Invalid training identifiers');
  for (const outcome of OUTCOMES) for (const [id, byYear] of Object.entries(train[outcome])) {
    if (!ids.includes(id)) throw Error('Outcome outside training roster');
    for (const [year, value] of Object.entries(byYear)) {
      if (!train.years.includes(Number(year)) || !valid(outcome, value)) throw Error('Invalid training value or future year');
    }
  }
}
export function olsSlope(observations) {
  if (observations.length < 2) return null;
  const yearMean = mean(observations.map(o => o.year));
  const valueMean = mean(observations.map(o => o.value));
  const denominator = observations.reduce((sum, o) => sum + (o.year - yearMean) ** 2, 0);
  if (!(denominator > 0)) return null;
  return observations.reduce((sum, o) => sum + (o.year - yearMean) * (o.value - valueMean), 0) / denominator;
}
export function fitOutcome(train, outcome, originYear) {
  if (!OUTCOMES.includes(outcome) || ![2016, 2017, 2018].includes(originYear)) throw Error('Invalid fit request');
  const countries = train.countries.map(country => {
    const observations = train.years.filter(year => year <= originYear && train[outcome][country.id]?.[year] !== undefined)
      .map(year => ({year, value: transform(outcome, train[outcome][country.id][year])}));
    const rawOrigin = train[outcome][country.id]?.[originYear];
    return {id: country.id, observations, n: observations.length, slope: olsSlope(observations), rawOrigin: rawOrigin ?? null,
      transformedOrigin: rawOrigin === undefined ? null : transform(outcome, rawOrigin)};
  });
  const slopes = countries.map(country => country.slope).filter(slope => slope !== null);
  return {outcome, originYear, trainingYears: train.years.filter(year => year <= originYear), pooledSlope: slopes.length ? mean(slopes) : 0,
    pooledSlopeCountryCount: slopes.length, countries};
}
export function dampingSum(phi, horizon) {
  if (!(phi > 0 && phi < 1) || !Number.isInteger(horizon) || horizon < 0) throw Error('Invalid damping/horizon');
  let sum = 0;
  for (let k = 1; k <= horizon; k++) sum += phi ** k;
  return sum;
}
export function forecast(outcome, rawOrigin, slope, pooledSlope, candidate, horizon) {
  const level = transform(outcome, rawOrigin);
  if (!['zero', 'pooled'].includes(candidate.target) || !(candidate.countryWeight >= 0 && candidate.countryWeight <= 1)
    || !Number.isFinite(pooledSlope) || (slope !== null && !Number.isFinite(slope))) throw Error('Invalid calibration');
  const target = candidate.target === 'zero' ? 0 : pooledSlope;
  const shrunkSlope = slope === null ? target : candidate.countryWeight * slope + (1 - candidate.countryWeight) * target;
  const cumulativeDamping = dampingSum(candidate.damping, horizon);
  const rawTransformed = level + cumulativeDamping * shrunkSlope;
  const unclamped = outcome === 'gdp' ? Math.exp(rawTransformed) : rawTransformed;
  const prediction = outcome === 'ladder' ? Math.min(10, Math.max(0, unclamped)) : unclamped;
  if (!Number.isFinite(prediction) || (outcome === 'gdp' && prediction <= 0)) throw Error('Nonfinite/nonpositive forecast');
  return {prediction, unclamped, rawTransformed, shrunkSlope, target, cumulativeDamping, clamped: prediction !== unclamped};
}
export function metrics(records) {
  if (!records.length) return {count: 0, mae: null, rmse: null, bias: null, persistenceMae: null, deltaMae: null, reason: 'No valid origin/target pairs'};
  const errors = records.map(record => record.error);
  const baseline = records.map(record => record.baselineError);
  const mae = mean(errors.map(Math.abs));
  const persistenceMae = mean(baseline.map(Math.abs));
  return {count: records.length, mae, rmse: Math.sqrt(mean(errors.map(error => error ** 2))), bias: mean(errors), persistenceMae, deltaMae: mae - persistenceMae};
}
export function evaluateCandidate(train, outcome, candidate, folds) {
  const records = [], skipped = [], clamps = [], foldFits = [];
  for (const fold of folds) {
    const fit = fitOutcome(train, outcome, fold.originYear);
    if (JSON.stringify(fit.trainingYears) !== JSON.stringify(fold.trainingYears)) throw Error('Fold training-year mismatch');
    foldFits.push({foldId: fold.id, pooledSlope: fit.pooledSlope, pooledSlopeCountryCount: fit.pooledSlopeCountryCount});
    for (const country of fit.countries) for (const year of fold.targetYears) {
      if (!(year > fold.originYear && year <= 2018)) throw Error('Validation outside training boundary');
      const observed = train[outcome][country.id]?.[year];
      if (country.rawOrigin === null || observed === undefined) {
        skipped.push({id: country.id, foldId: fold.id, year, reason: country.rawOrigin === null ? 'Missing internal origin outcome' : 'Missing internal target outcome'});
        continue;
      }
      const horizon = year - fold.originYear;
      const result = forecast(outcome, country.rawOrigin, country.slope, fit.pooledSlope, candidate, horizon);
      const scale = outcome === 'gdp' ? 100 / country.rawOrigin : 1;
      records.push({id: country.id, foldId: fold.id, originYear: fold.originYear, year, horizon,
        error: (result.prediction - observed) * scale, baselineError: (country.rawOrigin - observed) * scale});
      if (result.clamped) clamps.push({id: country.id, foldId: fold.id, year, raw: result.unclamped, clamped: result.prediction});
    }
  }
  return {candidate, pooled: metrics(records), byFold: folds.map(fold => ({foldId: fold.id, ...metrics(records.filter(record => record.foldId === fold.id))})),
    byHorizon: [...new Set(records.map(record => record.horizon))].sort((a, b) => a - b).map(horizon => ({horizon, ...metrics(records.filter(record => record.horizon === horizon))})),
    clampCount: clamps.length, clamps, skipped, foldFits};
}
export function selectCandidate(results) {
  const scored = results.filter(result => result.pooled.mae !== null);
  if (!scored.length) {
    const fallback = results.find(result => result.candidate.id === 'zero-w0-p0.8');
    if (!fallback) throw Error('Persistence fallback missing');
    return fallback;
  }
  const minimum = Math.min(...scored.map(result => result.pooled.mae));
  return scored.filter(result => result.pooled.mae <= minimum + 1e-12).sort((a, b) =>
    a.candidate.countryWeight - b.candidate.countryWeight || (a.candidate.target === 'zero' ? 0 : 1) - (b.candidate.target === 'zero' ? 0 : 1)
    || a.candidate.damping - b.candidate.damping)[0];
}
export function fitAndPredict(train, origin, protocol) {
  validateTraining(train);
  if (origin.originYear !== 2018 || new Set(origin.countries.map(c => c.id)).size !== origin.countries.length) throw Error('Invalid origin');
  if (JSON.stringify(origin.countries.map(c => c.id)) !== JSON.stringify(protocol.cohort.rosterIds)) throw Error('Origin roster drift');
  for (const country of origin.countries) for (const outcome of OUTCOMES) {
    transform(outcome, country[outcome]);
    if (train[outcome][country.id]?.[2018] !== country[outcome]) throw Error('Origin/training mismatch');
  }
  const internalValidation = {schema: 'damped-internal-validation/1',entryId: protocol.id, status: 'training-only-selection-not-external-validation',folds: protocol.validation.folds, outcomes: {}};
  const calibration = {schema: 'damped-calibration/1',entryId: protocol.id, originYear: 2018, outcomes: {}};
  for (const outcome of OUTCOMES) {
    const results = protocol.candidateGrid.candidates.map(candidate => evaluateCandidate(train, outcome, candidate, protocol.validation.folds));
    const selected = selectCandidate(results);
    internalValidation.outcomes[outcome] = {selectedCandidate: selected.candidate, selectedPooledMetrics: selected.pooled,
      lossUnit: outcome === 'ladder' ? 'ladder points' : 'cumulative growth percentage points relative to fold origin GDP', candidates: results};
    calibration.outcomes[outcome] = {...fitOutcome(train, outcome, 2018), selectedCandidate: selected.candidate};
  }
  const rows = [], clamps = [], numericalTrace = [];
  const indexes = Object.fromEntries(OUTCOMES.map(outcome => [outcome, new Map(calibration.outcomes[outcome].countries.map(country => [country.id, country]))]));
  for (const year of protocol.testYears) for (const country of origin.countries) {
    const horizon = year - origin.originYear;
    const values = {};
    for (const outcome of OUTCOMES) {
      const fit = calibration.outcomes[outcome];
      const countryFit = indexes[outcome].get(country.id);
      if (!countryFit) throw Error('Origin country missing training background');
      const result = forecast(outcome, country[outcome], countryFit.slope, fit.pooledSlope, fit.selectedCandidate, horizon);
      values[outcome] = result.prediction;
      numericalTrace.push({id: country.id, year, outcome, ...result});
      if (result.clamped) clamps.push({id: country.id, year, outcome, raw: result.unclamped, clamped: result.prediction});
    }
    rows.push({id: country.id, name: country.name, year, horizon, ladder: values.ladder, gdp: values.gdp, originLadder: country.ladder, originGdp: country.gdp});
  }
  return {predictions: {rows}, calibration, internalValidation, diagnostics: {clampCount: clamps.length, clamps, numericalTrace}};
}

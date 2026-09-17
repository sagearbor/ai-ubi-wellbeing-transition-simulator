/** Research-only pure functions. No I/O, production imports, or future observations. */
export type Panel = Record<string, Record<string, number>>;
export interface Country {
  id: string; name: string; governance: number;
  population?: { value: number; year: number }; gini?: { value: number; year: number };
  ge?: { value: number; year: number }; rl?: { value: number; year: number }; cc?: { value: number; year: number };
}
export interface Training { countries: Country[]; years: number[]; ladder: Panel; gdp: Panel }
export interface OriginCountry extends Country { ladder: number; gdp: number }
export interface Origin { originYear: number; countries: OriginCountry[] }
export interface Prediction {
  id: string; name: string; year: number; horizon: number;
  ladder: number; gdp: number; originLadder: number; originGdp: number;
}
export type GdpMode = 'persistence' | 'pooled' | 'half-local' | 'local';
export interface Setting { gdpMode: GdpMode; offsetWeight: number; annualAdjustment: number }
export const GDP_MODES: GdpMode[] = ['persistence', 'pooled', 'half-local', 'local'];
export const LADDER_SETTINGS = [1, .5, 0].flatMap(offsetWeight =>
  [0, .1, .25, 1].map(annualAdjustment => ({ offsetWeight, annualAdjustment })));
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const validPair = (train: Training, id: string, year: number) =>
  finite(train.ladder[id]?.[year]) && finite(train.gdp[id]?.[year]);

export function validateTraining(train: Training): void {
  if (!train.years.length || new Set(train.years).size !== train.years.length ||
      train.years.some(y => !Number.isInteger(y) || y < 2015 || y > 2018))
    throw new Error('Training years outside registered boundary');
  const ids = new Set(train.countries.map(c => c.id));
  if (!ids.size || ids.size !== train.countries.length) throw new Error('Duplicate/empty training countries');
  for (const c of train.countries) {
    if (!finite(c.governance) || c.governance < 0 || c.governance > 1)
      throw new Error('Invalid historical governance');
    for (const key of ['population', 'gini', 'ge', 'rl', 'cc'] as const) {
      const observation = c[key];
      if (observation && (!finite(observation.value) || !Number.isInteger(observation.year) ||
          observation.year > 2015 || observation.year < (key === 'gini' ? 2010 : 2015)))
        throw new Error('Invalid or future historical background');
    }
  }
  for (const [key, panel] of Object.entries({ ladder: train.ladder, gdp: train.gdp }))
    for (const [id, series] of Object.entries(panel))
      for (const [year, value] of Object.entries(series))
        if (!ids.has(id) || !train.years.includes(Number(year)) || !finite(value) ||
            (key === 'gdp' ? value <= 0 : value < 0 || value > 10))
          throw new Error('Invalid or future training observation');
}

/** A fold cannot retain any later observation, even if a caller supplies one. */
export function trainingThrough(train: Training, year: number): Training {
  validateTraining(train);
  const years = train.years.filter(y => y <= year);
  const cut = (panel: Panel): Panel => Object.fromEntries(Object.entries(panel).map(([id, row]) =>
    [id, Object.fromEntries(Object.entries(row).filter(([y]) => years.includes(Number(y))))]));
  return { countries: train.countries.map(c => ({ ...c })), years, ladder: cut(train.ladder), gdp: cut(train.gdp) };
}

function solve(a: number[][], b: number[]): number[] | null {
  const m = a.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < b.length; i++) {
    let pivot = i;
    for (let j = i + 1; j < b.length; j++) if (Math.abs(m[j][i]) > Math.abs(m[pivot][i])) pivot = j;
    [m[i], m[pivot]] = [m[pivot], m[i]];
    if (Math.abs(m[i][i]) < 1e-12) return null;
    for (let j = 0; j < b.length; j++) if (j !== i) {
      const factor = m[j][i] / m[i][i];
      for (let k = i; k <= b.length; k++) m[j][k] -= factor * m[i][k];
    }
  }
  return m.map((row, i) => row[b.length] / row[i]);
}

export function fitTraining(train: Training) {
  validateTraining(train);
  const observations = train.countries.flatMap(c => train.years.filter(y => validPair(train, c.id, y))
    .map(year => ({ id: c.id, year, x: Math.log(train.gdp[c.id][year]), y: train.ladder[c.id][year], governance: c.governance })));
  if (!observations.length) throw new Error('No paired training rows');
  const xtx = Array.from({ length: 3 }, () => [0, 0, 0]), xty = [0, 0, 0];
  for (const row of observations) {
    const x = [1, row.x, row.governance];
    for (let j = 0; j < 3; j++) {
      xty[j] += x[j] * row.y;
      for (let k = 0; k < 3; k++) xtx[j][k] += x[j] * x[k];
    }
  }
  const solved = solve(xtx, xty);
  const [intercept, lnGdp, governance] = solved ?? [mean(observations.map(r => r.y)), 0, 0];
  let numerator = 0, denominator = 0;
  const localRates: Record<string, number | null> = {}, transitions: number[] = [];
  const perCountry: Record<string, { pairedYears: number[]; meanLogGdp: number; meanLadder: number; meanAnchorResidual: number }> = {};
  const residualPairs: number[][] = [];
  const anchor = (r: typeof observations[number]) => intercept + lnGdp * r.x + governance * r.governance;
  for (const c of train.countries) {
    const rows = observations.filter(r => r.id === c.id).sort((a, b) => a.year - b.year);
    if (!rows.length) { localRates[c.id] = null; continue; }
    const mx = mean(rows.map(r => r.x)), my = mean(rows.map(r => r.y));
    for (const row of rows) { numerator += (row.x - mx) * (row.y - my); denominator += (row.x - mx) ** 2; }
    const rates: number[] = [];
    for (let i = 1; i < rows.length; i++) if (rows[i].year === rows[i - 1].year + 1) {
      rates.push(rows[i].x - rows[i - 1].x);
      residualPairs.push([rows[i - 1].y - anchor(rows[i - 1]), rows[i].y - anchor(rows[i])]);
    }
    localRates[c.id] = rates.length ? mean(rates) : null;
    transitions.push(...rates);
    perCountry[c.id] = { pairedYears: rows.map(r => r.year), meanLogGdp: mx, meanLadder: my,
      meanAnchorResidual: mean(rows.map(r => r.y - anchor(r))) };
  }
  let residualLagCorrelation: number | null = null;
  if (residualPairs.length > 1) {
    const mx = mean(residualPairs.map(r => r[0])), my = mean(residualPairs.map(r => r[1]));
    const covariance = residualPairs.reduce((s, r) => s + (r[0] - mx) * (r[1] - my), 0);
    const vx = residualPairs.reduce((s, r) => s + (r[0] - mx) ** 2, 0);
    const vy = residualPairs.reduce((s, r) => s + (r[1] - my) ** 2, 0);
    if (vx * vy > 0) residualLagCorrelation = covariance / Math.sqrt(vx * vy);
  }
  const coefficients = { intercept, lnGdp, governance, withinLnGdp: denominator <= 1e-12 ? 0 : numerator / denominator };
  if (!Object.values(coefficients).every(Number.isFinite)) throw new Error('Nonfinite fitted coefficient');
  return {
    years: [...train.years], rows: observations.length, coefficients, pooledAnchorFallback: !solved,
    withinSlopeFallback: denominator <= 1e-12, withinLogGdpSumSquares: denominator,
    pooledRate: transitions.length ? mean(transitions) : 0, localRates, perCountry,
    diagnostics: { residualLagCorrelation, residualLagPairs: residualPairs.length,
      warning: 'Descriptive within-training residual correlation; pooled coefficients use all training years. Not causal, independent validation, or evidence of equilibrium.' }
  };
}
export type Calibration = ReturnType<typeof fitTraining>;

export function foldOrigin(train: Training, year: number): Origin {
  if (train.years.some(y => y > year)) throw new Error('Fold origin contains later training years');
  return { originYear: year, countries: train.countries.filter(c => validPair(train, c.id, year))
    .map(c => ({ ...c, ladder: train.ladder[c.id][year], gdp: train.gdp[c.id][year] })) };
}

export function forecast(origin: Origin, fit: Calibration, setting: Setting, horizon: number) {
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 7 || !GDP_MODES.includes(setting.gdpMode) ||
      ![1, .5, 0].includes(setting.offsetWeight) || ![0, .1, .25, 1].includes(setting.annualAdjustment))
    throw new Error('Unregistered forecast setting');
  if (fit.years.some(y => y > origin.originYear) || !origin.countries.length ||
      new Set(origin.countries.map(c => c.id)).size !== origin.countries.length)
    throw new Error('Future fit or invalid origin');
  const rows: Prediction[] = [], rates: Record<string, { raw: number; used: number; localFallback: boolean }> = {};
  const countryOffsets: Record<string, number> = {};
  let rateCaps = 0, ladderLowCaps = 0, ladderHighCaps = 0;
  const rawLadders: number[] = [];
  for (const c of origin.countries) {
    if (!finite(c.ladder) || c.ladder < 0 || c.ladder > 10 || !finite(c.gdp) || c.gdp <= 0 || !finite(c.governance))
      throw new Error('Invalid origin observation');
    const local = fit.localRates[c.id] ?? fit.pooledRate;
    const raw = setting.gdpMode === 'persistence' ? 0 : setting.gdpMode === 'pooled' ? fit.pooledRate :
      setting.gdpMode === 'half-local' ? .5 * local + .5 * fit.pooledRate : local;
    const used = clamp(raw, -.1, .1);
    if (!finite(raw) || !finite(used)) throw new Error('Nonfinite GDP rate');
    rateCaps += Number(raw !== used);
    rates[c.id] = { raw, used, localFallback: fit.localRates[c.id] == null };
    const anchor = fit.coefficients.intercept + fit.coefficients.lnGdp * Math.log(c.gdp) + fit.coefficients.governance * c.governance;
    countryOffsets[c.id] = c.ladder - anchor;
    let ladder = c.ladder, growth = 0;
    for (let h = 1; h <= horizon; h++) {
      growth += used * .9 ** (h - 1);
      const gdp = c.gdp * Math.exp(growth);
      const target = anchor + setting.offsetWeight * countryOffsets[c.id] + fit.coefficients.withinLnGdp * growth;
      const rawLadder = (1 - setting.annualAdjustment) * ladder + setting.annualAdjustment * target;
      if (!finite(rawLadder) || !finite(gdp) || gdp <= 0) throw new Error('Nonfinite forecast');
      rawLadders.push(rawLadder);
      ladderLowCaps += Number(rawLadder < 0); ladderHighCaps += Number(rawLadder > 10);
      ladder = clamp(rawLadder, 0, 10);
      rows.push({ id: c.id, name: c.name, year: origin.originYear + h, horizon: h, ladder, gdp,
        originLadder: c.ladder, originGdp: c.gdp });
    }
  }
  const order = new Map(origin.countries.map((c, i) => [c.id, i]));
  rows.sort((a, b) => a.year - b.year || order.get(a.id)! - order.get(b.id)!);
  const range = (xs: number[]) => ({ min: Math.min(...xs), max: Math.max(...xs) });
  return { rows, rates, countryOffsets, diagnostics: { rateCaps, ladderLowCaps, ladderHighCaps,
    rawLadderRange: range(rawLadders), ladderRange: range(rows.map(r => r.ladder)), gdpRange: range(rows.map(r => r.gdp)) } };
}

function errors(rows: Prediction[], truth: Training, key: 'ladder' | 'gdp') {
  return rows.flatMap(p => {
    const actual = truth[key][p.id]?.[p.year];
    if (!finite(actual)) return [];
    const multiplier = key === 'gdp' ? 100 / p.originGdp : 1;
    const baseline = key === 'gdp' ? p.originGdp : p.originLadder;
    return [{ id: p.id, year: p.year, horizon: p.horizon, error: (p[key] - actual) * multiplier,
      persistenceError: (baseline - actual) * multiplier }];
  });
}
function summarize(rows: ReturnType<typeof errors>) {
  const metric = (rs: typeof rows) => ({ n: rs.length, mae: mean(rs.map(r => Math.abs(r.error))),
    rmse: Math.sqrt(mean(rs.map(r => r.error ** 2))), bias: mean(rs.map(r => r.error)),
    persistenceMae: mean(rs.map(r => Math.abs(r.persistenceError))) });
  const byHorizon = [1, 2].map(horizon => {
    const matched = rows.filter(r => r.horizon === horizon);
    if (!matched.length) throw new Error('Empty registered internal horizon');
    return { horizon, ...metric(matched) };
  });
  return { selectionLoss: mean(byHorizon.map(r => r.mae)), byHorizon, pooled: metric(rows) };
}
/** Two-stage registration: GDP loss chooses GDP mode; ladder loss then chooses offset/adjustment. */
export function internalValidation(train: Training) {
  validateTraining(train);
  const folds = [2016, 2017].map(year => {
    const training = trainingThrough(train, year), origin = foldOrigin(training, year), fit = fitTraining(training);
    return { training, origin, fit, horizon: 2018 - year };
  });
  const gdpCandidates = GDP_MODES.map(gdpMode => {
    const predictions = folds.map(f => forecast(f.origin, f.fit,
      { gdpMode, offsetWeight: 1, annualAdjustment: 0 }, f.horizon));
    const predicted = predictions.flatMap(p => p.rows);
    return { gdpMode, ...summarize(errors(predicted, train, 'gdp')),
      diagnostics: predictions.map(p => p.diagnostics) };
  });
  const choose = <T extends { selectionLoss: number }>(candidates: T[]) => candidates.reduce((best, c) =>
    c.selectionLoss < best.selectionLoss - 1e-12 ? c : best);
  const gdpMode = choose(gdpCandidates).gdpMode;
  const ladderCandidates = LADDER_SETTINGS.map(setting => {
    const predictions = folds.map(f => forecast(f.origin, f.fit, { ...setting, gdpMode }, f.horizon));
    const predicted = predictions.flatMap(p => p.rows);
    return { ...setting, ...summarize(errors(predicted, train, 'ladder')),
      diagnostics: predictions.map(p => p.diagnostics) };
  });
  const selected = choose(ladderCandidates);
  const selectedSetting: Setting = { gdpMode, offsetWeight: selected.offsetWeight, annualAdjustment: selected.annualAdjustment };
  const foldRecords = folds.map(f => {
    const predicted = forecast(f.origin, f.fit, selectedSetting, f.horizon);
    return { originYear: f.origin.originYear, trainingYears: f.training.years, trainingRows: f.fit.rows,
      originCountries: f.origin.countries.map(c => c.id), coefficients: f.fit.coefficients,
      pooledRate: f.fit.pooledRate, pooledAnchorFallback: f.fit.pooledAnchorFallback,
      withinSlopeFallback: f.fit.withinSlopeFallback, diagnostics: predicted.diagnostics,
      matchedLadder: errors(predicted.rows, train, 'ladder'), matchedGdp: errors(predicted.rows, train, 'gdp'),
      unscored: predicted.rows.flatMap(p => (['ladder', 'gdp'] as const).filter(key => !finite(train[key][p.id]?.[p.year]))
        .map(outcome => ({ id: p.id, year: p.year, outcome, reason: 'No observed internal target' }))) };
  });
  return { selectedSetting, gdpCandidates, ladderCandidates, folds: foldRecords,
    warning: 'Selected internal performance is optimistic after selection; overlapping country/2018 targets, maximum two-year horizon. No external scoring.' };
}

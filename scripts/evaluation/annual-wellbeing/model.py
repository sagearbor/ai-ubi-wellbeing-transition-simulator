"""Fixed annual wellbeing candidates. No evaluation or I/O in this module."""
import math
import numpy as np

FEATURES = ('log_gdp', 'life_expectancy', 'unemployment')
CANDIDATES = ('change_ridge', 'country_offset', 'residual_carry', 'shrinkage_change')
BASELINES = ('persistence', 'damped_trend')
METHODS = CANDIDATES + BASELINES
TOLERANCE = 1e-9
PRESELECTED = ('USA', 'IND', 'DEU', 'GBR', 'BRA', 'JPN', 'ZAF', 'CHN')


def full(row):
    return row is not None and row.get('y') is not None and all(row.get('x', {}).get(k) is not None for k in FEATURES)


def xvector(row):
    return np.array([row['x'][k] for k in FEATURES], dtype=float)


def ridge(X, y, intercept=True):
    X, y = np.asarray(X, dtype=float), np.asarray(y, dtype=float)
    if len(X) == 0:
        raise ValueError('No training rows')
    center = X.mean(axis=0) if intercept else np.zeros(X.shape[1])
    scale = np.maximum(X.std(axis=0), 1e-12)
    z = (X - center) / scale
    ym = float(y.mean()) if intercept else 0.
    b = np.linalg.solve(z.T @ z + 10 * np.eye(z.shape[1]), z.T @ (y - ym)) / scale
    a = ym - float(center @ b)
    return a, b


def fit(panel, cutoff, eligible):
    """Fit only rows dated through cutoff; offsets are training-only country means."""
    history = [r for r in panel if r['id'] in eligible and 2005 <= r['year'] <= cutoff and full(r)]
    index = {(r['id'], r['year']): r for r in history}
    grouped = {}
    for r in history:
        grouped.setdefault(r['id'], []).append(r)
    DX, DY, centeredX, centeredY = [], [], [], []
    means = {}
    for country, rows in grouped.items():
        mx = np.mean([xvector(r) for r in rows], axis=0)
        my = float(np.mean([r['y'] for r in rows]))
        means[country] = (mx, my)
        for r in rows:
            centeredX.append(xvector(r) - mx)
            centeredY.append(r['y'] - my)
            p, pp = index.get((country, r['year']-1)), index.get((country, r['year']-2))
            if p is not None and pp is not None:
                DX.append(np.r_[xvector(r)-xvector(p), p['y']-pp['y']])
                DY.append(r['y']-p['y'])
    _, level_b = ridge(centeredX, centeredY, intercept=False)
    change_a, change_b = ridge(DX, DY)
    offsets = {c: my-float(mx @ level_b) for c, (mx, my) in means.items()}
    return {'cutoff': cutoff, 'level_b': level_b, 'change_a': change_a, 'change_b': change_b,
            'offsets': offsets, 'trainingLevelRows': len(history), 'trainingChangeRows': len(DX),
            'maxTrainingYear': max(r['year'] for r in history)}


def predict(fitted, previous, previous2, target_features):
    """No target-year ladder argument exists. Both previous years must be contiguous."""
    assert previous['year'] == previous2['year'] + 1
    assert previous['id'] == previous2['id']
    assert fitted['cutoff'] <= previous['year']
    x = np.array([target_features[k] for k in FEATURES], dtype=float)
    lagx = xvector(previous)
    lagy, lagdy = previous['y'], previous['y'] - previous2['y']
    dy = fitted['change_a'] + float(np.r_[x-lagx, lagdy] @ fitted['change_b'])
    lev = fitted['offsets'][previous['id']] + float(x @ fitted['level_b'])
    laglev = fitted['offsets'][previous['id']] + float(lagx @ fitted['level_b'])
    raw = {'change_ridge': lagy+dy, 'country_offset': lev,
           'residual_carry': lev+0.5*(lagy-laglev), 'shrinkage_change': lagy+0.5*dy,
           'persistence': lagy, 'damped_trend': lagy+0.5*lagdy}
    return {k: min(10., max(0., float(v))) for k, v in raw.items()}


def cohort(panel):
    counts = {}
    for r in panel:
        if 2005 <= r['year'] <= 2016 and full(r):
            counts[r['id']] = counts.get(r['id'], 0)+1
    return sorted(c for c, n in counts.items() if n >= 5)


def generate(panel):
    """Return predictions first. Targets are attached only after prediction calculation."""
    eligible = cohort(panel)
    idx = {(r['id'], r['year']): r for r in panel}
    if len(idx) != len(panel):
        raise ValueError('Duplicate country-year')
    fits = {2016: fit(panel, 2016, eligible)}
    result = []
    for target in sorted(panel, key=lambda r: (r['year'], r['id'])):
        year, country = target['year'], target['id']
        if year < 2017 or country not in eligible or target.get('y') is None:
            continue
        previous, previous2 = idx.get((country, year-1)), idx.get((country, year-2))
        if not full(previous) or not full(previous2):
            continue
        origin = year-1
        for mode in ('conditional', 'rolling'):
            if mode == 'conditional' and not full(target):
                continue
            cutoff = 2016 if mode == 'conditional' else origin
            if cutoff not in fits:
                fits[cutoff] = fit(panel, cutoff, eligible)
            current = target['x'] if mode == 'conditional' else {
                k: previous['x'][k]+0.5*(previous['x'][k]-previous2['x'][k]) for k in FEATURES}
            predictions = predict(fits[cutoff], previous, previous2, current)
            result.append({'id': country, 'year': year, 'origin': origin, 'fitCutoff': cutoff,
              'featureMaxYear': year if mode == 'conditional' else origin,
              'featureAvailability': 'realized target-year annual drivers (conditional oracle)' if mode == 'conditional' else 'projected from annual drivers dated at or before origin; release-date vintage unavailable',
              'horizon': 1, 'mode': mode, 'observed': target['y'], 'previousObserved': previous['y'],
              'observedChange': target['y']-previous['y'], 'predictions': predictions,
              'predictedChanges': {k: v-previous['y'] for k,v in predictions.items()},
              'trainingLevelRows': fits[cutoff]['trainingLevelRows'], 'trainingChangeRows': fits[cutoff]['trainingChangeRows']})
    return result, eligible


def sign(value):
    return 0 if abs(value) <= TOLERANCE else (1 if value > 0 else -1)


def binomial_two_sided(wins, losses):
    n = wins+losses
    return min(1., 2*sum(math.comb(n,k) for k in range(min(wins,losses)+1)) / 2**n) if n else None


def metrics(rows, method):
    if not rows:
        return {'n': 0}
    actual = np.array([r['observed'] for r in rows])
    pred = np.array([r['predictions'][method] for r in rows])
    previous = np.array([r['previousObserved'] for r in rows])
    err, base = np.abs(pred-actual), np.abs(previous-actual)
    change, predchange = actual-previous, pred-previous
    signs = [sign(v) for v in change]
    psigns = [sign(v) for v in predchange]
    nonzero = [i for i,s in enumerate(signs) if s]
    called = [i for i in nonzero if psigns[i]]
    wins = int(np.sum(err < base-TOLERANCE))
    losses = int(np.sum(err > base+TOLERANCE))
    return {'n': len(rows), 'levelMAE': float(err.mean()), 'changeMAE': float(np.abs(predchange-change).mean()),
      'rmse': float(np.sqrt(np.mean((pred-actual)**2))), 'meanSignedError': float((pred-actual).mean()),
      'persistenceMAE': float(base.mean()), 'percentMAEReductionVsPersistence': float(100*(1-err.mean()/base.mean())) if base.mean() else None,
      'directionAccuracy': sum(a==b for a,b in zip(signs,psigns))/len(rows), 'directionDenominator': len(rows),
      'observedMoves': len(nonzero), 'observedTies': len(rows)-len(nonzero),
      'moveDirectionAccuracy': sum(signs[i]==psigns[i] for i in nonzero)/len(nonzero) if nonzero else None,
      'directionCallsOnMoves': len(called), 'directionCoverageOnMoves': len(called)/len(nonzero) if nonzero else None,
      'directionAccuracyWhenCalled': sum(signs[i]==psigns[i] for i in called)/len(called) if called else None,
      'changeCorrelation': float(np.corrcoef(change,predchange)[0,1]) if len(rows)>1 and np.std(change)>TOLERANCE and np.std(predchange)>TOLERANCE else None,
      'absoluteErrorWinsVsPersistence': wins, 'absoluteErrorLossesVsPersistence': losses,
      'absoluteErrorTiesVsPersistence': len(rows)-wins-losses,
      'pairedErrorSignTestNominalP': binomial_two_sided(wins,losses),
      'nominalPWarning':'Descriptive only; repeated-country and serial dependence are ignored.'}

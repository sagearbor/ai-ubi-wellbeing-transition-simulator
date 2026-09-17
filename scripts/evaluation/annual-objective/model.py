"""Fixed annual forecasts; only exact trailing histories can enter the fit."""
import math
import numpy as np

METHODS = ("persistence", "damped_trend", "target_shrinkage", "ridge_changes")
TARGETS = {
    "gdp": {"indicator": "NY.GDP.PCAP.KD", "unit": "constant 2015 USD per person", "scoringUnit": "percentage points of origin GDP"},
    "unemployment": {"indicator": "SL.UEM.TOTL.ZS", "unit": "percent of labor force", "scoringUnit": "percentage points"},
    "life_expectancy": {"indicator": "SP.DYN.LE00.IN", "unit": "years", "scoringUnit": "years"},
}


def valid(value, target):
    if value is None or not isinstance(value, (int, float)) or not math.isfinite(value):
        return False
    if target == "gdp":
        return value > 0
    return 0 <= value <= (100 if target == "unemployment" else 120)


def forecast(values, origin, horizon, target):
    """Return all candidates or None; future values are never consulted."""
    if target not in TARGETS or horizon not in (1, 5):
        raise ValueError("Unknown target or unregistered horizon")
    history = [values.get(year) for year in range(origin - 19, origin + 1)]
    if not all(valid(value, target) for value in history):
        return None
    levels = np.asarray(history, dtype=float)
    z = np.log(levels) if target == "gdp" else levels.copy()
    d = np.diff(z)
    x_time = np.arange(10, dtype=float) - 4.5
    slope = float(np.dot(x_time, z[-10:]) / np.dot(x_time, x_time))
    damp = lambda phi: sum(phi ** k for k in range(1, horizon + 1))
    transformed = {"persistence": float(z[-1]), "damped_trend": float(z[-1] + slope * damp(0.9))}
    if target == "gdp":
        growth = (5 * float(np.mean(d[-5:])) + 10 * float(np.mean(d))) / 15
        transformed["target_shrinkage"] = float(z[-1] + growth * damp(0.95))
    elif target == "life_expectancy":
        transformed["target_shrinkage"] = float(z[-1] + 0.75 * slope * damp(0.95))
    else:
        mean = float(np.mean(z))
        x, y = z[:-1] - mean, z[1:] - mean
        penalty = 10 * float(np.mean(x * x))
        denominator = float(np.dot(x, x)) + penalty
        phi = (float(np.dot(x, y)) + 0.8 * penalty) / denominator if denominator else 0.8
        phi = min(0.98, max(0.0, phi))
        transformed["target_shrinkage"] = mean + phi ** horizon * (float(z[-1]) - mean)
    x, y = d[:-1], d[1:]
    xc, yc = x - np.mean(x), y - np.mean(y)
    denominator = float(np.dot(xc, xc)) + 10 * float(np.var(d))
    phi = float(np.dot(xc, yc)) / denominator if denominator > 0 else 0.0
    phi = min(0.8, max(-0.8, phi))
    intercept = len(y) / (len(y) + 10) * float(np.mean(y)) - phi * float(np.mean(x))
    level, delta = float(z[-1]), float(d[-1])
    for _ in range(horizon):
        delta = intercept + phi * delta
        level += delta
    transformed["ridge_changes"] = level
    results = {}
    for method in METHODS:
        raw = math.exp(transformed[method]) if target == "gdp" else transformed[method]
        # Exact persistence avoids numerical exp(log(origin)) tie artifacts.
        if method == "persistence":
            raw = float(levels[-1])
        prediction = raw if target == "gdp" else min(100 if target == "unemployment" else 120, max(0, raw))
        if not math.isfinite(prediction):
            raise ValueError("Nonfinite prediction; retain failure instead of dropping difficult rows")
        results[method] = {"prediction": prediction, "rawPrediction": raw}
    return results


def score_rows(rows, target):
    """Describe matched errors; GDP normalization is always origin based."""
    scored = [r for r in rows if r["actual"] is not None]
    errors, raw_errors, baseline, directions = [], [], [], []
    actual_ties = predicted_ties = 0
    for r in scored:
        scale = 100 / r["originValue"] if target == "gdp" else 1.0
        errors.append(abs((r["prediction"] - r["actual"]) * scale))
        raw_errors.append(abs(r["prediction"] - r["actual"]))
        baseline.append(abs((r["originValue"] - r["actual"]) * scale))
        actual_change = (r["actual"] - r["originValue"]) * scale
        predicted_change = (r["prediction"] - r["originValue"]) * scale
        if abs(actual_change) <= 1e-12:
            actual_ties += 1
        else:
            tie = abs(predicted_change) <= 1e-12
            predicted_ties += int(tie)
            directions.append(not tie and actual_change * predicted_change > 0)
    mean = lambda xs: sum(xs) / len(xs) if xs else None
    mae, base = mean(errors), mean(baseline)
    return {"n": len(scored), "countries": len({r["country"] for r in scored}),
            "missingOutcomes": len(rows) - len(scored), "mae": mae, "changeMAE": mae,
            "rawUnitMAE": mean(raw_errors), "baselineMAE": base,
            "skill": 1 - mae / base if base else None,
            "directionAccuracy": mean(directions), "directionDenominator": len(directions),
            "actualTiesExcluded": actual_ties, "predictedTiesOnNonzeroActual": predicted_ties,
            "unit": TARGETS[target]["scoringUnit"], "rawUnit": TARGETS[target]["unit"]}

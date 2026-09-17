"""Run the single registered comparison on pinned official responses.

This refuses to overwrite the receipt or output. Publication includes every fixed
method; paths with unobserved endpoints remain available, explicitly unscored.
"""
from collections import defaultdict, Counter
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

from model import METHODS, TARGETS, forecast, score_rows, valid

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "data/evaluation/annual-objective-20260917"
YEARS = range(1960, 2026)
EXAMPLES = ("USA", "IND", "DEU", "GBR", "BRA", "JPN", "ZAF", "CHN")


def write(path, value, compact=False):
    with path.open("x") as output:
        json.dump(value, output, indent=None if compact else 2,
                  separators=(",", ":") if compact else None, allow_nan=False)
        output.write("\n")


def checked_payload(path):
    metadata, rows = json.loads(path.read_text())
    if int(metadata["pages"]) != 1 or int(metadata["total"]) != len(rows):
        raise ValueError(f"Incomplete response: {path}")
    return rows


def load_sources():
    provenance = json.loads((OUT / "provenance.json").read_text())
    for source in provenance["sources"]:
        if hashlib.sha256((OUT / "raw" / source["file"]).read_bytes()).hexdigest() != source["sha256"]:
            raise ValueError(f"Source hash mismatch: {source['file']}")
    metadata = checked_payload(OUT / "raw/countries.json")
    countries = {r["id"]: r for r in metadata if r["id"] and r["region"]["value"] != "Aggregates"}
    excluded = [{"country": r["id"], "name": r["name"], "reason": "official aggregate"}
                for r in metadata if r["region"]["value"] == "Aggregates"]
    panels, unmapped = {}, Counter()
    for target, spec in TARGETS.items():
        panel = {country: {} for country in countries}
        for r in checked_payload(OUT / "raw" / f"{spec['indicator']}-1960-2025.json"):
            if r["indicator"]["id"] != spec["indicator"] or int(r["date"]) not in YEARS:
                raise ValueError("Unexpected target or source year")
            country, year = r["countryiso3code"], int(r["date"])
            if country not in countries:
                unmapped[(country, r["country"]["value"])] += 1
                continue
            if year in panel[country]:
                raise ValueError(f"Duplicate country-target-year: {country}/{target}/{year}")
            panel[country][year] = r["value"]
        panels[target] = panel
    return countries, excluded, panels, [{"country": c, "name": n, "rows": count} for (c, n), count in sorted(unmapped.items())]


def build_paths(countries, panels):
    observations, predictions, coverage = [], [], []
    for target, spec in TARGETS.items():
        for country, meta in sorted(countries.items()):
            values = panels[target][country]
            observed = [year for year in YEARS if values.get(year) is not None]
            invalid = [year for year in observed if not valid(values[year], target)]
            if invalid:
                raise ValueError(f"Invalid observed source levels {country}/{target}: {invalid}")
            for year in YEARS:
                value = values.get(year)
                observation = {"country": country, "name": meta["name"], "target": target,
                               "unit": spec["unit"], "year": year, "value": value}
                if value is None:
                    observation["missingReason"] = "source-null" if year in values else "absent-source-row"
                observations.append(observation)
            eligible, skipped, missing_outcomes, clips = Counter(), Counter(), Counter(), Counter()
            for origin in range(1979, 2025):
                for horizon in (1, 5):
                    year = origin + horizon
                    if year > 2025:
                        continue
                    fitted = forecast(values, origin, horizon, target)
                    if fitted is None:
                        skipped[horizon] += 1
                        continue
                    eligible[horizon] += 1
                    actual = values.get(year)
                    if actual is None:
                        missing_outcomes[horizon] += 1
                    origin_value = values[origin]
                    scale = 100 / origin_value if target == "gdp" else 1.0
                    actual_change = (actual - origin_value) * scale if actual is not None else None
                    for method in METHODS:
                        result = fitted[method]
                        if result["prediction"] != result["rawPrediction"]:
                            clips[method] += 1
                        predictions.append({"country": country, "target": target, "unit": spec["unit"],
                                            "year": year, "originYear": origin, "trainingStart": origin - 19,
                                            "trainingCutoff": origin, "horizon": horizon, "method": method,
                                            "mode": "rolling-origin", "originValue": origin_value,
                                            **result, "actual": actual, "actualChange": actual_change,
                                            "predictedChange": (result["prediction"] - origin_value) * scale})
            coverage.append({"country": country, "name": meta["name"], "target": target,
                             "observedYears": len(observed), "firstObservedYear": min(observed) if observed else None,
                             "lastObservedYear": max(observed) if observed else None,
                             "missingYears": [year for year in YEARS if values.get(year) is None],
                             "eligibleOriginsByHorizon": dict(eligible), "skippedOriginsMissingHistoryByHorizon": dict(skipped),
                             "missingOutcomesByHorizon": dict(missing_outcomes), "boundedPredictionsByMethod": dict(clips)})
    return observations, predictions, coverage


def summarize(predictions):
    pooled_groups, country_groups, annual_groups = defaultdict(list), defaultdict(list), defaultdict(list)
    for r in predictions:
        key = (r["target"], r["horizon"], r["method"])
        pooled_groups[key].append(r)
        country_groups[(*key, r["country"])].append(r)
        annual_groups[(*key, r["year"])].append(r)
    country_rows, annual_rows, pooled = [], [], []
    for (target, horizon, method, country), rows in sorted(country_groups.items()):
        country_rows.append({"target": target, "horizon": horizon, "method": method, "country": country, **score_rows(rows, target)})
    for (target, horizon, method, year), rows in sorted(annual_groups.items()):
        annual_rows.append({"target": target, "horizon": horizon, "method": method, "year": year, **score_rows(rows, target)})
    for (target, horizon, method), rows in sorted(pooled_groups.items()):
        stats = score_rows(rows, target)
        subset = [r for r in country_rows if (r["target"], r["horizon"], r["method"]) == (target, horizon, method) and r["n"]]
        equal_mae = sum(r["mae"] for r in subset) / len(subset) if subset else None
        equal_base = sum(r["baselineMAE"] for r in subset) / len(subset) if subset else None
        pooled.append({"target": target, "horizon": horizon, "method": method, **stats,
                       "countryEqualMAE": equal_mae, "countryEqualBaselineMAE": equal_base,
                       "countryEqualSkill": 1 - equal_mae / equal_base if equal_base else None,
                       "countriesBeatingPersistence": sum(r["mae"] < r["baselineMAE"] - 1e-12 for r in subset),
                       "countriesWorseThanPersistence": sum(r["mae"] > r["baselineMAE"] + 1e-12 for r in subset),
                       "countriesTyingPersistence": sum(abs(r["mae"] - r["baselineMAE"]) <= 1e-12 for r in subset),
                       "targetYears": sorted({r["year"] for r in rows if r["actual"] is not None})})
    return {"schema": "annual-objective-metrics/1", "pooled": pooled, "countries": country_rows, "annual": annual_rows,
            "interpretation": "Positive skill improves on persistence; negative loses. Every method retained. Change MAE equals level MAE with a common origin. Annual origins and overlapping five-year endpoints are dependent; no p-values. Sign accuracy excludes actual zero changes; prediction ties count as wrong."}


def main():
    protocol_path = OUT / "protocol.json"
    for path in [protocol_path, Path(__file__), Path(__file__).with_name("model.py")]:
        if subprocess.check_output(["git", "show", f"HEAD:{path.relative_to(ROOT)}"], cwd=ROOT) != path.read_bytes():
            raise RuntimeError(f"Commit protocol and implementation before scoring: {path}")
    if (OUT / "score-receipt.json").exists():
        raise RuntimeError("This registered comparison has already started; do not overwrite or retune")
    countries, excluded, panels, unmatched = load_sources()
    observations, predictions, coverage = build_paths(countries, panels)
    receipt = {"schema": "annual-objective-score-receipt/1", "startedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
               "protocolSha256": hashlib.sha256(protocol_path.read_bytes()).hexdigest(),
               "codeCommit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
               "registrationCommit": "5e843c7", "status": "started", "comparisonNumber": 1}
    write(OUT / "score-receipt.json", receipt)
    metrics = summarize(predictions)
    common = {"schema": "annual-objective-paths/1", "targets": TARGETS, "methods": METHODS,
              "countries": [{"country": c, "name": r["name"]} for c, r in sorted(countries.items())],
              "mode": "rolling-origin", "horizons": [1, 5], "trainingYears": 20,
              "changeUnits": {target: spec["scoringUnit"] for target, spec in TARGETS.items()},
              "changeDefinition": "Origin-to-target change, GDP as percentage of origin; unemployment percentage points; life years. Five-year changes are cumulative, not annualized.",
              "retrospective": True}
    write(OUT / "paths.json", {**common, "observations": observations, "predictions": predictions}, compact=True)
    write(OUT / "example-paths.json", {**common, "observations": [r for r in observations if r["country"] in EXAMPLES],
                                      "predictions": [r for r in predictions if r["country"] in EXAMPLES]}, compact=True)
    write(OUT / "metrics.json", metrics)
    write(OUT / "coverage.json", {"schema": "annual-objective-coverage/1", "countryMetadataCount": len(countries),
                                   "aggregateExclusions": excluded, "nonCohortSourceRows": unmatched,
                                   "yearRange": [1960, 2025], "paths": coverage})
    receipt.update({"status": "complete", "completedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "observationRows": len(observations), "predictionRows": len(predictions),
                    "outputs": {name: hashlib.sha256((OUT / name).read_bytes()).hexdigest()
                                for name in ["paths.json", "example-paths.json", "metrics.json", "coverage.json"]}})
    (OUT / "score-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    for r in metrics["pooled"]:
        print(f"{r['target']:16} h={r['horizon']} {r['method']:17} n={r['n']:5} MAE={r['mae']:.6f} skill={r['skill']:+.3%}")
    print(f"Exported {len(observations)} observations, {len(predictions)} forecasts, {len(countries)} economies")


if __name__ == "__main__":
    main()

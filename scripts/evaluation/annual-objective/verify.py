"""Audit immutable exported evidence without fitting or rerunning the study."""
from collections import defaultdict
import hashlib
import json
import math
from pathlib import Path

OUT = Path(__file__).resolve().parents[3] / "data/evaluation/annual-objective-20260917"


def main():
    receipt = json.loads((OUT / "score-receipt.json").read_text())
    assert receipt["status"] == "complete" and receipt["comparisonNumber"] == 1
    for name, digest in receipt["outputs"].items():
        assert hashlib.sha256((OUT / name).read_bytes()).hexdigest() == digest, name
    assert hashlib.sha256((OUT / "protocol.json").read_bytes()).hexdigest() == receipt["protocolSha256"]
    source_provenance = json.loads((OUT / "provenance.json").read_text())
    for source in source_provenance["sources"]:
        assert hashlib.sha256((OUT / "raw" / source["file"]).read_bytes()).hexdigest() == source["sha256"]
    paths = json.loads((OUT / "paths.json").read_text())
    observations = {(r["country"], r["target"], r["year"]): r["value"] for r in paths["observations"]}
    assert len(observations) == len(paths["observations"])
    groups, sums = defaultdict(set), defaultdict(lambda: [0, 0.0, 0.0, 0, 0])
    for r in paths["predictions"]:
        key = (r["country"], r["target"], r["originYear"], r["horizon"])
        assert r["method"] not in groups[key]
        groups[key].add(r["method"])
        assert r["mode"] == "rolling-origin"
        assert r["year"] == r["originYear"] + r["horizon"]
        assert r["trainingCutoff"] == r["originYear"] < r["year"]
        assert r["trainingStart"] == r["originYear"] - 19
        for year in range(r["trainingStart"], r["trainingCutoff"] + 1):
            assert observations[(r["country"], r["target"], year)] is not None
        assert r["actual"] == observations[(r["country"], r["target"], r["year"])]
        assert r["originValue"] == observations[(r["country"], r["target"], r["originYear"])]
        assert math.isfinite(r["prediction"]) and math.isfinite(r["rawPrediction"])
        assert r["unit"] == paths["targets"][r["target"]]["unit"]
        scale = 100 / r["originValue"] if r["target"] == "gdp" else 1
        predicted_change = (r["prediction"] - r["originValue"]) * scale
        assert math.isclose(predicted_change, r["predictedChange"], abs_tol=1e-12)
        if r["method"] == "persistence":
            assert r["prediction"] == r["originValue"] and r["predictedChange"] == 0
        summary_key = (r["target"], r["horizon"], r["method"])
        if r["actual"] is None:
            assert r["actualChange"] is None
            sums[summary_key][3] += 1
        else:
            actual_change = (r["actual"] - r["originValue"]) * scale
            assert math.isclose(actual_change, r["actualChange"], abs_tol=1e-12)
            error = abs((r["prediction"] - r["actual"]) * scale)
            assert math.isclose(error, abs(predicted_change - actual_change), abs_tol=1e-10)
            sums[summary_key][0] += 1
            sums[summary_key][1] += error
            sums[summary_key][2] += abs(actual_change)
            sums[summary_key][4] += int(abs(actual_change) > 1e-12)
    assert all(methods == set(paths["methods"]) for methods in groups.values())
    metrics = json.loads((OUT / "metrics.json").read_text())
    for r in metrics["pooled"]:
        n, error_sum, baseline_sum, missing, direction_n = sums[(r["target"], r["horizon"], r["method"])]
        assert n == r["n"] and missing == r["missingOutcomes"]
        assert direction_n == r["directionDenominator"]
        assert math.isclose(error_sum / n, r["mae"], rel_tol=1e-12)
        assert math.isclose(baseline_sum / n, r["baselineMAE"], rel_tol=1e-12)
        assert r["changeMAE"] == r["mae"]
        assert math.isclose(1 - error_sum / baseline_sum, r["skill"], abs_tol=1e-12)
    print(json.dumps({"status": "passed", "observations": len(observations), "forecastRows": len(paths["predictions"]),
                      "matchedCountryTargetOrigins": len(groups), "pooledComparisons": len(metrics["pooled"]),
                      "checks": "Source/output hashes; exact20-year history and cutoff; matched4-method masks; observation equality; missing outcomes; native level units and normalized changes; independent exported-row MAE/skill arithmetic. No fitting or score rerun."}))


if __name__ == "__main__":
    main()

"""Retrieve the registered objective test data only after every forecast is frozen.

This fetcher does not compute scores or change any forecast. API rows are retained
verbatim, including missing values. Run once from the repository root.
"""
import datetime
import hashlib
import json
import pathlib
import subprocess
import urllib.request

FAMILY = "five-approaches-20260916"
ENTRY = "research-objective-1980-v1"
registry_path = pathlib.Path("data/evaluation") / FAMILY / "registry.json"
registry = json.loads(registry_path.read_text())
expected = {f"research-{n}-2018-v1" for n in ["offset", "damped", "changes", "health", "ensemble"]} | {ENTRY}
if registry["family"] != FAMILY or {e["id"] for e in registry["entries"]} != expected:
    raise RuntimeError("All six entries must be frozen")
if subprocess.check_output(["git", "show", f"HEAD:{registry_path}"]) != registry_path.read_bytes():
    raise RuntimeError("Registry must be committed before retrieval")
directory = pathlib.Path("data/evaluation") / ENTRY / "external"
directory.mkdir(exist_ok=False)
sources = []
for indicator in ["SP.DYN.LE00.IN", "NY.GDP.PCAP.KD"]:
    url = f"https://api.worldbank.org/v2/country/all/indicator/{indicator}?date=1981:2025&source=2&format=json&per_page=20000"
    with urllib.request.urlopen(url, timeout=45) as response:
        raw = response.read()
    path = directory / f"{indicator}-1981-2025.json"
    with path.open("xb") as output:
        output.write(raw)
    # Validate API shape and boundaries, not numerical forecasting performance.
    meta, rows = json.loads(raw)
    if int(meta["page"]) != 1 or int(meta["pages"]) != 1 or int(meta["total"]) != len(rows):
        raise RuntimeError("Incomplete API response; retain failure, do not score")
    if any(r["indicator"]["id"] != indicator or not 1981 <= int(r["date"]) <= 2025 for r in rows):
        raise RuntimeError("Unexpected target or date; retain failure, do not score")
    sources.append({"indicator": indicator, "url": url, "path": str(path), "retrievedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "sha256": hashlib.sha256(raw).hexdigest(), "responseRows": len(rows), "apiMetadata": meta})
record = {"schema": "objective-test-source-provenance/1", "entry": ENTRY, "registrySha256": hashlib.sha256(registry_path.read_bytes()).hexdigest(), "sources": sources, "scoring": "Not executed by fetcher; every raw response is retained, never mapped to ladder"}
(directory / "provenance.json").write_text(json.dumps(record, indent=2) + "\n")
print(json.dumps({"entry": ENTRY, "retrievedSources": len(sources), "scoring": "not run"}))

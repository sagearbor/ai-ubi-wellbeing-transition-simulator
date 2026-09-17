"""Fetch official public data, retaining exact bytes and source provenance."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "data/evaluation/annual-objective-20260917"
RAW = OUT / "raw"
INDICATORS = ["NY.GDP.PCAP.KD", "SL.UEM.TOTL.ZS", "SP.DYN.LE00.IN"]


def main():
    protocol = OUT / "protocol.json"
    relative = protocol.relative_to(ROOT)
    if subprocess.check_output(["git", "show", f"HEAD:{relative}"], cwd=ROOT) != protocol.read_bytes():
        raise RuntimeError("Commit the exact protocol before retrieval")
    sources = []
    requests = [("countries.json", "https://api.worldbank.org/v2/country?format=json&per_page=400")]
    for indicator in INDICATORS:
        requests += [(f"{indicator}-metadata.json", f"https://api.worldbank.org/v2/indicator/{indicator}?format=json&source=2"),
                     (f"{indicator}-1960-2025.json", f"https://api.worldbank.org/v2/country/all/indicator/{indicator}?date=1960:2025&source=2&format=json&per_page=20000")]
    RAW.mkdir(parents=True, exist_ok=True)
    # Incrementally save provenance so interruption cannot lose attribution.
    previous = json.loads((OUT / "provenance.json").read_text()) if (OUT / "provenance.json").exists() else {"sources": []}
    known = {s["file"]: s for s in previous["sources"]}
    for filename, url in requests:
        path = RAW / filename
        if path.exists():
            if filename not in known or hashlib.sha256(path.read_bytes()).hexdigest() != known[filename]["sha256"]:
                raise RuntimeError(f"Existing raw file without matching provenance: {filename}")
            sources.append(known[filename])
            continue
        for attempt in range(3):
            try:
                with urllib.request.urlopen(url, timeout=60) as response:
                    content = response.read()
                break
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(1)
        metadata, rows = json.loads(content)
        if int(metadata["pages"]) != 1 or int(metadata["total"]) != len(rows):
            raise RuntimeError(f"Incomplete paginated response: {filename}")
        path.write_bytes(content)
        source = {"file": filename, "url": url, "retrievedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  "sha256": hashlib.sha256(content).hexdigest(), "bytes": len(content), "rows": len(rows), "apiMetadata": metadata}
        sources.append(source)
        provenance = {"schema": "annual-objective-source-provenance/1", "protocolSha256": hashlib.sha256(protocol.read_bytes()).hexdigest(),
                      "registrationCommit": "5e843c7", "sources": sources,
                      "attribution": "World Bank, World Development Indicators; underlying national accounts/ILO/UN/national statistical sources documented in raw indicator metadata.",
                      "license": "CC BY 4.0, as stated in World Bank indicator metadata glossaries", "licenseUrl": "https://datacatalog.worldbank.org/int/public-licenses#cc-by",
                      "metadataGlossaries": [f"https://databank.worldbank.org/metadataglossary/world-development-indicators/series/{i}" for i in INDICATORS],
                      "revisions": "Latest retrieved vintage; historical observations can incorporate later revisions or source modeling. API lastupdated retained per response. No historical release-vintage reconstruction.",
                      "exposure": "Full series were loaded by acquisition/cleaning before evaluation; outcomes were not blinded or withheld from agent context."}
        (OUT / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
        print(f"Retrieved {filename}: {len(rows)} rows", flush=True)


if __name__ == "__main__":
    main()

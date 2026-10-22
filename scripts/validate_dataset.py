"""Validate the Dev 1 delivery against the shared dataset contract."""
import argparse
import json
import math
from pathlib import Path

from shapely.geometry import shape


def validate(path: Path, expected: int) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    meta, comuni = data["meta"], data["comuni"]
    assert len(comuni) == expected, "Numero comuni inatteso"
    assert meta["inquinante"] == "PM10"
    assert meta["periodoAria"] and meta["generatoIl"]
    assert meta["crs"] == "EPSG:32632"
    by_id = {c["istat"]: c for c in comuni}
    assert len(by_id) == expected, "Codici duplicati"
    for c in comuni:
        key = c["istat"]
        assert len(c["centroide"]) == 2 and all(math.isfinite(v) for v in c["centroide"])
        assert c["geometria"] and all(len(ring) >= 4 and ring[0] == ring[-1] for ring in c["geometria"])
        geometry = shape(c["geometry"])
        assert geometry.is_valid and not geometry.is_empty, key
        assert math.isfinite(c["pm10"]) and c["pm10"] >= 0, key
        assert 0 <= c["ariaNorm"] <= 100, key
        assert abs(c["ariaNorm"] - max(0, min(100, (50-c["pm10"])/35*100))) < 0.00001, key
        assert isinstance(c["nCentraline"], int) and c["nCentraline"] > 0, key
        assert c["confinanti"] and len(c["confinanti"]) == len(set(c["confinanti"])), key
        for neighbor in c["confinanti"]:
            assert neighbor != key and neighbor in by_id, key
            assert key in by_id[neighbor]["confinanti"], key
    visited: set[str] = set()
    pending = [comuni[0]["istat"]]
    while pending:
        key = pending.pop()
        if key not in visited:
            visited.add(key)
            pending.extend(by_id[key]["confinanti"])
    assert len(visited) == expected, "Grafo delle adiacenze disconnesso"
    return {"comuni": expected, "senzaConfinanti": 0,
            "ariaNormMin": min(c["ariaNorm"] for c in comuni),
            "ariaNormMax": max(c["ariaNorm"] for c in comuni),
            "mock": meta["mock"], "periodoAria": meta["periodoAria"]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path)
    parser.add_argument("--expected", type=int, default=114)
    args = parser.parse_args()
    print(json.dumps(validate(args.path, args.expected), ensure_ascii=False, indent=2))

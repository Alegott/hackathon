"""Generate the explicitly synthetic, provisional team integration dataset."""
import json
from datetime import datetime, timezone
from pathlib import Path


def main():
    comuni = []
    for i, (pm10, aria_norm) in enumerate([(15, 100), (22, 80), (29, 60), (43, 20), (50, 0)]):
        x, y = 690000 + i * 1000, 5040000
        comuni.append({
            "id": f"mock-{i + 1:03d}", "nome": f"Comune fittizio {i + 1}",
            "centroide": [x + 500, y + 500],
            "geometry": {"type": "Polygon", "coordinates": [[[x, y], [x+1000, y],
                [x+1000, y+1000], [x, y+1000], [x, y]]]},
            "confinanti": [f"mock-{j + 1:03d}" for j in [i-1, i+1] if 0 <= j < 5],
            "pm10": pm10, "ariaNorm": aria_norm,
        })
    data = {"meta": {"schemaVersion": "provisional-1", "mock": True,
        "generatedAt": datetime.now(timezone.utc).isoformat(), "crs": "EPSG:32632",
        "pm10Unit": "µg/m³", "note": "Dati interamente fittizi; contratto A da confermare."},
        "comuni": comuni}
    Path("dataset.mock.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

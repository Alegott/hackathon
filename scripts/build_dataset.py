"""Build the provisional meta + comuni contract from measured PM10 and ISTAT boundaries."""
import argparse
import csv
import json
import math
import statistics
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import geopandas as gpd
from pyproj import Transformer
from shapely.geometry import mapping

CRS = "EPSG:32632"


def number(value: str) -> float:
    result = float(value.strip().replace(",", "."))
    if not math.isfinite(result):
        raise ValueError(f"Valore non finito: {value}")
    return result


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as stream:
        sample = stream.read(8192)
        stream.seek(0)
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
        reader = csv.DictReader(stream, dialect=dialect)
        return [{str(k).strip(): (v or "").strip() for k, v in row.items() if k is not None}
                for row in reader]


def station_means(path: Path, station_col: str, value_col: str,
                  pollutant_col: str | None = None) -> tuple[dict[str, float], dict[str, int]]:
    values: dict[str, list[float]] = {}
    counts = {"rows": 0, "otherPollutants": 0, "missing": 0, "valid": 0}
    for row in read_csv(path):
        counts["rows"] += 1
        if pollutant_col and row[pollutant_col].upper().replace(" ", "") != "PM10":
            counts["otherPollutants"] += 1
            continue
        raw = row[value_col]
        if raw.upper() in {"", "NA", "N/A", "ND", "N.D.", "NULL", "-"}:
            counts["missing"] += 1
            continue
        value = number(raw)
        if value < 0:
            raise ValueError(f"PM10 negativo per {row[station_col]}: {value}; configurare prima i codici mancanti")
        station = row[station_col]
        if not station:
            raise ValueError("Misura PM10 senza identificativo centralina")
        values.setdefault(station, []).append(value)
        counts["valid"] += 1
    if not values:
        raise ValueError("Nessuna misura PM10 valida")
    return {key: statistics.mean(samples) for key, samples in values.items()}, counts


def idw(point: tuple[float, float], stations: list[tuple[float, float, float]],
        power: float = 2) -> float:
    if not stations or not math.isfinite(power) or power <= 0:
        raise ValueError("IDW richiede centraline e una potenza positiva finita")
    distances = [(math.hypot(point[0]-x, point[1]-y), value) for x, y, value in stations]
    coincident = [value for distance, value in distances if distance <= 1e-6]
    if coincident:
        return statistics.mean(coincident)
    minimum = min(distance for distance, _ in distances)
    weighted = [((minimum / distance) ** power, value) for distance, value in distances]
    return sum(weight * value for weight, value in weighted) / sum(weight for weight, _ in weighted)


def normalize_air(pm10: float) -> float:
    if not math.isfinite(pm10) or pm10 < 0:
        raise ValueError("PM10 deve essere finito e non negativo")
    return max(0.0, min(100.0, (50-pm10)/35*100))


def prepare_boundaries(path: Path, expected_count: int = 114, tolerance: float = 50) -> tuple[list[dict], dict]:
    if not math.isfinite(tolerance) or tolerance < 0:
        raise ValueError("Tolleranza di semplificazione non valida")
    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path) as archive:
            candidates = [name for name in archive.namelist()
                          if name.lower().endswith(".shp") and Path(name).name.lower().startswith("com")]
        if len(candidates) != 1:
            raise ValueError(f"Atteso uno shapefile comuni, trovati: {candidates}")
        source = f"zip://{path.resolve().as_posix()}!{candidates[0]}"
    else:
        source = str(path)
    frame = gpd.read_file(source)
    if frame.crs is None:
        raise ValueError("Confini privi di CRS: impossibile proiettare")
    frame = frame[frame["COD_PROV"].astype(int) == 24].copy()
    frame["id"] = frame["PRO_COM"].astype(int).map(lambda value: f"{value:06d}")
    if len(frame) != expected_count or frame["id"].duplicated().any():
        raise ValueError(f"Attesi {expected_count} comuni unici di Vicenza, trovati {len(frame)}")
    frame = frame.to_crs(CRS).sort_values("id").reset_index(drop=True)
    if frame.geometry.is_empty.any() or (~frame.geometry.is_valid).any():
        raise ValueError("Confini vuoti o non validi")
    # Compute topology on the source polygons, before independent simplification.
    neighbors: dict[str, list[str]] = {key: [] for key in frame["id"]}
    for i in range(len(frame)):
        left = frame.geometry.iloc[i]
        for j in range(i+1, len(frame)):
            right = frame.geometry.iloc[j]
            if left.intersection(right).area > 0.01:
                raise ValueError(f"Comuni sovrapposti: {frame.iloc[i]['id']}, {frame.iloc[j]['id']}")
            if left.boundary.intersection(right.boundary).length > 0:
                neighbors[frame.iloc[i]["id"]].append(frame.iloc[j]["id"])
                neighbors[frame.iloc[j]["id"]].append(frame.iloc[i]["id"])
    comuni = []
    for _, row in frame.iterrows():
        centroid = row.geometry.centroid
        geometry = row.geometry.simplify(tolerance, preserve_topology=True)
        if geometry.is_empty or not geometry.is_valid:
            raise ValueError(f"Semplificazione non valida: {row['id']}")
        comuni.append({"id": row["id"], "nome": row["COMUNE"],
            "centroide": [centroid.x, centroid.y], "geometry": mapping(geometry),
            "confinanti": sorted(neighbors[row["id"]])})
    return comuni, {"source": str(path), "count": len(comuni), "crs": CRS,
                    "simplifyToleranceMeters": tolerance, "adjacency": "shared boundary length > 0; before simplification"}


def build(args: argparse.Namespace) -> dict:
    means, counts = station_means(args.measurements, args.station_col, args.value_col, args.pollutant_col)
    transformer = Transformer.from_crs(args.station_crs, CRS, always_xy=True)
    stations: dict[str, tuple[float, float, float]] = {}
    for row in read_csv(args.stations):
        key = row[args.coordinate_station_col or args.station_col]
        if key not in means:
            continue
        x, y = transformer.transform(number(row[args.x_col]), number(row[args.y_col]), errcheck=True)
        if not all(math.isfinite(value) for value in (x, y)):
            raise ValueError(f"Coordinate non valide: {key}")
        value = (x, y, means[key])
        if key in stations and stations[key] != value:
            raise ValueError(f"Coordinate contrastanti per centralina {key}")
        stations[key] = value
    missing = sorted(set(means)-set(stations))
    if missing:
        raise ValueError(f"Centraline senza coordinate: {missing}")
    comuni, boundaries_meta = prepare_boundaries(args.boundaries, args.expected_count, args.simplify)
    provenance = args.boundaries.with_suffix(".source.json")
    if provenance.exists():
        boundaries_meta["provenance"] = json.loads(provenance.read_text(encoding="utf-8"))
    for comune in comuni:
        interpolated = idw(tuple(comune["centroide"]), list(stations.values()), args.power)
        comune.update(pm10=round(interpolated, 6), ariaNorm=round(normalize_air(interpolated), 6))
    return {"meta": {"schemaVersion": "provisional-1", "mock": False,
        "generatedAt": datetime.now(timezone.utc).isoformat(), "crs": CRS,
        "pm10Unit": "µg/m³", "measurementsSource": str(args.measurements),
        "stationsSource": str(args.stations), "measurements": counts,
        "stationMeans": [{"id": key, "pm10": value} for key, value in sorted(means.items())],
        "boundaries": boundaries_meta, "interpolation": {"method": "IDW", "power": args.power},
        "normalization": {"pm10At100": 15, "pm10At0": 50, "clamp": [0, 100]},
        "note": "Solo meta + comuni; schema provvisorio, contratto A da confermare."}, "comuni": comuni}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--measurements", type=Path, required=True)
    parser.add_argument("--stations", type=Path, required=True)
    parser.add_argument("--boundaries", type=Path, default=Path("data/raw/Limiti01012024_g.zip"))
    parser.add_argument("--output", type=Path, default=Path("dataset.json"))
    parser.add_argument("--station-col", default="centralina")
    parser.add_argument("--coordinate-station-col")
    parser.add_argument("--value-col", default="pm10")
    parser.add_argument("--pollutant-col")
    parser.add_argument("--x-col", default="lon")
    parser.add_argument("--y-col", default="lat")
    parser.add_argument("--station-crs", default="EPSG:4326")
    parser.add_argument("--expected-count", type=int, default=114)
    parser.add_argument("--simplify", type=float, default=50)
    parser.add_argument("--power", type=float, default=2)
    args = parser.parse_args()
    data = build(args)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False)+"\n", encoding="utf-8")
    print(f"Scritti {len(data['comuni'])} comuni in {args.output}")


if __name__ == "__main__":
    main()

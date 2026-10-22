"""Download official ARPAV annual PM10 means and station coordinates (no daily synthesis)."""
import argparse
import csv
import hashlib
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

PM10_URL = "https://www.arpa.veneto.it/dati-ambientali/open-data/file-e-allegati/qualita-aria/polveri-pm10_trend.csv/@@download/file"
STATIONS_URL = "https://gaia.arpa.veneto.it/geoserver/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=geonode:v_rete_aria&outputFormat=application/json&srsName=EPSG:4326"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true", help="Reuse downloaded raw sources")
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    args = parser.parse_args()
    raw = args.data_dir / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    sources = []
    for name, url in [("arpav-pm10.csv", PM10_URL), ("arpav-stations.json", STATIONS_URL)]:
        path = raw / name
        if not args.offline:
            with urllib.request.urlopen(url, timeout=60) as response:
                path.write_bytes(response.read())
        sources.append({"path": str(path), "url": url,
                        "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    with (raw / "arpav-pm10.csv").open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        fields = reader.fieldnames or []
        columns = {int(m.group(1)): field for field in fields
                   if (m := re.match(r"(\d{4})-PM10 media anno", field))}
        rows = [row for row in reader if row["Provincia"] == "Vicenza"]
    # Most recent complete published calendar year, never the current partial year.
    eligible = [year for year, field in columns.items()
                if year < datetime.now(timezone.utc).year and
                any(row[field].strip() not in {"", "-"} for row in rows)]
    if not eligible:
        raise ValueError("No complete published year of Vicenza PM10")
    year = max(eligible)
    field = columns[year]
    stations = json.loads((raw / "arpav-stations.json").read_text(encoding="utf-8"))
    by_id = {feature["properties"]["eoi"]: feature for feature in stations["features"]}
    measurements, coordinates = [], []
    for row in rows:
        value = row[field].strip()
        if value in {"", "-"}:
            continue
        station = row["Codice identificativo stazione"]
        feature = by_id[station]
        if feature["geometry"]["type"] != "Point":
            raise ValueError(f"Station geometry is not a Point: {station}")
        if feature["properties"]["prov"] != "VI":
            raise ValueError(f"Station outside Vicenza: {station}")
        lon, lat = feature["geometry"]["coordinates"]
        if not (10 < lon < 13 and 45 < lat < 47):
            raise ValueError(f"Unexpected WGS84 coordinates: {station}")
        measurements.append({"centralina": station, "data": f"{year}-12-31",
                             "inquinante": "PM10", "valore": float(value),
                             "risoluzione": "annual_mean"})
        coordinates.append({"centralina": station, "lon": lon, "lat": lat,
                            "nome": feature["properties"]["name"]})
    for name, data in [("aria.csv", measurements), ("centraline.csv", coordinates)]:
        with (args.data_dir / name).open("w", encoding="utf-8", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=list(data[0]))
            writer.writeheader()
            writer.writerows(data)
    provenance = {"provider": "ARPAV", "license": "CC BY 4.0",
                  "retrievedAt": datetime.now(timezone.utc).isoformat(), "year": year,
                  "periodStart": f"{year}-01-01", "periodEnd": f"{year}-12-31",
                  "temporalResolution": "annual_mean", "unit": "µg/m³",
                  "stationCount": len(measurements), "sources": sources,
                  "note": "Official published annual means, not daily observations. data is the reporting period end. Coordinates from current official station registry, matched by EOI code."}
    (args.data_dir / "aria.source.json").write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (args.data_dir / "centraline.source.json").write_text(json.dumps({
        "provider": "ARPAV", "retrievedAt": provenance["retrievedAt"],
        "crs": "EPSG:4326", "geometryType": "Point", "joinKey": "EOI station code",
        "stationCount": len(coordinates), "source": sources[1],
        "note": "Current official station registry; historic relocation not independently assessed."
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Written {len(measurements)} official annual station means for {year}")


if __name__ == "__main__":
    main()

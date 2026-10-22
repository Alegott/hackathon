"""Dissolve the ISTAT source into a single provincial boundary for clipping the 3D map."""
import json
import zipfile
from pathlib import Path

import geopandas as gpd
from shapely.geometry import mapping


def main():
    archive_path = Path("data/raw/Limiti01012024_g.zip")
    with zipfile.ZipFile(archive_path) as archive:
        shp = next(n for n in archive.namelist()
                   if n.lower().endswith(".shp") and Path(n).name.lower().startswith("com"))
    frame = gpd.read_file(f"zip://{archive_path.resolve().as_posix()}!{shp}")
    frame = frame[frame["COD_PROV"].astype(int) == 24].to_crs("EPSG:32632")
    geometry = frame.geometry.union_all().simplify(30, preserve_topology=True)
    geometry = gpd.GeoSeries([geometry], crs=frame.crs).to_crs("EPSG:4326").iloc[0]
    output = {"type": "Feature", "properties": {
        "nome": "Provincia di Vicenza", "fonte": "ISTAT 2024", "tolleranzaMetri": 30,
    }, "geometry": mapping(geometry)}
    Path("src/data/provincia.geojson.json").write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Confine provinciale: {geometry.geom_type}, valido={geometry.is_valid}")


if __name__ == "__main__":
    main()

"""Prepare real Vicenza geometry independently of the missing air CSV."""
import argparse
import json
from pathlib import Path

from build_dataset import prepare_boundaries


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--boundaries", type=Path, default=Path("data/raw/Limiti01012024_g.zip"))
    parser.add_argument("--output", type=Path, default=Path("data/comuni.vicenza.json"))
    args = parser.parse_args()
    comuni, meta = prepare_boundaries(args.boundaries)
    provenance = args.boundaries.with_suffix(".source.json")
    if provenance.exists():
        meta["provenance"] = json.loads(provenance.read_text(encoding="utf-8"))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({"meta": meta, "comuni": comuni}, ensure_ascii=False,
                                     indent=2, allow_nan=False)+"\n", encoding="utf-8")
    print(f"Scritti {len(comuni)} comuni in {args.output}")


if __name__ == "__main__":
    main()

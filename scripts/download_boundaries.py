"""Download the ISTAT 2024 snapshot (114 municipalities in Vicenza)."""
import argparse
import hashlib
import json
import ssl
import urllib.request
from pathlib import Path

import truststore

URL = "https://www.istat.it/storage/cartografia/confini_amministrativi/generalizzati/2024/Limiti01012024_g.zip"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("data/raw/Limiti01012024_g.zip"))
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(URL, headers={"User-Agent": "VicenzaAirDataset/1.0"})
    context = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    with urllib.request.urlopen(request, timeout=120, context=context) as response:
        content = response.read()
    if not content.startswith(b"PK"):
        raise ValueError("ISTAT non ha restituito un archivio ZIP")
    args.output.write_bytes(content)
    args.output.with_suffix(".source.json").write_text(json.dumps({
        "url": URL, "referenceDate": "2024-01-01",
        "sha256": hashlib.sha256(content).hexdigest(),
    }, indent=2) + "\n", encoding="utf-8")
    print(args.output)


if __name__ == "__main__":
    main()


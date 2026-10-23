"""Scarica il pacchetto CC0 di Quaternius per selezionare alberi glTF statici."""
from pathlib import Path
import urllib.request
import zipfile
import json
import struct
import hashlib

URL = "https://opengameart.org/sites/default/files/stylized_nature_megakitstandard.zip"
archive = Path("data/raw/stylized-nature-standard.zip")
archive.parent.mkdir(parents=True, exist_ok=True)
if not archive.exists():
    urllib.request.urlretrieve(URL, archive)
with zipfile.ZipFile(archive) as z:
    output = Path("public/models/nature")
    output.mkdir(parents=True, exist_ok=True)
    for name in ("CommonTree_1", "Pine_1", "DeadTree_1"):
        model = json.loads(z.read(f"glTF/{name}.gltf"))
        assert len(model["buffers"]) == 1
        binary = bytearray(z.read("glTF/" + model["buffers"][0]["uri"]))
        for img in model.get("images", []):
            while len(binary) % 4:
                binary.append(0)
            data = z.read("glTF/" + img.pop("uri"))
            img["bufferView"] = len(model["bufferViews"])
            model["bufferViews"].append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(data)})
            binary.extend(data)
        model["buffers"] = [{"byteLength": len(binary)}]
        meta = json.dumps(model, separators=(",", ":")).encode()
        meta += b" " * (-len(meta) % 4)
        binary.extend(b"\0" * (-len(binary) % 4))
        glb = (struct.pack("<III", 0x46546C67, 2, 28 + len(meta) + len(binary))
               + struct.pack("<II", len(meta), 0x4E4F534A) + meta
               + struct.pack("<II", len(binary), 0x004E4942) + binary)
        (output / f"{name}.glb").write_bytes(glb)
        print(name, len(glb), hashlib.sha256(glb).hexdigest())
    (output / "LICENSE.txt").write_bytes(z.read("License_Standard.txt"))

#!/usr/bin/env python3
"""Download the meaning-search model for CI: pinned revision, every file checked by sha256.

Same model, revision and checksums as packages/maxagent/lib/extras.js on users' machines.
Usage: python scripts/fetch-model.py <vector dir>   (files go to <vector dir>/model)
Works the same on Windows, Linux and macOS (no sha256sum / shasum needed).
"""
import hashlib
import os
import sys
import urllib.request

REPO = "Xenova/multilingual-e5-small"
REVISION = "761b726dd34fb83930e26aab4e9ac3899aa1fa78"
FILES = {
    "onnx/model_quantized.onnx": "f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193",
    "tokenizer.json": "0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39",
    "config.json": "cb99455288675345e1a4f411438d5d0adbba5fbd3a67ea4fb03c015433b996c1",
}


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: fetch-model.py <vector dir>")
    model = os.path.join(sys.argv[1], "model")
    os.makedirs(model, exist_ok=True)
    for src, want in FILES.items():
        dest = os.path.join(model, os.path.basename(src))
        url = f"https://huggingface.co/{REPO}/resolve/{REVISION}/{src}"
        urllib.request.urlretrieve(url, dest)
        h = hashlib.sha256()
        with open(dest, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 20), b""):
                h.update(chunk)
        if h.hexdigest() != want:
            os.remove(dest)
            sys.exit(f"sha256 mismatch: {src}")
        print(f"ok {os.path.basename(src)}")
    with open(os.path.join(model, "REVISION"), "w") as f:
        f.write(REVISION + "\n")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Download YuNet and SFace models from OpenCV Zoo with checksum verification."""
from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path
from urllib.request import urlopen

MODEL_DIR = Path(__file__).resolve().parents[1] / "models"

MODEL_REGISTRY = {
    "yunet.onnx": {
        "url": "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
        "sha256": "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4",
    },
    "sface.onnx": {
        "url": "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
        "sha256": "0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79",
    },
}


def compute_sha256(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def download_model(filename: str, url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urlopen(url) as response, dest.open("wb") as out_file:  # type: ignore[arg-type]
        out_file.write(response.read())


def verify_model(path: Path, expected_sha: str) -> bool:
    if not expected_sha:
        return True
    checksum = compute_sha256(path)
    return checksum.lower() == expected_sha.lower()


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch Chronoface face models")
    parser.add_argument("--check", action="store_true", help="Only verify checksums")
    args = parser.parse_args()

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    status = 0

    for name, info in MODEL_REGISTRY.items():
        path = MODEL_DIR / name
        if not args.check:
            print(f"Downloading {name}...")
            download_model(name, info["url"], path)
        if not path.exists():
            print(f"Missing model: {path}", file=sys.stderr)
            status = 1
            continue
        if not verify_model(path, info["sha256"]):
            print(
                f"Checksum mismatch for {name}. Expected {info['sha256']} got {compute_sha256(path)}",
                file=sys.stderr,
            )
            status = 1
        else:
            sha = compute_sha256(path)
            (path.parent / f"{path.name}.sha256").write_text(f"{sha}  {path.name}\n")
            print(f"Verified {name} ({sha})")
    return status


if __name__ == "__main__":
    raise SystemExit(main())

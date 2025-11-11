from __future__ import annotations

from pathlib import Path

from PIL import Image

from backend.core.exifutil import read_capture_datetime

SAMPLES = Path("backend/data/sample_photos")


def test_read_capture_datetime() -> None:
    sample = next(iter(sorted(SAMPLES.glob("*.jpg"))))
    dt, reason = read_capture_datetime(sample)
    assert dt is not None
    assert reason is None


def test_missing_exif(tmp_path: Path) -> None:
    path = tmp_path / "no_exif.jpg"
    Image.new("RGB", (64, 64), color="gray").save(path, format="JPEG")
    dt, reason = read_capture_datetime(path)
    assert dt is None
    assert reason is not None

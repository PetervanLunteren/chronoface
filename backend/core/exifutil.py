"""EXIF helpers."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

import piexif
from PIL import Image


def read_capture_datetime(path: Path) -> Tuple[Optional[datetime], Optional[str]]:
    """Return capture datetime and an optional skip reason."""

    try:
        with Image.open(path) as img:
            exif_bytes = img.info.get("exif")
    except OSError as exc:  # Corrupt image
        return None, f"unreadable:{exc}" if str(exc) else "unreadable"

    if not exif_bytes:
        return None, "missing_exif"

    try:
        exif_dict = piexif.load(exif_bytes)
    except piexif.InvalidImageDataError:
        return None, "invalid_exif"

    raw_datetime = exif_dict.get("Exif", {}).get(piexif.ExifIFD.DateTimeOriginal)
    if not raw_datetime:
        return None, "missing_exif"

    if isinstance(raw_datetime, bytes):
        raw_datetime = raw_datetime.decode("utf-8", errors="ignore")

    try:
        dt = datetime.strptime(raw_datetime, "%Y:%m:%d %H:%M:%S")
    except (TypeError, ValueError):
        return None, "invalid_exif"

    return dt, None

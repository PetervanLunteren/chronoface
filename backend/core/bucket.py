"""Bucket utilities for grouping photos by time."""
from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import datetime
from typing import Tuple

from .types import BucketSize


@dataclass(frozen=True)
class Bucket:
    key: str
    label: str


def bucket_from_datetime(dt: datetime, bucket: BucketSize) -> Bucket:
    """Derive a bucket key and human label for a datetime."""

    if bucket == "day":
        key = dt.strftime("%Y-%m-%d")
        label = dt.strftime("%b %d, %Y")
    elif bucket == "week":
        year, week, _ = dt.isocalendar()
        key = f"{year}-W{week:02d}"
        label = f"Week {week} {year}"
    elif bucket == "month":
        key = dt.strftime("%Y-%m")
        label = f"{calendar.month_name[dt.month]} {dt.year}"
    elif bucket == "year":
        key = dt.strftime("%Y")
        label = key
    else:  # pragma: no cover - validated elsewhere
        raise ValueError(f"Unsupported bucket: {bucket}")

    return Bucket(key=key, label=label)


def bucket_sort_key(bucket_key: str) -> Tuple[int, int]:
    """Return a tuple that allows chronological sorting of bucket keys."""

    if "-W" in bucket_key:
        year, week = bucket_key.split("-W")
        return (int(year), int(week))
    if "-" in bucket_key:
        parts = bucket_key.split("-")
        if len(parts) == 3:
            year, month, day = map(int, parts)
            return (year * 100 + month, day)
        if len(parts) == 2:
            year, month = map(int, parts)
            return (year, month)
    return (int(bucket_key), 0)

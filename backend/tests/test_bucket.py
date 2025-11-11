from __future__ import annotations

from datetime import datetime

from backend.core.bucket import bucket_from_datetime, bucket_sort_key


def test_bucket_day() -> None:
    dt = datetime(2024, 2, 29, 14, 30)
    bucket = bucket_from_datetime(dt, "day")
    assert bucket.key == "2024-02-29"
    assert "Feb" in bucket.label


def test_bucket_week() -> None:
    dt = datetime(2024, 1, 4)
    bucket = bucket_from_datetime(dt, "week")
    assert bucket.key.startswith("2024-W")


def test_bucket_sort_key() -> None:
    keys = ["2024-03", "2023-12", "2024-W02", "2024-01-15"]
    ordered = sorted(keys, key=bucket_sort_key)
    assert ordered[0] == "2023-12"

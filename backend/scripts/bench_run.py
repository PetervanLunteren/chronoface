#!/usr/bin/env python3
from __future__ import annotations

import time
from pathlib import Path

from backend.core.pipeline import run_manager
from backend.core.types import ScanRequest


def main() -> None:
    photos = Path("backend/data/sample_photos")
    if not photos.exists():
        raise SystemExit("Sample photos missing")
    request = ScanRequest(folder=str(photos), bucket="month")
    start = time.perf_counter()
    context = run_manager.run_once(request)
    elapsed = time.perf_counter() - start
    print(f"Run {context.run_id} finished in {elapsed:.2f}s with phase {context.phase}")


if __name__ == "__main__":
    main()

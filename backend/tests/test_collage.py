from __future__ import annotations

from datetime import datetime
from pathlib import Path
from uuid import uuid4

import numpy as np
from PIL import Image

from backend.core.collage import render_collage
from backend.core.models import FaceRecord, PhotoRecord


def test_render_collage(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("CHRONOFACE_OUTPUT_DIR", str(tmp_path / "output"))
    monkeypatch.setenv("CHRONOFACE_STATIC_DIR", str(tmp_path / "static"))
    from backend.core.config import get_settings as reload_settings

    reload_settings.cache_clear()  # type: ignore[attr-defined]
    settings = reload_settings()

    faces_dir = settings.static_dir / "faces"
    faces_dir.mkdir(parents=True, exist_ok=True)

    photos = {}
    faces = []
    for idx in range(3):
        photo_id = str(uuid4())
        face_id = str(uuid4())
        thumb_path = faces_dir / f"{face_id}.jpg"
        Image.new("RGB", (64, 64), color=(200, 100 + idx * 20, 120)).save(thumb_path)
        face = FaceRecord(
            face_id=face_id,
            photo_id=photo_id,
            bucket_key="2024-03",
            bbox=(0, 0, 64, 64),
            score=0.9,
            size_px=64,
            embedding_id=str(uuid4()),
            embedding=np.array([1.0, 0.0, 0.0], dtype=np.float32),
            cluster_id="cluster_001",
            accepted=True,
            thumb_path=thumb_path,
        )
        faces.append(face)
        photos[photo_id] = PhotoRecord(
            photo_id=photo_id,
            path=thumb_path,
            timestamp=datetime(2024, 3, idx + 1),
            bucket_key="2024-03",
            bucket_label="March 2024",
            thumb_path=thumb_path,
            width=64,
            height=64,
        )

    output_path, static_path, width, height = render_collage(
        run_id="test",
        bucket="2024-03",
        faces=faces,
        photos=photos,
        tile_size=32,
        columns=2,
        padding=2,
        margin=4,
        background="white",
        sort_mode="by_time",
        max_faces=10,
    )

    assert output_path.exists()
    assert static_path.exists()
    assert width > 0 and height > 0

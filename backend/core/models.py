"""Runtime models for Chronoface runs."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Dict, List, Optional

import numpy as np

from .types import BucketSize, Phase

if TYPE_CHECKING:  # pragma: no cover
    from .sse import EventChannel


@dataclass
class RunParameters:
    folder: Path
    bucket: BucketSize
    max_edge: int
    min_face_px: int
    thumb_edge: int
    downscale_detector: bool


@dataclass
class PhotoRecord:
    photo_id: str
    path: Path
    timestamp: datetime
    bucket_key: str
    bucket_label: str
    thumb_path: Path
    width: int
    height: int


@dataclass
class FaceRecord:
    face_id: str
    photo_id: str
    bucket_key: str
    bbox: tuple[int, int, int, int]
    score: float
    size_px: int
    embedding_id: str
    embedding: np.ndarray
    cluster_id: str
    accepted: Optional[bool]
    thumb_path: Path

    def as_response(self, photo_path: Path, photo_timestamp: datetime) -> Dict[str, object]:
        return {
            "face_id": self.face_id,
            "photo_id": self.photo_id,
            "bucket": self.bucket_key,
            "bbox": self.bbox,
            "score": self.score,
            "size_px": self.size_px,
            "embedding_id": self.embedding_id,
            "cluster_id": self.cluster_id,
            "accepted": self.accepted,
            "thumb_url": f"/api/static/faces/{self.thumb_path.name}",
            "photo_path": str(photo_path),
            "photo_timestamp": photo_timestamp.isoformat(),
        }


@dataclass
class RunStats:
    processed: int = 0
    total: int = 0
    message: Optional[str] = None


@dataclass
class RunContext:
    run_id: str
    parameters: RunParameters
    phase: Phase = "idle"
    stats: RunStats = field(default_factory=RunStats)
    started_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    photos: Dict[str, PhotoRecord] = field(default_factory=dict)
    photos_by_bucket: Dict[str, List[str]] = field(default_factory=dict)
    faces: Dict[str, FaceRecord] = field(default_factory=dict)
    faces_by_bucket: Dict[str, List[str]] = field(default_factory=dict)
    bucket_labels: Dict[str, str] = field(default_factory=dict)
    clusters: Dict[str, List[str]] = field(default_factory=dict)  # cluster_id -> list of face_ids
    skipped: List[Dict[str, str]] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    event_channel: Optional["EventChannel"] = None  # type: ignore[name-defined]

    def update_phase(self, phase: Phase, message: Optional[str] = None) -> None:
        self.phase = phase
        self.stats.message = message
        if phase == "error":
            self.completed_at = datetime.utcnow()
        if phase == "done":
            self.completed_at = datetime.utcnow()

    def as_status(self) -> Dict[str, object]:
        return {
            "run_id": self.run_id,
            "phase": self.phase,
            "processed": self.stats.processed,
            "total": self.stats.total,
            "message": self.stats.message,
        }

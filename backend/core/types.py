"""Pydantic schemas shared by the Chronoface backend."""
from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional, Sequence, Tuple

from pydantic import BaseModel, Field

BucketSize = Literal["day", "week", "month", "year"]
Phase = Literal[
    "idle",
    "scanning",
    "detecting",
    "embedding",
    "clustering",
    "done",
    "error",
]


class ScanRequest(BaseModel):
    """Request body for starting a processing run."""

    folder: str = Field(..., description="Absolute path to the photo directory")
    bucket: BucketSize = Field(default="month", description="Time bucket for grouping (used for collage generation)")
    max_edge: int = Field(default=1600, ge=256, le=4096)
    min_face_px: int = Field(default=48, ge=24, le=1024)
    thumb_edge: int = Field(default=256, ge=64, le=512)
    downscale_detector: bool = Field(default=True)


class SkippedFile(BaseModel):
    filename: str
    reason: str


class ScanResponse(BaseModel):
    run_id: str
    status: Literal["started"]
    valid_count: int = 0
    skipped: List[SkippedFile] = Field(default_factory=list)


class StatusResponse(BaseModel):
    run_id: str
    phase: Phase
    processed: int
    total: int
    message: Optional[str] = None


class BucketSummary(BaseModel):
    key: str
    label: str
    photo_count: int
    face_count: int


class ClusterSummary(BaseModel):
    cluster_id: str
    face_count: int
    label: str


class SkippedPhoto(BaseModel):
    path: str
    reason: str


class FaceItem(BaseModel):
    face_id: str
    photo_id: str
    bucket: str
    bbox: Tuple[int, int, int, int]
    score: float
    size_px: int
    embedding_id: str
    cluster_id: str
    accepted: Optional[bool]
    thumb_url: str
    photo_path: str
    photo_timestamp: str


class FacesResponse(BaseModel):
    faces: List[FaceItem]
    skipped_photos: List[SkippedPhoto]


class MergeClustersRequest(BaseModel):
    clusters: Sequence[str]


class SplitClusterRequest(BaseModel):
    cluster_id: str
    face_ids: Sequence[str]


class ReviewRequest(BaseModel):
    run_id: str
    accept: Sequence[str] = Field(default_factory=list)  # face IDs
    reject: Sequence[str] = Field(default_factory=list)  # face IDs
    accept_clusters: Sequence[str] = Field(default_factory=list)  # cluster IDs
    reject_clusters: Sequence[str] = Field(default_factory=list)  # cluster IDs
    merge_clusters: Sequence[MergeClustersRequest] = Field(default_factory=list)
    split_clusters: Sequence[SplitClusterRequest] = Field(default_factory=list)


class ReviewResponse(BaseModel):
    run_id: str
    updated_faces: List[FaceItem]


class CollageRequest(BaseModel):
    run_id: str
    bucket: str
    tile_size: int = Field(default=160, ge=32, le=2000)
    columns: int = Field(default=12, ge=1, le=40)
    padding_x: int = Field(default=4, ge=0, le=500)
    padding_y: int = Field(default=4, ge=0, le=500)
    margin: int = Field(default=32, ge=0, le=256)
    background: str = Field(default="white")
    sort: Literal["by_time", "by_cluster", "random"] = Field(default="by_time")
    max_faces: int = Field(default=300, ge=1, le=2000)
    face_selection: Literal["accepted_only", "accepted_and_unreviewed"] = Field(
        default="accepted_only"
    )
    face_ids: List[str] = Field(default_factory=list)  # Optional: specific face IDs to include
    corner_radius: int = Field(default=0, ge=0, le=200)
    show_labels: bool = Field(default=True)
    title: str | None = Field(default=None)  # Optional: title text to display at top
    label_format: Literal["day", "week", "month", "year", "all"] = Field(default="all")  # Format for date labels
    output_format: Literal["A5", "A4", "A3"] = Field(default="A4")
    preview: bool = Field(default=False)  # If True, use low-quality thumbnails for faster preview


class CollageResponse(BaseModel):
    output_path: str
    width: int
    height: int
    static_url: Optional[str] = None


class ErrorResponse(BaseModel):
    error: str
    code: str
    detail: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

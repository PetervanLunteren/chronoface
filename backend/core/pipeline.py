"""Processing pipeline and run registry."""
from __future__ import annotations

import asyncio
import os
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Dict, Iterable, List, Optional

import numpy as np
from loguru import logger

from ..api.sse import EventChannel
from . import imageio
from .bucket import bucket_from_datetime, bucket_sort_key
from .cache import CacheManager
from .collage import render_collage
from .config import get_settings
from .detector import Detector, FaceDetection
from .embedder import Embedder
from .exifutil import read_capture_datetime
from .logging import with_phase
from .models import FaceRecord, PhotoRecord, RunContext, RunParameters
from .types import BucketSize, CollageRequest, Phase, ReviewRequest, ScanRequest
from .cluster import cluster_embeddings

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".heic"}


class RunNotFoundError(KeyError):
    pass


class RunManager:
    """In-memory registry and orchestrator for Chronoface runs."""

    def __init__(self) -> None:
        self._runs: Dict[str, RunContext] = {}
        self._channels: Dict[str, EventChannel] = {}
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=max(2, os.cpu_count() or 4))
        self._detector: Optional[Detector] = None
        self._embedder: Optional[Embedder] = None

    def _get_detector(self) -> Detector:
        if self._detector is None:
            settings = get_settings()
            self._detector = Detector(settings.yunet_path)
        return self._detector

    def _get_embedder(self) -> Embedder:
        if self._embedder is None:
            settings = get_settings()
            self._embedder = Embedder(settings.sface_path)
        return self._embedder

    def _register(self, context: RunContext, channel: EventChannel) -> None:
        with self._lock:
            self._runs[context.run_id] = context
            self._channels[context.run_id] = channel

    def _update(self, run_id: str, context: RunContext) -> None:
        with self._lock:
            self._runs[run_id] = context

    def get(self, run_id: str) -> RunContext:
        try:
            return self._runs[run_id]
        except KeyError as exc:  # pragma: no cover - defensive
            raise RunNotFoundError(run_id) from exc

    def get_channel(self, run_id: str) -> EventChannel:
        try:
            return self._channels[run_id]
        except KeyError as exc:  # pragma: no cover
            raise RunNotFoundError(run_id) from exc

    async def start_run(self, request: ScanRequest) -> RunContext:
        folder = Path(request.folder).expanduser().resolve()
        if not folder.exists():
            raise FileNotFoundError(f"Folder not found: {folder}")
        params = RunParameters(
            folder=folder,
            bucket=request.bucket,
            max_edge=request.max_edge,
            min_face_px=request.min_face_px,
            thumb_edge=request.thumb_edge,
            downscale_detector=request.downscale_detector,
        )
        run_id = str(uuid.uuid4())
        context = RunContext(run_id=run_id, parameters=params)
        loop = asyncio.get_running_loop()
        channel = EventChannel(loop)
        context.event_channel = channel
        self._register(context, channel)

        async def runner() -> None:
            try:
                await loop.run_in_executor(self._executor, self._run_pipeline, context)
                channel.publish("done", {"run_id": run_id})
            except Exception as exc:  # pylint: disable=broad-except
                logger.exception("Pipeline failed", exc_info=exc)
                context.update_phase("error", str(exc))
                context.errors.append(str(exc))
                channel.publish("error", {"run_id": run_id, "error": str(exc)})
            finally:
                self._update(run_id, context)

        asyncio.create_task(runner())
        return context

    def run_once(self, request: ScanRequest) -> RunContext:
        folder = Path(request.folder).expanduser().resolve()
        if not folder.exists():
            raise FileNotFoundError(f"Folder not found: {folder}")
        params = RunParameters(
            folder=folder,
            bucket=request.bucket,
            max_edge=request.max_edge,
            min_face_px=request.min_face_px,
            thumb_edge=request.thumb_edge,
            downscale_detector=request.downscale_detector,
        )
        run_id = str(uuid.uuid4())
        context = RunContext(run_id=run_id, parameters=params)
        self._runs[run_id] = context
        self._run_pipeline(context)
        return context

    def _publish_phase(self, context: RunContext, phase: Phase, message: str) -> None:
        context.update_phase(phase, message)
        channel = context.event_channel
        if channel:
            channel.publish("phase", context.as_status())

    def _publish_progress(self, context: RunContext) -> None:
        channel = context.event_channel
        if channel:
            channel.publish("progress", context.as_status())

    def _run_pipeline(self, context: RunContext) -> None:
        phase_logger = with_phase(phase="pipeline")
        phase_logger.info("Starting run {run_id}", run_id=context.run_id)
        cache = CacheManager(context.run_id)

        try:
            self._scan(context, cache)
            self._detect(context, cache)
            self._cluster(context)
            self._publish_phase(context, "done", "Processing complete")
        except Exception as exc:
            context.errors.append(str(exc))
            self._publish_phase(context, "error", str(exc))
            raise

    def _scan(self, context: RunContext, cache: CacheManager) -> None:
        self._publish_phase(context, "scanning", "Scanning photos")
        params = context.parameters
        folder = params.folder
        photos: List[PhotoRecord] = []

        # First pass: collect all image files to get total count
        all_files = [p for p in sorted(folder.rglob("*"))
                     if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS]

        context.stats.total = len(all_files)
        context.stats.processed = 0
        self._publish_progress(context)

        # Second pass: process each file
        for index, path in enumerate(all_files, start=1):
            context.stats.processed = index

            dt, reason = read_capture_datetime(path)
            if not dt:
                context.skipped.append({"path": str(path), "reason": reason or "unknown"})
                self._publish_progress(context)
                continue

            bucket = bucket_from_datetime(dt, params.bucket)
            photo_id = str(uuid.uuid4())
            img = imageio.load_image(path)
            thumb_path = imageio.save_thumbnail(photo_id, img, params.thumb_edge)
            record = PhotoRecord(
                photo_id=photo_id,
                path=path,
                timestamp=dt,
                bucket_key=bucket.key,
                bucket_label=bucket.label,
                thumb_path=thumb_path,
                width=img.width,
                height=img.height,
            )
            photos.append(record)
            context.bucket_labels.setdefault(bucket.key, bucket.label)
            context.photos_by_bucket.setdefault(bucket.key, []).append(photo_id)
            context.photos[photo_id] = record
            cache.update(path, thumb_path)
            self._publish_progress(context)

        context.stats.total = len(photos)
        self._publish_progress(context)

    def _detect(self, context: RunContext, cache: CacheManager) -> None:
        self._publish_phase(context, "detecting", "Running face detection")
        detector = self._get_detector()
        embedder = self._get_embedder()
        params = context.parameters
        faces: Dict[str, FaceRecord] = {}

        for index, photo in enumerate(context.photos.values(), start=1):
            context.stats.processed = index
            img = imageio.load_image(photo.path)
            detect_img = imageio.ensure_max_edge(img, params.max_edge) if params.downscale_detector else img
            np_image = imageio.to_numpy(detect_img)
            detections = detector.detect(np_image)
            kept: List[FaceDetection] = [
                d for d in detections if min(d.bbox[2], d.bbox[3]) >= params.min_face_px
            ]
            bucket_faces = context.faces_by_bucket.setdefault(photo.bucket_key, [])
            for det in kept:
                face_crop = imageio.crop_face(detect_img, det.bbox)
                face_id = str(uuid.uuid4())
                face_thumb_path = imageio.save_face_thumbnail(face_id, face_crop, params.thumb_edge)
                embedding = embedder.embed(imageio.to_numpy(face_crop))
                embedding_id = str(uuid.uuid4())
                size_px = int(max(det.bbox[2], det.bbox[3]))
                face_record = FaceRecord(
                    face_id=face_id,
                    photo_id=photo.photo_id,
                    bucket_key=photo.bucket_key,
                    bbox=det.bbox,
                    score=det.score,
                    size_px=size_px,
                    embedding_id=embedding_id,
                    embedding=embedding,
                    cluster_id="unassigned",
                    accepted=None,
                    thumb_path=face_thumb_path,
                )
                faces[face_id] = face_record
                bucket_faces.append(face_id)
            self._publish_progress(context)

        context.faces = faces

    def _cluster(self, context: RunContext) -> None:
        self._publish_phase(context, "embedding", "Preparing embeddings")
        # embeddings already computed in detection
        self._publish_phase(context, "clustering", "Clustering faces")

        # Cluster all faces together globally (not per bucket)
        all_face_ids = list(context.faces.keys())
        if not all_face_ids:
            context.clusters = {}
            return

        embeddings = [context.faces[face_id].embedding for face_id in all_face_ids]
        result = cluster_embeddings(embeddings, min_samples=1)

        clusters: Dict[str, List[str]] = {}
        for face_id, cluster_id in zip(all_face_ids, result.labels):
            face_record = context.faces[face_id]
            face_record.cluster_id = cluster_id
            clusters.setdefault(cluster_id, []).append(face_id)

        context.clusters = clusters  # type: ignore[assignment]

    def list_clusters(self, run_id: str) -> List[Dict[str, object]]:
        """List all detected person clusters with face counts."""
        context = self.get(run_id)
        summaries: List[Dict[str, object]] = []

        for cluster_id, face_ids in context.clusters.items():
            summaries.append(
                {
                    "cluster_id": cluster_id,
                    "face_count": len(face_ids),
                    "label": f"Person {cluster_id}" if cluster_id != "noise" else "Noise",
                }
            )

        # Sort with noise last
        summaries.sort(key=lambda x: (x["cluster_id"] == "noise", x["cluster_id"]))
        return summaries

    def list_buckets(self, run_id: str) -> List[Dict[str, object]]:
        context = self.get(run_id)
        summaries: List[Dict[str, object]] = []
        for bucket_key, label in context.bucket_labels.items():
            photo_count = len(context.photos_by_bucket.get(bucket_key, []))
            face_count = len(context.faces_by_bucket.get(bucket_key, []))
            summaries.append(
                {
                    "key": bucket_key,
                    "label": label,
                    "photo_count": photo_count,
                    "face_count": face_count,
                }
            )
        summaries.sort(key=lambda item: bucket_sort_key(item["key"]))
        return summaries

    def list_faces_by_cluster(self, run_id: str, cluster_id: str) -> List[FaceRecord]:
        """Get all faces in a specific cluster."""
        context = self.get(run_id)
        face_ids = context.clusters.get(cluster_id, [])
        return [context.faces[face_id] for face_id in face_ids]

    def list_faces(self, run_id: str, bucket: str) -> List[FaceRecord]:
        context = self.get(run_id)
        # If bucket is "all", return all faces
        if bucket == "all":
            return list(context.faces.values())
        # Otherwise return faces for specific bucket
        face_ids = context.faces_by_bucket.get(bucket, [])
        return [context.faces[face_id] for face_id in face_ids]

    def get_skipped(self, run_id: str) -> List[Dict[str, str]]:
        context = self.get(run_id)
        return context.skipped

    def apply_review(self, request: ReviewRequest) -> List[FaceRecord]:
        context = self.get(request.run_id)

        # Accept/reject individual faces
        for face_id in request.accept:
            if face_id in context.faces:
                context.faces[face_id].accepted = True
        for face_id in request.reject:
            if face_id in context.faces:
                context.faces[face_id].accepted = False

        # Accept/reject entire clusters
        for cluster_id in request.accept_clusters:
            if cluster_id in context.clusters:
                for face_id in context.clusters[cluster_id]:
                    context.faces[face_id].accepted = True
        for cluster_id in request.reject_clusters:
            if cluster_id in context.clusters:
                for face_id in context.clusters[cluster_id]:
                    context.faces[face_id].accepted = False

        # Merge clusters
        for merge in request.merge_clusters:
            cluster_ids = list(merge.clusters)
            if len(cluster_ids) < 2:
                continue
            target = cluster_ids[0]
            for source in cluster_ids[1:]:
                self._merge_clusters(context, target, source)

        # Split clusters
        for split in request.split_clusters:
            self._split_cluster(context, split.cluster_id, list(split.face_ids))

        return list(context.faces.values())

    def _merge_clusters(self, context: RunContext, target: str, source: str) -> None:
        clusters = context.clusters
        if source not in clusters:
            return
        if target not in clusters:
            clusters[target] = []

        for face_id in clusters[source]:
            context.faces[face_id].cluster_id = target
            clusters[target].append(face_id)

        # Deduplicate while preserving order
        seen: set[str] = set()
        deduped: list[str] = []
        for fid in clusters[target]:
            if fid in seen:
                continue
            seen.add(fid)
            deduped.append(fid)
        clusters[target] = deduped
        del clusters[source]

    def _split_cluster(self, context: RunContext, cluster_id: str, face_ids: List[str]) -> None:
        if not face_ids:
            return
        clusters = context.clusters
        if cluster_id not in clusters:
            return

        new_id = f"{cluster_id}_split"
        clusters[new_id] = []
        remaining = []

        for face_id in clusters[cluster_id]:
            if face_id in face_ids:
                clusters[new_id].append(face_id)
                context.faces[face_id].cluster_id = new_id
            else:
                remaining.append(face_id)
        clusters[cluster_id] = remaining

    def create_collage(self, request: CollageRequest) -> Dict[str, object]:
        context = self.get(request.run_id)
        faces = self.list_faces(request.run_id, request.bucket)

        # Filter by face_ids if provided (from Arrange step), otherwise use face_selection
        if request.face_ids:
            selected = [face for face in faces if face.face_id in request.face_ids]
        elif request.face_selection == "accepted_only":
            selected = [face for face in faces if face.accepted is True]
        else:
            selected = [face for face in faces if face.accepted is not False]

        output_path, static_path, width, height = render_collage(
            run_id=context.run_id,
            bucket=request.bucket,
            faces=selected,
            photos=context.photos,
            tile_size=request.tile_size,
            columns=request.columns,
            padding_x=request.padding_x,
            padding_y=request.padding_y,
            margin=request.margin,
            background=request.background,
            sort_mode=request.sort,
            max_faces=request.max_faces,
            output_format=request.output_format,
            corner_radius=request.corner_radius,
            show_labels=request.show_labels,
            title=request.title,
            label_format=request.label_format,
        )
        return {
            "output_path": str(output_path.resolve()),
            "width": width,
            "height": height,
            "static_url": f"/api/static/collages/{static_path.name}",
        }


run_manager = RunManager()

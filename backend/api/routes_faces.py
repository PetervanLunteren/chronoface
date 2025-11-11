from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..core.pipeline import RunNotFoundError, run_manager
from ..core.types import (
    BucketSummary,
    ClusterSummary,
    FacesResponse,
    ReviewRequest,
    ReviewResponse,
    SkippedPhoto,
)

router = APIRouter(prefix="/api")


@router.get("/clusters", response_model=list[ClusterSummary])
async def list_clusters(run_id: str = Query(...)) -> list[ClusterSummary]:
    """List all detected person clusters."""
    try:
        summaries = run_manager.list_clusters(run_id)
    except RunNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return [ClusterSummary(**summary) for summary in summaries]


@router.get("/buckets", response_model=list[BucketSummary])
async def list_buckets(run_id: str = Query(...)) -> list[BucketSummary]:
    try:
        summaries = run_manager.list_buckets(run_id)
    except RunNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return [BucketSummary(**summary) for summary in summaries]


@router.get("/cluster-faces", response_model=FacesResponse)
async def get_cluster_faces(run_id: str = Query(...), cluster_id: str = Query(...)) -> FacesResponse:
    """Get all faces in a specific cluster (person)."""
    try:
        faces = run_manager.list_faces_by_cluster(run_id, cluster_id)
        skipped = run_manager.get_skipped(run_id)
        context = run_manager.get(run_id)
    except RunNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    face_items = [
        face.as_response(context.photos[face.photo_id].path, context.photos[face.photo_id].timestamp)
        for face in faces
        if face.photo_id in context.photos
    ]
    skipped_items = [SkippedPhoto(**item) for item in skipped]
    return FacesResponse(faces=face_items, skipped_photos=skipped_items)


@router.get("/all-faces", response_model=FacesResponse)
async def get_all_faces(run_id: str = Query(...)) -> FacesResponse:
    """Get all detected faces for a run."""
    try:
        context = run_manager.get(run_id)
        skipped = run_manager.get_skipped(run_id)
    except RunNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    # Get all faces across all buckets, sorted by confidence (highest first)
    all_faces = [face for face in context.faces.values() if face.photo_id in context.photos]
    all_faces.sort(key=lambda f: f.score, reverse=True)

    face_items = [
        face.as_response(context.photos[face.photo_id].path, context.photos[face.photo_id].timestamp)
        for face in all_faces
    ]
    skipped_items = [SkippedPhoto(**item) for item in skipped]
    return FacesResponse(faces=face_items, skipped_photos=skipped_items)


@router.get("/faces", response_model=FacesResponse)
async def get_faces(run_id: str = Query(...), bucket: str = Query(...)) -> FacesResponse:
    try:
        faces = run_manager.list_faces(run_id, bucket)
        skipped = run_manager.get_skipped(run_id)
        context = run_manager.get(run_id)
    except RunNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    face_items = [
        face.as_response(context.photos[face.photo_id].path, context.photos[face.photo_id].timestamp)
        for face in faces
        if face.photo_id in context.photos
    ]
    skipped_items = [SkippedPhoto(**item) for item in skipped]
    return FacesResponse(faces=face_items, skipped_photos=skipped_items)


@router.post("/review", response_model=ReviewResponse)
async def review(request: ReviewRequest) -> ReviewResponse:
    try:
        run_manager.apply_review(request)
        context = run_manager.get(request.run_id)
    except RunNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    faces = [
        face.as_response(context.photos[face.photo_id].path, context.photos[face.photo_id].timestamp)
        for face in context.faces.values()
        if face.photo_id in context.photos
    ]
    return ReviewResponse(run_id=request.run_id, updated_faces=faces)

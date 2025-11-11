from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..core.pipeline import RunNotFoundError, run_manager
from ..core.types import CollageRequest, CollageResponse

router = APIRouter(prefix="/api")


@router.post("/collage", response_model=CollageResponse)
async def create_collage(request: CollageRequest) -> CollageResponse:
    try:
        result = run_manager.create_collage(request)
    except RunNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CollageResponse(**result)

from __future__ import annotations

import shutil
import tempfile
import uuid
from pathlib import Path
from typing import List

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse

from ..core.pipeline import RunNotFoundError, run_manager
from ..core.types import ScanRequest, ScanResponse, StatusResponse

router = APIRouter(prefix="/api")


@router.post("/upload-scan", response_model=ScanResponse)
async def upload_and_scan(files: List[UploadFile] = File(...)) -> ScanResponse:
    """Accept uploaded image files, validate them, and scan."""
    from loguru import logger
    from ..core.exifutil import read_capture_datetime
    from ..core.types import SkippedFile

    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    logger.info(f"Received {len(files)} files for upload")

    # Create a temporary directory for this upload session
    temp_dir = Path(tempfile.gettempdir()) / "chronoface_uploads" / str(uuid.uuid4())
    temp_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"Created temp directory: {temp_dir}")

    # Save all uploaded files and validate them
    valid_files: List[str] = []
    skipped_files: List[SkippedFile] = []

    for file in files:
        file_path = temp_dir / file.filename
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        logger.info(f"Saved file: {file.filename} ({file.size} bytes)")

        # Validate the image has EXIF datetime
        dt, reason = read_capture_datetime(file_path)
        if dt is None:
            # Readable reason mapping
            reason_map = {
                "missing_exif": "Missing EXIF metadata",
                "invalid_exif": "Invalid EXIF data",
                "unreadable": "Could not read image"
            }
            readable_reason = reason_map.get(reason, reason) if reason else "Unknown error"
            skipped_files.append(SkippedFile(filename=file.filename, reason=readable_reason))
            logger.warning(f"Skipping {file.filename}: {readable_reason}")
        else:
            valid_files.append(file.filename)
            logger.info(f"Validated {file.filename}: capture date {dt}")

    # If no valid files, don't start a scan
    if not valid_files:
        logger.warning("No valid files to scan")
        raise HTTPException(
            status_code=400,
            detail=f"All {len(files)} files were invalid. Images must have EXIF metadata with capture date."
        )

    # Create scan request with the temp directory
    request = ScanRequest(
        folder=str(temp_dir),
        bucket="month",
        max_edge=1600,
        min_face_px=48,
        thumb_edge=256,
        downscale_detector=True
    )

    logger.info(f"Starting scan on {len(valid_files)} valid files in {temp_dir}")
    context = await run_manager.start_run(request)

    return ScanResponse(
        run_id=context.run_id,
        status="started",
        valid_count=len(valid_files),
        skipped=skipped_files
    )


@router.post("/scan", response_model=ScanResponse)
async def start_scan(request: ScanRequest) -> ScanResponse:
    context = await run_manager.start_run(request)
    return ScanResponse(run_id=context.run_id, status="started")


@router.get("/status", response_model=StatusResponse)
async def get_status(run_id: str = Query(...)) -> StatusResponse:
    try:
        context = run_manager.get(run_id)
    except RunNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return StatusResponse(**context.as_status())


@router.get("/stream")
async def stream_events(run_id: str = Query(...)) -> StreamingResponse:
    try:
        channel = run_manager.get_channel(run_id)
    except RunNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return StreamingResponse(channel.stream(), media_type="text/event-stream")

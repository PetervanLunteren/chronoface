"""Image loading, resizing, and thumbnail utilities."""
from __future__ import annotations

import math
from pathlib import Path
from typing import Tuple

import cv2
import numpy as np
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener

from .config import get_settings

# Register HEIF/HEIC format support with Pillow
register_heif_opener()


def load_image(path: Path) -> Image.Image:
    """Open an image with orientation applied."""

    img = Image.open(path)
    return ImageOps.exif_transpose(img.convert("RGB"))


def ensure_max_edge(img: Image.Image, max_edge: int) -> Image.Image:
    """Downscale image so the long edge is at most `max_edge`."""

    if max_edge <= 0:
        return img
    w, h = img.size
    long_edge = max(w, h)
    if long_edge <= max_edge:
        return img
    scale = max_edge / float(long_edge)
    new_size = (int(round(w * scale)), int(round(h * scale)))
    return img.resize(new_size, Image.Resampling.LANCZOS)


def to_numpy(img: Image.Image) -> np.ndarray:
    """Convert an RGB image to an OpenCV-friendly ndarray."""

    return np.asarray(img)[:, :, ::-1].copy()  # RGB -> BGR


def save_thumbnail(photo_id: str, img: Image.Image, edge: int) -> Path:
    """Save a square thumbnail for the photo."""

    settings = get_settings()
    thumb_dir = settings.static_dir / "thumbs"
    thumb_dir.mkdir(parents=True, exist_ok=True)
    thumb_path = thumb_dir / f"{photo_id}.jpg"
    thumb = ImageOps.fit(img, (edge, edge), method=Image.Resampling.LANCZOS)
    thumb.save(thumb_path, format="JPEG", quality=settings.thumb_quality)
    return thumb_path


def align_face(
    img: Image.Image,
    landmarks: Tuple[Tuple[float, float], ...],
    output_size: int = 256,
) -> Image.Image:
    """Align face based on eye positions to make eyes horizontal."""

    # Extract eye landmarks (first two landmarks are right eye, left eye)
    right_eye = landmarks[0]
    left_eye = landmarks[1]

    # Calculate angle to rotate face upright
    dx = left_eye[0] - right_eye[0]
    dy = left_eye[1] - right_eye[1]
    angle = math.degrees(math.atan2(dy, dx))

    # Calculate center point between eyes
    eye_center_x = (right_eye[0] + left_eye[0]) / 2
    eye_center_y = (right_eye[1] + left_eye[1]) / 2

    # Convert PIL to numpy for rotation
    np_img = np.array(img)

    # Get rotation matrix
    M = cv2.getRotationMatrix2D((eye_center_x, eye_center_y), angle, 1.0)

    # Rotate image
    rotated = cv2.warpAffine(
        np_img,
        M,
        (img.width, img.height),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE
    )

    # Calculate eye distance and use it to determine crop size
    eye_distance = math.sqrt(dx * dx + dy * dy)
    crop_size = int(eye_distance * 4.5)  # Include more context around face

    # Crop around eye center
    half_crop = crop_size // 2
    y_offset = int(eye_distance * 0.4)  # Shift crop down slightly to center face better

    x1 = max(0, int(eye_center_x - half_crop))
    y1 = max(0, int(eye_center_y - half_crop + y_offset))
    x2 = min(rotated.shape[1], int(eye_center_x + half_crop))
    y2 = min(rotated.shape[0], int(eye_center_y + half_crop + y_offset))

    cropped = rotated[y1:y2, x1:x2]

    # Convert back to PIL and resize to output size
    pil_img = Image.fromarray(cropped)
    aligned = ImageOps.fit(pil_img, (output_size, output_size), Image.Resampling.LANCZOS)

    return aligned


def crop_face(
    img: Image.Image,
    bbox: Tuple[int, int, int, int],
    margin: float = 0.25,
) -> Image.Image:
    """Crop a face region with a margin and return a square image."""

    x, y, w, h = bbox
    cx = x + w / 2
    cy = y + h / 2
    size = max(w, h) * (1 + margin)
    half = size / 2
    left = max(int(cx - half), 0)
    upper = max(int(cy - half), 0)
    right = min(int(cx + half), img.width)
    lower = min(int(cy + half), img.height)
    crop = img.crop((left, upper, right, lower))
    square = ImageOps.fit(crop, (max(w, h), max(w, h)), Image.Resampling.LANCZOS)
    return square


def save_face_thumbnail(face_id: str, img: Image.Image, edge: int) -> Path:
    """Persist a face thumbnail for UI use."""

    settings = get_settings()
    face_dir = settings.static_dir / "faces"
    face_dir.mkdir(parents=True, exist_ok=True)
    face_path = face_dir / f"{face_id}.jpg"
    thumb = ImageOps.fit(img, (edge, edge), method=Image.Resampling.LANCZOS)
    thumb.save(face_path, format="JPEG", quality=settings.thumb_quality)
    return face_path

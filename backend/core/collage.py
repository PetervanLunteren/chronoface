"""Collage rendering utilities."""
from __future__ import annotations

import math
import random
from datetime import datetime
from pathlib import Path
from typing import Iterable, List, Tuple

from PIL import Image, ImageOps, ImageDraw, ImageFont

from .config import get_settings
from .models import FaceRecord, PhotoRecord


def _add_rounded_corners(img: Image.Image, radius: int) -> Image.Image:
    """Add rounded corners to an image."""
    if radius <= 0:
        return img

    # Create a mask with rounded corners
    mask = Image.new('L', img.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([(0, 0), img.size], radius=radius, fill=255)

    # Apply the mask
    output = Image.new('RGBA', img.size, (0, 0, 0, 0))
    output.paste(img, (0, 0))
    output.putalpha(mask)

    return output


def _sorted_faces(
    faces: Iterable[FaceRecord],
    photos: dict[str, PhotoRecord],
    mode: str,
    seed: str,
) -> List[FaceRecord]:
    faces_list = list(faces)
    if mode == "by_time":
        faces_list.sort(
            key=lambda face: photos[face.photo_id].timestamp if face.photo_id in photos else datetime.min
        )
    elif mode == "by_cluster":
        faces_list.sort(
            key=lambda face: (
                face.cluster_id,
                photos[face.photo_id].timestamp if face.photo_id in photos else datetime.min,
            )
        )
    elif mode == "random":
        rng = random.Random(seed)
        rng.shuffle(faces_list)
    return faces_list


def render_collage(
    run_id: str,
    bucket: str,
    faces: Iterable[FaceRecord],
    photos: dict[str, PhotoRecord],
    tile_size: int,
    columns: int,
    padding_x: int,
    padding_y: int,
    margin: int,
    background: str,
    sort_mode: str,
    max_faces: int,
    output_format: str = "A4",
    corner_radius: int = 0,
    show_labels: bool = True,
    title: str | None = None,
    label_format: str = "all",
    preview: bool = False,
) -> Tuple[Path, Path, int, int]:
    faces_list = _sorted_faces(faces, photos, sort_mode, seed=f"{run_id}:{bucket}:{sort_mode}")
    faces_list = faces_list[:max_faces]
    if not faces_list:
        raise ValueError("No faces available for collage")

    # Paper dimensions at 300 DPI (portrait orientation)
    paper_dimensions = {
        "A5": (1748, 2480),  # 148 x 210 mm
        "A4": (2480, 3508),  # 210 x 297 mm
        "A3": (3508, 4961),  # 297 x 420 mm
    }

    # Use paper dimensions if specified, otherwise calculate based on content
    if output_format in paper_dimensions:
        width, height = paper_dimensions[output_format]
    else:
        rows = math.ceil(len(faces_list) / columns)
        width = columns * tile_size + padding_x * (columns - 1) + margin * 2
        height = rows * tile_size + padding_y * (rows - 1) + margin * 2

    # Use RGBA mode if we have rounded corners, otherwise RGB
    mode = "RGBA" if corner_radius > 0 else "RGB"
    canvas = Image.new(mode, (width, height), background)

    # Calculate title height and draw title if provided
    title_offset = 0
    if title:
        draw = ImageDraw.Draw(canvas, mode)

        # Calculate font size based on canvas width (larger canvas = larger title)
        font_size = max(48, int(width * 0.04))  # 4% of width, minimum 48px

        # Try monospace fonts
        font_paths = [
            "/System/Library/Fonts/SFNSMono.ttf",  # SF Mono (macOS)
            "/System/Library/Fonts/Monaco.ttf",  # Monaco
            "/System/Library/Fonts/Courier New.ttf",  # Courier New
            "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",  # Linux fallback
        ]
        font = None
        for font_path in font_paths:
            try:
                font = ImageFont.truetype(font_path, font_size)
                break
            except:
                continue
        if font is None:
            font = ImageFont.load_default()

        # Get text bounding box
        bbox = draw.textbbox((0, 0), title, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]

        # Center the title horizontally, place near top
        title_x = (width - text_width) // 2
        title_y = margin

        # Draw the title
        text_color = "black" if background in ["white", "#ffffff", "rgb(255, 255, 255)"] else "white"
        draw.text((title_x, title_y), title, font=font, fill=text_color)

        # Offset the faces grid down by title height + extra spacing (2x margin for more whitespace)
        title_offset = text_height + margin * 2

    # Calculate how many tiles are in the last row
    total_faces = len(faces_list)
    full_rows = total_faces // columns
    last_row_count = total_faces % columns

    for idx, face in enumerate(faces_list):
        row = idx // columns
        col = idx % columns

        # Center the last row if it's incomplete
        if row == full_rows and last_row_count > 0:
            # Calculate offset to center the last row
            empty_slots = columns - last_row_count
            offset = (empty_slots * (tile_size + padding_x)) // 2
            x = margin + offset + col * (tile_size + padding_x)
        else:
            x = margin + col * (tile_size + padding_x)

        y = margin + title_offset + row * (tile_size + padding_y)

        # Load face image: use thumbnail for preview, original for final
        if preview:
            # Preview mode: use existing low-quality thumbnail for speed
            face_img = Image.open(face.thumb_path)
            tile = ImageOps.fit(face_img, (tile_size, tile_size), Image.Resampling.LANCZOS)
        else:
            # Final mode: load ORIGINAL image and crop the face from it for high quality
            photo = photos.get(face.photo_id)
            if photo:
                from loguru import logger
                from .imageio import load_image, crop_face

                # Load original high-quality image
                original_img = load_image(photo.path)

                # The bbox was detected on a downscaled image (max_edge=1600), so we need to scale it up
                # to match the original image size
                max_edge = 1600  # This was the detection size (from ScanRequest params)
                orig_w, orig_h = original_img.size
                scale_factor = max(orig_w, orig_h) / max_edge if max(orig_w, orig_h) > max_edge else 1.0

                # Scale the bbox coordinates to the original image size
                bbox_x, bbox_y, bbox_w, bbox_h = face.bbox
                scaled_bbox = (
                    int(bbox_x * scale_factor),
                    int(bbox_y * scale_factor),
                    int(bbox_w * scale_factor),
                    int(bbox_h * scale_factor)
                )

                logger.info(f"Original size: {original_img.size}, Detection bbox: {face.bbox}, Scaled bbox: {scaled_bbox}, Scale: {scale_factor:.2f}")

                # Crop the face region from the original using the scaled bbox
                face_crop = crop_face(original_img, scaled_bbox, margin=0.25)

                # Resize to tile size with high quality
                tile = ImageOps.fit(face_crop, (tile_size, tile_size), Image.Resampling.LANCZOS)
            else:
                continue  # Skip if photo not found

        # Apply rounded corners if specified
        if corner_radius > 0:
            tile = _add_rounded_corners(tile, corner_radius)
            canvas.paste(tile, (x, y), tile)  # Use tile as mask for transparency
        else:
            canvas.paste(tile, (x, y))

        # Add date label below the image if requested
        if show_labels:
            photo = photos.get(face.photo_id)
            if photo:
                # Format the date based on label_format
                if label_format == "day":
                    # Day: Show full date (current format)
                    date_str = photo.timestamp.strftime("%b %d, %Y")
                elif label_format == "week":
                    # Week: Show "Week N, YYYY"
                    week_num = photo.timestamp.isocalendar()[1]
                    year = photo.timestamp.year
                    date_str = f"Week {week_num}, {year}"
                elif label_format == "month":
                    # Month: Show "Mon, YYYY"
                    date_str = photo.timestamp.strftime("%b, %Y")
                elif label_format == "year":
                    # Year: Show "YYYY"
                    date_str = photo.timestamp.strftime("%Y")
                else:
                    # All/other: Show full date (current format)
                    date_str = photo.timestamp.strftime("%b %d, %Y")

                # Create a drawing context
                draw = ImageDraw.Draw(canvas, mode)

                # Scale font size with tile size (larger tiles = larger font)
                try:
                    font_size = max(16, tile_size // 15)  # Normal size: //15
                    # Try monospace fonts
                    font_paths = [
                        "/System/Library/Fonts/SFNSMono.ttf",  # SF Mono (macOS)
                        "/System/Library/Fonts/Monaco.ttf",  # Monaco
                        "/System/Library/Fonts/Courier New.ttf",  # Courier New
                        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",  # Linux fallback
                    ]
                    font = None
                    for font_path in font_paths:
                        try:
                            font = ImageFont.truetype(font_path, font_size)
                            break
                        except:
                            continue
                    if font is None:
                        raise Exception("No fonts found")
                except Exception as e:
                    font = ImageFont.load_default()

                # Get text bounding box
                bbox = draw.textbbox((0, 0), date_str, font=font)
                text_width = bbox[2] - bbox[0]
                text_height = bbox[3] - bbox[1]

                # Position BELOW the tile (not on top of it)
                text_x = x + (tile_size - text_width) // 2
                text_y = y + tile_size + 8  # 8px gap below the tile

                # Draw text in dark gray/black (no background needed since it's on white)
                draw.text((text_x, text_y), date_str, fill=(80, 80, 80), font=font)

    # Convert RGBA to RGB for JPEG export (composite rounded corners onto background)
    if mode == "RGBA":
        rgb_canvas = Image.new("RGB", canvas.size, background)
        rgb_canvas.paste(canvas, (0, 0), canvas)  # Use canvas as alpha mask
        canvas = rgb_canvas

    settings = get_settings()
    output_dir = settings.output_dir / run_id
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"chronoface_collage_{bucket}_{timestamp}.jpg"
    output_path = output_dir / filename
    canvas.save(output_path, format="JPEG", quality=95)
    static_dir = settings.static_dir / "collages"
    static_dir.mkdir(parents=True, exist_ok=True)
    static_path = static_dir / filename
    canvas.save(static_path, format="JPEG", quality=95)
    return output_path, static_path, width, height

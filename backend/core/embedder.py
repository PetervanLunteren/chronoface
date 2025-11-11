"""SFace embedding wrapper."""
from __future__ import annotations

from pathlib import Path
from typing import Iterable

import cv2
import numpy as np


class Embedder:
    """Face embedding using SFace ONNX."""

    def __init__(self, model_path: Path) -> None:
        if not model_path.exists():
            raise FileNotFoundError(
                f"SFace model not found at {model_path}. Run backend/scripts/fetch_models.py"
            )
        self.model_path = model_path
        self.recognizer = cv2.FaceRecognizerSF.create(str(model_path), "", 0, 0)

    def embed(self, face_image: np.ndarray) -> np.ndarray:
        if face_image.dtype != np.uint8:
            face_image = face_image.astype(np.uint8)
        result = self.recognizer.feature(face_image)
        if isinstance(result, (tuple, list)):
            embedding = result[0]
        else:
            embedding = result
        vector = np.asarray(embedding, dtype=np.float32).reshape(-1)
        norm = float(np.linalg.norm(vector))
        if norm > 0:
            vector = vector / norm
        return vector

    def batch_embed(self, faces: Iterable[np.ndarray]) -> list[np.ndarray]:
        return [self.embed(face) for face in faces]

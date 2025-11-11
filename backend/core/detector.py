"""YuNet-based face detector."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List

import cv2
import numpy as np


@dataclass
class FaceDetection:
    bbox: tuple[int, int, int, int]
    score: float
    landmarks: tuple[tuple[float, float], ...]  # 5 landmarks: right_eye, left_eye, nose, right_mouth, left_mouth


class Detector:
    """Wrapper around YuNet running on CPU."""

    def __init__(
        self,
        model_path: Path,
        score_threshold: float = 0.5,
        nms_threshold: float = 0.3,
        top_k: int = 5000,
    ) -> None:
        if not model_path.exists():
            raise FileNotFoundError(
                f"YuNet model not found at {model_path}. Run backend/scripts/fetch_models.py"
            )
        self.model_path = model_path
        self.score_threshold = float(score_threshold)
        self.nms_threshold = float(nms_threshold)
        self.top_k = int(top_k)
        self.detector = cv2.FaceDetectorYN.create(
            str(model_path),
            "",
            (320, 320),
            self.score_threshold,
            self.nms_threshold,
            self.top_k,
        )

    def detect(self, image: np.ndarray) -> List[FaceDetection]:
        height, width = image.shape[:2]
        self.detector.setInputSize((width, height))
        success, faces = self.detector.detect(image)
        if not success or faces is None:
            return []

        detections: List[FaceDetection] = []
        for row in faces:
            x, y, w, h = row[:4]
            # YuNet returns: [x, y, w, h, right_eye_x, right_eye_y, left_eye_x, left_eye_y,
            #                 nose_x, nose_y, right_mouth_x, right_mouth_y, left_mouth_x, left_mouth_y, score]
            landmarks = (
                (float(row[4]), float(row[5])),   # right eye
                (float(row[6]), float(row[7])),   # left eye
                (float(row[8]), float(row[9])),   # nose tip
                (float(row[10]), float(row[11])), # right mouth corner
                (float(row[12]), float(row[13])), # left mouth corner
            )
            score = float(row[-1])
            bbox = (int(x), int(y), int(w), int(h))
            detections.append(FaceDetection(bbox=bbox, score=score, landmarks=landmarks))
        detections.sort(key=lambda d: d.score, reverse=True)
        return detections

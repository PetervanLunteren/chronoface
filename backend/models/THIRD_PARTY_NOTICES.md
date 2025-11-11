# Third-Party Notices

Chronoface bundles the following third-party machine learning models from the
OpenCV Zoo project. Both models are licensed under the Apache License 2.0.

| Model | Source | License | Notes |
| ----- | ------ | ------- | ----- |
| YuNet face detector | https://github.com/opencv/opencv_zoo/tree/master/models/face_detection_yunet | Apache-2.0 | CPU-friendly face detector used for bounding boxes. |
| SFace face recognizer | https://github.com/opencv/opencv_zoo/tree/master/models/face_recognition_sface | Apache-2.0 | Generates 128D face embeddings for clustering. |

Download the models using `python backend/scripts/fetch_models.py`. Checksums are
stored alongside the model files once downloaded.

from __future__ import annotations

import numpy as np

from backend.core.cluster import cluster_embeddings


def test_cluster_embeddings_groups_similar_faces() -> None:
    base = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    similar = base + np.array([0.01, 0.0, 0.0], dtype=np.float32)
    similar /= np.linalg.norm(similar)
    different = np.array([0.0, 1.0, 0.0], dtype=np.float32)
    embeddings = [base, similar, different]
    result = cluster_embeddings(embeddings, min_samples=1)
    assert len(result.labels) == 3
    assert result.labels[0] == result.labels[1]
    assert result.labels[2] != result.labels[0]

"""Clustering helpers."""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import List, Sequence

import numpy as np
from sklearn.cluster import DBSCAN


@dataclass
class ClusterResult:
    labels: List[str]
    noise_label: str = "noise"
    eps_used: float = 0.45
    min_samples: int = 3


def _estimate_eps(embeddings: Sequence[np.ndarray]) -> float:
    if len(embeddings) <= 1:
        return 0.3
    matrix = np.stack(embeddings)
    similarities = matrix @ matrix.T
    np.fill_diagonal(similarities, 1.0)
    distances = 1.0 - similarities
    tri = distances[np.tril_indices_from(distances, k=-1)]

    # Use a more conservative approach: use a smaller percentile instead of median
    # This makes clustering stricter (faces need to be more similar to be in same cluster)
    percentile_25 = float(np.percentile(tri, 25)) if tri.size else 0.3
    return max(percentile_25 * 0.8, 0.2)


def cluster_embeddings(
    embeddings: Sequence[np.ndarray],
    min_samples: int = 3,
) -> ClusterResult:
    if not embeddings:
        return ClusterResult(labels=[], min_samples=min_samples, eps_used=0.0)

    matrix = np.stack(embeddings)
    eps = _estimate_eps(embeddings)
    clustering = DBSCAN(eps=eps, min_samples=min_samples, metric="cosine")
    labels = clustering.fit_predict(matrix)

    cluster_map: dict[int, str] = {}
    results: List[str] = []
    cluster_count = 0
    for label in labels:
        if label == -1:
            results.append("noise")
            continue
        if label not in cluster_map:
            cluster_count += 1
            cluster_map[label] = f"cluster_{cluster_count:03d}"
        results.append(cluster_map[label])
    return ClusterResult(labels=results, min_samples=min_samples, eps_used=eps)
